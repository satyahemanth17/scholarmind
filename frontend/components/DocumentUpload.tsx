'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { uploadDocument, UploadResult } from '@/lib/api';

interface Props {
  userId: string;
  onUploadSuccess: (result: UploadResult, filename: string) => void;
}

export default function DocumentUpload({ userId, onUploadSuccess }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.pdf')) {
      setError('Only PDF files are supported');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await uploadDocument(file, userId);
      onUploadSuccess(result, file.name);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`
        bg-[#141414] border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
        transition-colors select-none
        ${dragOver ? 'border-white bg-white/5' : 'border-[#2a2a2a] hover:border-white/30'}
        ${uploading ? 'pointer-events-none opacity-70' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={onInputChange}
      />
      <div className="flex flex-col items-center gap-3">
        <svg className={`w-10 h-10 ${dragOver ? 'text-white' : 'text-[#6b6b6b]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {uploading ? (
          <div className="flex items-center gap-2 text-white">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Uploading...</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-white font-medium">Drop PDF here or click to upload</p>
            <p className="text-xs text-[#6b6b6b]">PDF files only</p>
          </>
        )}
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    </div>
  );
}
