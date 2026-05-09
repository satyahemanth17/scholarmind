'use client';

import { useState } from 'react';
import { QuizQuestion } from '@/lib/api';

interface Props {
  question: QuizQuestion;
  index: number;
  onAnswer?: (correct: boolean) => void;
}

export default function QuizCard({ question, index, onAnswer }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(opt: string) {
    if (selected) return;
    setSelected(opt);
    onAnswer?.(opt === question.answer);
  }

  // Strip leading "A) " / "A. " prefixes in case the backend included them
  function displayText(opt: string) {
    return opt.replace(/^[A-Da-d][.)]\s*/, '');
  }

  return (
    <div className="bg-[#1c1e2e] border border-[#2a2d3e] rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-[#3ecf8e]/20 text-[#3ecf8e] text-xs font-semibold px-2.5 py-0.5 rounded-full">
          Q{index + 1}
        </span>
      </div>
      <p className="text-white font-medium mb-4">{question.question}</p>
      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const label = String.fromCharCode(65 + i);
          const isCorrect = opt === question.answer;
          const isSelected = selected === opt;

          let optClass = 'border border-[#2a2d3e] text-[#9ca3af] hover:border-[#3ecf8e] hover:text-white';
          if (selected) {
            if (isCorrect) optClass = 'border border-[#3ecf8e] bg-[#3ecf8e]/10 text-[#3ecf8e]';
            else if (isSelected) optClass = 'border border-red-500 bg-red-500/10 text-red-400';
            else optClass = 'border border-[#2a2d3e] text-[#9ca3af] opacity-50';
          }

          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              disabled={!!selected}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors cursor-pointer disabled:cursor-default ${optClass}`}
            >
              <span className="font-mono font-bold mr-2">{label}.</span>
              {displayText(opt)}
            </button>
          );
        })}
      </div>
      {selected && (
        <>
          <p className={`mt-3 text-xs font-medium ${selected === question.answer ? 'text-[#3ecf8e]' : 'text-red-400'}`}>
            {selected === question.answer ? 'Correct!' : `Incorrect — answer: ${displayText(question.answer)}`}
          </p>
          {question.explanation && (
            <p className="mt-2 text-xs text-[#9ca3af] bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 leading-relaxed">
              {question.explanation}
            </p>
          )}
        </>
      )}
    </div>
  );
}
