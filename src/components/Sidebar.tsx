import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import CSVUpload from './CSVUpload';
import QuickStatsCard from './QuickStatsCard';
import ExportReport from './ExportReport';
import { ChevronDown, ChevronUp } from 'lucide-react';

const Sidebar: React.FC = () => {
  const { filters, setFilters, uniqueProcedures, uniqueSurgeons, filteredSurgeries, hasData } = useData();
  const [procedureExpanded, setProcedureExpanded] = useState(false);
  const [surgeonExpanded, setSurgeonExpanded] = useState(false);

  // Count procedures
  const procedureCounts = filteredSurgeries.reduce((acc, surgery) => {
    acc[surgery.procedure_name] = (acc[surgery.procedure_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Count surgeons
  const surgeonCounts = filteredSurgeries.reduce((acc, surgery) => {
    acc[surgery.surgeon_name] = (acc[surgery.surgeon_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleProcedureSelect = (procedure: string) => {
    if (procedure === 'select-all') {
      setFilters({ ...filters, procedure: '' });
    } else {
      setFilters({ ...filters, procedure: procedure === filters.procedure ? '' : procedure });
    }
    setProcedureExpanded(false);
  };

  const handleSurgeonSelect = (surgeon: string) => {
    if (surgeon === 'select-all') {
      setFilters({ ...filters, surgeon: '' });
    } else {
      setFilters({ ...filters, surgeon: surgeon === filters.surgeon ? '' : surgeon });
    }
    setSurgeonExpanded(false);
  };

  return (
    <div className="fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] bg-[#d2e2eb] shadow-lg p-6 overflow-y-auto">
      <div className="space-y-6">
        <CSVUpload />
        {hasData && (
          <>
            <ExportReport />
            {/* Procedure Selector */}
            <div className="bg-white border-2 border-[#00938e] rounded-lg shadow-sm">
              <button
                onClick={() => setProcedureExpanded(!procedureExpanded)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="text-sm font-semibold text-[#00938e] uppercase tracking-wide">
                    Procedure
                  </h3>
                  {filters.procedure && (
                    <p className="text-xs text-gray-600 mt-1">{filters.procedure}</p>
                  )}
                </div>
                {procedureExpanded ? (
                  <ChevronUp className="text-[#00938e]" size={20} />
                ) : (
                  <ChevronDown className="text-[#00938e]" size={20} />
                )}
              </button>
              
              {procedureExpanded && (
                <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
                  <div
                    onClick={() => handleProcedureSelect('select-all')}
                    className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                      !filters.procedure ? 'bg-[#00938e] text-white' : ''
                    }`}
                  >
                    <span className="text-sm font-medium">Select All</span>
                  </div>
                  {uniqueProcedures.map((procedure) => (
                    <div
                      key={procedure}
                      onClick={() => handleProcedureSelect(procedure)}
                      className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                        filters.procedure === procedure ? 'bg-[#00938e] text-white' : ''
                      }`}
                    >
                      <span className="text-sm">{procedure}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Surgeon Selector */}
            <div className="bg-white border-2 border-[#00938e] rounded-lg shadow-sm">
              <button
                onClick={() => setSurgeonExpanded(!surgeonExpanded)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="text-sm font-semibold text-[#00938e] uppercase tracking-wide">
                    Surgeon
                  </h3>
                  {filters.surgeon && (
                    <p className="text-xs text-gray-600 mt-1">{filters.surgeon}</p>
                  )}
                </div>
                {surgeonExpanded ? (
                  <ChevronUp className="text-[#00938e]" size={20} />
                ) : (
                  <ChevronDown className="text-[#00938e]" size={20} />
                )}
              </button>
              
              {surgeonExpanded && (
                <div className="border-t border-gray-200 max-h-64 overflow-y-auto">
                  <div
                    onClick={() => handleSurgeonSelect('select-all')}
                    className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                      !filters.surgeon ? 'bg-[#00938e] text-white' : ''
                    }`}
                  >
                    <span className="text-sm font-medium">Select All</span>
                  </div>
                  {uniqueSurgeons.map((surgeon) => (
                    <div
                      key={surgeon}
                      onClick={() => handleSurgeonSelect(surgeon)}
                      className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                        filters.surgeon === surgeon ? 'bg-[#00938e] text-white' : ''
                      }`}
                    >
                      <span className="text-sm">{surgeon} </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <QuickStatsCard />
          </>
        )}
      </div>
    </div>
  );
};

export default Sidebar;