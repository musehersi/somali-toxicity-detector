import librosa
import numpy as np
import soundfile as sf

SAMPLE_RATE = 16000

def load_and_preprocess(audio_path, target_sr=SAMPLE_RATE, mono=True):
    """
    Load audio, convert to mono, and resample to target sample rate.
    Returns waveform as float32 numpy array and sample rate.
    """
    waveform, orig_sr = librosa.load(audio_path, sr=None, mono=mono)
    if orig_sr != target_sr:
        waveform = librosa.resample(waveform, orig_sr=orig_sr, target_sr=target_sr)
    return waveform.astype(np.float32), target_sr

def save_as_16bit_pcm(audio_path, output_path):
    """
    Load audio, preprocess to 16 kHz mono, and save as 16-bit PCM WAV.
    """
    waveform, sr = load_and_preprocess(audio_path)
    # Convert to 16-bit PCM range (-32768 to 32767)
    waveform = np.clip(waveform, -1.0, 1.0)
    waveform_16bit = (waveform * 32767).astype(np.int16)
    sf.write(output_path, waveform_16bit, sr, subtype='PCM_16')

def check_and_convert(audio_path, output_path=None):
    """
    Check if audio is 16 kHz, mono, 16-bit PCM.
    If not, convert and save to output_path (if provided).
    Returns waveform, sample_rate, and a flag indicating if conversion was needed.
    """
    # Load metadata to check format
    info = sf.info(audio_path)
    is_mono = info.channels == 1
    is_16khz = info.samplerate == SAMPLE_RATE
    is_16bit = info.subtype == 'PCM_16'

    if is_mono and is_16khz and is_16bit:
        print("Audio is already in required format (16 kHz, mono, 16-bit PCM)")
        waveform, sr = librosa.load(audio_path, sr=SAMPLE_RATE, mono=True)
        return waveform, sr, False
    else:
        print("Audio is not in required format. Converting...")
        # Load and preprocess
        waveform, sr = librosa.load(audio_path, sr=None, mono=True)
        if sr != SAMPLE_RATE:
            waveform = librosa.resample(waveform, orig_sr=sr, target_sr=SAMPLE_RATE)
            sr = SAMPLE_RATE
        # Save as 16-bit PCM if output_path is provided
        if output_path:
            waveform = np.clip(waveform, -1.0, 1.0)
            waveform_16bit = (waveform * 32767).astype(np.int16)
            sf.write(output_path, waveform_16bit, sr, subtype='PCM_16')
        return waveform, sr, True

# Example usage (uncomment to test)
# if __name__ == "__main__":
#     waveform, sr, converted = check_and_convert("input.wav", "output.wav")
#     print(f"Waveform shape: {waveform.shape}, Sample rate: {sr}, Converted: {converted}")
