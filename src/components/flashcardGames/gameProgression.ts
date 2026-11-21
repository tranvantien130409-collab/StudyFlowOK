export type FlashcardGameId =
  | 'blocks'
  | 'blast'
  | 'charms'
  | 'match'
  | 'classic_live'
  | 'blast_arena'
  | 'multiplayer_match';

export interface GameSessionRecord {
  id: string;
  gameId: FlashcardGameId;
  gameTitle: string;
  deckTitle: string;
  score: number;
  xpEarned: number;
  accuracy: number;
  maxCombo: number;
  durationSec: number;
  won: boolean;
  timestamp: string;
}

export interface GameProgressionState {
  xp: number;
  xpToday: number;
  streakDays: number;
  lastPlayedDate: string | null;
  lastDailyResetDate: string;
  gamesPlayedTotal: number;
  gamesPlayedToday: number;
  playedGameIdsAllTime: FlashcardGameId[];
  playedGameIdsToday: FlashcardGameId[];
  bestMatchTime: number | null;
  bestBlocksScore: number;
  bestBlastScore: number;
  bestCharmsScore: number;
  bestLiveScore: number;
  maxComboStreak: number;
  winsCount: number;
  claimedDailyChallengeIds: string[];
  unlockedBadgeIds: string[];
  recentSessions: GameSessionRecord[];
}

export interface VirtualBadge {
  id: string;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  rewardXp: number;
  iconKey: 'rocket' | 'zap' | 'blocks' | 'sparkles' | 'crown' | 'flame' | 'trophy' | 'compass';
  progressLabel: (s: GameProgressionState) => string;
  progressRatio: (s: GameProgressionState) => number;
  checkUnlocked: (s: GameProgressionState) => boolean;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  rewardXp: number;
  current: (s: GameProgressionState) => number;
  target: number;
}

export interface LeaderboardCompetitor {
  id: string;
  name: string;
  avatarText: string;
  schoolClass: string;
  xp: number;
  streakDays: number;
  bestMatchTime: number;
  badgesCount: number;
  isCurrentUser?: boolean;
}

const STORAGE_KEY = 'studyflow_flashcard_games_v1';

const getTodayKey = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getYesterdayKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const VIRTUAL_BADGES: VirtualBadge[] = [
  {
    id: 'first_spark',
    title: 'Tân binh Đấu trường',
    description: 'Hoàn thành ván game Flashcard đầu tiên.',
    tier: 'bronze',
    rewardXp: 50,
    iconKey: 'sparkles',
    progressLabel: (s) => `${Math.min(1, s.gamesPlayedTotal)}/1 ván`,
    progressRatio: (s) => Math.min(1, s.gamesPlayedTotal),
    checkUnlocked: (s) => s.gamesPlayedTotal >= 1
  },
  {
    id: 'speed_matcher',
    title: 'Thần tốc Ghép thẻ',
    description: 'Hoàn thành Match Solo với kỷ lục dưới 22 giây.',
    tier: 'gold',
    rewardXp: 100,
    iconKey: 'zap',
    progressLabel: (s) => (s.bestMatchTime !== null ? `Kỷ lục ${s.bestMatchTime.toFixed(1)}s` : 'Chưa có kỷ lục'),
    progressRatio: (s) => (s.bestMatchTime !== null && s.bestMatchTime <= 22 ? 1 : s.bestMatchTime ? 0.5 : 0),
    checkUnlocked: (s) => s.bestMatchTime !== null && s.bestMatchTime <= 22
  },
  {
    id: 'space_ace',
    title: 'Xạ thủ Không gian',
    description: 'Đạt từ 1.000 điểm trở lên trong chế độ Blast.',
    tier: 'silver',
    rewardXp: 120,
    iconKey: 'rocket',
    progressLabel: (s) => `${Math.min(1000, s.bestBlastScore).toLocaleString()} / 1.000 điểm`,
    progressRatio: (s) => Math.min(1, s.bestBlastScore / 1000),
    checkUnlocked: (s) => s.bestBlastScore >= 1000
  },
  {
    id: 'block_architect',
    title: 'Kiến trúc sư Blocks',
    description: 'Đạt từ 500 điểm trở lên khi xếp khối trong Blocks.',
    tier: 'silver',
    rewardXp: 120,
    iconKey: 'blocks',
    progressLabel: (s) => `${Math.min(500, s.bestBlocksScore).toLocaleString()} / 500 điểm`,
    progressRatio: (s) => Math.min(1, s.bestBlocksScore / 500),
    checkUnlocked: (s) => s.bestBlocksScore >= 500
  },
  {
    id: 'charm_alchemist',
    title: 'Bậc thầy Charms',
    description: 'Đạt từ 600 điểm trở lên trong trò chơi ghép 3 Charms.',
    tier: 'silver',
    rewardXp: 120,
    iconKey: 'trophy',
    progressLabel: (s) => `${Math.min(600, s.bestCharmsScore).toLocaleString()} / 600 điểm`,
    progressRatio: (s) => Math.min(1, s.bestCharmsScore / 600),
    checkUnlocked: (s) => s.bestCharmsScore >= 600
  },
  {
    id: 'combo_master',
    title: 'Chuỗi Bất bại',
    description: 'Đạt chuỗi 6 câu trả lời hoặc lượt ghép đúng liên tiếp.',
    tier: 'gold',
    rewardXp: 110,
    iconKey: 'flame',
    progressLabel: (s) => `${Math.min(6, s.maxComboStreak)} / 6 combo`,
    progressRatio: (s) => Math.min(1, s.maxComboStreak / 6),
    checkUnlocked: (s) => s.maxComboStreak >= 6
  },
  {
    id: 'live_champion',
    title: 'Quán quân Đấu trường',
    description: 'Giành hạng Nhất trong Classic Live, Blast Arena hoặc Multiplayer Match.',
    tier: 'gold',
    rewardXp: 150,
    iconKey: 'crown',
    progressLabel: (s) => `${Math.min(1, s.winsCount)} / 1 chiến thắng`,
    progressRatio: (s) => Math.min(1, s.winsCount),
    checkUnlocked: (s) => s.winsCount >= 1
  },
  {
    id: 'all_rounder',
    title: 'Nhà thám hiểm Đa năng',
    description: 'Trải nghiệm ít nhất 4 chế độ game Flashcard khác nhau.',
    tier: 'diamond',
    rewardXp: 160,
    iconKey: 'compass',
    progressLabel: (s) => `${Math.min(4, s.playedGameIdsAllTime.length)} / 4 game`,
    progressRatio: (s) => Math.min(1, s.playedGameIdsAllTime.length / 4),
    checkUnlocked: (s) => s.playedGameIdsAllTime.length >= 4
  }
];

export const DAILY_CHALLENGES: DailyChallenge[] = [
  {
    id: 'daily_warmup',
    title: 'Khởi động trí nhớ',
    description: 'Hoàn thành 2 ván game bất kỳ trong ngày hôm nay',
    rewardXp: 60,
    current: (s) => s.gamesPlayedToday,
    target: 2
  },
  {
    id: 'daily_variety',
    title: 'Đa dạng phương pháp học',
    description: 'Trải nghiệm ít nhất 2 thể loại game khác nhau hôm nay',
    rewardXp: 80,
    current: (s) => s.playedGameIdsToday.length,
    target: 2
  },
  {
    id: 'daily_combo',
    title: 'Tập trung cao độ',
    description: 'Đạt chuỗi combo từ 4 trở lên trong một ván chơi',
    rewardXp: 90,
    current: (s) => s.maxComboStreak,
    target: 4
  },
  {
    id: 'daily_xp_hunter',
    title: 'Chinh phục mục tiêu XP',
    description: 'Tích lũy tổng cộng 180 XP từ các game trong hôm nay',
    rewardXp: 100,
    current: (s) => s.xpToday,
    target: 180
  }
];

export const getLevelFromXp = (xp: number) => {
  const safeXp = Math.max(0, xp);
  const xpPerLevel = 250;
  const level = Math.floor(safeXp / xpPerLevel) + 1;
  const currentLevelXp = safeXp % xpPerLevel;
  const progressPercent = Math.round((currentLevelXp / xpPerLevel) * 100);
  const titles = [
    'Người khám phá',
    'Chiến binh Ghi nhớ',
    'Học giả Tốc độ',
    'Cao thủ Tư duy',
    'Bậc thầy Đấu trường',
    'Huyền thoại StudyFlow'
  ];
  const rankTitle = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 2))];
  return { level, currentLevelXp, xpPerLevel, progressPercent, rankTitle };
};

export function createInitialProgressionState(): GameProgressionState {
  return {
    xp: 120,
    xpToday: 0,
    streakDays: 1,
    lastPlayedDate: null,
    lastDailyResetDate: getTodayKey(),
    gamesPlayedTotal: 0,
    gamesPlayedToday: 0,
    playedGameIdsAllTime: [],
    playedGameIdsToday: [],
    bestMatchTime: 18.4,
    bestBlocksScore: 0,
    bestBlastScore: 0,
    bestCharmsScore: 0,
    bestLiveScore: 0,
    maxComboStreak: 0,
    winsCount: 0,
    claimedDailyChallengeIds: [],
    unlockedBadgeIds: [],
    recentSessions: []
  };
}

export function loadGameProgression(): GameProgressionState {
  const today = getTodayKey();
  const base = createInitialProgressionState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<GameProgressionState>;
    const merged: GameProgressionState = {
      ...base,
      ...parsed,
      playedGameIdsAllTime: Array.isArray(parsed.playedGameIdsAllTime) ? parsed.playedGameIdsAllTime : [],
      playedGameIdsToday: Array.isArray(parsed.playedGameIdsToday) ? parsed.playedGameIdsToday : [],
      claimedDailyChallengeIds: Array.isArray(parsed.claimedDailyChallengeIds) ? parsed.claimedDailyChallengeIds : [],
      unlockedBadgeIds: Array.isArray(parsed.unlockedBadgeIds) ? parsed.unlockedBadgeIds : [],
      recentSessions: Array.isArray(parsed.recentSessions) ? parsed.recentSessions : []
    };

    if (merged.lastDailyResetDate !== today) {
      merged.xpToday = 0;
      merged.gamesPlayedToday = 0;
      merged.playedGameIdsToday = [];
      merged.claimedDailyChallengeIds = [];
      merged.lastDailyResetDate = today;
      saveGameProgression(merged);
    }
    return merged;
  } catch {
    return base;
  }
}

export function saveGameProgression(state: GameProgressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studyflow_game_progression_updated', { detail: state }));
    }
  } catch {
    // ignore storage limits
  }
}

export interface RecordGameResultInput {
  gameId: FlashcardGameId;
  gameTitle: string;
  deckTitle: string;
  score: number;
  accuracy: number;
  maxCombo: number;
  durationSec: number;
  won: boolean;
  matchTimeSec?: number;
}

export function recordGameCompletion(
  prev: GameProgressionState,
  input: RecordGameResultInput
): {
  nextState: GameProgressionState;
  xpEarned: number;
  newlyUnlockedBadges: VirtualBadge[];
} {
  const today = getTodayKey();
  const yesterday = getYesterdayKey();

  const isSameReset = prev.lastDailyResetDate === today;
  const baseXpToday = isSameReset ? prev.xpToday : 0;
  const baseGamesToday = isSameReset ? prev.gamesPlayedToday : 0;
  const basePlayedToday = isSameReset ? prev.playedGameIdsToday : [];
  const baseClaimed = isSameReset ? prev.claimedDailyChallengeIds : [];

  // Calculate meaningful XP reward
  const scoreBonus = Math.min(120, Math.round(input.score / 18));
  const accuracyBonus = Math.round((input.accuracy / 100) * 35);
  const comboBonus = Math.min(40, input.maxCombo * 5);
  const winBonus = input.won ? 45 : 15;
  const sessionXp = Math.max(25, scoreBonus + accuracyBonus + comboBonus + winBonus);

  // Update streak days
  let nextStreak = prev.streakDays || 1;
  if (prev.lastPlayedDate && prev.lastPlayedDate !== today) {
    nextStreak = prev.lastPlayedDate === yesterday ? nextStreak + 1 : 1;
  } else if (!prev.lastPlayedDate) {
    nextStreak = 1;
  }

  const nextPlayedAll = prev.playedGameIdsAllTime.includes(input.gameId)
    ? prev.playedGameIdsAllTime
    : [...prev.playedGameIdsAllTime, input.gameId];

  const nextPlayedToday = basePlayedToday.includes(input.gameId)
    ? basePlayedToday
    : [...basePlayedToday, input.gameId];

  const isCompetitiveWin =
    input.won && (input.gameId === 'classic_live' || input.gameId === 'blast_arena' || input.gameId === 'multiplayer_match');

  const candidate: GameProgressionState = {
    ...prev,
    xp: prev.xp + sessionXp,
    xpToday: baseXpToday + sessionXp,
    streakDays: nextStreak,
    lastPlayedDate: today,
    lastDailyResetDate: today,
    gamesPlayedTotal: prev.gamesPlayedTotal + 1,
    gamesPlayedToday: baseGamesToday + 1,
    playedGameIdsAllTime: nextPlayedAll,
    playedGameIdsToday: nextPlayedToday,
    bestMatchTime:
      typeof input.matchTimeSec === 'number'
        ? prev.bestMatchTime === null
          ? input.matchTimeSec
          : Math.min(prev.bestMatchTime, input.matchTimeSec)
        : prev.bestMatchTime,
    bestBlocksScore: input.gameId === 'blocks' ? Math.max(prev.bestBlocksScore, input.score) : prev.bestBlocksScore,
    bestBlastScore:
      input.gameId === 'blast' || input.gameId === 'blast_arena'
        ? Math.max(prev.bestBlastScore, input.score)
        : prev.bestBlastScore,
    bestCharmsScore: input.gameId === 'charms' ? Math.max(prev.bestCharmsScore, input.score) : prev.bestCharmsScore,
    bestLiveScore:
      input.gameId === 'classic_live' || input.gameId === 'blast_arena' || input.gameId === 'multiplayer_match'
        ? Math.max(prev.bestLiveScore, input.score)
        : prev.bestLiveScore,
    maxComboStreak: Math.max(prev.maxComboStreak, input.maxCombo),
    winsCount: prev.winsCount + (isCompetitiveWin ? 1 : 0),
    claimedDailyChallengeIds: baseClaimed,
    recentSessions: [
      {
        id: `gs_${Date.now()}`,
        gameId: input.gameId,
        gameTitle: input.gameTitle,
        deckTitle: input.deckTitle,
        score: input.score,
        xpEarned: sessionXp,
        accuracy: input.accuracy,
        maxCombo: input.maxCombo,
        durationSec: input.durationSec,
        won: input.won,
        timestamp: new Date().toISOString()
      },
      ...prev.recentSessions
    ].slice(0, 12)
  };

  // Unlock newly earned virtual badges & award badge XP
  const newlyUnlockedBadges: VirtualBadge[] = [];
  let badgeBonusXp = 0;
  const nextUnlockedIds = [...prev.unlockedBadgeIds];

  for (const badge of VIRTUAL_BADGES) {
    if (!nextUnlockedIds.includes(badge.id) && badge.checkUnlocked(candidate)) {
      nextUnlockedIds.push(badge.id);
      newlyUnlockedBadges.push(badge);
      badgeBonusXp += badge.rewardXp;
    }
  }

  const finalState: GameProgressionState = {
    ...candidate,
    xp: candidate.xp + badgeBonusXp,
    xpToday: candidate.xpToday + badgeBonusXp,
    unlockedBadgeIds: nextUnlockedIds
  };

  saveGameProgression(finalState);
  return {
    nextState: finalState,
    xpEarned: sessionXp + badgeBonusXp,
    newlyUnlockedBadges
  };
}

export function claimChallengeReward(
  prev: GameProgressionState,
  challengeId: string
): GameProgressionState {
  const challenge = DAILY_CHALLENGES.find((c) => c.id === challengeId);
  if (!challenge) return prev;
  if (prev.claimedDailyChallengeIds.includes(challengeId)) return prev;
  if (challenge.current(prev) < challenge.target) return prev;

  const next: GameProgressionState = {
    ...prev,
    xp: prev.xp + challenge.rewardXp,
    xpToday: prev.xpToday + challenge.rewardXp,
    claimedDailyChallengeIds: [...prev.claimedDailyChallengeIds, challengeId]
  };
  saveGameProgression(next);
  return next;
}

const PEER_COMPETITORS: LeaderboardCompetitor[] = [
  { id: 'c_1', name: 'Nguyễn Minh Anh', avatarText: 'MA', schoolClass: '10A1 · Hà Nội', xp: 1480, streakDays: 12, bestMatchTime: 13.8, badgesCount: 7 },
  { id: 'c_2', name: 'Trần Hoàng Long', avatarText: 'HL', schoolClass: '10A3 · Đà Nẵng', xp: 1120, streakDays: 9, bestMatchTime: 15.4, badgesCount: 6 },
  { id: 'c_3', name: 'Lê Bảo Trâm', avatarText: 'BT', schoolClass: '10A2 · TP.HCM', xp: 890, streakDays: 7, bestMatchTime: 16.9, badgesCount: 5 },
  { id: 'c_4', name: 'Phạm Đức Thắng', avatarText: 'ĐT', schoolClass: '11A1 · Hải Phòng', xp: 640, streakDays: 5, bestMatchTime: 19.2, badgesCount: 4 },
  { id: 'c_5', name: 'Vũ Khánh Linh', avatarText: 'KL', schoolClass: '10A4 · Cần Thơ', xp: 450, streakDays: 4, bestMatchTime: 21.6, badgesCount: 3 },
  { id: 'c_6', name: 'Đặng Gia Huy', avatarText: 'GH', schoolClass: '10A1 · Huế', xp: 280, streakDays: 2, bestMatchTime: 24.5, badgesCount: 2 }
];

export function buildLeaderboard(
  progression: GameProgressionState,
  studentName: string | undefined,
  sortBy: 'xp' | 'speed' = 'xp'
): LeaderboardCompetitor[] {
  const displayName = (studentName || 'Bạn').trim() || 'Bạn';
  const initials = displayName
    .split(/\s+/)
    .slice(-2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'BN';

  const me: LeaderboardCompetitor = {
    id: 'current_user',
    name: `${displayName} (Bạn)`,
    avatarText: initials,
    schoolClass: 'Học viên StudyFlow',
    xp: progression.xp,
    streakDays: progression.streakDays,
    bestMatchTime: progression.bestMatchTime ?? 99.9,
    badgesCount: progression.unlockedBadgeIds.length,
    isCurrentUser: true
  };

  const all = [me, ...PEER_COMPETITORS];
  if (sortBy === 'speed') {
    return all.sort((a, b) => a.bestMatchTime - b.bestMatchTime);
  }
  return all.sort((a, b) => b.xp - a.xp);
}
