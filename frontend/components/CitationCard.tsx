'use client';

import { Citation } from '@/lib/api';

interface Props {
  citation: Citation;
  index: number;
}

export default function CitationCard({ citation, index }: Props) {
  return (
    <div className="bg-[#1c1e2e] border border-[#2a2d3e] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-[#3ecf8e]/20 text-[#3ecf8e] text-xs font-semibold px-2 py-0.5 rounded-full">
          [{index + 1}]
        </span>
        <span className="text-[#9ca3af] text-sm">
          {citation.filename}
          {citation.page_number ? ` · p.${citation.page_number}` : ''}
        </span>
      </div>
      <pre className="text-xs text-[#9ca3af] font-mono whitespace-pre-wrap break-words leading-relaxed">
        {citation.content}
      </pre>
    </div>
  );
}
