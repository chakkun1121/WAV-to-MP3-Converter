
import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  statusText?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, statusText }) => {
  const cappedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full my-2">
      {statusText && <p className="text-sm text-gray-700 mb-1">{statusText}</p>}
      <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all duration-150 ease-linear"
          style={{ width: `${cappedProgress}%` }}
          role="progressbar"
          aria-valuenow={cappedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        ></div>
      </div>
      <p className="text-xs text-gray-600 mt-1 text-right">{`${Math.round(cappedProgress)}% complete`}</p>
    </div>
  );
};

export default ProgressBar;
