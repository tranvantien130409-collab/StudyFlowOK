import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Filter,
  KeyRound,
  PenLine,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Undo2,
  Wand2
} from 'lucide-react';
import { QuestionItem, TeacherClass } from '../types';

export interface QuestionAuditResult {
  missingText: boolean;
  tooFewOptions: boolean;
  incompleteOptions: boolean;
  invalidCorrect: boolean;
  missingExplanation: boolean;
  hasError: boolean;
  hasWarning: boolean;
  messages: string[];
}

export function stripOptionPrefix(opt: string): string {
  return opt.replace(/^\s*[A-Da-d]\s*[.):\-]\s*/, '').trim();
}

export function auditQuestion(q: QuestionItem): QuestionAuditResult {
  const missingText = !q.questionText.trim();
  const nonEmptyCount = q.options.filter((opt) => stripOptionPrefix(opt).length > 0).length;
  const tooFewOptions = nonEmptyCount < 2;
  const incompleteOptions = nonEmptyCount < 4;
  const correctText = q.options[q.correctOption] ? stripOptionPrefix(q.options[q.correctOption]) : '';
  const invalidCorrect = q.correctOption < 0 || q.correctOption >= q.options.length || !correctText;
  const missingExplanation = !q.explanation?.trim();

  const messages: string[] = [];
  if (missingText) messages.push('Thiếu nội dung câu hỏi');
  if (tooFewOptions) messages.push('Cần ít nhất 2 phương án có nội dung');
  else if (incompleteOptions) messages.push(`Mới có ${nonEmptyCount}/4 phương án`);
  if (invalidCorrect) messages.push('Đáp án đúng đang trống');
  if (missingExplanation) messages.push('Chưa có lời giải');

  return {
    missingText,
    tooFewOptions,
    incompleteOptions,
    invalidCorrect,
    missingExplanation,
    hasError: missingText || tooFewOptions || invalidCorrect,
    hasWarning: incompleteOptions || missingExplanation,
    messages
  };
}

interface ExamReviewEditorProps {
  questions: QuestionItem[];
  onChangeQuestions: (updater: QuestionItem[] | ((prev: QuestionItem[]) => QuestionItem[])) => void;
  examTitle: string;
  onChangeExamTitle: (val: string) => void;
  subject: string;
  onChangeSubject: (val: string) => void;
  subjectOptions: string[];
  durationMinutes: number;
  onChangeDurationMinutes: (val: number) => void;
  targetClass: string;
  onChangeTargetClass: (val: string) => void;
  classes: TeacherClass[];
  notifyStudents: boolean;
  onChangeNotifyStudents: (val: boolean) => void;
  uploadedFileName?: string | null;
  sourceBadgeText: string;
  isReviewConfirmed: boolean;
  onChangeReviewConfirmed: (val: boolean) => void;
  sectionNumberLabel?: string;
}

export const ExamReviewEditor: React.FC<ExamReviewEditorProps> = ({
  questions,
  onChangeQuestions,
  examTitle,
  onChangeExamTitle,
  subject,
  onChangeSubject,
  subjectOptions,
  durationMinutes,
  onChangeDurationMinutes,
  targetClass,
  onChangeTargetClass,
  classes,
  notifyStudents,
  onChangeNotifyStudents,
  uploadedFileName,
  sourceBadgeText,
  isReviewConfirmed,
  onChangeReviewConfirmed,
  sectionNumberLabel = '02'
}) => {
  const [viewMode, setViewMode] = useState<'edit' | 'student_preview'>('edit');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [showMathPreview, setShowMathPreview] = useState(false);
  const [showBulkAnswerDrawer, setShowBulkAnswerDrawer] = useState(false);
  const [bulkAnswerInput, setBulkAnswerInput] = useState('');
  const [toolFeedback, setToolFeedback] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<QuestionItem[][]>([]);
  const [aiExplainingIdx, setAiExplainingIdx] = useState<number | null>(null);

  // Student preview interactive state
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<number, number>>({});
  const [previewShowKey, setPreviewShowKey] = useState(true);

  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const audits = useMemo(() => questions.map(auditQuestion), [questions]);
  const errorCount = useMemo(() => audits.filter((a) => a.hasError).length, [audits]);
  const warningCount = useMemo(() => audits.filter((a) => !a.hasError && a.hasWarning).length, [audits]);
  const unansweredCount = useMemo(
    () => questions.filter((q) => q.correctOption < 0 || q.correctOption >= q.options.length).length,
    [questions]
  );
  const answeredCount = questions.length - unansweredCount;
  const withExplanationCount = useMemo(
    () => questions.filter((q) => Boolean(q.explanation?.trim())).length,
    [questions]
  );

  // Auto-open Azota quick answer key drawer when an imported exam has missing answers
  const prevQuestionSetKeyRef = useRef<string>('');
  useEffect(() => {
    const key = `${questions.length}:${questions[0]?.id ?? ''}:${uploadedFileName ?? ''}`;
    if (key !== prevQuestionSetKeyRef.current) {
      prevQuestionSetKeyRef.current = key;
      if (questions.length > 0 && unansweredCount > 0) {
        setShowBulkAnswerDrawer(true);
      }
    }
  }, [questions, unansweredCount, uploadedFileName]);

  const scorePerQuestion =
    questions.length > 0 ? (10 / questions.length).toFixed(2).replace(/\.?0+$/, '') : '0';

  const filteredIndices = useMemo(() => {
    const qLower = searchTerm.trim().toLowerCase();
    return questions
      .map((q, idx) => ({ q, idx, audit: audits[idx] }))
      .filter(({ q, audit }) => {
        if (onlyIssues && !audit.hasError && !audit.hasWarning) return false;
        if (!qLower) return true;
        return (
          q.questionText.toLowerCase().includes(qLower) ||
          q.options.some((opt) => opt.toLowerCase().includes(qLower)) ||
          (q.explanation || '').toLowerCase().includes(qLower)
        );
      })
      .map((item) => item.idx);
  }, [questions, audits, searchTerm, onlyIssues]);

  const showFeedback = (msg: string) => {
    setToolFeedback(msg);
    window.setTimeout(() => {
      setToolFeedback((cur) => (cur === msg ? null : cur));
    }, 3500);
  };

  const latestQuestionsRef = useRef<QuestionItem[]>(questions);
  useEffect(() => {
    latestQuestionsRef.current = questions;
  }, [questions]);

  const pushUndoSnapshot = (current: QuestionItem[]) => {
    setUndoStack((prev) => [...prev.slice(-14), current.map((q) => ({ ...q, options: [...q.options] }))]);
  };

  const applyMutation = (mutator: (prev: QuestionItem[]) => QuestionItem[], recordUndo = true) => {
    if (recordUndo) {
      pushUndoSnapshot(latestQuestionsRef.current);
    }
    onChangeQuestions((prev) => mutator(prev));
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    onChangeQuestions(last);
    showFeedback('Đã hoàn tác thao tác chỉnh sửa gần nhất.');
  };

  const handleJumpToQuestion = (idx: number) => {
    if (viewMode === 'student_preview') {
      setPreviewIdx(idx);
      return;
    }
    if (onlyIssues || searchTerm) {
      setOnlyIssues(false);
      setSearchTerm('');
    }
    window.setTimeout(() => {
      const el = cardRefs.current[idx];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 40);
  };

  const handleAddQuestion = () => {
    const newQ: QuestionItem = {
      id: Date.now() + Math.floor(Math.random() * 10000),
      questionText: '',
      options: ['', '', '', ''],
      correctOption: 0,
      explanation: ''
    };
    const targetIdx = questions.length;
    applyMutation((prev) => [...prev, newQ]);
    setOnlyIssues(false);
    setSearchTerm('');
    window.setTimeout(() => {
      cardRefs.current[targetIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const handleDuplicateQuestion = (idx: number) => {
    const src = questions[idx];
    if (!src) return;
    const copy: QuestionItem = {
      ...src,
      id: Date.now() + Math.floor(Math.random() * 10000),
      options: [...src.options]
    };
    applyMutation((prev) => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
    showFeedback(`Đã nhân bản Câu ${idx + 1}.`);
  };

  const handleMoveQuestion = (idx: number, direction: -1 | 1) => {
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= questions.length) return;
    applyMutation((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, moved);
      return copy;
    });
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    applyMutation((prev) => prev.filter((_, i) => i !== idx));
    if (previewIdx >= questions.length - 1) {
      setPreviewIdx(Math.max(0, questions.length - 2));
    }
  };

  const handleShuffleSingleOptions = (qIdx: number) => {
    applyMutation((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIdx) return q;
        const hasValidKey = q.correctOption >= 0 && q.correctOption < q.options.length;
        const tagged = q.options.map((opt, oIdx) => ({
          text: stripOptionPrefix(opt),
          isCorrect: hasValidKey && oIdx === q.correctOption
        }));
        for (let i = tagged.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
        }
        const nextCorrect = hasValidKey ? tagged.findIndex((t) => t.isCorrect) : -1;
        return {
          ...q,
          options: tagged.map((t) => t.text),
          correctOption: nextCorrect
        };
      })
    );
    showFeedback(`Đã đảo thứ tự 4 đáp án của Câu ${qIdx + 1}.`);
  };

  const handleShuffleAllQuestions = () => {
    if (questions.length < 2) return;
    applyMutation((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    });
    showFeedback('Đã xáo trộn ngẫu nhiên thứ tự toàn bộ câu hỏi.');
  };

  const handleShuffleAllOptions = () => {
    applyMutation((prev) =>
      prev.map((q) => {
        const hasValidKey = q.correctOption >= 0 && q.correctOption < q.options.length;
        const tagged = q.options.map((opt, oIdx) => ({
          text: stripOptionPrefix(opt),
          isCorrect: hasValidKey && oIdx === q.correctOption
        }));
        for (let i = tagged.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
        }
        return {
          ...q,
          options: tagged.map((t) => t.text),
          correctOption: hasValidKey ? tagged.findIndex((t) => t.isCorrect) : -1
        };
      })
    );
    showFeedback('Đã trộn ngẫu nhiên đáp án A-B-C-D cho toàn bộ đề.');
  };

  const handleNormalizeFormatting = () => {
    applyMutation((prev) =>
      prev.map((q) => ({
        ...q,
        questionText: q.questionText
          .replace(/^(?:Câu|Question|Bài)\s*\d+\s*[:.]\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim(),
        options: q.options.map((opt) => stripOptionPrefix(opt)),
        explanation: (q.explanation || '').replace(/^Lời giải\s*:\s*/i, '').trim()
      }))
    );
    showFeedback('Đã chuẩn hóa sạch tiền tố A/B/C/D và khoảng trắng cho toàn bộ câu hỏi.');
  };

  const handleApplyBulkAnswerKey = () => {
    const raw = bulkAnswerInput.trim();
    if (!raw) return;

    const mapped: Record<number, number> = {};
    // Match numbered pairs like "1.A", "2: B", "3-C", "4D"
    const pairRegex = /(\d+)\s*[.:\-)]*\s*([A-Da-d])/g;
    let match: RegExpExecArray | null;
    while ((match = pairRegex.exec(raw)) !== null) {
      const qNum = parseInt(match[1], 10);
      const optIdx = match[2].toUpperCase().charCodeAt(0) - 65;
      if (qNum >= 1 && qNum <= questions.length && optIdx >= 0 && optIdx <= 3) {
        mapped[qNum - 1] = optIdx;
      }
    }

    // Fallback: sequential letters like "ABCDAB..." when no numbers matched
    if (Object.keys(mapped).length === 0) {
      const letters = raw.toUpperCase().match(/[A-D]/g) || [];
      letters.forEach((ch, idx) => {
        if (idx < questions.length) {
          mapped[idx] = ch.charCodeAt(0) - 65;
        }
      });
    }

    const updatedCount = Object.keys(mapped).length;
    if (updatedCount === 0) {
      showFeedback('Không nhận diện được đáp án hợp lệ (VD: 1.A 2.C 3.D hoặc ABCD).');
      return;
    }

    applyMutation((prev) =>
      prev.map((q, idx) => (mapped[idx] !== undefined ? { ...q, correctOption: mapped[idx] } : q))
    );
    setShowBulkAnswerDrawer(false);
    setBulkAnswerInput('');
    showFeedback(`Đã cập nhật đáp án đúng cho ${updatedCount}/${questions.length} câu.`);
  };

  const handleAiGenerateExplanation = async (qIdx: number) => {
    const q = questions[qIdx];
    if (!q || !q.questionText.trim()) {
      showFeedback('Cần có nội dung câu hỏi trước khi AI gợi ý lời giải.');
      return;
    }
    setAiExplainingIdx(qIdx);
    try {
      const hasValidKey = q.correctOption >= 0 && q.correctOption < q.options.length;
      const correctLetter = hasValidKey ? String.fromCharCode(65 + q.correctOption) : '';
      const optsText = q.options
        .map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${stripOptionPrefix(opt)}`)
        .join('\n');
      const prompt = hasValidKey
        ? `Hãy giải thích ngắn gọn (2-3 câu, tiếng Việt, dễ hiểu cho học sinh) vì sao đáp án ${correctLetter} là đúng cho câu trắc nghiệm môn ${subject} sau:\nCâu hỏi: ${q.questionText}\n${optsText}\nChỉ trả về phần lời giải súc tích, không lặp lại đề bài.`
        : `Hãy giải câu trắc nghiệm môn ${subject} sau, nêu rõ đáp án đúng (A, B, C hoặc D) và giải thích ngắn gọn 2-3 câu dễ hiểu cho học sinh:\nCâu hỏi: ${q.questionText}\n${optsText}`;

      const res = await fetch('/api/ai/chatgpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          mode: 'explain'
        })
      });
      const data = await res.json();
      const reply = (data.reply || data.text || data.answer || '').trim();
      if (reply) {
        applyMutation((prev) =>
          prev.map((item, i) => (i === qIdx ? { ...item, explanation: reply } : item))
        );
        showFeedback(`AI đã tạo lời giải chi tiết cho Câu ${qIdx + 1}.`);
      } else {
        throw new Error('Không nhận được phản hồi từ AI');
      }
    } catch {
      const hasValidKey = q.correctOption >= 0 && q.correctOption < q.options.length;
      const correctText = hasValidKey ? stripOptionPrefix(q.options[q.correctOption] || '') : '';
      applyMutation((prev) =>
        prev.map((item, i) =>
          i === qIdx
            ? {
                ...item,
                explanation: hasValidKey
                  ? `Đáp án đúng là ${String.fromCharCode(65 + q.correctOption)}${
                      correctText ? ` (${correctText})` : ''
                    } theo kiến thức trọng tâm môn ${subject}.`
                  : `Vui lòng chọn đáp án đúng cho câu hỏi môn ${subject} này.`
              }
            : item
        )
      );
      showFeedback(`Đã thêm khung lời giải mẫu cho Câu ${qIdx + 1} để thầy/cô tùy chỉnh.`);
    } finally {
      setAiExplainingIdx(null);
    }
  };

  const hasMathSyntax = (text: string) => /\$[^$]+\$|\\frac|\\sqrt|\\pi|\\omega|\\lambda/.test(text);

  const safePreviewIdx = Math.min(previewIdx, Math.max(0, questions.length - 1));
  const activePreviewQ = questions[safePreviewIdx];

  return (
    <div className="sf-teacher-surface rounded-3xl border border-slate-200/85 dark:border-cyan-400/25 shadow-[0_18px_42px_-24px_rgba(3,17,38,0.22)] dark:shadow-[0_24px_56px_-22px_rgba(0,0,0,0.72)] overflow-hidden sf-panel-enter">
      {/* Studio Top Hero Header */}
      <div className="sf-navy-hero-banner p-4 sm:p-5 border-b border-cyan-400/25">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-400/15 border border-cyan-300/35 text-cyan-300 flex items-center justify-center shadow-[0_0_20px_-4px_rgba(34,211,238,0.45)] shrink-0">
              <PenLine className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold font-display text-white tracking-tight">
                  {sectionNumberLabel}. Bản Xem Thử, Kiểm Tra &amp; Chỉnh Sửa Đề Thi
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-cyan-400/15 border border-cyan-300/30 text-[11px] font-bold text-cyan-200">
                  {sourceBadgeText}
                  {uploadedFileName ? ` · ${uploadedFileName}` : ''}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Kiểm tra kỹ câu hỏi, đáp án đúng và chạy thử ở chế độ Học sinh trước khi xuất bản
              </p>
            </div>
          </div>

          {/* Editor vs Student Preview Switcher + Undo */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {undoStack.length > 0 && (
              <button
                type="button"
                data-sound="tap"
                onClick={handleUndo}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-cyan-300/30 bg-white/10 hover:bg-white/15 backdrop-blur-md text-[11px] font-bold text-cyan-100 transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                title="Hoàn tác thao tác vừa thực hiện"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="tabular-nums">Hoàn tác ({undoStack.length})</span>
              </button>
            )}

            <div className="inline-flex p-1 rounded-2xl bg-[#040f24]/80 border border-cyan-300/25 backdrop-blur-md gap-1">
              <button
                type="button"
                data-sound="toggle"
                onClick={() => setViewMode('edit')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-extrabold font-display rounded-xl transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                  viewMode === 'edit'
                    ? 'bg-gradient-to-r from-cyan-400 to-sky-400 text-[#031126] shadow-[0_0_16px_-2px_rgba(34,211,238,0.6)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <PenLine className="w-3.5 h-3.5 shrink-0" />
                <span>Chỉnh sửa đề</span>
              </button>
              <button
                type="button"
                data-sound="toggle"
                onClick={() => {
                  setPreviewIdx(0);
                  setViewMode('student_preview');
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-extrabold font-display rounded-xl transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                  viewMode === 'student_preview'
                    ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#031126] shadow-[0_0_16px_-2px_rgba(52,211,153,0.6)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>Xem thử như Học sinh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editable Exam Metadata & Real-time Audit Strip */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-cyan-400/20 bg-slate-50/75 dark:bg-[#06142c]/95 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-cyan-200/90 mb-1.5">
              Tên đề thi *
            </label>
            <input
              type="text"
              value={examTitle}
              onChange={(e) => onChangeExamTitle(e.target.value)}
              placeholder={`VD: Đề kiểm tra 45 phút ${subject}...`}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold font-display rounded-2xl border border-slate-200/90 dark:border-cyan-400/25 bg-white dark:bg-[#050f24] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-cyan-400/25 transition"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-cyan-200/90 mb-1.5">
              Môn học
            </label>
            <select
              value={subject}
              onChange={(e) => onChangeSubject(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-bold rounded-2xl border border-slate-200/90 dark:border-cyan-400/25 bg-white dark:bg-[#050f24] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-cyan-400/25 transition cursor-pointer"
            >
              {subjectOptions.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-cyan-200/90 mb-1.5">
              Thời gian
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => onChangeDurationMinutes(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-xs font-bold rounded-2xl border border-slate-200/90 dark:border-cyan-400/25 bg-white dark:bg-[#050f24] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-cyan-400/25 transition tabular-nums cursor-pointer"
            >
              <option value={15}>15 phút</option>
              <option value={30}>30 phút</option>
              <option value={45}>45 phút</option>
              <option value={50}>50 phút</option>
              <option value={60}>60 phút</option>
              <option value={90}>90 phút</option>
              <option value={120}>120 phút</option>
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-cyan-200/90 mb-1.5">
              Giao cho lớp
            </label>
            <select
              value={targetClass}
              onChange={(e) => onChangeTargetClass(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-bold rounded-2xl border border-slate-200/90 dark:border-cyan-400/25 bg-white dark:bg-[#050f24] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-cyan-400/25 transition cursor-pointer"
            >
              <option value="Tất cả mọi người">Tất cả mọi người</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name} ({cls.studentsCount} HS)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Real-time Audit Strip + Notification toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-cyan-400/15 text-[11.5px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-semibold text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-[#081b3d] dark:bg-cyan-400/15 text-cyan-200 dark:text-cyan-300 border border-cyan-400/30 font-display font-extrabold font-mono tabular-nums">
              {questions.length} câu hỏi
            </span>
            <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
              {scorePerQuestion} điểm/câu
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            <span
              className={`font-mono tabular-nums font-bold ${
                unansweredCount > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              Đã có đáp án: {answeredCount}/{questions.length}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            <span className="font-mono tabular-nums text-slate-700 dark:text-cyan-200/90">
              Có lời giải: {withExplanationCount}/{questions.length}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
            {errorCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/30 font-bold text-rose-600 dark:text-rose-300 tabular-nums">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {unansweredCount > 0
                  ? `${unansweredCount} câu chưa chọn đáp án đúng`
                  : `${errorCount} câu thiếu dữ liệu bắt buộc`}
              </span>
            ) : warningCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {warningCount} câu cần rà soát thêm
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Tất cả câu hỏi đạt chuẩn xuất bản
              </span>
            )}
          </div>

          <label
            data-sound="toggle"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-[#091834] border border-slate-200/90 dark:border-cyan-400/25 font-bold text-slate-700 dark:text-cyan-200 cursor-pointer select-none hover:border-sky-400 dark:hover:border-cyan-400/50 transition"
          >
            <input
              type="checkbox"
              checked={notifyStudents}
              onChange={(e) => onChangeNotifyStudents(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-sky-600 dark:text-cyan-400 focus:ring-cyan-500 cursor-pointer"
            />
            <Bell className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
            <span>Tự động gửi thông báo cho học sinh khi xuất bản</span>
          </label>
        </div>
      </div>

      {/* Quick Question Navigator + Batch Teacher Tools */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200/80 dark:border-cyan-400/20 bg-white/75 dark:bg-[#07152e]/95 space-y-3">
        {/* Batch Utilities */}
        {viewMode === 'edit' && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-sound="toggle"
                onClick={() => setShowBulkAnswerDrawer((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                  showBulkAnswerDrawer
                    ? 'bg-[#081b3d] dark:bg-cyan-400/20 border-cyan-400 text-cyan-200 shadow-[0_0_14px_-4px_rgba(34,211,238,0.5)]'
                    : 'sf-teacher-tile bg-white dark:bg-[#091a38] border-slate-200 dark:border-cyan-400/25 text-slate-700 dark:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
                <span>Nhập bảng đáp án</span>
              </button>

              <button
                type="button"
                data-sound="tap"
                onClick={handleNormalizeFormatting}
                className="sf-teacher-tile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-cyan-400/25 bg-white dark:bg-[#091a38] text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                title="Xóa tiền tố A. B. C. D. bị lặp và khoảng trắng thừa"
              >
                <Wand2 className="w-3.5 h-3.5 text-indigo-600 dark:text-cyan-300 shrink-0" />
                <span>Chuẩn hóa A-B-C-D</span>
              </button>
            </div>
          </div>
        )}

        {/* Azota Bulk Answer Key Drawer + Interactive Click Grid */}
        {viewMode === 'edit' && showBulkAnswerDrawer && (
          <div className="p-4 rounded-2xl bg-slate-50/95 dark:bg-[#081834] border border-cyan-400/45 shadow-[0_12px_28px_-16px_rgba(34,211,238,0.35)] space-y-3 sf-panel-enter">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold font-display text-slate-900 dark:text-cyan-200 tabular-nums">
                  Bảng đáp án nhanh chuẩn Azota (Đã chọn {answeredCount}/{questions.length} câu)
                </span>
                {unansweredCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10.5px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                    Còn {unansweredCount} câu chưa chọn đáp án
                  </span>
                )}
              </div>
              <button
                type="button"
                data-sound="tap"
                onClick={() => setShowBulkAnswerDrawer(false)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10 transition cursor-pointer"
              >
                Thu gọn
              </button>
            </div>

            {/* Interactive 1-click Azota Answer Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
              {questions.map((q, qIdx) => (
                <div
                  key={q.id || qIdx}
                  className={`flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] transition ${
                    q.correctOption < 0
                      ? 'bg-rose-50/80 dark:bg-rose-950/35 border-rose-300 dark:border-rose-500/45'
                      : 'bg-white dark:bg-[#050f24] border-slate-200/90 dark:border-cyan-400/20'
                  }`}
                >
                  <button
                    type="button"
                    data-sound="nav"
                    onClick={() => handleJumpToQuestion(qIdx)}
                    className="font-extrabold font-mono text-slate-800 dark:text-cyan-200 tabular-nums hover:text-sky-600 dark:hover:text-cyan-300 cursor-pointer shrink-0"
                    title={`Nhảy tới Câu ${qIdx + 1}`}
                  >
                    {qIdx + 1}.
                  </button>
                  <div className="flex items-center gap-0.5">
                    {[0, 1, 2, 3].map((optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isPicked = q.correctOption === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          data-sound="toggle"
                          onClick={() =>
                            applyMutation((prev) =>
                              prev.map((item, i) => (i === qIdx ? { ...item, correctOption: optIdx } : item))
                            )
                          }
                          className={`w-5 h-5 rounded-md text-[10px] font-extrabold transition-all duration-150 active:scale-90 cursor-pointer ${
                            isPicked
                              ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-[0_0_10px_-2px_rgba(16,185,129,0.65)]'
                              : 'bg-slate-100 dark:bg-[#0b1d3d] text-slate-600 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-cyan-400/20'
                          }`}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Or paste string */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200/70 dark:border-cyan-400/15">
              <input
                type="text"
                value={bulkAnswerInput}
                onChange={(e) => setBulkAnswerInput(e.target.value)}
                placeholder="Hoặc dán chuỗi đáp án: 1.A 2.B 3.C 4.D 5.A hoặc ABCD..."
                className="flex-1 px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-cyan-400/25 bg-white dark:bg-[#050f24] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400"
              />
              <button
                type="button"
                data-sound="success"
                onClick={handleApplyBulkAnswerKey}
                className="sf-neon-cta px-4 py-2 rounded-xl text-xs transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
              >
                Áp dụng chuỗi đáp án
              </button>
            </div>
          </div>
        )}

        {/* Tool feedback banner */}
        {toolFeedback && (
          <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/35 text-[11.5px] font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 sf-panel-enter">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{toolFeedback}</span>
          </div>
        )}

        {/* Quick Question Number Grid */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-cyan-300/80 mr-1">
            Mục lục câu:
          </span>
          {questions.map((q, idx) => {
            const audit = audits[idx];
            const isSelectedPreview = viewMode === 'student_preview' && safePreviewIdx === idx;
            return (
              <button
                key={q.id || idx}
                type="button"
                data-sound="nav"
                onClick={() => handleJumpToQuestion(idx)}
                title={
                  audit.hasError
                    ? `Câu ${idx + 1}: ${audit.messages.join(', ')}`
                    : audit.hasWarning
                    ? `Câu ${idx + 1}: ${audit.messages.join(', ')}`
                    : `Câu ${idx + 1}: Đạt chuẩn`
                }
                className={`w-7 h-7 rounded-xl text-[11px] font-extrabold font-mono tabular-nums border transition-all duration-150 active:scale-90 cursor-pointer flex items-center justify-center ${
                  isSelectedPreview
                    ? 'bg-[#081b3d] dark:bg-cyan-400 border-cyan-400 text-cyan-300 dark:text-[#031126] shadow-[0_0_12px_-2px_rgba(34,211,238,0.6)]'
                    : audit.hasError
                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-500/50 text-rose-700 dark:text-rose-300 hover:border-rose-500'
                    : audit.hasWarning
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 hover:border-amber-500'
                    : 'bg-white dark:bg-[#091a38] border-slate-200/90 dark:border-cyan-400/25 text-slate-700 dark:text-cyan-200 hover:border-sky-400 dark:hover:border-cyan-400'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Area */}
      {viewMode === 'edit' ? (
        <div className="p-4 sm:p-5 space-y-4 max-h-[640px] overflow-y-auto custom-scrollbar bg-slate-100/55 dark:bg-[#040c1d]/85">
          {filteredIndices.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <p className="font-semibold">Không tìm thấy câu hỏi nào khớp với bộ lọc hiện tại.</p>
              <button
                type="button"
                data-sound="tap"
                onClick={() => {
                  setSearchTerm('');
                  setOnlyIssues(false);
                }}
                className="text-sky-600 dark:text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                Xem lại tất cả {questions.length} câu hỏi
              </button>
            </div>
          ) : (
            filteredIndices.map((qIdx) => {
              const q = questions[qIdx];
              const audit = audits[qIdx];
              const showRenderedMath =
                showMathPreview || hasMathSyntax(q.questionText) || q.options.some(hasMathSyntax);

              return (
                <div
                  key={q.id || qIdx}
                  ref={(el) => {
                    cardRefs.current[qIdx] = el;
                  }}
                  className={`sf-teacher-tile relative overflow-hidden p-4 sm:p-5 rounded-3xl border space-y-3.5 transition-all duration-150 ${
                    audit.hasError
                      ? 'bg-rose-50/55 dark:bg-[#1a0c18]/90 border-rose-300 dark:border-rose-500/50'
                      : 'bg-white/95 dark:bg-[#081630]/95 border-slate-200/90 dark:border-cyan-400/25 shadow-[0_10px_28px_-18px_rgba(3,17,38,0.18)] dark:shadow-[0_14px_34px_-18px_rgba(0,0,0,0.65)]'
                  }`}
                >
                  {/* Top Neon Accent Hairline */}
                  <div
                    className={`absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r ${
                      audit.hasError
                        ? 'from-rose-500 via-amber-400 to-rose-500'
                        : audit.hasWarning
                        ? 'from-amber-400 via-yellow-300 to-amber-400'
                        : 'from-[#0b234d] via-cyan-400 to-emerald-400'
                    }`}
                  />

                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-xl bg-[#081b3d] dark:bg-cyan-400/15 text-cyan-200 dark:text-cyan-300 border border-cyan-400/35 text-xs font-display font-extrabold font-mono tabular-nums shadow-xs">
                        Câu {qIdx + 1}
                      </span>
                      {audit.hasError ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] font-bold text-rose-600 dark:text-rose-300">
                          {audit.messages.join(' · ')}
                        </span>
                      ) : audit.hasWarning ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                          {audit.messages.join(' · ')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Đáp án đúng: {q.correctOption >= 0 ? String.fromCharCode(65 + q.correctOption) : 'Chưa chọn'}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        data-sound="tap"
                        disabled={aiExplainingIdx === qIdx}
                        onClick={() => handleAiGenerateExplanation(qIdx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0a1f45] to-[#132f64] dark:from-cyan-400/20 dark:to-indigo-500/25 border border-cyan-400/35 text-[11px] font-bold text-cyan-200 hover:shadow-[0_0_16px_-4px_rgba(34,211,238,0.55)] transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-50"
                        title="AI tự viết lời giải chi tiết cho câu này"
                      >
                        <Sparkles className={`w-3.5 h-3.5 text-cyan-300 ${aiExplainingIdx === qIdx ? 'animate-spin' : ''}`} />
                        <span>{aiExplainingIdx === qIdx ? 'Đang viết...' : 'AI lời giải'}</span>
                      </button>

                      <button
                        type="button"
                        data-sound="tap"
                        onClick={() => handleShuffleSingleOptions(qIdx)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-sky-600 dark:hover:text-cyan-300 hover:bg-sky-50 dark:hover:bg-cyan-400/15 border border-transparent hover:border-sky-200 dark:hover:border-cyan-400/30 transition-all duration-150 active:scale-90 cursor-pointer"
                        title="Đảo ngẫu nhiên A-B-C-D câu này"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        data-sound="tap"
                        disabled={qIdx === 0}
                        onClick={() => handleMoveQuestion(qIdx, -1)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-150 active:scale-90 cursor-pointer disabled:opacity-30"
                        title="Di chuyển lên"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        data-sound="tap"
                        disabled={qIdx === questions.length - 1}
                        onClick={() => handleMoveQuestion(qIdx, 1)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-150 active:scale-90 cursor-pointer disabled:opacity-30"
                        title="Di chuyển xuống"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        data-sound="tap"
                        onClick={() => handleDuplicateQuestion(qIdx)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-sky-600 dark:hover:text-cyan-300 hover:bg-sky-50 dark:hover:bg-cyan-400/15 border border-transparent hover:border-sky-200 dark:hover:border-cyan-400/30 transition-all duration-150 active:scale-90 cursor-pointer"
                        title="Nhân bản câu hỏi"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {questions.length > 1 && (
                        <button
                          type="button"
                          data-sound="tap"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/30 transition-all duration-150 active:scale-90 cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Question Text Input */}
                  <textarea
                    rows={2}
                    value={q.questionText}
                    onChange={(e) =>
                      applyMutation(
                        (prev) =>
                          prev.map((item, idx) =>
                            idx === qIdx ? { ...item, questionText: e.target.value } : item
                          ),
                        false
                      )
                    }
                    placeholder={`Nhập nội dung câu hỏi ${qIdx + 1}...`}
                    className="w-full px-4 py-2.5 text-xs sm:text-[13px] bg-slate-50/90 dark:bg-[#050f24]/90 border border-slate-200/90 dark:border-cyan-400/20 rounded-2xl text-slate-900 dark:text-white font-medium leading-relaxed focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-sky-500/15 dark:focus:ring-cyan-400/20 transition"
                  />

                  {/* Live KaTeX Math Preview if toggled or LaTeX detected */}
                  {showRenderedMath && q.questionText.trim() && (
                    <div className="px-3.5 py-2.5 rounded-2xl bg-indigo-50/70 dark:bg-[#0b1c3d]/90 border border-indigo-200/80 dark:border-cyan-400/25 text-xs text-slate-800 dark:text-cyan-100 prose prose-sm dark:prose-invert max-w-none">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-cyan-300 block mb-0.5">
                        Hiển thị công thức:
                      </span>
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {q.questionText}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Options A-B-C-D */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correctOption === optIdx;
                      const letter = String.fromCharCode(65 + optIdx);
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all duration-150 ${
                            isCorrect
                              ? 'bg-gradient-to-r from-emerald-500/12 via-cyan-500/8 to-transparent dark:from-emerald-500/20 dark:via-cyan-500/12 dark:to-transparent border-emerald-500/75 dark:border-emerald-400/70 shadow-[0_6px_18px_-10px_rgba(16,185,129,0.5)]'
                              : 'bg-slate-50/85 dark:bg-[#06132b]/90 border-slate-200/85 dark:border-cyan-400/20 hover:border-sky-400/60 dark:hover:border-cyan-400/45'
                          }`}
                        >
                          <label
                            data-sound="toggle"
                            title={`Đặt ${letter} là đáp án đúng`}
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-display font-extrabold text-xs cursor-pointer transition-all duration-150 active:scale-90 shrink-0 select-none ${
                              isCorrect
                                ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-[0_0_12px_-2px_rgba(16,185,129,0.6)]'
                                : 'bg-white dark:bg-[#0a1c3b] border border-slate-200 dark:border-cyan-400/25 text-slate-600 dark:text-cyan-200 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-cyan-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`review_correct_${q.id || qIdx}`}
                              checked={isCorrect}
                              onChange={() =>
                                applyMutation((prev) =>
                                  prev.map((item, idx) =>
                                    idx === qIdx ? { ...item, correctOption: optIdx } : item
                                  )
                                )
                              }
                              className="sr-only"
                            />
                            <span>{letter}</span>
                          </label>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const val = e.target.value;
                              applyMutation(
                                (prev) =>
                                  prev.map((item, idx) => {
                                    if (idx !== qIdx) return item;
                                    const nextOpts = [...item.options];
                                    nextOpts[optIdx] = val;
                                    return { ...item, options: nextOpts };
                                  }),
                                false
                              );
                            }}
                            placeholder={`Nhập phương án ${letter}...`}
                            className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-white/95 dark:bg-[#050f24]/95 border border-slate-200/90 dark:border-cyan-400/20 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-sky-500/15 dark:focus:ring-cyan-400/20 transition"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Input */}
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-sky-50/70 dark:bg-[#061530]/90 border border-sky-200/80 dark:border-cyan-400/20 focus-within:border-sky-400 dark:focus-within:border-cyan-400/50 transition">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-cyan-300 shrink-0">
                      Lời giải
                    </span>
                    <input
                      type="text"
                      value={q.explanation || ''}
                      onChange={(e) =>
                        applyMutation(
                          (prev) =>
                            prev.map((item, idx) =>
                              idx === qIdx ? { ...item, explanation: e.target.value } : item
                            ),
                          false
                        )
                      }
                      placeholder="Lời giải chi tiết / gợi ý cho học sinh (không bắt buộc)..."
                      className="flex-1 min-w-0 bg-transparent text-xs text-slate-700 dark:text-cyan-100/90 italic focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              );
            })
          )}

          <div className="flex justify-center pt-1.5">
            <button
              type="button"
              data-sound="tap"
              onClick={handleAddQuestion}
              className="sf-teacher-tile inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-dashed border-cyan-500/60 dark:border-cyan-400/50 bg-sky-50/80 dark:bg-cyan-400/10 hover:bg-sky-100/80 dark:hover:bg-cyan-400/20 text-[#081b3d] dark:text-cyan-200 text-xs font-extrabold font-display transition-all duration-150 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-sky-600 dark:text-cyan-300" />
              <span>Thêm câu hỏi mới (Câu {questions.length + 1})</span>
            </button>
          </div>
        </div>
      ) : (
        /* Interactive Student Preview Simulation */
        <div className="p-4 sm:p-6 bg-slate-100/60 dark:bg-[#040c1d]/90 space-y-4">
          {activePreviewQ && (
            <div className="sf-teacher-surface max-w-3xl mx-auto rounded-3xl border border-slate-200/90 dark:border-cyan-400/25 p-5 sm:p-6 space-y-4 shadow-[0_14px_34px_-18px_rgba(3,17,38,0.22)]">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-cyan-400/15">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center px-3 py-1 rounded-xl bg-[#081b3d] dark:bg-cyan-400/15 text-cyan-200 dark:text-cyan-300 border border-cyan-400/35 text-xs font-display font-extrabold font-mono tabular-nums">
                    Câu {safePreviewIdx + 1} / {questions.length}
                  </span>
                  <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {durationMinutes} phút · {scorePerQuestion} đ/câu
                  </span>
                </div>

                <label
                  data-sound="toggle"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-cyan-200 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={previewShowKey}
                    onChange={(e) => setPreviewShowKey(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-sky-600 dark:text-cyan-400 cursor-pointer"
                  />
                  <span>Hiện đáp án &amp; lời giải (Chế độ giáo viên)</span>
                </label>
              </div>

              <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {activePreviewQ.questionText || '(Chưa nhập nội dung câu hỏi)'}
                </ReactMarkdown>
              </div>

              <div className="space-y-2.5">
                {activePreviewQ.options.map((opt, optIdx) => {
                  const letter = String.fromCharCode(65 + optIdx);
                  const cleanOpt = stripOptionPrefix(opt);
                  const isPicked = previewAnswers[activePreviewQ.id] === optIdx;
                  const isKey = optIdx === activePreviewQ.correctOption;
                  const highlightKey = previewShowKey && isKey;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      data-sound="toggle"
                      onClick={() =>
                        setPreviewAnswers((prev) => ({ ...prev, [activePreviewQ.id]: optIdx }))
                      }
                      className={`w-full text-left p-3.5 rounded-2xl border text-xs sm:text-sm transition-all duration-150 active:scale-[0.99] flex items-center gap-3 cursor-pointer ${
                        highlightKey
                          ? 'border-emerald-500 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-emerald-950 dark:text-emerald-200 font-bold shadow-[0_6px_18px_-10px_rgba(16,185,129,0.5)]'
                          : isPicked
                          ? 'border-cyan-500 bg-gradient-to-r from-sky-500/12 to-cyan-500/10 text-[#081b3d] dark:text-cyan-100 font-semibold shadow-[0_6px_18px_-10px_rgba(34,211,238,0.45)]'
                          : 'border-slate-200/90 dark:border-cyan-400/20 bg-slate-50/75 dark:bg-[#06132b] text-slate-700 dark:text-slate-300 hover:border-sky-400 dark:hover:border-cyan-400/50'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-display font-extrabold text-xs shrink-0 ${
                          highlightKey
                            ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white'
                            : isPicked
                            ? 'bg-[#081b3d] dark:bg-cyan-400 text-cyan-300 dark:text-[#031126]'
                            : 'bg-slate-200/80 dark:bg-[#0c2044] text-slate-700 dark:text-cyan-200'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="flex-1 min-w-0">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {cleanOpt || `(Phương án ${letter} đang trống)`}
                        </ReactMarkdown>
                      </span>
                      {highlightKey && (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {previewShowKey && activePreviewQ.explanation && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#081b3d]/5 via-cyan-500/8 to-emerald-500/5 dark:from-[#0b1f45] dark:to-[#071734] border border-cyan-500/30 text-xs text-slate-700 dark:text-cyan-100 leading-relaxed">
                  <strong className="text-[#081b3d] dark:text-cyan-300 font-display block mb-0.5">
                    Lời giải chi tiết:
                  </strong>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {activePreviewQ.explanation}
                  </ReactMarkdown>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-200/75 dark:border-cyan-400/15">
                <button
                  type="button"
                  data-sound="nav"
                  disabled={safePreviewIdx === 0}
                  onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
                  className="sf-teacher-tile inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-cyan-400/25 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>

                <button
                  type="button"
                  data-sound="tap"
                  onClick={() => {
                    setViewMode('edit');
                    handleJumpToQuestion(safePreviewIdx);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#081b3d] dark:bg-cyan-400/20 hover:bg-[#0d2757] dark:hover:bg-cyan-400/30 border border-cyan-400/35 text-xs font-bold text-cyan-200 transition-all duration-150 active:scale-95 cursor-pointer"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>Sửa câu này</span>
                </button>

                <button
                  type="button"
                  data-sound="nav"
                  disabled={safePreviewIdx >= questions.length - 1}
                  onClick={() => setPreviewIdx((i) => Math.min(questions.length - 1, i + 1))}
                  className="sf-teacher-tile inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-cyan-400/25 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <span>Câu tiếp</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pre-publish Verification Gate */}
      <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200/80 dark:border-cyan-400/20 bg-gradient-to-r from-[#081b3d]/5 via-cyan-500/8 to-emerald-500/8 dark:from-[#071631] dark:to-[#081b3d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label
          data-sound="toggle"
          className="inline-flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-cyan-100 cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={isReviewConfirmed}
            onChange={(e) => onChangeReviewConfirmed(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-cyan-500 cursor-pointer"
          />
          <span>
            Tôi đã kiểm tra bản xem thử, nội dung câu hỏi và đáp án đúng trước khi xuất bản
          </span>
        </label>

        {errorCount > 0 && (
          <button
            type="button"
            data-sound="nav"
            onClick={() => {
              const firstBadIdx = audits.findIndex((a) => a.hasError);
              if (firstBadIdx >= 0) {
                setViewMode('edit');
                handleJumpToQuestion(firstBadIdx);
              }
            }}
            className="text-xs font-extrabold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer shrink-0 text-left sm:text-right"
          >
            Nhảy tới câu lỗi đầu tiên →
          </button>
        )}
      </div>
    </div>
  );
};
