import React, { useState } from 'react';
import { Sun, Moon, GraduationCap, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import studyflowLogoMark from '../assets/images/studyflow_logo_mark.png';
import { TeacherProfile } from '../types';
import { Avatar } from './Avatar';
import { loadUiPreferences, updateUiPreferences } from '../utils/uiPreferences';
import { playToggleChime } from '../utils/tactileAudio';
import { LanguageToggleBtn } from './LanguageToggleBtn';
import { useLanguage } from '../services/languageService';

interface TeacherTopBarProps {
  profile: TeacherProfile;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSwitchToStudent: () => void;
  onOpenCopyright: () => void;
  onOpenProfileModal: () => void;
}

export const TeacherTopBar: React.FC<TeacherTopBarProps> = ({
  profile,
  theme,
  onToggleTheme,
  onSwitchToStudent,
  onOpenCopyright,
  onOpenProfileModal
}) => {
  const lang = useLanguage();
  const isEn = lang === 'en';
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => loadUiPreferences().soundEnabled !== false);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    updateUiPreferences((prev) => ({ ...prev, soundEnabled: next }));
    if (next) {
      playToggleChime(true);
    }
  };

  return (
    <header
      data-no-translate
      className="bg-gradient-to-r from-[#040e24] via-[#0a214a] to-[#0d2d63] text-white px-5 py-2.5 shadow-[0_10px_30px_-10px_rgba(2,6,23,0.75)] border-b border-cyan-400/25 flex items-center justify-between sticky top-0 z-20 backdrop-blur-xl"
    >
      {/* Left Title - SF Logo + Name */}
      <div className="flex items-center gap-2.5">
        <img
          src={studyflowLogoMark}
          alt="StudyFlow Logo"
          className="h-8 w-auto object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.45)] shrink-0"
        />
        <div>
          <h1 className="text-base sm:text-lg font-black tracking-tight leading-none flex items-center font-display">
            <span className="text-cyan-300">Study</span>
            <span className="text-white">Flow</span>
          </h1>
          <span className="text-[10px] font-semibold text-cyan-200/80">
            {isEn ? 'Teacher Mode' : 'Chế độ Giáo viên'}
          </span>
        </div>
      </div>

      {/* Right User & Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Switch to Student Mode button */}
        <button
          onClick={onSwitchToStudent}
          data-sound="nav"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black shadow-[0_0_16px_rgba(16,185,129,0.35)] transition-all active:scale-95 cursor-pointer"
          title={isEn ? 'Switch to Student Mode' : 'Chuyển sang chế độ Học sinh'}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>{isEn ? 'Student' : 'Học sinh'}</span>
        </button>

        {/* Tactile Sound Feedback Toggle */}
        <button
          onClick={handleToggleSound}
          type="button"
          data-sound="none"
          aria-pressed={soundEnabled}
          title={soundEnabled ? (isEn ? 'UI Sounds: On' : 'Âm thanh tương tác: Đang bật') : (isEn ? 'UI Sounds: Off' : 'Âm thanh tương tác: Đang tắt')}
          className={`p-2 rounded-xl transition-all border cursor-pointer active:scale-95 ${
            soundEnabled
              ? 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'bg-white/10 hover:bg-white/20 text-slate-400 border-white/15'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          type="button"
          data-sound="toggle"
          title={theme === 'dark' ? (isEn ? 'Switch to Light Mode' : 'Chuyển sang giao diện Sáng') : (isEn ? 'Switch to Dark Mode' : 'Chuyển sang giao diện Tối')}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition border border-cyan-400/25 hover:border-amber-400/50 cursor-pointer active:scale-95"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-cyan-200" />}
        </button>

        {/* Language Toggle Button */}
        <LanguageToggleBtn className="!bg-white/10 hover:!bg-white/20 !text-white !border-cyan-400/25 hover:!border-cyan-300/60" />

        {/* Copyright & Backup */}
        <button
          onClick={onOpenCopyright}
          type="button"
          title={isEn ? 'Copyright & Data Backup' : 'Bản quyền & Sao lưu dữ liệu'}
          aria-label={isEn ? 'Copyright & Data Backup' : 'Bản quyền & Sao lưu dữ liệu'}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition border border-cyan-400/25 cursor-pointer active:scale-95"
        >
          <ShieldCheck className="w-4 h-4 text-cyan-300" />
        </button>

        {/* Teacher Profile */}
        <button
          onClick={onOpenProfileModal}
          className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#071633]/90 hover:bg-[#0d234d] transition text-white border border-cyan-400/35 hover:border-cyan-300/60 cursor-pointer active:scale-95 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
          title={isEn ? 'Teacher Profile' : 'Thông tin Giáo viên'}
        >
          <Avatar
            src={profile.avatar}
            fallbackText={profile.name || 'CP'}
            sizeClassName="w-7 h-7 rounded-lg shadow-xs"
            bgClassName="bg-white"
            textClassName="text-blue-700 font-black text-xs"
          />
          <span className="hidden sm:inline text-xs font-semibold truncate max-w-[120px]">
            {profile.name}
          </span>
        </button>
      </div>
    </header>
  );
};
