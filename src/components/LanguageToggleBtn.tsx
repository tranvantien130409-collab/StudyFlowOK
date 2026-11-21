import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { getCurrentLanguage, setAppLanguage, subscribeLanguage, AppLanguage } from '../services/languageService';

export const LanguageToggleBtn: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [lang, setLang] = useState<AppLanguage>(getCurrentLanguage());

  useEffect(() => {
    return subscribeLanguage((newLang) => {
      setLang(newLang);
    });
  }, []);

  const toggleLang = () => {
    const next: AppLanguage = lang === 'vi' ? 'en' : 'vi';
    setAppLanguage(next);
  };

  return (
    <button
      type="button"
      onClick={toggleLang}
      data-sound="toggle"
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/95 dark:border-cyan-500/30 bg-slate-100/90 dark:bg-[#0a1529]/90 text-slate-700 dark:text-cyan-200 hover:border-cyan-400 dark:hover:border-cyan-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all duration-200 cursor-pointer active:scale-95 shadow-2xs ${className}`}
      title={lang === 'vi' ? 'Chuyển sang Tiếng Anh (Switch to English)' : 'Chuyển sang Tiếng Việt (Switch to Vietnamese)'}
      aria-label="Chuyển đổi ngôn ngữ Tiếng Việt / English"
    >
      <Globe className="w-4 h-4 text-cyan-500 dark:text-cyan-400 shrink-0" />
      <span className="text-xs font-black uppercase tracking-wider">
        {lang === 'vi' ? 'VI' : 'EN'}
      </span>
    </button>
  );
};
