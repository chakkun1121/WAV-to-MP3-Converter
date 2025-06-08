
import React from 'react';

interface BitRateSelectorProps {
  selectedBitRate: number;
  onBitRateChange: (bitRate: number) => void;
  disabled: boolean;
}

const commonBitRates = [64, 96, 128, 160, 192, 256, 320]; // in kbps

const BitRateSelector: React.FC<BitRateSelectorProps> = ({ selectedBitRate, onBitRateChange, disabled }) => {
  return (
    <div className="my-4 w-full md:w-1/2">
      <label htmlFor="bitrate-select" className="block text-sm font-medium text-gray-700 mb-1">
        MP3 Bitrate:
      </label>
      <select
        id="bitrate-select"
        name="bitrate"
        value={selectedBitRate}
        onChange={(e) => onBitRateChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
      >
        {commonBitRates.map(rate => (
          <option key={rate} value={rate}>
            {rate} kbps
          </option>
        ))}
      </select>
    </div>
  );
};

export default BitRateSelector;
