import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";

interface PredictionResultProps {
  result: {
    isToxic: boolean;
    confidence?: number;
    transcription?: string;
    latency?: number;
    model: "asr-text" | "end-to-end";
    model_type?: "asr_classification" | "end_to_end";
  };
}

export default function PredictionResult({ result }: PredictionResultProps) {
  // ✅ Use the `isToxic` flag from backend, do NOT re-calculate from prediction string
  const isToxic = result.isToxic === true;

  const confidenceScore =
    typeof result.confidence === "number" ? result.confidence : 0;
  const latency = typeof result.latency === "number" ? result.latency : 0;
  const confidencePercentage =
    confidenceScore > 1
      ? Math.round(confidenceScore)
      : Math.round(confidenceScore * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div
        className={`px-6 py-4 ${
          isToxic
            ? "bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800"
            : "bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isToxic ? (
              <AlertTriangle className="h-6 w-6 text-red-600" />
            ) : (
              <CheckCircle className="h-6 w-6 text-green-600" />
            )}
            <div>
              <h3
                className={`text-lg font-semibold ${
                  isToxic
                    ? "text-red-900 dark:text-red-100"
                    : "text-green-900 dark:text-green-100"
                }`}
              >
                {isToxic ? "Toxic Content Detected" : "Non-Toxic Content"}
              </h3>
              <p
                className={`text-sm ${
                  isToxic
                    ? "text-red-700 dark:text-red-300"
                    : "text-green-700 dark:text-green-300"
                }`}
              >
                Model:{" "}
                {result.model === "asr-text"
                  ? "ASR → XLM-RoBERTa"
                  : "Wav2Vec2 End-to-End"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4" />
            <span>{latency.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Confidence */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Confidence Score
              </span>
            </div>
            <span
              className={`text-sm font-semibold ${
                isToxic ? "text-red-600" : "text-green-600"
              }`}
            >
              {confidencePercentage}%
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${confidencePercentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-3 rounded-full ${
                isToxic ? "bg-red-600" : "bg-green-600"
              }`}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Low Confidence</span>
            <span>High Confidence</span>
          </div>
        </div>

        {/* Transcription */}
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Transcript
            </span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
              {result.transcription ? (
                `"${result.transcription}"`
              ) : (
                <em>No transcript available.</em>
              )}
            </p>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Processing Time
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {latency.toFixed(2)} seconds
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Model Pipeline
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {result.model === "asr-text" ? "ASR + Text" : "Audio Direct"}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
