import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowLeft,
  Users,
  Plus,
  Trash2,
  Pencil,
  Check,
  Search,
  BarChart3,
  Filter
} from 'lucide-react';
import { TeacherClass, TeacherStudent } from '../types';
import {
  EXAM_CATEGORIES,
  ExamCategoryKey,
  SemesterKey,
  getScoreForCategory,
  getStudentScoresBySemester,
  calcYearlyAvg,
  isValidScore
} from '../utils/gradebook';

interface TeacherClassDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClass: TeacherClass | null;
  onAddStudent: (classId: string, student: Omit<TeacherStudent, 'id'>) => void;
  onOpenAiExam: () => void;
  onEditStudent: (student: TeacherStudent, semester?: SemesterKey) => void;
  onDeleteStudent?: (classId: string, studentId: string) => void;
  onDeleteClass?: (classId: string) => void;
  onRenameClass?: (classId: string, newName: string) => void;
  isPage?: boolean;
}

type TierFilter = 'all' | 'good' | 'fair' | 'average' | 'weak' | 'missing';

const formatScoreCell = (val?: number | null) => {
  if (!isValidScore(val)) return '·';
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
};

const getScoreBadgeStyle = (val: number | null) => {
  if (val === null) {
    return 'text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-slate-800/80';
  }
  if (val >= 8) {
    return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-500/35';
  }
  if (val >= 6.5) {
    return 'text-sky-700 dark:text-cyan-300 bg-sky-50 dark:bg-cyan-950/55 border border-sky-200/80 dark:border-cyan-500/35';
  }
  if (val >= 5) {
    return 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-500/35';
  }
  return 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-500/35';
};

const getClassificationLabel = (val: number | null) => {
  if (val === null) return 'Chưa có điểm';
  if (val >= 8) return 'Tốt';
  if (val >= 6.5) return 'Khá';
  if (val >= 5) return 'Đạt';
  return 'Chưa đạt';
};

export const TeacherClassDetailModal: React.FC<TeacherClassDetailModalProps> = ({
  isOpen,
  onClose,
  selectedClass,
  onAddStudent,
  onOpenAiExam,
  onEditStudent,
  onDeleteStudent,
  onDeleteClass,
  onRenameClass,
  isPage = false
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newRollNumber, setNewRollNumber] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [activeSemester, setActiveSemester] = useState<SemesterKey>('hk1');
  const [activeCategory, setActiveCategory] = useState<ExamCategoryKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [confirmDeleteStudentId, setConfirmDeleteStudentId] = useState<string | null>(null);

  useEffect(() => {
    setIsRenaming(false);
    setRenameValue(selectedClass?.name || '');
    setActiveSemester('hk1');
    setActiveCategory('all');
    setSearchQuery('');
    setTierFilter('all');
    setIsAdding(false);
    setConfirmDeleteStudentId(null);
    if (isPage && isOpen && selectedClass?.id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedClass?.id, isOpen, isPage]);

  useEffect(() => {
    setRenameValue(selectedClass?.name || '');
  }, [selectedClass?.name]);

  const activeCategoryMeta = useMemo(
    () => EXAM_CATEGORIES.find((c) => c.key === activeCategory) || EXAM_CATEGORIES[0],
    [activeCategory]
  );

  // Compute score distribution for the selected exam category
  const distributionStats = useMemo(() => {
    if (!selectedClass) {
      return {
        scoredCount: 0,
        missingCount: 0,
        avg: 0,
        max: null as number | null,
        min: null as number | null,
        passCount: 0,
        goodCount: 0,
        fairCount: 0,
        averageCount: 0,
        weakCount: 0,
        bins: [] as Array<{ label: string; count: number; color: string; tier: TierFilter; rangeLabel: string }>,
        exactBuckets: [] as Array<{ scoreLabel: string; count: number }>
      };
    }

    const values: number[] = [];
    let missingCount = 0;
    let goodCount = 0;
    let fairCount = 0;
    let averageCount = 0;
    let weakCount = 0;

    // 0..10 integer/rounded score bars for exact distribution
    const exactCounts: Record<number, number> = {};
    for (let s = 0; s <= 10; s++) exactCounts[s] = 0;

    selectedClass.students.forEach((st) => {
      const score = getScoreForCategory(st, activeCategory, activeSemester);
      if (score === null) {
        missingCount += 1;
        return;
      }
      values.push(score);
      if (score >= 8) goodCount += 1;
      else if (score >= 6.5) fairCount += 1;
      else if (score >= 5) averageCount += 1;
      else weakCount += 1;

      const rounded = Math.max(0, Math.min(10, Math.round(score)));
      exactCounts[rounded] = (exactCounts[rounded] || 0) + 1;
    });

    const scoredCount = values.length;
    const avg =
      scoredCount > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / scoredCount) * 10) / 10
        : 0;
    const max = scoredCount > 0 ? Math.max(...values) : null;
    const min = scoredCount > 0 ? Math.min(...values) : null;
    const passCount = goodCount + fairCount + averageCount;

    const bins = [
      {
        label: 'Tốt (≥ 8.0)',
        rangeLabel: '8.0 - 10',
        count: goodCount,
        color: 'sf-tier-bar-excellent',
        swatchClass: 'bg-gradient-to-tr from-emerald-500 to-teal-300 shadow-[0_0_8px_rgba(45,212,191,0.65)]',
        tier: 'good' as TierFilter
      },
      {
        label: 'Khá (6.5 - 7.9)',
        rangeLabel: '6.5 - 7.9',
        count: fairCount,
        color: 'sf-tier-bar-good',
        swatchClass: 'bg-gradient-to-tr from-blue-600 to-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.65)]',
        tier: 'fair' as TierFilter
      },
      {
        label: 'Đạt (5.0 - 6.4)',
        rangeLabel: '5.0 - 6.4',
        count: averageCount,
        color: 'sf-tier-bar-average',
        swatchClass: 'bg-gradient-to-tr from-amber-600 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
        tier: 'average' as TierFilter
      },
      {
        label: 'Chưa đạt (< 5.0)',
        rangeLabel: '< 5.0',
        count: weakCount,
        color: 'sf-tier-bar-weak',
        swatchClass: 'bg-gradient-to-tr from-rose-600 to-pink-300 shadow-[0_0_8px_rgba(251,113,133,0.6)]',
        tier: 'weak' as TierFilter
      }
    ];

    const exactBuckets = Object.keys(exactCounts)
      .map(Number)
      .sort((a, b) => a - b)
      .map((score) => ({
        scoreLabel: String(score),
        count: exactCounts[score]
      }));

    return {
      scoredCount,
      missingCount,
      avg,
      max,
      min,
      passCount,
      goodCount,
      fairCount,
      averageCount,
      weakCount,
      bins,
      exactBuckets
    };
  }, [selectedClass, activeCategory, activeSemester]);

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    const q = searchQuery.trim().toLowerCase();

    return selectedClass.students
      .map((st, idx) => ({ st, order: idx + 1 }))
      .filter(({ st }) => {
        if (q) {
          const matchesName = st.name.toLowerCase().includes(q);
          const matchesRoll = st.rollNumber.toLowerCase().includes(q);
          if (!matchesName && !matchesRoll) return false;
        }
        const score = getScoreForCategory(st, activeCategory, activeSemester);
        if (tierFilter === 'missing') return score === null;
        if (tierFilter === 'good') return score !== null && score >= 8;
        if (tierFilter === 'fair') return score !== null && score >= 6.5 && score < 8;
        if (tierFilter === 'average') return score !== null && score >= 5 && score < 6.5;
        if (tierFilter === 'weak') return score !== null && score < 5;
        return true;
      });
  }, [selectedClass, searchQuery, activeCategory, activeSemester, tierFilter]);

  if (!isOpen || !selectedClass) return null;

  const maxExactCount = Math.max(
    1,
    ...distributionStats.exactBuckets.map((b) => b.count)
  );

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    onAddStudent(selectedClass.id, {
      name: newStudentName.trim(),
      rollNumber:
        newRollNumber.trim() ||
        `${selectedClass.name.replace(/^Toán\s+/i, '')}-${String(selectedClass.students.length + 1).padStart(2, '0')}`,
      avgScore: 0,
      completedTasks: 0,
      totalTasks: 4,
      status: 'average',
      scores: {
        tx1: null,
        tx2: null,
        tx3: null,
        tx4: null,
        gk: null,
        ck: null
      },
      scoresHk2: {
        tx1: null,
        tx2: null,
        tx3: null,
        tx4: null,
        gk: null,
        ck: null
      },
      avgScoreHk2: 0
    });

    setNewStudentName('');
    setNewRollNumber('');
    setIsAdding(false);
  };

  return (
    <div
      className={
        isPage
          ? 'w-full space-y-5'
          : 'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs'
      }
    >
      <div
        className={
          isPage
            ? 'space-y-5'
            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden'
        }
      >
        {/* Top Page / Modal Header */}
        <div
          className={
            isPage
              ? 'sf-navy-hero-banner sf-shimmer-card sf-panel-enter p-5 sm:p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white'
              : 'p-4 sm:p-5 border-b border-cyan-400/25 flex items-center justify-between bg-gradient-to-r from-[#040e24] via-[#091d42] to-[#0d2b61] text-white shrink-0'
          }
        >
          <div className="flex items-center gap-3 min-w-0 flex-wrap sm:flex-nowrap">
            {isPage && (
              <button
                type="button"
                data-sound="nav"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/18 text-cyan-200 hover:text-white border border-cyan-400/35 hover:border-cyan-300/60 text-xs font-black tracking-wide transition-all duration-150 active:scale-95 shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                title="Quay lại trang trước"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>BACK</span>
              </button>
            )}
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-500 text-[#031126] flex items-center justify-center font-display font-extrabold text-base shadow-[0_0_20px_rgba(34,211,238,0.4)] shrink-0 tabular-nums">
              {selectedClass.number}
            </div>
            <div className="min-w-0">
              {isRenaming ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && renameValue.trim()) {
                        e.preventDefault();
                        onRenameClass?.(selectedClass.id, renameValue.trim());
                        setIsRenaming(false);
                      } else if (e.key === 'Escape') {
                        setIsRenaming(false);
                        setRenameValue(selectedClass.name);
                      }
                    }}
                    autoFocus
                    className="px-3 py-1.5 text-sm font-bold rounded-xl border border-cyan-400 bg-[#051128] text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <button
                    type="button"
                    data-sound="success"
                    onClick={() => {
                      if (renameValue.trim()) {
                        onRenameClass?.(selectedClass.id, renameValue.trim());
                        setIsRenaming(false);
                      }
                    }}
                    disabled={!renameValue.trim()}
                    className="p-2 rounded-xl bg-emerald-500 text-[#031126] hover:bg-emerald-400 disabled:opacity-50 transition cursor-pointer"
                    title="Lưu tên lớp"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    data-sound="tap"
                    onClick={() => {
                      setIsRenaming(false);
                      setRenameValue(selectedClass.name);
                    }}
                    className="p-2 rounded-xl bg-white/10 text-slate-200 hover:bg-white/20 transition cursor-pointer"
                    title="Hủy"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-extrabold font-display text-white tracking-tight">
                    Chi tiết &amp; Phổ điểm —{' '}
                    <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
                      {selectedClass.name}
                    </span>
                  </h2>
                  {onRenameClass && (
                    <button
                      type="button"
                      data-sound="tap"
                      onClick={() => {
                        setRenameValue(selectedClass.name);
                        setIsRenaming(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/18 border border-cyan-300/30 text-[11px] font-semibold text-cyan-200 hover:text-white transition cursor-pointer whitespace-nowrap"
                      title="Đổi tên lớp"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Đổi tên lớp</span>
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                {selectedClass.room || 'Phòng học chính'} · {selectedClass.schedule || 'Lịch học tiêu chuẩn'} · Sĩ số:{' '}
                <span className="font-mono tabular-nums font-semibold text-cyan-200">{selectedClass.students.length} học sinh</span>
              </p>
            </div>
          </div>

          {isPage ? (
            <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
              <button
                type="button"
                data-sound="success"
                onClick={onOpenAiExam}
                className="sf-neon-cta min-h-[40px] flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap cursor-pointer"
              >
                <span>✨ Tạo đề thi riêng cho lớp</span>
              </button>
              {onDeleteClass && (
                <button
                  type="button"
                  data-sound="tap"
                  onClick={() => {
                    onDeleteClass(selectedClass.id);
                    onClose();
                  }}
                  className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-rose-500/15 text-rose-200 border border-rose-400/35 text-xs font-bold hover:bg-rose-600 hover:text-white hover:border-rose-500 transition cursor-pointer whitespace-nowrap"
                  title="Giải tán / Xóa lớp học này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Giải tán lớp</span>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className={isPage ? 'space-y-5' : 'flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar'}>
          {/* Semester Switcher (HKI / HKII) */}
          <div className="sf-teacher-surface sf-panel-enter flex items-center justify-between flex-wrap gap-2.5 p-3 sm:p-3.5 rounded-2xl">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-[#050e20] border border-slate-200/80 dark:border-cyan-500/20">
              <button
                type="button"
                data-sound="toggle"
                onClick={() => {
                  setActiveSemester('hk1');
                  setTierFilter('all');
                  setConfirmDeleteStudentId(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeSemester === 'hk1'
                    ? 'bg-gradient-to-r from-[#071836] to-[#0f3470] dark:from-cyan-400 dark:to-sky-400 text-white dark:text-[#031126] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Học kỳ I (HKI)
              </button>
              <button
                type="button"
                data-sound="toggle"
                onClick={() => {
                  setActiveSemester('hk2');
                  setTierFilter('all');
                  setConfirmDeleteStudentId(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeSemester === 'hk2'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-cyan-400 text-white dark:text-[#031126] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Học kỳ II (HKII)
              </button>
            </div>
            <span className="text-xs text-slate-500 dark:text-cyan-200/75 pr-1">
              {activeSemester === 'hk1'
                ? 'Đang xem phổ điểm & sổ điểm Học kỳ I'
                : 'Đang xem sổ điểm Học kỳ II · Tự động tính ĐTB Cả năm (HKI + 2×HKII)/3'}
            </span>
          </div>

          {/* Exam Type Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                <span className="font-display text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Phân loại theo dạng bài kiểm tra ({activeSemester === 'hk1' ? 'Học kỳ I' : 'Học kỳ II'})
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {activeCategoryMeta.description} ·{' '}
                <strong className="text-sky-700 dark:text-cyan-300">{activeCategoryMeta.coefficientLabel}</strong>
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {EXAM_CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat.key;
                const badgeTone =
                  cat.group === 'ĐDGtx'
                    ? 'border-sky-200/90 dark:border-cyan-500/30'
                    : cat.group === 'ĐDGgk'
                    ? 'border-indigo-200/90 dark:border-indigo-400/30'
                    : cat.group === 'ĐDGck'
                    ? 'border-rose-200/90 dark:border-rose-400/30'
                    : 'border-slate-200/90 dark:border-slate-700';

                return (
                  <button
                    key={cat.key}
                    type="button"
                    data-sound="toggle"
                    onClick={() => {
                      setActiveCategory(cat.key);
                      setTierFilter('all');
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#071836] to-[#0f3470] dark:from-cyan-400 dark:to-sky-400 text-white dark:text-[#031126] border-cyan-400/50 shadow-[0_6px_18px_-6px_rgba(6,182,212,0.45)]'
                        : `bg-white/95 dark:bg-[#08152d] text-slate-700 dark:text-slate-200 hover:border-sky-400 dark:hover:border-cyan-400/60 ${badgeTone}`
                    }`}
                  >
                    {cat.group !== 'Tổng hợp' && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-white/15 dark:bg-[#031126]/15 text-cyan-200 dark:text-[#031126]'
                            : cat.group === 'ĐDGtx'
                            ? 'bg-sky-50 text-sky-700 dark:bg-cyan-500/15 dark:text-cyan-300'
                            : cat.group === 'ĐDGgk'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                        }`}
                      >
                        {cat.group}
                      </span>
                    )}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phổ điểm chi tiết Panel — Luminous Atelier Spectrum */}
          <div className="sf-teacher-surface sf-panel-enter p-4 sm:p-6 rounded-3xl space-y-5">
            {/* Summary KPIs for the chosen exam category */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
              <div className="sf-teacher-kpi p-4 rounded-2xl">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-3.5 right-3.5 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 opacity-85"
                />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-cyan-200/75 block truncate">
                  Điểm TB ({activeCategoryMeta.shortLabel})
                </span>
                <p className="font-display text-xl sm:text-2xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-blue-700 via-sky-600 to-cyan-600 dark:from-cyan-300 dark:via-sky-300 dark:to-teal-200 bg-clip-text text-transparent mt-1">
                  {distributionStats.scoredCount > 0 ? `${distributionStats.avg}/10` : '—'}
                </p>
              </div>

              <div className="sf-teacher-kpi p-4 rounded-2xl">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-3.5 right-3.5 h-[2px] rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 opacity-85"
                />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-cyan-200/75 block truncate">
                  Đã có điểm
                </span>
                <p className="font-display text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                  {distributionStats.scoredCount}/{selectedClass.students.length}
                </p>
              </div>

              <div className="sf-teacher-kpi p-4 rounded-2xl">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-3.5 right-3.5 h-[2px] rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-300 opacity-85"
                />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-cyan-200/75 block truncate">
                  Cao nhất / Thấp nhất
                </span>
                <p className="font-display text-xl sm:text-2xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-300 dark:to-cyan-300 bg-clip-text text-transparent mt-1">
                  {distributionStats.max !== null
                    ? `${distributionStats.max} / ${distributionStats.min}`
                    : '—'}
                </p>
              </div>

              <div className="sf-teacher-kpi p-4 rounded-2xl">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-3.5 right-3.5 h-[2px] rounded-full bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-300 opacity-85"
                />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-cyan-200/75 block truncate">
                  Đạt (≥ 5.0)
                </span>
                <p className="font-display text-xl sm:text-2xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-teal-600 to-emerald-500 dark:from-teal-300 dark:to-emerald-300 bg-clip-text text-transparent mt-1">
                  {distributionStats.scoredCount > 0
                    ? `${Math.round((distributionStats.passCount / distributionStats.scoredCount) * 100)}%`
                    : '—'}
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 ml-1.5">
                    ({distributionStats.passCount})
                  </span>
                </p>
              </div>

              <div className="sf-teacher-kpi p-4 rounded-2xl col-span-2 sm:col-span-1">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-3.5 right-3.5 h-[2px] rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300 opacity-85"
                />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-cyan-200/75 block truncate">
                  Tốt (≥ 8.0)
                </span>
                <p className="font-display text-xl sm:text-2xl font-extrabold font-mono tabular-nums bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 dark:from-indigo-300 dark:via-violet-300 dark:to-cyan-300 bg-clip-text text-transparent mt-1">
                  {distributionStats.scoredCount > 0
                    ? `${Math.round((distributionStats.goodCount / distributionStats.scoredCount) * 100)}%`
                    : '—'}
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 ml-1.5">
                    ({distributionStats.goodCount})
                  </span>
                </p>
              </div>
            </div>

            {/* Chart + Tier Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Bar chart 0..10 on Luminous Atelier Spectrum Canvas */}
              <div className="lg:col-span-7 sf-spectrum-stage p-5 rounded-2xl text-white flex flex-col justify-between relative overflow-hidden">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 sf-spectrum-grid-overlay opacity-75"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-5 bottom-11 border-b border-dashed border-cyan-300/20"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-5 bottom-24 border-b border-dashed border-cyan-300/10"
                />

                <div className="flex items-center justify-between gap-2 flex-wrap mb-3 relative z-10">
                  <span className="font-display text-sm font-bold text-white">
                    Biểu đồ phổ điểm ({activeSemester === 'hk1' ? 'HKI' : 'HKII'}) —{' '}
                    <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
                      {activeCategoryMeta.label}
                    </span>
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-amber-300/90 font-semibold">
                    {distributionStats.scoredCount > 0 ? `TB lớp: ${distributionStats.avg}/10 · Thang 0–10` : 'Thang điểm 0–10'}
                  </span>
                </div>

                {distributionStats.scoredCount > 0 ? (
                  <div className="space-y-3 relative z-10">
                    <div className="h-40 flex items-end gap-1.5 sm:gap-2 pt-6 relative">
                      {/* Ambient horizontal spectrum baseline glow */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-5 h-px bg-gradient-to-r from-rose-400/40 via-amber-300/45 via-sky-400/50 to-emerald-300/55"
                      />
                      {distributionStats.exactBuckets.map((b) => {
                        const heightPct = b.count > 0 ? Math.max(16, Math.round((b.count / maxExactCount) * 100)) : 5;
                        const scoreNum = Number(b.scoreLabel);
                        const barStyle =
                          b.count === 0
                            ? 'bg-slate-400/10 border border-white/10'
                            : scoreNum >= 8
                            ? 'sf-bar-glint bg-gradient-to-t from-emerald-700 via-emerald-400 to-teal-200 shadow-[0_0_20px_rgba(45,212,191,0.5)]'
                            : scoreNum >= 6.5
                            ? 'sf-bar-glint bg-gradient-to-t from-blue-800 via-sky-500 to-cyan-200 shadow-[0_0_20px_rgba(56,189,248,0.5)]'
                            : scoreNum >= 5
                            ? 'sf-bar-glint bg-gradient-to-t from-amber-700 via-amber-400 to-yellow-200 shadow-[0_0_18px_rgba(251,191,36,0.45)]'
                            : 'sf-bar-glint bg-gradient-to-t from-rose-800 via-rose-500 to-pink-300 shadow-[0_0_18px_rgba(251,113,133,0.45)]';
                        return (
                          <div key={b.scoreLabel} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                            <span
                              className={`text-[11px] font-mono tabular-nums font-bold transition-transform duration-150 group-hover:-translate-y-0.5 ${
                                b.count > 0 ? 'text-white drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]' : 'text-transparent'
                              }`}
                            >
                              {b.count > 0 ? b.count : '0'}
                            </span>
                            <div
                              className={`w-full rounded-t-lg transition-all duration-200 group-hover:scale-y-105 group-hover:brightness-110 origin-bottom ${barStyle}`}
                              style={{ height: `${heightPct}%` }}
                              title={`Điểm ${b.scoreLabel}: ${b.count} học sinh`}
                            />
                            <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-300 group-hover:text-cyan-200 transition-colors">
                              {b.scoreLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Spectrum Legend */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-cyan-400/15 text-[11px] text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-tr from-rose-600 to-pink-300 shadow-[0_0_8px_rgba(251,113,133,0.65)]" />
                        <span>&lt; 5.0</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-tr from-amber-600 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                        <span>5.0 – 6.4</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-tr from-blue-600 to-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.65)]" />
                        <span>6.5 – 7.9</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-gradient-to-tr from-emerald-500 to-teal-200 shadow-[0_0_8px_rgba(45,212,191,0.65)]" />
                        <span>≥ 8.0</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-xs text-cyan-200/70 italic relative z-10">
                    Chưa có dữ liệu điểm cho bài kiểm tra "{activeCategoryMeta.label}" — Nhấn vào từng học sinh để nhập điểm.
                  </div>
                )}
              </div>

              {/* Tier Breakdown (clickable filters) */}
              <div className="lg:col-span-5 p-5 rounded-2xl bg-white/95 dark:bg-[#07142b] border border-slate-200/80 dark:border-cyan-500/25 shadow-xs space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Phân tầng học lực (lọc nhanh)
                  </span>
                  {tierFilter !== 'all' && (
                    <button
                      type="button"
                      data-sound="tap"
                      onClick={() => setTierFilter('all')}
                      className="text-xs font-semibold text-sky-600 dark:text-cyan-300 hover:underline cursor-pointer"
                    >
                      Hiện tất cả
                    </button>
                  )}
                </div>
                <div className="space-y-2.5">
                  {distributionStats.bins.map((bin) => {
                    const pct =
                      distributionStats.scoredCount > 0
                        ? Math.round((bin.count / distributionStats.scoredCount) * 100)
                        : 0;
                    const isActive = tierFilter === bin.tier;
                    return (
                      <button
                        key={bin.tier}
                        type="button"
                        data-sound="toggle"
                        onClick={() =>
                          setTierFilter(isActive ? 'all' : bin.tier)
                        }
                        className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 cursor-pointer ${
                          isActive
                            ? 'bg-sky-50/90 dark:bg-cyan-500/15 ring-1.5 ring-sky-500 dark:ring-cyan-400 shadow-xs'
                            : 'hover:bg-slate-50 dark:hover:bg-[#0c1e3e]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${(bin as any).swatchClass || ''}`} />
                            <span>{bin.label}</span>
                          </span>
                          <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                            {bin.count} HS ({pct}%)
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-200/80 dark:bg-[#040b18] border border-slate-200/70 dark:border-cyan-500/15 overflow-hidden p-[1px]">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${bin.color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                  {distributionStats.missingCount > 0 && (
                    <button
                      type="button"
                      data-sound="toggle"
                      onClick={() =>
                        setTierFilter(tierFilter === 'missing' ? 'all' : 'missing')
                      }
                      className={`w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer ${
                        tierFilter === 'missing'
                          ? 'bg-slate-200 dark:bg-slate-700 font-bold text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#0c1e3e]'
                      }`}
                    >
                      <span>Chưa có điểm bài này</span>
                      <span className="font-mono tabular-nums font-semibold">{distributionStats.missingCount} HS</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Toolbar: Title, Search, Filter, Add student */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              <span>
                Bảng điểm chi tiết (
                <span className="font-mono tabular-nums">
                  {filteredStudents.length}/{selectedClass.students.length}
                </span>{' '}
                học sinh)
              </span>
            </h3>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-cyan-400/70 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên học sinh..."
                  className="min-h-[38px] pl-8.5 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/90 dark:border-cyan-500/25 bg-white dark:bg-[#07142b] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-sky-500/20 w-44 sm:w-52"
                />
              </div>

              <div className="relative flex items-center">
                <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-cyan-400/70 absolute left-3 pointer-events-none" />
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as TierFilter)}
                  className="min-h-[38px] pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200/90 dark:border-cyan-500/25 bg-white dark:bg-[#07142b] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 cursor-pointer"
                >
                  <option value="all">Tất cả mức điểm</option>
                  <option value="good">Tốt (≥ 8.0)</option>
                  <option value="fair">Khá (6.5 - 7.9)</option>
                  <option value="average">Đạt (5.0 - 6.4)</option>
                  <option value="weak">Chưa đạt (&lt; 5.0)</option>
                  <option value="missing">Chưa có điểm</option>
                </select>
              </div>

              <button
                type="button"
                data-sound="tap"
                onClick={() => setIsAdding(!isAdding)}
                className="sf-neon-cta min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm học sinh</span>
              </button>
            </div>
          </div>

          {/* Add student form */}
          {isAdding && (
            <form
              onSubmit={handleSaveStudent}
              className="sf-teacher-surface p-4 rounded-2xl border-cyan-400/35 space-y-3"
            >
              <span className="text-xs font-bold text-slate-900 dark:text-cyan-200">
                Thêm học sinh mới vào lớp
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="Họ và tên học sinh *"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-cyan-500/25 bg-white dark:bg-[#050e20] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
                <input
                  type="text"
                  placeholder="Mã số học sinh (không bắt buộc)"
                  value={newRollNumber}
                  onChange={(e) => setNewRollNumber(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-cyan-500/25 bg-white dark:bg-[#050e20] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  data-sound="tap"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  data-sound="success"
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[#081b3d] dark:bg-cyan-500 text-white dark:text-[#031126] cursor-pointer"
                >
                  Lưu học sinh
                </button>
              </div>
            </form>
          )}

          {/* Gradebook Table mirroring Vietnamese Sổ điểm */}
          <div className="sf-teacher-surface rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-[#051129] via-[#091f46] to-[#0d2b60] text-white border-b border-cyan-400/25">
                    <th rowSpan={2} className="py-2.5 px-2.5 text-center font-bold border-r border-cyan-400/20 w-10 text-cyan-200">
                      TT
                    </th>
                    <th rowSpan={2} className="py-2.5 px-3 text-left font-bold border-r border-cyan-400/20 min-w-[175px]">
                      Họ và tên
                    </th>
                    <th colSpan={4} className="py-2 px-2 text-center font-bold border-b border-r border-cyan-400/20 text-cyan-300 bg-cyan-500/10">
                      ĐDGtx (Thường xuyên · HS 1)
                    </th>
                    <th rowSpan={2} className={`py-2.5 px-2.5 text-center font-bold border-r border-cyan-400/20 w-20 ${activeCategory === 'gk' ? 'bg-indigo-500/35 text-white' : 'bg-indigo-500/15 text-indigo-200'}`}>
                      <div>ĐDGgk</div>
                      <div className="text-[10px] font-medium text-indigo-200/80">Giữa kỳ</div>
                    </th>
                    <th rowSpan={2} className={`py-2.5 px-2.5 text-center font-bold border-r border-cyan-400/20 w-20 ${activeCategory === 'ck' ? 'bg-rose-500/35 text-white' : 'bg-rose-500/15 text-rose-200'}`}>
                      <div>ĐDGck</div>
                      <div className="text-[10px] font-medium text-rose-200/80">Cuối kỳ</div>
                    </th>
                    <th rowSpan={2} className={`py-2.5 px-2.5 text-center font-bold border-r border-cyan-400/20 w-20 ${activeCategory === 'all' ? 'bg-emerald-500/25 text-emerald-200' : 'text-emerald-200/80'}`}>
                      <div>ĐTBm</div>
                      <div className="text-[10px] font-medium opacity-85">{activeSemester === 'hk1' ? 'HKI' : 'HKII'}</div>
                    </th>
                    {activeSemester === 'hk2' && (
                      <th rowSpan={2} className="py-2.5 px-2.5 text-center font-bold border-r border-cyan-400/20 w-20 bg-sky-500/15 text-sky-200">
                        <div>Cả năm</div>
                        <div className="text-[10px] font-medium opacity-85">ĐTBcn</div>
                      </th>
                    )}
                    <th rowSpan={2} className={`py-2.5 px-2.5 text-center font-bold ${onDeleteStudent ? 'border-r border-cyan-400/20' : ''} w-24`}>
                      Xếp loại
                    </th>
                    {onDeleteStudent && (
                      <th rowSpan={2} className="py-2.5 px-2 text-center font-bold w-20">
                        Xóa
                      </th>
                    )}
                  </tr>
                  <tr className="bg-[#071836] text-[11px] text-cyan-100 border-b border-cyan-400/25">
                    {[
                      { key: 'tx1' as ExamCategoryKey, label: 'TX 1' },
                      { key: 'tx2' as ExamCategoryKey, label: 'TX 2' },
                      { key: 'tx3' as ExamCategoryKey, label: 'TX 3' },
                      { key: 'tx4' as ExamCategoryKey, label: 'M (Miệng)' }
                    ].map((col) => (
                      <th
                        key={col.key}
                        onClick={() => setActiveCategory(col.key)}
                        className={`py-1.5 px-2 text-center font-bold border-r border-cyan-400/20 cursor-pointer transition w-14 ${
                          activeCategory === col.key
                            ? 'bg-cyan-400 text-[#031126]'
                            : 'hover:bg-cyan-500/20 text-cyan-200'
                        }`}
                        title={`Nhấn để xem phổ điểm riêng ${col.label}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-cyan-900/35">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={(activeSemester === 'hk2' ? 11 : 10) + (onDeleteStudent ? 1 : 0)} className="py-10 text-center text-slate-400 italic">
                        Không tìm thấy học sinh phù hợp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(({ st, order }) => {
                      const focusScore = getScoreForCategory(st, activeCategory, activeSemester);
                      const overallAvg = getScoreForCategory(st, 'all', activeSemester);
                      const hk1Avg = getScoreForCategory(st, 'all', 'hk1');
                      const yearlyAvg = activeSemester === 'hk2' ? calcYearlyAvg(hk1Avg, overallAvg) : null;
                      const sc = getStudentScoresBySemester(st, activeSemester);
                      const isConfirmingDelete = confirmDeleteStudentId === st.id;
                      return (
                        <tr
                          key={st.id || order}
                          onClick={() => onEditStudent(st, activeSemester)}
                          className="hover:bg-sky-50/70 dark:hover:bg-[#0c1e3e]/85 cursor-pointer transition-colors duration-150 group"
                          title={`Nhấn để sửa hoặc nhập điểm ${activeSemester === 'hk1' ? 'Học kỳ I' : 'Học kỳ II'}`}
                        >
                          <td className="py-2.5 px-2.5 text-center font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 border-r border-slate-200/60 dark:border-cyan-900/30">
                            {order}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200/60 dark:border-cyan-900/30">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-sky-700 dark:group-hover:text-cyan-300 transition-colors">
                                  {st.name}
                                </p>
                                {sc?.comment && (
                                  <p className="text-[10px] text-slate-400 truncate max-w-[190px]">
                                    {sc.comment}
                                  </p>
                                )}
                              </div>
                              <Pencil className="w-3 h-3 text-slate-300 group-hover:text-sky-600 dark:group-hover:text-cyan-400 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                            </div>
                          </td>
                          {(['tx1', 'tx2', 'tx3', 'tx4'] as const).map((k) => {
                            const val = sc?.[k] ?? null;
                            const isHighlight = activeCategory === k;
                            return (
                              <td
                                key={k}
                                className={`py-2.5 px-1.5 text-center font-mono tabular-nums font-bold border-r border-slate-200/60 dark:border-cyan-900/30 ${
                                  isHighlight
                                    ? 'bg-sky-50/80 dark:bg-cyan-950/35'
                                    : ''
                                }`}
                              >
                                <span
                                  className={`inline-block min-w-[26px] px-1.5 py-0.5 rounded-md text-[11px] ${
                                    isValidScore(val)
                                      ? isHighlight
                                        ? getScoreBadgeStyle(val)
                                        : 'text-slate-800 dark:text-slate-200'
                                      : 'text-slate-300 dark:text-slate-600 font-normal'
                                  }`}
                                >
                                  {formatScoreCell(val)}
                                </span>
                              </td>
                            );
                          })}
                          <td
                            className={`py-2.5 px-2 text-center font-mono tabular-nums font-bold border-r border-slate-200/60 dark:border-cyan-900/30 ${
                              activeCategory === 'gk' ? 'bg-indigo-50/75 dark:bg-indigo-950/35' : ''
                            }`}
                          >
                            <span
                              className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded-md text-[11px] ${
                                isValidScore(sc?.gk)
                                  ? getScoreBadgeStyle(sc?.gk ?? null)
                                  : 'text-slate-300 dark:text-slate-600 font-normal'
                              }`}
                            >
                              {formatScoreCell(sc?.gk)}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 px-2 text-center font-mono tabular-nums font-bold border-r border-slate-200/60 dark:border-cyan-900/30 ${
                              activeCategory === 'ck' ? 'bg-rose-50/75 dark:bg-rose-950/35' : ''
                            }`}
                          >
                            <span
                              className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded-md text-[11px] ${
                                isValidScore(sc?.ck)
                                  ? getScoreBadgeStyle(sc?.ck ?? null)
                                  : 'text-slate-300 dark:text-slate-600 font-normal'
                              }`}
                            >
                              {formatScoreCell(sc?.ck)}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 px-2 text-center font-mono tabular-nums font-bold border-r border-slate-200/60 dark:border-cyan-900/30 ${
                              activeCategory === 'all' ? 'bg-emerald-50/55 dark:bg-emerald-950/25' : ''
                            }`}
                          >
                            <span
                              className={`inline-block min-w-[34px] px-1.5 py-0.5 rounded-md text-[11px] ${getScoreBadgeStyle(overallAvg)}`}
                            >
                              {overallAvg !== null ? overallAvg.toFixed(1) : '·'}
                            </span>
                          </td>
                          {activeSemester === 'hk2' && (
                            <td className="py-2.5 px-2 text-center font-mono tabular-nums font-bold border-r border-slate-200/60 dark:border-cyan-900/30 bg-sky-50/40 dark:bg-sky-950/25">
                              <span
                                className={`inline-block min-w-[34px] px-1.5 py-0.5 rounded-md text-[11px] ${getScoreBadgeStyle(yearlyAvg)}`}
                              >
                                {yearlyAvg !== null ? yearlyAvg.toFixed(1) : '·'}
                              </span>
                            </td>
                          )}
                          <td className={`py-2.5 px-2 text-center ${onDeleteStudent ? 'border-r border-slate-200/60 dark:border-cyan-900/30' : ''}`}>
                            <span
                              className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-lg whitespace-nowrap ${getScoreBadgeStyle(focusScore)}`}
                            >
                              {getClassificationLabel(focusScore)}
                            </span>
                          </td>
                          {onDeleteStudent && (
                            <td
                              className="py-2.5 px-2 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isConfirmingDelete ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    data-sound="tap"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteStudent(selectedClass.id, st.id);
                                      setConfirmDeleteStudentId(null);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 transition cursor-pointer"
                                    title="Xác nhận xóa học sinh"
                                  >
                                    Xóa
                                  </button>
                                  <button
                                    type="button"
                                    data-sound="tap"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteStudentId(null);
                                    }}
                                    className="px-1.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold hover:bg-slate-300 transition cursor-pointer"
                                    title="Hủy"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  data-sound="tap"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteStudentId(st.id);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                                  title={`Xóa học sinh ${st.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
            Mẹo: Nhấn vào tên hoặc dòng của bất kỳ học sinh nào để nhập/chỉnh sửa điểm TX, Miệng (M), Giữa kỳ, Cuối kỳ.
          </p>
        </div>

        {/* Footer */}
        <div
          className={
            isPage
              ? 'sf-teacher-surface p-4 rounded-3xl flex items-center justify-between gap-3 flex-wrap'
              : 'p-4 border-t border-slate-200/80 dark:border-cyan-900/40 flex items-center justify-between gap-3 bg-slate-50/90 dark:bg-[#07152e] flex-wrap shrink-0'
          }
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-sound="success"
              onClick={() => {
                if (!isPage) onClose();
                onOpenAiExam();
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-cyan-300 hover:underline cursor-pointer"
            >
              ✨ Tạo đề thi riêng cho lớp {selectedClass.name}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {onDeleteClass && (
              <button
                type="button"
                data-sound="tap"
                onClick={() => {
                  onDeleteClass(selectedClass.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white transition shadow-2xs cursor-pointer"
                title="Giải tán / Xóa lớp học này"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Giải tán lớp</span>
              </button>
            )}
            <button
              type="button"
              data-sound="nav"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#081b3d] dark:bg-cyan-500/15 text-white dark:text-cyan-300 border border-cyan-400/30 hover:bg-[#0e2a5c] dark:hover:bg-cyan-500/25 transition cursor-pointer"
            >
              {isPage ? (
                <>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>BACK</span>
                </>
              ) : (
                <span>Đóng</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
