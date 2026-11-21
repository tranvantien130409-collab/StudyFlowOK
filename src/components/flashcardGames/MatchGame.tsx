import React, { useEffect, useMemo, useState } from 'react';
import {
  Zap,
  Clock,
  Trophy,
  RotateCcw,
  Flame,
  Users,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  Medal
} from 'lucide-react';
import { FlashcardDeck } from '../../types';
import { playGameTone } from './gameSound';
import { RecordGameResultInput } from './gameProgression';

interface MatchTile {
  id: string;
  cardId: string;
  type: 'front' | 'back';
  text: string;
  isMatched: boolean;
}

interface BotRival {
  id: string;
  name: string;
  avatar: string;
  matchedPairs: number;
  finishedTime: number | null;
  pacePerPairSec: number;
}

interface MatchGameProps {
  deck: FlashcardDeck;
  mode: 'solo' | 'multiplayer';
  studentName?: string;
  bestRecordSec: number | null;
  onComplete: (result: RecordGameResultInput) => void;
  onExitToHub: () => void;
}

export const MatchGame: React.FC<MatchGameProps> = ({
  deck,
  mode,
  studentName,
  bestRecordSec,
  onComplete,
  onExitToHub
}) => {
  const [stage, setStage] = useState<'ready' | 'playing' | 'summary'>('playing');
  const [tiles, setTiles] = useState<MatchTile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mismatchIds, setMismatchIds] = useState<string[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [missedTerms, setMissedTerms] = useState<Record<string, { front: string; back: string; count: number }>>({});
  const [totalPairs, setTotalPairs] = useState(6);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [bots, setBots] = useState<BotRival[]>([]);
  const [reported, setReported] = useState(false);

  const startRound = () => {
    const sampleCards = [...deck.cards].sort(() => Math.random() - 0.5).slice(0, 6);
    const created: MatchTile[] = [];
    sampleCards.forEach((c) => {
      created.push({ id: `f_${c.id}`, cardId: c.id, type: 'front', text: c.front, isMatched: false });
      created.push({ id: `b_${c.id}`, cardId: c.id, type: 'back', text: c.back, isMatched: false });
    });
    setTiles(created.sort(() => Math.random() - 0.5));
    setTotalPairs(sampleCards.length);
    setMatchedPairs(0);
    setSelectedId(null);
    setMismatchIds([]);
    setElapsedSec(0);
    setCombo(0);
    setMaxCombo(0);
    setScore(0);
    setMistakes(0);
    setMissedTerms({});
    setReported(false);

    if (mode === 'multiplayer') {
      setBots([
        { id: 'b1', name: 'Minh Anh', avatar: 'MA', matchedPairs: 0, finishedTime: null, pacePerPairSec: 3.1 + Math.random() * 1.1 },
        { id: 'b2', name: 'Hoàng Long', avatar: 'HL', matchedPairs: 0, finishedTime: null, pacePerPairSec: 3.6 + Math.random() * 1.2 },
        { id: 'b3', name: 'Bảo Trâm', avatar: 'BT', matchedPairs: 0, finishedTime: null, pacePerPairSec: 4.1 + Math.random() * 1.2 }
      ]);
    } else {
      setBots([]);
    }
    setStage('playing');
  };

  useEffect(() => {
    startRound();
  }, [deck.id, mode]);

  // Game clock + multiplayer bot simulation
  useEffect(() => {
    if (stage !== 'playing') return;
    const timer = setInterval(() => {
      setElapsedSec((prev) => +(prev + 0.1).toFixed(1));
    }, 100);
    return () => clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'playing' || mode !== 'multiplayer' || totalPairs === 0) return;
    setBots((prevBots) =>
      prevBots.map((bot) => {
        if (bot.matchedPairs >= totalPairs) return bot;
        const expected = Math.min(totalPairs, Math.floor(elapsedSec / bot.pacePerPairSec));
        if (expected > bot.matchedPairs) {
          return {
            ...bot,
            matchedPairs: expected,
            finishedTime: expected >= totalPairs ? elapsedSec : null
          };
        }
        return bot;
      })
    );
  }, [elapsedSec, stage, mode, totalPairs]);

  const finishRound = (finalScore: number, finalElapsed: number, finalMistakes: number, finalMaxCombo: number) => {
    setStage('summary');
    playGameTone('victory');
    if (reported) return;
    setReported(true);

    const totalAttempts = totalPairs + finalMistakes;
    const accuracy = totalAttempts > 0 ? Math.round((totalPairs / totalAttempts) * 100) : 100;
    const finishedBeforeBots =
      mode !== 'multiplayer' || bots.every((b) => b.finishedTime === null || b.finishedTime >= finalElapsed);

    onComplete({
      gameId: mode === 'multiplayer' ? 'multiplayer_match' : 'match',
      gameTitle: mode === 'multiplayer' ? 'Multiplayer Match' : 'Match Solo',
      deckTitle: deck.title,
      score: finalScore,
      accuracy,
      maxCombo: finalMaxCombo,
      durationSec: Math.round(finalElapsed),
      won: finishedBeforeBots,
      matchTimeSec: mode === 'solo' ? finalElapsed : undefined
    });
  };

  const handleTileClick = (tile: MatchTile) => {
    if (stage !== 'playing' || tile.isMatched || mismatchIds.length > 0) return;

    if (!selectedId) {
      playGameTone('block_place');
      setSelectedId(tile.id);
      return;
    }

    if (selectedId === tile.id) {
      setSelectedId(null);
      return;
    }

    const first = tiles.find((t) => t.id === selectedId);
    if (!first) {
      setSelectedId(tile.id);
      return;
    }

    if (first.cardId === tile.cardId && first.type !== tile.type) {
      // Matched!
      playGameTone('match');
      const nextCombo = combo + 1;
      const nextMaxCombo = Math.max(maxCombo, nextCombo);
      const earned = 100 + (nextCombo - 1) * 35;
      const nextScore = score + earned;

      setCombo(nextCombo);
      setMaxCombo(nextMaxCombo);
      setScore(nextScore);

      const updated = tiles.map((t) =>
        t.id === first.id || t.id === tile.id ? { ...t, isMatched: true } : t
      );
      setTiles(updated);
      setSelectedId(null);
      const nextMatchedPairs = matchedPairs + 1;
      setMatchedPairs(nextMatchedPairs);

      if (updated.every((t) => t.isMatched)) {
        const speedBonus = Math.max(0, Math.round((45 - elapsedSec) * 12));
        const finalScore = nextScore + speedBonus;
        setScore(finalScore);
        finishRound(finalScore, elapsedSec, mistakes, nextMaxCombo);
      }
    } else {
      // Mismatch
      playGameTone('wrong');
      setMismatchIds([first.id, tile.id]);
      setCombo(0);
      setMistakes((m) => m + 1);
      setElapsedSec((prev) => +(prev + 1.0).toFixed(1));

      const cardA = deck.cards.find((c) => c.id === first.cardId);
      if (cardA) {
        setMissedTerms((prev) => ({
          ...prev,
          [cardA.id]: {
            front: cardA.front,
            back: cardA.back,
            count: (prev[cardA.id]?.count || 0) + 1
          }
        }));
      }

      setTimeout(() => {
        setMismatchIds([]);
        setSelectedId(null);
      }, 520);
    }
  };

  const rankings = useMemo(() => {
    const me = {
      id: 'me',
      name: `${studentName || 'Bạn'} (Bạn)`,
      avatar: 'ME',
      matchedPairs,
      finishedTime: stage === 'summary' ? elapsedSec : null,
      isMe: true
    };
    const list = [
      me,
      ...bots.map((b) => ({
        id: b.id,
        name: b.name,
        avatar: b.avatar,
        matchedPairs: b.matchedPairs,
        finishedTime: b.finishedTime,
        isMe: false
      }))
    ];
    return list.sort((a, b) => {
      if (a.matchedPairs !== b.matchedPairs) return b.matchedPairs - a.matchedPairs;
      return (a.finishedTime ?? 999) - (b.finishedTime ?? 999);
    });
  }, [studentName, matchedPairs, stage, elapsedSec, bots]);

  const missedList = Object.values(missedTerms).sort((a, b) => b.count - a.count);

  if (deck.cards.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Bộ thẻ này chưa có thẻ nào để chơi Ghép thẻ.
        </p>
        <button
          type="button"
          onClick={onExitToHub}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
        >
          Quay lại Đấu trường
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Compact Game HUD */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white truncate">
              {mode === 'multiplayer' ? 'Multiplayer Match' : 'Match Speed Challenge'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {deck.title} · {matchedPairs}/{totalPairs} cặp đã ghép
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs font-mono tabular-nums">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-300 font-bold">
            <Clock className="w-4 h-4 shrink-0" />
            <span>{elapsedSec.toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-cyan-300 font-bold">
            <Flame className="w-4 h-4 shrink-0" />
            <span>Combo x{Math.max(1, combo)}</span>
          </div>
          <div className="font-extrabold text-slate-900 dark:text-white">
            {score.toLocaleString()} điểm
          </div>
          {bestRecordSec !== null && (
            <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
              Kỷ lục: {bestRecordSec.toFixed(1)}s
            </span>
          )}
          <button
            type="button"
            onClick={startRound}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-sans font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Chơi lại</span>
          </button>
        </div>
      </div>

      {/* Multiplayer Race Bars */}
      {mode === 'multiplayer' && stage === 'playing' && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {rankings.map((r, idx) => (
            <div
              key={r.id}
              className={`rounded-xl p-3 border ${
                r.isMe
                  ? 'border-indigo-400/60 bg-indigo-50/70 dark:bg-indigo-950/35'
                  : 'border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  #{idx + 1} {r.name}
                </span>
                <span className="font-mono tabular-nums font-bold text-indigo-600 dark:text-cyan-300 shrink-0">
                  {r.matchedPairs}/{totalPairs}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    r.isMe ? 'bg-gradient-to-r from-indigo-500 to-cyan-400' : 'bg-slate-400 dark:bg-slate-500'
                  }`}
                  style={{ width: `${Math.round((r.matchedPairs / Math.max(1, totalPairs)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Arena */}
      {stage === 'playing' ? (
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-rose-50/60 via-white to-amber-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 p-5 sm:p-7">
          {mismatchIds.length > 0 && (
            <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-4 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Chưa khớp! +1.0 giây phạt và đặt lại chuỗi combo.</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {tiles.map((tile) => {
              if (tile.isMatched) {
                return (
                  <div
                    key={tile.id}
                    className="h-28 rounded-2xl border border-dashed border-emerald-400/35 bg-emerald-500/5 flex items-center justify-center text-emerald-600/60 dark:text-emerald-400/50 text-xs font-bold"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                );
              }
              const isSelected = selectedId === tile.id;
              const isBad = mismatchIds.includes(tile.id);
              const isTerm = tile.type === 'front';

              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => handleTileClick(tile)}
                  className={`h-28 p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isBad
                      ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-500 text-rose-700 dark:text-rose-200 ring-2 ring-rose-500/40'
                      : isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 ring-4 ring-indigo-500/25 shadow-lg -translate-y-0.5'
                      : isTerm
                      ? 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-900 dark:text-white hover:border-indigo-400 hover:shadow-md'
                      : 'bg-violet-50/70 dark:bg-indigo-950/40 border-violet-200/80 dark:border-indigo-800/60 text-slate-800 dark:text-indigo-100 hover:border-violet-400 hover:shadow-md'
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold tracking-wide ${
                      isSelected
                        ? 'text-indigo-100'
                        : isTerm
                        ? 'text-indigo-600 dark:text-cyan-300'
                        : 'text-violet-600 dark:text-violet-300'
                    }`}
                  >
                    {isTerm ? 'Thuật ngữ' : 'Định nghĩa'}
                  </span>
                  <span className="text-xs sm:text-[13px] font-bold leading-snug line-clamp-3 my-auto">
                    {tile.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 space-y-6">
          <div className="text-center max-w-lg mx-auto space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
              <Trophy className="w-8 h-8" />
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {mode === 'multiplayer' && rankings[0]?.isMe
                ? 'Hạng Nhất Multiplayer Match!'
                : 'Hoàn thành Xuất sắc!'}
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-mono tabular-nums">
              <span className="font-extrabold text-amber-600 dark:text-amber-300">{elapsedSec.toFixed(1)}s</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="font-extrabold text-indigo-600 dark:text-cyan-300">{score.toLocaleString()} điểm</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Combo tối đa x{maxCombo}</span>
            </div>
            {bestRecordSec !== null && mode === 'solo' && elapsedSec <= bestRecordSec && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Thiết lập kỷ lục cá nhân mới!</span>
              </p>
            )}
          </div>

          {mode === 'multiplayer' && (
            <div className="max-w-2xl mx-auto space-y-2">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>Bảng xếp hạng trận đấu</span>
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                {rankings.map((r, idx) => (
                  <div
                    key={r.id}
                    className={`px-4 py-3 flex items-center justify-between text-xs ${
                      r.isMe ? 'bg-indigo-50/80 dark:bg-indigo-950/40 font-bold' : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 font-mono font-extrabold text-slate-500">#{idx + 1}</span>
                      <Medal className={`w-4 h-4 ${idx === 0 ? 'text-amber-500' : 'text-slate-400'}`} />
                      <span className="text-slate-900 dark:text-white">{r.name}</span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {r.finishedTime !== null ? `${r.finishedTime.toFixed(1)}s` : `${r.matchedPairs}/${totalPairs} cặp`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {missedList.length > 0 && (
            <div className="max-w-2xl mx-auto rounded-2xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
              <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">
                Thuật ngữ cần ôn lại sau ván đấu
              </h4>
              <div className="space-y-1.5">
                {missedList.map((m, i) => (
                  <div key={i} className="text-xs flex items-center justify-between gap-3 text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">{m.front}</span>
                    <span className="text-slate-500 dark:text-slate-400 truncate">{m.back}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={startRound}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-105 text-white text-xs font-extrabold shadow-lg shadow-amber-500/25 cursor-pointer whitespace-nowrap flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Chơi lại vòng mới</span>
            </button>
            <button
              type="button"
              onClick={onExitToHub}
              className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer whitespace-nowrap flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Chọn game khác</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
