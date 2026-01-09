import React from 'react';
import { useData } from '../context/DataContext';
import DefaultView from '../views/DefaultView';

const Dashboard: React.FC = () => {
  const { hasData, isLoading, surgeonName } = useData();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00938e] mx-auto mb-4"></div>
        <p className="text-[#00938e] font-medium">Loading surgical data...</p>
      </div>
    );
  }

  if (!hasData && !surgeonName) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <img src="/logo.png" alt="MISSO Logo" className="w-50 h-40 mb-10" />
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Waiting for surgery data...
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          JSON files will be automatically detected
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <DefaultView />
    </div>
  );
};

export default Dashboard;