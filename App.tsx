
import React, { useState, useCallback, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import BitRateSelector from './components/BitRateSelector';
import ProgressBar from './components/ProgressBar';
import Spinner from './components/Spinner';
import useWavToMp3Converter, { ConversionStatus, ConverterResult } from './hooks/useWavToMp3Converter';

declare var JSZip: any;

interface ConversionJob {
  id: string;
  file: File;
  status: ConversionStatus;
  progress: number;
  result: ConverterResult | null;
  error: string | null;
}

const generateFileId = (file: File): string => {
  return `${file.name}-${file.size}-${file.lastModified}`;
};

const App: React.FC = () => {
  const [conversionJobs, setConversionJobs] = useState<ConversionJob[]>([]);
  const [selectedBitRate, setSelectedBitRate] = useState<number>(128);
  const [fileUploadResetTrigger, setFileUploadResetTrigger] = useState<number>(0);
  
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
  const [currentConvertingFileId, setCurrentConvertingFileId] = useState<string | null>(null);
  
  const [totalFilesInCurrentRun, setTotalFilesInCurrentRun] = useState<number>(0);
  const [filesProcessedInCurrentRun, setFilesProcessedInCurrentRun] = useState<number>(0);

  const [isZipping, setIsZipping] = useState<boolean>(false);

  const { 
    status: hookStatus, 
    error: hookError, 
    result: hookResult, 
    progress: hookProgress, 
    convertWavToMp3, 
    resetConverter: resetHookState 
  } = useWavToMp3Converter();

  const processNextFileInQueue = useCallback(async () => {
    if (currentConvertingFileId || isZipping) return; // Already processing or zipping

    const nextJobToProcess = conversionJobs.find(job => job.status === ConversionStatus.IDLE);

    if (nextJobToProcess) {
      setIsProcessingQueue(true);
      setCurrentConvertingFileId(nextJobToProcess.id);
      
      // Update total files for this run if it's a "new" run
      if (filesProcessedInCurrentRun >= totalFilesInCurrentRun || totalFilesInCurrentRun === 0) {
          const pendingJobs = conversionJobs.filter(j => j.status === ConversionStatus.IDLE).length;
          setTotalFilesInCurrentRun(pendingJobs); // All IDLE jobs including the one about to start
          setFilesProcessedInCurrentRun(0); // Reset for this run
      }
      
      setConversionJobs(prev => 
        prev.map(j => 
          j.id === nextJobToProcess.id 
            ? { ...j, status: ConversionStatus.READING_FILE, progress: 0, error: null, result: null } 
            : j
        )
      );
      
      await resetHookState();
      await convertWavToMp3(nextJobToProcess.file, selectedBitRate);
    } else {
      const anyActiveNonIdle = conversionJobs.some(job => 
        job.status === ConversionStatus.CONVERTING || 
        job.status === ConversionStatus.PARSING_WAV || 
        job.status === ConversionStatus.READING_FILE
      );
      if (!anyActiveNonIdle) {
        setIsProcessingQueue(false);
        // Keep totalFilesInCurrentRun & filesProcessedInCurrentRun to show final status until reset/new files
      }
    }
  }, [conversionJobs, currentConvertingFileId, selectedBitRate, convertWavToMp3, resetHookState, isZipping, filesProcessedInCurrentRun, totalFilesInCurrentRun]);

  const handleFilesSelect = useCallback((files: File[]) => {
    if (isZipping) return;
    const newJobs = files.map(file => ({
      id: generateFileId(file),
      file,
      status: ConversionStatus.IDLE,
      progress: 0,
      result: null,
      error: null,
    })).filter(newJob => !conversionJobs.some(existingJob => existingJob.id === newJob.id));

    if (newJobs.length > 0) {
      setConversionJobs(prevJobs => [...prevJobs, ...newJobs]);
    }
  }, [conversionJobs, isZipping]);

  useEffect(() => {
    if (!isZipping) {
      processNextFileInQueue();
    }
  }, [conversionJobs, currentConvertingFileId, processNextFileInQueue, isZipping]); // currentConvertingFileId ensures it re-evaluates when a file finishes


  const removeFile = (fileId: string) => {
    if (isZipping || (currentConvertingFileId === fileId && isProcessingQueue)) return; 
    
    setConversionJobs(prevJobs => {
        const jobToRemove = prevJobs.find(j => j.id === fileId);
        const updatedJobs = prevJobs.filter(job => job.id !== fileId);

        if (jobToRemove && jobToRemove.status === ConversionStatus.IDLE) {
            if (totalFilesInCurrentRun > 0 && filesProcessedInCurrentRun < totalFilesInCurrentRun) {
                 // If it was part of the current run's pending files, adjust total.
                 const newIdleCount = updatedJobs.filter(j => j.status === ConversionStatus.IDLE).length;
                 const currentlyProcessing = updatedJobs.find(j => j.id === currentConvertingFileId);
                 let newTotal = newIdleCount + (currentlyProcessing ? 1:0);
                 if (newTotal < 0) newTotal = 0; // ensure not negative
                 
                 setTotalFilesInCurrentRun(newTotal);
                 
                 // If filesProcessedInCurrentRun exceeds new total, cap it.
                 if (filesProcessedInCurrentRun > newTotal) {
                    setFilesProcessedInCurrentRun(newTotal);
                 }
            }
        }
         if (updatedJobs.length === 0) {
            setTotalFilesInCurrentRun(0);
            setFilesProcessedInCurrentRun(0);
            setIsProcessingQueue(false);
        }
        return updatedJobs;
    });
  };
  
  useEffect(() => {
    if (!currentConvertingFileId) return;

    setConversionJobs(prevJobs =>
      prevJobs.map(job => {
        if (job.id === currentConvertingFileId) {
          let newProgress = job.progress;
          if (hookStatus === ConversionStatus.CONVERTING || hookStatus === ConversionStatus.PARSING_WAV || hookStatus === ConversionStatus.READING_FILE) {
            newProgress = hookProgress;
          } else if (hookStatus === ConversionStatus.DONE) {
            newProgress = 100;
          } else if (hookStatus === ConversionStatus.ERROR) {
            newProgress = 0;
          }
          
          const updatedJob = {
            ...job,
            status: hookStatus,
            progress: newProgress,
            result: hookStatus === ConversionStatus.DONE ? hookResult : job.result,
            error: hookStatus === ConversionStatus.ERROR ? hookError : null, 
          };

          if (hookStatus === ConversionStatus.DONE || hookStatus === ConversionStatus.ERROR) {
            setCurrentConvertingFileId(null); 
            setFilesProcessedInCurrentRun(prev => prev + 1);
          }
          return updatedJob;
        }
        return job;
      })
    );
  }, [hookStatus, hookProgress, hookError, hookResult, currentConvertingFileId]);

  const handleResetClick = useCallback(() => {
    if (isZipping) {
        alert("Cannot reset while zipping. Please wait.");
        return;
    }
    // Current file might finish, but its update won't find a job / won't matter
    setConversionJobs([]); 
    resetHookState(); 
    setFileUploadResetTrigger(prev => prev + 1);
    setCurrentConvertingFileId(null); 
    setIsProcessingQueue(false); 
    setTotalFilesInCurrentRun(0);
    setFilesProcessedInCurrentRun(0);
  }, [resetHookState, isZipping]);

  const handleDownloadAllClick = async () => {
    if (isProcessingQueue || isZipping) return;

    const filesToZip = conversionJobs.filter(job => job.status === ConversionStatus.DONE && job.result?.mp3Blob);
    if (filesToZip.length === 0) {
      alert("No successfully converted files available to download.");
      return;
    }
    if (typeof JSZip === 'undefined') {
      alert("Error: JSZip library is not loaded. Cannot create ZIP file.");
      return;
    }
    setIsZipping(true);
    try {
      const zip = new JSZip();
      filesToZip.forEach(job => {
        if (job.result?.mp3Blob && job.result?.fileName) {
          zip.file(job.result.fileName, job.result.mp3Blob);
        }
      });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = "converted_mp3s.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Error creating ZIP file:", error);
      alert(`Failed to create ZIP file: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsZipping(false);
    }
  };
  
  const showResetButton = conversionJobs.length > 0 && !isZipping;
  const successfullyConvertedFiles = conversionJobs.filter(job => job.status === ConversionStatus.DONE && job.result?.mp3Blob);
  const canDownloadAll = successfullyConvertedFiles.length > 0 && !isProcessingQueue && !isZipping;

  let overallProgressPercent = 0;
  if (totalFilesInCurrentRun > 0) {
      overallProgressPercent = Math.min(100, (filesProcessedInCurrentRun / totalFilesInCurrentRun) * 100);
  } else if (conversionJobs.length > 0 && conversionJobs.every(j => j.status === ConversionStatus.DONE || j.status === ConversionStatus.ERROR)) {
      overallProgressPercent = 100;
  }

  const currentProcessingJobDetails = conversionJobs.find(job => job.id === currentConvertingFileId);
  const currentFileConvertingName = currentProcessingJobDetails?.file.name;
  const anyErrorsInLastRun = conversionJobs.some(job => job.status === ConversionStatus.ERROR);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4 text-gray-200 font-sans">
      <div className="bg-slate-700 shadow-2xl rounded-xl p-6 md:p-10 w-full max-w-3xl space-y-6">
        <header className="text-center">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            WAV to MP3 Auto Converter
          </h1>
          <p className="mt-2 text-slate-400">Select .wav files to convert them to .mp3 automatically.</p>
        </header>

        {typeof (window as any).lamejs === 'undefined' && (
             <div className="bg-red-700 border border-red-600 text-red-100 px-4 py-3 rounded-lg relative" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">LameJS audio encoding library not loaded. Conversions will fail.</span>
             </div>
        )}
         {typeof JSZip === 'undefined' && (
             <div className="bg-yellow-700 border border-yellow-600 text-yellow-100 px-4 py-3 rounded-lg relative mt-4" role="alert">
                <strong className="font-bold">Warning: </strong>
                <span className="block sm:inline">JSZip library not loaded. "Download All" feature will be unavailable.</span>
             </div>
        )}

        <section>
          <FileUpload 
            onFilesSelect={handleFilesSelect} 
            disabled={isZipping} 
            acceptedFileType=".wav"
            resetTrigger={fileUploadResetTrigger}
          />
        </section>

        {conversionJobs.length > 0 && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-slate-300">Conversion Queue ({conversionJobs.length})</h3>
              <BitRateSelector
                  selectedBitRate={selectedBitRate}
                  onBitRateChange={setSelectedBitRate}
                  disabled={isZipping || isProcessingQueue } 
              />
            </div>
            <ul className="max-h-72 overflow-y-auto bg-slate-800 p-3 rounded-lg shadow-inner space-y-2">
              {conversionJobs.map(job => (
                <li key={job.id} className="p-3 bg-slate-600 rounded-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                  <div className="flex-grow min-w-0"> 
                    <p className="font-medium text-slate-200 truncate" title={job.file.name}>{job.file.name}</p>
                    {(job.status === ConversionStatus.CONVERTING || job.status === ConversionStatus.PARSING_WAV || job.status === ConversionStatus.READING_FILE) && currentConvertingFileId === job.id && (
                       <ProgressBar progress={job.progress} />
                    )}
                     {job.status === ConversionStatus.ERROR && job.error && (
                        <p className="text-xs text-red-400 mt-1" title={job.error}>Error: {job.error.length > 50 ? job.error.substring(0,50) + '...' : job.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:w-auto w-full justify-between">
                    <div className="flex items-center space-x-2 w-36 text-xs shrink-0">
                        {job.status === ConversionStatus.IDLE && <span className="text-slate-400">Waiting in queue...</span>}
                        {(job.status === ConversionStatus.READING_FILE || job.status === ConversionStatus.PARSING_WAV) && <><Spinner className="h-4 w-4" /> <span className="text-slate-300">Preparing...</span></>}
                        {job.status === ConversionStatus.CONVERTING && <><Spinner className="h-4 w-4" /> <span className="text-blue-300">Converting...</span></>}
                        {job.status === ConversionStatus.DONE && job.result?.mp3Url && (
                           <a
                            href={job.result.mp3Url}
                            download={job.result.fileName || `${job.file.name.split('.')[0]}.mp3`}
                            className="text-green-400 hover:text-green-300 font-semibold py-1 px-2 rounded bg-green-500/20 hover:bg-green-500/30 transition-colors"
                            title={`Download ${job.result.fileName}`}
                            >
                            Download MP3
                            </a>
                        )}
                        {job.status === ConversionStatus.ERROR && <span className="text-red-400 font-semibold">Failed</span>}
                    </div>
                    <button 
                        onClick={() => removeFile(job.id)} 
                        disabled={isZipping || (currentConvertingFileId === job.id && isProcessingQueue)}
                        className="text-red-500 hover:text-red-400 p-1 rounded-full hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                        aria-label={`Remove ${job.file.name}`}
                        title="Remove file"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
          {canDownloadAll && (
            <button
              onClick={handleDownloadAllClick}
              disabled={isZipping || typeof JSZip === 'undefined' || isProcessingQueue}
              className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {isZipping ? <Spinner className="h-5 w-5 text-white" /> : `Download All (${successfullyConvertedFiles.length}) (.zip)`}
            </button>
          )}

          {showResetButton && (
             <button
                onClick={handleResetClick}
                className="w-full sm:w-auto bg-slate-500 hover:bg-slate-600 text-slate-100 font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-75"
              >
              Reset All
            </button>
          )}
        </section>

        {(isProcessingQueue || (conversionJobs.length > 0 && !conversionJobs.every(j => j.status === ConversionStatus.IDLE && !currentConvertingFileId)) || hookError ) && !isZipping && (
          <section className="mt-6 p-4 bg-slate-600 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              {isZipping ? "Creating ZIP file..." : 
                (isProcessingQueue && currentFileConvertingName ? 
                `Processing Queue (${filesProcessedInCurrentRun} / ${totalFilesInCurrentRun} files completed)` : 
                (conversionJobs.length > 0 && conversionJobs.every(j => j.status === ConversionStatus.DONE || j.status === ConversionStatus.ERROR) ? 
                  (anyErrorsInLastRun ? "Queue Processed (with errors)" : "Queue Processed Successfully") 
                  : "Queue Status")
              )}
            </h3>
            {isProcessingQueue && currentFileConvertingName && !isZipping && (
              <p className="text-sm text-slate-300">
                Currently converting: <span className='font-semibold'>{currentFileConvertingName}</span>
              </p>
            )}
             {isProcessingQueue && totalFilesInCurrentRun > 0 && !isZipping && (
              <div className="mt-3">
                <ProgressBar progress={overallProgressPercent} statusText={`Overall Queue Progress: ${filesProcessedInCurrentRun} of ${totalFilesInCurrentRun}`} />
              </div>
            )}
            {!isProcessingQueue && !isZipping && conversionJobs.length > 0 && conversionJobs.every(j => j.status === ConversionStatus.DONE || j.status === ConversionStatus.ERROR) && (
                <p className="text-sm text-slate-300">
                    Finished. {successfullyConvertedFiles.length} successful, {conversionJobs.filter(j=>j.status === ConversionStatus.ERROR).length} failed.
                </p>
            )}
             {!isProcessingQueue && hookError && !currentConvertingFileId && !isZipping && ( 
                 <p className="text-sm text-red-400 mt-1">An unexpected error occurred: {hookError}</p>
            )}
          </section>
        )}
        <footer className="text-center text-xs text-slate-500 pt-6">
            Powered by LameJS & JSZip. Conversion and zipping happen entirely in your browser.
        </footer>
      </div>
    </div>
  );
};

export default App;
