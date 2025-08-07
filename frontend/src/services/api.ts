// Final, definitive code for frontend/src/services/api.ts

import { client as gradioClient } from "@gradio/client";
import type { DetectionResult } from "../contexts/AudioContext";

class ApiService {
  async detectToxicity(
    audioBlob: Blob,
    model: "asr-text" | "end-to-end"
  ): Promise<DetectionResult> {
    try {
      const spaceId =
        model === "end-to-end"
          ? "ooloteam/SomaliSpeechToxicityClassifier"
          : "ooloteam/wav2vec2-somali-api";

      const app = await gradioClient(spaceId);
      
      // The simplified API now only takes one argument
      const result = await app.predict(0, [
        new File([audioBlob], "audio.wav"),
      ]);

      const predictionData = result.data[0].confidences;
      const toxicConfidence = predictionData.find(p => p.label.includes("TOXIC"))?.confidence || 0;
      const nonToxicConfidence = predictionData.find(p => p.label.includes("NON-TOXIC"))?.confidence || 0;
      
      const isToxic = toxicConfidence > nonToxicConfidence;
      const confidence = isToxic ? toxicConfidence : nonToxicConfidence;

      return {
        isToxic: isToxic,
        confidence: confidence * 100, // Convert to percentage
        model,
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
