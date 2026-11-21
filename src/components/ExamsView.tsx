import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  FolderPlus,
  Library,
  Folder,
  FileText,
  Play,
  Edit3,
  Trash2,
  Clock,
  CheckCircle2,
  GraduationCap,
  Star,
  BarChart3,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BookOpen,
  RotateCcw,
  Users,
  Plus,
  X,
  History,
  Calendar,
  Award,
  ChevronDown,
  ChevronUp,
  Check,
  XCircle,
  Save
} from 'lucide-react';
import { ExamItem, ExamFolder, ExamSubmission, UserRole } from '../types';
import { TakeExamModal } from './TakeExamModal';
import { CreateExamModal } from './CreateExamModal';
import { ExamAnalyticsCard } from './ExamAnalyticsCard';
import { loadUiPreferences, updateStudentUiPreferences, updateTeacherUiPreferences } from '../utils/uiPreferences';

interface ExamsViewProps {
  exams: ExamItem[];
  folders: ExamFolder[];
  submissions: ExamSubmission[];
  role: UserRole;
  studentName?: string;
  initialOpenExamId?: number | null;
  onClearInitialExamId?: () => void;
  initialOpenAnalytics?: boolean;
  onClearInitialAnalytics?: () => void;
  onSaveExam: (exam: ExamItem) => void;
  onDeleteExam: (id: number) => void;
  onDeleteExams?: (ids: number[]) => void;
  onDeleteFolder?: (id: string) => void;
  onAddFolder: (folder: ExamFolder) => void;
  onSubmitResult: (submission: ExamSubmission) => void;
  onBackToOverview: () => void;
  onOpenCreateExam?: () => void;
  onSavePermanent?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

type SortOrder = 'newest' | 'oldest';
type StudentFilterMode = 'all' | 'starred' | 'todo' | 'done' | 'history';
type ScoreStatusFilter = 'all' | 'excellent' | 'good' | 'pass' | 'fail';

const STARRED_STORAGE_KEY = 'studyflow_student_starred_exams';

/**
 * Parse Vietnamese date strings ("27/10/2026 19:13", "19:13 27/10/2026", "27/10/2026, 19:13:00")
 * as well as ISO timestamps ("2026-10-28T08:00:00.000Z") into epoch milliseconds.
 */
function parseExamTimestamp(exam: ExamItem): number {
  const raw = (exam.assignedAt || exam.createdAt || '').trim();
  if (!raw) return exam.id || 0;

  // ISO format YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) return parsed;
  }

  // Extract date DD/MM/YYYY and optional time HH:mm(:ss)?
  const dateMatch = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]) - 1;
    const year = Number(dateMatch[3]);
    const timeMatch = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const hours = timeMatch ? Number(timeMatch[1]) : 0;
    const minutes = timeMatch ? Number(timeMatch[2]) : 0;
    const seconds = timeMatch && timeMatch[3] ? Number(timeMatch[3]) : 0;
    const ts = new Date(year, month, day, hours, minutes, seconds).getTime();
    if (!Number.isNaN(ts)) return ts;
  }

  const fallbackParsed = Date.parse(raw);
  if (!Number.isNaN(fallbackParsed)) return fallbackParsed;

  return exam.id || 0;
}

function formatExamDateLabel(exam: ExamItem): string {
  const raw = (exam.assignedAt || exam.createdAt || '').trim();
  if (!raw) return 'Chưa rõ ngày';

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} · ${hh}:${min}`;
    }
  }

  const dateMatch = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const dd = dateMatch[1].padStart(2, '0');
    const mm = dateMatch[2].padStart(2, '0');
    const yyyy = dateMatch[3];
    const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return `${dd}/${mm}/${yyyy} · ${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    }
    return `${dd}/${mm}/${yyyy}`;
  }

  return raw;
}

function parseSubmissionDate(raw: string, fallbackId = 0): Date {
  const trimmed = (raw || '').trim();
  if (trimmed) {
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const d = new Date(trimmed);
      if (!Number.isNaN(d.getTime())) return d;
    }

    const dateMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateMatch) {
      const day = Number(dateMatch[1]);
      const month = Number(dateMatch[2]) - 1;
      const year = Number(dateMatch[3]);
      const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      const hours = timeMatch ? Number(timeMatch[1]) : 0;
      const minutes = timeMatch ? Number(timeMatch[2]) : 0;
      const seconds = timeMatch && timeMatch[3] ? Number(timeMatch[3]) : 0;
      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!Number.isNaN(d.getTime())) return d;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }

  if (fallbackId > 1_000_000_000_000) {
    return new Date(fallbackId);
  }
  return new Date();
}

function formatSubmissionDateLabel(raw: string, fallbackId = 0): string {
  const d = parseSubmissionDate(raw, fallbackId);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} · ${hh}:${min}`;
}

function formatTimeSpent(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) return `${secs} giây`;
  if (secs === 0) return `${mins} phút`;
  return `${mins} phút ${secs} giây`;
}

function getScoreStatusMeta(score: number): {
  key: Exclude<ScoreStatusFilter, 'all'>;
  label: string;
  accent: string;
  badgeClass: string;
  scoreTextClass: string;
} {
  if (score >= 8.0) {
    return {
      key: 'excellent',
      label: 'Giỏi',
      accent: 'from-emerald-400 via-teal-400 to-cyan-400',
      badgeClass:
        'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-400/35',
      scoreTextClass: 'text-emerald-600 dark:text-emerald-300'
    };
  }
  if (score >= 6.5) {
    return {
      key: 'good',
      label: 'Khá',
      accent: 'from-cyan-400 via-sky-500 to-blue-500',
      badgeClass:
        'bg-sky-50 dark:bg-cyan-500/15 text-sky-700 dark:text-cyan-300 border-sky-200/80 dark:border-cyan-400/35',
      scoreTextClass: 'text-sky-600 dark:text-cyan-300'
    };
  }
  if (score >= 5.0) {
    return {
      key: 'pass',
      label: 'Đạt',
      accent: 'from-amber-400 via-orange-400 to-yellow-300',
      badgeClass:
        'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-400/35',
      scoreTextClass: 'text-amber-600 dark:text-amber-300'
    };
  }
  return {
    key: 'fail',
    label: 'Chưa đạt',
    accent: 'from-rose-400 via-pink-500 to-red-400',
    badgeClass:
      'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-400/35',
    scoreTextClass: 'text-rose-600 dark:text-rose-300'
  };
}

function loadInitialStarredIds(exams: ExamItem[]): number[] {
  const set = new Set<number>();
  try {
    const prefs = loadUiPreferences();
    if (Array.isArray(prefs.student.examsStarredIds)) {
      prefs.student.examsStarredIds.forEach((id) => set.add(id));
    }
    const raw = localStorage.getItem(STARRED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          if (typeof id === 'number') set.add(id);
        });
      }
    }
  } catch {
    // ignore
  }
  exams.forEach((e) => {
    if (e.isStarred) set.add(e.id);
  });
  return Array.from(set);
}

export const ExamsView: React.FC<ExamsViewProps> = ({
  exams,
  folders,
  submissions,
  role,
  studentName,
  initialOpenExamId,
  onClearInitialExamId,
  initialOpenAnalytics,
  onClearInitialAnalytics,
  onSaveExam,
  onDeleteExam,
  onDeleteExams,
  onDeleteFolder,
  onAddFolder,
  onSubmitResult,
  onOpenCreateExam,
  onSavePermanent,
  searchQuery = '',
  onSearchChange
}) => {
  const isTeacher = role === 'teacher';

  const [selectedFolder, setSelectedFolder] = useState<string | null>(() => {
    const prefs = loadUiPreferences();
    return role === 'teacher' ? prefs.teacher.examsSelectedFolder : prefs.student.examsSelectedFolder;
  });

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const prefs = loadUiPreferences();
    return role === 'teacher' ? prefs.teacher.examsSortOrder : prefs.student.examsSortOrder;
  });

  const [studentFilter, setStudentFilter] = useState<StudentFilterMode>(() => {
    return loadUiPreferences().student.examsFilterMode;
  });

  const [prioritizeStarred, setPrioritizeStarred] = useState<boolean>(() => {
    return loadUiPreferences().student.examsPrioritizeStarred;
  });

  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [historyMonth, setHistoryMonth] = useState<string>('all');
  const [historyYear, setHistoryYear] = useState<string>('all');
  const [historyScoreStatus, setHistoryScoreStatus] = useState<ScoreStatusFilter>('all');
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [teacherSubjectFilter, setTeacherSubjectFilter] = useState<string>('all');
  const [internalSearch, setInternalSearch] = useState<string>('');

  const effectiveSearch = onSearchChange ? searchQuery : internalSearch;
  const handleSearchInput = (nextValue: string) => {
    if (onSearchChange) {
      onSearchChange(nextValue);
    } else {
      setInternalSearch(nextValue);
    }
  };

  const [starredExamIds, setStarredExamIds] = useState<number[]>(() => loadInitialStarredIds(exams));

  useEffect(() => {
    if (role === 'teacher') {
      updateTeacherUiPreferences({ examsSelectedFolder: selectedFolder, examsSortOrder: sortOrder });
    } else {
      updateStudentUiPreferences({
        examsSelectedFolder: selectedFolder,
        examsSortOrder: sortOrder,
        examsFilterMode: studentFilter,
        examsPrioritizeStarred: prioritizeStarred
      });
    }
  }, [role, selectedFolder, sortOrder, studentFilter, prioritizeStarred]);

  const handleToggleStarExam = (examId: number) => {
    setStarredExamIds((prev) => {
      const exists = prev.includes(examId);
      const next = exists ? prev.filter((id) => id !== examId) : [...prev, examId];
      try {
        localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify(next));
        updateStudentUiPreferences({ examsStarredIds: next });
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [selectedExamIds, setSelectedExamIds] = useState<number[]>([]);

  // Modals
  const [activeExamTaking, setActiveExamTaking] = useState<ExamItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalMode, setCreateModalMode] = useState<'upload' | 'manual'>('upload');
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [detailExamId, setDetailExamId] = useState<number | 'all' | null>(null);

  const openExamDistributionDetail = (examId: number) => {
    setDetailExamId(examId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openExamTakingPage = (exam: ExamItem) => {
    setActiveExamTaking(exam);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeExamTakingPage = () => {
    setActiveExamTaking(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!initialOpenExamId) return;
    const target = exams.find((e) => e.id === initialOpenExamId);
    if (target) {
      openExamTakingPage(target);
    }
    onClearInitialExamId?.();
  }, [initialOpenExamId, exams, onClearInitialExamId]);

  useEffect(() => {
    if (!initialOpenAnalytics) return;
    setDetailExamId('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onClearInitialAnalytics?.();
  }, [initialOpenAnalytics, onClearInitialAnalytics]);

  const isAnalyticsPageOpen = detailExamId !== null;

  // Map exams by ID for history lookup
  const examByIdMap = useMemo(() => {
    const map = new Map<number, ExamItem>();
    exams.forEach((ex) => map.set(ex.id, ex));
    return map;
  }, [exams]);

  // Map student's own submissions per exam
  const mySubmissionsByExam = useMemo(() => {
    const map = new Map<number, ExamSubmission[]>();
    const normalizedStudent = (studentName || '').trim().toLowerCase();
    submissions.forEach((sub) => {
      const matchesStudent = !normalizedStudent || sub.studentName.trim().toLowerCase() === normalizedStudent;
      if (matchesStudent) {
        const list = map.get(sub.examId) || [];
        list.push(sub);
        map.set(sub.examId, list);
      }
    });
    return map;
  }, [submissions, studentName]);

  // Enriched chronological list of student's past exam submissions
  const myAllSubmissions = useMemo(() => {
    const normalizedStudent = (studentName || '').trim().toLowerCase();
    return submissions
      .filter((sub) => !normalizedStudent || sub.studentName.trim().toLowerCase() === normalizedStudent)
      .map((sub) => {
        const parsedDate = parseSubmissionDate(sub.submittedAt, sub.id);
        const linkedExam = examByIdMap.get(sub.examId) || null;
        return {
          submission: sub,
          exam: linkedExam,
          subject: linkedExam?.subject || 'Tổng hợp',
          parsedDate,
          month: parsedDate.getMonth() + 1,
          year: parsedDate.getFullYear(),
          timestamp: parsedDate.getTime(),
          scoreMeta: getScoreStatusMeta(sub.score)
        };
      });
  }, [submissions, studentName, examByIdMap]);

  const historyAvailableYears = useMemo(() => {
    const set = new Set<number>();
    myAllSubmissions.forEach((item) => set.add(item.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [myAllSubmissions]);

  const historyBaseFiltered = useMemo(() => {
    const q = effectiveSearch.trim().toLowerCase();
    return myAllSubmissions.filter((item) => {
      if (q) {
        const hit =
          item.submission.examTitle.toLowerCase().includes(q) ||
          item.subject.toLowerCase().includes(q) ||
          (item.exam?.assignedTo || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (selectedSubject !== 'all' && item.subject.trim() !== selectedSubject) {
        return false;
      }
      if (historyYear !== 'all' && String(item.year) !== historyYear) {
        return false;
      }
      if (historyMonth !== 'all' && String(item.month) !== historyMonth) {
        return false;
      }
      return true;
    });
  }, [myAllSubmissions, effectiveSearch, selectedSubject, historyYear, historyMonth]);

  const historyScoreCounts = useMemo(() => {
    const counts = {
      all: historyBaseFiltered.length,
      excellent: 0,
      good: 0,
      pass: 0,
      fail: 0
    };
    historyBaseFiltered.forEach((item) => {
      counts[item.scoreMeta.key] += 1;
    });
    return counts;
  }, [historyBaseFiltered]);

  const filteredHistorySubmissions = useMemo(() => {
    const list =
      historyScoreStatus === 'all'
        ? historyBaseFiltered
        : historyBaseFiltered.filter((item) => item.scoreMeta.key === historyScoreStatus);
    return [...list].sort((a, b) => {
      const diff = b.timestamp - a.timestamp;
      return sortOrder === 'newest' ? diff : -diff;
    });
  }, [historyBaseFiltered, historyScoreStatus, sortOrder]);

  const historySummaryStats = useMemo(() => {
    const count = filteredHistorySubmissions.length;
    if (count === 0) {
      return { count: 0, avgScore: 0, bestScore: 0, passCount: 0, passRate: 0 };
    }
    const totalScore = filteredHistorySubmissions.reduce((sum, item) => sum + item.submission.score, 0);
    const bestScore = Math.max(...filteredHistorySubmissions.map((item) => item.submission.score));
    const passCount = filteredHistorySubmissions.filter((item) => item.submission.score >= 5).length;
    return {
      count,
      avgScore: totalScore / count,
      bestScore,
      passCount,
      passRate: Math.round((passCount / count) * 100)
    };
  }, [filteredHistorySubmissions]);

  // Visible base exams (students don't see drafts)
  const baseExams = useMemo(() => {
    return isTeacher ? exams : exams.filter((e) => e.status !== 'draft');
  }, [exams, isTeacher]);

  // Identify globally newest & oldest exam IDs for subtle clear labeling
  const { newestExamId, oldestExamId } = useMemo(() => {
    if (baseExams.length === 0) return { newestExamId: null, oldestExamId: null };
    let newest = baseExams[0];
    let oldest = baseExams[0];
    baseExams.forEach((ex) => {
      const ts = parseExamTimestamp(ex);
      if (ts > parseExamTimestamp(newest)) newest = ex;
      if (ts < parseExamTimestamp(oldest)) oldest = ex;
    });
    return { newestExamId: newest.id, oldestExamId: oldest.id };
  }, [baseExams]);

  // Subjects list for student quick filtering
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    baseExams.forEach((e) => {
      if (e.subject?.trim()) set.add(e.subject.trim());
    });
    return Array.from(set);
  }, [baseExams]);

  // Student summary counts
  const studentCounts = useMemo(() => {
    const total = baseExams.length;
    const starred = baseExams.filter((e) => starredExamIds.includes(e.id)).length;
    const done = baseExams.filter((e) => (mySubmissionsByExam.get(e.id)?.length || 0) > 0).length;
    const todo = total - done;
    return { total, starred, done, todo };
  }, [baseExams, starredExamIds, mySubmissionsByExam]);

  // Teacher summary counts
  const teacherCounts = useMemo(() => {
    const total = exams.length;
    const published = exams.filter((e) => e.status === 'published').length;
    const draft = total - published;
    const totalSubmissions = exams.reduce((sum, e) => {
      const count = submissions.filter((s) => s.examId === e.id).length || e.submissionsCount || 0;
      return sum + count;
    }, 0);
    return { total, published, draft, totalSubmissions };
  }, [exams, submissions]);

  const folderExamCounts = useMemo(() => {
    const map = new Map<string, number>();
    exams.forEach((e) => {
      if (e.folderId) {
        map.set(e.folderId, (map.get(e.folderId) || 0) + 1);
      }
    });
    return map;
  }, [exams]);

  // Filtered & sorted exams
  const filteredExams = useMemo(() => {
    const q = effectiveSearch.trim().toLowerCase();

    const matched = baseExams.filter((e) => {
      if (q) {
        const hit =
          e.title.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          (e.assignedTo || '').toLowerCase().includes(q);
        if (!hit) return false;
      }

      if (selectedFolder && e.folderId !== selectedFolder) {
        return false;
      }

      if (isTeacher) {
        if (teacherStatusFilter !== 'all' && e.status !== teacherStatusFilter) {
          return false;
        }
        if (teacherSubjectFilter !== 'all' && e.subject.trim() !== teacherSubjectFilter) {
          return false;
        }
      } else {
        if (selectedSubject !== 'all' && e.subject.trim() !== selectedSubject) {
          return false;
        }
        const isStarred = starredExamIds.includes(e.id);
        const hasDone = (mySubmissionsByExam.get(e.id)?.length || 0) > 0;
        if (studentFilter === 'starred' && !isStarred) return false;
        if (studentFilter === 'done' && !hasDone) return false;
        if (studentFilter === 'todo' && hasDone) return false;
      }

      return true;
    });

    return [...matched].sort((a, b) => {
      if (!isTeacher && prioritizeStarred) {
        const aStar = starredExamIds.includes(a.id) ? 1 : 0;
        const bStar = starredExamIds.includes(b.id) ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
      }

      const diff = parseExamTimestamp(b) - parseExamTimestamp(a);
      return sortOrder === 'newest' ? diff : -diff;
    });
  }, [
    baseExams,
    effectiveSearch,
    selectedFolder,
    isTeacher,
    teacherStatusFilter,
    teacherSubjectFilter,
    selectedSubject,
    starredExamIds,
    mySubmissionsByExam,
    studentFilter,
    prioritizeStarred,
    sortOrder
  ]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedExamIds(filteredExams.map((e) => e.id));
    } else {
      setSelectedExamIds([]);
    }
  };

  const handleToggleSelectExam = (id: number) => {
    if (selectedExamIds.includes(id)) {
      setSelectedExamIds(selectedExamIds.filter((item) => item !== id));
    } else {
      setSelectedExamIds([...selectedExamIds, id]);
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    onAddFolder({
      id: `folder_${Date.now()}`,
      name: newFolderName.trim(),
      examCount: 0
    });
    setNewFolderName('');
    setIsFolderModalOpen(false);
  };

  const resetHistoryFilters = () => {
    setHistoryMonth('all');
    setHistoryYear('all');
    setHistoryScoreStatus('all');
    setSelectedSubject('all');
    setSortOrder('newest');
    handleSearchInput('');
  };

  const resetStudentFilters = () => {
    setStudentFilter('all');
    setSelectedSubject('all');
    setSelectedFolder(null);
    setPrioritizeStarred(false);
    setHistoryMonth('all');
    setHistoryYear('all');
    setHistoryScoreStatus('all');
    setSortOrder('newest');
    handleSearchInput('');
  };

  const resetTeacherFilters = () => {
    setTeacherStatusFilter('all');
    setTeacherSubjectFilter('all');
    setSelectedFolder(null);
    setSortOrder('newest');
    handleSearchInput('');
  };

  return (
    <div className="space-y-6 select-none relative">
      {activeExamTaking ? (
        <TakeExamModal
          key={activeExamTaking.id}
          exam={activeExamTaking}
          studentName={studentName}
          allSubmissions={submissions}
          isPage={true}
          onClose={closeExamTakingPage}
          onSubmitResult={(sub) => {
            onSubmitResult(sub);
            onSaveExam({
              ...activeExamTaking,
              submissionsCount: activeExamTaking.submissionsCount + 1
            });
          }}
        />
      ) : isAnalyticsPageOpen ? (
        <div className="space-y-5 relative z-10">
          <ExamAnalyticsCard
            exams={exams}
            submissions={submissions}
            selectedExamId={detailExamId}
            onSelectExamId={(nextId) => {
              setDetailExamId(nextId);
            }}
            role={role}
            isPage={true}
            onBack={() => setDetailExamId(null)}
            onTakeExam={!isTeacher ? (ex) => openExamTakingPage(ex) : undefined}
          />
        </div>
      ) : !isTeacher ? (
        /* =================================================================
           STUDENT EXAM PORTAL — Deep Navy & Refined Neon
           ================================================================= */
        <div className="space-y-5 relative z-10 sf-panel-enter">
          {/* 1. Luxury Deep Navy & Neon Hero Banner */}
          <section className="sf-navy-hero-banner relative overflow-hidden rounded-3xl text-white p-6 sm:p-7">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-300/90 font-medium">
                  <GraduationCap className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span>Không gian Luyện thi &amp; Khảo thí</span>
                  <span aria-hidden="true" className="text-cyan-400/50">·</span>
                  <span className="font-mono tabular-nums text-sky-100">{studentCounts.total} đề thi</span>
                  <span aria-hidden="true" className="text-cyan-400/50">·</span>
                  <span className="font-mono tabular-nums text-emerald-300">{studentCounts.done} đã hoàn thành</span>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400/25 via-sky-500/20 to-indigo-500/25 border border-cyan-300/40 flex items-center justify-center shrink-0 shadow-[0_0_24px_-4px_rgba(34,211,238,0.45)]">
                    <GraduationCap className="w-6 h-6 text-cyan-300" />
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance leading-tight">
                    Kho Đề Thi &amp; Luyện Tập
                  </h1>
                </div>

                <p className="text-xs sm:text-sm text-sky-100/85 leading-relaxed">
                  Theo dõi các đề giáo viên đã giao, đánh dấu sao đề trọng tâm, xem phổ điểm lớp học và bứt phá điểm số mỗi ngày.
                </p>
              </div>

              {/* Hero Actions */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  data-sound="toggle"
                  onClick={() => setStudentFilter(studentFilter === 'history' ? 'all' : 'history')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold border backdrop-blur-xs transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
                    studentFilter === 'history'
                      ? 'bg-cyan-400/25 text-cyan-200 border-cyan-300/60 shadow-[0_0_20px_-6px_rgba(34,211,238,0.65)]'
                      : 'bg-white/10 hover:bg-white/18 text-white border-white/20'
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Lịch sử thi ({myAllSubmissions.length})</span>
                </button>

                <button
                  type="button"
                  data-sound="nav"
                  onClick={() => setDetailExamId('all')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/18 text-white text-xs font-semibold border border-white/20 backdrop-blur-xs transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Phổ điểm tổng hợp</span>
                </button>

                {baseExams.length > 0 && (
                  <button
                    type="button"
                    data-sound="nav"
                    onClick={() => {
                      const nextTodo = baseExams.find((e) => (mySubmissionsByExam.get(e.id)?.length || 0) === 0);
                      openExamTakingPage(nextTodo || baseExams[0]);
                    }}
                    className="sf-neon-cta inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-display font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {baseExams.some((e) => (mySubmissionsByExam.get(e.id)?.length || 0) === 0)
                        ? 'Làm đề chưa thi'
                        : 'Luyện thi nhanh'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 2. Interactive 4-KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <button
              type="button"
              data-sound="toggle"
              onClick={() => setStudentFilter('all')}
              className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
                studentFilter === 'all' ? 'ring-1.5 ring-sky-500 dark:ring-cyan-400' : ''
              }`}
            >
              <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng số đề</span>
                <FileText className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {studentCounts.total}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">đề thi</span>
              </div>
            </button>

            <button
              type="button"
              data-sound="toggle"
              onClick={() => setStudentFilter(studentFilter === 'starred' ? 'all' : 'starred')}
              className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
                studentFilter === 'starred' ? 'ring-1.5 ring-amber-500 dark:ring-amber-400' : ''
              }`}
            >
              <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Đã đánh dấu sao</span>
                <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-extrabold tabular-nums text-amber-600 dark:text-amber-300">
                  {studentCounts.starred}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">trọng tâm</span>
              </div>
            </button>

            <button
              type="button"
              data-sound="toggle"
              onClick={() => setStudentFilter(studentFilter === 'todo' ? 'all' : 'todo')}
              className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
                studentFilter === 'todo' ? 'ring-1.5 ring-indigo-500 dark:ring-sky-400' : ''
              }`}
            >
              <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-indigo-400 via-sky-500 to-cyan-400" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Chưa làm</span>
                <Clock className="w-4 h-4 text-indigo-600 dark:text-sky-400 shrink-0" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-extrabold tabular-nums text-indigo-600 dark:text-sky-300">
                  {studentCounts.todo}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">cần luyện</span>
              </div>
            </button>

            <button
              type="button"
              data-sound="toggle"
              onClick={() => setStudentFilter(studentFilter === 'done' ? 'all' : 'done')}
              className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
                studentFilter === 'done' ? 'ring-1.5 ring-emerald-500 dark:ring-emerald-400' : ''
              }`}
            >
              <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Đã hoàn thành</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {studentCounts.done}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">đã nộp</span>
              </div>
            </button>
          </div>

          {/* 3. Search, Sort & Filter Toolbar */}
          <section className="sf-teacher-surface rounded-2xl p-4 sm:p-5 space-y-4">
            {/* Row 1: Search Input + Sort Segmented Control + Star Priority */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-sky-600/70 dark:text-cyan-400/80 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={effectiveSearch}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Tìm kiếm tên đề thi, môn học, lớp được giao..."
                  className="w-full min-h-[42px] pl-10 pr-10 py-2 text-sm bg-white/90 dark:bg-[#050f24]/90 border border-slate-200/80 dark:border-cyan-400/20 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-sky-500/15 transition-colors duration-150"
                />
                {effectiveSearch && (
                  <button
                    type="button"
                    data-sound="tap"
                    onClick={() => handleSearchInput('')}
                    aria-label="Xóa từ khóa tìm kiếm"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort Order & Prioritize Starred */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div
                  role="group"
                  aria-label="Sắp xếp theo thời gian"
                  className="inline-flex items-center p-1 rounded-xl bg-slate-100/90 dark:bg-[#050f24]/90 border border-slate-200/80 dark:border-cyan-400/15"
                >
                  <button
                    type="button"
                    data-sound="toggle"
                    onClick={() => setSortOrder('newest')}
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      sortOrder === 'newest'
                        ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                    <span>Đề thi mới nhất</span>
                  </button>
                  <button
                    type="button"
                    data-sound="toggle"
                    onClick={() => setSortOrder('oldest')}
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      sortOrder === 'oldest'
                        ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ArrowUpNarrowWide className="w-3.5 h-3.5" />
                    <span>Đề thi cũ nhất</span>
                  </button>
                </div>

                {/* Pin Starred First Toggle (only in exam list views) */}
                {studentFilter !== 'history' && (
                  <button
                    type="button"
                    data-sound="toggle"
                    onClick={() => setPrioritizeStarred((prev) => !prev)}
                    aria-pressed={prioritizeStarred}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      prioritizeStarred
                        ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-400/50 shadow-[0_0_16px_-6px_rgba(245,158,11,0.45)]'
                        : 'bg-white/80 dark:bg-[#050f24]/90 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-cyan-400/15 hover:border-amber-300 dark:hover:border-amber-500/40'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${
                        prioritizeStarred ? 'fill-amber-400 text-amber-500 scale-110' : 'text-slate-400'
                      }`}
                    />
                    <span>Ưu tiên đề gắn sao</span>
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Status Filter Tabs + Subject Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-200/70 dark:border-cyan-400/10">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'all', label: 'Tất cả đề', count: studentCounts.total },
                    { id: 'starred', label: 'Đã đánh dấu sao', count: studentCounts.starred, icon: Star },
                    { id: 'todo', label: 'Chưa làm', count: studentCounts.todo },
                    { id: 'done', label: 'Đã hoàn thành', count: studentCounts.done },
                    { id: 'history', label: 'Lịch sử', count: myAllSubmissions.length, icon: History }
                  ] as const
                ).map((tab) => {
                  const active = studentFilter === tab.id;
                  const TabIcon = 'icon' in tab ? tab.icon : null;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      data-sound="toggle"
                      onClick={() => setStudentFilter(tab.id)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        active
                          ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-xs'
                          : 'bg-slate-100/85 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200/75 dark:hover:bg-white/10'
                      }`}
                    >
                      {TabIcon && (
                        <TabIcon
                          className={`w-3.5 h-3.5 ${
                            tab.id === 'starred'
                              ? active
                                ? 'fill-current'
                                : 'fill-amber-400 text-amber-500'
                              : active
                                ? 'text-cyan-300 dark:text-[#031126]'
                                : 'text-sky-600 dark:text-cyan-400'
                          }`}
                        />
                      )}
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

              {availableSubjects.length > 1 && (
                <div className="flex items-center gap-2 shrink-0">
                  <label
                    htmlFor="student-exam-subject-filter"
                    className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap"
                  >
                    Môn học:
                  </label>
                  <select
                    id="student-exam-subject-filter"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/90 dark:bg-[#050f24]/90 border border-slate-200/80 dark:border-cyan-400/20 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="all">Tất cả các môn</option>
                    {availableSubjects.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* History Filters: Time (Month / Year) & Score Status */}
            {studentFilter === 'history' ? (
              <div className="space-y-3 pt-3 border-t border-slate-200/70 dark:border-cyan-400/10">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Month & Year Selectors */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                      <span>Thời gian:</span>
                    </span>

                    <select
                      aria-label="Lọc lịch sử theo tháng"
                      value={historyMonth}
                      onChange={(e) => setHistoryMonth(e.target.value)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/90 dark:bg-[#050f24]/90 border border-slate-200/80 dark:border-cyan-400/20 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="all">Tất cả các tháng</option>
                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                        <option key={m} value={String(m)}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Lọc lịch sử theo năm"
                      value={historyYear}
                      onChange={(e) => setHistoryYear(e.target.value)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/90 dark:bg-[#050f24]/90 border border-slate-200/80 dark:border-cyan-400/20 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="all">Tất cả các năm</option>
                      {historyAvailableYears.map((yr) => (
                        <option key={yr} value={String(yr)}>
                          Năm {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Score Status Filter */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mr-1">
                      <Award className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                      <span>Trạng thái điểm:</span>
                    </span>
                    {(
                      [
                        { id: 'all', label: 'Tất cả điểm', count: historyScoreCounts.all },
                        { id: 'excellent', label: 'Giỏi (≥ 8.0đ)', count: historyScoreCounts.excellent },
                        { id: 'good', label: 'Khá (6.5–7.9đ)', count: historyScoreCounts.good },
                        { id: 'pass', label: 'Đạt (5.0–6.4đ)', count: historyScoreCounts.pass },
                        { id: 'fail', label: 'Chưa đạt (< 5.0đ)', count: historyScoreCounts.fail }
                      ] as const
                    ).map((tier) => {
                      const active = historyScoreStatus === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          data-sound="toggle"
                          onClick={() => setHistoryScoreStatus(tier.id)}
                          className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-xs'
                              : 'bg-slate-100/85 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/75 dark:hover:bg-white/10'
                          }`}
                        >
                          <span>{tier.label}</span>
                          <span
                            className={`font-mono tabular-nums text-[11px] ${
                              active ? 'opacity-85' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            ({tier.count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Optional Folders Strip */
              folders.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-200/70 dark:border-cyan-400/10">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">Thư mục:</span>
                  <button
                    type="button"
                    data-sound="toggle"
                    onClick={() => setSelectedFolder(null)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedFolder === null
                        ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-xs'
                        : 'bg-slate-100/85 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/75 dark:hover:bg-white/10'
                    }`}
                  >
                    Tất cả thư mục
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      data-sound="toggle"
                      onClick={() => setSelectedFolder(selectedFolder === f.id ? null : f.id)}
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedFolder === f.id
                          ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-xs'
                          : 'bg-slate-100/85 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/75 dark:hover:bg-white/10'
                      }`}
                    >
                      <Folder className="w-3.5 h-3.5" />
                      <span>{f.name}</span>
                    </button>
                  ))}
                </div>
              )
            )}
          </section>

          {/* 4. Results Summary Bar */}
          {studentFilter === 'history' ? (
            <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Hiển thị <strong className="font-mono tabular-nums text-slate-900 dark:text-white">{filteredHistorySubmissions.length}</strong> lượt thi trong quá khứ
                {sortOrder === 'newest' ? ' · Mới nhất trước' : ' · Cũ nhất trước'}
              </span>
              {(historyMonth !== 'all' || historyYear !== 'all' || historyScoreStatus !== 'all' || selectedSubject !== 'all' || effectiveSearch.trim() !== '') && (
                <button
                  type="button"
                  data-sound="tap"
                  onClick={resetHistoryFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-cyan-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại bộ lọc lịch sử</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Hiển thị <strong className="font-mono tabular-nums text-slate-900 dark:text-white">{filteredExams.length}</strong> đề thi
                {sortOrder === 'newest' ? ' · Đang xếp từ mới nhất đến cũ nhất' : ' · Đang xếp từ cũ nhất đến mới nhất'}
              </span>
              {(studentFilter !== 'all' || selectedSubject !== 'all' || selectedFolder !== null || effectiveSearch.trim() !== '') && (
                <button
                  type="button"
                  data-sound="tap"
                  onClick={resetStudentFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-cyan-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại bộ lọc</span>
                </button>
              )}
            </div>
          )}

          {/* 5. Student History Panel OR Exam Cards Grid */}
          {studentFilter === 'history' ? (
            <div className="space-y-4 sf-panel-enter">
              {/* Compact History Analytics Summary */}
              {filteredHistorySubmissions.length > 0 && (
                <div className="sf-teacher-surface rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng lượt nộp bài</div>
                    <div className="font-display text-xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-0.5">
                      {historySummaryStats.count} lượt
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Điểm trung bình</div>
                    <div className="font-display text-xl font-extrabold tabular-nums text-sky-600 dark:text-cyan-300 mt-0.5">
                      {historySummaryStats.avgScore.toFixed(1)}đ
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Điểm cao nhất</div>
                    <div className="font-display text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {historySummaryStats.bestScore.toFixed(1)}đ
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tỉ lệ đạt (≥ 5.0đ)</div>
                    <div className="font-display text-xl font-extrabold tabular-nums text-indigo-600 dark:text-indigo-300 mt-0.5">
                      {historySummaryStats.passRate}%
                    </div>
                  </div>
                </div>
              )}

              {filteredHistorySubmissions.length > 0 ? (
                <div className="space-y-3">
                  {filteredHistorySubmissions.map((item) => {
                    const { submission: sub, exam: linkedExam, subject, scoreMeta } = item;
                    const isExpanded = expandedHistoryId === sub.id;
                    const accuracyPct =
                      sub.totalQuestions > 0 ? Math.round((sub.correctCount / sub.totalQuestions) * 100) : 0;

                    return (
                      <article
                        key={sub.id}
                        className="sf-teacher-tile relative overflow-hidden rounded-2xl p-5 transition-all duration-150"
                      >
                        <span className={`absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r ${scoreMeta.accent}`} />

                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Left: Score Badge + Main Attempt Info */}
                          <div className="flex items-start sm:items-center gap-4 min-w-0">
                            {/* Score Box */}
                            <div className="w-20 h-20 rounded-2xl bg-slate-50/90 dark:bg-[#050f24]/90 border border-slate-200/80 dark:border-cyan-400/20 flex flex-col items-center justify-center shrink-0">
                              <span
                                className={`font-display text-2xl font-extrabold tabular-nums leading-none ${scoreMeta.scoreTextClass}`}
                              >
                                {sub.score.toFixed(1)}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
                                điểm / 10
                              </span>
                            </div>

                            {/* Metadata & Title */}
                            <div className="min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-semibold text-sky-700 dark:text-cyan-300">{subject}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {formatSubmissionDateLabel(sub.submittedAt, sub.id)}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${scoreMeta.badgeClass}`}
                                >
                                  {scoreMeta.label}
                                </span>
                              </div>

                              <h3 className="font-display text-base sm:text-[17px] font-bold text-slate-900 dark:text-white leading-snug">
                                {sub.examTitle}
                              </h3>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                                <span className="inline-flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <span>
                                    Đúng {sub.correctCount}/{sub.totalQuestions} câu ({accuracyPct}%)
                                  </span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-cyan-400 shrink-0" />
                                  <span>Thời gian làm: {formatTimeSpent(sub.timeSpentSeconds)}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {linkedExam && linkedExam.questions.length > 0 && (
                              <button
                                type="button"
                                data-sound="toggle"
                                onClick={() => setExpandedHistoryId(isExpanded ? null : sub.id)}
                                className="sf-teacher-tile min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                                )}
                                <span>{isExpanded ? 'Thu gọn bài làm' : 'Xem chi tiết'}</span>
                              </button>
                            )}

                            {linkedExam && (
                              <>
                                <button
                                  type="button"
                                  data-sound="nav"
                                  onClick={() => openExamDistributionDetail(linkedExam.id)}
                                  className="sf-teacher-tile min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  <BarChart3 className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                                  <span>Phổ điểm</span>
                                </button>

                                <button
                                  type="button"
                                  data-sound="nav"
                                  onClick={() => openExamTakingPage(linkedExam)}
                                  className="bg-[#081b3d] hover:bg-[#0d2754] dark:bg-gradient-to-r dark:from-cyan-400 dark:to-sky-400 dark:hover:brightness-110 text-white dark:text-[#031126] shadow-[0_6px_18px_-6px_rgba(8,27,61,0.45)] dark:shadow-[0_0_22px_-6px_rgba(34,211,238,0.65)] min-h-[38px] px-4 py-2 rounded-xl font-display text-xs font-bold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>Làm lại đề</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Expandable Answer Breakdown */}
                        {isExpanded && linkedExam && (
                          <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-cyan-400/15 space-y-2.5">
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                              Chi tiết đáp án bài làm ({linkedExam.questions.length} câu hỏi)
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {linkedExam.questions.map((q, qIdx) => {
                                const chosenIdx = sub.answers?.[q.id];
                                const isAnswered = typeof chosenIdx === 'number';
                                const isCorrect = isAnswered && chosenIdx === q.correctOption;
                                return (
                                  <div
                                    key={q.id}
                                    className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                                      isCorrect
                                        ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-400/25'
                                        : 'bg-rose-50/70 dark:bg-rose-500/10 border-rose-200/80 dark:border-rose-400/25'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                                        Câu {qIdx + 1}: {q.questionText}
                                      </span>
                                      {isCorrect ? (
                                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                      ) : (
                                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                                      <div>
                                        <span className="text-slate-500 dark:text-slate-400">Bạn chọn: </span>
                                        <span
                                          className={`font-semibold ${
                                            isCorrect
                                              ? 'text-emerald-700 dark:text-emerald-300'
                                              : 'text-rose-700 dark:text-rose-300'
                                          }`}
                                        >
                                          {isAnswered && q.options[chosenIdx]
                                            ? q.options[chosenIdx]
                                            : 'Chưa trả lời'}
                                        </span>
                                      </div>
                                      {!isCorrect && q.options[q.correctOption] && (
                                        <div>
                                          <span className="text-slate-500 dark:text-slate-400">Đáp án đúng: </span>
                                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                            {q.options[q.correctOption]}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="sf-teacher-surface rounded-2xl py-14 px-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-cyan-500/15 text-sky-600 dark:text-cyan-300 border border-sky-200/70 dark:border-cyan-400/25 flex items-center justify-center mx-auto">
                    <History className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {myAllSubmissions.length === 0
                      ? 'Bạn chưa có lịch sử làm bài nào'
                      : 'Không có bài thi nào khớp bộ lọc lịch sử'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {myAllSubmissions.length === 0
                      ? 'Hãy chọn một đề thi trong kho đề và hoàn thành bài làm để lưu lại tiến trình và điểm số tại đây.'
                      : 'Thử thay đổi khoảng thời gian (tháng/năm), trạng thái điểm số hoặc từ khóa tìm kiếm.'}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      data-sound="tap"
                      onClick={myAllSubmissions.length === 0 ? () => setStudentFilter('all') : resetHistoryFilters}
                      className="sf-neon-cta min-h-[40px] px-4 py-2 rounded-xl font-display text-xs font-bold cursor-pointer"
                    >
                      {myAllSubmissions.length === 0 ? 'Khám phá kho đề thi' : 'Đặt lại bộ lọc lịch sử'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : filteredExams.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredExams.map((exam) => {
                const isStarred = starredExamIds.includes(exam.id);
                const mySubs = mySubmissionsByExam.get(exam.id) || [];
                const hasDone = mySubs.length > 0;
                const bestScore = hasDone ? Math.max(...mySubs.map((s) => s.score)) : null;
                const totalSubmissions =
                  submissions.filter((s) => s.examId === exam.id).length || exam.submissionsCount || 0;
                const isNewest = exam.id === newestExamId && baseExams.length > 1;
                const isOldest = exam.id === oldestExamId && baseExams.length > 1;

                const topAccentGradient = isStarred
                  ? 'from-amber-400 via-orange-400 to-yellow-300'
                  : hasDone
                    ? 'from-emerald-400 via-teal-400 to-cyan-400'
                    : 'from-cyan-400 via-sky-500 to-indigo-500';

                return (
                  <article
                    key={exam.id}
                    data-sound="nav"
                    onClick={() => openExamDistributionDetail(exam.id)}
                    className={`sf-teacher-tile group relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between cursor-pointer ${
                      isStarred ? 'ring-1 ring-amber-400/65 dark:ring-amber-400/45' : ''
                    }`}
                  >
                    {/* Top Neon Accent Hairline */}
                    <span className={`absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r ${topAccentGradient}`} />

                    <div>
                      {/* Top Row: Clean Unboxed Metadata Kicker + Interactive Star Button */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 min-w-0 pt-0.5">
                          <span className="font-semibold text-sky-700 dark:text-cyan-300">{exam.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{formatExamDateLabel(exam)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[180px]">Giao cho: {exam.assignedTo}</span>
                          {isNewest && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                Đề mới nhất
                              </span>
                            </>
                          )}
                          {isOldest && sortOrder === 'oldest' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-slate-600 dark:text-slate-300">
                                Đề cũ nhất
                              </span>
                            </>
                          )}
                        </div>

                        {/* Tactile Star Toggle Button */}
                        <button
                          type="button"
                          data-sound="toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStarExam(exam.id);
                          }}
                          aria-pressed={isStarred}
                          aria-label={isStarred ? `Bỏ đánh dấu sao đề ${exam.title}` : `Đánh dấu sao đề ${exam.title}`}
                          title={isStarred ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao đề giáo viên giao'}
                          className={`w-10 h-10 -mt-1 -mr-1 rounded-xl flex items-center justify-center border transition-all duration-150 active:scale-90 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                            isStarred
                              ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-400/40 text-amber-500 shadow-[0_0_14px_-4px_rgba(245,158,11,0.4)]'
                              : 'bg-transparent border-transparent text-slate-400 hover:text-amber-500 hover:bg-slate-100/80 dark:hover:bg-white/10'
                          }`}
                        >
                          <Star
                            className={`w-4 h-4 transition-transform duration-150 ${
                              isStarred ? 'fill-amber-400 text-amber-500 scale-110' : ''
                            }`}
                          />
                        </button>
                      </div>

                      {/* Exam Title & Description */}
                      <div className="mt-2.5">
                        <h3 className="font-display text-base sm:text-[17px] font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 group-hover:text-sky-700 dark:group-hover:text-cyan-300 transition-colors duration-150">
                          {exam.title}
                        </h3>
                        {exam.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                            {exam.description}
                          </p>
                        )}
                      </div>

                      {/* Clean Unboxed Specs Strip */}
                      <div className="grid grid-cols-3 gap-3 pt-4 mt-4 border-t border-slate-200/70 dark:border-cyan-400/10">
                        <div>
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Thời gian</div>
                          <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                            {exam.durationMinutes} phút
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Số lượng câu</div>
                          <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                            {exam.questions.length} câu
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Trạng thái làm bài</div>
                          {hasDone && bestScore !== null ? (
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="font-mono tabular-nums truncate">
                                Đạt {bestScore.toFixed(1)}đ
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                              <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-cyan-400 shrink-0" />
                              <span className="truncate">Chưa làm</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer Action Row */}
                    <div
                      className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-200/70 dark:border-cyan-400/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          data-sound="nav"
                          onClick={() => openExamDistributionDetail(exam.id)}
                          className="sf-teacher-tile min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                          <span>Phổ điểm</span>
                        </button>
                        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap">
                          <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          {totalSubmissions} lượt nộp
                        </span>
                      </div>

                      <button
                        type="button"
                        data-sound="nav"
                        onClick={() => openExamTakingPage(exam)}
                        className={`min-h-[40px] px-4 py-2 rounded-xl font-display text-xs font-bold flex items-center gap-1.5 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                          hasDone
                            ? 'bg-[#081b3d] hover:bg-[#0d2754] dark:bg-gradient-to-r dark:from-cyan-400 dark:to-sky-400 dark:hover:brightness-110 text-white dark:text-[#031126] shadow-[0_6px_18px_-6px_rgba(8,27,61,0.45)] dark:shadow-[0_0_22px_-6px_rgba(34,211,238,0.65)]'
                            : 'sf-neon-cta'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{hasDone ? 'Làm lại đề' : 'Vào thi ngay'}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* Clean Luxury Empty State */
            <div className="sf-teacher-surface rounded-2xl py-14 px-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-cyan-500/15 text-sky-600 dark:text-cyan-300 border border-sky-200/70 dark:border-cyan-400/25 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Không tìm thấy đề thi phù hợp
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {studentFilter === 'starred'
                  ? 'Bạn chưa đánh dấu sao đề thi nào. Nhấn vào biểu tượng ngôi sao trên mỗi đề thi để lưu lại các đề trọng tâm.'
                  : 'Hãy thử đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc để xem toàn bộ đề thi giáo viên đã giao.'}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  data-sound="tap"
                  onClick={resetStudentFilters}
                  className="sf-neon-cta min-h-[40px] px-4 py-2 rounded-xl font-display text-xs font-bold cursor-pointer"
                >
                  Xem tất cả đề thi
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* =================================================================
           TEACHER EXAM MANAGEMENT WORKSPACE — Deep Navy & Refined Neon
           ================================================================= */
        <div className="space-y-5 relative z-10 sf-panel-enter">
          {/* 1. Luxury Deep Navy & Neon Hero Banner */}
          <section className="sf-navy-hero-banner relative overflow-hidden rounded-3xl text-white p-6 sm:p-7">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-300/90 font-medium">
                  <GraduationCap className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                  <span>Trung tâm Khảo thí &amp; Ngân hàng Đề</span>
                  <span aria-hidden="true" className="text-cyan-400/50">·</span>
                  <span className="font-mono tabular-nums text-sky-100">{teacherCounts.total} đề thi</span>
                  <span aria-hidden="true" className="text-cyan-400/50">·</span>
                  <span className="font-mono tabular-nums text-emerald-300">{teacherCounts.totalSubmissions} lượt nộp</span>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400/25 via-sky-500/20 to-indigo-500/25 border border-cyan-300/40 flex items-center justify-center shrink-0 shadow-[0_0_24px_-4px_rgba(34,211,238,0.45)]">
                    <GraduationCap className="w-6 h-6 text-cyan-300" />
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance leading-tight">
                    Quản lý Đề thi &amp; Khảo thí
                  </h1>
                </div>

                <p className="text-xs sm:text-sm text-sky-100/85 leading-relaxed">
                  Tổ chức kho đề chuẩn hóa theo thư mục, xuất bản bài kiểm tra nhanh chóng và phân tích phổ điểm trực quan theo từng lớp.
                </p>
              </div>

              {/* Primary & Secondary Actions */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {onSavePermanent && (
                  <button
                    type="button"
                    data-sound="success"
                    onClick={onSavePermanent}
                    title="Lưu cố định tất cả đề thi hiện có trong trang Thi cử lên máy chủ"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 text-xs font-bold border border-emerald-400/40 backdrop-blur-xs transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Lưu cố định</span>
                  </button>
                )}

                <button
                  type="button"
                  data-sound="tap"
                  onClick={() => setIsBankModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/18 text-white text-xs font-semibold border border-white/20 backdrop-blur-xs transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Library className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Ngân hàng mẫu</span>
                </button>

                <button
                  type="button"
                  data-sound="tap"
                  onClick={() => setIsFolderModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/18 text-white text-xs font-semibold border border-white/20 backdrop-blur-xs transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Tạo thư mục</span>
                </button>

                <button
                  type="button"
                  data-sound="nav"
                  onClick={() => {
                    if (onOpenCreateExam) {
                      onOpenCreateExam();
                    } else {
                      setEditingExam(null);
                      setCreateModalMode('manual');
                      setIsCreateModalOpen(true);
                    }
                  }}
                  className="sf-neon-cta inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-display font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo đề thi</span>
                </button>
              </div>
            </div>
          </section>

          {/* 2. Interactive 4-KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <button
              type="button"
              data-sound="toggle"
              onClick={() => setTeacherStatusFilter('all')}
              className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
                teacherStatusFilter === 'all' ? 'ring-1.5 ring-sky-500 dark:ring-cyan-400' : ''
              }`}
            >
              <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng số đề</span>
                <FileText className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {teacherCounts.total}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">đề thi</span>
              </div>
            </button>

            <button
              type="button"
              data-sound="toggle"
              onClick={() => setTeacherStatusFilter(teacherStatusFilter === 'published' ? 'all' : 'published')}
              className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
                teacherStatusFilter === 'published' ? 'ring-1.5 ring-emerald-500 dark:ring-emerald-400' : ''
              }`}
            >
              <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Đã xuất bản</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {teacherCounts.published}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">đang mở</span>
              </div>
            </button>

            <button
              type="button"
              data-sound="toggle"
              onClick={() => setTeacherStatusFilter(teacherStatusFilter === 'draft' ? 'all' : 'draft')}
              className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
                teacherStatusFilter === 'draft' ? 'ring-1.5 ring-amber-500 dark:ring-amber-400' : ''
              }`}
            >
              <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Bản nháp</span>
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-extrabold tabular-nums text-amber-700 dark:text-amber-300">
                  {teacherCounts.draft}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">chờ duyệt</span>
              </div>
            </button>

            <button
              type="button"
              data-sound="nav"
              onClick={() => {
                setDetailExamId('all');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer group"
              title="Xem thống kê phổ điểm toàn bộ đề thi"
            >
              <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng lượt nộp</span>
                <BarChart3 className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-extrabold tabular-nums text-sky-700 dark:text-cyan-300">
                    {teacherCounts.totalSubmissions}
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">bài nộp</span>
                </div>
                <span className="text-[11px] font-semibold text-sky-700 dark:text-cyan-300 group-hover:underline">
                  Phổ điểm →
                </span>
              </div>
            </button>
          </div>

          {/* 3. Search, Status, Subject, Sort & Folder Toolbar */}
          <section className="sf-teacher-surface rounded-2xl p-4 sm:p-5 space-y-4">
            {/* Row 1: Search Input + Subject Select + Sort Control */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 dark:text-cyan-300/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={effectiveSearch}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Tìm kiếm tên đề thi, môn học, lớp được giao..."
                  className="w-full min-h-[42px] pl-10 pr-10 py-2 text-sm bg-white/90 dark:bg-[#051025] border border-slate-200/90 dark:border-cyan-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-colors"
                />
                {effectiveSearch && (
                  <button
                    type="button"
                    data-sound="tap"
                    onClick={() => handleSearchInput('')}
                    aria-label="Xóa từ khóa tìm kiếm"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {availableSubjects.length > 1 && (
                  <select
                    aria-label="Lọc theo môn học"
                    value={teacherSubjectFilter}
                    onChange={(e) => setTeacherSubjectFilter(e.target.value)}
                    className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#051025] border border-slate-200/90 dark:border-cyan-500/25 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 cursor-pointer"
                  >
                    <option value="all">Tất cả môn học</option>
                    {availableSubjects.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                )}

                <div
                  role="group"
                  aria-label="Sắp xếp theo thời gian"
                  className="inline-flex items-center p-1 rounded-xl bg-slate-100/90 dark:bg-[#051025] border border-slate-200/80 dark:border-cyan-500/20"
                >
                  <button
                    type="button"
                    data-sound="toggle"
                    onClick={() => setSortOrder('newest')}
                    className={`min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      sortOrder === 'newest'
                        ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-cyan-200'
                    }`}
                  >
                    <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                    <span>Mới nhất</span>
                  </button>
                  <button
                    type="button"
                    data-sound="toggle"
                    onClick={() => setSortOrder('oldest')}
                    className={`min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      sortOrder === 'oldest'
                        ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-cyan-200'
                    }`}
                  >
                    <ArrowUpNarrowWide className="w-3.5 h-3.5" />
                    <span>Cũ nhất</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Status Tabs & Folders Strip */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-200/70 dark:border-cyan-900/40">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'all', label: 'Tất cả đề', count: teacherCounts.total },
                    { id: 'published', label: 'Đã xuất bản', count: teacherCounts.published },
                    { id: 'draft', label: 'Bản nháp', count: teacherCounts.draft }
                  ] as const
                ).map((tab) => {
                  const active = teacherStatusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      data-sound="toggle"
                      onClick={() => setTeacherStatusFilter(tab.id)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                        active
                          ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-sm'
                          : 'bg-white/80 dark:bg-[#071530] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-cyan-500/20 hover:border-sky-400/60 dark:hover:border-cyan-400/50'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`font-mono tabular-nums text-[11px] ${
                          active ? 'opacity-90' : 'text-slate-500 dark:text-cyan-300/70'
                        }`}
                      >
                        ({tab.count})
                      </span>
                    </button>
                  );
                })}
              </div>

              {folders.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 whitespace-nowrap">
                    Thư mục:
                  </span>
                  <button
                    type="button"
                    data-sound="toggle"
                    onClick={() => setSelectedFolder(null)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedFolder === null
                        ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126]'
                        : 'bg-white/80 dark:bg-[#071530] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-cyan-500/20 hover:border-sky-400/50'
                    }`}
                  >
                    Tất cả
                  </button>
                  {folders.map((f) => {
                    const isSelected = selectedFolder === f.id;
                    const countInFolder = folderExamCounts.get(f.id) || 0;
                    return (
                      <div
                        key={f.id}
                        className={`inline-flex items-center rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] border-[#081b3d] dark:border-cyan-300'
                            : 'bg-white/80 dark:bg-[#071530] text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-cyan-500/20 hover:border-sky-400/60'
                        }`}
                      >
                        <button
                          type="button"
                          data-sound="toggle"
                          onClick={() => setSelectedFolder(isSelected ? null : f.id)}
                          className="min-h-[34px] pl-3 pr-2 py-1 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Folder className="w-3.5 h-3.5 shrink-0" />
                          <span>{f.name}</span>
                          <span className={`font-mono tabular-nums text-[11px] ${isSelected ? 'opacity-80' : 'text-slate-500 dark:text-cyan-300/70'}`}>
                            ({countInFolder})
                          </span>
                        </button>
                        {onDeleteFolder && (
                          <button
                            type="button"
                            data-sound="tap"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedFolder === f.id) setSelectedFolder(null);
                              onDeleteFolder(f.id);
                            }}
                            title={`Xóa thư mục ${f.name}`}
                            aria-label={`Xóa thư mục ${f.name}`}
                            className={`pr-2 pl-0.5 py-1 text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? 'text-white/75 hover:text-white dark:text-[#031126]/70 dark:hover:text-rose-700'
                                : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                            }`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 4. Results Summary & Bulk Selection Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Hiển thị <strong className="font-mono tabular-nums text-slate-900 dark:text-cyan-200">{filteredExams.length}</strong> đề thi
              {selectedFolder ? ` trong thư mục "${folders.find((f) => f.id === selectedFolder)?.name || ''}"` : ''}
              {sortOrder === 'newest' ? ' · Mới nhất trước' : ' · Cũ nhất trước'}
            </span>
            {(teacherStatusFilter !== 'all' ||
              teacherSubjectFilter !== 'all' ||
              selectedFolder !== null ||
              effectiveSearch.trim() !== '') && (
              <button
                type="button"
                data-sound="tap"
                onClick={resetTeacherFilters}
                className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 dark:text-cyan-300 hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại bộ lọc</span>
              </button>
            )}
          </div>

          {selectedExamIds.length > 0 && (
            <div className="sf-teacher-surface px-4 py-3 border-rose-300/70 dark:border-rose-500/40 bg-rose-50/75 dark:bg-rose-950/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs sf-panel-enter">
              <span className="font-bold text-rose-800 dark:text-rose-200">
                Đã chọn <strong className="font-mono tabular-nums">{selectedExamIds.length}</strong> đề thi
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-sound="tap"
                  onClick={() => setSelectedExamIds([])}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#071530] border border-rose-200 dark:border-rose-500/30 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  data-sound="tap"
                  onClick={() => {
                    if (onDeleteExams) {
                      onDeleteExams(selectedExamIds);
                    } else {
                      selectedExamIds.forEach((id) => onDeleteExam(id));
                    }
                    setSelectedExamIds([]);
                  }}
                  className="min-h-[36px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ({selectedExamIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* 5. Exam Directory Table (Desktop) & Cards (Mobile) */}
          {filteredExams.length > 0 ? (
            <>
              {/* Desktop Luxury Table */}
              <div className="hidden md:block sf-teacher-surface rounded-3xl overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#051129] via-[#091f46] to-[#0d2b60] text-white border-b border-cyan-400/25 text-[11px] font-display font-bold uppercase tracking-wider select-none">
                        <th className="py-3.5 pl-5 pr-2 w-11">
                          <input
                            type="checkbox"
                            aria-label="Chọn tất cả đề thi"
                            checked={selectedExamIds.length === filteredExams.length && filteredExams.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="w-4 h-4 rounded-md accent-cyan-400 border-cyan-400/40 cursor-pointer"
                          />
                        </th>
                        <th className="py-3.5 px-3 text-cyan-200 whitespace-nowrap">Đề thi</th>
                        <th className="py-3.5 px-3 text-sky-100 whitespace-nowrap">Giao cho</th>
                        <th className="py-3.5 px-3 text-right text-cyan-200 whitespace-nowrap">Lượt nộp</th>
                        <th className="py-3.5 px-3 text-emerald-200 whitespace-nowrap">Trạng thái</th>
                        <th className="py-3.5 px-3 text-sky-100 whitespace-nowrap">Ngày tạo</th>
                        <th className="py-3.5 pl-3 pr-5 text-right text-cyan-200 whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-cyan-900/35 text-sm">
                      {filteredExams.map((exam) => {
                        const isChecked = selectedExamIds.includes(exam.id);
                        const totalSubs =
                          submissions.filter((s) => s.examId === exam.id).length || exam.submissionsCount || 0;
                        const folderObj = exam.folderId ? folders.find((f) => f.id === exam.folderId) : null;

                        return (
                          <tr
                            key={exam.id}
                            data-sound="nav"
                            onClick={() => openExamDistributionDetail(exam.id)}
                            className={`group transition-colors duration-150 cursor-pointer ${
                              isChecked
                                ? 'bg-sky-50/85 dark:bg-cyan-950/35'
                                : 'hover:bg-sky-50/65 dark:hover:bg-[#0c1e3e]/85'
                            }`}
                          >
                            <td className="py-4 pl-5 pr-2 align-middle" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                aria-label={`Chọn đề ${exam.title}`}
                                checked={isChecked}
                                onChange={() => handleToggleSelectExam(exam.id)}
                                className="w-4 h-4 rounded-md accent-sky-600 dark:accent-cyan-400 border-slate-300 dark:border-cyan-500/40 cursor-pointer"
                              />
                            </td>

                            <td className="py-4 px-3 align-middle min-w-[260px]">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#081b3d] to-[#0f3574] dark:from-cyan-500/20 dark:to-indigo-500/25 border border-cyan-400/35 text-cyan-200 flex items-center justify-center shrink-0 shadow-xs">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-display font-bold text-slate-900 dark:text-white group-hover:text-sky-700 dark:group-hover:text-cyan-300 transition-colors line-clamp-1">
                                    {exam.title}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-sky-700 dark:text-cyan-300">{exam.subject}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono tabular-nums">{exam.durationMinutes} phút</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono tabular-nums">{exam.questions.length} câu</span>
                                    {folderObj && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-cyan-200/80">
                                          <Folder className="w-3 h-3" />
                                          {folderObj.name}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-3 align-middle text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {exam.assignedTo || 'Tất cả mọi người'}
                            </td>

                            <td className="py-4 px-3 align-middle text-right font-mono tabular-nums font-extrabold text-slate-900 dark:text-cyan-100 whitespace-nowrap">
                              {totalSubs}
                            </td>

                            <td className="py-4 px-3 align-middle whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                                  exam.status === 'published'
                                    ? 'text-emerald-700 dark:text-emerald-300'
                                    : 'text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {exam.status === 'published' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span>{exam.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</span>
                              </span>
                            </td>

                            <td className="py-4 px-3 align-middle font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {formatExamDateLabel(exam)}
                            </td>

                            <td
                              className="py-4 pl-3 pr-5 align-middle text-right whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  data-sound="nav"
                                  onClick={() => openExamDistributionDetail(exam.id)}
                                  className="sf-teacher-tile min-h-[36px] px-3 py-1.5 rounded-xl text-slate-800 dark:text-cyan-100 hover:text-sky-700 dark:hover:text-cyan-300 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                                  title="Xem phổ điểm & thống kê đề thi"
                                >
                                  <BarChart3 className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                                  <span>Phổ điểm</span>
                                </button>
                                <button
                                  type="button"
                                  data-sound="tap"
                                  onClick={() => {
                                    setEditingExam(exam);
                                    setIsCreateModalOpen(true);
                                  }}
                                  className="w-9 h-9 inline-flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-sky-700 dark:hover:text-cyan-300 rounded-xl hover:bg-sky-50 dark:hover:bg-cyan-500/15 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                                  title="Sửa đề thi"
                                  aria-label={`Sửa đề ${exam.title}`}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  data-sound="tap"
                                  onClick={() => {
                                    onDeleteExam(exam.id);
                                    setSelectedExamIds((prev) => prev.filter((i) => i !== exam.id));
                                  }}
                                  className="w-9 h-9 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                                  title="Xóa đề thi"
                                  aria-label={`Xóa đề ${exam.title}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Luxury Cards */}
              <div className="md:hidden space-y-3">
                {filteredExams.map((exam) => {
                  const isChecked = selectedExamIds.includes(exam.id);
                  const totalSubs =
                    submissions.filter((s) => s.examId === exam.id).length || exam.submissionsCount || 0;

                  return (
                    <article
                      key={exam.id}
                      data-sound="nav"
                      onClick={() => openExamDistributionDetail(exam.id)}
                      className={`sf-teacher-tile rounded-2xl p-4 cursor-pointer space-y-3 ${
                        isChecked ? 'ring-1.5 ring-sky-500 dark:ring-cyan-400' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            aria-label={`Chọn đề ${exam.title}`}
                            checked={isChecked}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => handleToggleSelectExam(exam.id)}
                            className="w-4 h-4 mt-1 rounded-md accent-sky-600 dark:accent-cyan-400 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                              <span className="font-semibold text-sky-700 dark:text-cyan-300">{exam.subject}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{formatExamDateLabel(exam)}</span>
                            </div>
                            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white leading-snug mt-1">
                              {exam.title}
                            </h3>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold shrink-0 ${
                            exam.status === 'published'
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {exam.status === 'published' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          <span>{exam.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</span>
                        </span>
                      </div>

                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/70 dark:border-cyan-900/35">
                        <span className="font-mono tabular-nums">{exam.durationMinutes} phút</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{exam.questions.length} câu</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{totalSubs} lượt nộp</span>
                        <span aria-hidden="true">·</span>
                        <span>{exam.assignedTo || 'Tất cả mọi người'}</span>
                      </div>

                      <div
                        className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-cyan-900/35"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          data-sound="nav"
                          onClick={() => openExamDistributionDetail(exam.id)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-cyan-500/15 text-sky-800 dark:text-cyan-200 border border-sky-200/70 dark:border-cyan-500/30 text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                          <span>Phổ điểm</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-sound="tap"
                            onClick={() => {
                              setEditingExam(exam);
                              setIsCreateModalOpen(true);
                            }}
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-cyan-500/15"
                            aria-label={`Sửa đề ${exam.title}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            data-sound="tap"
                            onClick={() => {
                              onDeleteExam(exam.id);
                              setSelectedExamIds((prev) => prev.filter((i) => i !== exam.id));
                            }}
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            aria-label={`Xóa đề ${exam.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            /* Clean Empty State */
            <div className="sf-teacher-surface rounded-3xl py-14 px-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#081b3d] to-[#0f3574] text-cyan-300 border border-cyan-400/30 flex items-center justify-center mx-auto shadow-sm">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {exams.length === 0 ? 'Chưa có đề thi nào trong kho' : 'Không tìm thấy đề thi phù hợp'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {exams.length === 0
                  ? 'Bắt đầu tạo đề thi trắc nghiệm mới từ file Word/PDF hoặc trình tạo đề AI để giao cho học sinh.'
                  : 'Thử thay đổi từ khóa tìm kiếm, trạng thái hoặc bộ lọc thư mục để xem các đề thi khác.'}
              </p>
              <div className="pt-2 flex items-center justify-center gap-2.5">
                {exams.length === 0 ? (
                  <button
                    type="button"
                    data-sound="nav"
                    onClick={() => {
                      if (onOpenCreateExam) {
                        onOpenCreateExam();
                      } else {
                        setEditingExam(null);
                        setCreateModalMode('manual');
                        setIsCreateModalOpen(true);
                      }
                    }}
                    className="sf-neon-cta min-h-[40px] px-4 py-2 rounded-xl font-display text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tạo đề thi đầu tiên</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    data-sound="tap"
                    onClick={resetTeacherFilters}
                    className="sf-neon-cta min-h-[40px] px-4 py-2 rounded-xl font-display text-xs font-bold cursor-pointer"
                  >
                    Đặt lại bộ lọc
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Exam Modal */}
      <CreateExamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSaveExam={onSaveExam}
        editingExam={editingExam}
        initialMode={createModalMode}
      />

      {/* Create Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="relative w-full max-w-sm sf-teacher-surface rounded-3xl overflow-hidden shadow-2xl sf-panel-enter">
            <div className="sf-navy-hero-banner px-5 py-4 text-white flex items-center justify-between">
              <h3 className="font-display text-base font-bold flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-cyan-300" />
                <span>Tạo Thư Mục Đề Thi Mới</span>
              </h3>
              <button
                type="button"
                data-sound="tap"
                onClick={() => setIsFolderModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-100 transition cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-cyan-300 mb-1.5">
                  Tên thư mục mới
                </label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="VD: Đề Lịch Sử 12 THPT QG 2026..."
                  className="w-full px-4 py-3 text-xs bg-white dark:bg-[#051025] border border-slate-200 dark:border-cyan-500/30 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-cyan-300/40 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  data-sound="tap"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  data-sound="success"
                  className="sf-neon-cta px-5 py-2 text-xs font-display font-bold rounded-xl cursor-pointer"
                >
                  Tạo thư mục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Bank Common Selection Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="relative w-full max-w-xl sf-teacher-surface rounded-3xl overflow-hidden shadow-2xl sf-panel-enter">
            <div className="sf-navy-hero-banner px-5 py-4 text-white flex items-center justify-between">
              <h3 className="font-display text-base font-bold flex items-center gap-2.5">
                <Library className="w-4 h-4 text-cyan-300" />
                <span>Kho Ngân Hàng Đề Thi Chuẩn Hóa</span>
              </h3>
              <button
                type="button"
                data-sound="tap"
                onClick={() => setIsBankModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-100 transition cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-cyan-100/80">
                Chọn đề thi từ thư viện câu hỏi mẫu đã được thẩm định để thêm trực tiếp vào hệ thống:
              </p>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                {[
                  {
                    title: 'Bộ đề thi Tốt nghiệp THPT Lịch sử - Chuyên đề Cách mạng 1930 - 1945',
                    questions: 20,
                    time: 50,
                    subject: 'Lịch sử'
                  },
                  {
                    title: 'Đề khảo sát năng lực Toán học 12 - Tích phân & Hình học không gian',
                    questions: 25,
                    time: 60,
                    subject: 'Toán'
                  },
                  {
                    title: 'Đề luyện thi chứng chỉ Tiếng Anh B2 / THPT Quốc Gia - Test 03',
                    questions: 30,
                    time: 60,
                    subject: 'Tiếng Anh'
                  },
                  {
                    title: 'Đề thi chọn Học sinh giỏi Vật lý - Cơ học & Nhiệt động lực học',
                    questions: 15,
                    time: 90,
                    subject: 'Vật lý'
                  }
                ].map((bankItem, bIdx) => (
                  <div
                    key={bIdx}
                    className="sf-teacher-tile p-4 rounded-2xl flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-sky-700 dark:text-cyan-300">
                        {bankItem.subject}
                      </span>
                      <h4 className="font-display text-xs font-bold text-slate-900 dark:text-white group-hover:text-sky-700 dark:group-hover:text-cyan-300 transition line-clamp-1 mt-0.5">
                        {bankItem.title}
                      </h4>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-cyan-200/70 mt-0.5">
                        {bankItem.questions} câu hỏi · {bankItem.time} phút
                      </p>
                    </div>
                    <button
                      type="button"
                      data-sound="success"
                      onClick={() => {
                        onSaveExam({
                          id: Date.now() + bIdx,
                          title: bankItem.title,
                          subject: bankItem.subject,
                          durationMinutes: bankItem.time,
                          submissionsCount: 0,
                          status: 'published',
                          assignedTo: 'Tất cả mọi người',
                          createdAt:
                            new Date().toLocaleDateString('vi-VN') +
                            ' ' +
                            new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                          price: 'Miễn phí',
                          questions: [
                            {
                              id: 1,
                              questionText: `Câu hỏi mẫu trích từ ${bankItem.title}?`,
                              options: ['A. Khẳng định 1', 'B. Khẳng định 2', 'C. Khẳng định 3', 'D. Khẳng định 4'],
                              correctOption: 0,
                              explanation: 'Đáp án chuẩn theo ngân hàng câu hỏi Quốc gia.'
                            }
                          ]
                        });
                        setIsBankModalOpen(false);
                      }}
                      className="sf-neon-cta px-4 py-2 rounded-xl font-display font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Nhập đề này
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
