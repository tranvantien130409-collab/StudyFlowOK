import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight, 
  Flag, 
  Send, 
  RotateCcw, 
  Award,
  BookOpen,
  BarChart3,
  Target,
  Zap,
  TrendingUp,
  Check,
  XCircle,
  Lightbulb
} from 'lucide-react';
import { ExamItem, QuestionItem, ExamSubmission } from '../types';
import { pad } from '../data/initialData';
import { playChime } from '../utils/audio';

interface TakeExamModalProps {
  exam: ExamItem | null;
  studentName?: string;
  allSubmissions?: ExamSubmission[];
  isPage?: boolean;
  onClose: () => void;
  onSubmitResult: (submission: ExamSubmission) => void;
}

export const TakeExamModal: React.FC<TakeExamModalProps> = ({
  exam,
  studentName,
  allSubmissions = [],
  isPage = false,
  onClose,
  onSubmitResult
}) => {
  const totalQuestions = exam?.questions.length ?? 0;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState((exam?.durationMinutes ?? 45) * 60);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<ExamSubmission | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect'>('all');

  const handleRetakeExam = () => {
    setAnswers({});
    setFlagged({});
    setCurrentIdx(0);
    setSecondsLeft((exam?.durationMinutes ?? 45) * 60);
    setIsSubmitted(false);
    setSubmissionResult(null);
    setConfirmSubmit(false);
    setReviewFilter('all');
    if (isPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isPage && exam) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isPage, exam?.id]);

  // Timer Countdown
  useEffect(() => {
    if (!exam || isSubmitted) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [exam?.id, isSubmitted]);

  if (!exam) return null;

  const currentQ: QuestionItem | undefined = exam.questions[currentIdx];

  const handleSelectOption = (optionIdx: number) => {
    if (isSubmitted || !currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionIdx
    }));
  };

  const handleToggleFlag = () => {
    if (!currentQ) return;
    setFlagged((prev) => ({
      ...prev,
      [currentQ.id]: !prev[currentQ.id]
    }));
  };

  function handleSubmitExam() {
    if (!exam || isSubmitted) return;

    // Calculate score
    let correct = 0;
    exam.questions.forEach((q) => {
      if (answers[q.id] === q.correctOption) {
        correct += 1;
      }
    });

    const score = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 10 * 10) / 10 : 0;
    const timeSpent = Math.max(0, exam.durationMinutes * 60 - secondsLeft);

    const submission: ExamSubmission = {
      id: Date.now(),
      examId: exam.id,
      examTitle: exam.title,
      studentName: studentName?.trim() || 'Học sinh',
      score,
      correctCount: correct,
      totalQuestions,
      submittedAt: new Date().toLocaleString('vi-VN'),
      timeSpentSeconds: timeSpent,
      answers
    };

    setSubmissionResult(submission);
    setIsSubmitted(true);
    onSubmitResult(submission);
    playChime(score >= 5);
    if (isPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const answeredCount = Object.keys(answers).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const timerMin = Math.floor(secondsLeft / 60);
  const timerSec = secondsLeft % 60;

  const outerWrapperClass = isPage
    ? 'w-full relative z-10 sf-panel-enter'
    : 'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#030a18]/80 backdrop-blur-sm sf-panel-enter';

  const cardContainerClass = isPage
    ? 'w-full sf-teacher-surface rounded-3xl flex flex-col overflow-hidden'
    : 'relative w-full max-w-5xl h-[92vh] max-h-[900px] sf-teacher-surface rounded-3xl shadow-2xl flex flex-col overflow-hidden';

  return (
    <div className={outerWrapperClass}>
      <div className={cardContainerClass}>
        {/* Top Deep Navy & Neon Header */}
        <div className="sf-navy-hero-banner relative px-4 sm:px-6 py-4 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
            {isPage && (
              <button
                type="button"
                data-sound="nav"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/25 backdrop-blur-xs text-xs font-display font-bold tracking-wide transition-all duration-150 active:scale-95 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                title="Quay lại trang Thi cử"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-300" />
                <span>BACK</span>
              </button>
            )}

            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/25 via-sky-500/20 to-indigo-500/25 border border-cyan-300/40 text-cyan-200 flex items-center justify-center font-display font-extrabold text-xs shrink-0 shadow-[0_0_20px_-4px_rgba(34,211,238,0.45)]">
              ĐỀ
            </span>

            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-extrabold text-white tracking-tight truncate">
                {exam.title}
              </h2>
              <p className="text-xs text-sky-100/80 truncate mt-0.5">
                <span className="font-semibold text-cyan-300">{exam.subject}</span>
                <span aria-hidden="true" className="mx-1.5 text-cyan-400/50">·</span>
                <span>Thời gian: <span className="font-mono tabular-nums text-white">{exam.durationMinutes}</span> phút</span>
                <span aria-hidden="true" className="mx-1.5 text-cyan-400/50">·</span>
                <span><span className="font-mono tabular-nums text-white">{totalQuestions}</span> câu hỏi</span>
              </p>
            </div>
          </div>

          {/* Right Controls: Timer & Submit button */}
          <div className="relative z-10 flex items-center gap-2.5 shrink-0">
            {!isSubmitted ? (
              <>
                <div
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-mono tabular-nums text-xs font-bold border backdrop-blur-xs transition-colors duration-150 ${
                    secondsLeft <= 300
                      ? 'bg-rose-500/20 text-rose-200 border-rose-400/50 shadow-[0_0_18px_-4px_rgba(244,63,94,0.6)] animate-pulse'
                      : 'bg-white/10 text-cyan-100 border-white/20'
                  }`}
                >
                  <Clock className={`w-4 h-4 ${secondsLeft <= 300 ? 'text-rose-300' : 'text-cyan-300'}`} />
                  <span>{pad(timerMin)}:{pad(timerSec)}</span>
                </div>

                {confirmSubmit ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#041127]/90 border border-cyan-400/40 shadow-[0_0_20px_-6px_rgba(34,211,238,0.5)]">
                    <span className="text-xs font-bold text-cyan-100 whitespace-nowrap font-mono tabular-nums">
                      Nộp ({answeredCount}/{totalQuestions})?
                    </span>
                    <button
                      type="button"
                      data-sound="success"
                      onClick={() => {
                        setConfirmSubmit(false);
                        handleSubmitExam();
                      }}
                      className="sf-neon-cta px-3 py-1.5 rounded-lg font-display text-xs font-bold transition-all duration-150 active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Xác nhận
                    </button>
                    <button
                      type="button"
                      data-sound="tap"
                      onClick={() => setConfirmSubmit(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sky-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-sound="tap"
                    onClick={() => setConfirmSubmit(true)}
                    className="sf-neon-cta min-h-[38px] flex items-center gap-1.5 px-4 py-2 rounded-xl font-display text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Nộp bài</span>
                  </button>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200 px-3.5 py-1.5 bg-emerald-500/20 border border-emerald-400/40 rounded-xl whitespace-nowrap">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                <span>Đã nộp bài</span>
              </span>
            )}

            {!isPage && (
              <button
                type="button"
                data-sound="tap"
                onClick={onClose}
                aria-label="Đóng bài thi"
                className="p-2 text-sky-200/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Live Completion Progress Hairline */}
          {!isSubmitted && (
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 transition-[width] duration-200 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Content Body */}
        {!isSubmitted ? (
          <div className={`flex-1 flex flex-col lg:flex-row ${isPage ? 'min-h-[540px]' : 'overflow-hidden'}`}>
            {/* Left Main Question Pane */}
            <div className={`flex-1 p-5 sm:p-7 flex flex-col justify-between bg-white/75 dark:bg-[#07132a]/85 ${isPage ? '' : 'overflow-y-auto'}`}>
              {currentQ ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-slate-200/75 dark:border-cyan-400/15">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xs font-bold text-sky-700 dark:text-cyan-300 font-mono tabular-nums">
                        Câu hỏi {currentIdx + 1} / {totalQuestions}
                      </span>
                      {answers[currentQ.id] !== undefined && (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Đã chọn đáp án</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      data-sound="toggle"
                      aria-pressed={!!flagged[currentQ.id]}
                      onClick={handleToggleFlag}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                        flagged[currentQ.id]
                          ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 font-bold border-amber-300 dark:border-amber-400/45 shadow-[0_0_16px_-6px_rgba(245,158,11,0.45)]'
                          : 'bg-white/70 dark:bg-white/5 border-slate-200/80 dark:border-cyan-400/15 text-slate-600 dark:text-slate-300 hover:border-amber-300 dark:hover:border-amber-400/40'
                      }`}
                    >
                      <Flag className={`w-3.5 h-3.5 ${flagged[currentQ.id] ? 'fill-amber-400 text-amber-500' : ''}`} />
                      <span>{flagged[currentQ.id] ? 'Đã đánh dấu xem lại' : 'Đánh dấu câu này'}</span>
                    </button>
                  </div>

                  {/* Question Text */}
                  <div className="font-display text-base sm:text-[18px] font-bold text-slate-900 dark:text-white leading-relaxed tracking-tight">
                    {currentQ.questionText}
                  </div>

                  {/* Tactile Option Cards */}
                  <div className="space-y-3 pt-1">
                    {currentQ.options.map((opt, oIdx) => {
                      const isSelected = answers[currentQ.id] === oIdx;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          data-sound="tap"
                          onClick={() => handleSelectOption(oIdx)}
                          className={`sf-teacher-tile w-full text-left p-4 rounded-2xl border text-sm transition-all duration-150 active:scale-[0.99] flex items-start gap-3.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                            isSelected
                              ? '!bg-[#081b3d] dark:!bg-cyan-400/15 !border-[#081b3d] dark:!border-cyan-400/75 text-white dark:text-cyan-50 font-semibold shadow-[0_12px_26px_-12px_rgba(8,27,61,0.55)] dark:shadow-[0_0_24px_-8px_rgba(34,211,238,0.55)]'
                              : 'text-slate-700 dark:text-slate-200 hover:border-sky-400/65 dark:hover:border-cyan-400/45'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-display font-extrabold text-xs shrink-0 mt-0.5 transition-colors duration-150 ${
                              isSelected
                                ? 'bg-cyan-400 text-[#031126] shadow-[0_0_12px_-2px_rgba(34,211,238,0.8)]'
                                : 'bg-slate-100 dark:bg-[#050f24] text-slate-600 dark:text-cyan-300 border border-slate-200/80 dark:border-cyan-400/20'
                            }`}
                          >
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="flex-1 leading-relaxed">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400">Không có câu hỏi trong đề này.</div>
              )}

              {/* Prev / Next Bottom Toolbar */}
              <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-200/75 dark:border-cyan-400/15 mt-8">
                <button
                  type="button"
                  data-sound="nav"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  className="sf-teacher-tile min-h-[40px] flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Câu trước</span>
                </button>

                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  Đã trả lời <strong className="text-slate-900 dark:text-white">{answeredCount}</strong> / {totalQuestions}
                </span>

                <button
                  type="button"
                  data-sound="nav"
                  disabled={currentIdx >= totalQuestions - 1}
                  onClick={() => setCurrentIdx((i) => Math.min(totalQuestions - 1, i + 1))}
                  className="min-h-[40px] flex items-center gap-1.5 px-4 py-2 font-display text-xs font-bold rounded-xl bg-[#081b3d] hover:bg-[#0d2754] dark:bg-gradient-to-r dark:from-cyan-400 dark:to-sky-400 dark:hover:brightness-110 text-white dark:text-[#031126] disabled:opacity-40 disabled:pointer-events-none transition-all duration-150 active:scale-[0.98] shadow-[0_6px_18px_-6px_rgba(8,27,61,0.45)] dark:shadow-[0_0_20px_-6px_rgba(34,211,238,0.6)] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Câu tiếp theo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Question Palette / Navigation Grid */}
            <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-cyan-400/15 bg-slate-50/75 dark:bg-[#050e20]/85 p-5 shrink-0 flex flex-col justify-between">
              <div>
                <h3 className="font-display text-xs font-bold text-slate-700 dark:text-cyan-100 mb-3 flex items-center justify-between">
                  <span>Danh sách câu hỏi</span>
                  <span className="font-mono tabular-nums text-sky-600 dark:text-cyan-300">
                    {answeredCount}/{totalQuestions}
                  </span>
                </h3>

                <div className="grid grid-cols-5 gap-2 max-h-80 md:max-h-none overflow-y-auto p-1">
                  {exam.questions.map((q, idx) => {
                    const isAnswered = answers[q.id] !== undefined;
                    const isCurrent = currentIdx === idx;
                    const isFlag = flagged[q.id];

                    return (
                      <button
                        key={q.id}
                        type="button"
                        data-sound="nav"
                        onClick={() => setCurrentIdx(idx)}
                        className={`h-9 rounded-xl text-xs font-bold font-mono tabular-nums relative transition-all duration-150 active:scale-90 flex items-center justify-center cursor-pointer ${
                          isCurrent
                            ? 'ring-2 ring-sky-500 dark:ring-cyan-400 ring-offset-2 ring-offset-slate-50 dark:ring-offset-[#050e20] scale-105'
                            : ''
                        } ${
                          isAnswered
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_4px_12px_-4px_rgba(16,185,129,0.55)]'
                            : isFlag
                            ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-400/50'
                            : 'bg-white dark:bg-[#0b1c3d] text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-cyan-400/20 hover:border-sky-400 dark:hover:border-cyan-400/60'
                        }`}
                      >
                        {idx + 1}
                        {isFlag && (
                          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.9)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-cyan-400/15 space-y-2 text-[11px] text-slate-500 dark:text-slate-400 mt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-gradient-to-br from-emerald-500 to-teal-500" />
                    <span>Đã trả lời</span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                    {answeredCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-amber-100 dark:bg-amber-500/25 border border-amber-400" />
                    <span>Đánh dấu xem lại</span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                    {Object.values(flagged).filter(Boolean).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-white dark:bg-[#0b1c3d] border border-slate-300 dark:border-cyan-400/30" />
                    <span>Chưa làm</span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                    {totalQuestions - answeredCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Submission Results & Review View */
          <div className={isPage ? 'p-5 sm:p-8 space-y-6 sf-panel-enter' : 'flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 sf-panel-enter'}>
            {(() => {
              const myScore = submissionResult?.score ?? 0;
              const myCorrect = submissionResult?.correctCount ?? 0;
              const myTime = submissionResult?.timeSpentSeconds ?? 0;
              const accuracyPct = totalQuestions > 0 ? Math.round((myCorrect / totalQuestions) * 100) : 0;
              const secPerQuestion = totalQuestions > 0 ? Math.round(myTime / totalQuestions) : 0;
              const tierLabel =
                myScore >= 8
                  ? 'Giỏi / Xuất sắc'
                  : myScore >= 6.5
                  ? 'Khá'
                  : myScore >= 5
                  ? 'Đạt chuẩn'
                  : 'Cần củng cố';

              const examSubs = allSubmissions.filter((s) => s.examId === exam.id);
              const peerPool = examSubs.some((s) => s.id === submissionResult?.id)
                ? examSubs
                : submissionResult
                ? [submissionResult, ...examSubs]
                : examSubs;
              const peerAvg =
                peerPool.length > 0
                  ? Math.round((peerPool.reduce((sum, s) => sum + s.score, 0) / peerPool.length) * 10) / 10
                  : myScore;
              const delta = Math.round((myScore - peerAvg) * 10) / 10;

              const bracketCounts = Array.from({ length: 10 }, (_, idx) => {
                const min = idx;
                const max = idx + 1;
                const isLast = idx === 9;
                return peerPool.filter((s) =>
                  isLast ? s.score >= min && s.score <= max : s.score >= min && s.score < max
                ).length;
              });
              const maxBracket = Math.max(1, ...bracketCounts);
              const myBracketIdx = Math.min(9, Math.max(0, Math.floor(myScore === 10 ? 9 : myScore)));

              return (
                <div className="space-y-4">
                  {/* Top Luxury Score Banner */}
                  <div className="sf-navy-hero-banner rounded-3xl text-white p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 mb-1.5">
                        <Award className="w-4 h-4 text-amber-300" />
                        <span>Kết quả &amp; Phân tích bài làm · {submissionResult?.studentName}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="font-display text-4xl sm:text-5xl font-extrabold font-mono tabular-nums tracking-tight text-white">
                          {myScore.toFixed(1)}
                        </span>
                        <span className="text-sm font-semibold text-cyan-200/85">/ 10 điểm</span>
                      </div>
                      <p className="text-xs sm:text-sm text-sky-100/85 mt-2">
                        Đúng <strong className="text-white font-mono tabular-nums">{myCorrect}/{totalQuestions}</strong> câu · Thời gian:{' '}
                        <span className="font-mono tabular-nums text-cyan-200">
                          {Math.floor(myTime / 60)}p {pad(myTime % 60)}s
                        </span>
                      </p>
                    </div>

                    {/* Mini Score Distribution Comparison — Luminous Atelier Spectrum */}
                    <div className="sm:w-76 shrink-0 sf-spectrum-stage-student rounded-2xl p-3.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-cyan-200 mb-2">
                        <span className="flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-cyan-300" />
                          <span>Vị trí phổ điểm ({peerPool.length} lượt)</span>
                        </span>
                        <span className="font-mono tabular-nums text-amber-300 font-bold">TB: {peerAvg.toFixed(1)}</span>
                      </div>
                      <div className="h-16 flex items-end gap-1 pt-1 relative">
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-rose-400/40 via-amber-300/45 via-sky-400/50 to-emerald-300/55"
                        />
                        {bracketCounts.map((c, idx) => {
                          const hPct = c > 0 ? Math.max(20, Math.round((c / maxBracket) * 100)) : 8;
                          const isMine = idx === myBracketIdx;
                          const tierClass =
                            idx >= 8
                              ? 'from-emerald-600 via-emerald-400 to-teal-200'
                              : idx >= 6
                              ? 'from-blue-700 via-sky-400 to-cyan-200'
                              : idx >= 5
                              ? 'from-amber-600 via-amber-400 to-yellow-200'
                              : 'from-rose-700 via-rose-500 to-pink-300';
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                              <div
                                title={`Mốc ${idx}–${idx + 1}: ${c} bài`}
                                style={{ height: `${hPct}%` }}
                                className={`w-full rounded-t transition-all ${
                                  isMine
                                    ? `sf-bar-glint bg-gradient-to-t ${tierClass} ring-1.5 ring-white/90 shadow-[0_0_16px_rgba(34,211,238,0.85)]`
                                    : c > 0
                                    ? `bg-gradient-to-t ${tierClass} opacity-45 hover:opacity-80`
                                    : 'bg-white/10'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-300 mt-1.5">
                        <span>0</span>
                        <span className="text-cyan-200 font-bold">Mốc của bạn: {myBracketIdx}–{myBracketIdx + 1}</span>
                        <span>10</span>
                      </div>
                    </div>
                  </div>

                  {/* 4 Interactive KPI Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    <button
                      type="button"
                      data-sound="toggle"
                      onClick={() => setReviewFilter(reviewFilter === 'correct' ? 'all' : 'correct')}
                      className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
                        reviewFilter === 'correct' ? 'ring-1.5 ring-sky-500 dark:ring-cyan-400' : ''
                      }`}
                    >
                      <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Độ chính xác</span>
                        <Target className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
                      </div>
                      <div className="font-display text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
                        {accuracyPct}%
                      </div>
                    </button>

                    <div className="sf-teacher-kpi p-4 rounded-2xl">
                      <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-indigo-400 via-sky-500 to-cyan-400" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tốc độ trung bình</span>
                        <Zap className="w-4 h-4 text-indigo-600 dark:text-sky-400 shrink-0" />
                      </div>
                      <div className="font-display text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
                        {secPerQuestion}s / câu
                      </div>
                    </div>

                    <div className="sf-teacher-kpi p-4 rounded-2xl">
                      <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Xếp loại năng lực</span>
                        <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      </div>
                      <div
                        className={`font-display text-lg font-extrabold mt-1.5 ${
                          myScore >= 8
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : myScore >= 6.5
                            ? 'text-sky-600 dark:text-cyan-300'
                            : myScore >= 5
                            ? 'text-amber-600 dark:text-amber-300'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {tierLabel}
                      </div>
                    </div>

                    <div className="sf-teacher-kpi p-4 rounded-2xl">
                      <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">So với TB đề</span>
                        <TrendingUp className="w-4 h-4 text-amber-500 shrink-0" />
                      </div>
                      <div
                        className={`font-display text-2xl font-extrabold font-mono tabular-nums mt-1.5 ${
                          delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}đ
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Answer Key & Explanations Review */}
            {(() => {
              const correctQuestionsCount = exam.questions.filter((q) => answers[q.id] === q.correctOption).length;
              const incorrectQuestionsCount = totalQuestions - correctQuestionsCount;
              const filteredReviewQuestions = exam.questions
                .map((q, idx) => ({ q, idx }))
                .filter(({ q }) => {
                  const isCorrect = answers[q.id] === q.correctOption;
                  if (reviewFilter === 'correct') return isCorrect;
                  if (reviewFilter === 'incorrect') return !isCorrect;
                  return true;
                });

              return (
                <div className="space-y-4">
                  {/* Interactive Review Header & Filter Toolbar */}
                  <div className="sf-teacher-surface rounded-2xl p-4 sm:p-5 space-y-3.5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#081b3d] dark:bg-cyan-400/15 border border-cyan-400/35 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 text-cyan-300" />
                        </div>
                        <div>
                          <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                            Đáp án chi tiết và Lời giải thích
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Đối chiếu từng câu hỏi, xem đáp án chuẩn và lời giải chuyên sâu
                          </p>
                        </div>
                      </div>

                      {/* Segmented Review Filter */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            { id: 'all', label: 'Tất cả', count: totalQuestions },
                            { id: 'correct', label: 'Làm đúng', count: correctQuestionsCount },
                            { id: 'incorrect', label: 'Chưa đúng', count: incorrectQuestionsCount }
                          ] as const
                        ).map((tab) => {
                          const active = reviewFilter === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              data-sound="toggle"
                              onClick={() => setReviewFilter(tab.id)}
                              className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
                                active
                                  ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-xs'
                                  : 'bg-slate-100/85 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/75 dark:hover:bg-white/10'
                              }`}
                            >
                              <span>{tab.label}</span>
                              <span
                                className={`font-mono tabular-nums text-[11px] ${
                                  active ? 'opacity-85' : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                ({tab.count})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Jump Dots Strip */}
                    {exam.questions.length > 1 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-slate-200/70 dark:border-cyan-400/10">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                          Đi tới nhanh:
                        </span>
                        {exam.questions.map((q, idx) => {
                          const isCorrect = answers[q.id] === q.correctOption;
                          return (
                            <button
                              key={q.id}
                              type="button"
                              data-sound="nav"
                              onClick={() => {
                                if (reviewFilter !== 'all') setReviewFilter('all');
                                window.setTimeout(() => {
                                  document
                                    .getElementById(`review-question-${q.id}`)
                                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 40);
                              }}
                              className={`w-7 h-7 rounded-lg text-[11px] font-bold font-mono tabular-nums border transition-all duration-150 active:scale-90 cursor-pointer flex items-center justify-center ${
                                isCorrect
                                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300/80 dark:border-emerald-400/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                                  : 'bg-rose-50 dark:bg-rose-500/15 border-rose-300/80 dark:border-rose-400/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                              }`}
                              title={`Câu ${idx + 1}: ${isCorrect ? 'Chính xác' : 'Chưa đúng'}`}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Review Cards List */}
                  {filteredReviewQuestions.length > 0 ? (
                    <div className="space-y-4">
                      {filteredReviewQuestions.map(({ q, idx }) => {
                        const studentChoice = answers[q.id];
                        const isCorrect = studentChoice === q.correctOption;
                        const pointPerQ =
                          totalQuestions > 0 ? (10 / totalQuestions).toFixed(2).replace(/\.?0+$/, '') : '0';

                        return (
                          <article
                            id={`review-question-${q.id}`}
                            key={q.id}
                            className="sf-teacher-tile group relative overflow-hidden rounded-3xl p-5 sm:p-6 transition-all duration-150"
                          >
                            {/* Top Neon Hairline */}
                            <span
                              className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${
                                isCorrect
                                  ? 'from-emerald-400 via-teal-400 to-cyan-400'
                                  : 'from-rose-400 via-pink-500 to-amber-400'
                              }`}
                            />

                            {/* Card Header: Deep Navy Question Pill & Result Status */}
                            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#081b3d] dark:bg-cyan-400/15 text-cyan-300 border border-cyan-400/35 font-display text-xs font-extrabold font-mono tabular-nums shadow-[0_4px_12px_-6px_rgba(8,27,61,0.5)]">
                                Câu {String(idx + 1).padStart(2, '0')}
                              </span>

                              <span
                                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl border font-mono tabular-nums ${
                                  isCorrect
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/35'
                                    : 'bg-rose-50 text-rose-700 border-rose-200/90 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-400/35'
                                }`}
                              >
                                {isCorrect ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 shrink-0" />
                                    <span>Chính xác (+{pointPerQ} điểm)</span>
                                  </>
                                ) : studentChoice !== undefined ? (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>Chưa đúng</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    <span>Chưa trả lời</span>
                                  </>
                                )}
                              </span>
                            </div>

                            {/* Question Prompt */}
                            <p className="font-display text-base sm:text-[17px] font-bold text-slate-900 dark:text-white mb-4 leading-relaxed tracking-tight">
                              {q.questionText}
                            </p>

                            {/* Options Breakdown */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-[13px]">
                              {q.options.map((opt, oIdx) => {
                                const isKey = oIdx === q.correctOption;
                                const isStudentSelected = oIdx === studentChoice;

                                return (
                                  <div
                                    key={oIdx}
                                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2.5 transition-all duration-150 ${
                                      isKey
                                        ? 'border-emerald-500/70 bg-gradient-to-r from-emerald-500/12 via-teal-500/8 to-cyan-500/10 dark:from-emerald-500/20 dark:to-cyan-500/12 text-emerald-950 dark:text-emerald-100 font-semibold shadow-[0_8px_20px_-10px_rgba(16,185,129,0.45)]'
                                        : isStudentSelected
                                        ? 'border-rose-500/65 bg-rose-500/10 dark:bg-rose-500/15 text-rose-950 dark:text-rose-200 font-semibold'
                                        : 'border-slate-200/80 dark:border-cyan-400/15 bg-white/85 dark:bg-[#050f24]/85 text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span
                                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-display font-extrabold text-[11px] shrink-0 ${
                                          isKey
                                            ? 'bg-emerald-500 text-white shadow-[0_0_12px_-2px_rgba(16,185,129,0.75)]'
                                            : isStudentSelected
                                            ? 'bg-rose-500 text-white shadow-[0_0_12px_-2px_rgba(244,63,94,0.7)]'
                                            : 'bg-slate-100 dark:bg-[#0b1c3d] text-slate-600 dark:text-cyan-300 border border-slate-200/80 dark:border-cyan-400/20'
                                        }`}
                                      >
                                        {String.fromCharCode(65 + oIdx)}
                                      </span>
                                      <span className="leading-snug">{opt}</span>
                                    </div>

                                    {isKey && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
                                        <Check className="w-3.5 h-3.5" />
                                        <span className="hidden md:inline">Đáp án đúng</span>
                                      </span>
                                    )}
                                    {!isKey && isStudentSelected && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-300 whitespace-nowrap shrink-0">
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span className="hidden md:inline">Bạn chọn</span>
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Signature Deep Navy & Neon Explanation Box */}
                            {q.explanation && (
                              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-[#071a3c] via-[#0c2654] to-[#08224a] text-sky-50 border border-cyan-400/30 shadow-[0_12px_28px_-14px_rgba(8,27,61,0.65)] text-xs leading-relaxed">
                                <div className="flex items-center gap-2 font-display font-bold text-cyan-300 mb-1.5">
                                  <span className="w-6 h-6 rounded-lg bg-cyan-400/15 border border-cyan-300/35 flex items-center justify-center shrink-0">
                                    <Lightbulb className="w-3.5 h-3.5 text-cyan-300" />
                                  </span>
                                  <span>Lời giải chi tiết</span>
                                </div>
                                <p className="text-sky-100/90 pl-8">{q.explanation}</p>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="sf-teacher-surface rounded-2xl py-10 px-6 text-center space-y-2">
                      <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                        Không có câu hỏi nào thuộc nhóm lọc này
                      </p>
                      <button
                        type="button"
                        data-sound="tap"
                        onClick={() => setReviewFilter('all')}
                        className="sf-neon-cta px-4 py-2 rounded-xl font-display text-xs font-bold cursor-pointer mt-2"
                      >
                        Hiển thị tất cả {totalQuestions} câu
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Bottom Close / Retake / Back */}
            <div className="pt-4 border-t border-slate-200/75 dark:border-cyan-400/15 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                data-sound="nav"
                onClick={handleRetakeExam}
                className="sf-teacher-tile min-h-[42px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-xs font-bold text-slate-800 dark:text-cyan-200 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                <span>Làm lại đề này</span>
              </button>

              <button
                type="button"
                data-sound="nav"
                onClick={onClose}
                className="sf-neon-cta min-h-[42px] inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-display text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isPage && <ArrowLeft className="w-4 h-4" />}
                <span>{isPage ? 'BACK · Quay lại trang Thi cử' : 'Hoàn tất & Đóng'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
