import React from 'react';
import { useData } from '../context/DataContext';
import ProgressBar from '../components/ProgressBar';
import Image from '../components/Image'; // ← ADD THIS IMPORT

const ProcedureView: React.FC = () => {
  const { filteredSurgeries, filters, hasData } = useData();

  if (!hasData || filteredSurgeries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No data available for {filters.procedure}.</p>
      </div>
    );
  }

  const totalCases = filteredSurgeries.length;
  const averageTime = Math.round(
    filteredSurgeries.reduce((sum, surgery) => sum + surgery.duration, 0) / totalCases
  );

  const instrumentStats = filteredSurgeries.reduce((acc, surgery) => {
    surgery.instruments.forEach(instrument => {
      if (!acc[instrument.name]) {
        acc[instrument.name] = {
          name: instrument.name,
          totalDuration: 0,
          count: 0,
        };
      }
      acc[instrument.name].totalDuration += instrument.duration;
      acc[instrument.name].count += 1;
    });
    return acc;
  }, {} as Record<string, { name: string; totalDuration: number; count: number }>);

  const instruments = Object.values(instrumentStats).map(stat => ({
    name: stat.name,
    averageDuration: Math.round(stat.totalDuration / stat.count),
    count: stat.count,
    usageRate: stat.count / totalCases,
  }));

  const bestProcedure = filteredSurgeries.reduce((best, surgery) =>
    surgery.duration < best.duration ? surgery : best,
    filteredSurgeries[0]
  );

  const totalConsoleTime = filteredSurgeries.reduce((sum, surgery) => sum + surgery.duration, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      <div className="lg:col-span-3">
        <div className="bg-white border-2 border-[#00938e] rounded-lg p-6 shadow-sm min-h-[400px]">
          <div className="space-y-6">
            <div>
              <p className="text-xs text-[#00938e] uppercase tracking-wide font-semibold">Procedure</p>
              <p className="text-xl font-bold text-[#00938e]">{filters.procedure}</p>
            </div>
            <div>
              <p className="text-xs text-[#00938e] uppercase tracking-wide font-semibold">Total Cases</p>
              <p className="text-3xl font-bold text-[#00938e]">{totalCases}</p>
            </div>
            <div>
              <p className="text-xs text-[#00938e] uppercase tracking-wide font-semibold">Average Time</p>
              <p className="text-3xl font-bold text-[#00938e]">{averageTime} min</p>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-4">
        <div className="bg-white border-2 border-[#00938e] rounded-lg p-6 shadow-sm min-h-[400px]">
          <h3 className="text-lg font-semibold text-[#00938e] mb-4 uppercase tracking-wide">Instrument Usage</h3>
          <div className="space-y-4">
            {instruments.length > 0 ? (
              instruments.map((instrument, index) => {
                const percentage = Math.round((instrument.averageDuration / totalConsoleTime) * 100 * totalCases);
                return (
                  <div key={index} className="flex items-center gap-4">
                    {/* REPLACED: <img> → <Image type="instrument" /> */}
                    <Image
                      type="instrument"
                      name={instrument.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-1">{instrument.name}</p>
                      <ProgressBar
                        percentage={percentage}
                        duration={instrument.averageDuration}
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

      <div className="lg:col-span-5">
        <div className="bg-white border-2 border-[#00938e] rounded-lg p-6 shadow-sm h-full min-h-[400px]">
          <h3 className="text-lg font-semibold text-[#00938e] mb-4 uppercase tracking-wide">Best Surgery Details</h3>
          
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              {/* REPLACED: <img> → <Image type="surgeon" /> */}
              <Image
                type="surgeon"
                name={bestProcedure.surgeon_name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <p className="font-bold text-2xl text-[#00938e]">{bestProcedure.duration} min</p>
                <p className="text-sm text-gray-600">{bestProcedure.surgeon_name}</p>
                <p className="text-xs text-gray-500">
                  {bestProcedure.date} at {bestProcedure.time}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-[#00938e] uppercase tracking-wide">
              Instruments Used
            </h4>
            {bestProcedure.instruments.length > 0 ? (
              bestProcedure.instruments.map((instrument, index) => {
                const percentage = Math.round((instrument.duration / bestProcedure.duration) * 100);
                return (
                  <div key={index} className="flex items-center gap-4">
                    {/* REPLACED: <img> → <Image type="instrument" /> */}
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

            <div className="mt-4 pt-3 border-t border-gray-200">
              <h5 className="text-xs font-semibold text-[#00938e] uppercase tracking-wide mb-2">
                Clutch Usage
              </h5>
              {bestProcedure.clutches.length > 0 ? (
                bestProcedure.clutches.map((clutch, index) => (
                  <div key={index} className="flex justify-between items-center mb-1">
                    <p className="text-xs font-medium">{clutch.name}</p>
                    <span className="text-xs text-[#00938e] font-semibold">{clutch.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-600">No clutch usage.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcedureView;