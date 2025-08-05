// AdminDashboard.tsx
import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Title,
  Filler,
} from "chart.js";
import {
  Loader,
  Users,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  Mic,
  Type,
  RefreshCw,
  DownloadCloud,
  Filter,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Title,
  Filler
);

const MODELS = ["asr_classification", "end_to_end"];
const COLORS = {
  primary: "#4f46e5",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  asr: "#6366f1",
  end2end: "#10b981",
  toxic: "#f87171",
  nonToxic: "#06b6d4",
  gridLine: "rgba(200, 200, 200, 0.1)",
};

export default function AdminDashboard() {
  // --- State ---
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ]);
  const [startDate, endDate] = dateRange;
  const [activeTab, setActiveTab] = useState("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // --- Fetch data ---
  const fetchData = async () => {
    setIsRefreshing(true);
    setError("");
    try {
      const { data: feedbackData, error: fErr } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: userData, error: uErr } = await supabase
        .from("profiles")
        .select("*");

      if (fErr || uErr) throw fErr || uErr;

      setFeedback(feedbackData || []);
      setUsers(userData || []);
    } catch (e: any) {
      setError("Failed to load dashboard data: " + e.message);
      console.error(e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Filter data based on date range ---
  const filteredFeedback = useMemo(() => {
    if (!startDate || !endDate) return feedback;

    return feedback.filter((f) => {
      const createdAt = new Date(f.created_at);
      return createdAt >= startDate && createdAt <= endDate;
    });
  }, [feedback, startDate, endDate]);

  const filteredUsers = useMemo(() => {
    if (!startDate || !endDate) return users;

    return users.filter((u) => {
      const createdAt = new Date(u.created_at);
      return createdAt >= startDate && createdAt <= endDate;
    });
  }, [users, startDate, endDate]);

  // --- Derived metrics ---
  const metrics = useMemo(() => {
    const confirmed = filteredFeedback.filter((f) => f.status === "confirmed");
    const toxicCount = confirmed.filter(
      (f) => f.corrected_label === "toxic"
    ).length;
    const nonToxicCount = confirmed.filter(
      (f) => f.corrected_label === "non_toxic"
    ).length;

    let correct = 0,
      incorrect = 0;
    confirmed.forEach((f) => {
      if (f.model_output_label === f.corrected_label) correct++;
      else incorrect++;
    });

    const accuracyByModel: Record<string, number> = {};
    MODELS.forEach((model) => {
      const entries = confirmed.filter((f) => f.model_type === model);
      if (!entries.length) {
        accuracyByModel[model] = 0;
        return;
      }
      const correct = entries.filter(
        (f) => f.model_output_label === f.corrected_label
      ).length;
      accuracyByModel[model] = Math.round((correct / entries.length) * 100);
    });

    const modelUsage: Record<string, number> = {};
    MODELS.forEach((m) => {
      modelUsage[m] = filteredFeedback.filter((f) => f.model_type === m).length;
    });

    // Prediction volume over time
    const volumeByDate: Record<string, number> = {};
    filteredFeedback.forEach((f) => {
      const d = new Date(f.created_at).toISOString().split("T")[0];
      volumeByDate[d] = (volumeByDate[d] || 0) + 1;
    });
    const dateLabels = Object.keys(volumeByDate).sort();
    const volumeData = dateLabels.map((d) => volumeByDate[d]);

    // User growth over time
    const userGrowth: Record<string, number> = {};
    filteredUsers.forEach((u) => {
      const d = new Date(u.created_at).toISOString().split("T")[0];
      userGrowth[d] = (userGrowth[d] || 0) + 1;
    });
    const userDates = Object.keys(userGrowth).sort();
    const userData = userDates.map((d) => userGrowth[d]);

    return {
      totalUsers: filteredUsers.length,
      totalPredictions: filteredFeedback.length,
      overallAccuracy: confirmed.length
        ? Math.round((correct / confirmed.length) * 100)
        : 0,
      correct,
      incorrect,
      toxicCount,
      nonToxicCount,
      accuracyByModel,
      modelUsage,
      dateLabels,
      volumeData,
      userDates,
      userData,
      confirmed,
    };
  }, [filteredFeedback, filteredUsers]);

  // --- Misclassifications ---
  const misclassified = useMemo(() => {
    return metrics.confirmed
      .filter((f) => f.model_output_label !== f.corrected_label)
      .slice(0, 10);
  }, [metrics.confirmed]);

  // --- Export data ---
  const exportData = async () => {
    setExporting(true);
    try {
      // In a real app, this would call your backend to generate a report
      // For demo purposes, we'll just simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      alert("Data export started. You'll receive an email when it's ready.");
    } catch (e) {
      const errorMsg =
        typeof e === "object" && e !== null && "message" in e
          ? (e as any).message
          : String(e);
      setError("Export failed: " + errorMsg);
    } finally {
      setExporting(false);
    }
  };

  // --- Tab navigation ---
  const renderTabContent = () => {
    switch (activeTab) {
      case "performance":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Model Accuracy Comparison">
              <Bar
                data={{
                  labels: MODELS.map((m) =>
                    m === "asr_classification"
                      ? "ASR + Classification"
                      : "End-to-End"
                  ),
                  datasets: [
                    {
                      label: "Accuracy (%)",
                      data: MODELS.map((m) => metrics.accuracyByModel[m]),
                      backgroundColor: [COLORS.asr, COLORS.end2end],
                      borderRadius: 6,
                      barThickness: 40,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      padding: 12,
                      backgroundColor: "rgba(0,0,0,0.8)",
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      grid: { color: COLORS.gridLine },
                      ticks: { color: "#94a3b8" },
                    },
                    x: {
                      grid: { display: false },
                      ticks: { color: "#94a3b8" },
                    },
                  },
                }}
              />
            </ChartCard>

            <ChartCard title="Correct/Incorrect by Model">
              <Bar
                data={{
                  labels: MODELS.map((m) =>
                    m === "asr_classification"
                      ? "ASR + Classification"
                      : "End-to-End"
                  ),
                  datasets: [
                    {
                      label: "Correct",
                      data: MODELS.map(
                        (m) =>
                          metrics.confirmed.filter(
                            (f) =>
                              f.model_type === m &&
                              f.model_output_label === f.corrected_label
                          ).length
                      ),
                      backgroundColor: COLORS.success,
                      borderRadius: 6,
                    },
                    {
                      label: "Incorrect",
                      data: MODELS.map(
                        (m) =>
                          metrics.confirmed.filter(
                            (f) =>
                              f.model_type === m &&
                              f.model_output_label !== f.corrected_label
                          ).length
                      ),
                      backgroundColor: COLORS.danger,
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: { color: "#94a3b8" },
                    },
                    tooltip: {
                      padding: 12,
                      backgroundColor: "rgba(0,0,0,0.8)",
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: COLORS.gridLine },
                      ticks: { color: "#94a3b8" },
                    },
                    x: {
                      grid: { display: false },
                      ticks: { color: "#94a3b8" },
                    },
                  },
                }}
              />
            </ChartCard>
          </div>
        );
      case "usage":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Prediction Volume Over Time">
              <Line
                data={{
                  labels: metrics.dateLabels,
                  datasets: [
                    {
                      label: "Predictions",
                      data: metrics.volumeData,
                      borderColor: COLORS.primary,
                      backgroundColor: "rgba(79, 70, 229, 0.1)",
                      fill: true,
                      tension: 0.3,
                      pointRadius: 0,
                      pointHoverRadius: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      padding: 12,
                      backgroundColor: "rgba(0,0,0,0.8)",
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: COLORS.gridLine },
                      ticks: { color: "#94a3b8" },
                    },
                    x: {
                      grid: { color: COLORS.gridLine },
                      ticks: { color: "#94a3b8" },
                    },
                  },
                }}
              />
            </ChartCard>

            <ChartCard title="User Growth">
              <Line
                data={{
                  labels: metrics.userDates,
                  datasets: [
                    {
                      label: "New Users",
                      data: metrics.userData,
                      borderColor: COLORS.success,
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                      fill: true,
                      tension: 0.3,
                      pointRadius: 0,
                      pointHoverRadius: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      padding: 12,
                      backgroundColor: "rgba(0,0,0,0.8)",
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: COLORS.gridLine },
                      ticks: { color: "#94a3b8" },
                    },
                    x: {
                      grid: { color: COLORS.gridLine },
                      ticks: { color: "#94a3b8" },
                    },
                  },
                }}
              />
            </ChartCard>
          </div>
        );
      default: // Overview
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ChartCard title="Label Distribution">
              <Pie
                data={{
                  labels: ["Toxic", "Non-Toxic"],
                  datasets: [
                    {
                      data: [metrics.toxicCount, metrics.nonToxicCount],
                      backgroundColor: [COLORS.toxic, COLORS.nonToxic],
                      borderWidth: 0,
                    },
                  ],
                }}
                options={{
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: { color: "#94a3b8" },
                    },
                    tooltip: {
                      padding: 12,
                      backgroundColor: "rgba(0,0,0,0.8)",
                    },
                  },
                  cutout: "65%",
                }}
              />
            </ChartCard>

            <ChartCard title="Model Usage">
              <Bar
                data={{
                  labels: MODELS.map((m) =>
                    m === "asr_classification" ? "ASR + Class." : "End-to-End"
                  ),
                  datasets: [
                    {
                      label: "Usage Count",
                      data: MODELS.map((m) => metrics.modelUsage[m]),
                      backgroundColor: [COLORS.asr, COLORS.end2end],
                      borderRadius: 6,
                      barThickness: 40,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      padding: 12,
                      backgroundColor: "rgba(0,0,0,0.8)",
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: COLORS.gridLine },
                      ticks: { color: "#94a3b8" },
                    },
                    x: {
                      grid: { display: false },
                      ticks: { color: "#94a3b8" },
                    },
                  },
                }}
              />
            </ChartCard>

            <ChartCard title="Data Quality">
              <div className="flex flex-col gap-4">
                <QualityMetric
                  title="Completion Rate"
                  value="92%"
                  icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
                  progress={92}
                  color="bg-green-500"
                />
                <QualityMetric
                  title="Avg. Confidence"
                  value="87%"
                  icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
                  progress={87}
                  color="bg-blue-500"
                />
                <QualityMetric
                  title="Avg. Audio Length"
                  value="4.2s"
                  icon={<Mic className="w-5 h-5 text-purple-500" />}
                  progress={84}
                  color="bg-purple-500"
                />
              </div>
            </ChartCard>

            <ChartCard title="Active Users">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className={textSecondary}>Today</span>
                  <span className="font-bold">
                    {
                      filteredUsers.filter((u) => {
                        const d = new Date(u.created_at);
                        const today = new Date();
                        return (
                          d.getDate() === today.getDate() &&
                          d.getMonth() === today.getMonth() &&
                          d.getFullYear() === today.getFullYear()
                        );
                      }).length
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={textSecondary}>Last 7 Days</span>
                  <span className="font-bold">
                    {
                      filteredUsers.filter((u) => {
                        const d = new Date(u.created_at);
                        const now = new Date();
                        const sevenDaysAgo = new Date();
                        sevenDaysAgo.setDate(now.getDate() - 6);
                        return d >= sevenDaysAgo && d <= now;
                      }).length
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={textSecondary}>Last 30 Days</span>
                  <span className="font-bold">
                    {
                      filteredUsers.filter((u) => {
                        const d = new Date(u.created_at);
                        const now = new Date();
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(now.getDate() - 29);
                        return d >= thirtyDaysAgo && d <= now;
                      }).length
                    }
                  </span>
                </div>
                {/* Optional: user type breakdown if you have that info */}
                {/* <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>{returningPercent}% Returning users</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm mt-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>{newPercent}% New users</span>
                  </div>
                </div> */}
              </div>
            </ChartCard>
          </div>
        );
    }
  };

  // Utility for theme-aware colors
  const themeBg = "bg-white dark:bg-gray-900";
  const cardBg = "bg-gray-50 dark:bg-gray-800";
  const borderColor = "border-gray-200 dark:border-gray-700";
  const textPrimary = "text-gray-900 dark:text-gray-100";
  const textSecondary = "text-gray-500 dark:text-gray-400";
  const textAccent = "text-indigo-600 dark:text-indigo-400";

  return (
    <div className={`min-h-screen ${themeBg} ${textPrimary}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${textPrimary}`}>
              Model Performance Dashboard
            </h1>
            <p className={`mt-2 ${textSecondary}`}>
              Monitor system metrics, user activity, and model accuracy
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update: [Date | null, Date | null]) =>
                setDateRange(update)
              }
              placeholderText="Select date range"
              className={`border ${borderColor} rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${cardBg} ${textPrimary}`}
              isClearable
            />
            <button
              onClick={fetchData}
              disabled={isRefreshing}
              className={`flex items-center gap-2 ${cardBg} hover:bg-gray-100 dark:hover:bg-gray-700 border ${borderColor} rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50`}
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  isRefreshing ? "animate-spin" : ""
                } ${textAccent}`}
              />
              Refresh Data
            </button>
            <button
              onClick={exportData}
              disabled={exporting}
              className="flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 rounded-lg px-4 py-2 text-sm text-white transition-colors disabled:opacity-50"
            >
              <DownloadCloud
                className={`w-4 h-4 ${exporting ? "animate-pulse" : ""}`}
              />
              Export Report
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Users"
            value={metrics.totalUsers}
            icon={
              <Users className="w-6 h-6 text-blue-400 dark:text-blue-300" />
            }
            change="+12.4%"
            description="Since last month"
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
          <StatCard
            title="Total Predictions"
            value={metrics.totalPredictions}
            icon={
              <BarChart3 className="w-6 h-6 text-green-400 dark:text-green-300" />
            }
            change="+24.7%"
            description="Model usage"
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
          <StatCard
            title="System Accuracy"
            value={`${metrics.overallAccuracy}%`}
            icon={
              <CheckCircle2 className="w-6 h-6 text-emerald-400 dark:text-emerald-300" />
            }
            change="-2.1%"
            description="Overall performance"
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
          <StatCard
            title="Feedback Ratio"
            value={`${metrics.correct}/${metrics.incorrect}`}
            icon={
              <XCircle className="w-6 h-6 text-rose-400 dark:text-rose-300" />
            }
            change="+3.8%"
            description="Correct vs incorrect"
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
        </div>

        {/* Navigation Tabs */}
        <div className={`flex border-b ${borderColor} mb-6`}>
          <button
            className={`py-3 px-6 font-medium text-sm border-b-2 ${
              activeTab === "overview"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm border-b-2 ${
              activeTab === "performance"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("performance")}
          >
            Model Performance
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm border-b-2 ${
              activeTab === "usage"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
            onClick={() => setActiveTab("usage")}
          >
            Usage Analytics
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-xl bg-gray-800">
            <Loader className="animate-spin w-12 h-12 text-indigo-500 mb-4" />
            <p className="text-gray-400">Loading dashboard data...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-900/20 border border-red-700 p-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-400">Data Loading Error</h3>
              <p className="text-gray-400 mt-1">{error}</p>
              <button
                onClick={fetchData}
                className="mt-3 text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Main Content */}
            <div className="mb-10">{renderTabContent()}</div>

            {/* Recent Misclassifications */}
            <div
              className={`${cardBg} rounded-xl shadow-lg overflow-hidden mt-8`}
            >
              <div
                className={`px-6 py-4 border-b ${borderColor} flex items-center justify-between`}
              >
                <h2 className={`text-lg font-semibold ${textPrimary}`}>
                  Recent Misclassifications
                </h2>
                <button
                  className={`flex items-center gap-2 text-sm ${textSecondary} hover:text-indigo-500`}
                >
                  <Filter className="w-4 h-4" /> Filter
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cardBg}>
                    <tr>
                      <th
                        className={`py-3 px-6 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}
                      >
                        Date
                      </th>
                      <th
                        className={`py-3 px-6 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}
                      >
                        User
                      </th>
                      <th
                        className={`py-3 px-6 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}
                      >
                        Model
                      </th>
                      <th
                        className={`py-3 px-6 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}
                      >
                        Output
                      </th>
                      <th
                        className={`py-3 px-6 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}
                      >
                        Corrected
                      </th>
                      <th
                        className={`py-3 px-6 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}
                      >
                        Confidence
                      </th>
                      <th
                        className={`py-3 px-6 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}
                      >
                        Audio
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${borderColor}`}>
                    {misclassified.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className={`py-8 text-center ${textSecondary}`}
                        >
                          No misclassifications found in the selected period
                        </td>
                      </tr>
                    ) : (
                      misclassified.map((f) => (
                        <tr
                          key={f.id}
                          className={`${cardBg} hover:bg-indigo-50 dark:hover:bg-gray-700`}
                        >
                          <td className="py-4 px-6 whitespace-nowrap">
                            <div className={`text-sm ${textPrimary}`}>
                              {new Date(f.created_at).toLocaleDateString()}
                            </div>
                            <div className={`text-xs ${textSecondary}`}>
                              {new Date(f.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={`rounded-full w-8 h-8 flex items-center justify-center ${cardBg}`}
                              >
                                <span
                                  className={`text-xs font-medium ${textPrimary}`}
                                >
                                  {f.user_id
                                    ? f.user_id.charAt(0).toUpperCase()
                                    : "A"}
                                </span>
                              </div>
                              <div>
                                <div
                                  className={`text-sm font-medium ${textPrimary}`}
                                >
                                  {f.user_id
                                    ? `${f.user_id.slice(0, 8)}...`
                                    : "Anonymous"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div
                              className={`text-xs px-2 py-1 rounded-full inline-block ${
                                f.model_type === "asr_classification"
                                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                                  : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {f.model_type === "asr_classification"
                                ? "ASR + Class."
                                : "End-to-End"}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                f.model_output_label === "toxic"
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                  : "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400"
                              }`}
                            >
                              {f.model_output_label === "toxic"
                                ? "Toxic"
                                : "Non-Toxic"}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                f.corrected_label === "toxic"
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                  : "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400"
                              }`}
                            >
                              {f.corrected_label === "toxic"
                                ? "Toxic"
                                : "Non-Toxic"}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center">
                              <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                  style={{
                                    width: `${f.model_confidence * 100}%`,
                                  }}
                                ></div>
                              </div>
                              <span className={`ml-2 text-sm ${textPrimary}`}>
                                {Math.round(f.model_confidence * 100)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {f.audio_storage_path ? (
                              <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1">
                                <Mic className="w-4 h-4" /> Play
                              </button>
                            ) : (
                              <span className={`text-sm ${textSecondary}`}>
                                No audio
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
type StatCardProps = {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  description?: string;
  cardBg?: string;
  borderColor?: string;
  textPrimary?: string;
  textSecondary?: string;
};

function StatCard({
  title,
  value,
  icon,
  change,
  description,
  cardBg = "bg-gray-50 dark:bg-gray-800",
  borderColor = "border-gray-200 dark:border-gray-700",
  textPrimary = "text-gray-900 dark:text-gray-100",
  textSecondary = "text-gray-500 dark:text-gray-400",
}: StatCardProps) {
  const isPositive = change?.startsWith("+");

  return (
    <div
      className={`${cardBg} rounded-xl p-5 border ${borderColor} hover:border-indigo-400 transition-colors`}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className={`${textSecondary} text-sm mb-1`}>{title}</div>
          <div className={`text-2xl font-bold ${textPrimary}`}>{value}</div>
        </div>
        <div className={`${cardBg} p-2 rounded-lg`}>{icon}</div>
      </div>
      <div className="mt-3 flex items-center">
        {change && (
          <span
            className={`text-sm font-medium ${
              isPositive
                ? "text-green-500 dark:text-green-400"
                : "text-red-500 dark:text-red-400"
            }`}
          >
            {change}
          </span>
        )}
        <span className={`text-xs ml-2 ${textSecondary}`}>{description}</span>
      </div>
    </div>
  );
}

// Chart Card Component
function ChartCard({ title, children, fullWidth, cardBg, textPrimary }: any) {
  return (
    <div
      className={`${
        cardBg || "bg-gray-50 dark:bg-gray-800"
      } rounded-xl p-5 border border-gray-200 dark:border-gray-700 ${
        fullWidth ? "col-span-2" : ""
      }`}
    >
      <h3
        className={`font-medium mb-4 ${
          textPrimary || "text-gray-900 dark:text-gray-100"
        }`}
      >
        {title}
      </h3>
      <div className="h-72">{children}</div>
    </div>
  );
}

// Quality Metric Component
function QualityMetric({ title, value, icon, progress, color }: any) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
          {icon}
          <span>{title}</span>
        </div>
        <span className="font-medium">{value}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}
