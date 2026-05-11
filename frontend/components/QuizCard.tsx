'use client';

import { useState } from 'react';
import { QuizQuestion } from '@/lib/api';

interface Props {
  question: QuizQuestion;
  index: number;
  onAnswer?: (correct: boolean) => void;
  selectedAnswer?: string;
  onSelect?: (opt: string) => void;
}

export default function QuizCard({ question, index, onAnswer, selectedAnswer: controlledSelected, onSelect }: Props) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selected = controlledSelected ?? internalSelected;

  function handleSelect(opt: string) {
    if (selected) return;
    if (onSelect) {
      onSelect(opt);
    } else {
      setInternalSelected(opt);
    }
    onAnswer?.(opt === question.answer);
  }

  function displayText(opt: string) {
    return opt.replace(/^[A-Da-d][.)]\s*/, '');
  }

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-white/10 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
          Q{index + 1}
        </span>
      </div>
      <p className="text-white font-medium mb-4">{question.question}</p>
      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const label = String.fromCharCode(65 + i);
          const isCorrect = opt === question.answer;
          const isSelected = selected === opt;

          let optClass = 'border border-[#2a2a2a] text-[#6b6b6b] hover:border-white/40 hover:text-white';
          if (selected) {
            if (isCorrect) optClass = 'border border-white bg-white/10 text-white';
            else if (isSelected) optClass = 'border border-red-500 bg-red-500/10 text-red-400';
            else optClass = 'border border-[#2a2a2a] text-[#6b6b6b] opacity-50';
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
          <p className={`mt-3 text-xs font-medium ${selected === question.answer ? 'text-white' : 'text-red-400'}`}>
            {selected === question.answer ? 'Correct!' : `Incorrect — answer: ${displayText(question.answer)}`}
          </p>
          {question.explanation && (
            <p className="mt-2 text-xs text-[#6b6b6b] bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 leading-relaxed">
              {question.explanation}
            </p>
          )}
        </>
      )}
    </div>
  );
}
