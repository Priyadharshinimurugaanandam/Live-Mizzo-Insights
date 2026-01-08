import React from 'react';

interface LiveIndicatorProps {
  isLive: boolean;
}

const LiveIndicator: React.FC<LiveIndicatorProps> = ({ isLive }) => {
  if (!isLive) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-sm font-bold animate-pulse">
      <span className="w-3 h-3 bg-white rounded-full"></span>
      LIVE
    </div>
  );
};

export default LiveIndicator;