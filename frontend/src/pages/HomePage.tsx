import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AudioInput from "../components/Audio/AudioInput";
import ModelSelector from "../components/Audio/ModelSelector";
import PredictionResult from "../components/Audio/PredictionResult";
import FeedbackForm from "../components/Audio/FeedbackForm";
import { apiService } from "../services/api";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Play,
  Loader,
  AlertCircle,
  Trash2,
  ChevronRight,
  Check,
  BarChart,
  Volume2,
  Shield,
  Zap,
  Server,
  HelpCircle,
  File,
  Mic,
  Video,
} from "lucide-react";
import toast from "react-hot-toast";

export default function HomePage() {
  const { user } = useAuth();

  const [selectedAudio, setSelectedAudio] = useState<{
    file: File;
    url: string;
    type: "uploaded" | "recorded" | "video_extracted";
  } | null>(null);

  const [selectedModel, setSelectedModel] = useState<
    "asr_classification" | "end_to_end" | null
  >(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [isVideoProcessing, setIsVideoProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize AudioContext on user interaction
  useEffect(() => {
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
    };

    // Initialize on first user interaction
    const handleUserInteraction = () => {
      initAudioContext();
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
    };

    window.addEventListener("click", handleUserInteraction);
    window.addEventListener("touchstart", handleUserInteraction);

    return () => {
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
    };
  }, []);

  // Fast audio extraction from video using Web Audio API
  const extractAudioFromVideo = async (videoFile: File): Promise<Blob> => {
    if (!audioContextRef.current) {
      throw new Error("Audio context not initialized");
    }

    const startTime = performance.now();
    setIsVideoProcessing(true);

    try {
      const arrayBuffer = await videoFile.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(
        arrayBuffer
      );

      // Create WAV blob
      const wavBlob = encodeWAVToBlob(
        audioBuffer.getChannelData(0),
        audioBuffer.sampleRate
      );

      const endTime = performance.now();
      setLatency(endTime - startTime);

      return wavBlob;
    } catch (err) {
      console.error("Audio extraction failed:", err);
      throw new Error("Failed to extract audio from video");
    } finally {
      setIsVideoProcessing(false);
    }
  };

  // Efficient WAV encoder
  const encodeWAVToBlob = (samples: Float32Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (view: DataView, offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    // Convert to 16-bit PCM
    const volume = 1;
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i])) * volume;
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }

    return new Blob([view], { type: "audio/wav" });
  };

  const handleAudioSelect = async (
    file: File | null,
    url: string,
    type: "uploaded" | "recorded" | "video_extracted"
  ) => {
    if (file && type === "video_extracted") {
      try {
        const audioBlob = await extractAudioFromVideo(file);
        const audioFile = new window.File(
          [audioBlob],
          `${file.name.replace(/\.[^/.]+$/, "")}.wav`,
          {
            type: "audio/wav",
          }
        );

        setSelectedAudio({
          file: audioFile,
          url: URL.createObjectURL(audioBlob),
          type: "video_extracted",
        });
      } catch (err) {
        toast.error("Failed to extract audio from video");
        return;
      }
    } else {
      setSelectedAudio(file ? { file, url, type } : null);
    }

    setAnalysisResult(null);
    setAnalysisId(null);
    setError(null);
    setFeedbackSubmitted(false);
    setLatency(null);
    if (file) setActiveStep(1);
  };

  const handleAnalyze = async () => {
    if (!selectedAudio || !selectedModel || !user) return;

    setIsAnalyzing(true);
    setError(null);
    setActiveStep(2);
    const startTime = performance.now();

    try {
      const result = await apiService.detectToxicity(
        selectedAudio.file,
        selectedModel === "asr_classification" ? "asr-text" : "end-to-end"
      );

      const endTime = performance.now();
      const analysisLatency = (endTime - startTime) / 1000;
      setLatency(analysisLatency);

      setAnalysisResult({
        ...result,
        latency: analysisLatency,
      });
      setActiveStep(3);

      // Upload audio in background without blocking UI
      setIsUploading(true);
      try {
        const audioUrl = await apiService.uploadAudio(selectedAudio.file);
        const { data, error: dbError } = await supabase
          .from("audio_analysis")
          .insert({
            user_id: user.id,
            audio_file_name: selectedAudio.file.name,
            audio_url: audioUrl,
            model_used: selectedModel,
            prediction: result.isToxic ? "toxic" : "non_toxic",
            confidence: result.confidence,
            transcript: result.transcription || null,
            latency_seconds: analysisLatency,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (dbError) throw dbError;
        setAnalysisId(data.id);
      } catch (uploadErr) {
        console.error("Background upload error:", uploadErr);
      } finally {
        setIsUploading(false);
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Analysis failed");
      toast.error("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateStoragePath = async (
    is_correct: boolean,
    label: "toxic" | "non_toxic"
  ): Promise<string> => {
    const category = is_correct ? "corrected" : "incorrected";
    const folder = label === "toxic" ? "toxic" : "non-toxic";
    const prefix = `wavs/${category}/${folder}`;

    const { data, error } = await supabase.storage
      .from("wavs")
      .list(`${category}/${folder}`);

    if (error) {
      console.error("❌ Could not list files:", error.message);
      return `${prefix}/${label}1.wav`;
    }

    const existingNumbers = data
      .map((item) => {
        const match = item.name.match(/\D*(\d+)\.wav$/);
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null);

    const nextNumber =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const filename = `${label}${nextNumber}.wav`;

    return `${prefix}/${filename}`;
  };

  const uploadToBucket = async (path: string) => {
    if (!selectedAudio?.file) return;
    const { error } = await supabase.storage
      .from("wavs")
      .upload(path.replace("wavs/", ""), selectedAudio.file, {
        upsert: false,
        contentType: "audio/wav",
      });
    if (error) throw new Error("Upload to bucket failed");
  };

  const handleFeedbackSubmit = async (feedback: {
    is_correct: boolean;
    corrected_label?: "toxic" | "non_toxic";
    comment?: string;
  }) => {
    if (!analysisId || !analysisResult || !user) return;

    if (!feedback.is_correct && !feedback.corrected_label) {
      toast.error("Please select a corrected label before submitting.");
      return;
    }

    const label = feedback.is_correct
      ? analysisResult.isToxic
        ? "toxic"
        : "non_toxic"
      : feedback.corrected_label!;

    const storagePath = await generateStoragePath(feedback.is_correct, label);

    try {
      await uploadToBucket(storagePath);
    } catch (err) {
      console.error("Storage upload error:", err);
      toast.error("Audio save failed");
      return;
    }

    const payload = {
      user_id: user.id,
      analysis_id: analysisId,
      corrected_label: feedback.corrected_label || label,
      final_label: label,
      model_output_label: analysisResult.isToxic ? "toxic" : "non_toxic",
      is_correct: feedback.is_correct,
      comment: feedback.comment || null,
      audio_storage_path: storagePath,
      model_type: selectedModel,
      model_confidence: analysisResult.confidence,
      transcript: analysisResult.transcription || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("feedback").insert(payload);

    if (error) {
      console.error("❌ Feedback insert error:", error.message, error.details);
      toast.error("Failed to submit feedback");
    } else {
      setFeedbackSubmitted(true);
      toast.success("✅ Thank you for your feedback!");
    }
  };

  const canAnalyze = selectedAudio && selectedModel && !isAnalyzing;

  const getStepIcon = (step: number) => {
    if (activeStep === step)
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-white">
          <ChevronRight size={16} />
        </div>
      );
    if (activeStep > step)
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center text-white">
          <Check size={16} />
        </div>
      );
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center text-gray-500">
        {step + 1}
      </div>
    );
  };

  // Stats data
  const stats = [
    {
      bg: "bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20",
      iconBg:
        "bg-gradient-to-r from-teal-100 to-blue-100 dark:from-teal-800/30 dark:to-blue-800/30",
      icon: <Shield className="w-5 h-5 text-teal-600 dark:text-teal-300" />,
      value: "98.2%",
      label: "Accuracy",
    },
    {
      bg: "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
      iconBg:
        "bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-800/30 dark:to-indigo-800/30",
      icon: <Zap className="w-5 h-5 text-blue-600 dark:text-blue-300" />,
      value: "<3s",
      label: "Avg. Response",
    },
    {
      bg: "bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
      iconBg:
        "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800/30 dark:to-pink-800/30",
      icon: (
        <BarChart className="w-5 h-5 text-purple-600 dark:text-purple-300" />
      ),
      value: "10K+",
      label: "Audio Analyzed",
    },
    {
      bg: "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20",
      iconBg:
        "bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-800/30 dark:to-orange-800/30",
      icon: <Server className="w-5 h-5 text-amber-600 dark:text-amber-300" />,
      value: "99.9%",
      label: "Uptime",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-blue-900/10">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-teal-500 to-blue-600 p-2 rounded-lg shadow-lg">
              <Volume2 className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-700 dark:from-teal-400 dark:to-blue-300">
              Somali Audio Toxicity Detection
            </h1>
          </div>

          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="font-medium">How it works</span>
          </button>
        </header>

        {/* Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`${stat.bg} p-4 rounded-xl shadow-lg border border-white/50 dark:border-gray-700 flex items-center gap-3`}
            >
              <div className={`${stat.iconBg} p-2 rounded-lg`}>{stat.icon}</div>
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="text-gray-600 dark:text-gray-300 text-sm">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How It Works Modal */}
        <AnimatePresence>
          {showHowItWorks && (
            <motion.div
              className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHowItWorks(false)}
            >
              <motion.div
                className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-700 dark:from-teal-400 dark:to-blue-300">
                    How It Works
                  </h3>
                  <button
                    onClick={() => setShowHowItWorks(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    {/* <X className="w-6 h-6" /> */}
                  </button>
                </div>
                <div className="p-5">
                  <div className="space-y-5">
                    <div className="flex items-start gap-4">
                      <div className="bg-gradient-to-r from-teal-100 to-blue-100 dark:from-teal-800/20 dark:to-blue-800/20 p-3 rounded-xl">
                        <File className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          1. Upload Audio
                        </h4>
                        <p className="text-gray-600 dark:text-gray-300">
                          Upload audio files, record directly, or extract audio
                          from video content in seconds.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-gradient-to-r from-teal-100 to-blue-100 dark:from-teal-800/20 dark:to-blue-800/20 p-3 rounded-xl">
                        <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          2. Select Model
                        </h4>
                        <p className="text-gray-600 dark:text-gray-300">
                          Choose between ASR+Classification or End-to-End
                          detection based on your needs.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-gradient-to-r from-teal-100 to-blue-100 dark:from-teal-800/20 dark:to-blue-800/20 p-3 rounded-xl">
                        <BarChart className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          3. Get Results
                        </h4>
                        <p className="text-gray-600 dark:text-gray-300">
                          Receive toxicity analysis with confidence score in
                          under 3 seconds.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-900/10 dark:to-teal-900/10 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                      <span className="bg-gradient-to-r from-teal-500 to-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                        !
                      </span>
                      Pro Tips
                    </h4>
                    <ul className="space-y-2 text-gray-600 dark:text-gray-300 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-teal-600 dark:text-teal-400 font-bold">
                          •
                        </span>
                        Use clear audio with minimal background noise
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-teal-600 dark:text-teal-400 font-bold">
                          •
                        </span>
                        Keep audio clips under 30 seconds for fastest results
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-teal-600 dark:text-teal-400 font-bold">
                          •
                        </span>
                        Use End-to-End model for short phrases
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    onClick={() => setShowHowItWorks(false)}
                    className="w-full py-3 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg"
                  >
                    Start Analyzing
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-6">
            {["Upload", "Model", "Analyze", "Results"].map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                {getStepIcon(index)}
                <span
                  className={`mt-2 text-xs font-medium ${
                    activeStep >= index
                      ? "text-gradient bg-gradient-to-r from-teal-600 to-blue-700 dark:from-teal-400 dark:to-blue-300"
                      : "text-gray-500"
                  }`}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/10 rounded-2xl shadow-xl overflow-hidden border border-white/50 dark:border-gray-700">
          <div className="p-6">
            {/* Audio Selection */}
            <section className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Select Audio Source
                </h2>
                {selectedAudio && (
                  <button
                    onClick={() => {
                      handleAudioSelect(null, "", "uploaded");
                      setActiveStep(0);
                    }}
                    className="flex items-center text-sm text-red-500 hover:text-red-700 space-x-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-4">
                <AudioInput
                  onAudioSelect={handleAudioSelect}
                  selectedAudio={selectedAudio}
                />

                {selectedAudio && (
                  <motion.div
                    className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-900/10 dark:to-teal-900/10 rounded-lg flex items-center gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="bg-gradient-to-r from-teal-100 to-blue-100 dark:from-teal-800/20 dark:to-blue-800/20 p-2 rounded-lg">
                      {selectedAudio.type === "uploaded" && (
                        <File className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      )}
                      {selectedAudio.type === "recorded" && (
                        <Mic className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      )}
                      {selectedAudio.type === "video_extracted" && (
                        <Video className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      )}
                    </div>
                    <div className="truncate">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {selectedAudio.file.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedAudio.type === "uploaded"
                          ? "Uploaded file"
                          : selectedAudio.type === "recorded"
                          ? "Recorded audio"
                          : "Video extraction"}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </section>

            {/* Model Selection */}
            <AnimatePresence>
              {selectedAudio && (
                <motion.section
                  className="mb-8"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    Select Detection Model
                  </h2>

                  <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow border border-gray-100 dark:border-gray-700 p-4">
                    <ModelSelector
                      selectedModel={selectedModel}
                      onModelSelect={setSelectedModel}
                    />

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg border border-blue-100 dark:border-blue-800">
                        <h3 className="font-semibold text-blue-700 dark:text-blue-400 text-sm">
                          ASR + Classification
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          Best for longer audio, converts speech to text first
                        </p>
                      </div>
                      <div className="p-3 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/10 dark:to-teal-900/10 rounded-lg border border-green-100 dark:border-green-800">
                        <h3 className="font-semibold text-green-700 dark:text-green-400 text-sm">
                          End-to-End
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          Faster for short phrases, analyzes audio directly
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Analyze Button */}
            <AnimatePresence>
              {canAnalyze && (
                <motion.div
                  className="flex justify-center mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <button
                    onClick={handleAnalyze}
                    disabled={!canAnalyze}
                    className="w-full py-3 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg transition-all flex items-center justify-center space-x-2 transform hover:scale-[1.02] duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    <span>
                      {isAnalyzing ? "Analyzing..." : "Start Toxicity Analysis"}
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Latency Display */}
            {latency !== null && (
              <div className="mt-4 text-sm text-center text-gray-600 dark:text-gray-300">
                Processing time:{" "}
                <span className="font-semibold text-teal-600 dark:text-teal-400">
                  {(latency / 1000).toFixed(2)} seconds
                </span>
              </div>
            )}

            {/* Results Section */}
            <AnimatePresence>
              {analysisResult && (
                <motion.section
                  className="space-y-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                      Analysis Results
                    </h2>
                    <PredictionResult result={analysisResult} />
                  </div>

                  {analysisId && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                        Feedback
                      </h2>
                      <FeedbackForm
                        analysisResult={{ ...analysisResult, id: analysisId }}
                        onFeedbackSubmit={handleFeedbackSubmit}
                        hasSubmitted={feedbackSubmitted}
                      />
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>

            {/* Error Display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="mt-6 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-red-900 dark:text-red-100 text-sm">
                        Analysis Error
                      </h4>
                      <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                        {error}
                      </p>
                      <button
                        onClick={() => setError(null)}
                        className="mt-2 text-xs bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-700 dark:from-teal-400 dark:to-blue-300 mb-2">
              Why Choose Our Service?
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-xl mx-auto">
              Advanced AI-powered toxicity detection optimized for Somali
              language
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/10 p-4 rounded-xl shadow-lg border border-white/50 dark:border-gray-700 hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-teal-100 to-blue-100 dark:from-teal-800/20 dark:to-blue-800/20 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                Lightning Fast
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Get results in under 3 seconds with our optimized AI models
              </p>
            </div>
            <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/10 p-4 rounded-xl shadow-lg border border-white/50 dark:border-gray-700 hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-teal-100 to-blue-100 dark:from-teal-800/20 dark:to-blue-800/20 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                Highly Accurate
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                98.2% accuracy rate for Somali language detection
              </p>
            </div>
            <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/10 p-4 rounded-xl shadow-lg border border-white/50 dark:border-gray-700 hover:shadow-xl transition-shadow">
              <div className="bg-gradient-to-r from-teal-100 to-blue-100 dark:from-teal-800/20 dark:to-blue-800/20 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <Server className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                Reliable
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                99.9% uptime with enterprise-grade infrastructure
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
