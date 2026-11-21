import { StudentProfile, TaskItem } from '../types';
import {
  GameProgressionState,
  getLevelFromXp,
  loadGameProgression
} from '../components/flashcardGames/gameProgression';

export const TASK_XP_VALUE = 25;

export type LeaderboardSortBy = 'total' | 'tasks' | 'games';

export interface StudentLeaderboardEntry {
  id: string;
  name: string;
  avatarText: string;
  className: string;
  tasksCompleted: number;
  taskXp: number;
  flashcardGamesPlayed: number;
  flashcardXp: number;
  totalXp: number;
  streakDays: number;
  badgesCount: number;
  level: number;
  rankTitle: string;
  isCurrentUser?: boolean;
}

export interface StudentLeaderboardSummary {
  entries: StudentLeaderboardEntry[];
  currentUserEntry: StudentLeaderboardEntry;
  currentUserRank: number;
  nextPeerAbove: StudentLeaderboardEntry | null;
  xpToNextRank: number;
  totalStudents: number;
}

interface PeerSeed {
  id: string;
  name: string;
  avatarText: string;
  className: string;
  tasksCompleted: number;
  flashcardGamesPlayed: number;
  flashcardXp: number;
  streakDays: number;
  badgesCount: number;
}

const PEER_SEEDS: PeerSeed[] = [
  {
    id: 'peer_1',
    name: 'Nguyễn Minh Anh',
    avatarText: 'MA',
    className: '12A1 · Hà Nội',
    tasksCompleted: 26,
    flashcardGamesPlayed: 22,
    flashcardXp: 1480,
    streakDays: 12,
    badgesCount: 7
  },
  {
    id: 'peer_2',
    name: 'Trần Hoàng Long',
    avatarText: 'HL',
    className: '12A3 · Đà Nẵng',
    tasksCompleted: 21,
    flashcardGamesPlayed: 17,
    flashcardXp: 1120,
    streakDays: 9,
    badgesCount: 6
  },
  {
    id: 'peer_3',
    name: 'Lê Bảo Trâm',
    avatarText: 'BT',
    className: '12A2 · TP.HCM',
    tasksCompleted: 18,
    flashcardGamesPlayed: 14,
    flashcardXp: 890,
    streakDays: 7,
    badgesCount: 5
  },
  {
    id: 'peer_4',
    name: 'Phạm Đức Thắng',
    avatarText: 'ĐT',
    className: '11A1 · Hải Phòng',
    tasksCompleted: 14,
    flashcardGamesPlayed: 11,
    flashcardXp: 640,
    streakDays: 5,
    badgesCount: 4
  },
  {
    id: 'peer_5',
    name: 'Vũ Khánh Linh',
    avatarText: 'KL',
    className: '12A4 · Cần Thơ',
    tasksCompleted: 10,
    flashcardGamesPlayed: 8,
    flashcardXp: 450,
    streakDays: 4,
    badgesCount: 3
  },
  {
    id: 'peer_6',
    name: 'Đặng Gia Huy',
    avatarText: 'GH',
    className: '12A1 · Huế',
    tasksCompleted: 7,
    flashcardGamesPlayed: 5,
    flashcardXp: 280,
    streakDays: 2,
    badgesCount: 2
  },
  {
    id: 'peer_7',
    name: 'Bùi Thảo Nhi',
    avatarText: 'TN',
    className: '11A2 · Nghệ An',
    tasksCompleted: 4,
    flashcardGamesPlayed: 3,
    flashcardXp: 160,
    streakDays: 2,
    badgesCount: 1
  },
  {
    id: 'peer_8',
    name: 'Ngô Quang Khải',
    avatarText: 'QK',
    className: '10A5 · Bình Dương',
    tasksCompleted: 2,
    flashcardGamesPlayed: 1,
    flashcardXp: 70,
    streakDays: 1,
    badgesCount: 1
  }
];

function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'HV';
  const parts = cleaned.split(/\s+/);
  const initials = parts
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return initials || 'HV';
}

export function buildStudentLeaderboard(params: {
  tasks: TaskItem[];
  studentProfile?: StudentProfile;
  progression?: GameProgressionState;
  sortBy?: LeaderboardSortBy;
}): StudentLeaderboardSummary {
  const {
    tasks,
    studentProfile,
    progression = loadGameProgression(),
    sortBy = 'total'
  } = params;

  const displayName = (studentProfile?.name || 'Bạn').trim() || 'Bạn';
  const classLabel = [studentProfile?.className, studentProfile?.schoolName]
    .filter((v) => Boolean(v && v.trim()))
    .join(' · ') || 'Học viên StudyFlow';

  const completedTasksCount = (tasks || []).filter((t) => Boolean(t && t.done)).length;
  const userTaskXp = completedTasksCount * TASK_XP_VALUE;
  const userFlashcardXp = Math.max(0, progression.xp || 0);
  const userTotalXp = userTaskXp + userFlashcardXp;
  const userLevel = getLevelFromXp(userTotalXp);

  const currentUserEntry: StudentLeaderboardEntry = {
    id: 'current_user',
    name: displayName,
    avatarText: getInitials(displayName),
    className: classLabel,
    tasksCompleted: completedTasksCount,
    taskXp: userTaskXp,
    flashcardGamesPlayed: progression.gamesPlayedTotal || 0,
    flashcardXp: userFlashcardXp,
    totalXp: userTotalXp,
    streakDays: progression.streakDays || 1,
    badgesCount: progression.unlockedBadgeIds?.length || 0,
    level: userLevel.level,
    rankTitle: userLevel.rankTitle,
    isCurrentUser: true
  };

  const peerEntries: StudentLeaderboardEntry[] = PEER_SEEDS.map((peer) => {
    const taskXp = peer.tasksCompleted * TASK_XP_VALUE;
    const totalXp = taskXp + peer.flashcardXp;
    const levelInfo = getLevelFromXp(totalXp);
    return {
      id: peer.id,
      name: peer.name,
      avatarText: peer.avatarText,
      className: peer.className,
      tasksCompleted: peer.tasksCompleted,
      taskXp,
      flashcardGamesPlayed: peer.flashcardGamesPlayed,
      flashcardXp: peer.flashcardXp,
      totalXp,
      streakDays: peer.streakDays,
      badgesCount: peer.badgesCount,
      level: levelInfo.level,
      rankTitle: levelInfo.rankTitle,
      isCurrentUser: false
    };
  });

  const metricForSort = (entry: StudentLeaderboardEntry): number => {
    if (sortBy === 'tasks') return entry.taskXp;
    if (sortBy === 'games') return entry.flashcardXp;
    return entry.totalXp;
  };

  const entries = [currentUserEntry, ...peerEntries].sort((a, b) => {
    const diff = metricForSort(b) - metricForSort(a);
    if (diff !== 0) return diff;
    if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
    if (a.isCurrentUser && !b.isCurrentUser) return -1;
    if (!a.isCurrentUser && b.isCurrentUser) return 1;
    return a.name.localeCompare(b.name, 'vi');
  });

  const userIndex = entries.findIndex((e) => e.isCurrentUser);
  const currentUserRank = userIndex >= 0 ? userIndex + 1 : entries.length;
  const nextPeerAbove = userIndex > 0 ? entries[userIndex - 1] : null;
  const xpToNextRank = nextPeerAbove
    ? Math.max(1, metricForSort(nextPeerAbove) - metricForSort(currentUserEntry) + 1)
    : 0;

  return {
    entries,
    currentUserEntry,
    currentUserRank,
    nextPeerAbove,
    xpToNextRank,
    totalStudents: entries.length
  };
}
