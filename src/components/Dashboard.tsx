import React from 'react';
import { useData } from '../context/DataContext';
import DefaultView from '../views/DefaultView';
import ProcedureView from '../views/ProcedureView';
import SurgeonView from '../views/SurgeonView';
import CombinedView from '../views/CombinedView';

const Dashboard: React.FC = () => {
  const { filters, hasData, isLoading } = useData();

  const renderView = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00938e] mx-auto mb-4"></div>
          <p className="text-[#00938e] font-medium">Loading surgical data...</p>
        </div>
      );
    }

    if (!hasData) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
          <img
            src="/logo.png"
            alt="MISSO System Insights Logo"
            className="w-50 h-40 mb-10"
          />
          <p className="text-lg text-gray-600">Please upload file to view analytics.</p>
        </div>
      );
    }

    if (filters.procedure && filters.surgeon) {
      return <CombinedView />;
    } else if (filters.procedure) {
      return <ProcedureView />;
    } else if (filters.surgeon) {
      return <SurgeonView />;
    }
    return <DefaultView />;
  };

  return (
    <div className="ml-64 mt-16 p-6">
      {renderView()}
    </div>
  );
};

export default Dashboard;