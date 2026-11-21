import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Flame,
  Gamepad2,
  Medal,
  Search,
  Sparkles,
  Trophy,
  X
} from 'lucide-react';
import { StudentProfile, TaskItem, ViewTab } from '../types';
import {
  GameProgressionState,
  loadGameProgression
} from './flashcardGames/gameProgression';
import {
  buildStudentLeaderboard,
  LeaderboardSortBy,
  StudentLeaderboardEntry,
  TASK_XP_VALUE
} from '../utils/xpLeaderboard';

interface StudentLeaderboardProps {
  tasks: TaskItem[];
  studentProfile?: StudentProfile;
  onNavigate?: (tab: ViewTab) => void;
  variant?: 'compact' | 'full';
  maxVisibleRows?: number;
}

const SORT_OPTIONS: Array<{ id: LeaderboardSortBy; label: string }> = [
  { id: 'total', label: 'Tổng XP' },
  { id: 'tasks', label: 'XP Bài tập' },
  { id: 'games', label: 'XP Flashcards' }
];

function getRankMetricValue(entry: StudentLeaderboardEntry, sortBy: LeaderboardSortBy): number {
  if (sortBy === 'tasks') return entry.taskXp;
  if (sortBy === 'games') return entry.flashcardXp;
  return entry.totalXp;
}

export const StudentLeaderboard: React.FC<StudentLeaderboardProps> = ({
  tasks,
  studentProfile,
  onNavigate,
  variant = 'full',
  maxVisibleRows = 5
}) => {
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>('total');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllRows, setShowAllRows] = useState(variant === 'full');
  const [progression, setProgression] = useState<GameProgressionState>(() => loadGameProgression());

  useEffect(() => {
    const syncProgression = () => {
      setProgression(loadGameProgression());
    };
    window.addEventListener('studyflow_game_progression_updated', syncProgression);
    window.addEventListener('storage', syncProgression);
    return () => {
      window.removeEventListener('studyflow_game_progression_updated', syncProgression);
      window.removeEventListener('storage', syncProgression);
    };
  }, []);

  const summary = useMemo(
    () =>
      buildStudentLeaderboard({
        tasks,
        studentProfile,
        progression,
        sortBy
      }),
    [tasks, studentProfile, progression, sortBy]
  );

  const rankById = useMemo(() => {
    const map = new Map<string, number>();
    summary.entries.forEach((entry, index) => {
      map.set(entry.id, index + 1);
    });
    return map;
  }, [summary.entries]);

  const filteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return summary.entries;
    return summary.entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.className.toLowerCase().includes(q) ||
        entry.rankTitle.toLowerCase().includes(q)
    );
  }, [summary.entries, searchTerm]);

  const topThree = summary.entries.slice(0, 3);
  const visibleEntries = useMemo(() => {
    if (showAllRows || searchTerm.trim().length > 0) return filteredEntries;
    return filteredEntries.slice(0, maxVisibleRows);
  }, [filteredEntries, showAllRows, searchTerm, maxVisibleRows]);

  const currentUserVisible = visibleEntries.some((entry) => entry.isCurrentUser);
  const { currentUserEntry, currentUserRank, nextPeerAbove, xpToNextRank, totalStudents } = summary;
  const userTaskShare =
    currentUserEntry.totalXp > 0
      ? Math.round((currentUserEntry.taskXp / currentUserEntry.totalXp) * 100)
      : 50;

  return (
    <section
      aria-label="Bảng xếp hạng XP học sinh"
      className="sf-card rounded-2xl p-4 sm:p-6 space-y-5 relative z-10"
    >
      {/* Header & Sort Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-slate-100 dark:border-cyan-950/60">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 dark:bg-amber-400/15 border border-amber-500/25 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-300">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                Bảng xếp hạng thi đua XP
              </h2>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                {totalStudents} học viên
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cộng {TASK_XP_VALUE} XP mỗi bài tập hoàn thành và tích lũy thêm qua Flashcard Games
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Sắp xếp bảng xếp hạng"
            className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#08152c] border border-slate-200/80 dark:border-cyan-500/20"
          >
            {SORT_OPTIONS.map((option) => {
              const active = sortBy === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSortBy(option.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-cyan-500 text-slate-900 dark:text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Personal Rank & Healthy Competition Motivation Strip */}
      <div className="rounded-xl bg-slate-50/90 dark:bg-[#08152c]/90 border border-slate-200/80 dark:border-cyan-500/20 p-3.5 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-black text-base flex items-center justify-center shrink-0 tabular-nums shadow-sm">
            #{currentUserRank}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                {currentUserEntry.name} (Bạn)
              </span>
              <span className="text-xs font-black text-cyan-600 dark:text-cyan-300 tabular-nums">
                {currentUserEntry.totalXp.toLocaleString('vi-VN')} XP
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Cấp {currentUserEntry.level} · {currentUserEntry.rankTitle}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                Bài tập: <strong className="text-slate-900 dark:text-white">{currentUserEntry.taskXp} XP</strong> ({currentUserEntry.tasksCompleted} bài)
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="inline-flex items-center gap-1">
                <Gamepad2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                Flashcards: <strong className="text-slate-900 dark:text-white">{currentUserEntry.flashcardXp} XP</strong> ({currentUserEntry.flashcardGamesPlayed} trận)
              </span>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <div className="w-28 h-1.5 rounded-full bg-indigo-500/25 overflow-hidden shrink-0">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${userTaskShare}%` }}
                />
              </div>
              <p className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                {nextPeerAbove ? (
                  <>
                    Còn thiếu <span className="font-black tabular-nums">{xpToNextRank} XP</span> để vượt qua{' '}
                    <span className="font-bold">{nextPeerAbove.name}</span> (#{currentUserRank - 1})
                  </>
                ) : (
                  'Bạn đang dẫn đầu bảng xếp hạng! Hãy giữ vững nhịp học mỗi ngày.'
                )}
              </p>
            </div>
          </div>
        </div>

        {onNavigate && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Làm bài tập (+{TASK_XP_VALUE} XP)</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('flashcards')}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Chơi Flashcards</span>
            </button>
          </div>
        )}
      </div>

      {/* Top 3 Podium */}
      {topThree.length === 3 && searchTerm.trim().length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {topThree.map((student, index) => {
            const rank = index + 1;
            const orderClass =
              rank === 1 ? 'md:order-2' : rank === 2 ? 'md:order-1' : 'md:order-3';
            const podiumAccent =
              rank === 1
                ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 md:pb-5'
                : rank === 2
                  ? 'border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40'
                  : 'border-orange-200 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/15';
            const badgeColor =
              rank === 1
                ? 'bg-amber-400 text-slate-950'
                : rank === 2
                  ? 'bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-white'
                  : 'bg-orange-300 dark:bg-orange-700 text-slate-950 dark:text-white';
            const metricVal = getRankMetricValue(student, sortBy);
            const taskPct =
              student.totalXp > 0 ? Math.round((student.taskXp / student.totalXp) * 100) : 50;

            return (
              <div
                key={student.id}
                className={`${orderClass} ${podiumAccent} rounded-xl border p-3.5 transition-colors`}
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black tabular-nums ${badgeColor}`}
                  >
                    {rank === 1 ? <Crown className="w-3 h-3" /> : <Medal className="w-3 h-3" />}
                    Hạng #{rank}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 tabular-nums">
                    <Flame className="w-3 h-3 text-orange-500" />
                    {student.streakDays} ngày
                  </span>
                </div>

                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-cyan-500/20 border border-slate-200 dark:border-cyan-400/30 text-white dark:text-cyan-200 font-black text-xs flex items-center justify-center shrink-0">
                    {student.avatarText}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      {student.name}
                      {student.isCurrentUser ? ' (Bạn)' : ''}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {student.className} · Cấp {student.level}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {sortBy === 'tasks'
                        ? 'XP Bài tập'
                        : sortBy === 'games'
                          ? 'XP Flashcards'
                          : 'Tổng tích lũy'}
                    </span>
                    <span className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                      {metricVal.toLocaleString('vi-VN')} XP
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-indigo-500/25 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${taskPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>Bài tập: {student.taskXp} XP</span>
                    <span>Games: {student.flashcardXp} XP</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search Bar & Table Header */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm học sinh hoặc lớp..."
              aria-label="Tìm kiếm học sinh trong bảng xếp hạng"
              className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-slate-50 dark:bg-[#08152c] border border-slate-200 dark:border-cyan-500/20 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              XP Bài tập
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
              XP Flashcard Games
            </span>
          </div>
        </div>

        {/* Ranked Rows Table */}
        {visibleEntries.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-cyan-500/20">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#08152c] border-b border-slate-200/80 dark:border-cyan-500/20 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-3 w-14 text-center">Hạng</th>
                  <th className="py-2.5 px-3">Học viên</th>
                  <th className="py-2.5 px-3 text-right">Bài tập</th>
                  <th className="py-2.5 px-3 text-right">Flashcards</th>
                  <th className="py-2.5 px-3 text-right w-40">Tổng XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {visibleEntries.map((entry) => {
                  const rank = rankById.get(entry.id) ?? 0;
                  const taskPct =
                    entry.totalXp > 0 ? Math.round((entry.taskXp / entry.totalXp) * 100) : 50;

                  return (
                    <tr
                      key={entry.id}
                      className={
                        entry.isCurrentUser
                          ? 'bg-cyan-50/80 dark:bg-cyan-950/35'
                          : 'hover:bg-slate-50/80 dark:hover:bg-[#0c1a35]/40 transition-colors'
                      }
                    >
                      <td className="py-2.5 px-3 text-center font-black tabular-nums">
                        <span
                          className={
                            rank === 1
                              ? 'text-amber-600 dark:text-amber-300'
                              : rank === 2
                                ? 'text-slate-600 dark:text-slate-300'
                                : rank === 3
                                  ? 'text-orange-600 dark:text-orange-300'
                                  : 'text-slate-400 dark:text-slate-500'
                          }
                        >
                          #{rank}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 ${
                              entry.isCurrentUser
                                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {entry.avatarText}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {entry.name}
                              {entry.isCurrentUser && (
                                <span className="ml-1.5 text-[11px] font-black text-cyan-600 dark:text-cyan-300">
                                  (Bạn)
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                              {entry.className} · Cấp {entry.level} · Chuỗi {entry.streakDays} ngày
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          +{entry.taskXp.toLocaleString('vi-VN')} XP
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {entry.tasksCompleted} bài xong
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400">
                          +{entry.flashcardXp.toLocaleString('vi-VN')} XP
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {entry.flashcardGamesPlayed} trận game
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <div className="font-black text-slate-900 dark:text-white">
                          {entry.totalXp.toLocaleString('vi-VN')} XP
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-indigo-500/25 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${taskPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
            <Sparkles className="w-5 h-5 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Không tìm thấy học sinh phù hợp với từ khóa "{searchTerm}"
            </p>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}

        {/* Footer controls for compact mode */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="text-slate-500 dark:text-slate-400 tabular-nums">
            {!currentUserVisible && searchTerm.trim().length === 0 ? (
              <span>
                Vị trí hiện tại của bạn: <strong className="text-slate-900 dark:text-white">#{currentUserRank}</strong> ({currentUserEntry.totalXp.toLocaleString('vi-VN')} XP)
              </span>
            ) : (
              <span>Hoàn thành bài tập và luyện Flashcards hằng ngày để tăng hạng bền vững.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {filteredEntries.length > maxVisibleRows && searchTerm.trim().length === 0 && (
              <button
                type="button"
                onClick={() => setShowAllRows((prev) => !prev)}
                className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                {showAllRows ? 'Thu gọn danh sách' : `Xem tất cả ${filteredEntries.length} học sinh`}
              </button>
            )}

            {variant === 'compact' && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('stats')}
                className="font-bold text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Xem báo cáo chi tiết</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
