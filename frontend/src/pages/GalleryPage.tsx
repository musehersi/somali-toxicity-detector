import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Download,
  Calendar,
  BarChart3,
  FileText,
  Mic,
  Video,
  Upload,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  AudioLines,
  ChevronLeft,
  ChevronRight,
  File,
  RefreshCw,
  Gauge,
  Clock,
  Volume2,
  Play,
  Pause,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

interface AnalysisItem {
  id: string;
  user_id: string;
  audio_storage_path: string;
  audio_url: string;
  model_type: "asr_classification" | "end_to_end";
  model_output_label: "toxic" | "non_toxic";
  final_label: "toxic" | "non_toxic";
  model_confidence: number;
  transcript: string | null;
  created_at: string;
  latency_seconds?: number;
}

const itemsPerPage = 20;
const audioBase =
  "https://wfefaeslioqwmkpjwguw.supabase.co/storage/v1/object/public/wavs/";

export default function GalleryPage() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filters
  const [predictionFilter, setPredictionFilter] = useState<
    "all" | "toxic" | "non_toxic"
  >("all");
  const [modelFilter, setModelFilter] = useState<
    "all" | "asr_classification" | "end_to_end"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAnalyses();
  }, [user, currentPage, predictionFilter, modelFilter, searchQuery]);

  const toggleAudioPlayback = (url: string) => {
    if (playingAudio === url) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      setPlayingAudio(url);
      if (!audioRef.current || audioRef.current.src !== url) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const newAudio = new Audio(url);
        newAudio.play();
        newAudio.onended = () => setPlayingAudio(null);
        audioRef.current = newAudio;
      } else {
        audioRef.current.play();
      }
    }
  };

  const fetchAnalyses = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from("feedback")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Apply filters
      if (predictionFilter !== "all") {
        query = query.eq("final_label", predictionFilter);
      }
      if (modelFilter !== "all") {
        query = query.eq("model_type", modelFilter);
      }
      if (searchQuery) {
        query = query.or(
          `transcript.ilike.%${searchQuery}%,audio_storage_path.ilike.%${searchQuery}%`
        );
      }

      // Pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Format data with audio URLs
      const formattedData = (data || []).map((item) => ({
        ...item,
        audio_url: `${audioBase}${item.audio_storage_path.replace(
          /^wavs\//,
          ""
        )}`,
      }));

      setAnalyses(formattedData);
      setTotalItems(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 1) / itemsPerPage)));
    } catch (e: any) {
      console.error("Failed to load analyses:", e.message);
      toast.error("Failed to load audio gallery");
    } finally {
      setLoading(false);
    }
  };

  const getAudioTypeIcon = (path: string | null) => {
    if (!path) return Upload;
    if (path.includes("recorded/")) return Mic;
    if (path.includes("video")) return Video;
    return Upload;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const downloadAudio = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `audio-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportData = () => {
    const csvContent = [
      "ID,Created At,Model Type,Final Label,Confidence,Transcript,Storage Path",
      ...analyses.map((a) =>
        [
          a.id,
          a.created_at,
          a.model_type,
          a.final_label,
          a.model_confidence,
          `"${a.transcript || ""}"`,
          a.audio_storage_path || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Exported as CSV");
  };

  const clearFilters = () => {
    setPredictionFilter("all");
    setModelFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const hasFilters =
    predictionFilter !== "all" || modelFilter !== "all" || searchQuery;

  const getModelName = (model: string) => {
    switch (model) {
      case "asr_classification":
        return "ASR + Classification";
      case "end_to_end":
        return "End-to-End";
      default:
        return model;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 bg-white dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              Audio Gallery
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              View and manage your analyzed audio samples
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg shadow transition-colors dark:from-indigo-500 dark:to-purple-500"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchAnalyses}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg shadow transition-colors dark:from-indigo-500 dark:to-purple-500"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats and Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search transcripts or audio paths..."
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={searchQuery}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setSearchQuery(e.target.value);
                  }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border ${
                    showFilters
                      ? "bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  <Filter className="h-5 w-5" />
                  <span>Filters</span>
                  {hasFilters && (
                    <span className="bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs dark:bg-indigo-400">
                      {[predictionFilter, modelFilter].filter(
                        (f) => f !== "all"
                      ).length + (searchQuery ? 1 : 0)}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Filters panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Final Label
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        predictionFilter === "all"
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                      onClick={() => setPredictionFilter("all")}
                    >
                      All
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        predictionFilter === "toxic"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                      onClick={() => setPredictionFilter("toxic")}
                    >
                      Toxic
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        predictionFilter === "non_toxic"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                      onClick={() => setPredictionFilter("non_toxic")}
                    >
                      Non-Toxic
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Model Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        modelFilter === "all"
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                      onClick={() => setModelFilter("all")}
                    >
                      All
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        modelFilter === "asr_classification"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                      onClick={() => setModelFilter("asr_classification")}
                    >
                      ASR + Classification
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        modelFilter === "end_to_end"
                          ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                      onClick={() => setModelFilter("end_to_end")}
                    >
                      End-to-End
                    </button>
                  </div>
                </div>

                {hasFilters && (
                  <div className="md:col-span-2 pt-2">
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear all filters</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl shadow border border-indigo-100 dark:border-indigo-900/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-indigo-700 dark:text-indigo-300">
              Your Analyses
            </h3>
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
              <Volume2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">
            {totalItems}
          </p>
          <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
            Total analyses
          </p>
        </div>
      </div>

      {/* Content - Grid View Only */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="flex flex-col items-center justify-center">
            <RefreshCw className="animate-spin w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading your audio gallery...
            </p>
          </div>
        </div>
      ) : analyses.length === 0 ? (
        <div className="text-center py-10">
          <BarChart3 className="mx-auto w-10 h-10 text-gray-400 dark:text-gray-500" />
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            No entries found
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analyses.map((entry) => {
            const Icon = getAudioTypeIcon(entry.audio_storage_path);
            const isToxic = entry.final_label === "toxic";
            const isPlaying = playingAudio === entry.audio_url;

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm dark:border-gray-700 overflow-hidden"
              >
                <div
                  className={`px-4 py-2 ${
                    isToxic
                      ? "bg-red-100 dark:bg-red-800/20"
                      : "bg-green-100 dark:bg-green-800/20"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                      <span
                        className={`text-sm font-semibold ${
                          isToxic
                            ? "text-red-700 dark:text-red-300"
                            : "text-green-700 dark:text-green-300"
                        }`}
                      >
                        {isToxic ? "Toxic" : "Non-Toxic"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-white">
                        {entry.model_type === "end_to_end"
                          ? Math.round(entry.model_confidence)
                          : Math.round(entry.model_confidence * 100)}
                        %
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">
                        {getModelName(entry.model_type)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(entry.created_at)}</span>
                    </div>
                    {entry.latency_seconds && (
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{entry.latency_seconds.toFixed(2)}s</span>
                      </div>
                    )}
                  </div>

                  {entry.transcript && (
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      <div className="flex items-center space-x-1 mb-1">
                        <FileText className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span className="text-xs uppercase text-gray-500 dark:text-gray-400">
                          Transcript
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-300">
                        “{entry.transcript}”
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleAudioPlayback(entry.audio_url)}
                      className={`p-2 rounded-full ${
                        isPlaying
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => downloadAudio(entry.audio_url)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing{" "}
          <span className="font-medium dark:text-gray-300">
            {(currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          to{" "}
          <span className="font-medium dark:text-gray-300">
            {Math.min(currentPage * itemsPerPage, totalItems)}
          </span>{" "}
          of{" "}
          <span className="font-medium dark:text-gray-300">{totalItems}</span>{" "}
          entries
        </div>

        <div className="flex gap-2">
          <button
            className="flex items-center justify-center p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>

          <div className="flex items-center">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={i}
                  className={`w-10 h-10 rounded-lg mx-0.5 text-sm font-medium ${
                    currentPage === pageNum
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <span className="mx-1 text-gray-500 dark:text-gray-400">...</span>
            )}

            {totalPages > 5 && currentPage < totalPages - 1 && (
              <button
                className={`w-10 h-10 rounded-lg mx-0.5 text-sm font-medium ${
                  currentPage === totalPages
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
                onClick={() => setCurrentPage(totalPages)}
              >
                {totalPages}
              </button>
            )}
          </div>

          <button
            className="flex items-center justify-center p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
