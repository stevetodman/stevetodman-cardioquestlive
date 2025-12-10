/**
 * Question section for participant view.
 * Displays MCQ with answer options, scoring info, and results.
 */

import React from "react";
import { Question } from "../../types";

export interface QuestionSectionProps {
  question: Question;
  isActive: boolean;
  showResults: boolean;
  selectedChoice: number | null;
  submitting: boolean;
  submitError: string | null;
  onSelectChoice: (index: number) => void;
}

export function QuestionSection({
  question,
  isActive,
  showResults,
  selectedChoice,
  submitting,
  submitError,
  onSelectChoice,
}: QuestionSectionProps) {
  return (
    <section id="question-section" className="scroll-mt-20 animate-slide-up">
      <div className="sr-only" aria-live="polite">
        {isActive
          ? "Question open for answers"
          : showResults
          ? "Results are shown"
          : "Waiting for presenter to open question"}
      </div>
      <h3 className="text-xs font-bold text-sky-500 uppercase tracking-wider mb-2 flex items-center gap-2">
        {isActive ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Active Question
          </>
        ) : (
          <span className="text-slate-500">Wait for presenter...</span>
        )}
      </h3>

      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-lg relative overflow-hidden">
        {!isActive && !showResults && (
          <div className="mb-3 flex items-center gap-2 text-xs text-amber-200 bg-amber-900/30 border border-amber-800 rounded-lg px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" aria-hidden="true"></span>
            Waiting for presenter to open this question
          </div>
        )}
        <p className="text-sm font-semibold mb-4 leading-relaxed">
          {question.stem}
        </p>
        <ScoringInfo difficulty={question.difficulty} />
        <div className="grid grid-cols-1 gap-3 relative z-10">
          {question.options.map((opt, i) => (
            <AnswerButton
              key={i}
              index={i}
              text={opt}
              isSelected={selectedChoice === i}
              isCorrect={showResults && i === question.correctIndex}
              disabled={submitting || (!isActive && !showResults)}
              onClick={() => onSelectChoice(i)}
            />
          ))}
        </div>

        {showResults && (
          <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-900/50 rounded-lg animate-fade-in">
            <p className="text-xs text-emerald-400 font-semibold">
              Correct Answer: {String.fromCharCode(65 + (question.correctIndex ?? 0))}
            </p>
          </div>
        )}

        <StatusIndicator
          selectedChoice={selectedChoice}
          showResults={showResults}
          isActive={isActive}
        />
        {submitError && (
          <div className="mt-3 text-center text-xs text-rose-300">
            {submitError}
          </div>
        )}
      </div>
    </section>
  );
}

function ScoringInfo({ difficulty }: { difficulty?: string }) {
  const multiplier =
    difficulty === "hard" ? "1.6x" : difficulty === "medium" ? "1.3x" : "1.0x";

  return (
    <div className="mb-3 text-[11px] text-slate-400 bg-slate-800/40 border border-slate-800 rounded-lg px-3 py-2">
      Scoring: first answer counts. Base 100 × difficulty {multiplier} with
      streak bonus for consecutive correct answers (x1.1, x1.2, x1.5).
    </div>
  );
}

interface AnswerButtonProps {
  index: number;
  text: string;
  isSelected: boolean;
  isCorrect: boolean;
  disabled: boolean;
  onClick: () => void;
}

function AnswerButton({
  index,
  text,
  isSelected,
  isCorrect,
  disabled,
  onClick,
}: AnswerButtonProps) {
  const motionAware = "transform-gpu transition-transform";
  let btnClass = "border-slate-700 bg-slate-900/80 hover:bg-slate-800/80";

  if (isSelected) {
    btnClass = `border-sky-500 bg-sky-500/15 text-sky-100 ring-1 ring-sky-500/50 motion-safe:animate-select-pop ${motionAware}`;
  }
  if (isCorrect) {
    btnClass = `border-emerald-500 bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/50 motion-safe:animate-correct-pulse ${motionAware}`;
  }
  if (disabled && !isSelected && !isCorrect) {
    btnClass = "opacity-70 cursor-not-allowed border-slate-800 bg-slate-900/70";
  }

  return (
    <button
      type="button"
      data-testid={`answer-option-${index}`}
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 text-base sm:text-lg transition-all duration-200 relative overflow-hidden group whitespace-normal break-words leading-tight shadow-sm ${btnClass}`}
    >
      <div className="flex items-start gap-3 relative z-10">
        <span
          className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors ${
            isSelected ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-400"
          } ${isCorrect ? "!bg-emerald-500 !text-white" : ""}`}
        >
          {String.fromCharCode(65 + index)}
        </span>
        <span className="leading-snug">{text}</span>
      </div>
    </button>
  );
}

interface StatusIndicatorProps {
  selectedChoice: number | null;
  showResults: boolean;
  isActive: boolean;
}

function StatusIndicator({ selectedChoice, showResults, isActive }: StatusIndicatorProps) {
  return (
    <div className="mt-4 flex justify-center">
      {selectedChoice !== null && !showResults && (
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-900/40 border border-sky-800 rounded-full text-xs text-sky-300 font-medium animate-fade-in">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Answer Recorded
        </div>
      )}

      {!isActive && !showResults && (
        <div className="text-xs text-center text-slate-500 italic">
          Waiting for presenter to open voting...
        </div>
      )}
    </div>
  );
}

export function QuestionPlaceholder() {
  return (
    <div className="py-8 text-center text-slate-500 text-sm bg-slate-900/50 rounded-xl border border-slate-900 border-dashed">
      Waiting for the next question.
    </div>
  );
}
