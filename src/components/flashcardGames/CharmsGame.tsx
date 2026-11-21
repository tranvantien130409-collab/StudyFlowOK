import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Trophy,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  Plus,
  Flame
} from 'lucide-react';
import { FlashcardDeck } from '../../types';
import { buildQuizPrompts, FlashcardQuizPrompt } from './gameQuestionUtils';
import { playGameTone } from './gameSound';
import { RecordGameResultInput } from './gameProgression';

interface CharmsGameProps {
  deck: FlashcardDeck;
  allDecks: FlashcardDeck[];
  onComplete: (result: RecordGameResultInput) => void;
  onExitToHub: () => void;
}

type CharmType = 0 | 1 | 2 | 3 | 4;

const BOARD_SIZE = 6;

const CHARM_META: Record<
  CharmType,
  { symbol: string; label: string; bg: string; border: string; text: string }
> = {
  0: { symbol: '●', label: 'Hồng ngọc', bg: 'bg-pink-200 dark:bg-pink-500/25', border: 'border-pink-400/70', text: 'text-pink-700 dark:text-pink-200' },
  1: { symbol: '⬟', label: 'Khiên ngọc', bg: 'bg-emerald-200 dark:bg-emerald-500/25', border: 'border-emerald-400/70', text: 'text-emerald-700 dark:text-emerald-200' },
  2: { symbol: '◆', label: 'Lam ngọc', bg: 'bg-sky-200 dark:bg-sky-500/25', border: 'border-sky-400/70', text: 'text-sky-700 dark:text-sky-200' },
  3: { symbol: '⬢', label: 'Hổ phách', bg: 'bg-amber-200 dark:bg-amber-500/25', border: 'border-amber-400/70', text: 'text-amber-800 dark:text-amber-200' },
  4: { symbol: '★', label: 'Tinh tú', bg: 'bg-violet-200 dark:bg-violet-500/25', border: 'border-violet-400/70', text: 'text-violet-700 dark:text-violet-200' }
};

const randomCharm = (): CharmType => Math.floor(Math.random() * 5) as CharmType;

function findMatches(board: CharmType[][]): Set<string> {
  const matched = new Set<string>();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      const v = board[r][c];
      if (v === board[r][c + 1] && v === board[r][c + 2]) {
        matched.add(`${r},${c}`);
        matched.add(`${r},${c + 1}`);
        matched.add(`${r},${c + 2}`);
      }
    }
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      const v = board[r][c];
      if (v === board[r + 1][c] && v === board[r + 2][c]) {
        matched.add(`${r},${c}`);
        matched.add(`${r + 1},${c}`);
        matched.add(`${r + 2},${c}`);
      }
    }
  }
  return matched;
}

function createCleanBoard(): CharmType[][] {
  const b: CharmType[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => randomCharm())
  );
  let guard = 0;
  while (findMatches(b).size > 0 && guard < 20) {
    const m = findMatches(b);
    m.forEach((key) => {
      const [r, c] = key.split(',').map(Number);
      b[r][c] = randomCharm();
    });
    guard++;
  }
  return b;
}

export const CharmsGame: React.FC<CharmsGameProps> = ({ deck, allDecks, onComplete, onExitToHub }) => {
  const [stage, setStage] = useState<'playing' | 'summary'>('playing');
  const [board, setBoard] = useState<CharmType[][]>(createCleanBoard);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [moves, setMoves] = useState(5);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [prompts, setPrompts] = useState<FlashcardQuizPrompt[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [correctQuiz, setCorrectQuiz] = useState(0);
  const [totalQuiz, setTotalQuiz] = useState(0);
  const [startTimeMs, setStartTimeMs] = useState(Date.now());
  const reportedRef = useRef(false);

  const resetCharms = () => {
    setBoard(createCleanBoard());
    setSelected(null);
    setMoves(5);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPrompts(buildQuizPrompts(deck, allDecks, 24));
    setQIdx(0);
    setQuizFeedback(null);
    setCorrectQuiz(0);
    setTotalQuiz(0);
    setStartTimeMs(Date.now());
    reportedRef.current = false;
    setStage('playing');
  };

  useEffect(() => {
    resetCharms();
  }, [deck.id]);

  const finishCharms = () => {
    setStage('summary');
    playGameTone('victory');
    if (reportedRef.current) return;
    reportedRef.current = true;
    const accuracy = totalQuiz > 0 ? Math.round((correctQuiz / totalQuiz) * 100) : 100;
    onComplete({
      gameId: 'charms',
      gameTitle: 'Charms Match-3',
      deckTitle: deck.title,
      score,
      accuracy,
      maxCombo,
      durationSec: Math.max(8, Math.round((Date.now() - startTimeMs) / 1000)),
      won: score >= 450
    });
  };

  const resolveCascades = (initialBoard: CharmType[][]) => {
    let working = initialBoard.map((r) => [...r]);
    let totalCleared = 0;
    let chain = 0;

    while (chain < 8) {
      const matched = findMatches(working);
      if (matched.size === 0) break;
      chain++;
      totalCleared += matched.size;

      // Collapse columns downwards
      for (let c = 0; c < BOARD_SIZE; c++) {
        const kept: CharmType[] = [];
        for (let r = BOARD_SIZE - 1; r >= 0; r--) {
          if (!matched.has(`${r},${c}`)) kept.push(working[r][c]);
        }
        while (kept.length < BOARD_SIZE) kept.push(randomCharm());
        for (let r = BOARD_SIZE - 1, k = 0; r >= 0; r--, k++) {
          working[r][c] = kept[k];
        }
      }
    }

    return { nextBoard: working, totalCleared, chains: chain };
  };

  const handleCellClick = (r: number, c: number) => {
    if (stage !== 'playing' || moves <= 0) return;

    if (!selected) {
      playGameTone('block_place');
      setSelected([r, c]);
      return;
    }

    const [sr, sc] = selected;
    if (sr === r && sc === c) {
      setSelected(null);
      return;
    }

    const isAdjacent = Math.abs(sr - r) + Math.abs(sc - c) === 1;
    if (!isAdjacent) {
      setSelected([r, c]);
      return;
    }

    // Try swap
    const swapped = board.map((row) => [...row]);
    const tmp = swapped[sr][sc];
    swapped[sr][sc] = swapped[r][c];
    swapped[r][c] = tmp;

    const initialMatches = findMatches(swapped);
    if (initialMatches.size === 0) {
      playGameTone('wrong');
      setSelected(null);
      return;
    }

    playGameTone('charm_pop');
    const { nextBoard, totalCleared, chains } = resolveCascades(swapped);
    const pts = totalCleared * 35 + (chains > 1 ? chains * 60 : 0);
    setBoard(nextBoard);
    setSelected(null);
    setMoves((m) => Math.max(0, m - 1));
    setScore((s) => s + pts);
    setCombo((cb) => {
      const nxt = cb + chains;
      setMaxCombo((mx) => Math.max(mx, nxt));
      return nxt;
    });
  };

  const activeQuiz = prompts[qIdx % Math.max(1, prompts.length)];

  const handleAnswerEarnMoves = (opt: string) => {
    if (!activeQuiz || quizFeedback !== null) return;
    const isCorrect = opt === activeQuiz.correctAnswer;
    setQuizFeedback(isCorrect ? 'correct' : 'wrong');
    setTotalQuiz((t) => t + 1);

    if (isCorrect) {
      playGameTone('match');
      setCorrectQuiz((c) => c + 1);
      setMoves((m) => m + 3);
      setScore((s) => s + 80);
      setCombo((cb) => {
        const nxt = cb + 1;
        setMaxCombo((mx) => Math.max(mx, nxt));
        return nxt;
      });
    } else {
      playGameTone('wrong');
      setCombo(0);
    }

    setTimeout(() => {
      setQuizFeedback(null);
      setQIdx((q) => q + 1);
    }, 680);
  };

  if (stage === 'summary') {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-5 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-400 to-cyan-500 text-white flex items-center justify-center mx-auto shadow-lg">
          <Trophy className="w-8 h-8" />
        </div>
        <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Tổng kết Charms Match-3
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-mono tabular-nums">
          <span className="font-extrabold text-sky-600 dark:text-cyan-300">{score.toLocaleString()} điểm</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="font-bold text-amber-600 dark:text-amber-300">Combo x{maxCombo}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={resetCharms}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-extrabold cursor-pointer whitespace-nowrap flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Chơi lại</span>
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
      {/* HUD */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-sky-400/20 border border-sky-400/40 text-sky-600 dark:text-cyan-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white truncate">
              Charms — Ghép 3 &amp; Tích Lượt Đi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Trả lời câu hỏi bên phải để kiếm thêm lượt đi, hoán đổi 2 viên kề nhau tạo hàng 3+
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs font-mono tabular-nums">
          <span className={`font-bold ${moves > 0 ? 'text-sky-600 dark:text-cyan-300' : 'text-rose-500'}`}>
            Lượt đi: {moves}
          </span>
          <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-300">
            <Flame className="w-4 h-4" />
            Combo x{Math.max(1, combo)}
          </span>
          <span className="font-extrabold text-slate-900 dark:text-white">{score.toLocaleString()} điểm</span>
          <button
            type="button"
            onClick={finishCharms}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-sans font-bold text-xs cursor-pointer whitespace-nowrap"
          >
            Kết thúc &amp; Lưu điểm
          </button>
        </div>
      </div>

      {/* Board (left) + Earn Moves Flashcard Panel (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-3xl border border-sky-200/80 dark:border-slate-800 bg-sky-300/35 dark:bg-slate-900 p-4 sm:p-6 flex flex-col items-center gap-3">
          {moves === 0 && (
            <div className="text-xs font-bold text-sky-900 dark:text-cyan-200 bg-white/80 dark:bg-slate-800 px-4 py-2 rounded-xl border border-sky-300 dark:border-cyan-500/30">
              Đã hết lượt đi! Trả lời câu hỏi bên phải để nhận ngay +3 lượt đi.
            </div>
          )}

          <div className="grid grid-cols-6 gap-2 w-full max-w-[400px] aspect-square">
            {board.map((row, r) =>
              row.map((charmType, c) => {
                const meta = CHARM_META[charmType];
                const isSel = selected?.[0] === r && selected?.[1] === c;
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    disabled={moves <= 0}
                    onClick={() => handleCellClick(r, c)}
                    className={`rounded-2xl border-2 flex items-center justify-center text-xl sm:text-2xl font-black transition-all duration-150 cursor-pointer active:scale-95 ${
                      meta.bg
                    } ${meta.border} ${meta.text} ${
                      isSel ? 'ring-4 ring-indigo-500 scale-105 shadow-lg' : 'hover:scale-[1.03]'
                    } ${moves <= 0 ? 'opacity-65 cursor-not-allowed' : ''}`}
                    title={meta.label}
                  >
                    {meta.symbol}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Earn Moves Panel */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-600 dark:text-cyan-300 flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Trả lời đúng = +3 lượt đi &amp; +80 điểm</span>
            </span>
          </div>

          {activeQuiz ? (
            <>
              <h4 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                {activeQuiz.prompt}
              </h4>
              <div className="space-y-2.5">
                {activeQuiz.options.map((opt, idx) => {
                  const isCorrectOpt = opt === activeQuiz.correctAnswer;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={quizFeedback !== null}
                      onClick={() => handleAnswerEarnMoves(opt)}
                      className={`w-full p-3.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition ${
                        quizFeedback !== null && isCorrectOpt
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-sky-400'
                      }`}
                    >
                      <span className="line-clamp-2">{opt}</span>
                      {quizFeedback !== null && isCorrectOpt && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">Bộ thẻ hiện tại chưa đủ thẻ để tạo câu hỏi.</p>
          )}
        </div>
      </div>
    </div>
  );
};
