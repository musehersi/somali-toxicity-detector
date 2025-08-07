// Final, definitive code for frontend/src/services/api.ts

import { client as gradioClient } from "@gradio/client";
import type { DetectionResult } from "../contexts/AudioContext"; // Assuming this is your type

class ApiService {
  async detectToxicity(
    audioBlob: Blob,
    model: "asr-text" | "end-to-end"
  ): Promise<DetectionResult> {
    try {
      // Determine which Hugging Face Space to call
      const spaceId =
        model === "end-to-end"
          ? "ooloteam/SomaliSpeechToxicityClassifier"
          : "ooloteam/wav2vec2-somali-api"; // Make sure this is your ASR Space name

      // Connect to the Hugging Face Space directly using the correctly imported client
      const app = await gradioClient(spaceId);
      
      const result = await app.predict("/predict", [
        // The gradio client expects the input as an array of arguments
        new File([audioBlob], "audio.wav"), // The 'audio' argument
        null, // A null placeholder for the 'video' argument
      ]);

      // The result from the API will be a tuple: [label, confidence]
      const [label, confidence] = result.data;

      return {
        isToxic: label.includes("TOXIC"),
        confidence: parseFloat(confidence) || 0,
        model,
        // If the ASR model returns a transcript, it will be in the 'label'
        transcription: model === 'asr-text' ? label : undefined,
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error("Hugging Face Space API error:", error);
      throw new Error(
        error.message || "Failed to process audio via Hugging Face Space."
      );
    }
  }
}

export const apiService = new ApiService();
