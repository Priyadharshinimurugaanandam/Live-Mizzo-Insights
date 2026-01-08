import React from 'react';
import { useData } from '../context/DataContext';
import ProgressBar from '../components/ProgressBar';
import Image from '../components/Image';
import LiveIndicator from '../components/LiveIndicator';

const DefaultView: React.FC = () => {
  const { filteredSurgeries, liveSurgery, uniqueProcedures, filters, setFilters } = useData();

  const displaySurgery = liveSurgery || [...filteredSurgeries]
    .filter((s: any) => !s.is_live)
    .sort((a, b) => b.datetime.getTime() - a.datetime.getTime())[0];

  if (!displaySurgery) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <p className="text-gray-600 text-lg dark:text-gray-300">
          No surgical data available. Waiting for surgery to start...
        </p>
      </div>
    );
  }

  const totalCases = filteredSurgeries.filter((s: any) => !s.is_live).length;
  const procedureCounts = filteredSurgeries
    .filter((s: any) => !s.is_live)
    .reduce((acc: Record<string, number>, surgery: any) => {
      acc[surgery.procedure_name] = (acc[surgery.procedure_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const procedureVolumes = Object.entries(procedureCounts).map(([name, count]) => ({
    name,
    count: count as number,
    percentage: Math.round(((count as number) / totalCases) * 100)
  }));

  const isLive = liveSurgery?.id === displaySurgery.id;

  return (
    <div className="space-y-6">
      

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white dark:bg-gray-800 border-2 border-[#00938e] rounded-xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 bg-[#00938e] text-white rounded-bl-xl">
              {isLive ? (
                <>
                  <LiveIndicator isLive={true} />
                  <span className="text-xs font-bold">CURRENT SURGERY</span>
                </>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider">Last Case</span>
              )}
            </div>

            <div className="flex items-center justify-between mt-8">
              <div className="flex items-center gap-6">
                <Image
                  type="surgeon"
                  name={displaySurgery.surgeon_name}
                  className="w-24 h-24 rounded-full object-cover shadow-xl"
                />
                <div>
                  <p className="text-3xl font-bold text-[#00938e] leading-tight">
                    {displaySurgery.surgeon_name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {displaySurgery.date} at {displaySurgery.time}
                  </p>
                  {(displaySurgery as any).patient_info && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {(displaySurgery as any).patient_info}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className="text-5xl font-bold text-[#00938e] leading-none">
                  {displaySurgery.duration}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">min</p>
                <p className="text-2xl font-bold text-[#00938e] mt-2 leading-tight">
                  {displaySurgery.procedure_name}
                </p>
                {(displaySurgery as any).clutch_count > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Clutch: {(displaySurgery as any).clutch_count} presses
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border-2 border-[#00938e] rounded-xl p-6 shadow-sm flex-1 overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#00938e] mb-4 uppercase tracking-wide">
              {isLive ? 'Instruments Currently in Use' : 'Instruments Used in Last Case'}
            </h3>
            <div className="space-y-4">
              {displaySurgery.instruments.length > 0 ? (
                displaySurgery.instruments.map((instrument: any, index: number) => {
                  const percentage = displaySurgery.duration > 0
                    ? Math.round((instrument.duration / displaySurgery.duration) * 100)
                    : 0;
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
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isLive ? 'Waiting for instrument connection...' : 'No instruments used.'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">


          
        </div>
      </div>
    </div>
  );
};

export default DefaultView;