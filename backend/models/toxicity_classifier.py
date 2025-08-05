import torch
import librosa
import numpy as np
import os
from transformers import (
    AutoProcessor,
    AutoModelForCTC,
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Wav2Vec2Processor,
    Wav2Vec2ForCTC,
)
from huggingface_hub import hf_hub_download
import torch.nn as nn
import torch.nn.functional as F
from models.audio_processing import load_and_preprocess


# ─── GLOBALS ──────────────────────────────────────────────
device      = "cuda" if torch.cuda.is_available() else "cpu"
SAMPLE_RATE = 16000
ASR_MODEL_ID = "ooloteam/wav2vec2-somali"
TOXICITY_MODEL_ID = "ooloteam/SomaliSpeechToxicityClassifier"
MAX_DURATION = 60  # seconds

# ─── CUSTOM TOXICITY CLASSIFIER ───────────────────────────
class RobustAudioClassifier(nn.Module):
    def __init__(self, base_model, num_classes=1):
        super().__init__()
        self.audio_encoder = base_model.wav2vec2

        for i, layer in enumerate(self.audio_encoder.encoder.layers[:15]):
            for param in layer.parameters():
                param.requires_grad = False

        self.attention = nn.MultiheadAttention(
            embed_dim=base_model.config.hidden_size,
            num_heads=8,
            batch_first=True
        )

        self.classifier = nn.Sequential(
            nn.Linear(base_model.config.hidden_size, 512),
            nn.GELU(),
            nn.BatchNorm1d(512),
            nn.Dropout(0.4),
            nn.Linear(512, 256),
            nn.GELU(),
            nn.BatchNorm1d(256),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes)
        )

        self.calibration = nn.Parameter(torch.tensor([1.0]))
        self.temperature = nn.Parameter(torch.tensor([1.0]))

    def forward(self, input_values):
        outputs = self.audio_encoder(input_values)
        hidden_states = outputs.last_hidden_state
        context, _ = self.attention(hidden_states, hidden_states, hidden_states)
        context = torch.mean(context, dim=1)
        logits = self.classifier(context)
        calibrated = logits * self.calibration / self.temperature
        return calibrated.squeeze()

# ─── MODEL SETUP ──────────────────────────────────────────

def load_models():
    # ASR
    asr_processor = Wav2Vec2Processor.from_pretrained(ASR_MODEL_ID)
    asr_model = Wav2Vec2ForCTC.from_pretrained(ASR_MODEL_ID).to(device)

    # Text classifier
    tokenizer = AutoTokenizer.from_pretrained("ooloteam/last_text_classifier")
    clf_model = AutoModelForSequenceClassification.from_pretrained(
        "ooloteam/last_text_classifier"
    ).to(device)

    # Toxicity classifier (custom)
    base_model = Wav2Vec2ForCTC.from_pretrained(ASR_MODEL_ID)
    toxicity_model = RobustAudioClassifier(base_model)
    model_path = hf_hub_download(
        repo_id=TOXICITY_MODEL_ID,
        filename="best_model.pt"
    )
    state_dict = torch.load(model_path, map_location=device)
    toxicity_model.load_state_dict(state_dict, strict=False)
    toxicity_model.to(device)
    toxicity_model.eval()

    return asr_processor, asr_model, tokenizer, clf_model, toxicity_model

asr_processor, asr_model, tokenizer, clf_model, toxicity_model = load_models()

# ─── AUDIO PREPROCESSING ─────────────────────────────────

# Replace your preprocess_audio function with this:
def preprocess_audio(audio_path, target_sr=SAMPLE_RATE, max_duration=MAX_DURATION):
    waveform, sr = load_and_preprocess(audio_path, target_sr=target_sr)
    if len(waveform) > target_sr * max_duration:
        waveform = waveform[:target_sr * max_duration]
    max_val = np.max(np.abs(waveform))
    if max_val > 0:
        waveform /= max_val
    return waveform, sr

# ─── ROUTER ────────────────────────────────────────────────

def analyze_audio(audio_path, model_type="asr_classification"):
    if model_type == "asr_classification":
        return process_asr_classification(audio_path)
    elif model_type == "audio_to_audio":
        return process_audio_to_audio(audio_path)
    else:
        raise ValueError(f"Unknown model type: {model_type}")

# ─── ASR + TEXT CLASSIFIER ────────────────────────────────

def process_asr_classification(audio_path):
    speech, sr = librosa.load(audio_path, sr=SAMPLE_RATE, mono=True)
    inputs = asr_processor(speech, sampling_rate=sr, return_tensors="pt", padding=True)
    input_values = inputs.input_values.to(device)
    with torch.no_grad():
        logits = asr_model(input_values).logits
        predicted_ids = torch.argmax(logits, dim=-1)
    transcription = asr_processor.batch_decode(predicted_ids)[0]

    enc = tokenizer(
        transcription,
        return_tensors="pt",
        truncation=True,
        max_length=128
    )
    input_ids      = enc.input_ids.to(device)
    attention_mask = enc.attention_mask.to(device)
    with torch.no_grad():
        text_logits = clf_model(input_ids, attention_mask=attention_mask).logits
        probs       = torch.softmax(text_logits, dim=-1)[0]

    label      = "non-toxic" if torch.argmax(probs) == 1 else "toxic"
    confidence = probs[torch.argmax(probs)].item()

    return {
        "transcription": transcription,
        "toxicity": {
            "label":      label,
            "confidence": confidence
        }
    }

# ─── AUDIO→AUDIO CLASSIFIER ───────────────────────────────

def process_audio_to_audio(audio_path):
    try:
        waveform, sample_rate = preprocess_audio(audio_path)
        inputs = asr_processor(
            waveform,
            sampling_rate=sample_rate,
            return_tensors="pt"
        ).input_values.to(device)

        with torch.no_grad():
            logits = toxicity_model(inputs)
            prob = torch.sigmoid(logits).item()

        label = "toxic" if prob > 0.5 else "non-toxic"
        confidence = round(prob * 100, 2) if prob > 0.5 else round((1 - prob) * 100, 2)

        return {
            "audio_duration": len(waveform) / SAMPLE_RATE,
            "sample_rate": SAMPLE_RATE,
            "toxicity": {
                "label": label,
                "probability": float(prob),
                "confidence": float(confidence),
                "safe_probability": float(1 - prob)
            }
        }

    except Exception as e:
        error_msg = f"[process_audio_to_audio] Error processing {audio_path}: {str(e)}"
        print(error_msg)
        return {
            "error": error_msg,
            "toxicity": {
                "label": "ERROR",
                "probability": 0.5,
                "confidence": 0.0,
                "safe_probability": 0.5
            }
        }
