import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Sparkles,
  Send,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  GraduationCap,
  Globe,
  Minimize2
} from 'lucide-react';
import { askTutor, TutorMessage } from '../services/aiTutor';
import { StudentProfile } from '../types';
import { useLanguage } from '../services/languageService';

interface FocusChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  liked?: boolean | null;
  sources?: Array<{ title: string; uri: string }>;
}

interface AiFocusTutorViewProps {
  studentProfile?: StudentProfile;
  onExitFocusMode: () => void;
}

const STORAGE_KEY = 'studyflow_tt_ai_focus_chat_v1';

const SUBJECTS_VI = [
  'Toán học',
  'Vật lý',
  'Hóa học',
  'Sinh học',
  'Ngữ văn',
  'Tiếng Anh',
  'Lịch sử',
  'Địa lý',
  'Tin học'
];

const SUBJECTS_EN: Record<string, string> = {
  'Toán học': 'Mathematics',
  'Vật lý': 'Physics',
  'Hóa học': 'Chemistry',
  'Sinh học': 'Biology',
  'Ngữ văn': 'Literature',
  'Tiếng Anh': 'English',
  'Lịch sử': 'History',
  'Địa lý': 'Geography',
  'Tin học': 'Computer Science'
};

export const AiFocusTutorView: React.FC<AiFocusTutorViewProps> = ({
  studentProfile,
  onExitFocusMode
}) => {
  const lang = useLanguage();
  const isEn = lang === 'en';

  const [subject, setSubject] = useState('Toán học');
  const [grade, setGrade] = useState(() =>
    studentProfile?.className?.includes('10')
      ? '10'
      : studentProfile?.className?.includes('11')
      ? '11'
      : '12'
  );

  const getInitialGreeting = (): FocusChatMessage => ({
    id: 'welcome',
    role: 'assistant',
    content: isEn
      ? `Hello ${studentProfile?.name || 'there'}! 🎓 I'm **T&T AI Tutor**. Distractions are hidden so you can focus 100% on studying. Ask me any theory question, step-by-step exercise, or exam prep topic!`
      : `Xin chào ${studentProfile?.name || 'bạn'}! 🎓 Mình là **Gia sư T&T AI**. Toàn bộ thông tin gây xao nhãng đã được ẩn để bạn tập trung 100% vào việc học. Hãy gửi câu hỏi lý thuyết, bài tập cần giải từng bước hoặc chủ đề ôn thi ngay bên dưới nhé!`,
    timestamp: isEn ? 'Just now' : 'Vừa xong'
  });

  const [messages, setMessages] = useState<FocusChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [getInitialGreeting()];
  });

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const handleReset = () => {
    const fresh = [getInitialGreeting()];
    setMessages(fresh);
    setInput('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
  };

  const handleLike = (id: string, val: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, liked: m.liked === val ? null : val } : m))
    );
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || busy) return;

    const nowTime = new Date().toLocaleTimeString(isEn ? 'en-US' : 'vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const userMsg: FocusChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: nowTime
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);

    try {
      const history: TutorMessage[] = nextMessages.map((m) => ({
        role: m.role,
        content: m.content
      }));

      const systemPrompt = isEn
        ? `You are T&T AI Tutor for StudyFlow in Distraction-Free Focus Mode. Teach a Grade ${grade} student in ${SUBJECTS_EN[subject] || subject}. Give clear, accurate, step-by-step explanations with LaTeX formulas ($...$ and $$...$$). Respond in English unless the student writes in Vietnamese.`
        : `Bạn là Gia sư T&T AI của StudyFlow đang ở Chế độ Tập trung AI. Dạy học sinh lớp ${grade} môn ${subject} theo chương trình GDPT 2018. Hãy trả lời trực tiếp, chính xác, giải thích bản chất và hướng dẫn giải bài tập từng bước dễ hiểu, trình bày công thức bằng LaTeX ($...$ và $$...$$).`;

      const res = await askTutor(history, subject, grade, systemPrompt);

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toLocaleTimeString(isEn ? 'en-US' : 'vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          sources: res.sources
        }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: isEn
            ? 'Unable to connect to T&T AI Tutor right now. Please try sending your question again.'
            : 'Hiện không thể kết nối tới Gia sư T&T AI. Bạn vui lòng gửi lại câu hỏi sau giây lát nhé.',
          timestamp: nowTime
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  const quickPrompts = isEn
    ? [
        `Explain core concepts & formulas in ${SUBJECTS_EN[subject] || subject}`,
        'Walk me through a step-by-step problem',
        'Summarize key exam tips for 9+ score',
        'Give me 3 practice questions with solutions'
      ]
    : [
        `Giải thích bản chất & công thức trọng tâm môn ${subject}`,
        'Hướng dẫn giải bài tập vận dụng cao từng bước',
        'Tóm tắt kiến thức trọng tâm ôn thi 9+',
        'Cho mình 3 câu luyện tập có lời giải chi tiết'
      ];

  return (
    <div
      data-no-translate
      className="w-full max-w-4xl mx-auto h-[calc(100vh-5.5rem)] flex flex-col rounded-3xl border border-slate-200/90 dark:border-cyan-500/25 bg-white/95 dark:bg-gradient-to-b dark:from-[#0b1528] dark:via-[#081020] dark:to-[#050a14] shadow-2xl dark:shadow-[0_24px_70px_rgba(2,6,23,0.9)] overflow-hidden relative"
    >
      {/* Ambient subtle focus glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-cyan-500/10 dark:bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Tutor Bar */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-cyan-500/20 bg-gradient-to-r from-[#09142b] via-[#131d44] to-[#1e1545] text-white flex flex-wrap items-center justify-between gap-3 relative z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-white/25 shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black tracking-tight truncate">
                {isEn ? 'T&T AI Tutor' : 'Gia sư T&T AI'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/25 border border-purple-400/40 text-[10px] font-bold text-purple-200">
                <Sparkles className="w-3 h-3" />
                {isEn ? 'Focus Mode' : 'Tập trung AI'}
              </span>
              <span
                className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                title={isEn ? 'Online' : 'Trực tuyến'}
              />
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              {isEn
                ? 'Distraction-free step-by-step academic tutoring with LaTeX'
                : 'Không gian học tập không xao nhãng • Giải bài từng bước & công thức LaTeX'}
            </p>
          </div>
        </div>

        {/* Subject, Grade & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-xl px-2.5 py-1 text-xs">
            <BookOpen className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
              aria-label={isEn ? 'Subject' : 'Môn học'}
            >
              {SUBJECTS_VI.map((s) => (
                <option key={s} value={s} className="bg-slate-900 text-white">
                  {isEn ? SUBJECTS_EN[s] || s : s}
                </option>
              ))}
            </select>
          </div>

          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="bg-white/10 border border-white/15 rounded-xl px-2.5 py-1 text-xs font-bold text-white focus:outline-none cursor-pointer"
            aria-label={isEn ? 'Grade' : 'Khối lớp'}
          >
            <option value="10" className="bg-slate-900 text-white">
              {isEn ? 'Grade 10' : 'Lớp 10'}
            </option>
            <option value="11" className="bg-slate-900 text-white">
              {isEn ? 'Grade 11' : 'Lớp 11'}
            </option>
            <option value="12" className="bg-slate-900 text-white">
              {isEn ? 'Grade 12' : 'Lớp 12'}
            </option>
          </select>

          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/15 transition cursor-pointer active:scale-95"
            title={isEn ? 'New conversation' : 'Cuộc trò chuyện mới'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onExitFocusMode}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/35 text-xs font-bold transition cursor-pointer active:scale-95 sm:hidden"
            title={isEn ? 'Exit AI Focus' : 'Thoát tập trung AI'}
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Prompts Row */}
      <div className="px-4 sm:px-6 py-2.5 border-b border-slate-100 dark:border-cyan-500/15 bg-slate-50/70 dark:bg-[#071021]/80 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0 relative z-10">
        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-cyan-400 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {isEn ? 'Quick Start:' : 'Gợi ý nhanh:'}
        </span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(prompt)}
            disabled={busy}
            className="px-3 py-1 rounded-full bg-white dark:bg-[#0d1a33] hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-cyan-500/20 text-[11px] font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-[#050b16]/85 relative z-10">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shrink-0 shadow-md ring-1 ring-purple-400/40 text-xs font-black">
                T&T
              </div>
            )}

            <div className="max-w-[88%] sm:max-w-[78%] space-y-1.5">
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white rounded-tr-xs shadow-lg shadow-indigo-950/30 whitespace-pre-wrap'
                    : 'bg-white dark:bg-[#0c1629] border border-slate-200/90 dark:border-cyan-500/20 text-slate-800 dark:text-slate-100 rounded-tl-xs shadow-sm prose prose-sm dark:prose-invert max-w-none'
                }`}
              >
                {m.role === 'user' ? (
                  m.content
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {m.content}
                  </ReactMarkdown>
                )}

                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-wrap gap-1.5">
                    {m.sources.slice(0, 4).map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-cyan-700 dark:text-cyan-300 hover:underline no-underline"
                      >
                        <Globe className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[180px]">{src.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {m.role === 'assistant' && (
                <div className="flex items-center gap-3 px-1 text-[11px] text-slate-400">
                  <span>{m.timestamp}</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => handleLike(m.id, true)}
                      className={`p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer ${
                        m.liked === true ? 'text-cyan-500' : 'text-slate-400 hover:text-cyan-500'
                      }`}
                      title={isEn ? 'Helpful' : 'Hữu ích'}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLike(m.id, false)}
                      className={`p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer ${
                        m.liked === false ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'
                      }`}
                      title={isEn ? 'Not helpful' : 'Chưa hài lòng'}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(m.id, m.content)}
                      className="flex items-center gap-1 p-1 hover:text-cyan-500 transition cursor-pointer"
                      title={isEn ? 'Copy answer' : 'Sao chép câu trả lời'}
                    >
                      {copiedId === m.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500 font-bold">
                            {isEn ? 'Copied' : 'Đã sao chép'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Copy' : 'Sao chép'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2.5 text-xs text-indigo-600 dark:text-cyan-300 font-semibold p-3 bg-indigo-50/80 dark:bg-cyan-950/30 rounded-2xl border border-indigo-200/70 dark:border-cyan-500/25 w-fit">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {isEn
                ? 'T&T AI Tutor is solving your question step-by-step...'
                : 'Gia sư T&T AI đang phân tích và giải chi tiết từng bước...'}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Bottom Input Dock */}
      <div className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-cyan-500/20 bg-white/95 dark:bg-[#081020]/95 flex items-center gap-2 relative z-10 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            isEn
              ? 'Ask T&T AI Tutor any question or paste an exercise...'
              : 'Nhập câu hỏi lý thuyết hoặc dán bài tập để Gia sư T&T AI giải từng bước...'
          }
          className="flex-1 rounded-2xl border border-slate-200 dark:border-cyan-500/30 bg-slate-50 dark:bg-[#050a14] px-4 py-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 dark:focus:ring-cyan-400/40 focus:border-indigo-500 dark:focus:border-cyan-400 text-slate-900 dark:text-slate-100 transition"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={busy || !input.trim()}
          className="px-4 sm:px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:brightness-110 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">{isEn ? 'Send' : 'Gửi bài'}</span>
        </button>
      </div>
    </div>
  );
};
