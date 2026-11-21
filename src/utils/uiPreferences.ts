import { TeacherTab, ViewTab } from '../types';

export const UI_PREFERENCES_STORAGE_KEY = 'ui_preferences';

export type FlashcardSubTab = 'hub' | 'flashcards' | 'learn' | 'test' | 'edit' | 'import' | 'match' | 'live';
export type FlashcardCategoryFilter = 'created' | 'studying' | 'starred';
export type FlashcardSubjectFilter = 'all' | 'Tiếng Anh' | 'Toán' | 'Sinh Học';
export type AIHubMode = 'mental' | 'mental2' | 'summary' | 'quiz' | 'calendar';

export interface TeacherUiPreferences {
  activeTab: TeacherTab;
  sidebarCollapsed: boolean;
  examsSelectedFolder: string | null;
  materialsSelectedSubject: string;
  materialsScope?: 'all' | 'private' | 'shared';
  noticesFilterType: 'all' | 'pinned';
  tasksViewMode: 'matrix' | 'list';
  tasksActiveSubject: string;
  tasksSortMode: 'deadline-smart' | 'auto' | 'manual';
  tasksFilterPriority: string;
  tasksRoadmapExpanded: boolean;
  examsSortOrder: 'newest' | 'oldest';
}

export interface StudentUiPreferences {
  activeTab: ViewTab;
  sidebarCollapsed: boolean;
  sidebarToolsOpen: boolean;
  sidebarGoalExpanded: boolean;
  sidebarTipsExpanded: boolean;
  calendarViewMode: 'week' | 'month' | 'list';
  tasksViewMode: 'matrix' | 'list';
  tasksActiveSubject: string;
  tasksSortMode: 'deadline-smart' | 'auto' | 'manual';
  tasksFilterPriority: string;
  tasksRoadmapExpanded: boolean;
  examsSelectedFolder: string | null;
  examsSortOrder: 'newest' | 'oldest';
  examsFilterMode: 'all' | 'starred' | 'todo' | 'done' | 'history';
  examsPrioritizeStarred: boolean;
  examsStarredIds: number[];
  librarySelectedSubject: string;
  noticesFilterType: 'all' | 'pinned';
  flashcardsViewMode: 'catalog' | 'study';
  flashcardsActiveDeckId: string | null;
  flashcardsActiveSubTab: FlashcardSubTab;
  flashcardsCategoryFilter: FlashcardCategoryFilter;
  flashcardsSubjectFilter: FlashcardSubjectFilter;
  aiHubMode: AIHubMode;
  overviewEmotionChartExpanded: boolean;
  overviewGoalsFlipped: boolean;
}

export interface UiPreferences {
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  teacher: TeacherUiPreferences;
  student: StudentUiPreferences;
}

const VALID_TEACHER_TABS: TeacherTab[] = [
  'overview',
  'classes',
  'timetable',
  'materials',
  'ai_material',
  'exams',
  'assign',
  'notices',
  'ai_assistant',
  'settings'
];

const VALID_STUDENT_TABS: ViewTab[] = [
  'overview',
  'exams',
  'calendar',
  'tasks',
  'stats',
  'focus',
  'library',
  'notices',
  'flashcards',
  'ai_studio',
  'group_study'
];

const detectInitialTheme = (): 'light' | 'dark' => {
  try {
    const legacy = localStorage.getItem('studyflow_theme') || localStorage.getItem('sf-theme');
    if (legacy === 'dark' || legacy === 'light') return legacy;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore
  }
  return 'light';
};

export const getDefaultUiPreferences = (): UiPreferences => ({
  theme: detectInitialTheme(),
  soundEnabled: true,
  hapticsEnabled: true,
  teacher: {
    activeTab: 'overview',
    sidebarCollapsed: false,
    examsSelectedFolder: null,
    materialsSelectedSubject: 'Tất cả',
    materialsScope: 'all',
    noticesFilterType: 'all',
    tasksViewMode: 'matrix',
    tasksActiveSubject: 'all',
    tasksSortMode: 'auto',
    tasksFilterPriority: 'all',
    tasksRoadmapExpanded: true,
    examsSortOrder: 'newest'
  },
  student: {
    activeTab: 'overview',
    sidebarCollapsed: false,
    sidebarToolsOpen: false,
    sidebarGoalExpanded: false,
    sidebarTipsExpanded: false,
    calendarViewMode: 'week',
    tasksViewMode: 'matrix',
    tasksActiveSubject: 'all',
    tasksSortMode: 'auto',
    tasksFilterPriority: 'all',
    tasksRoadmapExpanded: true,
    examsSelectedFolder: null,
    examsSortOrder: 'newest',
    examsFilterMode: 'all',
    examsPrioritizeStarred: false,
    examsStarredIds: [],
    librarySelectedSubject: 'Tất cả',
    noticesFilterType: 'all',
    flashcardsViewMode: 'catalog',
    flashcardsActiveDeckId: null,
    flashcardsActiveSubTab: 'hub',
    flashcardsCategoryFilter: 'created',
    flashcardsSubjectFilter: 'all',
    aiHubMode: 'mental',
    overviewEmotionChartExpanded: false,
    overviewGoalsFlipped: false
  }
});

export const loadUiPreferences = (): UiPreferences => {
  const defaults = getDefaultUiPreferences();
  try {
    const raw = localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (!raw || raw === 'null' || raw === 'undefined') {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return defaults;
    }

    const teacherRaw = parsed.teacher && typeof parsed.teacher === 'object' ? parsed.teacher : {};
    const studentRaw = parsed.student && typeof parsed.student === 'object' ? parsed.student : {};

    const merged: UiPreferences = {
      theme: parsed.theme === 'dark' || parsed.theme === 'light' ? parsed.theme : defaults.theme,
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : defaults.soundEnabled,
      hapticsEnabled: typeof parsed.hapticsEnabled === 'boolean' ? parsed.hapticsEnabled : defaults.hapticsEnabled,
      teacher: {
        ...defaults.teacher,
        ...teacherRaw,
        activeTab: VALID_TEACHER_TABS.includes(teacherRaw.activeTab) ? teacherRaw.activeTab : defaults.teacher.activeTab,
        sidebarCollapsed: typeof teacherRaw.sidebarCollapsed === 'boolean' ? teacherRaw.sidebarCollapsed : defaults.teacher.sidebarCollapsed,
        noticesFilterType: teacherRaw.noticesFilterType === 'pinned' ? 'pinned' : 'all',
        tasksViewMode: teacherRaw.tasksViewMode === 'list' ? 'list' : 'matrix',
        tasksSortMode: ['deadline-smart', 'auto', 'manual'].includes(teacherRaw.tasksSortMode)
          ? teacherRaw.tasksSortMode
          : defaults.teacher.tasksSortMode,
        tasksRoadmapExpanded: typeof teacherRaw.tasksRoadmapExpanded === 'boolean'
          ? teacherRaw.tasksRoadmapExpanded
          : defaults.teacher.tasksRoadmapExpanded,
        examsSortOrder: teacherRaw.examsSortOrder === 'oldest' ? 'oldest' : 'newest',
        materialsScope: ['all', 'private', 'shared'].includes(teacherRaw.materialsScope)
          ? teacherRaw.materialsScope
          : defaults.teacher.materialsScope
      },
      student: {
        ...defaults.student,
        ...studentRaw,
        activeTab: VALID_STUDENT_TABS.includes(studentRaw.activeTab) ? studentRaw.activeTab : defaults.student.activeTab,
        sidebarCollapsed: typeof studentRaw.sidebarCollapsed === 'boolean' ? studentRaw.sidebarCollapsed : defaults.student.sidebarCollapsed,
        sidebarToolsOpen: typeof studentRaw.sidebarToolsOpen === 'boolean' ? studentRaw.sidebarToolsOpen : defaults.student.sidebarToolsOpen,
        sidebarGoalExpanded: typeof studentRaw.sidebarGoalExpanded === 'boolean' ? studentRaw.sidebarGoalExpanded : defaults.student.sidebarGoalExpanded,
        sidebarTipsExpanded: typeof studentRaw.sidebarTipsExpanded === 'boolean' ? studentRaw.sidebarTipsExpanded : defaults.student.sidebarTipsExpanded,
        calendarViewMode: ['week', 'month', 'list'].includes(studentRaw.calendarViewMode) ? studentRaw.calendarViewMode : defaults.student.calendarViewMode,
        tasksViewMode: studentRaw.tasksViewMode === 'list' ? 'list' : 'matrix',
        tasksSortMode: ['deadline-smart', 'auto', 'manual'].includes(studentRaw.tasksSortMode)
          ? studentRaw.tasksSortMode
          : defaults.student.tasksSortMode,
        tasksRoadmapExpanded: typeof studentRaw.tasksRoadmapExpanded === 'boolean'
          ? studentRaw.tasksRoadmapExpanded
          : defaults.student.tasksRoadmapExpanded,
        examsSortOrder: studentRaw.examsSortOrder === 'oldest' ? 'oldest' : 'newest',
        examsFilterMode: ['all', 'starred', 'todo', 'done', 'history'].includes(studentRaw.examsFilterMode)
          ? studentRaw.examsFilterMode
          : defaults.student.examsFilterMode,
        examsPrioritizeStarred: typeof studentRaw.examsPrioritizeStarred === 'boolean'
          ? studentRaw.examsPrioritizeStarred
          : defaults.student.examsPrioritizeStarred,
        examsStarredIds: Array.isArray(studentRaw.examsStarredIds)
          ? studentRaw.examsStarredIds.filter((id: unknown) => typeof id === 'number')
          : defaults.student.examsStarredIds,
        noticesFilterType: studentRaw.noticesFilterType === 'pinned' ? 'pinned' : 'all',
        flashcardsViewMode: studentRaw.flashcardsViewMode === 'study' ? 'study' : 'catalog',
        flashcardsActiveSubTab: ['hub', 'flashcards', 'learn', 'test', 'edit', 'import', 'match', 'live'].includes(studentRaw.flashcardsActiveSubTab)
          ? studentRaw.flashcardsActiveSubTab
          : defaults.student.flashcardsActiveSubTab,
        flashcardsCategoryFilter: ['created', 'studying', 'starred'].includes(studentRaw.flashcardsCategoryFilter)
          ? studentRaw.flashcardsCategoryFilter
          : defaults.student.flashcardsCategoryFilter,
        flashcardsSubjectFilter: ['all', 'Tiếng Anh', 'Toán', 'Sinh Học'].includes(studentRaw.flashcardsSubjectFilter)
          ? studentRaw.flashcardsSubjectFilter
          : defaults.student.flashcardsSubjectFilter,
        aiHubMode: ['mental', 'mental2', 'summary', 'quiz', 'calendar'].includes(studentRaw.aiHubMode)
          ? studentRaw.aiHubMode
          : defaults.student.aiHubMode,
        overviewEmotionChartExpanded: typeof studentRaw.overviewEmotionChartExpanded === 'boolean'
          ? studentRaw.overviewEmotionChartExpanded
          : defaults.student.overviewEmotionChartExpanded,
        overviewGoalsFlipped: typeof studentRaw.overviewGoalsFlipped === 'boolean'
          ? studentRaw.overviewGoalsFlipped
          : defaults.student.overviewGoalsFlipped
      }
    };

    return merged;
  } catch {
    return defaults;
  }
};

export const saveUiPreferences = (prefs: UiPreferences): void => {
  try {
    localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studyflow_ui_preferences_updated', { detail: prefs }));
    }
  } catch {
    // ignore storage quota or private mode errors
  }
};

export const updateUiPreferences = (
  updater: (current: UiPreferences) => UiPreferences
): UiPreferences => {
  const current = loadUiPreferences();
  const next = updater(current);
  saveUiPreferences(next);
  return next;
};

export const updateTeacherUiPreferences = (
  patch: Partial<TeacherUiPreferences>
): UiPreferences => {
  return updateUiPreferences((current) => ({
    ...current,
    teacher: {
      ...current.teacher,
      ...patch
    }
  }));
};

export const updateStudentUiPreferences = (
  patch: Partial<StudentUiPreferences>
): UiPreferences => {
  return updateUiPreferences((current) => ({
    ...current,
    student: {
      ...current.student,
      ...patch
    }
  }));
};
