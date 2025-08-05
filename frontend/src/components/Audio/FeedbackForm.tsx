import React, { useState, useEffect } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Send,
  Loader,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

interface FeedbackFormProps {
  analysisResult: {
    id: string;
    prediction: "toxic" | "non_toxic";
    confidence: number;
    model_type: string;
    audio_storage_path?: string;
  };
  onFeedbackSubmit: (feedback: {
    is_correct: boolean;
    corrected_label?: "toxic" | "non_toxic";
    final_label: "toxic" | "non_toxic";
    model_output_label: "toxic" | "non_toxic";
    comment?: string;
    audio_storage_path?: string;
    model_type: string;
    model_confidence: number;
  }) => Promise<void>;
  hasSubmitted: boolean;
}

export default function FeedbackForm({
  analysisResult,
  onFeedbackSubmit,
  hasSubmitted,
}: FeedbackFormProps) {
  const [feedbackType, setFeedbackType] = useState<
    "correct" | "incorrect" | null
  >(null);
  const [correctedLabel, setCorrectedLabel] = useState<
    "toxic" | "non_toxic" | null
  >(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Reset form when analysisResult changes
  useEffect(() => {
    setFeedbackType(null);
    setCorrectedLabel(null);
    setComment("");
    setSubmitted(false);
  }, [analysisResult]);

  const handleFeedbackTypeSelect = (type: "correct" | "incorrect") => {
    setFeedbackType(type);
    setCorrectedLabel(null); // always reset and require manual click
  };

  const handleSubmit = async () => {
    if (!feedbackType) {
      toast.error("Please select whether the prediction was correct.");
      return;
    }

    const isCorrect = feedbackType === "correct";
    const finalLabel = isCorrect ? analysisResult.prediction : correctedLabel;

    if (!isCorrect && !correctedLabel) {
      toast.error("Please select the correct label");
      return;
    }

    console.log("🧪 Submitting Feedback:");
    console.log("📌 is_correct:", isCorrect);
    console.log("📌 corrected_prediction:", correctedLabel);
    console.log("📌 final_label:", finalLabel);
    console.log("📌 model_output_label:", analysisResult.prediction);

    setIsSubmitting(true);
    try {
      await onFeedbackSubmit({
        is_correct: isCorrect,
        corrected_label: isCorrect ? undefined : correctedLabel!,
        final_label: finalLabel!,
        model_output_label: analysisResult.prediction,
        comment: comment.trim() || undefined,
        audio_storage_path: analysisResult.audio_storage_path,
        model_type: analysisResult.model_type,
        model_confidence: analysisResult.confidence,
      });

      toast.success("Thank you for your feedback!");
      setSubmitted(true);
    } catch (error) {
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted || hasSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
            <ThumbsUp className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <h4 className="font-medium text-green-900 dark:text-green-100">
              Thank you for your feedback!
            </h4>
            <p className="text-sm text-green-700 dark:text-green-300">
              Your input helps improve our model accuracy.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            How accurate was this prediction?
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your feedback helps us improve model performance.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Was the prediction correct?
          </p>
          <div className="flex space-x-4">
            <button
              onClick={() => handleFeedbackTypeSelect("correct")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all ${
                feedbackType === "correct"
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                  : "border-gray-300 dark:border-gray-600 hover:border-green-400 text-gray-700 dark:text-gray-300"
              }`}
            >
              <ThumbsUp className="h-4 w-4" />
              <span>Correct</span>
            </button>
            <button
              onClick={() => handleFeedbackTypeSelect("incorrect")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all ${
                feedbackType === "incorrect"
                  ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                  : "border-gray-300 dark:border-gray-600 hover:border-red-400 text-gray-700 dark:text-gray-300"
              }`}
            >
              <ThumbsDown className="h-4 w-4" />
              <span>Incorrect</span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {feedbackType === "incorrect" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                What should the correct label be?
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setCorrectedLabel("toxic")}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    correctedLabel === "toxic"
                      ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                      : "border-gray-300 dark:border-gray-600 hover:border-red-400 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  Toxic
                </button>
                <button
                  onClick={() => setCorrectedLabel("non_toxic")}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    correctedLabel === "non_toxic"
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                      : "border-gray-300 dark:border-gray-600 hover:border-green-400 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  Non-Toxic
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {feedbackType && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Additional Comments (optional)
                </label>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share any thoughts..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {feedbackType &&
            (feedbackType === "correct" ||
              (feedbackType === "incorrect" && correctedLabel)) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>
                    {isSubmitting ? "Submitting..." : "Submit Feedback"}
                  </span>
                </button>
              </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}
