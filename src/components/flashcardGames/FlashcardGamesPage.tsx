import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Trophy,
  Flame,
  Sparkles,
  Crown,
  Zap,
  Rocket,
  Grid,
  Compass,
  Award,
  CheckCircle2,
  Lock,
  Gamepad2,
  X,
  ChevronRight,
  Users,
  Gift,
  Swords,
  History
} from 'lucide-react';
import { FlashcardDeck } from '../../types';
import {
  FlashcardGameId,
  GameProgressionState,
  VIRTUAL_BADGES,
  DAILY_CHALLENGES,
  VirtualBadge,
  loadGameProgression,
  recordGameCompletion,
  claimChallengeReward,
  buildLeaderboard,
  getLevelFromXp,
  RecordGameResultInput
} from './gameProgression';
import { playGameTone } from './gameSound';
import { MatchGame } from './MatchGame';
import { BlastGame } from './BlastGame';
import { BlocksGame } from './BlocksGame';
import { CharmsGame } from './CharmsGame';
import { ClassicLiveGame } from './ClassicLiveGame';

interface FlashcardGamesPageProps {
  deck: FlashcardDeck;
  allDecks: FlashcardDeck[];
  onSelectDeckId: (deckId: string) => void;
  studentName?: string;
  initialGameId?: FlashcardGameId | null;
  onBack: () => void;
}

type GamesSubPage = 'hub' | 'arena' | 'leaderboard' | 'challenges';
type GameFilter = 'all' | 'solo' | 'multiplayer';

interface GameCatalogMeta {
  id: FlashcardGameId;
  title: string;
  kicker: string;
  subtitle: string;
  group: 'solo' | 'multiplayer';
  ctaLabel: string;
  ctaGradient: string;
  howToPlayLabel?: string;
  rules: string[];
  xpNote: string;
}

const GAME_CATALOG: GameCatalogMeta[] = [
  {
    id: 'blocks',
    title: 'Blocks',
    kicker: 'Cá nhân · Xếp khối tư duy',
    subtitle: 'Đặt các khối lên bảng 8×8, trả lời câu hỏi để nhân điểm và xóa hàng lập kỷ lục.',
    group: 'solo',
    ctaLabel: 'Chơi ngay',
    ctaGradient:
      'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-md shadow-amber-500/25 hover:shadow-lg hover:shadow-amber-500/35',
    rules: [
      'Chọn 1 trong 3 khối hình ở khay bên phải và đặt vào các ô trống trên bảng 8×8.',
      'Lấp đầy 1 hàng ngang hoặc cột dọc để xóa khối và nhận +120 điểm mỗi hàng.',
      'Cứ sau 3 lượt đặt khối, trả lời đúng câu hỏi Flashcard để nhân đôi điểm (x2) và nhận thêm khối 1×1.'
    ],
    xpNote: '+35 đến +160 XP mỗi ván'
  },
  {
    id: 'blast',
    title: 'Blast',
    kicker: 'Cá nhân · Bắn thiên thạch',
    subtitle: 'Bắn hạ các thiên thạch mang định nghĩa chính xác trước khi hết thời gian.',
    group: 'solo',
    ctaLabel: 'Chơi ngay',
    ctaGradient:
      'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-violet-500/35',
    rules: [
      'Đọc thuật ngữ mục tiêu ở thanh phía trên vũ trụ.',
      'Nhấp chọn thiên thạch chứa định nghĩa đúng để phi thuyền khai hỏa tia laser phá hủy.',
      'Giữ chuỗi bắn trúng liên tiếp để tăng Combo; bắn nhầm sẽ làm giảm 1 điểm giáp.'
    ],
    xpNote: '+40 đến +180 XP mỗi ván'
  },
  {
    id: 'charms',
    title: 'Charms',
    kicker: 'Cá nhân · Ghép 3 sắc màu',
    subtitle: 'Trả lời câu hỏi để kiếm lượt đi, ghép 3 biểu tượng sắc màu và chinh phục điểm cao.',
    group: 'solo',
    ctaLabel: 'Chơi ngay',
    ctaGradient:
      'bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/25 hover:shadow-lg hover:shadow-cyan-500/35',
    rules: [
      'Bạn khởi đầu với 5 lượt đi trên bảng 6×6 các biểu tượng ngọc sắc màu.',
      'Hoán đổi 2 viên kề nhau để tạo hàng ngang hoặc dọc có từ 3 biểu tượng giống nhau trở lên.',
      'Trả lời đúng câu hỏi Flashcard ở bảng bên phải bất kỳ lúc nào để nhận ngay +3 lượt đi.'
    ],
    xpNote: '+35 đến +170 XP mỗi ván'
  },
  {
    id: 'match',
    title: 'Match',
    kicker: 'Cá nhân · Ghép thẻ tốc độ',
    subtitle: 'Ghép toàn bộ thuật ngữ với định nghĩa tương ứng nhanh nhất có thể.',
    group: 'solo',
    ctaLabel: 'Chơi ngay',
    ctaGradient:
      'bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-600 text-white shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-pink-500/35',
    rules: [
      'Chọn cặp thẻ Thuật ngữ và Định nghĩa khớp nhau để xóa khỏi bảng.',
      'Ghép liên tiếp không sai sót để kích hoạt hệ số Combo tăng điểm nhanh.',
      'Chọn nhầm cặp sẽ bị cộng phạt +1.0 giây vào đồng hồ kỷ lục.'
    ],
    xpNote: '+45 đến +180 XP + Thưởng kỷ lục'
  },
  {
    id: 'classic_live',
    title: 'Classic Live',
    kicker: 'Đối kháng 4P · Đường đua',
    subtitle: 'Trả lời đúng 12 câu hỏi liên tiếp trên đường đua trước các đối thủ.',
    group: 'multiplayer',
    ctaLabel: 'Vào đấu trường',
    ctaGradient:
      'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-indigo-500/35',
    howToPlayLabel: 'How to play Live',
    rules: [
      '4 thí sinh cùng xuất phát trên 4 làn đua màu sắc tiến về mốc 12/12.',
      'Mỗi câu trả lời đúng giúp bạn tiến 1 bước về đích trước thời gian đếm ngược kết thúc.',
      'Trả lời sai sẽ bị lùi 1 bước — giữ vững tốc độ và độ chính xác để giành Hạng Nhất!'
    ],
    xpNote: '+60 đến +210 XP nếu về Nhất'
  },
  {
    id: 'blast_arena',
    title: 'Blast Arena',
    kicker: 'Đối kháng 4P · Không gian',
    subtitle: 'Phá hủy toàn bộ thiên thạch đáp án đúng trong đấu trường không gian 4 phi thuyền.',
    group: 'multiplayer',
    ctaLabel: 'Vào đấu trường',
    ctaGradient:
      'bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 text-white shadow-md shadow-fuchsia-500/25 hover:shadow-lg hover:shadow-purple-500/35',
    howToPlayLabel: 'How to play Blast',
    rules: [
      '4 phi thuyền đóng quân tại 4 góc đấu trường không gian cùng tranh tài trong 45 giây.',
      'Quan sát thuật ngữ ở thanh mục tiêu và nhắm bắn thiên thạch chứa định nghĩa đúng nhanh hơn đối thủ.',
      'Tích lũy chuỗi combo liên hoàn để vươn lên vị trí Top 1 bảng điểm đấu trường.'
    ],
    xpNote: '+65 đến +220 XP nếu Top 1'
  },
  {
    id: 'multiplayer_match',
    title: 'Multiplayer Match',
    kicker: 'Đối kháng 4P · Tốc độ',
    subtitle: 'Ghi nhớ và ghép đúng toàn bộ cặp thẻ trước khi các đối thủ hoàn thành.',
    group: 'multiplayer',
    ctaLabel: 'Vào đấu trường',
    ctaGradient:
      'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 text-white shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-teal-500/35',
    howToPlayLabel: 'How to play Match',
    rules: [
      'Theo dõi thanh tiến độ trực tiếp của 3 đối thủ ngay phía trên bảng ghép thẻ.',
      'Ghép đủ 6 cặp Thuật ngữ – Định nghĩa với thời gian ngắn nhất và ít lỗi nhất.',
      'Kết thúc trận đấu hiển thị xếp hạng và danh sách thuật ngữ cần ôn luyện thêm.'
    ],
    xpNote: '+60 đến +200 XP khi về Nhất'
  }
];

const renderGameArtwork = (id: FlashcardGameId) => {
  switch (id) {
    case 'blocks':
      return (
        <div className="h-32 rounded-2xl bg-[#efe587] p-3 overflow-hidden relative flex items-center justify-center">
          <div className="grid grid-cols-5 gap-1.5 rotate-[-6deg] scale-105">
            {[
              'bg-white', 'bg-rose-400', 'bg-blue-600', 'bg-blue-600', 'bg-white',
              'bg-white', 'bg-rose-400', 'bg-rose-400', 'bg-blue-600', 'bg-white',
              'bg-blue-600', 'bg-blue-600', 'bg-white', 'bg-white', 'bg-rose-400',
              'bg-white', 'bg-rose-400', 'bg-blue-600', 'bg-white', 'bg-rose-400'
            ].map((bg, i) => (
              <div key={i} className={`w-6 h-6 rounded-md ${bg} shadow-xs`} />
            ))}
          </div>
        </div>
      );
    case 'blast':
      return (
        <div className="h-32 rounded-2xl bg-[#200e63] overflow-hidden relative flex items-center justify-center">
          <svg viewBox="0 0 260 130" className="w-full h-full">
            <circle cx="48" cy="40" r="24" fill="#4f2a99" />
            <circle cx="42" cy="34" r="5" fill="#3a1c78" />
            <circle cx="112" cy="28" r="26" fill="#4f2a99" />
            <circle cx="195" cy="24" r="28" fill="#2e54ff" />
            <circle cx="228" cy="75" r="27" fill="#4f2a99" />
            <circle cx="222" cy="68" r="5" fill="#3a1c78" />
            <ellipse cx="130" cy="96" rx="22" ry="22" fill="#d9f941" />
            <circle cx="130" cy="94" r="10" fill="#2b55f5" />
            <rect x="108" y="102" width="12" height="18" rx="6" fill="#2b55f5" />
            <rect x="140" y="102" width="12" height="18" rx="6" fill="#2b55f5" />
          </svg>
        </div>
      );
    case 'charms':
      return (
        <div className="h-32 rounded-2xl bg-[#48ccff] overflow-hidden relative flex items-center justify-center">
          <div className="grid grid-cols-4 gap-2 rotate-[-8deg] scale-105">
            <div className="w-8 h-8 rounded-full bg-pink-200" />
            <div className="w-8 h-8 rounded-b-2xl rounded-t-md bg-emerald-200" />
            <div className="w-8 h-8 rounded-xl bg-indigo-200" />
            <div className="w-8 h-8 rounded-lg bg-sky-200" />
            <div className="w-8 h-8 rounded-xl bg-indigo-200" />
            <div className="w-8 h-8 rounded-b-2xl rounded-t-md bg-emerald-200" />
            <div className="w-8 h-8 rounded-lg bg-sky-200" />
            <div className="w-8 h-8 rounded-xl bg-amber-200" />
          </div>
          <span className="absolute top-5 left-1/3 text-white text-sm">★</span>
          <span className="absolute bottom-4 right-1/3 text-white text-xs">★</span>
        </div>
      );
    case 'match':
      return (
        <div className="h-32 rounded-2xl bg-[#f7d8cc] overflow-hidden relative flex items-center justify-center gap-3 p-3">
          <div className="w-18 h-22 rounded-xl bg-white shadow-md rotate-[-6deg] flex items-center justify-center">
            <div className="w-8 h-8 rounded-xl bg-purple-600 rotate-45" />
          </div>
          <div className="w-18 h-24 rounded-xl bg-purple-600 shadow-lg rotate-[6deg] p-2.5 flex flex-col justify-center gap-1.5">
            <div className="h-1.5 rounded-full bg-white/90 w-full" />
            <div className="h-1.5 rounded-full bg-white/90 w-4/5" />
            <div className="h-1.5 rounded-full bg-white/90 w-3/5" />
          </div>
        </div>
      );
    case 'classic_live':
      return (
        <div className="h-32 rounded-2xl bg-[#9e94ff] p-3.5 flex flex-col justify-center gap-2 overflow-hidden">
          {[
            { pct: '58%', bg: 'bg-indigo-700', tag: '🦊' },
            { pct: '82%', bg: 'bg-amber-400', tag: '🐧' },
            { pct: '44%', bg: 'bg-rose-400', tag: '🐶' },
            { pct: '36%', bg: 'bg-emerald-500', tag: '🐰' }
          ].map((lane, idx) => (
            <div key={idx} className="relative h-2.5 rounded-full bg-white/75 flex items-center">
              <div className={`h-full rounded-full ${lane.bg}`} style={{ width: lane.pct }} />
              <span
                className="w-5 h-5 rounded-full bg-white border-2 border-indigo-900 flex items-center justify-center text-[10px] shadow-xs absolute -translate-x-1/2"
                style={{ left: lane.pct }}
              >
                {lane.tag}
              </span>
            </div>
          ))}
        </div>
      );
    case 'blast_arena':
      return (
        <div className="h-32 rounded-2xl bg-[#10083d] overflow-hidden relative">
          <svg viewBox="0 0 260 130" className="w-full h-full">
            <line x1="28" y1="24" x2="108" y2="66" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" />
            <circle cx="110" cy="67" r="18" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 3" />
            <circle cx="155" cy="40" r="14" fill="#31247a" />
            <circle cx="188" cy="78" r="15" fill="#31247a" />
            <circle cx="122" cy="96" r="13" fill="#31247a" />
            <circle cx="24" cy="24" r="15" fill="#e879f9" stroke="#ffffff" strokeWidth="2" />
            <circle cx="236" cy="24" r="15" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
            <circle cx="24" cy="106" r="15" fill="#34d399" stroke="#ffffff" strokeWidth="2" />
            <circle cx="236" cy="106" r="15" fill="#fb923c" stroke="#ffffff" strokeWidth="2" />
          </svg>
        </div>
      );
    case 'multiplayer_match':
      return (
        <div className="h-32 rounded-2xl bg-[#66d1ff] p-3 flex items-center justify-center gap-3 overflow-hidden">
          <div className="w-20 h-20 rounded-xl bg-white border-2 border-emerald-400 shadow-sm flex items-center justify-center">
            <div className="w-8 h-10 rounded-xl bg-rose-500/85 border-2 border-rose-700" />
          </div>
          <div className="w-20 h-20 rounded-xl bg-white border border-sky-200 shadow-sm p-2.5 flex flex-col justify-center gap-2">
            <div className="h-2 rounded-full bg-slate-200 w-full" />
            <div className="h-2 rounded-full bg-slate-200 w-3/4" />
          </div>
        </div>
      );
  }
};

const renderBadgeIcon = (iconKey: VirtualBadge['iconKey']) => {
  switch (iconKey) {
    case 'rocket':
      return Rocket;
    case 'zap':
      return Zap;
    case 'blocks':
      return Grid;
    case 'sparkles':
      return Sparkles;
    case 'crown':
      return Crown;
    case 'flame':
      return Flame;
    case 'trophy':
      return Trophy;
    case 'compass':
    default:
      return Compass;
  }
};

export const FlashcardGamesPage: React.FC<FlashcardGamesPageProps> = ({
  deck,
  allDecks,
  onSelectDeckId,
  studentName,
  initialGameId = null,
  onBack
}) => {
  const [subPage, setSubPage] = useState<GamesSubPage>('hub');
  const [activeGameId, setActiveGameId] = useState<FlashcardGameId | null>(initialGameId);
  const [gameOriginPage, setGameOriginPage] = useState<GamesSubPage>('hub');
  const [gameFilter, setGameFilter] = useState<GameFilter>('all');
  const [leaderboardSort, setLeaderboardSort] = useState<'xp' | 'speed'>('xp');
  const [progression, setProgression] = useState<GameProgressionState>(() => loadGameProgression());
  const [howToPlayMeta, setHowToPlayMeta] = useState<GameCatalogMeta | null>(null);
  const [rewardBanner, setRewardBanner] = useState<{
    xpEarned: number;
    badges: VirtualBadge[];
    label: string;
  } | null>(null);

  const levelInfo = useMemo(() => getLevelFromXp(progression.xp), [progression.xp]);
  const leaderboard = useMemo(
    () => buildLeaderboard(progression, studentName, leaderboardSort),
    [progression, studentName, leaderboardSort]
  );

  const visibleGames = useMemo(() => {
    if (gameFilter === 'all') return GAME_CATALOG;
    return GAME_CATALOG.filter((g) => g.group === gameFilter);
  }, [gameFilter]);

  const multiGames = useMemo(() => GAME_CATALOG.filter((g) => g.group === 'multiplayer'), []);

  const launchGame = (gameId: FlashcardGameId, origin: GamesSubPage = subPage) => {
    playGameTone('match');
    setGameOriginPage(origin);
    setActiveGameId(gameId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateSubPage = (nextPage: GamesSubPage) => {
    playGameTone('block_place');
    setActiveGameId(null);
    setSubPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGameComplete = (result: RecordGameResultInput) => {
    const { nextState, xpEarned, newlyUnlockedBadges } = recordGameCompletion(progression, result);
    setProgression(nextState);
    setRewardBanner({
      xpEarned,
      badges: newlyUnlockedBadges,
      label: result.gameTitle
    });
  };

  const handleClaimChallenge = (challengeId: string) => {
    const next = claimChallengeReward(progression, challengeId);
    if (next !== progression) {
      playGameTone('claim');
      setProgression(next);
    }
  };

  // Top Header Context Calculation (Clean single BACK rule for every page)
  const isPlayingGame = activeGameId !== null;
  const activeGameMeta = activeGameId ? GAME_CATALOG.find((g) => g.id === activeGameId) : null;

  const subPageHeaderTitle = isPlayingGame
    ? activeGameMeta?.title || 'Games'
    : subPage === 'arena'
    ? 'Đấu trường Trực tiếp'
    : subPage === 'leaderboard'
    ? 'Bảng xếp hạng'
    : subPage === 'challenges'
    ? 'Thử thách & Huy hiệu'
    : 'Games';

  const handleTopBack = () => {
    playGameTone('block_place');
    if (isPlayingGame) {
      setActiveGameId(null);
      setSubPage(gameOriginPage);
      return;
    }
    if (subPage !== 'hub') {
      setSubPage('hub');
      return;
    }
    onBack();
  };

  return (
    <div className="min-h-[75vh] space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Dedicated Top Header Bar — every sub-page / game has its own BACK button to return */}
      <header className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleTopBack}
            className="min-h-[42px] px-4.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 text-white text-xs font-extrabold flex items-center gap-2 shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>BACK</span>
          </button>

          <div className="min-w-0 pl-1">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-indigo-600 dark:text-cyan-300 shrink-0" />
              <span className="font-display text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                {subPageHeaderTitle}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[180px] sm:max-w-[280px]">
                {deck.title} ({deck.cards.length} thẻ)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-4 text-xs font-mono tabular-nums">
            <span className="font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1">
              <Flame className="w-4 h-4" />
              {progression.streakDays} ngày
            </span>
            <span className="font-bold text-indigo-600 dark:text-cyan-300">
              Cấp {levelInfo.level} · {progression.xp.toLocaleString()} XP
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {progression.unlockedBadgeIds.length}/{VIRTUAL_BADGES.length} huy hiệu
            </span>
          </div>

          <button
            type="button"
            onClick={onBack}
            aria-label="Thoát về trang Flashcards"
            title="Thoát về trang Flashcards"
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-300 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Post-game XP & Badge Celebration Banner */}
      {rewardBanner && (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/35 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <div className="font-extrabold text-emerald-900 dark:text-emerald-200">
                Hoàn thành {rewardBanner.label}: +{rewardBanner.xpEarned} XP đã được cộng vào hồ sơ!
              </div>
              {rewardBanner.badges.length > 0 && (
                <div className="text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5">
                  Mở khóa huy hiệu mới: {rewardBanner.badges.map((b) => b.title).join(', ')}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRewardBanner(null)}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
          >
            Ẩn
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ACTIVE GAME SCREEN (Full view with BACK in header returning cleanly)  */}
      {/* ===================================================================== */}
      {activeGameId === 'match' && (
        <MatchGame
          deck={deck}
          mode="solo"
          studentName={studentName}
          bestRecordSec={progression.bestMatchTime}
          onComplete={handleGameComplete}
          onExitToHub={() => setActiveGameId(null)}
        />
      )}

      {activeGameId === 'multiplayer_match' && (
        <MatchGame
          deck={deck}
          mode="multiplayer"
          studentName={studentName}
          bestRecordSec={progression.bestMatchTime}
          onComplete={handleGameComplete}
          onExitToHub={() => setActiveGameId(null)}
        />
      )}

      {activeGameId === 'blast' && (
        <BlastGame
          deck={deck}
          allDecks={allDecks}
          mode="solo"
          studentName={studentName}
          onComplete={handleGameComplete}
          onExitToHub={() => setActiveGameId(null)}
        />
      )}

      {activeGameId === 'blast_arena' && (
        <BlastGame
          deck={deck}
          allDecks={allDecks}
          mode="arena"
          studentName={studentName}
          onComplete={handleGameComplete}
          onExitToHub={() => setActiveGameId(null)}
        />
      )}

      {activeGameId === 'blocks' && (
        <BlocksGame
          deck={deck}
          allDecks={allDecks}
          onComplete={handleGameComplete}
          onExitToHub={() => setActiveGameId(null)}
        />
      )}

      {activeGameId === 'charms' && (
        <CharmsGame
          deck={deck}
          allDecks={allDecks}
          onComplete={handleGameComplete}
          onExitToHub={() => setActiveGameId(null)}
        />
      )}

      {activeGameId === 'classic_live' && (
        <ClassicLiveGame
          deck={deck}
          allDecks={allDecks}
          studentName={studentName}
          onComplete={handleGameComplete}
          onExitToHub={() => setActiveGameId(null)}
        />
      )}

      {/* ===================================================================== */}
      {/* PAGE 1: MAIN UNIFIED GAMES HUB (All 7 games together + Page Launchers)*/}
      {/* ===================================================================== */}
      {!isPlayingGame && subPage === 'hub' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Unified Command Bar: XP Bar + Deck Selector + 3 Vibrant Sub-Page Launchers */}
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
              {/* Left: XP Bar & Deck Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                <div className="space-y-2 flex-1 max-w-md">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">
                      Cấp {levelInfo.level} · {levelInfo.rankTitle}
                    </span>
                    <span className="font-mono tabular-nums text-indigo-600 dark:text-cyan-300 font-bold">
                      {levelInfo.currentLevelXp}/{levelInfo.xpPerLevel} XP đến cấp {levelInfo.level + 1}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-400 transition-all duration-300"
                      style={{ width: `${levelInfo.progressPercent}%` }}
                    />
                  </div>
                </div>

                <select
                  value={deck.id}
                  onChange={(e) => onSelectDeckId(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[250px] truncate cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Chọn bộ thẻ chơi game"
                >
                  {allDecks.map((d) => (
                    <option key={d.id} value={d.id}>
                      Bộ thẻ: {d.title} ({d.cards.length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Right: 3 Vibrant Page Launcher Buttons -> Open Dedicated Full Pages with BACK */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => navigateSubPage('arena')}
                  className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-md shadow-purple-500/25 hover:shadow-lg hover:shadow-fuchsia-500/35 transition-all duration-150 cursor-pointer whitespace-nowrap"
                >
                  <Swords className="w-4 h-4 shrink-0" />
                  <span>Đấu trường</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                </button>

                <button
                  type="button"
                  onClick={() => navigateSubPage('leaderboard')}
                  className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-md shadow-amber-500/25 hover:shadow-lg hover:shadow-rose-500/35 transition-all duration-150 cursor-pointer whitespace-nowrap"
                >
                  <Crown className="w-4 h-4 shrink-0" />
                  <span>Bảng xếp hạng</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                </button>

                <button
                  type="button"
                  onClick={() => navigateSubPage('challenges')}
                  className="min-h-[42px] px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-cyan-500/35 transition-all duration-150 cursor-pointer whitespace-nowrap"
                >
                  <Award className="w-4 h-4 shrink-0" />
                  <span>Thử thách &amp; Huy hiệu</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>
            </div>
          </section>

          {/* UNIFIED LOGICAL GAMES GRID: All 7 games together on ONE single plane */}
          <section className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Tất cả Trò chơi Flashcard
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Toàn bộ 7 chế độ giải trí &amp; đối kháng được gom chung một nơi giúp bạn chọn nhanh và luyện tập liền mạch
                </p>
              </div>

              {/* Clean Segmented Filter */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 self-start sm:self-auto">
                {[
                  { id: 'all' as GameFilter, label: 'Tất cả (7)' },
                  { id: 'solo' as GameFilter, label: 'Cá nhân (4)' },
                  { id: 'multiplayer' as GameFilter, label: 'Đối kháng (3)' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setGameFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      gameFilter === f.id
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {visibleGames.map((game) => (
                <div
                  key={game.id}
                  className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4 hover:shadow-xl hover:border-indigo-300/70 dark:hover:border-cyan-500/40 hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] font-bold text-indigo-600 dark:text-cyan-300">
                        {game.kicker}
                      </div>
                      <h3 className="font-display text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {game.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed min-h-[46px]">
                        {game.subtitle}
                      </p>
                    </div>

                    <div
                      onClick={() => launchGame(game.id, 'hub')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          launchGame(game.id, 'hub');
                        }
                      }}
                      className="cursor-pointer transition-transform duration-150 hover:scale-[1.02]"
                    >
                      {renderGameArtwork(game.id)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setHowToPlayMeta(game)}
                      className="text-xs font-bold text-indigo-600 dark:text-cyan-300 hover:text-indigo-500 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      {game.howToPlayLabel || 'Cách chơi'}
                    </button>
                    <button
                      type="button"
                      onClick={() => launchGame(game.id, 'hub')}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap transition-all duration-150 hover:-translate-y-0.5 active:scale-95 ${game.ctaGradient}`}
                    >
                      <span>{game.ctaLabel}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PAGE 2: DEDICATED ĐẤU TRƯỜNG PAGE (Separate Page + BACK to Hub)       */}
      {/* ===================================================================== */}
      {!isPlayingGame && subPage === 'arena' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Arena Hero Lobby Banner */}
          <section className="rounded-3xl bg-gradient-to-br from-[#081229] via-[#131d4f] to-[#2e1065] text-white p-6 sm:p-8 border border-indigo-500/30 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300">
                <Swords className="w-4 h-4" />
                <span>Đấu trường Trực tiếp &amp; Ghép cặp 4 Người chơi</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-balance">
                Sẵn sàng tranh tài cùng bạn bè trên bộ thẻ {deck.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Chọn 1 trong 3 chế độ thi đấu bên dưới để đua tốc độ, tích lũy chuỗi Combo và nhận thưởng XP cao nhất.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-cyan-300/25 px-6 py-4 text-center shrink-0 space-y-1">
              <div className="text-[11px] font-semibold text-cyan-200">Mã PIN Phòng Đấu</div>
              <div className="font-mono tabular-nums text-3xl font-black tracking-wider text-amber-300">
                839-204
              </div>
              <div className="text-[11px] text-emerald-300 font-semibold flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>4 vị trí sẵn sàng</span>
              </div>
            </div>
          </section>

          {/* 3 Arena Game Modes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {multiGames.map((game) => (
              <div
                key={game.id}
                className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between gap-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
              >
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] font-bold text-purple-600 dark:text-cyan-300">
                      {game.kicker}
                    </div>
                    <h3 className="font-display text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {game.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed min-h-[44px]">
                      {game.subtitle}
                    </p>
                  </div>

                  <div
                    onClick={() => launchGame(game.id, 'arena')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        launchGame(game.id, 'arena');
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {renderGameArtwork(game.id)}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setHowToPlayMeta(game)}
                    className="text-xs font-bold text-indigo-600 dark:text-cyan-300 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    {game.howToPlayLabel || 'Cách chơi'}
                  </button>
                  <button
                    type="button"
                    onClick={() => launchGame(game.id, 'arena')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap transition-all duration-150 hover:-translate-y-0.5 active:scale-95 ${game.ctaGradient}`}
                  >
                    <span>Vào đấu trường</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Arena / Game Matches */}
          {progression.recentSessions.length > 0 && (
            <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600 dark:text-cyan-300" />
                <span>Lịch sử ván đấu gần đây</span>
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-800 overflow-hidden">
                {progression.recentSessions.slice(0, 5).map((ses) => (
                  <div key={ses.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{ses.gameTitle}</span>
                      <span className="text-slate-400 mx-2">·</span>
                      <span className="text-slate-500 dark:text-slate-400">{ses.deckTitle}</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono tabular-nums">
                      <span className="font-bold text-indigo-600 dark:text-cyan-300">{ses.score.toLocaleString()} đ</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">+{ses.xpEarned} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* PAGE 3: DEDICATED BẢNG XẾP HẠNG PAGE (Separate Page + BACK to Hub)    */}
      {/* ===================================================================== */}
      {!isPlayingGame && subPage === 'leaderboard' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top 3 Podium Cards */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {leaderboard.slice(0, 3).map((top, idx) => {
              const lvl = getLevelFromXp(top.xp);
              const gradient =
                idx === 0
                  ? 'from-amber-400 via-orange-500 to-rose-500 text-white shadow-lg shadow-amber-500/25'
                  : idx === 1
                  ? 'from-slate-700 via-slate-800 to-slate-900 text-white shadow-md'
                  : 'from-amber-700 via-orange-700 to-amber-800 text-white shadow-md';

              return (
                <div key={top.id} className={`rounded-3xl bg-gradient-to-br ${gradient} p-6 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-black">#{idx + 1}</span>
                    <Crown className="w-6 h-6 opacity-90" />
                  </div>
                  <div>
                    <div className="font-display text-lg font-extrabold truncate">{top.name}</div>
                    <div className="text-xs opacity-85">{top.schoolClass} · Cấp {lvl.level}</div>
                  </div>
                  <div className="pt-2 border-t border-white/20 flex items-center justify-between text-xs font-mono tabular-nums font-bold">
                    <span>
                      {leaderboardSort === 'xp'
                        ? `${top.xp.toLocaleString()} XP`
                        : `${top.bestMatchTime.toFixed(1)}s`}
                    </span>
                    <span>{top.badgesCount} huy hiệu</span>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Full Rankings List */}
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <span>Bảng Xếp Hạng Đấu Trường Flashcard</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cập nhật trực tiếp theo tổng điểm kinh nghiệm XP hoặc kỷ lục tốc độ Match của bạn
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setLeaderboardSort('xp')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap transition ${
                    leaderboardSort === 'xp'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Theo Tổng XP
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardSort('speed')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap transition ${
                    leaderboardSort === 'speed'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Theo Tốc độ Match
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              {leaderboard.map((entry, idx) => {
                const lvl = getLevelFromXp(entry.xp);
                return (
                  <div
                    key={entry.id}
                    className={`px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs ${
                      entry.isCurrentUser
                        ? 'bg-indigo-50/85 dark:bg-indigo-950/45'
                        : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`w-7 text-center font-mono tabular-nums font-black text-sm ${
                          idx === 0
                            ? 'text-amber-500'
                            : idx === 1
                            ? 'text-slate-400'
                            : idx === 2
                            ? 'text-amber-700 dark:text-amber-600'
                            : 'text-slate-500'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white font-bold flex items-center justify-center shrink-0">
                        {entry.avatarText}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {entry.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {entry.schoolClass} · Cấp {lvl.level}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 font-mono tabular-nums">
                      <span className="text-amber-600 dark:text-amber-300 font-bold hidden sm:inline">
                        {entry.streakDays} ngày
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                        {entry.badgesCount} huy hiệu
                      </span>
                      <span className="font-extrabold text-indigo-600 dark:text-cyan-300 text-sm">
                        {leaderboardSort === 'xp'
                          ? `${entry.xp.toLocaleString()} XP`
                          : entry.bestMatchTime < 99
                          ? `${entry.bestMatchTime.toFixed(1)}s`
                          : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PAGE 4: DEDICATED THỬ THÁCH & HUY HIỆU PAGE (Separate Page + BACK)    */}
      {/* ===================================================================== */}
      {!isPlayingGame && subPage === 'challenges' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Level & Streak Hero */}
          <section className="rounded-3xl bg-gradient-to-br from-[#06282a] via-[#0b3b3d] to-[#0e4f47] text-white p-6 sm:p-8 border border-emerald-400/25 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-lg">
              <div className="text-xs font-bold text-emerald-300">
                Hồ sơ Phần thưởng &amp; Thành tựu Cá nhân
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold">
                Cấp {levelInfo.level} · {levelInfo.rankTitle}
              </h2>
              <div className="h-2.5 rounded-full bg-white/15 overflow-hidden max-w-md">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
              <div className="text-xs font-mono tabular-nums text-emerald-100/90">
                {progression.xp.toLocaleString()} XP tích lũy · {levelInfo.currentLevelXp}/{levelInfo.xpPerLevel} XP đến cấp tiếp theo
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 shrink-0 text-center">
              <div className="rounded-2xl bg-white/10 border border-white/15 px-5 py-3">
                <div className="font-mono tabular-nums text-2xl font-black text-amber-300">
                  {progression.streakDays}
                </div>
                <div className="text-[11px] text-emerald-100/80 font-semibold">Ngày liên tiếp</div>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 px-5 py-3">
                <div className="font-mono tabular-nums text-2xl font-black text-cyan-300">
                  {progression.unlockedBadgeIds.length}/{VIRTUAL_BADGES.length}
                </div>
                <div className="text-[11px] text-emerald-100/80 font-semibold">Huy hiệu mở khóa</div>
              </div>
            </div>
          </section>

          {/* Daily Personal Challenges */}
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div>
              <h3 className="font-display text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-emerald-500" />
                <span>Thử thách Cá nhân Mỗi ngày</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hoàn thành mục tiêu hằng ngày để nhận thêm điểm kinh nghiệm XP và duy trì động lực học tập
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DAILY_CHALLENGES.map((ch) => {
                const curr = Math.min(ch.target, ch.current(progression));
                const pct = Math.round((curr / ch.target) * 100);
                const isDone = curr >= ch.target;
                const isClaimed = progression.claimedDailyChallengeIds.includes(ch.id);

                return (
                  <div
                    key={ch.id}
                    className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{ch.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ch.description}</p>
                      </div>
                      <span className="font-mono tabular-nums text-xs font-extrabold text-amber-600 dark:text-amber-300 shrink-0">
                        +{ch.rewardXp} XP
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        <span>Tiến độ</span>
                        <span>
                          {curr}/{ch.target} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
                            isDone ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      {isClaimed ? (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Đã nhận thưởng</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!isDone}
                          onClick={() => handleClaimChallenge(ch.id)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                            isDone
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-white shadow-md shadow-emerald-500/25 cursor-pointer'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isDone ? 'Nhận thưởng ngay' : 'Đang thực hiện'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Virtual Badges Showcase */}
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div>
              <h3 className="font-display text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-500" />
                <span>Bộ Sưu Tập Huy Hiệu Ảo</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Đã mở khóa {progression.unlockedBadgeIds.length}/{VIRTUAL_BADGES.length} huy hiệu ghi nhận nỗ lực học tập liên tục
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {VIRTUAL_BADGES.map((badge) => {
                const unlocked = progression.unlockedBadgeIds.includes(badge.id);
                const Icon = renderBadgeIcon(badge.iconKey);
                const pct = Math.round(badge.progressRatio(progression) * 100);

                return (
                  <div
                    key={badge.id}
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition ${
                      unlocked
                        ? 'border-amber-300/80 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20'
                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 opacity-85'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                          unlocked
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {unlocked ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đã mở
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 inline-flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" />
                          +{badge.rewardXp} XP
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{badge.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {badge.description}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        <span>{badge.progressLabel(progression)}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${unlocked ? 'bg-amber-500' : 'bg-indigo-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* How to Play Modal */}
      {howToPlayMeta && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                Hướng dẫn chơi {howToPlayMeta.title}
              </h3>
              <button
                type="button"
                onClick={() => setHowToPlayMeta(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {howToPlayMeta.rules.map((rule, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-cyan-300 font-mono font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>

            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 pt-1">
              Phần thưởng: {howToPlayMeta.xpNote}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setHowToPlayMeta(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = howToPlayMeta.id;
                  setHowToPlayMeta(null);
                  launchGame(target, subPage);
                }}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold cursor-pointer ${howToPlayMeta.ctaGradient}`}
              >
                Vào chơi ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
