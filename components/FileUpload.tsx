import React, { useRef, useState, useCallback, useEffect } from 'react';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void; // Changed from onFileSelect
  disabled: boolean;
  acceptedFileType?: string; // e.g., ".wav" or "audio/wav"
  resetTrigger?: number; // Increment to reset internal state
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFilesSelect, 
  disabled, 
  acceptedFileType = ".wav",
  resetTrigger 
}) => {
  const [selectedFileCount, setSelectedFileCount] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resetTrigger !== undefined && resetTrigger > 0) {
      setSelectedFileCount(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [resetTrigger]);

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      setSelectedFileCount(0);
      onFilesSelect([]); // Notify parent of no files or cleared selection
      return;
    }

    const validFiles: File[] = [];
    const invalidFileNames: string[] = [];

    Array.from(files).forEach(file => {
      if (acceptedFileType) {
        const fileTypeLower = file.type.toLowerCase();
        const fileNameLower = file.name.toLowerCase();
        const acceptedLower = acceptedFileType.toLowerCase();
        const acceptedMimeType = acceptedLower.startsWith('.') ? `audio/${acceptedLower.substring(1)}` : acceptedLower; // e.g. audio/wav
        
        const isNameMatch = fileNameLower.endsWith(acceptedLower);
        const isMimeMatch = fileTypeLower === acceptedMimeType || (acceptedLower === ".wav" && fileTypeLower === "audio/x-wav");


        if (isNameMatch || isMimeMatch) {
          validFiles.push(file);
        } else {
          invalidFileNames.push(file.name);
        }
      } else {
        validFiles.push(file); // No filter, accept all
      }
    });

    if (invalidFileNames.length > 0) {
      alert(`Invalid file type(s) for: ${invalidFileNames.join(', ')}. Please upload ${acceptedFileType} files only.`);
    }
    
    if (validFiles.length > 0) {
      onFilesSelect(validFiles);
      setSelectedFileCount(validFiles.length);
    } else {
      // If all files were invalid but some were dropped/selected
      setSelectedFileCount(0); 
      onFilesSelect([]); // Ensure parent knows no valid files selected
      if (fileInputRef.current) fileInputRef.current.value = ''; // Clear input
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(event.target.files);
  };

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);
  
  const handleDragLeave = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setIsDragging(true); // Keep highlighting if dragged over
  }, [disabled]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    processFiles(event.dataTransfer.files);
    if(fileInputRef.current) fileInputRef.current.value = ''; // Clear the input after drop
  }, [onFilesSelect, disabled, acceptedFileType]); // onFilesSelect is in dependency for processFiles through closure

  const baseBorder = disabled ? 'border-gray-300' : 'border-gray-400';
  const hoverBorder = disabled ? '' : 'hover:border-blue-500';
  const dragBorder = isDragging && !disabled ? 'border-blue-500' : baseBorder;
  const bgColor = disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:bg-gray-50';

  return (
    <div className="w-full">
      <input
        type="file"
        id="file-upload-input-actual"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept={acceptedFileType}
        disabled={disabled}
        multiple // Allow multiple file selection
      />
      <label
        htmlFor="file-upload-input-actual"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg 
                    transition-colors duration-200 ease-in-out
                    ${bgColor} ${dragBorder} ${hoverBorder} ${disabled ? '' : 'cursor-pointer'}`}
        aria-label={`Upload ${acceptedFileType} files. Drag and drop or click to select.`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
          <svg className={`w-10 h-10 mb-3 ${disabled ? 'text-gray-300' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
          <p className={`mb-2 text-sm ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className={`text-xs ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>
            {acceptedFileType ? `${acceptedFileType.toUpperCase()} files` : 'Any file'}
          </p>
          {selectedFileCount > 0 && <p className="mt-2 text-sm text-green-600 font-medium">{selectedFileCount} file(s) selected</p>}
        </div>
      </label>
    </div>
  );
};

export default FileUpload;