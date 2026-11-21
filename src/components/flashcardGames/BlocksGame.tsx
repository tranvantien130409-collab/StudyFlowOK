import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Grid,
  Sparkles,
  Trophy,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Zap,
  HelpCircle
} from 'lucide-react';
import { FlashcardDeck } from '../../types';
import { buildQuizPrompts, FlashcardQuizPrompt } from './gameQuestionUtils';
import { playGameTone } from './gameSound';
import { RecordGameResultInput } from './gameProgression';

interface BlocksGameProps {
  deck: FlashcardDeck;
  allDecks: FlashcardDeck[];
  onComplete: (result: RecordGameResultInput) => void;
  onExitToHub: () => void;
}

interface BlockShape {
  id: string;
  name: string;
  cells: [number, number][]; // [rowOffset, colOffset]
  colorClass: string;
}

const GRID_SIZE = 8;

const SHAPE_LIBRARY: Omit<BlockShape, 'id'>[] = [
  { name: 'Thanh 3', cells: [[0, 0], [0, 1], [0, 2]], colorClass: 'bg-blue-600 border-blue-400' },
  { name: 'Cột 3', cells: [[0, 0], [1, 0], [2, 0]], colorClass: 'bg-rose-500 border-rose-300' },
  { name: 'Khối 2x2', cells: [[0, 0], [0, 1], [1, 0], [1, 1]], colorClass: 'bg-amber-400 border-amber-200' },
  { name: 'Góc L', cells: [[0, 0], [1, 0], [1, 1]], colorClass: 'bg-indigo-600 border-indigo-400' },
  { name: 'Thanh 2', cells: [[0, 0], [0, 1]], colorClass: 'bg-emerald-500 border-emerald-300' },
  { name: 'Đơn 1x1', cells: [[0, 0]], colorClass: 'bg-cyan-500 border-cyan-300' }
];

const createRandomTray = (): BlockShape[] => {
  return [0, 1, 2].map((i) => {
    const base = SHAPE_LIBRARY[Math.floor(Math.random() * SHAPE_LIBRARY.length)];
    return { ...base, id: `shape_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}` };
  });
};

const createEmptyGrid = (): (string | null)[][] =>
  Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => null));

export const BlocksGame: React.FC<BlocksGameProps> = ({ deck, allDecks, onComplete, onExitToHub }) => {
  const [stage, setStage] = useState<'playing' | 'summary'>('playing');
  const [grid, setGrid] = useState<(string | null)[][]>(createEmptyGrid);
  const [tray, setTray] = useState<BlockShape[]>(createRandomTray);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);
  const [score, setScore] = useState(0);
  const [linesCleared, setLinesCleared] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [movesPlaced, setMovesPlaced] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [prompts, setPrompts] = useState<FlashcardQuizPrompt[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [correctQuiz, setCorrectQuiz] = useState(0);
  const [totalQuiz, setTotalQuiz] = useState(0);
  const [startTimeMs, setStartTimeMs] = useState(Date.now());
  const reportedRef = useRef(false);

  const canPlaceShape = (
    board: (string | null)[][],
    shape: BlockShape,
    r: number,
    c: number
  ): boolean => {
    return shape.cells.every(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      return nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && board[nr][nc] === null;
    });
  };

  const anyMoveAvailable = (board: (string | null)[][], shapes: BlockShape[]): boolean => {
    for (const sh of shapes) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (canPlaceShape(board, sh, r, c)) return true;
        }
      }
    }
    return false;
  };

  const resetGame = () => {
    setGrid(createEmptyGrid());
    setTray(createRandomTray());
    setSelectedIdx(0);
    setHoverCell(null);
    setScore(0);
    setLinesCleared(0);
    setCombo(0);
    setMaxCombo(0);
    setMultiplier(1);
    setMovesPlaced(0);
    setQuizOpen(false);
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
    resetGame();
  }, [deck.id]);

  const finishBlocks = (finalScore: number, finalCorrect: number, finalTotal: number, finalMaxCombo: number) => {
    setStage('summary');
    playGameTone('victory');
    if (reportedRef.current) return;
    reportedRef.current = true;
    const accuracy = finalTotal > 0 ? Math.round((finalCorrect / finalTotal) * 100) : 100;
    onComplete({
      gameId: 'blocks',
      gameTitle: 'Blocks Puzzle',
      deckTitle: deck.title,
      score: finalScore,
      accuracy,
      maxCombo: finalMaxCombo,
      durationSec: Math.max(8, Math.round((Date.now() - startTimeMs) / 1000)),
      won: finalScore >= 300
    });
  };

  const handlePlaceAt = (r: number, c: number) => {
    if (stage !== 'playing' || quizOpen) return;
    const shape = tray[selectedIdx];
    if (!shape || !canPlaceShape(grid, shape, r, c)) {
      playGameTone('wrong');
      return;
    }

    playGameTone('block_place');
    const nextGrid = grid.map((row) => [...row]);
    shape.cells.forEach(([dr, dc]) => {
      nextGrid[r + dr][c + dc] = shape.colorClass;
    });

    // Check full rows & columns
    const fullRows: number[] = [];
    const fullCols: number[] = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      if (nextGrid[i].every((cell) => cell !== null)) fullRows.push(i);
      if (nextGrid.every((row) => row[i] !== null)) fullCols.push(i);
    }

    const clearedCount = fullRows.length + fullCols.length;
    fullRows.forEach((ri) => {
      for (let ci = 0; ci < GRID_SIZE; ci++) nextGrid[ri][ci] = null;
    });
    fullCols.forEach((ci) => {
      for (let ri = 0; ri < GRID_SIZE; ri++) nextGrid[ri][ci] = null;
    });

    if (clearedCount > 0) {
      playGameTone('line_clear');
    }

    const nextCombo = clearedCount > 0 ? combo + clearedCount : combo;
    const nextMaxCombo = Math.max(maxCombo, nextCombo);
    const earnedPts = (shape.cells.length * 15 + clearedCount * 120) * multiplier;
    const nextScore = score + earnedPts;

    setGrid(nextGrid);
    setScore(nextScore);
    setLinesCleared((l) => l + clearedCount);
    setCombo(nextCombo);
    setMaxCombo(nextMaxCombo);
    setHoverCell(null);

    const nextMoves = movesPlaced + 1;
    setMovesPlaced(nextMoves);

    const remainingTray = tray.filter((_, idx) => idx !== selectedIdx);
    const nextTray = remainingTray.length > 0 ? remainingTray : createRandomTray();
    setTray(nextTray);
    setSelectedIdx(0);

    // Every 3 placements, trigger a quick flashcard knowledge check for x2 multiplier & bonus 1x1 block
    if (nextMoves % 3 === 0 && prompts.length > 0) {
      setQuizOpen(true);
      return;
    }

    if (!anyMoveAvailable(nextGrid, nextTray)) {
      finishBlocks(nextScore, correctQuiz, totalQuiz, nextMaxCombo);
    }
  };

  const activeQuiz = prompts[qIdx % Math.max(1, prompts.length)];

  const handleAnswerQuiz = (opt: string) => {
    if (!activeQuiz || quizFeedback !== null) return;
    const isCorrect = opt === activeQuiz.correctAnswer;
    setQuizFeedback(isCorrect ? 'correct' : 'wrong');
    setTotalQuiz((t) => t + 1);

    if (isCorrect) {
      playGameTone('match');
      setCorrectQuiz((c) => c + 1);
      setMultiplier(2);
      setScore((s) => s + 100);
      setCombo((c) => {
        const next = c + 1;
        setMaxCombo((m) => Math.max(m, next));
        return next;
      });
      // Grant a 1x1 Power Wildcard block into tray
      setTray((prev) => [{ ...SHAPE_LIBRARY[5], name: 'Khối Thưởng 1x1', id: `bonus_${Date.now()}` }, ...prev.slice(0, 2)]);
      setSelectedIdx(0);
    } else {
      playGameTone('wrong');
      setMultiplier(1);
    }

    setTimeout(() => {
      setQuizFeedback(null);
      setQuizOpen(false);
      setQIdx((q) => q + 1);
    }, 750);
  };

  const activeShape = tray[selectedIdx];
  const previewSet = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!hoverCell || !activeShape) return map;
    const [hr, hc] = hoverCell;
    const valid = canPlaceShape(grid, activeShape, hr, hc);
    activeShape.cells.forEach(([dr, dc]) => {
      const nr = hr + dr;
      const nc = hc + dc;
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
        map.set(`${nr},${nc}`, valid);
      }
    });
    return map;
  }, [hoverCell, activeShape, grid]);

  if (stage === 'summary') {
    return (
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-5 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center mx-auto shadow-lg">
          <Trophy className="w-8 h-8" />
        </div>
        <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Tổng kết Blocks Puzzle
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-mono tabular-nums">
          <span className="font-extrabold text-indigo-600 dark:text-cyan-300">{score.toLocaleString()} điểm</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{linesCleared} hàng đã xóa</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={resetGame}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-extrabold cursor-pointer whitespace-nowrap flex items-center gap-2"
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
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Grid className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white truncate">
              Blocks — Xếp Khối Trí Tuệ
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Chọn khối bên phải rồi đặt lên bảng 8×8 để xóa hàng/cột
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs font-mono tabular-nums">
          <span className="font-bold text-amber-600 dark:text-amber-300">Nhân điểm x{multiplier}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{linesCleared} hàng xóa</span>
          <span className="font-extrabold text-slate-900 dark:text-white">{score.toLocaleString()} điểm</span>
          <button
            type="button"
            onClick={() => finishBlocks(score, correctQuiz, totalQuiz, maxCombo)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-sans font-bold text-xs cursor-pointer whitespace-nowrap"
          >
            Kết thúc ván
          </button>
        </div>
      </div>

      {/* Main Split: 8x8 Board (left) + Piece Tray / Flashcard Challenge (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-3xl border border-amber-200/80 dark:border-slate-800 bg-amber-100/70 dark:bg-slate-900 p-4 sm:p-6 flex justify-center">
          <div
            onMouseLeave={() => setHoverCell(null)}
            className="grid grid-cols-8 gap-1.5 w-full max-w-[420px] aspect-square"
          >
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const key = `${r},${c}`;
                const preview = previewSet.get(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onMouseEnter={() => setHoverCell([r, c])}
                    onClick={() => handlePlaceAt(r, c)}
                    className={`rounded-lg border transition-transform duration-100 cursor-pointer ${
                      cell
                        ? `${cell} shadow-xs`
                        : preview === true
                        ? 'bg-indigo-500/40 border-indigo-500 scale-95'
                        : preview === false
                        ? 'bg-rose-500/35 border-rose-500'
                        : 'bg-white/90 dark:bg-slate-800 border-amber-200/70 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                    aria-label={`Ô ${r + 1}-${c + 1}`}
                  />
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          {quizOpen && activeQuiz ? (
            <div className="rounded-3xl border-2 border-indigo-500/50 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-cyan-300">
                <Sparkles className="w-4 h-4" />
                <span>Thử thách Flashcard · Mở khóa x2 Điểm &amp; Khối 1×1</span>
              </div>
              <h4 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                {activeQuiz.prompt}
              </h4>
              <div className="space-y-2">
                {activeQuiz.options.map((opt, idx) => {
                  const isCorrectOpt = opt === activeQuiz.correctAnswer;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={quizFeedback !== null}
                      onClick={() => handleAnswerQuiz(opt)}
                      className={`w-full p-3 rounded-xl border text-left text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition ${
                        quizFeedback !== null && isCorrectOpt
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-indigo-400'
                      }`}
                    >
                      <span className="line-clamp-2">{opt}</span>
                      {quizFeedback !== null && isCorrectOpt && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-extrabold text-slate-900 dark:text-white">
                  Khay khối tiếp theo
                </h4>
                <button
                  type="button"
                  onClick={() => setQuizOpen(true)}
                  disabled={prompts.length === 0}
                  className="text-xs font-bold text-indigo-600 dark:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Trả lời thẻ nhận Khối 1×1</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {tray.map((sh, idx) => {
                  const isSelected = selectedIdx === idx;
                  return (
                    <button
                      key={sh.id}
                      type="button"
                      onClick={() => setSelectedIdx(idx)}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 min-h-[110px] cursor-pointer transition ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/30'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:border-indigo-300'
                      }`}
                    >
                      <div className="grid grid-cols-3 gap-1">
                        {[0, 1, 2].map((r) =>
                          [0, 1, 2].map((c) => {
                            const has = sh.cells.some(([dr, dc]) => dr === r && dc === c);
                            return (
                              <span
                                key={`${r}-${c}`}
                                className={`w-4 h-4 rounded-sm ${has ? sh.colorClass : 'bg-transparent'}`}
                              />
                            );
                          })
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-full">
                        {sh.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Mỗi 3 lần đặt khối thành công, một câu hỏi Flashcard sẽ xuất hiện để nhân đôi điểm và tặng khối 1×1 linh hoạt.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
