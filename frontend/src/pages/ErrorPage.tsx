import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  AlertCircle,
  BarChart2,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  Search,
  Shield,
  Zap,
  Server,
  Gauge,
  FileText,
  File,
  AudioLines,
  User,
  Database,
  Activity,
  CheckCircle,
  Play,
  Pause,
} from "lucide-react";

interface ErrorAnalysisItem {
  id: string;
  audio_storage_path: string;
  audio_url: string;
  model_type: "asr_classification" | "end_to_end";
  model_output_label: "toxic" | "non_toxic";
  corrected_label: "toxic" | "non_toxic";
  model_confidence: number;
  transcript: string | null;
  created_at: string;
  latency_seconds: number;
  user_email: string;
}

const itemsPerPage = 10;
const audioBase =
  "https://wfefaeslioqwmkpjwguw.supabase.co/storage/v1/object/public/wavs/";

export default function ErrorAnalysisPage() {
  const [errors, setErrors] = useState<ErrorAnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filters
  const [modelFilter, setModelFilter] = useState<
    "all" | "asr_classification" | "end_to_end"
  >("all");
  const [confidenceFilter, setConfidenceFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [errorTypeFilter, setErrorTypeFilter] = useState<"all" | "fn" | "fp">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Stats
  const [totalErrors, setTotalErrors] = useState(0);
  const [asrErrors, setAsrErrors] = useState(0);
  const [e2eErrors, setE2eErrors] = useState(0);
  const [avgConfidence, setAvgConfidence] = useState(0);
  const [fnRate, setFnRate] = useState(0);
  const [fpRate, setFpRate] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);

  useEffect(() => {
    fetchErrorData();
    fetchErrorStats();
  }, [
    currentPage,
    modelFilter,
    confidenceFilter,
    errorTypeFilter,
    searchQuery,
  ]);

  const toggleAudioPlayback = (url: string) => {
    if (playingAudio === url) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      setPlayingAudio(url);
      // Create a new audio element if needed
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

  const fetchErrorData = async () => {
    setLoading(true);
    try {
      // 1. Fetch feedback entries
      const { data: feedback, error: feedbackError } = await supabase
        .from("feedback")
        .select("*");

      if (feedbackError) throw feedbackError;

      // 2. Get unique user_ids
      const userIds = feedback
        ? [...new Set(feedback.map((f) => f.user_id))]
        : [];

      // 3. Fetch user profiles for those user_ids
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // 4. Merge email into feedback
      const emailMap = Object.fromEntries(profiles.map((p) => [p.id, p.email]));
      const feedbackWithEmail = feedback.map((f) => ({
        ...f,
        email: emailMap[f.user_id] || null,
      }));

      if (!feedbackWithEmail || feedbackWithEmail.length === 0) {
        setErrors([]);
        setTotalItems(0);
        setLoading(false);
        return;
      }

      // Format data with user email
      const formattedData = feedbackWithEmail.map((item) => ({
        ...item,
        audio_url: `${audioBase}${item.audio_storage_path.replace(
          /^wavs\//,
          ""
        )}`,
        user_email: item.email || "unknown",
      }));

      // Filter for misclassified samples
      let misclassifiedData = formattedData.filter(
        (item) => item.model_output_label !== item.corrected_label
      );

      // Apply filters to misclassified data
      let filteredData = misclassifiedData;

      if (modelFilter !== "all") {
        filteredData = filteredData.filter(
          (item) => item.model_type === modelFilter
        );
      }

      if (confidenceFilter !== "all") {
        filteredData = filteredData.filter((item) => {
          const confidence = item.model_confidence;
          if (confidenceFilter === "high") return confidence >= 0.8;
          if (confidenceFilter === "medium")
            return confidence < 0.8 && confidence >= 0.5;
          if (confidenceFilter === "low") return confidence < 0.5;
          return true;
        });
      }

      if (errorTypeFilter !== "all") {
        filteredData = filteredData.filter((item) => {
          if (errorTypeFilter === "fn")
            return (
              item.model_output_label === "non_toxic" &&
              item.corrected_label === "toxic"
            );
          if (errorTypeFilter === "fp")
            return (
              item.model_output_label === "toxic" &&
              item.corrected_label === "non_toxic"
            );
          return true;
        });
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredData = filteredData.filter(
          (item) =>
            (item.transcript &&
              item.transcript.toLowerCase().includes(query)) ||
            (item.user_email && item.user_email.toLowerCase().includes(query))
        );
      }

      // Pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage;
      const paginatedData = filteredData.slice(from, to);

      setErrors(paginatedData);
      setTotalItems(filteredData.length);
      setTotalPages(Math.max(1, Math.ceil(filteredData.length / itemsPerPage)));
    } catch (e: any) {
      console.error("Failed to load error data:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchErrorStats = async () => {
    try {
      // Total feedback entries
      const { count: totalCount } = await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true });
      setTotalEntries(totalCount || 0);

      // Total errors (misclassifications)
      const { data: feedback, count: totalEntries } = await supabase
        .from("feedback")
        .select("*", { count: "exact" });

      const misclassified = (feedback ?? []).filter(
        (f) => f.model_output_label !== f.corrected_label
      );

      setTotalErrors(misclassified.length);

      // Model-specific errors
      // Fetch all feedback once, then filter in JS

      const asrErrors = misclassified.filter(
        (f) => f.model_type === "asr_classification"
      ).length;

      const e2eErrors = misclassified.filter(
        (f) => f.model_type === "end_to_end"
      ).length;

      setAsrErrors(asrErrors);
      setE2eErrors(e2eErrors);

      // Average confidence - fixed calculation
      // Supabase does NOT support .neq between two columns, so fetch all and filter in JS

      const { data: confidenceData } = await supabase
        .from("feedback")
        .select(
          "model_confidence, model_type, model_output_label, corrected_label"
        );

      if (confidenceData && confidenceData.length > 0) {
        // Only misclassified samples
        const misclassified = confidenceData.filter(
          (item) => item.model_output_label !== item.corrected_label
        );

        if (misclassified.length > 0) {
          let totalConfidence = 0;

          misclassified.forEach((item) => {
            let confidence = item.model_confidence;
            // Adjust confidence based on model type
            if (item.model_type === "end_to_end") {
              // End-to-end is already 0-100, use as is
              totalConfidence += confidence;
            } else {
              // ASR is 0-1, convert to 0-100
              totalConfidence += confidence * 100;
            }
          });

          const avg = totalConfidence / misclassified.length;
          setAvgConfidence(avg);
        } else {
          setAvgConfidence(0);
        }
      } else {
        setAvgConfidence(0);
      }

      // Error rates
      const { count: fnCount } = await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .eq("model_output_label", "non_toxic")
        .eq("corrected_label", "toxic");

      const { count: fpCount } = await supabase
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .eq("model_output_label", "toxic")
        .eq("corrected_label", "non_toxic");

      setFnRate(fnCount || 0);
      setFpRate(fpCount || 0);
    } catch (e: any) {
      console.error("Failed to load error stats:", e.message);
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

  const downloadAudio = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `error-sample-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCsv = async () => {
    try {
      // Fetch all error data
      const { data } = await supabase
        .from("feedback")
        .select(
          `
          id,
          audio_storage_path,
          model_type,
          model_output_label,
          corrected_label,
          model_confidence,
          transcript,
          created_at,
          latency_seconds,
          user_id,
          profiles:user_id (email)
        `
        )
        .neq("model_output_label", "corrected_label");

      if (!data || data.length === 0) return;

      // Create CSV content
      const csvContent = [
        "ID,Model Type,Model Output,Corrected Label,Confidence,Transcript,Date,User Email,Latency,Error Type",
        ...data.map((item) => {
          const email = (item.profiles as any)?.email || "Unknown";
          const errorType = getErrorType({
            model_output_label: item.model_output_label,
            corrected_label: item.corrected_label,
          } as ErrorAnalysisItem);

          // Adjust confidence for CSV
          let confidence = item.model_confidence;
          if (item.model_type === "end_to_end") {
            confidence = confidence / 100; // Convert percentage to decimal
          } else {
            confidence = confidence * 100; // Convert decimal to percentage
          }

          return [
            item.id,
            item.model_type,
            item.model_output_label,
            item.corrected_label,
            confidence.toFixed(2),
            `"${item.transcript?.replace(/"/g, '""') || ""}"`,
            item.created_at,
            email,
            item.latency_seconds,
            errorType,
          ].join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "error-analysis.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("Failed to download CSV:", e.message);
    }
  };

  const clearFilters = () => {
    setModelFilter("all");
    setConfidenceFilter("all");
    setErrorTypeFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const hasFilters =
    modelFilter !== "all" ||
    confidenceFilter !== "all" ||
    errorTypeFilter !== "all" ||
    searchQuery;

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

  const getErrorType = (item: ErrorAnalysisItem) => {
    if (
      item.model_output_label === "non_toxic" &&
      item.corrected_label === "toxic"
    ) {
      return "False Negative";
    }
    if (
      item.model_output_label === "toxic" &&
      item.corrected_label === "non_toxic"
    ) {
      return "False Positive";
    }
    return "Mismatch";
  };

  const getErrorColor = (item: ErrorAnalysisItem) => {
    if (
      item.model_output_label === "non_toxic" &&
      item.corrected_label === "toxic"
    ) {
      return "bg-red-100 text-red-800 border border-red-200"; // FN - more severe
    }
    if (
      item.model_output_label === "toxic" &&
      item.corrected_label === "non_toxic"
    ) {
      return "bg-amber-100 text-amber-800 border border-amber-200"; // FP - less severe
    }
    return "bg-gray-100 text-gray-800 border border-gray-200";
  };

  const getConfidenceValue = (item: ErrorAnalysisItem) => {
    if (item.model_type === "end_to_end") {
      return item.model_confidence / 100; // Convert percentage to decimal
    }
    return item.model_confidence; // Already in decimal for ASR
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 bg-gray-50 min-h-screen dark:bg-gray-900">
      {/* Header */}
      <div className="mb-8 pt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              Model Error Analysis
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Diagnose and understand model performance issues
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadCsv}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-all dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-200"
            >
              <FileText className="h-5 w-5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => {
                fetchErrorData();
                fetchErrorStats();
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg shadow transition-colors dark:from-indigo-500 dark:to-purple-500"
            >
              <RefreshCw
                className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">
              Total Entries
            </h3>
            <div className="bg-indigo-100 p-2 rounded-lg dark:bg-indigo-900/30">
              <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-white mt-2">
            {totalEntries}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            All feedback submissions
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">
              Misclassified
            </h3>
            <div className="bg-red-100 p-2 rounded-lg dark:bg-red-900/30">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-white mt-2">
            {totalErrors}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Total errors detected
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">
              False Negatives
            </h3>
            <div className="bg-red-100 p-2 rounded-lg dark:bg-red-900/30">
              <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-white mt-2">
            {fnRate}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Toxic missed by model
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">
              False Positives
            </h3>
            <div className="bg-amber-100 p-2 rounded-lg dark:bg-amber-900/30">
              <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-white mt-2">
            {fpRate}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Non-toxic flagged
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">
              Avg Confidence
            </h3>
            <div className="bg-blue-100 p-2 rounded-lg dark:bg-blue-900/30">
              <BarChart2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-white mt-2">
            {avgConfidence.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            On misclassified samples
          </p>
        </div>
      </div>

      {/* Model Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">
              Model Error Distribution
            </h3>
            <div className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium dark:bg-gray-700 dark:text-gray-300">
              Total: {totalErrors}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-indigo-700 flex items-center gap-2 dark:text-indigo-400">
                  <Database className="w-4 h-4" /> ASR + Classification
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {asrErrors} errors
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full dark:bg-indigo-500"
                  style={{
                    width: `${
                      totalErrors ? (asrErrors / totalErrors) * 100 : 0
                    }%`,
                  }}
                ></div>
              </div>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
                {totalErrors ? Math.round((asrErrors / totalErrors) * 100) : 0}%
                of errors
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-teal-700 flex items-center gap-2 dark:text-teal-400">
                  <Activity className="w-4 h-4" /> End-to-End
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {e2eErrors} errors
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-teal-500 h-2.5 rounded-full dark:bg-teal-400"
                  style={{
                    width: `${
                      totalErrors ? (e2eErrors / totalErrors) * 100 : 0
                    }%`,
                  }}
                ></div>
              </div>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
                {totalErrors ? Math.round((e2eErrors / totalErrors) * 100) : 0}%
                of errors
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">
              Error Type Distribution
            </h3>
            <div className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium dark:bg-gray-700 dark:text-gray-300">
              Total: {totalErrors}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-red-700 flex items-center gap-2 dark:text-red-400">
                  <Shield className="w-4 h-4" /> False Negatives
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {fnRate} errors
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-red-500 h-2.5 rounded-full dark:bg-red-400"
                  style={{
                    width: `${totalErrors ? (fnRate / totalErrors) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
                {totalErrors ? Math.round((fnRate / totalErrors) * 100) : 0}% of
                errors
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-amber-700 flex items-center gap-2 dark:text-amber-400">
                  <Zap className="w-4 h-4" /> False Positives
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {fpRate} errors
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-amber-500 h-2.5 rounded-full dark:bg-amber-400"
                  style={{
                    width: `${totalErrors ? (fpRate / totalErrors) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
                {totalErrors ? Math.round((fpRate / totalErrors) * 100) : 0}% of
                errors
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-8 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search transcripts or user emails..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
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
                  {[modelFilter, confidenceFilter, errorTypeFilter].filter(
                    (f) => f !== "all"
                  ).length + (searchQuery ? 1 : 0)}
                </span>
              )}
            </button>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                <X className="h-5 w-5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  All Models
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Confidence Level
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    confidenceFilter === "all"
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                  onClick={() => setConfidenceFilter("all")}
                >
                  All Levels
                </button>
                <button
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    confidenceFilter === "high"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                  onClick={() => setConfidenceFilter("high")}
                >
                  High (≥80%)
                </button>
                <button
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    confidenceFilter === "medium"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                  onClick={() => setConfidenceFilter("medium")}
                >
                  Medium (50-79%)
                </button>
                <button
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    confidenceFilter === "low"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                  onClick={() => setConfidenceFilter("low")}
                >
                  Low (&lt;50%)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Error Type
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    errorTypeFilter === "all"
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                  onClick={() => setErrorTypeFilter("all")}
                >
                  All Types
                </button>
                <button
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    errorTypeFilter === "fn"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                  onClick={() => setErrorTypeFilter("fn")}
                >
                  False Negatives
                </button>
                <button
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    errorTypeFilter === "fp"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                  onClick={() => setErrorTypeFilter("fp")}
                >
                  False Positives
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error List */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        {loading ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center justify-center">
              <RefreshCw className="animate-spin w-8 h-8 text-indigo-600 mb-3 dark:text-indigo-400" />
              <p className="text-gray-600 dark:text-gray-400">
                Loading error analysis data...
              </p>
            </div>
          </div>
        ) : errors.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="bg-gradient-to-r from-green-100 to-teal-100 p-4 rounded-full mb-4 dark:from-green-900/30 dark:to-teal-900/30">
                <CheckCircle className="w-12 h-12 text-green-500 dark:text-green-400" />
              </div>
              <h3 className="font-medium text-gray-900 text-xl dark:text-white">
                No errors detected
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md">
                {hasFilters
                  ? "No results match your current filters"
                  : "Your model is performing perfectly! No misclassifications found"}
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
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm dark:text-gray-300">
                      Audio
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm dark:text-gray-300">
                      Model
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm dark:text-gray-300">
                      Prediction
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm dark:text-gray-300">
                      Corrected
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm dark:text-gray-300">
                      Error Type
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm dark:text-gray-300">
                      Confidence
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm dark:text-gray-300">
                      Transcript
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm dark:text-gray-300">
                      User
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm dark:text-gray-300">
                      Date
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-700 uppercase tracking-wider text-sm dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {errors.map((item) => {
                    const confidence = getConfidenceValue(item);
                    const displayConfidence = (confidence * 100).toFixed(1);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="py-4 px-4">
                          <button
                            onClick={() => toggleAudioPlayback(item.audio_url)}
                            className={`p-2 rounded-full ${
                              playingAudio === item.audio_url
                                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                            }`}
                            title={
                              playingAudio === item.audio_url
                                ? "Pause audio"
                                : "Play audio"
                            }
                          >
                            {playingAudio === item.audio_url ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                        </td>

                        <td className="py-4 px-4">
                          <span className="text-sm font-medium dark:text-gray-200">
                            {getModelName(item.model_type)}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              item.model_output_label === "toxic"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            }`}
                          >
                            {item.model_output_label === "toxic"
                              ? "Toxic"
                              : "Non-Toxic"}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              item.corrected_label === "toxic"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            }`}
                          >
                            {item.corrected_label === "toxic"
                              ? "Toxic"
                              : "Non-Toxic"}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${getErrorColor(
                              item
                            )} dark:border dark:border-opacity-30`}
                          >
                            {getErrorType(item)}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                              <div
                                className="bg-indigo-600 h-2.5 rounded-full dark:bg-indigo-500"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(confidence * 100)
                                  )}%`,
                                }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {displayConfidence}%
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 max-w-xs">
                          <div className="flex items-start gap-2">
                            <AudioLines className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-1 dark:text-indigo-300" />
                            <span className="text-sm line-clamp-2 dark:text-gray-300">
                              {item.transcript || "No transcript available"}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-sm text-gray-700 truncate max-w-[120px] dark:text-gray-300">
                              {item.user_email}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(item.created_at)}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <button
                            onClick={() => downloadAudio(item.audio_url)}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
                            title="Download audio sample"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

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
          errors
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
