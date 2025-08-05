import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Filter,
  Loader,
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertCircle,
  RefreshCw,
  File,
} from "lucide-react";
import toast from "react-hot-toast";

// Types
interface FeedbackEntry {
  id: string;
  user_id: string;
  audio_storage_path: string;
  model_type: string;
  model_output_label: "toxic" | "non_toxic";
  corrected_label: "toxic" | "non_toxic";
  comment: string | null;
  model_confidence: number;
  transcript: string | null;
  created_at: string;
  status: "pending" | "confirmed" | "rejected";
  email?: string | null;
}

const itemsPerPage = 10;
const audioBase =
  "https://wfefaeslioqwmkpjwguw.supabase.co/storage/v1/object/public/wavs/";

export default function ModerationPage() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [allStats, setAllStats] = useState({
    total: 0,
    confirmed: 0,
    pending: 0,
  });

  // Filters
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "confirmed" | "rejected"
  >("all");
  const [filterModel, setFilterModel] = useState<
    "all" | "asr_classification" | "end_to_end"
  >("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line
  }, [currentPage, filterStatus, filterModel, searchQuery]);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("feedback")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (filterModel !== "all") query = query.eq("model_type", filterModel);
      if (searchQuery) {
        query = query.or(
          `transcript.ilike.%${searchQuery}%,comment.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
        );
      }

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      let feedbackList: FeedbackEntry[] = data || [];
      setTotalItems(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 1) / itemsPerPage)));

      // Fetch emails from profiles
      const userIds = [...new Set(feedbackList.map((f) => f.user_id))];
      let emails: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id,email")
          .in("id", userIds);
        if (profileError) throw profileError;
        (profileRows || []).forEach((row: any) => {
          emails[row.id] = row.email;
        });
      }
      feedbackList = feedbackList.map((f) => ({
        ...f,
        email: emails[f.user_id] || "Unknown",
      }));

      setFeedback(feedbackList);
    } catch (e: any) {
      toast.error("Failed to load feedback: " + e.message);
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  };

  // Stats fetching logic
  const fetchAllStats = async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("status", { count: "exact" });
    if (!error && data) {
      const total = data.length;
      const confirmed = data.filter(
        (f: any) => f.status === "confirmed"
      ).length;
      const pending = data.filter((f: any) => f.status === "pending").length;
      setAllStats({ total, confirmed, pending });
    }
  };

  useEffect(() => {
    fetchAllStats();
  }, []);

  // Confirm or Reject Actions
  const handleAction = async (
    entry: FeedbackEntry,
    action: "confirmed" | "rejected"
  ) => {
    setActionLoading(entry.id + action);
    try {
      if (action === "rejected" && entry.audio_storage_path) {
        const pathForDelete = entry.audio_storage_path.replace(/^wavs\//, "");
        const { error: delError } = await supabase.storage
          .from("wavs")
          .remove([pathForDelete]);
        if (delError) {
          toast.error("Audio delete failed!");
          setActionLoading(null);
          return;
        }
        const { error: delRowError } = await supabase
          .from("feedback")
          .delete()
          .eq("id", entry.id);
        if (delRowError) {
          toast.error("Feedback row delete failed!");
          setActionLoading(null);
          return;
        }
        toast.success("Rejected and deleted.");
      } else if (action === "confirmed") {
        const { error } = await supabase
          .from("feedback")
          .update({ status: "confirmed" })
          .eq("id", entry.id);
        if (error) throw error;
        toast.success("Confirmed.");
      }
      fetchFeedback();
      fetchAllStats();
    } catch (e: any) {
      toast.error("Failed: " + (e.message || e));
    } finally {
      setActionLoading(null);
    }
  };

  // Audio play logic (play one at a time)
  const handlePlay = (id: string) => {
    if (playingId && playingId !== id) {
      const prevAudio = audioRefs.current[playingId];
      prevAudio?.pause();
      prevAudio?.currentTime && (prevAudio.currentTime = 0);
    }
    setPlayingId(id);
    setTimeout(() => {
      audioRefs.current[id]?.play();
    }, 50);
  };
  const handlePause = (id: string) => {
    audioRefs.current[id]?.pause();
    setPlayingId(null);
  };
  const onAudioEnded = () => setPlayingId(null);

  // UI Components
  const StatusBadge = ({ status }: { status: string }) => {
    let bgColor = "bg-gray-200 dark:bg-[#232a47]";
    let textColor = "text-gray-800 dark:text-gray-200";
    if (status === "pending") {
      bgColor = "bg-yellow-100 dark:bg-yellow-900";
      textColor = "text-yellow-800 dark:text-yellow-200";
    } else if (status === "confirmed") {
      bgColor = "bg-emerald-100 dark:bg-green-900";
      textColor = "text-green-800 dark:text-green-200";
    } else if (status === "rejected") {
      bgColor = "bg-red-100 dark:bg-red-900";
      textColor = "text-red-800 dark:text-red-200";
    }
    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const LabelBadge = ({ label }: { label: string }) => {
    const isToxic = label === "toxic";
    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-semibold
          ${
            isToxic
              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              : "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200"
          }`}
      >
        {isToxic ? "Toxic" : "Non-Toxic"}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-white dark:bg-[#10172a] min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 dark:from-blue-300 dark:to-purple-300">
            Feedback Moderation Panel
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Review and manage user feedback submissions
          </p>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-[#232a47] p-4 rounded-xl shadow border border-blue-100 dark:border-[#232a47]">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">
                Total Entries
              </h3>
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                <File className="h-5 w-5 text-blue-600 dark:text-blue-200" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 dark:text-white">
              {allStats.total}
            </p>
          </div>
          <div className="bg-emerald-50 dark:bg-green-900 p-4 rounded-xl shadow border border-green-100 dark:border-green-950">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Confirmed
              </h3>
              <div className="bg-green-100 dark:bg-green-800 p-2 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-200" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 dark:text-white">
              {allStats.confirmed}
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-yellow-900 p-4 rounded-xl shadow border border-amber-100 dark:border-yellow-900">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-amber-700 dark:text-yellow-200">
                Pending Review
              </h3>
              <div className="bg-amber-100 dark:bg-yellow-800 p-2 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-yellow-200" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 dark:text-white">
              {allStats.pending}
            </p>
          </div>
        </div>
        {/* Filters & Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="md:col-span-3 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search transcripts, comments, emails..."
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#181c29] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchQuery}
                onChange={(e) => {
                  setCurrentPage(1);
                  setSearchQuery(e.target.value);
                }}
              />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center bg-white dark:bg-[#181c29] rounded-lg border border-gray-300 dark:border-gray-700 px-3">
                <Filter className="h-5 w-5 text-blue-500 mr-2" />
                <select
                  className="py-2.5 bg-transparent text-gray-900 dark:text-white focus:outline-none"
                  value={filterStatus}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setFilterStatus(e.target.value as any);
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex items-center bg-white dark:bg-[#181c29] rounded-lg border border-gray-300 dark:border-gray-700 px-3">
                <select
                  className="py-2.5 bg-transparent text-gray-900 dark:text-white focus:outline-none"
                  value={filterModel}
                  onChange={(e) => {
                    setCurrentPage(1);
                    setFilterModel(e.target.value as any);
                  }}
                >
                  <option value="all">All Models</option>
                  <option value="asr_classification">
                    ASR + Classification
                  </option>
                  <option value="end_to_end">End-to-End</option>
                </select>
              </div>
            </div>
          </div>
          <button
            onClick={fetchFeedback}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg shadow transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      {/* Table */}
      <div className="overflow-x-auto bg-white dark:bg-[#181f36] shadow-xl rounded-2xl border border-gray-200 dark:border-[#232a47] mt-6">
        <table className="w-full text-left bg-white dark:bg-[#181f36]">
          <thead className="bg-gray-50 dark:bg-[#232a47]">
            <tr>
              <th className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-sm text-center">
                Audio
              </th>
              <th className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-sm text-center">
                User
              </th>
              <th className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-sm">
                Model Output
              </th>
              <th className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-sm">
                Corrected
              </th>
              <th className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-sm">
                Confidence
              </th>
              <th className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-sm">
                Transcript
              </th>
              <th className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-sm">
                Status
              </th>
              <th className="py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-sm text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-[#232a47]">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Loader className="animate-spin w-8 h-8 text-blue-600 dark:text-blue-400 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Loading feedback entries...
                    </p>
                  </div>
                </td>
              </tr>
            ) : feedback.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <File className="w-10 h-10 text-gray-400 dark:text-gray-600 mb-3" />
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      No feedback entries found
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      {searchQuery
                        ? "No results match your search criteria"
                        : "Try changing your filters or check back later"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              feedback.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-gray-50 dark:hover:bg-[#232a47] transition-colors"
                >
                  {/* Audio with Play Icon */}
                  <td className="py-4 px-4 text-center">
                    <button
                      className="flex items-center justify-center mx-auto focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
                      onClick={() =>
                        playingId === entry.id
                          ? handlePause(entry.id)
                          : handlePlay(entry.id)
                      }
                      title={
                        playingId === entry.id ? "Pause audio" : "Play audio"
                      }
                    >
                      {playingId === entry.id ? (
                        <PauseCircle className="h-10 w-10 text-blue-600 dark:text-blue-300" />
                      ) : (
                        <PlayCircle className="h-10 w-10 text-blue-600 dark:text-blue-300" />
                      )}
                    </button>
                    <audio
                      ref={(el) => (audioRefs.current[entry.id] = el)}
                      src={
                        entry.audio_storage_path
                          ? `${audioBase}${entry.audio_storage_path.replace(
                              /^wavs\//,
                              ""
                            )}`
                          : ""
                      }
                      onPlay={() => setPlayingId(entry.id)}
                      onPause={() => setPlayingId(null)}
                      onEnded={onAudioEnded}
                      hidden
                    />
                  </td>
                  {/* User */}
                  <td className="py-4 px-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[120px]">
                        {entry.email}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.model_type === "asr_classification"
                          ? "ASR + Classification"
                          : "End-to-End"}
                      </span>
                    </div>
                  </td>
                  {/* Model output */}
                  <td className="py-4 px-4">
                    <LabelBadge label={entry.model_output_label} />
                  </td>
                  {/* Corrected */}
                  <td className="py-4 px-4">
                    <LabelBadge label={entry.corrected_label} />
                  </td>
                  {/* Confidence */}
                  <td className="py-4 px-4">
                    {(() => {
                      let percent =
                        entry.model_type === "end_to_end"
                          ? Math.min(
                              100,
                              Math.round((entry.model_confidence / 100) * 100)
                            )
                          : Math.min(
                              100,
                              Math.round(entry.model_confidence * 100)
                            );
                      return (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div
                              className="bg-blue-500 dark:bg-blue-400 h-2.5 rounded-full"
                              style={{
                                width: `${percent}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 ml-2">
                            {percent}%
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  {/* Transcript */}
                  <td className="py-4 px-4 max-w-xs">
                    {entry.transcript ? (
                      <div className="flex items-center gap-2">
                        <AudioLines className="w-4 h-4 text-blue-400 dark:text-blue-300 flex-shrink-0" />
                        <span className="text-sm line-clamp-2 text-gray-900 dark:text-white">
                          {entry.transcript}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-600 text-sm">
                        —
                      </span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="py-4 px-4 text-center">
                    <StatusBadge status={entry.status} />
                  </td>
                  {/* Actions */}
                  <td className="py-4 px-4">
                    <div className="flex justify-end gap-2">
                      <button
                        className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                          entry.status === "confirmed"
                            ? "bg-emerald-100 text-green-800 dark:bg-green-900 dark:text-green-200 cursor-not-allowed"
                            : "bg-green-500 hover:bg-green-600 text-white"
                        }`}
                        disabled={
                          actionLoading === entry.id + "confirmed" ||
                          entry.status === "confirmed"
                        }
                        title="Confirm entry"
                        onClick={() => handleAction(entry, "confirmed")}
                      >
                        {actionLoading === entry.id + "confirmed" ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Confirm
                          </>
                        )}
                      </button>
                      <button
                        className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                          entry.status === "rejected"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 cursor-not-allowed"
                            : "bg-red-500 hover:bg-red-600 text-white"
                        }`}
                        disabled={
                          actionLoading === entry.id + "rejected" ||
                          entry.status === "rejected"
                        }
                        title="Reject & delete audio"
                        onClick={() => handleAction(entry, "rejected")}
                      >
                        {actionLoading === entry.id + "rejected" ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing{" "}
          <span className="font-medium">
            {(currentPage - 1) * itemsPerPage + 1}
          </span>{" "}
          to{" "}
          <span className="font-medium">
            {Math.min(currentPage * itemsPerPage, totalItems)}
          </span>{" "}
          of <span className="font-medium">{totalItems}</span> results
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center justify-center p-2 rounded-lg bg-white dark:bg-[#232a47] border border-gray-300 dark:border-[#232a47] hover:bg-gray-50 dark:hover:bg-[#20263b] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
          </button>
          <div className="flex items-center">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage + 2 >= totalPages) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    pageNum === currentPage
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 dark:bg-[#181c29] text-gray-700 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-[#232a47]"
                  }`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            className="flex items-center justify-center p-2 rounded-lg bg-white dark:bg-[#232a47] border border-gray-300 dark:border-[#232a47] hover:bg-gray-50 dark:hover:bg-[#20263b] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-5 w-5 text-gray-700 dark:text-gray-200" />
          </button>
        </div>
      </div>
    </div>
  );
}
