import React from "react";
import PerformanceChart from "../components/PerformanceChart";

const AdminDashboard = () => {
  return (
    <div>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6"></h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <PerformanceChart />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
