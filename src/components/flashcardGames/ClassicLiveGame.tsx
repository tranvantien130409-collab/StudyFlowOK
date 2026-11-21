import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crown,
  Flame,
  Clock,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trophy,
  Sparkles,
  Users
} from 'lucide-react';
import { FlashcardDeck } from '../../types';
import { buildQuizPrompts, FlashcardQuizPrompt } from './gameQuestionUtils';
import { playGameTone } from './gameSound';
import { RecordGameResultInput } from './gameProgression';

interface ClassicLiveGameProps {
  deck: FlashcardDeck;
  allDecks: FlashcardDeck[];
  studentName?: string;
  onComplete: (result: RecordGameResultInput) => void;
  onExitToHub: () => void;
}

interface Racer {
  id: string;
  name: string;
  initials: string;
  laneColor: string;
  trackBg: string;
  progress: number; // 0..12
  score: number;
  streak: number;
  isMe?: boolean;
}

const TARGET_GOAL = 12;

export const ClassicLiveGame: React.FC<ClassicLiveGameProps> = ({
  deck,
  allDecks,
  studentName,
  onComplete,
  onExitToHub
}) => {
  const [stage, setStage] = useState<'lobby' | 'playing' | 'summary'>('lobby');
  const [prompts, setPrompts] = useState<FlashcardQuizPrompt[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [countdown, setCountdown] = useState(12);
  const [selectedAns, setSelectedAns] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [racers, setRacers] = useState<Racer[]>([]);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctTotal, setCorrectTotal] = useState(0);
  const [answeredTotal, setAnsweredTotal] = useState(0);
  const [missedLog, setMissedLog] = useState<{ front: string; back: string }[]>([]);
  const [startTimeMs, setStartTimeMs] = useState<number>(Date.now());
  const reportedRef = useRef(false);

  const initRacers = (): Racer[] => [
    {
      id: 'me',
      name: `${studentName || 'Bạn'} (Bạn)`,
      initials: 'BN',
      laneColor: 'from-indigo-500 to-blue-600',
      trackBg: 'bg-indigo-500/15',
      progress: 0,
      score: 0,
      streak: 0,
      isMe: true
    },
    {
      id: 'bot1',
      name: 'Minh Anh',
      initials: 'MA',
      laneColor: 'from-amber-400 to-orange-500',
      trackBg: 'bg-amber-500/15',
      progress: 0,
      score: 0,
      streak: 0
    },
    {
      id: 'bot2',
      name: 'Hoàng Long',
      initials: 'HL',
      laneColor: 'from-rose-500 to-pink-500',
      trackBg: 'bg-rose-500/15',
      progress: 0,
      score: 0,
      streak: 0
    },
    {
      id: 'bot3',
      name: 'Bảo Trâm',
      initials: 'BT',
      laneColor: 'from-emerald-500 to-teal-500',
      trackBg: 'bg-emerald-500/15',
      progress: 0,
      score: 0,
      streak: 0
    }
  ];

  const startRace = () => {
    const generated = buildQuizPrompts(deck, allDecks, 32);
    setPrompts(generated);
    setQIdx(0);
    setCountdown(12);
    setSelectedAns(null);
    setAnswerFeedback(null);
    setRacers(initRacers());
    setMaxCombo(0);
    setCorrectTotal(0);
    setAnsweredTotal(0);
    setMissedLog([]);
    setStartTimeMs(Date.now());
    reportedRef.current = false;
    setStage('playing');
  };

  useEffect(() => {
    setRacers(initRacers());
  }, [deck.id]);

  // Countdown tick
  useEffect(() => {
    if (stage !== 'playing' || answerFeedback !== null) return;
    const t = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleAnswer('__timeout__');
          return 12;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stage, answerFeedback, qIdx]);

  const currentPrompt = prompts[qIdx % Math.max(1, prompts.length)];

  const finishGame = (finalRacers: Racer[], finalCorrect: number, finalAnswered: number, finalMaxCombo: number) => {
    setStage('summary');
    playGameTone('victory');
    if (reportedRef.current) return;
    reportedRef.current = true;

    const sorted = [...finalRacers].sort((a, b) => {
      if (a.progress !== b.progress) return b.progress - a.progress;
      return b.score - a.score;
    });
    const me = finalRacers.find((r) => r.isMe);
    const won = sorted[0]?.isMe ?? false;
    const accuracy = finalAnswered > 0 ? Math.round((finalCorrect / finalAnswered) * 100) : 100;

    onComplete({
      gameId: 'classic_live',
      gameTitle: 'Classic Live Race',
      deckTitle: deck.title,
      score: me?.score || 0,
      accuracy,
      maxCombo: finalMaxCombo,
      durationSec: Math.max(5, Math.round((Date.now() - startTimeMs) / 1000)),
      won
    });
  };

  const handleAnswer = (chosen: string) => {
    if (stage !== 'playing' || answerFeedback !== null || !currentPrompt) return;
    const isCorrect = chosen === currentPrompt.correctAnswer;
    setSelectedAns(chosen);
    setAnswerFeedback(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      playGameTone('match');
    } else {
      playGameTone('wrong');
      setMissedLog((prev) => {
        if (prev.some((m) => m.front === currentPrompt.prompt)) return prev;
        return [...prev, { front: currentPrompt.prompt, back: currentPrompt.correctAnswer }];
      });
    }

    const nextAnswered = answeredTotal + 1;
    const nextCorrect = isCorrect ? correctTotal + 1 : correctTotal;
    setAnsweredTotal(nextAnswered);
    setCorrectTotal(nextCorrect);

    let nextMaxCombo = maxCombo;
    const updatedRacers = racers.map((r) => {
      if (r.isMe) {
        const nextStreak = isCorrect ? r.streak + 1 : 0;
        nextMaxCombo = Math.max(nextMaxCombo, nextStreak);
        // Classic Live streak mechanic: wrong answer drops progress back by 2 (or resets streak pressure without being overly punishing)
        const nextProgress = isCorrect
          ? Math.min(TARGET_GOAL, r.progress + 1)
          : Math.max(0, r.progress - 1);
        const pts = isCorrect ? Math.round(140 + countdown * 10 + nextStreak * 20) : 0;
        return { ...r, progress: nextProgress, score: r.score + pts, streak: nextStreak };
      }

      const botCorrect = Math.random() > 0.34;
      const botStreak = botCorrect ? r.streak + 1 : 0;
      const botProgress = botCorrect
        ? Math.min(TARGET_GOAL, r.progress + 1)
        : Math.max(0, r.progress - 1);
      const botPts = botCorrect ? Math.round(120 + Math.random() * 80) : 0;
      return { ...r, progress: botProgress, score: r.score + botPts, streak: botStreak };
    });

    setMaxCombo(nextMaxCombo);
    setRacers(updatedRacers);

    const someoneFinished = updatedRacers.some((r) => r.progress >= TARGET_GOAL);

    setTimeout(() => {
      if (someoneFinished || nextAnswered >= 20) {
        finishGame(updatedRacers, nextCorrect, nextAnswered, nextMaxCombo);
      } else {
        setQIdx((i) => i + 1);
        setSelectedAns(null);
        setAnswerFeedback(null);
        setCountdown(12);
      }
    }, 950);
  };

  const optionStyles = [
    { symbol: '▲', cls: 'from-rose-500 to-red-600 text-white border-rose-400/50' },
    { symbol: '◆', cls: 'from-blue-500 to-indigo-600 text-white border-indigo-400/50' },
    { symbol: '●', cls: 'from-amber-400 to-yellow-500 text-slate-950 border-amber-300/70' },
    { symbol: '■', cls: 'from-emerald-500 to-teal-600 text-white border-emerald-400/50' }
  ];

  const sortedRacers = useMemo(() => {
    return [...racers].sort((a, b) => {
      if (a.progress !== b.progress) return b.progress - a.progress;
      return b.score - a.score;
    });
  }, [racers]);

  if (stage === 'lobby') {
    return (
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 text-center space-y-6 max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25">
          <Crown className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-indigo-600 dark:text-cyan-300">Đường đua Classic Live · 4 Người chơi</p>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Chinh phục 12 câu đúng trước đối thủ
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Mỗi câu trả lời đúng đẩy nhân vật tiến 1 bước về đích 12/12. Trả lời sai sẽ bị lùi 1 bước.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-950 text-white p-5 max-w-xs mx-auto space-y-1 border border-indigo-500/30">
          <div className="text-[11px] font-semibold text-indigo-300">Mã phòng thi trực tiếp</div>
          <div className="font-mono text-3xl font-black tracking-wider text-amber-300 tabular-nums">839-204</div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={startRace}
            className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/25 cursor-pointer whitespace-nowrap"
          >
            Bắt đầu đường đua
          </button>
          <button
            type="button"
            onClick={onExitToHub}
            className="px-5 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            Chọn game khác
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'summary') {
    const winner = sortedRacers[0];
    return (
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-500 flex items-center justify-center mx-auto">
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {winner?.isMe ? 'Bạn đã về Nhất Classic Live!' : `${winner?.name} về đích đầu tiên`}
          </h3>
          <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Độ chính xác: {answeredTotal > 0 ? Math.round((correctTotal / answeredTotal) * 100) : 100}% · Combo tối đa x{maxCombo}
          </p>
        </div>

        <div className="max-w-xl mx-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          {sortedRacers.map((r, idx) => (
            <div
              key={r.id}
              className={`px-4 py-3 flex items-center justify-between text-xs ${
                r.isMe ? 'bg-indigo-50/80 dark:bg-indigo-950/40 font-bold' : 'bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-extrabold text-slate-500 w-6">#{idx + 1}</span>
                <span className="text-slate-900 dark:text-white">{r.name}</span>
              </div>
              <div className="flex items-center gap-4 font-mono tabular-nums">
                <span className="text-indigo-600 dark:text-cyan-300 font-bold">
                  {r.progress}/{TARGET_GOAL} bước
                </span>
                <span className="text-slate-600 dark:text-slate-300">{r.score} đ</span>
              </div>
            </div>
          ))}
        </div>

        {missedLog.length > 0 && (
          <div className="max-w-xl mx-auto rounded-2xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">Thuật ngữ cần củng cố</h4>
            <div className="space-y-1">
              {missedLog.map((m, i) => (
                <div key={i} className="text-xs flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-800 dark:text-white">{m.front}</span>
                  <span className="text-slate-500 dark:text-slate-400 truncate">{m.back}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={startRace}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-extrabold cursor-pointer whitespace-nowrap flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Đua lại trận mới</span>
          </button>
          <button
            type="button"
            onClick={onExitToHub}
            className="px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer whitespace-nowrap flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Chọn game khác</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 4 Colorful Horizontal Race Lanes (inspired by Image 3 Classic Live) */}
      <div className="rounded-3xl border border-indigo-200/70 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/70 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
            <Users className="w-4 h-4 text-indigo-600 dark:text-cyan-300" />
            <span>Đường đua về đích ({TARGET_GOAL} bước)</span>
          </div>
          <div className="flex items-center gap-4 font-mono tabular-nums font-bold">
            <span className="text-amber-600 dark:text-amber-300 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {countdown}s
            </span>
            <span className="text-indigo-600 dark:text-cyan-300 flex items-center gap-1">
              <Flame className="w-4 h-4" />
              Chuỗi {racers.find((r) => r.isMe)?.streak || 0}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {racers.map((r) => {
            const pct = Math.min(100, Math.round((r.progress / TARGET_GOAL) * 100));
            return (
              <div key={r.id} className="flex items-center gap-3">
                <div className="w-28 sm:w-36 truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                  {r.name}
                </div>
                <div className={`flex-1 h-7 rounded-full ${r.trackBg} relative overflow-hidden flex items-center px-1`}>
                  <div
                    className={`h-5 rounded-full bg-gradient-to-r ${r.laneColor} transition-all duration-300 flex items-center justify-end pr-1.5 shadow-sm`}
                    style={{ width: `max(2.25rem, ${pct}%)` }}
                  >
                    <span className="text-[10px] font-mono font-extrabold text-white">{r.initials}</span>
                  </div>
                </div>
                <span className="w-12 text-right font-mono tabular-nums text-xs font-bold text-slate-600 dark:text-slate-300">
                  {r.progress}/{TARGET_GOAL}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prompt Card */}
      {currentPrompt && (
        <div className="rounded-3xl bg-gradient-to-br from-[#06142e] via-[#0c244f] to-[#133875] text-white p-7 sm:p-8 text-center space-y-2 border border-cyan-400/25 shadow-xl">
          <div className="text-xs font-semibold text-cyan-300">
            Câu hỏi {answeredTotal + 1} · Chọn định nghĩa đúng
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-balance">
            {currentPrompt.prompt}
          </h3>
        </div>
      )}

      {/* 4 Option Tiles */}
      {currentPrompt && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {currentPrompt.options.map((opt, idx) => {
            const st = optionStyles[idx % optionStyles.length];
            const isSelected = selectedAns === opt;
            const isCorrectOpt = opt === currentPrompt.correctAnswer;

            let ringClass = '';
            if (answerFeedback !== null) {
              if (isCorrectOpt) ringClass = 'ring-4 ring-emerald-400 scale-[1.01]';
              else if (isSelected) ringClass = 'ring-4 ring-rose-400 opacity-85';
              else ringClass = 'opacity-50';
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={answerFeedback !== null}
                onClick={() => handleAnswer(opt)}
                className={`p-5 rounded-2xl bg-gradient-to-br ${st.cls} border font-bold text-sm text-left flex items-center justify-between gap-3 shadow-md transition-all duration-150 cursor-pointer active:scale-[0.98] ${ringClass}`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="text-lg shrink-0">{st.symbol}</span>
                  <span className="leading-snug line-clamp-2">{opt}</span>
                </div>
                {answerFeedback !== null && isCorrectOpt && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                {answerFeedback !== null && isSelected && !isCorrectOpt && <XCircle className="w-5 h-5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
