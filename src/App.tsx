import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { 
  CalendarEvent, 
  TaskItem, 
  LibraryItem, 
  DayFocusSession, 
  ViewTab, 
  UserRole,
  CountdownItem,
  ExamItem,
  ExamFolder,
  ExamSubmission,
  TeacherProfile,
  TeacherClass,
  TeacherTab,
  TeacherStudent,
  Notice,
  StudentProfile,
  ClassJoinRequest,
  FlashcardDeck,
  MoodLogEntry,
  TeacherFeedbackItem
} from './types';
import { 
  INITIAL_EVENTS, 
  INITIAL_TASKS, 
  INITIAL_LIBRARY, 
  INITIAL_TEACHER_MATH_VAULT,
  INITIAL_COUNTDOWNS,
  INITIAL_EXAMS,
  INITIAL_FOLDERS,
  INITIAL_TEACHER_PROFILE,
  INITIAL_TEACHER_CLASSES,
  INITIAL_STUDENT_PROFILE,
  INITIAL_NOTICES,
  INITIAL_DECKS,
  INITIAL_SUBMISSIONS,
  formatDate,
  formatHours
} from './data/initialData';
import { isImageAvatar, saveStudentProfileSafe, saveTeacherProfileSafe } from './utils/avatarUtils';
import {
  loadUiPreferences,
  updateUiPreferences,
  updateTeacherUiPreferences,
  updateStudentUiPreferences
} from './utils/uiPreferences';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import type { TeacherAssignPayload } from './components/TeacherAssignView';
import {
  calcClassAvgScore,
  SemesterKey,
  getStudentScoresBySemester,
  getScoreForCategory,
  calcYearlyAvg
} from './utils/gradebook';
import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import { TactileFeedbackLayer } from './components/TactileFeedbackLayer';
import { useLanguage } from './services/languageService';

const mergePermanentTeacherMathVault = (items?: LibraryItem[] | null): LibraryItem[] => {
  const existing = Array.isArray(items) ? items : [];
  const permanentMap = new Map(INITIAL_TEACHER_MATH_VAULT.map((item) => [item.id, item]));
  const mergedExisting = existing.map((item) => {
    const core = permanentMap.get(item.id);
    if (core) {
      return {
        ...core,
        ...item,
        sub: core.sub,
        isPermanent: true
      };
    }
    return item;
  });
  const existingIds = new Set(mergedExisting.map((item) => item.id));
  const missingCore = INITIAL_TEACHER_MATH_VAULT.filter((core) => !existingIds.has(core.id));
  return [...mergedExisting, ...missingCore];
};

const STUDENT_TAB_ORDER: ViewTab[] = [
  'overview', 'focus', 'tasks', 'exams', 'calendar', 'flashcards',
  'ai_studio', 'stats', 'group_study', 'notices', 'library', 'countdown'
];

const TEACHER_TAB_ORDER: TeacherTab[] = [
  'overview', 'classes', 'timetable', 'notices', 'materials', 'ai_material', 'exams', 'assign'
];

const tabFlipVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    transformPerspective: 1800,
    rotateY: dir >= 0 ? 34 : -34,
    x: dir >= 0 ? 22 : -22,
    scale: 0.975,
  }),
  center: {
    opacity: 1,
    transformPerspective: 1800,
    rotateY: 0,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.38,
      ease: [0.34, 1.56, 0.64, 1] as const,
      opacity: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
    },
    transitionEnd: {
      transform: 'none',
    },
  },
  exit: (dir: number) => ({
    opacity: 0,
    transformPerspective: 1800,
    rotateY: dir >= 0 ? -28 : 28,
    x: dir >= 0 ? -18 : 18,
    scale: 0.98,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1] as const,
    },
  }),
};

const CalendarView = lazy(() => import('./components/CalendarView').then((m) => ({ default: m.CalendarView })));
const TasksView = lazy(() => import('./components/TasksView').then((m) => ({ default: m.TasksView })));
const FocusView = lazy(() => import('./components/FocusView').then((m) => ({ default: m.FocusView })));
const StatsView = lazy(() => import('./components/StatsView').then((m) => ({ default: m.StatsView })));
const LibraryView = lazy(() => import('./components/LibraryView').then((m) => ({ default: m.LibraryView })));
const FlashcardsView = lazy(() => import('./components/FlashcardsView').then((m) => ({ default: m.FlashcardsView })));
const ExamsView = lazy(() => import('./components/ExamsView').then((m) => ({ default: m.ExamsView })));
const CopyrightModal = lazy(() => import('./components/CopyrightModal').then((m) => ({ default: m.CopyrightModal })));
const TeacherSidebar = lazy(() => import('./components/TeacherSidebar').then((m) => ({ default: m.TeacherSidebar })));
const TeacherTopBar = lazy(() => import('./components/TeacherTopBar').then((m) => ({ default: m.TeacherTopBar })));
const TeacherDashboardView = lazy(() => import('./components/TeacherDashboardView').then((m) => ({ default: m.TeacherDashboardView })));
const TeacherAiExamModal = lazy(() => import('./components/TeacherAiExamModal').then((m) => ({ default: m.TeacherAiExamModal })));
const TeacherAiMaterialModal = lazy(() => import('./components/TeacherAiMaterialModal').then((m) => ({ default: m.TeacherAiMaterialModal })));
const TeacherAiAssistantModal = lazy(() => import('./components/TeacherAiAssistantModal').then((m) => ({ default: m.TeacherAiAssistantModal })));
const TeacherClassDetailModal = lazy(() => import('./components/TeacherClassDetailModal').then((m) => ({ default: m.TeacherClassDetailModal })));
const TeacherProfileModal = lazy(() => import('./components/TeacherProfileModal').then((m) => ({ default: m.TeacherProfileModal })));
const TeacherAssignView = lazy(() => import('./components/TeacherAssignView').then((m) => ({ default: m.TeacherAssignView })));
const DocumentViewerModal = lazy(() => import('./components/DocumentViewerModal').then((m) => ({ default: m.DocumentViewerModal })));
const TeacherLoginModal = lazy(() => import('./components/TeacherLoginModal').then((m) => ({ default: m.TeacherLoginModal })));
const NoticeBoardView = lazy(() => import('./components/NoticeBoardView').then((m) => ({ default: m.NoticeBoardView })));
const JoinClassModal = lazy(() => import('./components/JoinClassModal').then((m) => ({ default: m.JoinClassModal })));
const EditStudentModal = lazy(() => import('./components/EditStudentModal').then((m) => ({ default: m.EditStudentModal })));
const StudentProfileModal = lazy(() => import('./components/StudentProfileModal').then((m) => ({ default: m.StudentProfileModal })));
const CreateClassModal = lazy(() => import('./components/CreateClassModal').then((m) => ({ default: m.CreateClassModal })));
const AIHubView = lazy(() => import('./components/AIHubView').then((m) => ({ default: m.AIHubView })));
const ChatGptMiniBubble = lazy(() => import('./components/ChatGptMiniBubble').then((m) => ({ default: m.ChatGptMiniBubble })));
const GroupStudyModal = lazy(() => import('./components/GroupStudyModal').then((m) => ({ default: m.GroupStudyModal })));
const TeacherTimetableView = lazy(() => import('./components/TeacherTimetableView').then((m) => ({ default: m.TeacherTimetableView })));
const TeacherClassesView = lazy(() => import('./components/TeacherClassesView').then((m) => ({ default: m.TeacherClassesView })));
const AiFocusTutorView = lazy(() => import('./components/AiFocusTutorView').then((m) => ({ default: m.AiFocusTutorView })));

const ViewLoader: React.FC = () => (
  <div className="w-full py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
    <div className="w-7 h-7 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
    <span className="text-xs font-semibold">Đang tải...</span>
  </div>
);

function usePersistLocal(key: string, value: unknown) {
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);
}

import { 
  LayoutDashboard, 
  CalendarDays, 
  CheckSquare, 
  BarChart3, 
  Timer, 
  BookOpen,
  Hourglass,
  FileCheck2,
  Users,
  ClipboardList,
  MessageCircle,
  Plus,
  Trash2,
  Globe,
  BellRing,
  Sparkles,
  Send
} from 'lucide-react';

// Ultra-safe LocalStorage reader that handles null, undefined, malformed JSON, and wrong types
function loadLocal<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved || saved === 'null' || saved === 'undefined') return fallback;
    const parsed = JSON.parse(saved);
    if (parsed === null || parsed === undefined) return fallback;
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    if (typeof fallback === 'object' && fallback !== null && typeof parsed !== 'object') return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  // Theme state (persisted in dedicated 'ui_preferences' key)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return loadUiPreferences().theme;
  });

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
      }
      localStorage.setItem('studyflow_theme', theme);
      localStorage.setItem('sf-theme', theme);
      updateUiPreferences((prev) => ({ ...prev, theme }));
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Role state
  const [role, setRole] = useState<UserRole>(() => {
    try {
      return (localStorage.getItem('studyflow_role') as UserRole) || 'student';
    } catch {
      return 'student';
    }
  });

  const [isTeacherLoginModalOpen, setIsTeacherLoginModalOpen] = useState(false);
  const [loginNoticeMessage, setLoginNoticeMessage] = useState<string>('');

  const [switchCount, setSwitchCount] = useState<number>(() => {
    return Number(localStorage.getItem('studyflow_switch_count') || 0);
  });

  const [isTeacherRemembered, setIsTeacherRemembered] = useState<boolean>(() => {
    return localStorage.getItem('studyflow_teacher_remembered') === 'true';
  });

  const appLang = useLanguage();
  const isEn = appLang === 'en';
  const [isAiFocusMode, setIsAiFocusMode] = useState<boolean>(false);

  const toggleAiFocusMode = () => {
    setIsAiFocusMode((prev) => {
      const next = !prev;
      showToast(
        next
          ? isEn
            ? 'AI Focus Mode enabled — T&T AI Tutor only'
            : 'Đã bật Chế độ Tập trung AI — Chỉ hiển thị Gia sư T&T AI'
          : isEn
          ? 'Exited AI Focus Mode'
          : 'Đã thoát Chế độ Tập trung AI'
      );
      return next;
    });
  };

  const toggleRole = () => {
    setIsAiFocusMode(false);
    setIsAiExamModalOpen(false);
    setIsStudentCreateExamPage(false);
    if (role === 'student') {
      if (isTeacherRemembered) {
        if (switchCount >= 8) {
          setLoginNoticeMessage('Bạn đã chuyển đổi nhanh 8 lần liên tiếp. Vui lòng nhập lại mật khẩu để tiếp tục bảo mật.');
          setIsTeacherLoginModalOpen(true);
        } else {
          const nextCount = switchCount + 1;
          setSwitchCount(nextCount);
          try {
            localStorage.setItem('studyflow_switch_count', String(nextCount));
          } catch {}
          setRole('teacher');
          try {
            localStorage.setItem('studyflow_role', 'teacher');
          } catch {}
          showToast(`Đã chuyển sang chế độ Giáo viên (Lần ${nextCount}/8)`);
        }
      } else {
        setLoginNoticeMessage('');
        setIsTeacherLoginModalOpen(true);
      }
    } else {
      setRole('student');
      try {
        localStorage.setItem('studyflow_role', 'student');
      } catch {}
      showToast('Đã chuyển sang chế độ: Học sinh');
    }
  };

  const handleTeacherLoginSuccess = (remember: boolean) => {
    setIsAiExamModalOpen(false);
    setIsStudentCreateExamPage(false);
    setRole('teacher');
    setSwitchCount(1);
    setIsTeacherRemembered(remember);
    try {
      localStorage.setItem('studyflow_role', 'teacher');
      localStorage.setItem('studyflow_teacher_remembered', remember ? 'true' : 'false');
      localStorage.setItem('studyflow_switch_count', '1');
    } catch {}
    showToast(remember ? 'Đã đăng nhập Giáo viên (Bật chuyển đổi nhanh)' : 'Đã đăng nhập Giáo viên');
  };

  const handleLockTeacherMode = () => {
    setIsTeacherRemembered(false);
    setSwitchCount(0);
    try {
      localStorage.setItem('studyflow_teacher_remembered', 'false');
      localStorage.setItem('studyflow_switch_count', '0');
    } catch {}
    setRole('student');
    showToast('Đã khóa chế độ Giáo viên. Lần sau sẽ cần nhập lại mật khẩu.');
  };

  // Teacher State & Classes
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>(() => {
    const loaded = loadLocal('studyflow_teacher_profile', INITIAL_TEACHER_PROFILE);
    if (!loaded.avatar || loaded.avatar === '/assets/teacher_avatar_tuan.jpg') {
      return {
        ...loaded,
        avatar: INITIAL_TEACHER_PROFILE.avatar,
        avatarUpdatedAt: INITIAL_TEACHER_PROFILE.avatarUpdatedAt
      };
    }
    return loaded;
  });

  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>(() => {
    const saved = loadLocal<TeacherClass[]>('studyflow_teacher_classes', INITIAL_TEACHER_CLASSES);
    const hasScores = saved.some((c) => c.students?.some((s) => Boolean(s.scores)));
    if (!hasScores) {
      // Preserve any custom class names if previously renamed, while upgrading to full rosters
      return INITIAL_TEACHER_CLASSES.map((initCls) => {
        const prev = saved.find((p) => p.id === initCls.id);
        return prev ? { ...initCls, name: prev.name } : initCls;
      });
    }
    return saved;
  });

  useEffect(() => {
    try {
      localStorage.setItem('studyflow_teacher_classes', JSON.stringify(teacherClasses));
    } catch {
      // ignore
    }
  }, [teacherClasses]);

  const [teacherTab, setTeacherTabState] = useState<TeacherTab>(() => {
    const saved = loadUiPreferences().teacher.activeTab;
    return saved === 'ai_assistant' || saved === 'settings' ? 'overview' : saved;
  });
  const [teacherFlipDir, setTeacherFlipDir] = useState<1 | -1>(1);

  const setTeacherTab = (tab: TeacherTab) => {
    const prevIdx = TEACHER_TAB_ORDER.indexOf(teacherTab);
    const nextIdx = TEACHER_TAB_ORDER.indexOf(tab);
    if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
      setTeacherFlipDir(nextIdx > prevIdx ? 1 : -1);
    } else {
      setTeacherFlipDir(1);
    }
    setTeacherTabState(tab);
    updateTeacherUiPreferences({ activeTab: tab });
  };

  const [teacherSidebarCollapsed, setTeacherSidebarCollapsed] = useState<boolean>(() => {
    return loadUiPreferences().teacher.sidebarCollapsed;
  });

  const toggleTeacherSidebar = () => {
    const next = !teacherSidebarCollapsed;
    setTeacherSidebarCollapsed(next);
    updateTeacherUiPreferences({ sidebarCollapsed: next });
  };

  const [studentSidebarCollapsed, setStudentSidebarCollapsed] = useState<boolean>(() => {
    return loadUiPreferences().student.sidebarCollapsed;
  });

  const toggleStudentSidebar = () => {
    const next = !studentSidebarCollapsed;
    setStudentSidebarCollapsed(next);
    updateStudentUiPreferences({ sidebarCollapsed: next });
  };

  // Teacher Modals state
  const [isAiExamModalOpen, setIsAiExamModalOpen] = useState(false);
  const [isStudentCreateExamPage, setIsStudentCreateExamPage] = useState(false);
  const [isAiMaterialModalOpen, setIsAiMaterialModalOpen] = useState(false);
  const [isAiAssistantModalOpen, setIsAiAssistantModalOpen] = useState(false);
  const [isTeacherProfileModalOpen, setIsTeacherProfileModalOpen] = useState(false);
  const [assignDefaultClassId, setAssignDefaultClassId] = useState<string>('all');
  const [previewNoticeDoc, setPreviewNoticeDoc] = useState<LibraryItem | null>(null);
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false);
  const [selectedTeacherClassId, setSelectedTeacherClassId] = useState<string | null>(null);
  const [pendingTeacherExamAnalytics, setPendingTeacherExamAnalytics] = useState(false);
  const selectedTeacherClass = teacherClasses.find((c) => c.id === selectedTeacherClassId) || null;

  const syncTeacherStateToServer = async (patch: Record<string, any>): Promise<boolean> => {
    try {
      const res = await fetch('/api/teacher/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleCreateClass = (newClass: TeacherClass) => {
    const next = [...teacherClasses, newClass];
    setTeacherClasses(next);
    syncTeacherStateToServer({ teacherClasses: next });
    showToast(`Đã tạo lớp học mới "${newClass.name}" thành công!`);
  };

  const handleDeleteClass = (classId: string) => {
    const cls = teacherClasses.find((c) => c.id === classId);
    const next = teacherClasses.filter((c) => c.id !== classId);
    setTeacherClasses(next);
    syncTeacherStateToServer({ teacherClasses: next });
    if (selectedTeacherClassId === classId) {
      setSelectedTeacherClassId(null);
    }
    showToast(`Đã giải tán lớp "${cls?.name || ''}" thành công!`);
  };

  const handleRenameClass = (classId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const next = teacherClasses.map((c) => (c.id === classId ? { ...c, name: trimmed } : c));
    setTeacherClasses(next);
    syncTeacherStateToServer({ teacherClasses: next });
    showToast(`Đã đổi tên lớp thành "${trimmed}" và lưu cố định!`);
  };

  const handleDeleteFolder = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    const next = folders.filter((f) => f.id !== folderId);
    setFolders(next);
    void syncTeacherStateToServer({ folders: next });
    showToast(`Đã xóa thư mục "${folder?.name || ''}"!`);
  };

  // Class Join Requests - empty by default, only shown when a real request exists
  const [joinRequests, setJoinRequests] = useState<ClassJoinRequest[]>(() => {
    const saved = loadLocal<ClassJoinRequest[]>('studyflow_join_requests', []);
    return saved.filter((r) => !(r.id === 'req_1' && r.studentName === 'Trần Hoàng Nam'));
  });

  useEffect(() => {
    try {
      localStorage.setItem('studyflow_join_requests', JSON.stringify(joinRequests));
    } catch {
      // ignore
    }
  }, [joinRequests]);

  const handleSendJoinRequest = (classId: string, className: string) => {
    const newReq: ClassJoinRequest = {
      id: `req_${Date.now()}`,
      classId,
      className,
      studentName: studentProfile?.name || 'Trần Văn Tiến',
      studentClass: studentProfile?.className || '12A1',
      status: 'pending',
      requestedAt: new Date().toISOString()
    };
    setJoinRequests((prev) => [newReq, ...prev]);
    try {
      fetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReq)
      }).catch(() => {});
    } catch {
      // ignore
    }
    showToast(`Đã gửi yêu cầu tham gia lớp "${className}"! Vui lòng chờ Giáo viên duyệt.`);
  };

  const handleApproveJoinRequest = (requestId: string) => {
    const req = joinRequests.find((r) => r.id === requestId);
    if (!req) return;

    const nextClasses = teacherClasses.map((c) => {
      if (c.id === req.classId || c.name === req.className) {
        const newStudent: TeacherStudent = {
          id: `s_${Date.now()}`,
          name: req.studentName,
          rollNumber: `${req.studentClass}-${c.students.length + 1}`,
          avgScore: 8.0,
          completedTasks: 0,
          totalTasks: 5,
          status: 'good'
        };
        const updated = [...c.students, newStudent];
        return {
          ...c,
          studentsCount: updated.length,
          students: updated
        };
      }
      return c;
    });

    const nextReqs = joinRequests.map((r) => (r.id === requestId ? { ...r, status: 'approved' as const } : r));

    setTeacherClasses(nextClasses);
    setJoinRequests(nextReqs);
    syncTeacherStateToServer({
      teacherClasses: nextClasses,
      joinRequests: nextReqs
    });

    showToast(`Đã duyệt học sinh ${req.studentName} vào lớp ${req.className}!`);
  };

  const handleRejectJoinRequest = (requestId: string) => {
    const nextReqs = joinRequests.map((r) => (r.id === requestId ? { ...r, status: 'rejected' as const } : r));
    setJoinRequests(nextReqs);
    syncTeacherStateToServer({ joinRequests: nextReqs });
    showToast('Đã từ chối yêu cầu tham gia lớp.');
  };

  const handleSaveTeacherProfile = (newProfile: TeacherProfile) => {
    const withTimestamp = { ...newProfile, avatarUpdatedAt: Date.now() };
    setTeacherProfile(withTimestamp);
    saveTeacherProfileSafe(withTimestamp);
    showToast('Đã lưu thông tin & avatar Giáo viên cố định!');
  };

  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<TeacherStudent | null>(null);
  const [editStudentSemester, setEditStudentSemester] = useState<SemesterKey>('hk1');

  const [teacherFeedbacks, setTeacherFeedbacks] = useState<TeacherFeedbackItem[]>(() => {
    return loadLocal<TeacherFeedbackItem[]>('studyflow_teacher_feedbacks', []);
  });

  useEffect(() => {
    try {
      localStorage.setItem('studyflow_teacher_feedbacks', JSON.stringify(teacherFeedbacks));
    } catch {
      // ignore
    }
  }, [teacherFeedbacks]);

  const handleUpdateStudent = (updatedStudent: TeacherStudent, editedSemester: SemesterKey = 'hk1') => {
    const targetClass = teacherClasses.find((c) => c.students.some((s) => s.id === updatedStudent.id));
    const next = teacherClasses.map((c) => {
      if (!c.students.some((s) => s.id === updatedStudent.id)) return c;
      const updatedStudents = c.students.map((s) =>
        s.id === updatedStudent.id ? updatedStudent : s
      );
      return {
        ...c,
        students: updatedStudents,
        avgScore: calcClassAvgScore(updatedStudents)
      };
    });
    setTeacherClasses(next);

    // Build private teacher feedback delivered exclusively to this student in TasksView (never posted to public noticeboard)
    const semLabel = editedSemester === 'hk2' ? 'Học kỳ II' : 'Học kỳ I';
    const sc = getStudentScoresBySemester(updatedStudent, editedSemester);
    const scoreParts: string[] = [];
    if (sc?.tx1 !== null && sc?.tx1 !== undefined) scoreParts.push(`TX1: ${sc.tx1}`);
    if (sc?.tx2 !== null && sc?.tx2 !== undefined) scoreParts.push(`TX2: ${sc.tx2}`);
    if (sc?.tx3 !== null && sc?.tx3 !== undefined) scoreParts.push(`TX3: ${sc.tx3}`);
    if (sc?.tx4 !== null && sc?.tx4 !== undefined) scoreParts.push(`Miệng: ${sc.tx4}`);
    if (sc?.gk !== null && sc?.gk !== undefined) scoreParts.push(`Giữa kỳ: ${sc.gk}`);
    if (sc?.ck !== null && sc?.ck !== undefined) scoreParts.push(`Cuối kỳ: ${sc.ck}`);

    const avgVal = getScoreForCategory(updatedStudent, 'all', editedSemester);
    const yearly =
      editedSemester === 'hk2'
        ? calcYearlyAvg(getScoreForCategory(updatedStudent, 'all', 'hk1'), avgVal)
        : null;

    const subjectLabel = teacherProfile.subject || 'Toán';
    const feedbackId = `fb_${updatedStudent.id}_${editedSemester}`;
    const newFeedback: TeacherFeedbackItem = {
      id: feedbackId,
      studentId: updatedStudent.id,
      studentName: updatedStudent.name,
      rollNumber: updatedStudent.rollNumber,
      className: targetClass?.name,
      subject: subjectLabel,
      semester: editedSemester,
      teacherName: teacherProfile.name,
      scoresSummary: scoreParts.length > 0 ? scoreParts.join(' • ') : undefined,
      avgScore: avgVal,
      yearlyAvg: yearly,
      comment: sc?.comment?.trim() || `Đã cập nhật điểm ${semLabel}${avgVal !== null ? ` (ĐTB: ${avgVal}/10)` : ''}.`,
      updatedAt: new Date().toISOString(),
      read: false
    };

    const nextFeedbacks = [
      newFeedback,
      ...teacherFeedbacks.filter((f) => f.id !== feedbackId)
    ];
    setTeacherFeedbacks(nextFeedbacks);

    // Sync matching student's subject average without touching avatar
    if (
      avgVal !== null &&
      updatedStudent.name.trim().toLowerCase() === (studentProfile.name || '').trim().toLowerCase() &&
      Array.isArray(studentProfile.subjects)
    ) {
      const updatedSubjects = studentProfile.subjects.map((sub) =>
        sub.name.toLowerCase().includes(subjectLabel.toLowerCase()) ||
        subjectLabel.toLowerCase().includes(sub.name.toLowerCase())
          ? { ...sub, score: avgVal }
          : sub
      );
      const nextProfile: StudentProfile = {
        ...studentProfile,
        subjects: updatedSubjects
      };
      setStudentProfile(nextProfile);
      saveStudentProfileSafe(nextProfile);
    }

    syncTeacherStateToServer({ teacherClasses: next, teacherFeedbacks: nextFeedbacks });
    showToast('Đã lưu bảng điểm & gửi nhận xét riêng cho học sinh (xem tại trang Tasks)!');
  };

  const handleDeleteStudent = (classId: string, studentId: string) => {
    let deletedName = '';
    const next = teacherClasses.map((c) => {
      if (c.id !== classId) return c;
      const target = c.students.find((s) => s.id === studentId);
      if (target) deletedName = target.name;
      const updatedStudents = c.students.filter((s) => s.id !== studentId);
      return {
        ...c,
        students: updatedStudents,
        studentsCount: updatedStudents.length,
        avgScore: calcClassAvgScore(updatedStudents)
      };
    });
    setTeacherClasses(next);
    syncTeacherStateToServer({ teacherClasses: next });
    showToast(`Đã xóa học sinh "${deletedName || ''}" khỏi lớp!`);
  };

  const handleAddStudentToClass = (classId: string, student: Omit<TeacherStudent, 'id'>) => {
    const next = teacherClasses.map((c) => {
      if (c.id === classId) {
        const newSt: TeacherStudent = { ...student, id: `s_${Date.now()}` };
        const updated = [...c.students, newSt];
        return {
          ...c,
          studentsCount: updated.length,
          students: updated,
          avgScore: calcClassAvgScore(updated)
        };
      }
      return c;
    });
    setTeacherClasses(next);
    syncTeacherStateToServer({ teacherClasses: next });
    showToast('Đã thêm học sinh vào lớp!');
  };

  const handleTeacherAssignTask = (payload: TeacherAssignPayload) => {
    const { task, targetClassId, sendNotification, pinNotification, saveToLibrary, newExamToSave } = payload;
    const targetClass = teacherClasses.find((c) => c.id === targetClassId);
    const targetClassName = targetClass ? targetClass.name : `Tất cả ${teacherClasses.length} lớp`;
    const nowIso = new Date().toISOString();
    const taskId = Date.now();
    const assignedTitle = targetClass ? `[${targetClass.name}] ${task.t}` : task.t;

    const newTask: TaskItem = {
      ...task,
      t: assignedTitle,
      id: taskId,
      status: task.status || (task.done ? 'done' : 'todo'),
      priority: task.priority || (task.hi ? 'high' : 'medium'),
      done: !!task.done,
      assignedBy: task.assignedBy || teacherProfile.name,
      targetClassId,
      targetClassName: task.targetClassName || targetClassName,
      createdAt: task.createdAt || nowIso
    };

    const nextTasks = [newTask, ...tasks];
    setTasks(nextTasks);

    const patch: Record<string, any> = { tasks: nextTasks };

    if (newExamToSave) {
      const nextExams = [newExamToSave, ...exams];
      setExams(nextExams);
      patch.exams = nextExams;
    }

    if (saveToLibrary && newTask.attachmentName) {
      const mappedType: LibraryItem['fileType'] =
        newTask.attachmentType === 'pdf'
          ? 'pdf'
          : newTask.attachmentType === 'image'
            ? 'image'
            : newTask.attachmentType === 'text'
              ? 'text'
              : 'link';
      const newLibItem: LibraryItem = {
        id: taskId + 1,
        t: task.t,
        sub: newTask.sub || 'Tài liệu',
        type: 'Đề & Bài tập giáo viên giao',
        d: newTask.note || `Tài liệu bài tập giao cho ${targetClassName}`,
        url: newTask.attachmentUrl,
        fileName: newTask.attachmentName,
        fileType: mappedType,
        fileContent: newTask.attachmentContent,
        fav: false
      };
      const nextLibrary = [newLibItem, ...library];
      setLibrary(nextLibrary);
      patch.library = nextLibrary;
    }

    if (sendNotification) {
      const detailLines = [
        `Giáo viên ${teacherProfile.name} vừa giao bài tập mới cho ${targetClassName}.`,
        `Môn học: ${newTask.sub || 'Chung'} · Trọng số: ${newTask.weight || 'Hệ số 1'}`,
        `Hạn chót nộp bài: ${newTask.due || 'Chưa đặt'}${newTask.dueTime ? ` lúc ${newTask.dueTime}` : ''}`
      ];
      if (newTask.note) detailLines.push(`Hướng dẫn: ${newTask.note}`);
      if (newTask.attachmentName) detailLines.push(`Tệp đề đính kèm: ${newTask.attachmentName}`);
      if (newTask.linkedExamId) {
        detailLines.push('Có đề trắc nghiệm trực tuyến đi kèm — nhấn "Làm bài trắc nghiệm" để thực hiện ngay.');
      }

      const assignmentNotice: Notice = {
        id: taskId + 2,
        title: `[Bài tập mới · ${newTask.sub || 'Chung'}] ${task.t}`,
        content: detailLines.join('\n'),
        pinned: pinNotification,
        createdAt: nowIso,
        reactions: {},
        type: 'assignment',
        assignmentTaskId: taskId,
        attachmentName: newTask.attachmentName,
        attachmentUrl: newTask.attachmentUrl,
        attachmentType: newTask.attachmentType,
        attachmentContent: newTask.attachmentContent,
        linkedExamId: newTask.linkedExamId,
        targetClassName,
        subject: newTask.sub,
        dueDate: newTask.due,
        dueTime: newTask.dueTime,
        teacherName: teacherProfile.name
      };
      const nextNotices = [assignmentNotice, ...notices];
      setNotices(nextNotices);
      patch.notices = nextNotices;
    }

    syncTeacherStateToServer(patch);
    showToast(
      sendNotification
        ? `Đã giao nhiệm vụ & gửi thông báo tới ${targetClassName}!`
        : `Đã giao nhiệm vụ cho ${targetClassName}!`
    );
  };

  const handleResendAssignmentNotice = (task: TaskItem) => {
    const nowIso = new Date().toISOString();
    const targetClassLabel = task.targetClassName || 'các lớp';
    const reminderNotice: Notice = {
      id: Date.now(),
      title: `[Nhắc hạn bài tập · ${task.sub || 'Chung'}] ${task.t}`,
      content: `Giáo viên ${teacherProfile.name} nhắc nhở ${targetClassLabel} hoàn thành bài tập đúng hạn.\nHạn chót: ${task.due || 'Chưa đặt'}${task.dueTime ? ` lúc ${task.dueTime}` : ''}.${task.note ? `\nGhi chú: ${task.note}` : ''}`,
      pinned: false,
      createdAt: nowIso,
      reactions: {},
      type: 'assignment',
      assignmentTaskId: task.id,
      attachmentName: task.attachmentName,
      attachmentUrl: task.attachmentUrl,
      attachmentType: task.attachmentType,
      attachmentContent: task.attachmentContent,
      linkedExamId: task.linkedExamId,
      targetClassName: targetClassLabel,
      subject: task.sub,
      dueDate: task.due,
      dueTime: task.dueTime,
      teacherName: teacherProfile.name
    };
    const nextNotices = [reminderNotice, ...notices];
    setNotices(nextNotices);
    syncTeacherStateToServer({ notices: nextNotices });
    showToast(`Đã gửi thông báo nhắc nhở tới học sinh (${targetClassLabel})!`);
  };

  // Tab State & Hash sync (persisted in ui_preferences.student.activeTab)
  const [currentTab, setCurrentTabState] = useState<ViewTab>(() => {
    const hash = window.location.hash.replace('#', '') as ViewTab;
    if (hash === 'countdown') return 'calendar';
    const validTabs: ViewTab[] = ['overview', 'exams', 'calendar', 'tasks', 'stats', 'focus', 'library', 'notices', 'flashcards', 'ai_studio', 'group_study'];
    if (validTabs.includes(hash)) return hash;
    return loadUiPreferences().student.activeTab;
  });
  const [studentFlipDir, setStudentFlipDir] = useState<1 | -1>(1);

  const setCurrentTab = (tab: ViewTab) => {
    const prevIdx = STUDENT_TAB_ORDER.indexOf(currentTab);
    const nextIdx = STUDENT_TAB_ORDER.indexOf(tab);
    if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
      setStudentFlipDir(nextIdx > prevIdx ? 1 : -1);
    } else {
      setStudentFlipDir(1);
    }
    setCurrentTabState(tab);
    updateStudentUiPreferences({ activeTab: tab });
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as ViewTab;
      if (hash === 'countdown') {
        setCurrentTab('calendar');
        setTimeout(() => {
          document.getElementById('countdown-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        return;
      }
      const validTabs: ViewTab[] = ['overview', 'exams', 'calendar', 'tasks', 'stats', 'focus', 'library', 'notices', 'flashcards', 'ai_studio', 'group_study'];
      if (validTabs.includes(hash)) {
        setCurrentTab(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const resetScrollOnTabChange = () => {
    if (typeof window === 'undefined') return;
    if (window.scrollY > 240) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectTab = (tab: ViewTab) => {
    setIsStudentCreateExamPage(false);
    if (tab === 'countdown') {
      setCurrentTab('calendar');
      window.location.hash = '#calendar';
      setTimeout(() => {
        document.getElementById('countdown-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 180);
      return;
    }
    resetScrollOnTabChange();
    setCurrentTab(tab);
    window.location.hash = `#${tab}`;
  };

  // Exams State
  const [exams, setExams] = useState<ExamItem[]>(() => {
    return loadLocal('studyflow_exams', INITIAL_EXAMS);
  });

  useEffect(() => {
    try {
      localStorage.setItem('studyflow_exams', JSON.stringify(exams));
    } catch {
      // ignore
    }
  }, [exams]);

  // Folders State
  const [folders, setFolders] = useState<ExamFolder[]>(() => {
    return loadLocal('studyflow_folders_v2', []);
  });

  useEffect(() => {
    try {
      localStorage.setItem('studyflow_folders_v2', JSON.stringify(folders));
    } catch {
      // ignore
    }
  }, [folders]);

  // Submissions State
  const [submissions, setSubmissions] = useState<ExamSubmission[]>(() => {
    const local = loadLocal<ExamSubmission[]>('studyflow_submissions', INITIAL_SUBMISSIONS);
    return Array.isArray(local) && local.length > 0 ? local : INITIAL_SUBMISSIONS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('studyflow_submissions', JSON.stringify(submissions));
    } catch {
      // ignore
    }
  }, [submissions]);

  // Student Profile State
  const [studentProfile, setStudentProfile] = useState<StudentProfile>(() => {
    const loaded = loadLocal('studyflow_student_profile', INITIAL_STUDENT_PROFILE);
    if (!loaded.avatar || loaded.avatar === 'TV') {
      return {
        ...loaded,
        avatar: INITIAL_STUDENT_PROFILE.avatar,
        avatarUpdatedAt: INITIAL_STUDENT_PROFILE.avatarUpdatedAt
      };
    }
    return loaded;
  });

  const [isStudentProfileModalOpen, setIsStudentProfileModalOpen] = useState(false);
  const [pendingExamToOpenId, setPendingExamToOpenId] = useState<number | null>(null);


  // Hydrate persisted profiles & teacher state from server without ever overwriting server defaults on mount
  useEffect(() => {
    fetch('/api/app-state')
      .then((r) => r.json())
      .then((data) => {
        if (!data || typeof data !== 'object') return;
        if (data.student && data.student.name) {
          const localStudent = loadLocal<StudentProfile | null>('studyflow_student_profile', null);
          const localIsLegacy = !localStudent?.avatar || localStudent.avatar === 'TV';
          const serverIsLegacy = !data.student.avatar || data.student.avatar === 'TV';
          const localHasCustomAvatar = Boolean(
            localStudent &&
            !localIsLegacy &&
            isImageAvatar(localStudent.avatar) &&
            localStudent.avatar !== INITIAL_STUDENT_PROFILE.avatar
          );
          const serverHasCustomAvatar = Boolean(!serverIsLegacy && isImageAvatar(data.student.avatar));
          const localIsStrictlyNewer =
            (localStudent?.avatarUpdatedAt || 0) > (data.student.avatarUpdatedAt || 0);

          if (localStudent && localHasCustomAvatar && (!serverHasCustomAvatar || localIsStrictlyNewer)) {
            const preserved = {
              ...data.student,
              ...localStudent,
              avatar: localStudent.avatar,
              avatarUpdatedAt: localStudent.avatarUpdatedAt || Date.now()
            };
            setStudentProfile(preserved);
            saveStudentProfileSafe(preserved);
          } else if (serverIsLegacy) {
            const upgraded = {
              ...data.student,
              avatar: INITIAL_STUDENT_PROFILE.avatar,
              avatarUpdatedAt: INITIAL_STUDENT_PROFILE.avatarUpdatedAt
            };
            setStudentProfile(upgraded);
            saveStudentProfileSafe(upgraded);
          } else {
            setStudentProfile(data.student);
            try {
              localStorage.setItem('studyflow_student_profile', JSON.stringify(data.student));
              localStorage.setItem('studyflow_student_info', JSON.stringify({
                name: data.student.name,
                className: data.student.className,
                school: data.student.schoolName
              }));
            } catch {}
          }
        }
        if (data.teacher && data.teacher.name) {
          const localTeacher = loadLocal<TeacherProfile | null>('studyflow_teacher_profile', null);
          const localIsLegacy = !localTeacher?.avatar || localTeacher.avatar === '/assets/teacher_avatar_tuan.jpg';
          const serverIsLegacy = !data.teacher.avatar || data.teacher.avatar === '/assets/teacher_avatar_tuan.jpg';
          const localHasCustomAvatar = Boolean(
            localTeacher?.avatar &&
            !localIsLegacy &&
            isImageAvatar(localTeacher.avatar) &&
            localTeacher.avatar !== INITIAL_TEACHER_PROFILE.avatar
          );
          const localIsNewer =
            (localTeacher?.avatarUpdatedAt || 0) > (data.teacher.avatarUpdatedAt || 0);

          if (localTeacher && localHasCustomAvatar && localIsNewer) {
            const preserved = {
              ...data.teacher,
              ...localTeacher,
              avatar: localTeacher.avatar,
              avatarUpdatedAt: localTeacher.avatarUpdatedAt || Date.now()
            };
            setTeacherProfile(preserved);
            saveTeacherProfileSafe(preserved);
          } else if (serverIsLegacy) {
            const upgraded = {
              ...data.teacher,
              avatar: INITIAL_TEACHER_PROFILE.avatar,
              avatarUpdatedAt: INITIAL_TEACHER_PROFILE.avatarUpdatedAt
            };
            setTeacherProfile(upgraded);
            saveTeacherProfileSafe(upgraded);
          } else {
            setTeacherProfile(data.teacher);
            try {
              localStorage.setItem('studyflow_teacher_profile', JSON.stringify(data.teacher));
            } catch {}
          }
        }
        if (Array.isArray(data.teacherClasses)) {
          const hasScores = data.teacherClasses.some((c: TeacherClass) =>
            c.students?.some((s) => Boolean(s.scores))
          );
          const resolvedClasses = hasScores
            ? data.teacherClasses
            : INITIAL_TEACHER_CLASSES.map((initCls) => {
                const prev = data.teacherClasses.find((p: TeacherClass) => p.id === initCls.id);
                return prev ? { ...initCls, name: prev.name } : initCls;
              });
          setTeacherClasses(resolvedClasses);
          try {
            localStorage.setItem('studyflow_teacher_classes', JSON.stringify(resolvedClasses));
          } catch {}
        }
        if (Array.isArray(data.joinRequests)) {
          const cleanReqs = data.joinRequests.filter(
            (r: ClassJoinRequest) => !(r.id === 'req_1' && r.studentName === 'Trần Hoàng Nam')
          );
          setJoinRequests(cleanReqs);
          try {
            localStorage.setItem('studyflow_join_requests', JSON.stringify(cleanReqs));
          } catch {}
        }
        if (Array.isArray(data.exams)) {
          setExams(data.exams);
          try {
            localStorage.setItem('studyflow_exams', JSON.stringify(data.exams));
          } catch {}
        } else {
          // Server has no persisted exams yet: lock in whatever exams are currently loaded in the browser
          const currentLocalExams = loadLocal<ExamItem[]>('studyflow_exams', INITIAL_EXAMS);
          if (Array.isArray(currentLocalExams)) {
            void syncTeacherStateToServer({ exams: currentLocalExams });
          }
        }
        if (Array.isArray(data.folders)) {
          setFolders(data.folders);
          try {
            localStorage.setItem('studyflow_folders_v2', JSON.stringify(data.folders));
          } catch {}
        } else {
          const currentLocalFolders = loadLocal<ExamFolder[]>('studyflow_folders_v2', []);
          if (Array.isArray(currentLocalFolders) && currentLocalFolders.length > 0) {
            void syncTeacherStateToServer({ folders: currentLocalFolders });
          }
        }
        if (Array.isArray(data.library)) {
          setLibrary(data.library);
          try {
            localStorage.setItem('studyflow_library', JSON.stringify(data.library));
          } catch {}
        }
        if (Array.isArray(data.teacherPrivateLibrary)) {
          const mergedVault = mergePermanentTeacherMathVault(data.teacherPrivateLibrary);
          setTeacherPrivateLibrary(mergedVault);
          try {
            localStorage.setItem('studyflow_teacher_private_library', JSON.stringify(mergedVault));
          } catch {}
        } else {
          const currentLocalVault = mergePermanentTeacherMathVault(
            loadLocal<LibraryItem[]>('studyflow_teacher_private_library', INITIAL_TEACHER_MATH_VAULT)
          );
          setTeacherPrivateLibrary(currentLocalVault);
          void syncTeacherStateToServer({ teacherPrivateLibrary: currentLocalVault });
        }
        if (Array.isArray(data.notices)) {
          const cleanNotices = data.notices.filter(
            (n: Notice) => !(n?.title || '').startsWith('[Điểm & Nhận xét')
          );
          setNotices(cleanNotices);
          try {
            localStorage.setItem('studyflow_notices', JSON.stringify(cleanNotices));
          } catch {}
        }
        if (Array.isArray(data.tasks)) {
          setTasks(data.tasks);
          try {
            localStorage.setItem('studyflow_tasks', JSON.stringify(data.tasks));
          } catch {}
        }
        if (Array.isArray(data.submissions) && data.submissions.length > 0) {
          setSubmissions((prev) => {
            const existingIds = new Set(data.submissions.map((s: ExamSubmission) => s.id));
            const merged = [
              ...data.submissions,
              ...prev.filter((s) => !existingIds.has(s.id) && s.id < 900000)
            ];
            const finalSubs = merged.length > 0 ? merged : INITIAL_SUBMISSIONS;
            try {
              localStorage.setItem('studyflow_submissions', JSON.stringify(finalSubs));
            } catch {}
            return finalSubs;
          });
        }
        if (Array.isArray(data.teacherFeedbacks)) {
          setTeacherFeedbacks(data.teacherFeedbacks);
          try {
            localStorage.setItem('studyflow_teacher_feedbacks', JSON.stringify(data.teacherFeedbacks));
          } catch {}
        }
        if (Array.isArray(data.teacherTimetable) && data.teacherTimetable.length > 0) {
          try {
            localStorage.setItem('studyflow_teacher_timetable', JSON.stringify(data.teacherTimetable));
          } catch {}
        }
        if (data.timetableSync && typeof data.timetableSync === 'object') {
          try {
            localStorage.setItem('studyflow_teacher_timetable_meta', JSON.stringify(data.timetableSync));
          } catch {}
        }
      })
      .catch(() => {});

    const handleProfileSync = (e: any) => {
      const detail = e.detail;
      if (detail?.type === 'student' && detail.profile) {
        setStudentProfile(detail.profile);
      } else if (detail?.type === 'teacher' && detail.profile) {
        setTeacherProfile(detail.profile);
      }
    };
    window.addEventListener('studyflow_profile_updated', handleProfileSync);
    return () => window.removeEventListener('studyflow_profile_updated', handleProfileSync);
  }, []);

  const handleSaveStudentProfile = (newProfile: StudentProfile) => {
    const withTimestamp = { ...newProfile, avatarUpdatedAt: Date.now() };
    setStudentProfile(withTimestamp);
    saveStudentProfileSafe(withTimestamp);
    showToast('Đã lưu thông tin & avatar Học sinh cố định!');
  };

  // Notices State (exclude any legacy private grade notices)
  const [notices, setNotices] = useState<Notice[]>(() => {
    return loadLocal('studyflow_notices', INITIAL_NOTICES).filter(
      (n) => !(n?.title || '').startsWith('[Điểm & Nhận xét')
    );
  });

  const [readNoticeIds, setReadNoticeIds] = useState<number[]>(() => {
    return loadLocal('studyflow_read_notices', []);
  });

  useEffect(() => {
    try {
      localStorage.setItem('studyflow_notices', JSON.stringify(notices));
    } catch {
      // ignore
    }
  }, [notices]);

  const handleMarkNoticesRead = () => {
    const allIds = notices.map((n) => n.id);
    setReadNoticeIds(allIds);
    try {
      localStorage.setItem('studyflow_read_notices', JSON.stringify(allIds));
    } catch {
      // ignore
    }
  };

  const unreadNoticeCount = notices.filter((n) => !readNoticeIds.includes(n.id)).length;

  const handlePreviewNoticeAttachment = (notice: Notice) => {
    if (!notice.attachmentName && !notice.attachmentUrl && !notice.attachmentContent) return;
    const mappedType: LibraryItem['fileType'] =
      notice.attachmentType === 'pdf'
        ? 'pdf'
        : notice.attachmentType === 'image'
          ? 'image'
          : notice.attachmentType === 'text'
            ? 'text'
            : 'link';
    setPreviewNoticeDoc({
      id: notice.id,
      t: notice.title,
      sub: notice.subject || 'Bài tập',
      type: notice.teacherName ? `Giao bởi ${notice.teacherName}` : 'Tệp đính kèm thông báo',
      d: notice.content,
      url: notice.attachmentUrl,
      fileName: notice.attachmentName,
      fileType: mappedType,
      fileContent: notice.attachmentContent,
      fav: false
    });
  };

  const handleOpenAssignmentNotice = (notice: Notice) => {
    if (!readNoticeIds.includes(notice.id)) {
      const nextRead = [...readNoticeIds, notice.id];
      setReadNoticeIds(nextRead);
      try {
        localStorage.setItem('studyflow_read_notices', JSON.stringify(nextRead));
      } catch {
        // ignore
      }
    }
    if (notice.linkedExamId) {
      setPendingExamToOpenId(notice.linkedExamId);
      handleSelectTab('exams');
    } else {
      handleSelectTab('tasks');
    }
  };

  const handleSaveExam = (exam: ExamItem, options?: { notifyStudents?: boolean }) => {
    const exists = exams.some((e) => e.id === exam.id);
    const next = exists ? exams.map((e) => (e.id === exam.id ? exam : e)) : [exam, ...exams];
    setExams(next);

    const shouldNotify = !exists && exam.status === 'published' && options?.notifyStudents !== false;
    let nextNotices = notices;
    if (shouldNotify) {
      const targetClassLabel = exam.assignedTo || 'Tất cả mọi người';
      const examNotice: Notice = {
        id: Date.now() + 3,
        title: `[Đề thi mới · ${exam.subject}] ${exam.title}`,
        content: [
          `Giáo viên ${teacherProfile.name} vừa xuất bản đề thi mới cho ${targetClassLabel}.`,
          `Số lượng: ${exam.questions.length} câu trắc nghiệm · Thời gian làm bài: ${exam.durationMinutes} phút.`,
          exam.fileName ? `Nguồn đề đính kèm: ${exam.fileName}` : 'Nhấn "Làm bài ngay" để vào thi và xem kết quả phân tích tự động.'
        ].join('\n'),
        pinned: false,
        createdAt: new Date().toISOString(),
        reactions: {},
        type: 'assignment',
        linkedExamId: exam.id,
        targetClassName: targetClassLabel,
        subject: exam.subject,
        teacherName: teacherProfile.name,
        attachmentName: exam.fileName
      };
      nextNotices = [examNotice, ...notices];
      setNotices(nextNotices);
    }

    let nextClasses = teacherClasses;
    let classesChanged = false;
    if (!exists && exam.status === 'published') {
      const target = (exam.assignedTo || '').trim();
      nextClasses = teacherClasses.map((cls) => {
        if (target === 'Tất cả mọi người' || cls.name === target) {
          classesChanged = true;
          return { ...cls, examsCount: (cls.examsCount || 0) + 1 };
        }
        return cls;
      });
      if (classesChanged) {
        setTeacherClasses(nextClasses);
      }
    }

    const patch: Record<string, any> = { exams: next };
    if (shouldNotify) patch.notices = nextNotices;
    if (classesChanged) patch.teacherClasses = nextClasses;
    void syncTeacherStateToServer(patch);
    showToast(
      shouldNotify
        ? 'Đã xuất bản đề thi & gửi thông báo tới học sinh!'
        : 'Đã lưu cố định đề thi thành công!'
    );
  };

  const handleDeleteExam = (id: number) => {
    const next = exams.filter((e) => e.id !== id);
    setExams(next);
    void syncTeacherStateToServer({ exams: next });
    showToast('Đã xóa đề thi và lưu cố định danh sách mới.');
  };

  const handleDeleteExams = (ids: number[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const next = exams.filter((e) => !idSet.has(e.id));
    setExams(next);
    void syncTeacherStateToServer({ exams: next });
    showToast(`Đã xóa ${ids.length} đề thi và lưu cố định danh sách mới.`);
  };

  const handleSaveExamsPermanent = async () => {
    try {
      localStorage.setItem('studyflow_exams', JSON.stringify(exams));
      localStorage.setItem('studyflow_folders_v2', JSON.stringify(folders));
    } catch {}
    const ok = await syncTeacherStateToServer({ exams, folders });
    showToast(
      ok
        ? `Đã lưu cố định ${exams.length} đề thi hiện có trong trang Thi cử!`
        : 'Đã lưu cục bộ, vui lòng kiểm tra lại kết nối máy chủ.'
    );
  };

  const handleAddFolder = (folder: ExamFolder) => {
    const next = [...folders, folder];
    setFolders(next);
    void syncTeacherStateToServer({ folders: next });
    showToast(`Đã tạo thư mục "${folder.name}"!`);
  };

  const handleSubmitExamResult = (sub: ExamSubmission) => {
    setSubmissions((prev) => [sub, ...prev]);
    fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission: sub })
    }).catch(() => {});
    showToast(`Nộp bài thành công! Bạn đạt ${sub.score}/10 điểm.`);
  };

  const handleAddNotice = (notice: Omit<Notice, 'id' | 'createdAt' | 'reactions'>) => {
    const next = [{
      ...notice,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      reactions: {}
    }, ...notices];
    setNotices(next);
    if (role === 'teacher') {
      syncTeacherStateToServer({ notices: next });
    }
    showToast('Đã đăng thông báo mới!');
  };

  const handlePinNotice = (id: number) => {
    const next = notices.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n));
    setNotices(next);
    if (role === 'teacher') {
      syncTeacherStateToServer({ notices: next });
    }
  };

  const handleDeleteNotice = (id: number) => {
    const next = notices.filter((n) => n.id !== id);
    setNotices(next);
    if (role === 'teacher') {
      syncTeacherStateToServer({ notices: next });
    }
    showToast('Đã xóa thông báo.');
  };

  const handleReactNotice = (id: number, reaction: string) => {
    const next = notices.map((n) => {
      if (n.id === id) {
        return {
          ...n,
          reactions: {
            ...n.reactions,
            [reaction]: (n.reactions[reaction] || 0) + 1
          }
        };
      }
      return n;
    });
    setNotices(next);
    if (role === 'teacher') {
      syncTeacherStateToServer({ notices: next });
    }
  };

  // Countdowns State
  const [countdowns, setCountdowns] = useState<CountdownItem[]>(() => {
    return loadLocal('studyflow_countdowns', INITIAL_COUNTDOWNS);
  });
  usePersistLocal('studyflow_countdowns', countdowns);

  const handleAddCountdown = (item: Omit<CountdownItem, 'id'>) => {
    const newItem: CountdownItem = {
      ...item,
      id: Date.now()
    };
    setCountdowns((prev) => [newItem, ...prev]);
    showToast('Đã thêm kỳ thi đếm ngược mới!');
  };

  const handleUpdateCountdown = (item: CountdownItem) => {
    setCountdowns((prev) => prev.map((c) => (c.id === item.id ? item : c)));
    showToast('Đã cập nhật thông tin kỳ thi!');
  };

  const handleDeleteCountdown = (id: number) => {
    setCountdowns((prev) => prev.filter((c) => c.id !== id));
    showToast('Đã xóa kỳ thi.');
  };

  // Mood Logs State
  const [moodLogs, setMoodLogs] = useState<MoodLogEntry[]>(() => {
    return loadLocal('studyflow_mood_logs', [
      { id: 'm1', date: formatDate(new Date()), time: '09:00', mood: 'great', emoji: '😄', label: 'Tuyệt vời', note: 'Sẵn sàng cho ngày học mới!' },
      { id: 'm2', date: formatDate(new Date(Date.now() - 86400000)), time: '15:30', mood: 'good', emoji: '🙂', label: 'Vui vẻ', note: 'Làm xong bài tập Toán' }
    ]);
  });
  usePersistLocal('studyflow_mood_logs', moodLogs);

  const handleAddMoodLog = (entry: Omit<MoodLogEntry, 'id'>) => {
    const newEntry: MoodLogEntry = { ...entry, id: `m_${Date.now()}` };
    setMoodLogs((prev) => [newEntry, ...prev]);
    showToast(`Đã ghi nhận tâm trạng: ${entry.emoji} ${entry.label}`);
  };

  // Helper to ensure all events are strictly bound to a specific date string (YYYY-MM-DD)
  const sanitizeEvents = (rawEvents: CalendarEvent[]): CalendarEvent[] => {
    if (!Array.isArray(rawEvents)) return INITIAL_EVENTS;
    const thisMonday = new Date();
    thisMonday.setHours(0, 0, 0, 0);
    thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7));

    return rawEvents
      .filter((e) => e && typeof e === 'object')
      .map((e) => {
        if (!e.date) {
          const dow = typeof e.dow === 'number' ? e.dow : 0;
          const d = new Date(thisMonday);
          d.setDate(d.getDate() + dow);
          return {
            ...e,
            date: formatDate(d),
            dow
          };
        }
        return e;
      });
  };

  // Events State
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    return sanitizeEvents(loadLocal('studyflow_events', INITIAL_EVENTS));
  });
  usePersistLocal('studyflow_events', events);

  useEffect(() => {
    const handleAddEvents = (e: any) => {
      const newEvents = e.detail;
      if (Array.isArray(newEvents)) {
        setEvents((prev) => {
          const sanitized = sanitizeEvents(newEvents);
          return [...prev, ...sanitized];
        });
      }
    };
    window.addEventListener('studyflow_add_events', handleAddEvents);
    return () => window.removeEventListener('studyflow_add_events', handleAddEvents);
  }, []);

  // Tasks State
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    return loadLocal('studyflow_tasks', INITIAL_TASKS);
  });
  usePersistLocal('studyflow_tasks', tasks);

  // Library State (respect exact user edits/deletions without re-injecting deleted defaults)
  const [library, setLibrary] = useState<LibraryItem[]>(() => {
    return loadLocal('studyflow_library', INITIAL_LIBRARY);
  });
  usePersistLocal('studyflow_library', library);

  // Teacher Private Materials Vault (permanently preserves Math materials)
  const [teacherPrivateLibrary, setTeacherPrivateLibrary] = useState<LibraryItem[]>(() => {
    return mergePermanentTeacherMathVault(
      loadLocal('studyflow_teacher_private_library', INITIAL_TEACHER_MATH_VAULT)
    );
  });
  usePersistLocal('studyflow_teacher_private_library', teacherPrivateLibrary);

  // Sessions State
  const [sessions, setSessions] = useState<DayFocusSession>(() => {
    return loadLocal('studyflow_sessions', {});
  });
  usePersistLocal('studyflow_sessions', sessions);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCopyrightOpen, setIsCopyrightOpen] = useState(false);
  const [isJoinClassModalOpen, setIsJoinClassModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDeadlineToast, setIsDeadlineToast] = useState(false);

  const [isFloatingChatReady, setIsFloatingChatReady] = useState(false);

  useEffect(() => {
    const w = window as any;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => setIsFloatingChatReady(true), { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(() => setIsFloatingChatReady(true), 450);
    return () => window.clearTimeout(timer);
  }, []);

  // Notification logic
  const notifiedIds = useRef<Set<string>>(new Set());
  const tasksRef = useRef(tasks);
  const eventsRef = useRef(events);
  tasksRef.current = tasks;
  eventsRef.current = events;

  useEffect(() => {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      // ignore iframe permission errors
    }

    const triggerNotification = (title: string, body: string) => {
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/assets/aistudio/logo_studyflow_mark.png' });
        }
      } catch {
        // ignore
      }
      
      setToastMessage(`${title}\n${body}`);
      setIsDeadlineToast(true);
      setTimeout(() => {
        setIsDeadlineToast(false);
        setToastMessage(null);
      }, 8000);
    };

    const checkDeadlines = () => {
      const now = new Date();
      const todayDateStr = formatDate(now);
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const thresholds = [120, 30, 15];

      tasksRef.current.forEach((task) => {
        if (task.done || !task.dueTime) return;
        if (task.due === todayDateStr) {
          const [h, m] = task.dueTime.split(':').map(Number);
          const taskHour = h + m / 60;
          const diffMins = Math.round((taskHour - currentHour) * 60);

          thresholds.forEach(threshold => {
            const uniqueId = `task_${task.id}_${threshold}`;
            if (diffMins > 0 && diffMins <= threshold && !notifiedIds.current.has(uniqueId)) {
              triggerNotification(
                `Sắp đến hạn: ${task.t}`, 
                `Nhiệm vụ này sẽ đến hạn vào lúc ${task.dueTime} (còn ~${diffMins} phút).`
              );
              notifiedIds.current.add(uniqueId);
            }
          });
        }
      });

      eventsRef.current.forEach((event) => {
        if (event.date === todayDateStr) {
          const diffMins = Math.round((event.h - currentHour) * 60);
          
          thresholds.forEach(threshold => {
            const uniqueId = `event_${event.id}_${threshold}`;
            if (diffMins > 0 && diffMins <= threshold && !notifiedIds.current.has(uniqueId)) {
              const timeLabel = formatHours(event.h);
              const importance = event.type === 'exam' || event.type === 'due' ? 'quan trọng' : 'sắp diễn ra';
              triggerNotification(
                `Sự kiện ${importance}: ${event.t}`, 
                `Buổi học/Sự kiện sẽ bắt đầu vào lúc ${timeLabel} (còn ~${diffMins} phút).`
              );
              notifiedIds.current.add(uniqueId);
            }
          });
        }
      });
    };

    const initialTimer = window.setTimeout(checkDeadlines, 1200);
    const interval = setInterval(checkDeadlines, 5 * 60 * 1000);
    return () => {
      window.clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const handleJoinClass = (classCode: string) => {
    showToast(`Đang gửi yêu cầu tham gia lớp: ${classCode}...`);
  };

  const showToast = (msg: string) => {
    setIsDeadlineToast(false);
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3000);
  };

  // Event handlers
  const handleSaveEvent = (event: CalendarEvent) => {
    setEvents((prev) => {
      const exists = prev.some((e) => e.id === event.id);
      if (exists) {
        return prev.map((e) => (e.id === event.id ? event : e));
      }
      return [...prev, event];
    });
    showToast('Đã lưu sự kiện thành công!');
  };

  const handleDeleteEvent = (id: number) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    showToast('Đã xóa sự kiện.');
  };

  // Task handlers
  const handleAddTask = (item: Omit<TaskItem, 'id'>) => {
    const isDone = item.status === 'done' || !!item.done;
    const newTask: TaskItem = {
      ...item,
      id: Date.now(),
      status: item.status || (isDone ? 'done' : 'todo'),
      priority: item.priority || (item.hi ? 'high' : 'medium'),
      done: isDone
    };
    const next = [newTask, ...tasks];
    setTasks(next);
    if (role === 'teacher') {
      syncTeacherStateToServer({ tasks: next });
    }
    showToast('Đã thêm bài tập mới!');
  };

  const handleUpdateTask = (task: TaskItem) => {
    const isDone = task.status === 'done' || task.done;
    const updated: TaskItem = {
      ...task,
      done: isDone,
      status: task.status || (isDone ? 'done' : 'in_progress')
    };
    const next = tasks.map((t) => (t.id === task.id ? updated : t));
    setTasks(next);
    if (role === 'teacher') {
      syncTeacherStateToServer({ tasks: next });
    }
    showToast('Đã cập nhật bài tập!');
  };

  const handleToggleTask = (id: number) => {
    const next = tasks.map((t) => {
      if (t.id === id) {
        const nextDone = !t.done;
        return {
          ...t,
          done: nextDone,
          status: nextDone ? ('done' as const) : ('in_progress' as const)
        };
      }
      return t;
    });
    setTasks(next);
    if (role === 'teacher') {
      syncTeacherStateToServer({ tasks: next });
    }
  };

  const handleDeleteTask = (id: number) => {
    const next = tasks.filter((t) => t.id !== id);
    setTasks(next);
    if (role === 'teacher') {
      syncTeacherStateToServer({ tasks: next });
    }
    showToast('Đã xóa bài tập.');
  };

  // Library handlers (always persist permanently across both student & teacher roles)
  const handleAddResource = (item: Omit<LibraryItem, 'id'>) => {
    const newResource: LibraryItem = {
      ...item,
      id: Date.now()
    };
    const next = [newResource, ...library];
    setLibrary(next);
    syncTeacherStateToServer({ library: next });
    showToast('Đã lưu cố định tài liệu vào Học liệu!');
  };

  const handleUpdateResource = (item: LibraryItem) => {
    const next = library.map((l) => (l.id === item.id ? item : l));
    setLibrary(next);
    syncTeacherStateToServer({ library: next });
    showToast('Đã cập nhật & lưu cố định tài liệu!');
  };

  const handleDeleteResource = (id: number) => {
    const next = library.filter((l) => l.id !== id);
    setLibrary(next);
    syncTeacherStateToServer({ library: next });
    showToast('Đã xóa tài liệu và lưu cố định danh sách mới.');
  };

  const handleToggleFavoriteResource = (id: number) => {
    const next = library.map((l) => (l.id === id ? { ...l, fav: !l.fav } : l));
    setLibrary(next);
    syncTeacherStateToServer({ library: next });
  };

  const handleSaveLibraryPermanent = () => {
    const securedVault = mergePermanentTeacherMathVault(teacherPrivateLibrary);
    setTeacherPrivateLibrary(securedVault);
    try {
      localStorage.setItem('studyflow_library', JSON.stringify(library));
      localStorage.setItem('studyflow_teacher_private_library', JSON.stringify(securedVault));
    } catch {}
    syncTeacherStateToServer({ library, teacherPrivateLibrary: securedVault });
    showToast('Đã lưu cố định kho tài liệu riêng của giáo viên & học liệu chung!');
  };

  // Teacher Private Math Repository handlers
  const handleAddTeacherPrivateResource = (item: Omit<LibraryItem, 'id'>) => {
    const newResource: LibraryItem = {
      ...item,
      id: Date.now(),
      sub: item.sub || 'Toán'
    };
    const next = mergePermanentTeacherMathVault([newResource, ...teacherPrivateLibrary]);
    setTeacherPrivateLibrary(next);
    syncTeacherStateToServer({ teacherPrivateLibrary: next });
    showToast('Đã lưu cố định tài liệu vào Kho riêng giáo viên!');
  };

  const handleUpdateTeacherPrivateResource = (item: LibraryItem) => {
    const existing = teacherPrivateLibrary.find((l) => l.id === item.id);
    const updatedItem: LibraryItem = existing?.isPermanent
      ? { ...item, isPermanent: true }
      : item;
    const next = mergePermanentTeacherMathVault(
      teacherPrivateLibrary.map((l) => (l.id === item.id ? updatedItem : l))
    );
    setTeacherPrivateLibrary(next);
    syncTeacherStateToServer({ teacherPrivateLibrary: next });
    showToast('Đã cập nhật & lưu cố định tài liệu trong Kho riêng!');
  };

  const handleDeleteTeacherPrivateResource = (id: number) => {
    const target = teacherPrivateLibrary.find((l) => l.id === id);
    if (target?.isPermanent) {
      showToast('Tài liệu môn Toán này được lưu cố định trong kho riêng của giáo viên.');
      return;
    }
    const next = mergePermanentTeacherMathVault(
      teacherPrivateLibrary.filter((l) => l.id !== id)
    );
    setTeacherPrivateLibrary(next);
    syncTeacherStateToServer({ teacherPrivateLibrary: next });
    showToast('Đã xóa tài liệu tùy chỉnh khỏi Kho riêng.');
  };

  const handleToggleFavoriteTeacherPrivateResource = (id: number) => {
    const next = teacherPrivateLibrary.map((l) => (l.id === id ? { ...l, fav: !l.fav } : l));
    setTeacherPrivateLibrary(next);
    syncTeacherStateToServer({ teacherPrivateLibrary: next });
  };

  // Private Teacher Feedback helpers for current student
  const normCurrentStudentName = (studentProfile?.name || '').trim().toLowerCase();
  const myPrivateFeedbacks = React.useMemo(() => {
    const direct = teacherFeedbacks.filter(
      (fb) => (fb.studentName || '').trim().toLowerCase() === normCurrentStudentName
    );
    const seenIds = new Set(direct.map((f) => f.id));
    const extra: TeacherFeedbackItem[] = [];
    teacherClasses.forEach((cls) => {
      cls.students.forEach((st) => {
        if ((st.name || '').trim().toLowerCase() !== normCurrentStudentName) return;
        (['hk1', 'hk2'] as SemesterKey[]).forEach((sem) => {
          const rec = getStudentScoresBySemester(st, sem);
          const fbId = `fb_${st.id}_${sem}`;
          if (rec?.comment?.trim() && !seenIds.has(fbId)) {
            seenIds.add(fbId);
            const avg = getScoreForCategory(st, 'all', sem);
            extra.push({
              id: fbId,
              studentId: st.id,
              studentName: st.name,
              rollNumber: st.rollNumber,
              className: cls.name,
              subject: cls.subject || teacherProfile.subject || 'Toán',
              semester: sem,
              teacherName: teacherProfile.name,
              avgScore: avg,
              comment: rec.comment.trim(),
              updatedAt: new Date().toISOString(),
              read: false
            });
          }
        });
      });
    });
    return [...direct, ...extra];
  }, [teacherFeedbacks, teacherClasses, normCurrentStudentName, teacherProfile.name, teacherProfile.subject]);

  const handleMarkFeedbackRead = (id: string) => {
    setTeacherFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, read: true } : f)));
    fetch('/api/feedbacks/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    }).catch(() => {});
  };

  const handleMarkAllFeedbacksRead = () => {
    setTeacherFeedbacks((prev) =>
      prev.map((f) =>
        (f.studentName || '').trim().toLowerCase() === normCurrentStudentName
          ? { ...f, read: true }
          : f
      )
    );
    fetch('/api/feedbacks/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true, studentName: studentProfile?.name })
    }).catch(() => {});
  };

  // Flashcards State
  const [decks, setDecks] = useState<FlashcardDeck[]>(() => {
    return loadLocal('studyflow_decks', INITIAL_DECKS);
  });

  useEffect(() => {
    try {
      localStorage.setItem('studyflow_decks', JSON.stringify(decks));
    } catch {
      // ignore
    }
  }, [decks]);

  const handleAddDeck = (deck: FlashcardDeck) => {
    setDecks((prev) => [deck, ...prev]);
    showToast(`Đã tạo bộ Flashcard "${deck.title}" thành công!`);
  };

  const handleUpdateDeck = (deck: FlashcardDeck) => {
    setDecks((prev) => prev.map((d) => (d.id === deck.id ? deck : d)));
  };

  const handleDeleteDeck = (id: string) => {
    const deck = decks.find((d) => d.id === id);
    setDecks((prev) => prev.filter((d) => d.id !== id));
    showToast(`Đã xóa bộ Flashcard "${deck?.title || ''}".`);
  };

  // Data reset & restore (never wipes teacher profile or teacher class configuration)
  const handleResetToDefault = () => {
    setEvents(INITIAL_EVENTS);
    setTasks(INITIAL_TASKS);
    setLibrary(INITIAL_LIBRARY);
    setTeacherPrivateLibrary(INITIAL_TEACHER_MATH_VAULT);
    setCountdowns(INITIAL_COUNTDOWNS);
    setExams(INITIAL_EXAMS);
    setFolders(INITIAL_FOLDERS);
    setDecks(INITIAL_DECKS);
    setSubmissions([]);
    setSessions({});
    try {
      [
        'studyflow_events',
        'studyflow_tasks',
        'studyflow_library',
        'studyflow_countdowns',
        'studyflow_exams',
        'studyflow_folders_v2',
        'studyflow_decks',
        'studyflow_submissions',
        'studyflow_sessions',
        'studyflow_mood_logs'
      ].forEach((k) => localStorage.removeItem(k));
    } catch {}
    showToast('Đã đặt lại dữ liệu mặc định thành công.');
    setIsCopyrightOpen(false);
  };

  const handleRestoreData = (data: {
    events?: CalendarEvent[];
    tasks?: TaskItem[];
    library?: LibraryItem[];
    sessions?: DayFocusSession;
    countdowns?: CountdownItem[];
    exams?: ExamItem[];
    decks?: FlashcardDeck[];
  }) => {
    if (data.events) setEvents(data.events);
    if (data.tasks) setTasks(data.tasks);
    if (data.library) setLibrary(data.library);
    if (data.sessions) setSessions(data.sessions);
    if (data.countdowns) setCountdowns(data.countdowns);
    if (data.exams) setExams(data.exams);
    if (data.decks) setDecks(data.decks);
    showToast('Đã khôi phục dữ liệu từ bản sao lưu!');
  };

  const todayStr = formatDate(new Date());
  const todayEventsCount = events.filter((e) => e.date === todayStr).length;
  const pendingTasksCount = tasks.filter((t) => !t.done).length;

  useEffect(() => {
    const prefetchRoleChunks = () => {
      if (role === 'teacher') {
        import('./components/ExamsView');
        import('./components/LibraryView');
        import('./components/TeacherTimetableView');
        import('./components/NoticeBoardView');
        import('./components/TeacherAssignView');
        import('./components/TeacherClassDetailModal');
        import('./components/TeacherClassesView');
        import('./components/TeacherAiExamModal');
        import('./components/TeacherAiMaterialModal');
        import('./components/TeacherAiAssistantModal');
      } else {
        import('./components/ExamsView');
        import('./components/TasksView');
        import('./components/CalendarView');
        import('./components/FlashcardsView');
        import('./components/FocusView');
        import('./components/StatsView');
        import('./components/LibraryView');
        import('./components/NoticeBoardView');
        import('./components/GroupStudyModal');
        import('./components/CountdownView');
        import('./components/AIHubView');
      }
    };
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(prefetchRoleChunks, { timeout: 600 });
      return () => window.cancelIdleCallback?.(idleId);
    }
    const timer = globalThis.setTimeout(prefetchRoleChunks, 220);
    return () => globalThis.clearTimeout(timer);
  }, [role]);

  if (role === 'teacher') {
    const teacherViewKey = isAiExamModalOpen
      ? 'teacher-ai-exam-page'
      : selectedTeacherClass
      ? `class-detail-${selectedTeacherClass.id}`
      : teacherTab === 'ai_material'
      ? 'materials'
      : teacherTab;
    return (
      <MotionConfig reducedMotion="user">
        <TactileFeedbackLayer />
        <div className="min-h-screen bg-[#f3f7fe] dark:bg-[#030712] text-slate-900 dark:text-slate-100 flex flex-col md:flex-row antialiased transition-colors">
          {/* Teacher Desktop Sidebar */}
          <div className="hidden md:block">
            <Suspense fallback={<div className="w-64 shrink-0" />}>
              <TeacherSidebar
                currentTab={teacherTab}
                onSelectTab={(tab) => {
                  resetScrollOnTabChange();
                  setIsAiExamModalOpen(false);
                  setSelectedTeacherClassId(null);
                  setTeacherTab(tab);
                  if (tab === 'ai_material') setIsAiMaterialModalOpen(true);
                  if (tab === 'ai_assistant') setIsAiAssistantModalOpen(true);
                  if (tab === 'assign') setAssignDefaultClassId('all');
                  if (tab === 'settings') setIsTeacherProfileModalOpen(true);
                }}
                profile={teacherProfile}
                onSwitchToStudent={toggleRole}
                onOpenCopyright={() => setIsCopyrightOpen(true)}
                onOpenProfileModal={() => setIsTeacherProfileModalOpen(true)}
                isCollapsed={teacherSidebarCollapsed}
                onToggleCollapse={toggleTeacherSidebar}
              />
            </Suspense>
          </div>

          {/* Teacher Main Container */}
          <div className="flex-1 flex flex-col min-w-0">
            <Suspense fallback={<div className="h-16" />}>
              <TeacherTopBar
                profile={teacherProfile}
                theme={theme}
                onToggleTheme={toggleTheme}
                onSwitchToStudent={toggleRole}
                onOpenCopyright={() => setIsCopyrightOpen(true)}
                onOpenProfileModal={() => setIsTeacherProfileModalOpen(true)}
              />
            </Suspense>

            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8 overflow-x-clip">
              <AnimatePresence mode="wait" initial={false} custom={teacherFlipDir}>
                <motion.div
                  key={teacherViewKey}
                  custom={teacherFlipDir}
                  variants={tabFlipVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  style={{ transformOrigin: 'center center' }}
                >
                  <Suspense fallback={<ViewLoader />}>
                  {isAiExamModalOpen ? (
                    <TeacherAiExamModal
                      isOpen={true}
                      isPage={true}
                      onClose={() => setIsAiExamModalOpen(false)}
                      onSaveExam={handleSaveExam}
                      defaultSubject={teacherProfile.subject}
                      classes={teacherClasses}
                    />
                  ) : selectedTeacherClass ? (
                    <TeacherClassDetailModal
                      isOpen={true}
                      isPage={true}
                      onClose={() => setSelectedTeacherClassId(null)}
                      selectedClass={selectedTeacherClass}
                      onAddStudent={handleAddStudentToClass}
                      onOpenAiExam={() => setIsAiExamModalOpen(true)}
                      onRenameClass={handleRenameClass}
                      onEditStudent={(student, sem) => {
                        setEditingStudent(student);
                        setEditStudentSemester(sem || 'hk1');
                        setIsEditStudentModalOpen(true);
                      }}
                      onDeleteStudent={handleDeleteStudent}
                      onDeleteClass={handleDeleteClass}
                    />
                  ) : (
                    <>
                  {teacherTab === 'overview' && (
                    <TeacherDashboardView
                      profile={teacherProfile}
                      classes={teacherClasses}
                      totalExamsCount={exams.length}
                      totalMaterialsCount={library.length + teacherPrivateLibrary.length}
                      assignedTasksCount={tasks.length}
                      onOpenProfileModal={() => setIsTeacherProfileModalOpen(true)}
                      onOpenAiExamModal={() => setIsAiExamModalOpen(true)}
                      onOpenAiMaterialModal={() => setIsAiMaterialModalOpen(true)}
                      onOpenAiAssistantModal={() => setIsAiAssistantModalOpen(true)}
                      onOpenAssignModal={() => {
                        setAssignDefaultClassId('all');
                        setTeacherTab('assign');
                      }}
                      onSelectClass={(cls) => setSelectedTeacherClassId(cls.id)}
                      onOpenScoreDistribution={() => {
                        setIsAiExamModalOpen(false);
                        setSelectedTeacherClassId(null);
                        setPendingTeacherExamAnalytics(true);
                        setTeacherTab('exams');
                      }}
                      onNavigateTab={(tab) => {
                        setIsAiExamModalOpen(false);
                        setSelectedTeacherClassId(null);
                        setPendingTeacherExamAnalytics(false);
                        setTeacherTab(tab);
                        if (tab === 'ai_material') setIsAiMaterialModalOpen(true);
                        if (tab === 'ai_assistant') setIsAiAssistantModalOpen(true);
                        if (tab === 'assign') setAssignDefaultClassId('all');
                        if (tab === 'settings') setIsTeacherProfileModalOpen(true);
                      }}
                    />
                  )}

                  {teacherTab === 'exams' && (
                    <ExamsView
                      exams={exams}
                      folders={folders}
                      submissions={submissions}
                      role={role}
                      studentName={teacherProfile.name}
                      initialOpenAnalytics={pendingTeacherExamAnalytics}
                      onClearInitialAnalytics={() => setPendingTeacherExamAnalytics(false)}
                      onSaveExam={handleSaveExam}
                      onDeleteExam={handleDeleteExam}
                      onDeleteExams={handleDeleteExams}
                      onDeleteFolder={handleDeleteFolder}
                      onAddFolder={handleAddFolder}
                      onSubmitResult={handleSubmitExamResult}
                      onBackToOverview={() => setTeacherTab('overview')}
                      onOpenCreateExam={() => setIsAiExamModalOpen(true)}
                      onSavePermanent={handleSaveExamsPermanent}
                    />
                  )}

                  {(teacherTab === 'materials' || teacherTab === 'ai_material') && (
                    <div className="space-y-4">
                      <div className="sf-card flex items-center justify-between p-4 rounded-2xl">
                        <div>
                          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Học liệu & Bài giảng giáo viên</h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Tài liệu, giáo án và bài tập bồi dưỡng</p>
                        </div>
                        <button
                          onClick={() => setIsAiMaterialModalOpen(true)}
                          data-sound="success"
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:brightness-110 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition cursor-pointer"
                        >
                          <span>✨ AI Tạo học liệu theo Chương</span>
                        </button>
                      </div>
                      <LibraryView
                        library={library}
                        role={role}
                        onAddResource={handleAddResource}
                        onUpdateResource={handleUpdateResource}
                        onDeleteResource={handleDeleteResource}
                        onToggleFavorite={handleToggleFavoriteResource}
                        onSavePermanent={handleSaveLibraryPermanent}
                        teacherPrivateLibrary={teacherPrivateLibrary}
                        onAddPrivateResource={handleAddTeacherPrivateResource}
                        onUpdatePrivateResource={handleUpdateTeacherPrivateResource}
                        onDeletePrivateResource={handleDeleteTeacherPrivateResource}
                        onTogglePrivateFavorite={handleToggleFavoriteTeacherPrivateResource}
                      />
                    </div>
                  )}

            {teacherTab === 'classes' && (
              <TeacherClassesView
                classes={teacherClasses}
                joinRequests={joinRequests}
                onSelectClass={(cls) => setSelectedTeacherClassId(cls.id)}
                onOpenCreateClass={() => setIsCreateClassModalOpen(true)}
                onRenameClass={handleRenameClass}
                onDeleteClass={handleDeleteClass}
                onApproveJoinRequest={handleApproveJoinRequest}
                onRejectJoinRequest={handleRejectJoinRequest}
              />
            )}

            {teacherTab === 'assign' && (
              <TeacherAssignView
                classes={teacherClasses}
                tasks={tasks}
                exams={exams}
                library={library}
                teacherName={teacherProfile.name}
                defaultSubject={teacherProfile.subject}
                defaultClassId={assignDefaultClassId}
                onAssignSubmit={handleTeacherAssignTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onResendNotice={handleResendAssignmentNotice}
                onBackToOverview={() => setTeacherTab('overview')}
              />
            )}

            {teacherTab === 'timetable' && (
              <TeacherTimetableView
                profile={teacherProfile}
                classes={teacherClasses}
                onSelectClass={(cls) => setSelectedTeacherClassId(cls.id)}
                onToast={showToast}
              />
            )}

            {teacherTab === 'notices' && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{isEn ? 'Notice Board & Alerts' : 'Bảng tin & Thông báo'}</h2>
                <NoticeBoardView
                  notices={notices}
                  role={role}
                  onAddNotice={handleAddNotice}
                  onPinNotice={handlePinNotice}
                  onDeleteNotice={handleDeleteNotice}
                  onReact={handleReactNotice}
                  onPreviewNoticeAttachment={handlePreviewNoticeAttachment}
                />
              </div>
            )}
                    </>
                  )}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>
          </div>

        {/* Teacher Modals */}
        {isAiMaterialModalOpen && (
          <Suspense fallback={null}>
            <TeacherAiMaterialModal
              isOpen={isAiMaterialModalOpen}
              onClose={() => setIsAiMaterialModalOpen(false)}
              onSaveResource={handleAddResource}
              defaultSubject={teacherProfile.subject}
              teacherName={teacherProfile.name}
            />
          </Suspense>
        )}

        {isAiAssistantModalOpen && (
          <Suspense fallback={null}>
            <TeacherAiAssistantModal
              isOpen={isAiAssistantModalOpen}
              onClose={() => setIsAiAssistantModalOpen(false)}
              profile={teacherProfile}
            />
          </Suspense>
        )}

        {editingStudent && isEditStudentModalOpen && (
          <Suspense fallback={null}>
            <EditStudentModal
              isOpen={isEditStudentModalOpen}
              onClose={() => setIsEditStudentModalOpen(false)}
              student={editingStudent}
              initialSemester={editStudentSemester}
              onSave={handleUpdateStudent}
            />
          </Suspense>
        )}

        {isTeacherProfileModalOpen && (
          <Suspense fallback={null}>
            <TeacherProfileModal
              isOpen={isTeacherProfileModalOpen}
              onClose={() => setIsTeacherProfileModalOpen(false)}
              profile={teacherProfile}
              onSaveProfile={handleSaveTeacherProfile}
            />
          </Suspense>
        )}

        {previewNoticeDoc && (
          <Suspense fallback={null}>
            <DocumentViewerModal item={previewNoticeDoc} onClose={() => setPreviewNoticeDoc(null)} />
          </Suspense>
        )}

        {isCreateClassModalOpen && (
          <Suspense fallback={null}>
            <CreateClassModal
              isOpen={isCreateClassModalOpen}
              onClose={() => setIsCreateClassModalOpen(false)}
              defaultSubject={teacherProfile.subject}
              nextNumber={teacherClasses.length + 1}
              onCreateClass={handleCreateClass}
            />
          </Suspense>
        )}

        {/* Mobile Bottom Navigation Bar for Teacher */}
        <div
          data-no-translate
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#060e20]/95 backdrop-blur-xl text-slate-300 border-t border-cyan-500/25 shadow-[0_-8px_30px_rgba(3,7,18,0.65)] flex items-center justify-around py-2 px-1"
        >
          {[
            { id: 'overview' as TeacherTab, label: isEn ? 'Overview' : 'Tổng quan', icon: LayoutDashboard },
            { id: 'timetable' as TeacherTab, label: isEn ? 'Schedule' : 'TKB', icon: CalendarDays },
            { id: 'assign' as TeacherTab, label: isEn ? 'Assign' : 'Giao bài', icon: Send },
            { id: 'classes' as TeacherTab, label: isEn ? 'Classes' : 'Lớp học', icon: Users },
            { id: 'exams' as TeacherTab, label: isEn ? 'Exams' : 'Thi cử', icon: ClipboardList },
            { id: 'materials' as TeacherTab, label: isEn ? 'Materials' : 'Học liệu', icon: BookOpen },
            { id: 'notices' as TeacherTab, label: isEn ? 'Notices' : 'Bảng tin', icon: MessageCircle }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = teacherTab === tab.id;
            return (
              <button
                key={tab.id}
                data-sound="nav"
                onClick={() => {
                  resetScrollOnTabChange();
                  setIsAiExamModalOpen(false);
                  setSelectedTeacherClassId(null);
                  setTeacherTab(tab.id as TeacherTab);
                  if (tab.id === 'assign') setAssignDefaultClassId('all');
                }}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl text-[10px] font-semibold relative transition-all duration-150 active:scale-95 ${
                  isActive
                    ? 'text-cyan-300 font-extrabold drop-shadow-[0_0_8px_rgba(34,211,238,0.65)] bg-cyan-500/10'
                    : 'text-slate-400 hover:text-cyan-200'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>



        {/* Toast Notification / Deadline Alert */}
        {toastMessage && (
          <div className={`fixed bottom-20 md:bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 w-full max-w-[320px] sm:max-w-md px-4`}>
            {isDeadlineToast ? (
              <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-2xl shadow-2xl p-4 flex gap-4 items-start ring-4 ring-amber-500/10">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 animate-bounce">
                  <BellRing className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">Cảnh báo Deadline</h4>
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {toastMessage}
                  </div>
                </div>
                <button 
                  onClick={() => setToastMessage(null)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="mx-auto w-fit px-6 py-3 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-bold rounded-2xl shadow-xl border border-slate-700 dark:border-slate-200 flex items-center gap-3 backdrop-blur-md">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span>{toastMessage}</span>
              </div>
            )}
          </div>
        )}

        {isCopyrightOpen && (
          <Suspense fallback={null}>
            <CopyrightModal
              isOpen={isCopyrightOpen}
              onClose={() => setIsCopyrightOpen(false)}
              events={events}
              tasks={tasks}
              library={library}
              sessions={sessions}
              countdowns={countdowns}
              exams={exams}
              onRestoreData={handleRestoreData}
              onResetToDefault={handleResetToDefault}
            />
          </Suspense>
        )}

        </div>
      </MotionConfig>
    );
  }

  // Student Role Render
  const studentViewKey =
    currentTab === 'exams' && isStudentCreateExamPage
      ? 'student-ai-exam-page'
      : currentTab === 'countdown'
      ? 'calendar'
      : currentTab;
  return (
    <MotionConfig reducedMotion="user">
      <TactileFeedbackLayer />
      <div className="min-h-screen bg-[#f3f7fe] dark:bg-[#030712] text-slate-900 dark:text-slate-100 flex flex-col md:flex-row antialiased transition-colors">
      {/* Desktop Sidebar (hidden in AI Focus Mode) */}
      {!isAiFocusMode && (
        <div className="hidden md:block">
          <Sidebar
            currentTab={currentTab}
            onSelectTab={handleSelectTab}
            pendingTasksCount={pendingTasksCount}
            todayEventsCount={todayEventsCount}
            onOpenCopyright={() => setIsCopyrightOpen(true)}
            onOpenJoinClass={() => setIsJoinClassModalOpen(true)}
    
            studentProfile={studentProfile}
            onOpenStudentProfile={() => setIsStudentProfileModalOpen(true)}
            unreadNoticeCount={unreadNoticeCount}
            theme={theme}
            onToggleTheme={toggleTheme}
            isCollapsed={studentSidebarCollapsed}
            onToggleCollapse={toggleStudentSidebar}
            onLogout={() => {
              try {
                localStorage.removeItem('studyflow_role');
                localStorage.removeItem('studyflow_teacher_remembered');
                localStorage.removeItem('studyflow_switch_count');
              } catch {}
              window.location.reload();
            }}
          />
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          role={role}
          onToggleRole={toggleRole}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenCopyright={() => setIsCopyrightOpen(true)}
          onSearchSubmit={() => {
            if (searchQuery.trim() && !['library', 'tasks', 'calendar', 'exams'].includes(currentTab)) {
              handleSelectTab('library');
            }
          }}
          notices={notices}
          unreadNoticeCount={unreadNoticeCount}
          onMarkNoticesRead={handleMarkNoticesRead}
          onReactNotice={handleReactNotice}
          onNavigateToNews={() => handleSelectTab('notices')}
          onOpenAssignmentNotice={handleOpenAssignmentNotice}
          onPreviewNoticeAttachment={handlePreviewNoticeAttachment}
          studentProfile={studentProfile}
          onOpenStudentProfile={() => setIsStudentProfileModalOpen(true)}
          isAiFocusMode={isAiFocusMode}
          onToggleAiFocusMode={toggleAiFocusMode}
        />

        {/* View Content */}
        {isAiFocusMode ? (
          <main className="flex-1 p-3 sm:p-5 w-full mx-auto flex flex-col items-center justify-center">
            <Suspense fallback={<ViewLoader />}>
              <AiFocusTutorView
                studentProfile={studentProfile}
                onExitFocusMode={() => setIsAiFocusMode(false)}
              />
            </Suspense>
          </main>
        ) : (
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8 overflow-x-clip">
          <AnimatePresence mode="wait" initial={false} custom={studentFlipDir}>
            <motion.div
              key={studentViewKey}
              custom={studentFlipDir}
              variants={tabFlipVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ transformOrigin: 'center center' }}
            >
              <Suspense fallback={<ViewLoader />}>
              {currentTab === 'overview' && (
            <OverviewView
              events={events}
              tasks={tasks}
              library={library}
              sessions={sessions}
              countdowns={countdowns}
              role={role}
              onNavigate={handleSelectTab}
              onToggleTask={handleToggleTask}
              moodLogs={moodLogs}
              onAddMoodLog={handleAddMoodLog}
              searchQuery={searchQuery}
              studentProfile={studentProfile}
              submissions={submissions}
            />
          )}

          {currentTab === 'exams' && (
            isStudentCreateExamPage ? (
              <TeacherAiExamModal
                isOpen={true}
                isPage={true}
                onClose={() => setIsStudentCreateExamPage(false)}
                onSaveExam={handleSaveExam}
                defaultSubject="Vật lí"
                classes={teacherClasses}
              />
            ) : (
              <ExamsView
                exams={exams}
                folders={folders}
                submissions={submissions}
                role={role}
                studentName={studentProfile.name}
                initialOpenExamId={pendingExamToOpenId}
                onClearInitialExamId={() => setPendingExamToOpenId(null)}
                onSaveExam={handleSaveExam}
                onDeleteExam={handleDeleteExam}
                onDeleteExams={handleDeleteExams}
                onDeleteFolder={handleDeleteFolder}
                onAddFolder={handleAddFolder}
                onSubmitResult={handleSubmitExamResult}
                onBackToOverview={() => handleSelectTab('overview')}
                onOpenCreateExam={() => setIsStudentCreateExamPage(true)}
                onSavePermanent={handleSaveExamsPermanent}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )
          )}

          {(currentTab === 'calendar' || currentTab === 'countdown') && (
            <CalendarView
              events={events}
              tasks={tasks}
              role={role}
              onSaveEvent={handleSaveEvent}
              onDeleteEvent={handleDeleteEvent}
              countdowns={countdowns}
              onAddCountdown={handleAddCountdown}
              onUpdateCountdown={handleUpdateCountdown}
              onDeleteCountdown={handleDeleteCountdown}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              studentProfile={studentProfile}
              onOpenStudentProfile={() => setIsStudentProfileModalOpen(true)}
              onSaveStudentProfile={handleSaveStudentProfile}
            />
          )}

          {currentTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              role={role}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectTab={handleSelectTab}
              sessions={sessions}
              studentProfile={studentProfile}
              teacherFeedbacks={myPrivateFeedbacks}
              onMarkFeedbackRead={handleMarkFeedbackRead}
              onMarkAllFeedbacksRead={handleMarkAllFeedbacksRead}
            />
          )}

          {currentTab === 'focus' && (
            <FocusView
              sessions={sessions}
              onUpdateSessions={setSessions}
            />
          )}

          {currentTab === 'stats' && (
            <StatsView
              tasks={tasks}
              library={library}
              sessions={sessions}
              submissions={submissions}
              events={events}
              studentProfile={studentProfile}
              onNavigate={handleSelectTab}
            />
          )}

          {currentTab === 'flashcards' && (
            <FlashcardsView
              decks={decks}
              onAddDeck={handleAddDeck}
              onUpdateDeck={handleUpdateDeck}
              onDeleteDeck={handleDeleteDeck}
              studentName={studentProfile.name}
            />
          )}

          {currentTab === 'ai_studio' && (
            <AIHubView
              onAddDeck={handleAddDeck}
              onToast={showToast}
              onNavigateToCalendar={() => setCurrentTab('calendar')}
            />
          )}

          {currentTab === 'library' && (
            <LibraryView
              library={library}
              role={role}
              onAddResource={handleAddResource}
              onUpdateResource={handleUpdateResource}
              onDeleteResource={handleDeleteResource}
              onToggleFavorite={handleToggleFavoriteResource}
              onSavePermanent={handleSaveLibraryPermanent}
              initialSearch={searchQuery}
            />
          )}

          {currentTab === 'notices' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{isEn ? 'Notice Board & Alerts' : 'Bảng tin & Thông báo'}</h2>
              <NoticeBoardView
                notices={notices}
                role={role}
                onAddNotice={handleAddNotice}
                onPinNotice={handlePinNotice}
                onDeleteNotice={handleDeleteNotice}
                onReact={handleReactNotice}
                onOpenAssignmentNotice={handleOpenAssignmentNotice}
                onPreviewNoticeAttachment={handlePreviewNoticeAttachment}
              />
            </div>
          )}

          {currentTab === 'group_study' && (
            <GroupStudyModal
              isOpen={true}
              isView={true}
              studentProfile={studentProfile}
            />
          )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar (hidden in AI Focus Mode) */}
      {!isAiFocusMode && (
      <div
        data-no-translate
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#060e20]/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-cyan-500/25 shadow-[0_-8px_30px_rgba(3,7,18,0.12)] dark:shadow-[0_-8px_30px_rgba(3,7,18,0.65)] flex items-center justify-around py-2 px-1"
      >
        {[
          { id: 'overview' as ViewTab, label: isEn ? 'Overview' : 'Tổng quan', icon: LayoutDashboard },
          { id: 'vnedu' as any, label: 'VNEDU', icon: Globe, isExternal: true },
          { id: 'exams' as ViewTab, label: isEn ? 'Exams' : 'Thi cử', icon: FileCheck2 },
          { id: 'calendar' as ViewTab, label: isEn ? 'Calendar' : 'Lịch học', icon: CalendarDays },
          { id: 'tasks' as ViewTab, label: isEn ? 'Tasks' : 'Bài tập', icon: CheckSquare, badge: pendingTasksCount > 0 ? pendingTasksCount : undefined },
          { id: 'notices' as ViewTab, label: isEn ? 'Notices' : 'Bảng tin', icon: MessageCircle, badge: unreadNoticeCount > 0 ? unreadNoticeCount : undefined },
          { id: 'library' as ViewTab, label: isEn ? 'Library' : 'Thư viện', icon: BookOpen }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              data-sound="nav"
              onClick={() => {
                if (tab.isExternal) {
                  window.open('https://user.vnedu.vn/sso//?use_cache=0&continue=tracuu.vnedu.vn/kqht/', '_blank', 'noopener,noreferrer');
                } else {
                  handleSelectTab(tab.id as ViewTab);
                }
              }}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl text-[10px] font-semibold relative transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'text-blue-600 dark:text-cyan-300 font-extrabold dark:drop-shadow-[0_0_8px_rgba(34,211,238,0.65)] bg-blue-50/80 dark:bg-cyan-500/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-cyan-200'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${tab.isExternal ? 'text-blue-500 dark:text-cyan-400' : ''}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="absolute -top-0.5 right-1 w-4 h-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[9px] flex items-center justify-center font-bold tabular-nums shadow-xs">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      )}

      {/* Modals */}
      {isTeacherLoginModalOpen && (
        <Suspense fallback={null}>
          <TeacherLoginModal
            isOpen={isTeacherLoginModalOpen}
            onClose={() => setIsTeacherLoginModalOpen(false)}
            profile={teacherProfile}
            noticeMessage={loginNoticeMessage}
            onLoginSuccess={handleTeacherLoginSuccess}
          />
        </Suspense>
      )}
      {isStudentProfileModalOpen && (
        <Suspense fallback={null}>
          <StudentProfileModal
            isOpen={isStudentProfileModalOpen}
            onClose={() => setIsStudentProfileModalOpen(false)}
            profile={studentProfile}
            onSaveProfile={handleSaveStudentProfile}
          />
        </Suspense>
      )}
      {isJoinClassModalOpen && (
        <Suspense fallback={null}>
          <JoinClassModal
            isOpen={isJoinClassModalOpen}
            onClose={() => setIsJoinClassModalOpen(false)}
            availableClasses={teacherClasses}
            onSendJoinRequest={handleSendJoinRequest}
          />
        </Suspense>
      )}
      {isCopyrightOpen && (
        <Suspense fallback={null}>
          <CopyrightModal
            isOpen={isCopyrightOpen}
            onClose={() => setIsCopyrightOpen(false)}
            events={events}
            tasks={tasks}
            library={library}
            sessions={sessions}
            countdowns={countdowns}
            exams={exams}
            onRestoreData={handleRestoreData}
            onResetToDefault={handleResetToDefault}
          />
        </Suspense>
      )}

      {previewNoticeDoc && (
        <Suspense fallback={null}>
          <DocumentViewerModal item={previewNoticeDoc} onClose={() => setPreviewNoticeDoc(null)} />
        </Suspense>
      )}

      {/* Floating Chatbot Assistant (deferred after first paint & hidden in AI Focus Mode) */}
      {!isAiFocusMode && isFloatingChatReady && (
        <Suspense fallback={null}>
          <ChatGptMiniBubble studentName={studentProfile.name} />
        </Suspense>
      )}

      {/* Toast Notification / Deadline Alert */}
      {toastMessage && (
        <div className={`fixed bottom-20 md:bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 w-full max-w-[320px] sm:max-w-md px-4`}>
          {isDeadlineToast ? (
            <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-2xl shadow-2xl p-4 flex gap-4 items-start ring-4 ring-amber-500/10">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 animate-bounce">
                <BellRing className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">Cảnh báo Deadline</h4>
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {toastMessage}
                </div>
              </div>
              <button 
                onClick={() => setToastMessage(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="mx-auto w-fit px-6 py-3 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-bold rounded-2xl shadow-xl border border-slate-700 dark:border-slate-200 flex items-center gap-3 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>{toastMessage}</span>
            </div>
          )}
        </div>
      )}
      </div>
    </MotionConfig>
  );
}

