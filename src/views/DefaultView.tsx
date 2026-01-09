import React from 'react';
import { useData } from '../context/DataContext';
import ProgressBar from '../components/ProgressBar';
import Image from '../components/Image';
import LiveIndicator from '../components/LiveIndicator';
import { RefreshCw, ArrowLeft } from 'lucide-react';

const DefaultView: React.FC = () => {
  const { 
    filteredSurgeries, 
    liveSurgery, 
    selectedHistorySurgery,
    setSelectedHistorySurgery,
    fetchData,
    isLoading,
    surgeonName
  } = useData();

  const displaySurgery = selectedHistorySurgery || liveSurgery || [...filteredSurgeries]
    .filter((s: any) => !s.is_live)
    .sort((a, b) => b.datetime.getTime() - a.datetime.getTime())[0];

  const historySurgeries = filteredSurgeries.filter((s: any) => !s.is_live);
  const isLive = !selectedHistorySurgery && liveSurgery?.id === displaySurgery?.id;
  const isHistoryView = selectedHistorySurgery !== null;

  const handleRefresh = async () => {
    await fetchData();
  };

  const handleBackToLive = () => {
    setSelectedHistorySurgery(null);
  };

  if (!displaySurgery) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <p className="text-gray-600 text-lg dark:text-gray-300 mb-4">
          No surgical data available. Waiting for surgery to start...
        </p>
        {surgeonName && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Surgeon: {surgeonName}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar with Refresh and Back Button */}
      <div className="flex items-center justify-end gap-3">
        {isHistoryView && (
          <button
            onClick={handleBackToLive}
            className="flex items-center gap-2 px-4 py-2 bg-[#00938e] text-white rounded-lg hover:bg-[#007a76] transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Back to Live</span>
          </button>
        )}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-[#00938e] text-[#00938e] rounded-lg hover:bg-[#00938e] hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          <span className="text-sm font-semibold">Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: CURRENT/SELECTED SURGERY */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white dark:bg-gray-800 border-2 border-[#00938e] rounded-xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 bg-[#00938e] text-white rounded-bl-xl">
              {isLive ? (
                <>
                  <LiveIndicator isLive={true} />
                  <span className="text-xs font-bold">CURRENT SURGERY</span>
                </>
              ) : isHistoryView ? (
                <span className="text-xs font-bold uppercase tracking-wider">History</span>
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

          {/* Instruments Card */}
          <div className="bg-white dark:bg-gray-800 border-2 border-[#00938e] rounded-xl p-6 shadow-sm flex-1">
            <h3 className="text-lg font-semibold text-[#00938e] mb-4 uppercase tracking-wide">
              {isLive ? 'Instruments Currently in Use' : 'Instruments Used'}
            </h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
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

        {/* RIGHT: HISTORY LIST */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-gray-800 border-2 border-[#00938e] rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#00938e] mb-4 uppercase tracking-wide">
              Surgery History ({historySurgeries.length})
            </h3>
            <div className="space-y-3 max-h-[700px] overflow-y-auto">
              {historySurgeries.length > 0 ? (
                historySurgeries.map((surgery: any) => (
                  <div
                    key={surgery.id}
                    onClick={() => setSelectedHistorySurgery(surgery)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedHistorySurgery?.id === surgery.id
                        ? 'border-[#00938e] bg-[#00938e] bg-opacity-10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-[#00938e]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-[#00938e]">{surgery.procedure_name}</p>
                      <span className="text-lg font-bold text-[#00938e]">{surgery.duration} min</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span>{surgery.date}</span>
                      <span>•</span>
                      <span>{surgery.time}</span>
                    </div>
                    {surgery.patient_info && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {surgery.patient_info}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">
                  No completed surgeries yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefaultView;