'use client';

import { Citation } from '@/lib/api';

interface Props {
  citation: Citation;
  index: number;
}

export default function CitationCard({ citation, index }: Props) {
  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-white/10 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
          [{index + 1}]
        </span>
        <span className="text-[#6b6b6b] text-sm">
          {citation.filename}
          {citation.page_number ? ` · p.${citation.page_number}` : ''}
        </span>
      </div>
      <pre className="text-xs text-[#6b6b6b] font-mono whitespace-pre-wrap break-words leading-relaxed">
        {citation.content}
      </pre>
    </div>
  );
}
