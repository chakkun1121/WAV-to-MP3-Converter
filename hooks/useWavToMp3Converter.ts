
// hooks/useWavToMp3Converter.ts
import { useState, useCallback, useEffect } from 'react';
import { WavData, parseWavFile } from '../utils/wavParser';

// This tells TypeScript that lamejs is globally available (e.g. from a CDN script)
declare var lamejs: any;

export enum ConversionStatus {
  IDLE = 'IDLE',
  READING_FILE = 'READING_FILE',
  PARSING_WAV = 'PARSING_WAV',
  CONVERTING = 'CONVERTING',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

export interface ConverterResult {
  mp3Blob: Blob | null;
  mp3Url: string | null;
  fileName: string | null;
}

const useWavToMp3Converter = () => {
  const [status, setStatus] = useState<ConversionStatus>(ConversionStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConverterResult>({ mp3Blob: null, mp3Url: null, fileName: null });
  const [progress, setProgress] = useState(0); // 0-100 for conversion progress

  const convertWavToMp3 = useCallback(async (wavFile: File, bitRate: number = 128) => {
    if (typeof lamejs === 'undefined' || typeof lamejs.Mp3Encoder === 'undefined') {
        setError('LameJS library not loaded. Please ensure it is included in the page (usually in index.html).');
        setStatus(ConversionStatus.ERROR);
        return;
    }

    setStatus(ConversionStatus.READING_FILE);
    setError(null);
    if (result.mp3Url) {
      URL.revokeObjectURL(result.mp3Url); // Revoke previous URL
    }
    setResult({ mp3Blob: null, mp3Url: null, fileName: null });
    setProgress(0);

    try {
      const arrayBuffer = await wavFile.arrayBuffer();
      setStatus(ConversionStatus.PARSING_WAV);
      const wavData: WavData | null = parseWavFile(arrayBuffer);

      if (!wavData) {
        setError('Failed to parse WAV file. It might be corrupted or an unsupported format (supports 8/16-bit PCM).');
        setStatus(ConversionStatus.ERROR);
        return;
      }

      const { channels, sampleRate, samples } = wavData;
      
      const LAME_SAMPLE_BLOCK_SIZE = 1152; // Recommended by lamejs

      setStatus(ConversionStatus.CONVERTING);
      await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI update

      const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitRate);
      const mp3Data: Uint8Array[] = [];

      const totalSamplesPerChannel = samples.length / channels;

      for (let i = 0; i < totalSamplesPerChannel; i += LAME_SAMPLE_BLOCK_SIZE) {
        const remainingSamples = totalSamplesPerChannel - i;
        const currentBlockSize = Math.min(LAME_SAMPLE_BLOCK_SIZE, remainingSamples);
        
        let leftChunk: Int16Array;
        let rightChunk: Int16Array | undefined = undefined; // Lamejs expects undefined for mono in encodeBuffer

        if (channels === 1) {
          leftChunk = samples.subarray(i, i + currentBlockSize);
        } else { // Stereo: de-interleave
          leftChunk = new Int16Array(currentBlockSize);
          rightChunk = new Int16Array(currentBlockSize);
          for (let j = 0; j < currentBlockSize; j++) {
            const sampleIndex = (i + j) * 2;
            leftChunk[j] = samples[sampleIndex];
            rightChunk[j] = samples[sampleIndex + 1];
          }
        }
        
        const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
        setProgress(Math.round(((i + currentBlockSize) / totalSamplesPerChannel) * 100));
         // Yield to the event loop occasionally for very large files
        if ((i / LAME_SAMPLE_BLOCK_SIZE) % 100 === 0) { // Every 100 blocks
            await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      
      const mp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' });
      const mp3Url = URL.createObjectURL(mp3Blob);
      const originalFileName = wavFile.name.substring(0, wavFile.name.lastIndexOf('.')) || wavFile.name;
      
      setResult({ mp3Blob, mp3Url, fileName: `${originalFileName}.mp3` });
      setStatus(ConversionStatus.DONE);
      setProgress(100);

    } catch (e: any) {
      console.error('Conversion error:', e);
      setError(`Conversion failed: ${e.message || 'Unknown error during processing.'}`);
      setStatus(ConversionStatus.ERROR);
      setProgress(0);
    }
  }, [result.mp3Url]); // Add result.mp3Url to dependencies for proper cleanup logic

  const resetConverter = useCallback(() => {
    setStatus(ConversionStatus.IDLE);
    setError(null);
    if (result.mp3Url) {
      URL.revokeObjectURL(result.mp3Url);
    }
    setResult({ mp3Blob: null, mp3Url: null, fileName: null });
    setProgress(0);
  }, [result.mp3Url]);

  // Cleanup Object URL on unmount
  useEffect(() => {
    const currentUrl = result.mp3Url;
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [result.mp3Url]);


  return { status, error, result, progress, convertWavToMp3, resetConverter };
};

export default useWavToMp3Converter;
