import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Download,
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
  BarChart2,
  Gauge,
  Clock,
  Volume2,
} from "lucide-react";

// Audio analysis item type
interface AnalysisItem {
  id: string;
  audio_file_name: string;
  audio_url: string;
  model_used: "asr_classification" | "end_to_end";
  prediction: "toxic" | "non_toxic";
  confidence: number;
  latency_seconds: number;
  transcript: string | null;
  created_at: string;
}

const itemsPerPage = 10;

export default function AnalysisHistoryPage() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

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
  }, [currentPage, predictionFilter, modelFilter, searchQuery]);

  const fetchAnalyses = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from("audio_analysis")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Apply filters
      if (predictionFilter !== "all")
        query = query.eq("prediction", predictionFilter);
      if (modelFilter !== "all") query = query.eq("model_used", modelFilter);
      if (searchQuery) {
        query = query.or(
          `transcript.ilike.%${searchQuery}%,audio_file_name.ilike.%${searchQuery}%`
        );
      }

      // Pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setAnalyses((data as AnalysisItem[]) || []);
      setTotalItems(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 1) / itemsPerPage)));
    } catch (e: any) {
      console.error("Failed to load analyses:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const downloadAudio = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || `audio-${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              Analysis History
            </h1>
            <p className="text-gray-600 mt-2">
              Review your past audio analysis results
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAnalyses}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg shadow transition-colors"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats and Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search transcripts or file names..."
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                      ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Filter className="h-5 w-5" />
                  <span>Filters</span>
                  {hasFilters && (
                    <span className="bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
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
              <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prediction
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        predictionFilter === "all"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setPredictionFilter("all")}
                    >
                      All
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        predictionFilter === "toxic"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setPredictionFilter("toxic")}
                    >
                      Toxic
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        predictionFilter === "non_toxic"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setPredictionFilter("non_toxic")}
                    >
                      Non-Toxic
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        modelFilter === "all"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setModelFilter("all")}
                    >
                      All
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        modelFilter === "asr_classification"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setModelFilter("asr_classification")}
                    >
                      ASR + Classification
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                        modelFilter === "end_to_end"
                          ? "bg-teal-100 text-teal-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                      className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
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

        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl shadow border border-indigo-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-indigo-700">Your Analyses</h3>
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Volume2 className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-800">{totalItems}</p>
          <p className="text-sm text-indigo-600 mt-1">Total analyses</p>
        </div>
      </div>

      {/* Analysis List */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center justify-center">
              <RefreshCw className="animate-spin w-8 h-8 text-indigo-600 mb-3" />
              <p className="text-gray-600">Loading your analysis history...</p>
            </div>
          </div>
        ) : analyses.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center justify-center">
              <File className="w-10 h-10 text-gray-400 mb-3" />
              <h3 className="font-medium text-gray-900">
                No analysis records found
              </h3>
              <p className="text-gray-500 mt-1">
                {hasFilters
                  ? "No results match your filters"
                  : "You haven't analyzed any audio yet"}
              </p>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                      Audio
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                      Model
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                      Prediction
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                      Confidence
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                      Transcript
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                      Latency
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                      Date
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analyses.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <audio
                          controls
                          src={item.audio_url}
                          className="w-full max-w-[140px] rounded-lg shadow-inner bg-gray-100"
                        />
                      </td>

                      <td className="py-4 px-4">
                        <span className="text-sm font-medium">
                          {getModelName(item.model_used)}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            item.prediction === "toxic"
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {item.prediction === "toxic" ? "Toxic" : "Non-Toxic"}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2.5">
                            <div
                              className="bg-indigo-600 h-2.5 rounded-full"
                              style={{
                                width: `${Math.round(item.confidence * 100)}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 max-w-xs">
                        <div className="flex items-start gap-2">
                          <AudioLines className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-1" />
                          <span className="text-sm line-clamp-2">
                            {item.transcript || "No transcript available"}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          <Gauge className="w-4 h-4 text-indigo-500" />
                          <span className="text-sm font-medium text-gray-700">
                            {item.latency_seconds.toFixed(2)}s
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {formatDate(item.created_at)}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <button
                          onClick={() =>
                            downloadAudio(item.audio_url, item.audio_file_name)
                          }
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium"
                          title="Download audio"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
        <div className="text-sm text-gray-600">
          Showing{" "}
          <span className="font-medium">
            {(currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          to{" "}
          <span className="font-medium">
            {Math.min(currentPage * itemsPerPage, totalItems)}
          </span>{" "}
          of <span className="font-medium">{totalItems}</span> entries
        </div>

        <div className="flex gap-2">
          <button
            className="flex items-center justify-center p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-5 w-5 text-gray-700" />
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
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <span className="mx-1 text-gray-500">...</span>
            )}

            {totalPages > 5 && currentPage < totalPages - 1 && (
              <button
                className={`w-10 h-10 rounded-lg mx-0.5 text-sm font-medium ${
                  currentPage === totalPages
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setCurrentPage(totalPages)}
              >
                {totalPages}
              </button>
            )}
          </div>

          <button
            className="flex items-center justify-center p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      </div>
    </div>
  );
}
