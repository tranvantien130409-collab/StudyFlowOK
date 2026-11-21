import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Eye,
  X,
  Award,
  Target,
  Filter,
  ArrowLeft,
  Play,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell
} from 'recharts';
import { ExamItem, ExamSubmission, UserRole } from '../types';

interface ExamAnalyticsCardProps {
  exams: ExamItem[];
  submissions: ExamSubmission[];
  selectedExamId: number | 'all';
  onSelectExamId: (examId: number | 'all') => void;
  role: UserRole;
  isPage?: boolean;
  onBack?: () => void;
  onTakeExam?: (exam: ExamItem) => void;
}

type TierKey = 'all' | 'excellent' | 'good' | 'average' | 'weak';
type SortKey = 'newest' | 'highest' | 'lowest';
type ChartScaleMode = 'brackets' | 'integer';

interface ScoreBracket {
  index: number;
  label: string;
  min: number;
  max: number;
  inclusiveMax?: boolean;
  count: number;
  tierColor: string;
}

const formatDuration = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s}s`;
  return `${m}p ${String(s).padStart(2, '0')}s`;
};

const getScoreClassification = (score: number) => {
  if (score >= 8) {
    return {
      key: 'excellent' as const,
      label: 'Giỏi / Xuất sắc',
      shortLabel: 'Giỏi',
      textClass: 'text-emerald-700 dark:text-emerald-300',
      dotClass: 'bg-emerald-500'
    };
  }
  if (score >= 6.5) {
    return {
      key: 'good' as const,
      label: 'Khá',
      shortLabel: 'Khá',
      textClass: 'text-blue-700 dark:text-cyan-300',
      dotClass: 'bg-blue-500'
    };
  }
  if (score >= 5) {
    return {
      key: 'average' as const,
      label: 'Đạt chuẩn',
      shortLabel: 'Trung bình',
      textClass: 'text-amber-700 dark:text-amber-300',
      dotClass: 'bg-amber-500'
    };
  }
  return {
    key: 'weak' as const,
    label: 'Cần hỗ trợ',
    shortLabel: 'Chưa đạt',
    textClass: 'text-rose-700 dark:text-rose-300',
    dotClass: 'bg-rose-500'
  };
};

export const ExamAnalyticsCard: React.FC<ExamAnalyticsCardProps> = ({
  exams,
  submissions,
  selectedExamId,
  onSelectExamId,
  role,
  isPage = false,
  onBack,
  onTakeExam
}) => {
  const isTeacher = role === 'teacher';
  const [tierFilter, setTierFilter] = useState<TierKey>('all');
  const [selectedBracketIndex, setSelectedBracketIndex] = useState<number | null>(null);
  const [chartScale, setChartScale] = useState<ChartScaleMode>('brackets');
  const [studentQuery, setStudentQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [inspectedSubmission, setInspectedSubmission] = useState<ExamSubmission | null>(null);

  const selectedExam = useMemo(
    () => (selectedExamId === 'all' ? null : exams.find((e) => e.id === selectedExamId) || null),
    [exams, selectedExamId]
  );

  // Scoped submissions for the selected exam (or all exams)
  const scopedSubmissions = useMemo(() => {
    if (selectedExamId === 'all') return submissions;
    return submissions.filter((s) => s.examId === selectedExamId);
  }, [submissions, selectedExamId]);

  // Statistical summary + 10-band score distribution (0-1, 1-2, ..., 9-10)
  const analytics = useMemo(() => {
    const count = scopedSubmissions.length;
    const brackets: ScoreBracket[] = Array.from({ length: 10 }, (_, idx) => {
      const min = idx;
      const max = idx + 1;
      const tierColor =
        min >= 8
          ? 'bg-emerald-500 hover:bg-emerald-400'
          : min >= 6.5
          ? 'bg-blue-500 hover:bg-blue-400'
          : min >= 5
          ? 'bg-amber-500 hover:bg-amber-400'
          : 'bg-rose-500 hover:bg-rose-400';
      return {
        index: idx,
        label: idx === 9 ? '9–10' : `${min}–${max}`,
        min,
        max,
        inclusiveMax: idx === 9,
        count: 0,
        tierColor
      };
    });

    if (count === 0) {
      return {
        count: 0,
        avg: 0,
        median: 0,
        stdDev: 0,
        maxScore: 0,
        minScore: 0,
        passCount: 0,
        passRate: 0,
        excellentCount: 0,
        excellentRate: 0,
        avgTimeSeconds: 0,
        avgAccuracyPct: 0,
        brackets,
        maxBracketCount: 1,
        peakBracketLabel: '—',
        tiers: [
          { key: 'excellent' as const, label: 'Giỏi (≥ 8.0)', count: 0, pct: 0, barColor: 'sf-tier-bar-excellent', swatchClass: 'bg-gradient-to-tr from-emerald-500 to-teal-300 shadow-[0_0_8px_rgba(45,212,191,0.6)]' },
          { key: 'good' as const, label: 'Khá (6.5 – 7.9)', count: 0, pct: 0, barColor: 'sf-tier-bar-good', swatchClass: 'bg-gradient-to-tr from-blue-600 to-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.6)]' },
          { key: 'average' as const, label: 'Trung bình (5.0 – 6.4)', count: 0, pct: 0, barColor: 'sf-tier-bar-average', swatchClass: 'bg-gradient-to-tr from-amber-600 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.55)]' },
          { key: 'weak' as const, label: 'Cần hỗ trợ (< 5.0)', count: 0, pct: 0, barColor: 'sf-tier-bar-weak', swatchClass: 'bg-gradient-to-tr from-rose-600 to-pink-300 shadow-[0_0_8px_rgba(251,113,133,0.55)]' }
        ]
      };
    }

    const scores = scopedSubmissions.map((s) => Number(s.score) || 0).sort((a, b) => a - b);
    const totalScore = scores.reduce((acc, v) => acc + v, 0);
    const avg = Math.round((totalScore / count) * 100) / 100;
    const median =
      count % 2 === 1
        ? scores[Math.floor(count / 2)]
        : Math.round(((scores[count / 2 - 1] + scores[count / 2]) / 2) * 100) / 100;

    const variance = scores.reduce((acc, v) => acc + (v - avg) ** 2, 0) / count;
    const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

    let excellentCount = 0;
    let goodCount = 0;
    let averageCount = 0;
    let weakCount = 0;

    scopedSubmissions.forEach((s) => {
      const sc = Number(s.score) || 0;
      if (sc >= 8) excellentCount += 1;
      else if (sc >= 6.5) goodCount += 1;
      else if (sc >= 5) averageCount += 1;
      else weakCount += 1;

      const idx = sc >= 10 ? 9 : Math.max(0, Math.min(9, Math.floor(sc)));
      brackets[idx].count += 1;
    });

    const passCount = excellentCount + goodCount + averageCount;
    const maxBracketCount = Math.max(1, ...brackets.map((b) => b.count));
    const peakBracket = brackets.reduce((best, cur) => (cur.count > best.count ? cur : best), brackets[0]);

    const avgTimeSeconds = Math.round(
      scopedSubmissions.reduce((acc, s) => acc + (Number(s.timeSpentSeconds) || 0), 0) / count
    );

    const avgAccuracyPct = Math.round(
      (scopedSubmissions.reduce(
        (acc, s) => acc + (s.totalQuestions > 0 ? s.correctCount / s.totalQuestions : 0),
        0
      ) /
        count) *
        100
    );

    const chartBrackets = brackets.map((b) => {
      const matchingSubs = scopedSubmissions.filter((s) => {
        const sc = Number(s.score) || 0;
        const idx = sc >= 10 ? 9 : Math.max(0, Math.min(9, Math.floor(sc)));
        return idx === b.index;
      });
      const fill =
        b.min >= 8
          ? 'url(#sfGradExcellent)'
          : b.min >= 6.5
          ? 'url(#sfGradGood)'
          : b.min >= 5
          ? 'url(#sfGradAverage)'
          : 'url(#sfGradWeak)';
      const solidColor =
        b.min >= 8
          ? '#2dd4bf'
          : b.min >= 6.5
          ? '#38bdf8'
          : b.min >= 5
          ? '#fbbf24'
          : '#fb7185';
      return {
        ...b,
        pct: Math.round((b.count / count) * 100),
        fill,
        solidColor,
        sampleNames: matchingSubs.slice(0, 4).map((s) => s.studentName)
      };
    });

    // 11-point rounded integer spectrum (0, 1, ..., 10)
    const integerSpectrum = Array.from({ length: 11 }, (_, scoreVal) => {
      const matchingSubs = scopedSubmissions.filter(
        (s) => Math.max(0, Math.min(10, Math.round(Number(s.score) || 0))) === scoreVal
      );
      const fill =
        scoreVal >= 8
          ? 'url(#sfGradExcellent)'
          : scoreVal >= 7
          ? 'url(#sfGradGood)'
          : scoreVal >= 5
          ? 'url(#sfGradAverage)'
          : 'url(#sfGradWeak)';
      const solidColor =
        scoreVal >= 8
          ? '#2dd4bf'
          : scoreVal >= 7
          ? '#38bdf8'
          : scoreVal >= 5
          ? '#fbbf24'
          : '#fb7185';
      return {
        index: scoreVal,
        label: `${scoreVal}đ`,
        count: matchingSubs.length,
        pct: Math.round((matchingSubs.length / count) * 100),
        fill,
        solidColor,
        sampleNames: matchingSubs.slice(0, 4).map((s) => s.studentName)
      };
    });

    const highestSub = scopedSubmissions.reduce(
      (best, cur) => (cur.score > best.score ? cur : best),
      scopedSubmissions[0]
    );
    const lowestSub = scopedSubmissions.reduce(
      (worst, cur) => (cur.score < worst.score ? cur : worst),
      scopedSubmissions[0]
    );

    return {
      count,
      avg,
      median,
      stdDev,
      maxScore: scores[scores.length - 1],
      minScore: scores[0],
      highestStudentName: highestSub?.studentName || '—',
      lowestStudentName: lowestSub?.studentName || '—',
      passCount,
      passRate: Math.round((passCount / count) * 100),
      excellentCount,
      excellentRate: Math.round((excellentCount / count) * 100),
      avgTimeSeconds,
      avgAccuracyPct,
      brackets: chartBrackets,
      integerSpectrum,
      maxBracketCount,
      peakBracketLabel: peakBracket.count > 0 ? `${peakBracket.label} điểm (${peakBracket.count} bài)` : '—',
      tiers: [
        {
          key: 'excellent' as const,
          label: 'Giỏi (≥ 8.0)',
          count: excellentCount,
          pct: Math.round((excellentCount / count) * 100),
          barColor: 'sf-tier-bar-excellent',
          swatchClass: 'bg-gradient-to-tr from-emerald-500 to-teal-300 shadow-[0_0_8px_rgba(45,212,191,0.6)]'
        },
        {
          key: 'good' as const,
          label: 'Khá (6.5 – 7.9)',
          count: goodCount,
          pct: Math.round((goodCount / count) * 100),
          barColor: 'sf-tier-bar-good',
          swatchClass: 'bg-gradient-to-tr from-blue-600 to-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
        },
        {
          key: 'average' as const,
          label: 'Trung bình (5.0 – 6.4)',
          count: averageCount,
          pct: Math.round((averageCount / count) * 100),
          barColor: 'sf-tier-bar-average',
          swatchClass: 'bg-gradient-to-tr from-amber-600 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.55)]'
        },
        {
          key: 'weak' as const,
          label: 'Cần hỗ trợ (< 5.0)',
          count: weakCount,
          pct: Math.round((weakCount / count) * 100),
          barColor: 'sf-tier-bar-weak',
          swatchClass: 'bg-gradient-to-tr from-rose-600 to-pink-300 shadow-[0_0_8px_rgba(251,113,133,0.55)]'
        }
      ]
    };
  }, [scopedSubmissions]);

  // Question-level accuracy breakdown when a specific exam is selected
  const questionStats = useMemo(() => {
    if (!selectedExam || !selectedExam.questions?.length || scopedSubmissions.length === 0) return [];
    return selectedExam.questions.map((q, idx) => {
      let answered = 0;
      let correct = 0;
      scopedSubmissions.forEach((sub) => {
        if (sub.answers && sub.answers[q.id] !== undefined) {
          answered += 1;
          if (sub.answers[q.id] === q.correctOption) {
            correct += 1;
          }
        }
      });
      const totalBasis = scopedSubmissions.length;
      const pct = totalBasis > 0 ? Math.round((correct / totalBasis) * 100) : 0;
      return {
        id: q.id,
        number: idx + 1,
        questionText: q.questionText,
        correct,
        answered,
        total: totalBasis,
        pct
      };
    });
  }, [selectedExam, scopedSubmissions]);

  const hardestQuestion = useMemo(() => {
    if (questionStats.length === 0) return null;
    return questionStats.reduce((worst, cur) => (cur.pct < worst.pct ? cur : worst), questionStats[0]);
  }, [questionStats]);

  // Filtered & sorted submission rows
  const filteredSubmissions = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    const list = scopedSubmissions.filter((s) => {
      if (q) {
        const matchStudent = (s.studentName || '').toLowerCase().includes(q);
        const matchExam = (s.examTitle || '').toLowerCase().includes(q);
        if (!matchStudent && !matchExam) return false;
      }
      if (tierFilter !== 'all') {
        const cls = getScoreClassification(Number(s.score) || 0);
        if (cls.key !== tierFilter) return false;
      }
      if (selectedBracketIndex !== null) {
        const sc = Number(s.score) || 0;
        const idx = sc >= 10 ? 9 : Math.max(0, Math.min(9, Math.floor(sc)));
        if (idx !== selectedBracketIndex) return false;
      }
      return true;
    });

    if (sortBy === 'highest') {
      return [...list].sort((a, b) => b.score - a.score);
    }
    if (sortBy === 'lowest') {
      return [...list].sort((a, b) => a.score - b.score);
    }
    return [...list].sort((a, b) => b.id - a.id);
  }, [scopedSubmissions, studentQuery, tierFilter, selectedBracketIndex, sortBy]);

  const inspectedExam = useMemo(() => {
    if (!inspectedSubmission) return null;
    return exams.find((e) => e.id === inspectedSubmission.examId) || null;
  }, [exams, inspectedSubmission]);

  // Verdict badge text + semantic icon
  const healthVerdict = useMemo(() => {
    if (analytics.count === 0) return null;
    if (analytics.passRate >= 80 && analytics.avg >= 7) {
      return {
        label: `Chất lượng tốt · ${analytics.passRate}% đạt chuẩn`,
        className: 'text-emerald-300'
      };
    }
    if (analytics.passRate >= 60) {
      return {
        label: `Ổn định · ${analytics.passRate}% đạt chuẩn`,
        className: 'text-cyan-300'
      };
    }
    return {
      label: `Cần ôn tập bổ sung · ${analytics.passRate}% đạt chuẩn`,
      className: 'text-rose-300'
    };
  }, [analytics]);

  return (
    <section
      id="exam-analytics-card"
      className="sf-card rounded-3xl overflow-hidden relative z-10"
    >
      {/* Top Analytical Header — Luxury Deep Navy Atelier */}
      <div
        className={`px-5 sm:px-6 py-4 sm:py-5 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden ${
          isTeacher ? 'sf-spectrum-header' : 'sf-spectrum-header-student'
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06] sf-spectrum-grid-overlay"
        />
        <div className="flex items-start gap-3.5 min-w-0 relative z-10">
          {isPage && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/18 text-cyan-200 hover:text-white border border-cyan-400/35 hover:border-cyan-300/60 text-xs font-extrabold uppercase tracking-wider shrink-0 transition cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>BACK</span>
            </button>
          )}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400/25 via-sky-500/20 to-indigo-500/30 text-cyan-200 border border-cyan-300/40 shadow-[0_0_24px_-4px_rgba(34,211,238,0.45)] flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold font-display text-white tracking-tight">
                {selectedExam ? (
                  <>
                    Chi tiết Phổ điểm:{' '}
                    <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
                      {selectedExam.title}
                    </span>
                  </>
                ) : isTeacher ? (
                  <>
                    Thẻ Phân tích Tiến độ &amp;{' '}
                    <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
                      Phổ điểm Đề thi
                    </span>
                  </>
                ) : (
                  <>
                    Thống kê Điểm số &amp;{' '}
                    <span className="bg-gradient-to-r from-cyan-300 via-indigo-200 to-emerald-300 bg-clip-text text-transparent">
                      Phổ điểm Luyện thi
                    </span>
                  </>
                )}
              </h2>
              {healthVerdict && (
                <span className={`inline-flex items-center gap-1 text-xs font-bold ${healthVerdict.className}`}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{healthVerdict.label}</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-1">
              <span className="text-sky-100/90 font-medium">{selectedExam ? selectedExam.subject : 'Tổng hợp toàn bộ đề thi'}</span>
              {selectedExam && (
                <>
                  <span aria-hidden="true" className="text-cyan-400/50">·</span>
                  <span className="tabular-nums">{selectedExam.durationMinutes} phút</span>
                  <span aria-hidden="true" className="text-cyan-400/50">·</span>
                  <span className="tabular-nums">{selectedExam.questions?.length || 0} câu hỏi</span>
                  <span aria-hidden="true" className="text-cyan-400/50">·</span>
                  <span>Giao cho {selectedExam.assignedTo}</span>
                </>
              )}
              <span aria-hidden="true" className="text-cyan-400/50">·</span>
              <span className="font-mono tabular-nums font-semibold text-cyan-200">
                {analytics.count} lượt nộp trực tuyến
              </span>
            </div>
          </div>
        </div>

        {/* Exam Selector & Quick Take Action */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 relative z-10">
          <label htmlFor="analytics-exam-select" className="text-xs font-semibold text-cyan-200/80 whitespace-nowrap">
            Kỳ thi:
          </label>
          <select
            id="analytics-exam-select"
            value={selectedExamId === 'all' ? 'all' : String(selectedExamId)}
            onChange={(e) => {
              const val = e.target.value;
              onSelectExamId(val === 'all' ? 'all' : Number(val));
              setSelectedBracketIndex(null);
              setTierFilter('all');
            }}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-cyan-400/35 bg-[#051024]/90 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 max-w-xs cursor-pointer"
          >
            <option value="all">Tất cả kỳ thi ({submissions.length} bài nộp)</option>
            {exams.map((ex) => {
              const subCount = submissions.filter((s) => s.examId === ex.id).length;
              return (
                <option key={ex.id} value={String(ex.id)}>
                  {ex.title} ({subCount} bài nộp)
                </option>
              );
            })}
          </select>

          {selectedExam && onTakeExam && (
            <button
              type="button"
              onClick={() => onTakeExam(selectedExam)}
              className="sf-neon-cta flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Vào thi</span>
            </button>
          )}
        </div>
      </div>

      {analytics.count === 0 ? (
        /* Empty State */
        <div className="px-6 py-12 text-center space-y-2.5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-cyan-400/70 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Chưa có dữ liệu bài nộp trực tuyến {selectedExam ? `cho "${selectedExam.title}"` : ''}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Ngay khi học sinh hoàn thành bài thi từ bảng đề thi hoặc thông báo được gửi đi, hệ thống sẽ tự động tổng hợp điểm số, dựng biểu đồ phổ điểm 0–10 và chẩn đoán chi tiết từng câu hỏi tại đây.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200/80 dark:divide-cyan-500/15">
          {/* Zone 1: 6-Metric Unified Hairline KPI Strip with Jewel Top Accents */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-cyan-500/15">
            <div className="p-4 sm:p-5 relative overflow-hidden">
              <span aria-hidden="true" className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 opacity-85" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Điểm trung bình
              </span>
              <p className="text-xl sm:text-2xl font-black font-mono tabular-nums bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-600 dark:from-cyan-300 dark:via-sky-300 dark:to-teal-200 bg-clip-text text-transparent mt-1">
                {analytics.avg.toFixed(2)}
                <span className="text-xs font-semibold text-slate-400 ml-1">/10</span>
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 block">
                Chính xác TB: {analytics.avgAccuracyPct}%
              </span>
            </div>

            <div className="p-4 sm:p-5 relative overflow-hidden">
              <span aria-hidden="true" className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-300 opacity-85" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                <span>Điểm cao nhất</span>
              </span>
              <p className="text-xl sm:text-2xl font-black font-mono tabular-nums bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-300 dark:to-cyan-300 bg-clip-text text-transparent mt-1">
                {analytics.maxScore.toFixed(1)}
                <span className="text-xs font-semibold text-slate-400 ml-1">/10</span>
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block truncate" title={(analytics as any).highestStudentName}>
                {(analytics as any).highestStudentName}
              </span>
            </div>

            <div className="p-4 sm:p-5 relative overflow-hidden">
              <span aria-hidden="true" className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-rose-400 via-amber-400 to-yellow-300 opacity-85" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                <span>Điểm thấp nhất</span>
              </span>
              <p className={`text-xl sm:text-2xl font-black font-mono tabular-nums mt-1 ${
                analytics.minScore < 5
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-amber-600 dark:text-amber-300'
              }`}>
                {analytics.minScore.toFixed(1)}
                <span className="text-xs font-semibold text-slate-400 ml-1">/10</span>
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block truncate" title={(analytics as any).lowestStudentName}>
                {(analytics as any).lowestStudentName}
              </span>
            </div>

            <div className="p-4 sm:p-5 relative overflow-hidden">
              <span aria-hidden="true" className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 opacity-85" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Trung vị &amp; Độ lệch (σ)
              </span>
              <p className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {analytics.median.toFixed(1)}
                <span className="text-xs font-semibold text-slate-400 ml-1">σ={analytics.stdDev.toFixed(2)}</span>
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 block">
                TB làm bài: {formatDuration(analytics.avgTimeSeconds)}
              </span>
            </div>

            <div className="p-4 sm:p-5 relative overflow-hidden">
              <span aria-hidden="true" className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-300 opacity-85" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Tỉ lệ Đạt (≥ 5.0)
              </span>
              <p className="text-xl sm:text-2xl font-black font-mono tabular-nums bg-gradient-to-r from-teal-600 to-emerald-500 dark:from-teal-300 dark:to-emerald-300 bg-clip-text text-transparent mt-1">
                {analytics.passRate}%
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 block">
                {analytics.passCount}/{analytics.count} bài đạt chuẩn
              </span>
            </div>

            <div className="p-4 sm:p-5 relative overflow-hidden">
              <span aria-hidden="true" className="pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300 opacity-85" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Tỉ lệ Giỏi (≥ 8.0)
              </span>
              <p className="text-xl sm:text-2xl font-black font-mono tabular-nums bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 dark:from-indigo-300 dark:via-violet-300 dark:to-cyan-300 bg-clip-text text-transparent mt-1">
                {analytics.excellentRate}%
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 block">
                {analytics.excellentCount}/{analytics.count} bài đạt Giỏi
              </span>
            </div>
          </div>

          {/* Zone 2: 12-Column Interactive Recharts Score Distribution & Tier Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-y lg:divide-y-0 divide-slate-200/80 dark:divide-cyan-500/15 items-stretch">
            {/* Left 7 cols: Museum-Grade Deep Navy Luminous Atelier Spectrum Chart */}
            <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col justify-between">
              <div
                className={`rounded-2xl p-5 sm:p-6 text-white flex flex-col justify-between gap-4 relative ${
                  isTeacher ? 'sf-spectrum-stage' : 'sf-spectrum-stage-student'
                }`}
              >
                {/* Architectural Hairline Grid Backdrop */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 sf-spectrum-grid-overlay opacity-75"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold font-display tracking-tight text-white">
                      Biểu đồ Phân tích Phổ điểm Trực quan{' '}
                      <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
                        (Thang 0 – 10)
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-300/85 mt-0.5">
                      Di chuột xem chi tiết hoặc bấm cột để lọc · Đỉnh phổ điểm:{' '}
                      <strong className="text-amber-300 font-mono tabular-nums">{analytics.peakBracketLabel}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedBracketIndex !== null && (
                      <button
                        type="button"
                        onClick={() => setSelectedBracketIndex(null)}
                        className="text-xs font-bold text-amber-300 hover:text-amber-200 hover:underline cursor-pointer"
                      >
                        Bỏ lọc mốc {analytics.brackets[selectedBracketIndex]?.label}
                      </button>
                    )}
                    <div className="inline-flex rounded-xl border border-cyan-400/30 bg-[#030917]/80 p-0.5 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setChartScale('brackets');
                          setSelectedBracketIndex(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          chartScale === 'brackets'
                            ? 'bg-gradient-to-r from-cyan-400 to-sky-400 text-[#031126] shadow-[0_0_14px_rgba(34,211,238,0.45)]'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        10 khoảng điểm
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChartScale('integer');
                          setSelectedBracketIndex(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          chartScale === 'integer'
                            ? 'bg-gradient-to-r from-cyan-400 to-sky-400 text-[#031126] shadow-[0_0_14px_rgba(34,211,238,0.45)]'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Từng mốc 0–10
                      </button>
                    </div>
                  </div>
                </div>

                {/* Interactive Recharts Histogram + Iridescent Spectrum Density Curve */}
                <div className="h-64 w-full relative z-10">
                  {(() => {
                    const chartData =
                      chartScale === 'brackets'
                        ? (analytics.brackets as Array<{
                            index: number;
                            label: string;
                            count: number;
                            pct: number;
                            fill: string;
                            solidColor?: string;
                            sampleNames: string[];
                            min?: number;
                            max?: number;
                            inclusiveMax?: boolean;
                          }>)
                        : ((analytics as any).integerSpectrum as Array<{
                            index: number;
                            label: string;
                            count: number;
                            pct: number;
                            fill: string;
                            solidColor?: string;
                            sampleNames: string[];
                          }>);

                    const avgBracketLabel =
                      chartScale === 'brackets'
                        ? analytics.brackets.find(
                            (b) => analytics.avg >= b.min && (b.inclusiveMax ? analytics.avg <= b.max : analytics.avg < b.max)
                          )?.label
                        : `${Math.max(0, Math.min(10, Math.round(analytics.avg)))}đ`;

                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 22, right: 12, left: -18, bottom: 4 }}
                          onClick={(state: any) => {
                            if (chartScale !== 'brackets') return;
                            const clickedIdx = state?.activePayload?.[0]?.payload?.index;
                            if (typeof clickedIdx === 'number') {
                              const clickedItem = chartData.find((d) => d.index === clickedIdx);
                              if (clickedItem && clickedItem.count > 0) {
                                setSelectedBracketIndex((prev) => (prev === clickedIdx ? null : clickedIdx));
                              }
                            }
                          }}
                        >
                          <defs>
                            {/* Jewel-Toned Multi-Stop Vertical Bar Gradients */}
                            <linearGradient id="sfGradExcellent" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#a7f3d0" stopOpacity={1} />
                              <stop offset="28%" stopColor="#2dd4bf" stopOpacity={0.98} />
                              <stop offset="68%" stopColor="#10b981" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="#047857" stopOpacity={0.85} />
                            </linearGradient>
                            <linearGradient id="sfGradGood" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#bae6fd" stopOpacity={1} />
                              <stop offset="28%" stopColor="#38bdf8" stopOpacity={0.98} />
                              <stop offset="68%" stopColor="#0284c7" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="#1e40af" stopOpacity={0.85} />
                            </linearGradient>
                            <linearGradient id="sfGradAverage" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#fef08a" stopOpacity={1} />
                              <stop offset="30%" stopColor="#fbbf24" stopOpacity={0.98} />
                              <stop offset="72%" stopColor="#d97706" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="#78350f" stopOpacity={0.85} />
                            </linearGradient>
                            <linearGradient id="sfGradWeak" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#fecdd3" stopOpacity={1} />
                              <stop offset="30%" stopColor="#fb7185" stopOpacity={0.98} />
                              <stop offset="72%" stopColor="#e11d48" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="#881337" stopOpacity={0.85} />
                            </linearGradient>
                            <linearGradient id="sfGradEmpty" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(148,163,184,0.22)" />
                              <stop offset="100%" stopColor="rgba(148,163,184,0.04)" />
                            </linearGradient>

                            {/* Iridescent Horizontal Spectrum Spline Curve */}
                            <linearGradient id="sfSpectrumWaveStroke" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#fb7185" />
                              <stop offset="42%" stopColor="#fbbf24" />
                              <stop offset="70%" stopColor="#38bdf8" />
                              <stop offset="100%" stopColor="#34d399" />
                            </linearGradient>
                            <linearGradient id="sfSpectrumWaveFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.32} />
                              <stop offset="55%" stopColor="#6366f1" stopOpacity={0.12} />
                              <stop offset="100%" stopColor="#040b1e" stopOpacity={0} />
                            </linearGradient>
                          </defs>

                          <CartesianGrid
                            strokeDasharray="3 4"
                            stroke="rgba(148,163,184,0.14)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                            axisLine={{ stroke: 'rgba(56,189,248,0.28)' }}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(56, 189, 248, 0.08)' }}
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const item = payload[0].payload;
                              return (
                                <div className="rounded-xl border border-cyan-400/45 bg-[#040c1f]/95 backdrop-blur-md px-3.5 py-2.5 shadow-[0_18px_40px_-8px_rgba(2,6,23,0.9)] text-xs space-y-1 max-w-xs">
                                  <div className="font-extrabold text-white flex items-center justify-between gap-4">
                                    <span className="inline-flex items-center gap-1.5">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{
                                          backgroundColor: item.solidColor || '#38bdf8',
                                          boxShadow: `0 0 10px ${item.solidColor || '#38bdf8'}`
                                        }}
                                      />
                                      <span>Mốc {item.label} điểm</span>
                                    </span>
                                    <span className="font-mono tabular-nums text-cyan-300">
                                      {item.count} HS ({item.pct}%)
                                    </span>
                                  </div>
                                  {item.sampleNames && item.sampleNames.length > 0 && (
                                    <div className="text-[11px] text-slate-300 pt-1 border-t border-white/10">
                                      Tiêu biểu: {item.sampleNames.join(', ')}
                                      {item.count > item.sampleNames.length ? ` (+${item.count - item.sampleNames.length})` : ''}
                                    </div>
                                  )}
                                </div>
                              );
                            }}
                          />
                          {avgBracketLabel && (
                            <ReferenceLine
                              x={avgBracketLabel}
                              stroke="#fbbf24"
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{
                                value: `TB ${analytics.avg.toFixed(1)}`,
                                position: 'top',
                                fill: '#fde68a',
                                fontSize: 10,
                                fontWeight: 800
                              }}
                            />
                          )}
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="url(#sfSpectrumWaveStroke)"
                            strokeWidth={2.5}
                            fill="url(#sfSpectrumWaveFill)"
                            dot={false}
                            activeDot={{ r: 5, fill: '#fef08a', stroke: '#040b1e', strokeWidth: 2 }}
                          />
                          <Bar
                            dataKey="count"
                            radius={[7, 7, 2, 2]}
                            maxBarSize={36}
                            className={chartScale === 'brackets' ? 'cursor-pointer' : ''}
                          >
                            {chartData.map((entry) => {
                              const isDimmed =
                                chartScale === 'brackets' &&
                                selectedBracketIndex !== null &&
                                selectedBracketIndex !== entry.index;
                              return (
                                <Cell
                                  key={`cell-${entry.index}`}
                                  fill={entry.count === 0 ? 'url(#sfGradEmpty)' : entry.fill}
                                  fillOpacity={isDimmed ? 0.28 : 0.96}
                                />
                              );
                            })}
                          </Bar>
                        </ComposedChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>

                {/* Spectrum Legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2.5 border-t border-cyan-400/15 text-[11px] text-slate-300 relative z-10">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-tr from-rose-600 to-pink-300 shadow-[0_0_8px_rgba(251,113,133,0.65)]" />
                    <span>&lt; 5.0 (Chưa đạt)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-tr from-amber-600 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                    <span>5.0 – 6.4 (Trung bình)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-tr from-blue-600 to-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.65)]" />
                    <span>6.5 – 7.9 (Khá)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-tr from-emerald-500 to-teal-200 shadow-[0_0_8px_rgba(45,212,191,0.65)]" />
                    <span>≥ 8.0 (Giỏi)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Tier Breakdown & Smart Diagnostic Summary */}
            <div className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-extrabold font-display text-slate-900 dark:text-white">
                    Phân tầng Năng lực (Lọc nhanh)
                  </h3>
                  {tierFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setTierFilter('all')}
                      className="text-xs font-bold text-blue-600 dark:text-cyan-300 hover:underline cursor-pointer"
                    >
                      Hiện tất cả
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {analytics.tiers.map((tier) => {
                    const isActive = tierFilter === tier.key;
                    return (
                      <button
                        key={tier.key}
                        type="button"
                        onClick={() => setTierFilter(isActive ? 'all' : tier.key)}
                        className={`w-full text-left p-2.5 rounded-xl transition cursor-pointer ${
                          isActive
                            ? 'bg-sky-50/90 dark:bg-cyan-500/15 ring-1 ring-sky-400 dark:ring-cyan-400/55 shadow-xs'
                            : 'hover:bg-slate-50/90 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${(tier as any).swatchClass || ''}`} />
                            <span>{tier.label}</span>
                          </span>
                          <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                            {tier.count} bài ({tier.pct}%)
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-200/80 dark:bg-[#040c1f] border border-slate-200/70 dark:border-cyan-500/15 overflow-hidden p-[1px]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${tier.barColor}`}
                            style={{ width: `${tier.pct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Smart Pedagogical Insight */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-cyan-500/15 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-cyan-200">
                  <Target className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
                  <span>Nhận định &amp; Theo dõi Tiến độ</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <li>
                    • Phổ điểm tập trung cao nhất ở khoảng <strong className="text-slate-900 dark:text-amber-300">{analytics.peakBracketLabel}</strong>.
                  </li>
                  <li>
                    • Tỉ lệ đạt chuẩn là <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-300">{analytics.passRate}%</strong>; độ lệch chuẩn <strong className="font-mono tabular-nums text-slate-900 dark:text-cyan-200">{analytics.stdDev.toFixed(2)}</strong> ({analytics.stdDev <= 1.2 ? 'mặt bằng lớp đồng đều' : 'phân hóa năng lực rõ rệt'}).
                  </li>
                  {hardestQuestion && (
                    <li>
                      • Câu cần lưu ý nhất: <strong className="text-amber-700 dark:text-amber-300">Câu {hardestQuestion.number}</strong> ({hardestQuestion.pct}% trả lời đúng).
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Zone 3: Question-Level Diagnostic Grid (when a specific exam is selected) */}
          {questionStats.length > 0 && (
            <div className="p-5 sm:p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold font-display text-slate-900 dark:text-white">
                    Tỉ lệ chính xác theo từng câu hỏi ({questionStats.length} câu)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Giúp giáo viên nhận diện nhanh câu hỏi hoặc chuyên đề nhiều học sinh mất điểm
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-2.5">
                {questionStats.map((qs) => {
                  const isLow = qs.pct < 50;
                  const isMid = qs.pct >= 50 && qs.pct < 75;
                  return (
                    <div
                      key={qs.id}
                      title={`Câu ${qs.number}: ${qs.correct}/${qs.total} đúng (${qs.pct}%)\n${qs.questionText}`}
                      className="p-2.5 rounded-xl border border-slate-200/80 dark:border-cyan-500/20 bg-slate-50/70 dark:bg-[#051024]/80 hover:border-sky-400/60 dark:hover:border-cyan-400/50 transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Câu {qs.number}
                        </span>
                        <span
                          className={`font-mono tabular-nums font-extrabold ${
                            isLow
                              ? 'text-rose-600 dark:text-rose-400'
                              : isMid
                              ? 'text-amber-600 dark:text-amber-300'
                              : 'text-emerald-600 dark:text-emerald-300'
                          }`}
                        >
                          {qs.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-[#030917] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isLow ? 'sf-tier-bar-weak' : isMid ? 'sf-tier-bar-average' : 'sf-tier-bar-excellent'
                          }`}
                          style={{ width: `${qs.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Zone 4: Student Submissions & Progress Data Grid */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                  Chi tiết Điểm số &amp; Tiến độ làm bài ({filteredSubmissions.length}/{scopedSubmissions.length})
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Tìm tên học sinh, đề thi..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-cyan-500/30 bg-slate-50 dark:bg-[#051024] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 w-48"
                  />
                </div>

                <div className="relative flex items-center">
                  <Filter className="w-3 h-3 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="pl-7 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-cyan-500/30 bg-slate-50 dark:bg-[#051024] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  >
                    <option value="newest">Mới nộp nhất</option>
                    <option value="highest">Điểm cao → thấp</option>
                    <option value="lowest">Điểm thấp → cao</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200/80 dark:border-cyan-500/20 rounded-2xl">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-cyan-500/20 bg-slate-50/90 dark:bg-[#071830] text-[11px] font-bold uppercase text-slate-600 dark:text-cyan-300 tracking-wider">
                    <th className="py-2.5 px-4">Học sinh</th>
                    <th className="py-2.5 px-3">Đề thi</th>
                    <th className="py-2.5 px-3 text-right">Điểm số</th>
                    <th className="py-2.5 px-3 text-right">Số câu đúng</th>
                    <th className="py-2.5 px-3 text-right">Thời gian</th>
                    <th className="py-2.5 px-3">Đánh giá tiến độ</th>
                    <th className="py-2.5 px-3">Nộp lúc</th>
                    <th className="py-2.5 px-4 text-right">Bài làm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-cyan-500/10 text-xs">
                  {filteredSubmissions.map((sub) => {
                    const cls = getScoreClassification(Number(sub.score) || 0);
                    return (
                      <tr
                        key={sub.id}
                        className="hover:bg-slate-50/90 dark:hover:bg-[#091f3a]/50 transition"
                      >
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {sub.studentName || 'Học sinh'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-[220px] truncate">
                          {sub.examTitle}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono tabular-nums font-black ${cls.textClass}`}>
                          {Number(sub.score).toFixed(1)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                          {sub.correctCount}/{sub.totalQuestions}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {formatDuration(sub.timeSpentSeconds)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 font-semibold ${cls.textClass}`}>
                            {sub.score >= 5 ? (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{cls.label}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {sub.submittedAt}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setInspectedSubmission(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-cyan-500/15 hover:bg-blue-100 dark:hover:bg-cyan-500/25 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem bài</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSubmissions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        Không có bài nộp nào khớp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Student Submission Inspector Modal */}
      {inspectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#071328] border border-slate-200 dark:border-cyan-500/30 rounded-3xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-cyan-500/20 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-[#060f24]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/15 text-blue-600 dark:text-cyan-300 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                    Bài làm của {inspectedSubmission.studentName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {inspectedSubmission.examTitle} · Điểm: <strong className="font-mono tabular-nums text-slate-900 dark:text-cyan-300">{inspectedSubmission.score}/10</strong> · Đúng {inspectedSubmission.correctCount}/{inspectedSubmission.totalQuestions} câu · <Clock className="w-3 h-3 inline mr-0.5" />{formatDuration(inspectedSubmission.timeSpentSeconds)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedSubmission(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
              {inspectedExam && inspectedExam.questions?.length > 0 ? (
                inspectedExam.questions.map((q, idx) => {
                  const chosen = inspectedSubmission.answers?.[q.id];
                  const isCorrect = chosen === q.correctOption;
                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-cyan-500/20 bg-slate-50/70 dark:bg-[#051024]/80 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-700 dark:text-cyan-300">
                          Câu {idx + 1}
                        </span>
                        <span
                          className={`font-bold ${
                            isCorrect
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isCorrect
                            ? '✓ Chính xác'
                            : chosen !== undefined
                            ? `✗ Chọn ${String.fromCharCode(65 + chosen)} (Đáp án ${String.fromCharCode(65 + q.correctOption)})`
                            : `Chưa trả lời (Đáp án ${String.fromCharCode(65 + q.correctOption)})`}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white leading-relaxed">
                        {q.questionText}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {q.options.map((opt, oIdx) => {
                          const isKey = oIdx === q.correctOption;
                          const isChosen = oIdx === chosen;
                          return (
                            <div
                              key={oIdx}
                              className={`px-3 py-2 rounded-xl border text-[11px] ${
                                isKey
                                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold'
                                  : isChosen
                                  ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 line-through'
                                  : 'border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#091832] text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  Đề thi gốc không còn câu hỏi chi tiết để đối chiếu từng câu. Điểm ghi nhận: <strong className="font-mono">{inspectedSubmission.score}/10</strong> ({inspectedSubmission.correctCount}/{inspectedSubmission.totalQuestions} câu đúng).
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
