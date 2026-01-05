import React from 'react';
import { useData } from '../context/DataContext';
import ProgressBar from '../components/ProgressBar';
import Image from '../components/Image';

const DefaultView: React.FC = () => {
  const { filteredSurgeries, hasData } = useData();

  if (!hasData || filteredSurgeries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <p className="text-gray-600 text-lg dark:text-gray-300">No surgical data available. Please upload a file.</p>
      </div>
    );
  }

  const lastProcedure = [...filteredSurgeries].sort((a, b) =>
    b.datetime.getTime() - a.datetime.getTime()
  )[0];

  const totalCases = filteredSurgeries.length;

  const procedureCounts = filteredSurgeries.reduce((acc, surgery) => {
    acc[surgery.procedure_name] = (acc[surgery.procedure_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const procedureVolumes = Object.entries(procedureCounts).map(([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / totalCases) * 100)
  }));

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
      {/* LEFT: LAST SURGERY + INSTRUMENTS */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        {/* UPDATED DESIGN – BIGGER IMAGE, NO BORDER, DARK MODE READY */}
        <div className="bg-white dark:bg-gray-800 border-2 border-[#00938e] rounded-xl p-6 shadow-sm flex items-center justify-between h-48 relative overflow-hidden">
          {/* TOP-RIGHT BADGE */}
          <div className="absolute top-0 right-0 bg-[#00938e] text-white px-3 py-1 rounded-bl-xl text-xs font-bold uppercase tracking-wider">
            Last Case
          </div>

          {/* LEFT: BIGGER SURGEON PHOTO + NAME (NO BORDER) */}
          <div className="flex items-center gap-8 pl-4">
            <Image
              type="surgeon"
              name={lastProcedure.surgeon_name}
              className="w-24 h-24 rounded-full object-cover shadow-xl"
            />
            <div>
              <p className="text-3xl font-bold text-[#00938e] leading-tight">
                {lastProcedure.surgeon_name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {lastProcedure.date} at {lastProcedure.time}
              </p>
            </div>
          </div>

          {/* RIGHT: DURATION + PROCEDURE BELOW */}
          <div className="text-right pr-4">
            <p className="text-5xl font-bold text-[#00938e] leading-none">
              {lastProcedure.duration}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">min</p>
            <p className="text-2xl font-bold text-[#00938e] mt-2 leading-tight">
              {lastProcedure.procedure_name}
            </p>
          </div>
        </div>

        {/* INSTRUMENTS FROM LAST SURGERY – DARK MODE FIXED */}
        <div className="bg-white dark:bg-gray-800 border-2 border-[#00938e] rounded-xl p-6 shadow-sm flex-1 overflow-y-auto">
          <h3 className="text-lg font-semibold text-[#00938e] mb-4 uppercase tracking-wide">
            Instruments Used in Last Case
          </h3>
          <div className="space-y-4">
            {lastProcedure.instruments.length > 0 ? (
              lastProcedure.instruments.map((instrument, index) => {
                const percentage = Math.round((instrument.duration / lastProcedure.duration) * 100);
                return (
                  <div key={index} className="flex items-center gap-4">
                    <Image
                      type="instrument"
                      name={instrument.name}
                      className="w-14 h-14 rounded object-cover border border-gray-300 dark:border-gray-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {instrument.name}
                      </p>
                      <ProgressBar
                        percentage={percentage}
                        duration={instrument.duration}
                        size="sm"
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">No instruments used.</p>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: TOTAL VOLUME + BREAKDOWN */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-white dark:bg-gray-800 border-2 border-[#00938e] rounded-xl p-6 shadow-sm text-center flex flex-col justify-center h-48">
          <h3 className="text-lg font-semibold text-[#00938e] mb-3 uppercase tracking-wide">
            Total Procedure Volume
          </h3>
          <p className="text-xs text-[#00938e] uppercase tracking-wide font-semibold">Total Cases</p>
          <p className="text-5xl font-bold text-[#00938e]">{totalCases}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 border-2 border-[#00938e] rounded-xl p-6 shadow-sm flex-1 overflow-y-auto">
          <h3 className="text-lg font-semibold text-[#00938e] mb-4 uppercase tracking-wide">
            Procedure Breakdown
          </h3>
          <div className="space-y-4">
            {procedureVolumes.length > 0 ? (
              procedureVolumes.map((procedure, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-[#00938e]">{procedure.name}</p>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{procedure.count} cases</span>
                  </div>
                  <ProgressBar
                    percentage={procedure.percentage}
                    showDuration={false}
                    size="sm"
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">No procedures available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefaultView;