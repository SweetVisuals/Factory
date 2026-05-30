import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { parseCSV } from '@/lib/utils/csv';
import { Lead } from '@/types';

interface Props {
  onUpload: (leads: Lead[]) => void;
}

export const LeadUploader: React.FC<Props> = ({ onUpload }) => {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const leads = await parseCSV(file);
      onUpload(leads);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={`border-b border-border p-10 text-center cursor-pointer transition-all duration-300
        ${isDragActive
          ? 'bg-primary/5 border-primary/30'
          : 'bg-muted/10 hover:bg-muted/20'}`}
    >
      <input {...getInputProps()} />
      <div className={`mx-auto h-16 w-16 mb-4 rounded-full flex items-center justify-center transition-colors shadow-sm
        ${isDragActive ? 'bg-primary text-primary-foreground scale-110' : 'bg-card border border-border text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}>
        <Upload size={24} />
      </div>
      <p className="text-base font-bold text-foreground">
        {isDragActive
          ? 'Drop the CSV file now'
          : 'Drag & drop your CSV file here'}
      </p>
      <p className="text-sm font-medium text-muted-foreground mt-2 max-w-[280px] mx-auto">
        Or click to browse your computer. Supports email, name, company, and more.
      </p>
    </div>
  );
};
