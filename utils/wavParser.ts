
// utils/wavParser.ts
import { getStringFromDataView } from './dataViewUtils';

export interface WavData {
  channels: number;
  sampleRate: number;
  samples: Int16Array; // Raw PCM data, interleaved for stereo, converted to 16-bit signed
  bitsPerSampleOriginal: number; // Original bits per sample (8 or 16)
}

export const parseWavFile = (arrayBuffer: ArrayBuffer): WavData | null => {
  const view = new DataView(arrayBuffer);

  if (getStringFromDataView(view, 0, 4) !== 'RIFF' || getStringFromDataView(view, 8, 4) !== 'WAVE') {
    console.error('Invalid WAV: RIFF/WAVE header missing.');
    return null;
  }

  let offset = 12; 
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSampleOriginal = 0;
  let dataChunkOffset = -1;
  let dataChunkSize = 0;
  let foundFmt = false;

  while (offset < view.byteLength) {
    // Ensure there's enough space for chunk ID and size
    if (offset + 8 > view.byteLength) break;

    const chunkId = getStringFromDataView(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    offset += 8;

    // Ensure chunkSize doesn't cause offset to go out of bounds
    if (offset + chunkSize > view.byteLength && chunkId !== 'data' && chunkId !== 'fmt ') { // 'data' chunk might be last
      console.warn(`Chunk ${chunkId} size ${chunkSize} exceeds buffer length. Truncating or malformed WAV.`);
      // break; // Or attempt to process if it's a known chunk.
    }
    
    if (chunkId === 'fmt ') {
      foundFmt = true;
      if (chunkSize < 16) {
          console.error('Invalid WAV: "fmt " chunk too small.');
          return null;
      }
      const audioFormat = view.getUint16(offset, true);
      if (audioFormat !== 1) { // 1 for PCM
        console.error('Unsupported WAV: Not PCM format.');
        return null;
      }
      channels = view.getUint16(offset + 2, true);
      sampleRate = view.getUint32(offset + 4, true);
      // byteRate = view.getUint32(offset + 8, true);
      // blockAlign = view.getUint16(offset + 12, true);
      bitsPerSampleOriginal = view.getUint16(offset + 14, true);
      
      if (bitsPerSampleOriginal !== 8 && bitsPerSampleOriginal !== 16) {
        console.error(`Unsupported WAV: Only 8-bit or 16-bit samples are supported, got ${bitsPerSampleOriginal}.`);
        return null;
      }
    } else if (chunkId === 'data') {
      if (!foundFmt) {
        console.error('Invalid WAV: "data" chunk found before "fmt ".');
        // Some tools might place data chunk before fmt, though non-standard.
        // For strict parsing, return null. For leniency, one might store and process later.
        return null;
      }
      dataChunkOffset = offset;
      dataChunkSize = chunkSize;
      // Stop parsing after finding the 'data' chunk, assuming it's the primary audio payload.
      // More robust parsing might look for multiple 'data' chunks or other metadata.
      break; 
    }
    
    offset += chunkSize; 
    if (chunkSize % 2 !== 0) { // Align to word boundary if chunkSize is odd
        offset++;
    }
  }

  if (!foundFmt || dataChunkOffset === -1 || dataChunkSize === 0) {
    console.error('Invalid WAV: "fmt " or "data" chunk not found, malformed, or empty data.');
    return null;
  }

  const bytesPerSample = bitsPerSampleOriginal / 8;
  if (bytesPerSample === 0) { // Avoid division by zero if bitsPerSampleOriginal was somehow 0
    console.error('Invalid WAV: bitsPerSampleOriginal is zero.');
    return null;
  }
  const numSamplesTotal = dataChunkSize / bytesPerSample;
  
  let samples: Int16Array;

  if (bitsPerSampleOriginal === 16) {
    samples = new Int16Array(arrayBuffer, dataChunkOffset, numSamplesTotal);
  } else if (bitsPerSampleOriginal === 8) {
    const eightBitSamples = new Uint8Array(arrayBuffer, dataChunkOffset, numSamplesTotal);
    samples = new Int16Array(numSamplesTotal);
    for (let i = 0; i < numSamplesTotal; i++) {
      // 8-bit WAV is unsigned (0-255). Convert to signed 16-bit (-32768 to 32767)
      samples[i] = (eightBitSamples[i] - 128) << 8;
    }
  } else {
      console.error(`Internal error: Unsupported bit depth for sample conversion: ${bitsPerSampleOriginal}`);
      return null;
  }
  
  return { channels, sampleRate, samples, bitsPerSampleOriginal };
};
