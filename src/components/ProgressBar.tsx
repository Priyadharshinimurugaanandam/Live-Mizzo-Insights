import React from 'react';

interface ProgressBarProps {
  percentage: number;
  duration?: number;
  showDuration?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  percentage, 
  duration, 
  showDuration = true,
  size = 'md' 
}) => {
  const heightClass = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const textClass = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-200 rounded-full ${heightClass[size]}`}>
        <div
          className="bg-[#00938e] rounded-full transition-all duration-500 ease-out h-full"
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      {showDuration && (
        <div className={`${textClass[size]} text-gray-600 mt-1`}>
          {duration !== undefined ? `${duration} min` : ''} ({Math.round(clampedPercentage)}%)
        </div>
      )}
    </div>
  );
};

export default ProgressBar;