import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Rocket,
  Clock,
  Flame,
  Shield,
  Trophy,
  RotateCcw,
  ArrowLeft,
  Sparkles,
  Users
} from 'lucide-react';
import { FlashcardDeck } from '../../types';
import { buildQuizPrompts, FlashcardQuizPrompt } from './gameQuestionUtils';
import { playGameTone } from './gameSound';
import { RecordGameResultInput } from './gameProgression';

interface BlastGameProps {
  deck: FlashcardDeck;
  allDecks: FlashcardDeck[];
  mode: 'solo' | 'arena';
  studentName?: string;
  onComplete: (result: RecordGameResultInput) => void;
  onExitToHub: () => void;
}

interface AsteroidItem {
  id: string;
  text: string;
  isCorrect: boolean;
  x: number; // percentage 16..84
  y: number; // percentage 18..68
  size: number;
  status: 'active' | 'shattered' | 'wrong';
}

interface LaserShot {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
}

interface ArenaPod {
  id: string;
  name: string;
  initials: string;
  cornerX: number;
  cornerY: number;
  color: string;
  score: number;
  isMe?: boolean;
}

const TOTAL_DURATION_SEC = 45;

export const BlastGame: React.FC<BlastGameProps> = ({
  deck,
  allDecks,
  mode,
  studentName,
  onComplete,
  onExitToHub
}) => {
  const [stage, setStage] = useState<'playing' | 'summary'>('playing');
  const [prompts, setPrompts] = useState<FlashcardQuizPrompt[]>([]);
  const [waveIdx, setWaveIdx] = useState(0);
  const [asteroids, setAsteroids] = useState<AsteroidItem[]>([]);
  const [laser, setLaser] = useState<LaserShot | null>(null);
  const [timeLeft, setTimeLeft] = useState(TOTAL_DURATION_SEC);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [shield, setShield] = useState(3);
  const [shipAngle, setShipAngle] = useState(0);
  const [pods, setPods] = useState<ArenaPod[]>([]);
  const reportedRef = useRef(false);

  const buildAsteroidsForWave = (prompt: FlashcardQuizPrompt): AsteroidItem[] => {
    const slots = [
      { x: 24, y: 26 },
      { x: 74, y: 26 },
      { x: 26, y: 58 },
      { x: 74, y: 58 }
    ].sort(() => Math.random() - 0.5);

    return prompt.options.map((opt, idx) => ({
      id: `ast_${waveIdx}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      text: opt,
      isCorrect: opt === prompt.correctAnswer,
      x: slots[idx].x + (Math.random() * 6 - 3),
      y: slots[idx].y + (Math.random() * 5 - 2.5),
      size: 112,
      status: 'active'
    }));
  };

  const startNewGame = () => {
    const list = buildQuizPrompts(deck, allDecks, 30);
    setPrompts(list);
    setWaveIdx(0);
    setTimeLeft(TOTAL_DURATION_SEC);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setHits(0);
    setAttempts(0);
    setShield(3);
    setLaser(null);
    setShipAngle(0);
    reportedRef.current = false;

    if (list.length > 0) {
      setAsteroids(buildAsteroidsForWave(list[0]));
    } else {
      setAsteroids([]);
    }

    if (mode === 'arena') {
      setPods([
        { id: 'me', name: `${studentName || 'Bạn'} (Bạn)`, initials: 'BN', cornerX: 8, cornerY: 14, color: '#e879f9', score: 0, isMe: true },
        { id: 'b1', name: 'Minh Anh', initials: 'MA', cornerX: 92, cornerY: 14, color: '#38bdf8', score: 0 },
        { id: 'b2', name: 'Hoàng Long', initials: 'HL', cornerX: 8, cornerY: 86, color: '#34d399', score: 0 },
        { id: 'b3', name: 'Bảo Trâm', initials: 'BT', cornerX: 92, cornerY: 86, color: '#fb923c', score: 0 }
      ]);
    } else {
      setPods([]);
    }
    setStage('playing');
  };

  useEffect(() => {
    startNewGame();
  }, [deck.id, mode]);

  const finishGame = (finalScore: number, finalHits: number, finalAttempts: number, finalMaxCombo: number, finalPods: ArenaPod[]) => {
    setStage('summary');
    playGameTone('victory');
    if (reportedRef.current) return;
    reportedRef.current = true;

    const accuracy = finalAttempts > 0 ? Math.round((finalHits / finalAttempts) * 100) : 100;
    const sortedPods = [...finalPods].sort((a, b) => b.score - a.score);
    const won = mode === 'arena' ? (sortedPods[0]?.isMe ?? false) : finalHits >= 4;

    onComplete({
      gameId: mode === 'arena' ? 'blast_arena' : 'blast',
      gameTitle: mode === 'arena' ? 'Blast Space Arena' : 'Blast Asteroids',
      deckTitle: deck.title,
      score: finalScore,
      accuracy,
      maxCombo: finalMaxCombo,
      durationSec: TOTAL_DURATION_SEC - timeLeft,
      won
    });
  };

  // Timer countdown
  useEffect(() => {
    if (stage !== 'playing') return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finishGame(score, hits, attempts, maxCombo, pods);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stage, score, hits, attempts, maxCombo, pods]);

  // Bot firing in Blast Arena
  useEffect(() => {
    if (stage !== 'playing' || mode !== 'arena') return;
    const botTick = setInterval(() => {
      setPods((prev) =>
        prev.map((p) => {
          if (p.isMe) return p;
          if (Math.random() > 0.48) {
            return { ...p, score: p.score + Math.round(110 + Math.random() * 90) };
          }
          return p;
        })
      );
    }, 2600);
    return () => clearInterval(botTick);
  }, [stage, mode]);

  const currentPrompt = prompts[waveIdx % Math.max(1, prompts.length)];

  const handleBlastAsteroid = (ast: AsteroidItem) => {
    if (stage !== 'playing' || ast.status !== 'active') return;

    const originX = mode === 'arena' ? 8 : 50;
    const originY = mode === 'arena' ? 14 : 88;
    const dx = ast.x - originX;
    const dy = ast.y - originY;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    setShipAngle(deg);

    playGameTone('laser');
    setLaser({
      fromX: originX,
      fromY: originY,
      toX: ast.x,
      toY: ast.y,
      color: ast.isCorrect ? '#22d3ee' : '#fb7185'
    });
    setTimeout(() => setLaser(null), 240);

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (ast.isCorrect) {
      playGameTone('shatter');
      const nextCombo = combo + 1;
      const nextMax = Math.max(maxCombo, nextCombo);
      const pts = 160 + (nextCombo - 1) * 40;
      const nextScore = score + pts;
      const nextHits = hits + 1;

      setCombo(nextCombo);
      setMaxCombo(nextMax);
      setScore(nextScore);
      setHits(nextHits);
      setAsteroids((prev) => prev.map((a) => (a.id === ast.id ? { ...a, status: 'shattered' } : a)));

      const nextPods = pods.map((p) => (p.isMe ? { ...p, score: nextScore } : p));
      setPods(nextPods);

      setTimeout(() => {
        const nextWave = waveIdx + 1;
        setWaveIdx(nextWave);
        const np = prompts[nextWave % Math.max(1, prompts.length)];
        if (np) setAsteroids(buildAsteroidsForWave(np));
      }, 360);
    } else {
      playGameTone('wrong');
      setCombo(0);
      setAsteroids((prev) => prev.map((a) => (a.id === ast.id ? { ...a, status: 'wrong' } : a)));
      if (mode === 'solo') {
        const nextShield = shield - 1;
        setShield(nextShield);
        if (nextShield <= 0) {
          setTimeout(() => finishGame(score, hits, nextAttempts, maxCombo, pods), 320);
        }
      }
    }
  };

  const sortedPods = useMemo(() => [...pods].sort((a, b) => b.score - a.score), [pods]);

  if (stage === 'summary') {
    return (
      <div className="rounded-3xl border border-indigo-900/50 bg-[#120b36] text-white p-8 space-y-6">
        <div className="text-center space-y-2 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center mx-auto shadow-lg shadow-amber-400/25">
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-extrabold">
            {mode === 'arena' && sortedPods[0]?.isMe
              ? 'Quán quân Blast Space Arena!'
              : 'Nhiệm vụ Không gian Hoàn tất!'}
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-mono tabular-nums pt-1">
            <span className="text-cyan-300 font-extrabold">{score.toLocaleString()} điểm</span>
            <span className="text-indigo-400">·</span>
            <span className="text-emerald-300 font-bold">{hits} thiên thạch phá hủy</span>
            <span className="text-indigo-400">·</span>
            <span className="text-amber-300 font-bold">Combo x{maxCombo}</span>
          </div>
        </div>

        {mode === 'arena' && (
          <div className="max-w-lg mx-auto rounded-2xl border border-indigo-400/25 bg-white/5 divide-y divide-white/10 overflow-hidden">
            {sortedPods.map((p, idx) => (
              <div
                key={p.id}
                className={`px-4 py-3 flex items-center justify-between text-xs ${
                  p.isMe ? 'bg-cyan-500/15 font-bold' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-indigo-300 w-5">#{idx + 1}</span>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span>{p.name}</span>
                </div>
                <span className="font-mono tabular-nums font-bold text-cyan-200">{p.score.toLocaleString()} đ</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={startNewGame}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 text-xs font-extrabold cursor-pointer whitespace-nowrap flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Bắn lại màn mới</span>
          </button>
          <button
            type="button"
            onClick={onExitToHub}
            className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer whitespace-nowrap flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Chọn game khác</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Space HUD */}
      <div className="rounded-2xl border border-indigo-500/30 bg-[#140d3b] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 text-amber-300 flex items-center justify-center shrink-0">
            <Rocket className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-base font-extrabold truncate">
              {mode === 'arena' ? 'Blast Space Arena (4 Phi thuyền)' : 'Blast — Bắn Thiên Thạch'}
            </h3>
            <p className="text-xs text-indigo-200/80 truncate">
              Chọn thiên thạch mang định nghĩa đúng để khai hỏa tia laser
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs font-mono tabular-nums">
          {mode === 'solo' && (
            <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
              <Shield className="w-4 h-4 shrink-0" />
              <span>Giáp: {shield}/3</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
            <Clock className="w-4 h-4 shrink-0" />
            <span>{timeLeft}s</span>
          </div>
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
            <Flame className="w-4 h-4 shrink-0" />
            <span>Combo x{Math.max(1, combo)}</span>
          </div>
          <div className="font-extrabold text-white">{score.toLocaleString()} đ</div>
          <button
            type="button"
            onClick={startNewGame}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-sans font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Chơi lại</span>
          </button>
        </div>
      </div>

      {/* Arena Score Strip for Multiplayer */}
      {mode === 'arena' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sortedPods.map((p, idx) => (
            <div
              key={p.id}
              className="rounded-xl bg-[#160f42] border border-indigo-400/25 px-3.5 py-2.5 text-white flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="font-bold truncate">
                  #{idx + 1} {p.name}
                </span>
              </div>
              <span className="font-mono tabular-nums font-bold text-cyan-300 shrink-0">{p.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Target Term Banner */}
      {currentPrompt && (
        <div className="rounded-2xl bg-[#1a114d] border border-cyan-400/35 px-6 py-4 text-center text-white">
          <div className="text-[11px] font-semibold text-cyan-300">Mục tiêu khóa tia laser · Đợt {waveIdx + 1}</div>
          <div className="font-display text-xl sm:text-2xl font-extrabold mt-0.5">{currentPrompt.prompt}</div>
        </div>
      )}

      {/* Deep-Space Canvas Viewport */}
      <div className="relative h-[430px] sm:h-[460px] rounded-3xl overflow-hidden border border-indigo-500/40 bg-[radial-gradient(circle_at_50%_35%,#29196e_0%,#140b38_55%,#09051f_100%)] select-none">
        {/* Starfield backdrop */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-65" viewBox="0 0 800 460" preserveAspectRatio="none">
          {[
            [60, 45, 1.5], [140, 120, 1], [220, 50, 2], [320, 95, 1.2], [440, 40, 1.8],
            [560, 110, 1.3], [670, 55, 2], [740, 140, 1.1], [95, 290, 1.6], [190, 380, 1.2],
            [620, 310, 1.8], [710, 390, 1.3], [400, 230, 1.1], [500, 350, 1.6]
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="#cbd5f5" />
          ))}
        </svg>

        {/* Active Laser Beam SVG */}
        {laser && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1={laser.fromX}
              y1={laser.fromY}
              x2={laser.toX}
              y2={laser.toY}
              stroke={laser.color}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx={laser.toX} cy={laser.toY} r="3.4" fill={laser.color} opacity="0.65" />
          </svg>
        )}

        {/* Asteroid Targets */}
        {asteroids.map((ast) => {
          const isShattered = ast.status === 'shattered';
          const isWrong = ast.status === 'wrong';
          return (
            <button
              key={ast.id}
              type="button"
              disabled={ast.status !== 'active'}
              onClick={() => handleBlastAsteroid(ast)}
              style={{ left: `${ast.x}%`, top: `${ast.y}%`, transform: 'translate(-50%, -50%)' }}
              className={`absolute z-10 w-36 sm:w-44 min-h-[96px] p-3.5 rounded-full border-2 flex items-center justify-center text-center transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                isShattered
                  ? 'scale-125 opacity-0 border-cyan-300 bg-cyan-400/30 text-white'
                  : isWrong
                  ? 'border-rose-500 bg-rose-950/85 text-rose-200 opacity-55 scale-90'
                  : 'border-indigo-400/60 bg-gradient-to-br from-[#372587] to-[#23145e] hover:border-cyan-300 hover:scale-105 text-white shadow-[0_12px_28px_rgba(12,6,48,0.65)]'
              }`}
            >
              <span className="text-xs font-bold leading-snug line-clamp-3">{ast.text}</span>
            </button>
          );
        })}

        {/* Solo Blaster Turret (Bottom Center matching Image 2) */}
        {mode === 'solo' && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 transition-transform duration-150 pointer-events-none"
            style={{ transform: `translateX(-50%) rotate(${shipAngle * 0.45}deg)` }}
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-b from-lime-300 to-emerald-400 border-4 border-indigo-950 flex items-center justify-center shadow-[0_0_24px_rgba(163,230,53,0.45)]">
              <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Arena 4 Corner Pods (matching Image 3 Blast Arena) */}
        {mode === 'arena' &&
          pods.map((pod) => (
            <div
              key={pod.id}
              style={{ left: `${pod.cornerX}%`, top: `${pod.cornerY}%`, transform: 'translate(-50%, -50%)', borderColor: pod.color }}
              className="absolute z-20 w-12 h-12 rounded-full bg-slate-900/90 border-4 flex items-center justify-center text-white text-[11px] font-mono font-extrabold shadow-lg pointer-events-none"
            >
              {pod.initials}
            </div>
          ))}
      </div>
    </div>
  );
};
