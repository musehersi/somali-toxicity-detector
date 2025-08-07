// Final, corrected code for frontend/src/services/api.ts
// CORRECT
import { client as gradioClient } from "@gradio/client";

class ApiService {
  async detectToxicity(
    audioBlob: Blob,
    model: "asr-text" | "end-to-end"
  ): Promise<{ label: string; confidence: string }> {
    try {
      // Determine which Space to call
      const space_id =
        model === "asr-text"
          ? "ooloteam/wav2vec2-somali-api" // Make sure this is your ASR Space name
          : "ooloteam/SomaliSpeechToxicityClassifier";

      // Connect to the Hugging Face Space directly using the Gradio client
      const app = await gradio.client(space_id);
      const result = await app.predict("/predict", {
        // The Gradio client handles the file upload format automatically
        input_file: new File([audioBlob], "audio.wav"),
      });

      // The result from the API will be a tuple: [label, confidence]
      const [label, confidence] = result.data;

      return { label, confidence };
    } catch (error: any) {
      console.error("API error:", error);
      throw new Error(
        error.message || "Failed to process audio. Please try again."
      );
    }
  }

  // You can keep your other API service functions if needed
}

export const apiService = new ApiService();
