// types/api.ts

import { DetectionResult } from "../contexts/AudioContext";

interface AnalysisResult {
  prediction: "toxic" | "non_toxic";
  confidence: number;
  transcript?: string;
  latency: number;
  model_type: "asr_classification" | "end_to_end";
}

class ApiService {
  private baseUrl = https:somali-toxicity-detector.onrender.com; // 🛠️ Change this to your deployed backend URL if needed

  /**
   * Upload audio file to backend for storage (e.g., Supabase or disk)
   * @param audioBlob audio file as Blob
   * @returns public URL or relative path to audio
   */
  async uploadAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Upload error:", text);
      throw new Error("Audio upload failed");
    }

    const data = await response.json();
    return data.url; // usually like `/uploads/filename.wav` or full public URL
  }

  /**
   * Detect toxicity using selected model
   * @param audioBlob audio input as Blob
   * @param model "asr-text" or "end-to-end"
   * @returns detection result with labels, confidence, timestamp
   */
  async detectToxicity(
    audioBlob: Blob,
    model: "asr-text" | "end-to-end"
  ): Promise<DetectionResult> {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");
    formData.append(
      "model_type",
      model === "asr-text" ? "asr_classification" : "audio_to_audio"
    );

    try {
      const response = await fetch(`${this.baseUrl}/api/process`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Detection failed");
      }

      const data = await response.json();
      // console.log("Backend result:", data.result.toxicity);

      // console.log("🔍 Backend result:", data.result); // 🐞 Log full result
      // console.log("🧪 Toxicity:", data.result.toxicity); // 🐞 Log toxicity section
      // console.log("📜 Transcription:", data.result.transcription); // 🐞 Optional
      // ✅ Correct mapping based on actual backend structure
      return {
        isToxic: data.result.toxicity.label === "toxic",
        confidence: data.result.toxicity.confidence,
        model,
        transcription: data.result.transcription,
        categories: data.result.toxicity.categories || [], // optional
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error("API error:", error);
      throw new Error(
        error.message || "Failed to process audio. Please try again."
      );
    }
  }

  /**
   * Submit feedback after result shown
   * @param recordingId ID from Supabase or backend
   * @param feedback object containing corrections and optional comments
   */
  async submitFeedback(
    recordingId: string,
    feedback: {
      is_correct: boolean;
      corrected_label?: "toxic" | "non_toxic";
      final_label: "toxic" | "non_toxic";
      model_output_label: "toxic" | "non_toxic";
      comment?: string;
      audio_storage_path?: string;
      model_type: string; // ✅
      model_confidence: number; // ✅
    }
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordingId,
        feedback,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Feedback error:", text);
      throw new Error("Feedback submission failed");
    }
  }
}

export const apiService = new ApiService();
