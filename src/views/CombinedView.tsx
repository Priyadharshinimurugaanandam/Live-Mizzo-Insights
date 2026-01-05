import React from 'react';
import { useData } from '../context/DataContext';
import ProgressBar from '../components/ProgressBar';
import Image from '../components/Image';
import type { ProcessedSurgery } from '../types'; // ← Use actual type

const CombinedView: React.FC = () => {
  const { filteredSurgeries, filters, hasData } = useData();

  if (!hasData || filteredSurgeries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          No data available for {filters.surgeon} performing {filters.procedure}.
        </p>
      </div>
    );
  }

  // Last surgery
  const lastSurgery: ProcessedSurgery = [...filteredSurgeries].sort((a, b) => 
    b.datetime.getTime() - a.datetime.getTime()
  )[0];

  // Best surgery
  const bestSurgery: ProcessedSurgery = filteredSurgeries.reduce(
    (min: ProcessedSurgery, surgery: ProcessedSurgery) => 
      surgery.duration < min.duration ? surgery : min,
    filteredSurgeries[0]
  );

  const totalCases = filteredSurgeries.length;
  const averageTime = Math.round(
    filteredSurgeries.reduce((sum: number, surgery: ProcessedSurgery) => sum + surgery.duration, 0) / totalCases
  );

  // Instrument stats
  const instrumentStats = filteredSurgeries.reduce(
    (acc: Record<string, { totalDuration: number; count: number }>, surgery: ProcessedSurgery) => {
      surgery.instruments.forEach((instrument) => {
        if (!acc[instrument.name]) {
          acc[instrument.name] = { totalDuration: 0, count: 0 };
        }
        acc[instrument.name].totalDuration += instrument.duration;
        acc[instrument.name].count += 1;
      });
      return acc;
    },
    {}
  );

  const instrumentAverages = Object.entries(instrumentStats).map(([name, stats]) => ({
    name,
    averageDuration: Math.round(stats.totalDuration / stats.count),
    usageRate: Math.round((stats.count / totalCases) * 100)
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* LEFT: SUMMARY */}
      <div className="lg:col-span-3">
        <div className="bg-white border-2 border-[#00938e] rounded-lg p-6 shadow-sm min-h-[400px]">
          <h3 className="text-xl font-bold text-[#00938e] mb-2">
            {filters.procedure}
          </h3>
          <p className="text-sm text-gray-600 mb-6">by {filters.surgeon}</p>
          
          <div className="space-y-6">
            <div>
              <p className="text-xs text-[#00938e] uppercase tracking-wide font-semibold">Total Cases</p>
              <p className="text-3xl font-bold text-[#00938e]">{totalCases}</p>
            </div>
            <div>
              <p className="text-xs text-[#00938e] uppercase tracking-wide font-semibold">Average Time</p>
              <p className="text-3xl font-bold text-[#00938e]">{averageTime} min</p>
            </div>
            <div>
              <p className="text-xs text-[#00938e] uppercase tracking-wide font-semibold">Best Time</p>
              <p className="text-3xl font-bold text-[#00938e]">{bestSurgery.duration} min</p>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE: LATEST SURGERY */}
      <div className="lg:col-span-4">
        <div className="bg-white border-2 border-[#00938e] rounded-lg p-6 shadow-sm h-full min-h-[400px]">
          <h3 className="text-lg font-semibold text-[#00938e] mb-4 uppercase tracking-wide">
            Latest Surgery
          </h3>
          
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Image
                type="surgeon"
                name={lastSurgery.surgeon_name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <p className="font-bold text-lg text-[#00938e]">{lastSurgery.procedure_name}</p>
                <p className="font-bold text-2xl text-[#00938e]">{lastSurgery.duration} min</p>
                <p className="text-sm text-gray-600">{lastSurgery.surgeon_name}</p>
                <p className="text-xs text-gray-500">
                  {lastSurgery.date} at {lastSurgery.time}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-[#00938e] uppercase tracking-wide">
              Instruments Used
            </h4>
            {lastSurgery.instruments.length > 0 ? (
              lastSurgery.instruments.map((instrument, index) => {
                const percentage = Math.round((instrument.duration / lastSurgery.duration) * 100);
                return (
                  <div key={index} className="flex items-center gap-4">
                    <Image
                      type="instrument"
                      name={instrument.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">{instrument.name}</p>
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
              <p className="text-sm text-gray-600">No instruments used.</p>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: ANALYTICS */}
      <div className="lg:col-span-5">
        <div className="bg-white border-2 border-[#00938e] rounded-lg p-6 shadow-sm h-full min-h-[400px]">
          <h3 className="text-lg font-semibold text-[#00938e] mb-4 uppercase tracking-wide">
            Instrument Analytics
          </h3>
          
          <div className="mb-6">
            <p className="text-xs text-[#00938e] uppercase tracking-wide font-semibold">Unique Instruments</p>
            <p className="text-3xl font-bold text-[#00938e]">{instrumentAverages.length}</p>
          </div>

          <div className="space-y-4">
            {instrumentAverages.length > 0 ? (
              instrumentAverages.map((instrument, index) => (
                <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-center gap-3 mb-3">
                    <Image
                      type="instrument"
                      name={instrument.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">{instrument.name}</p>
                      <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                        <span>Avg: {instrument.averageDuration} min</span>
                        <span>Used: {instrument.usageRate}%</span>
                      </div>
                      <ProgressBar
                        percentage={instrument.usageRate}
                        showDuration={false}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-600">No instruments recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombinedView;