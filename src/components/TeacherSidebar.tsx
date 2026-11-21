import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Layers, 
  Sparkles, 
  Database, 
  ClipboardList, 
  Flame, 
  BarChart2, 
  TrendingUp, 
  GraduationCap, 
  KeyRound,
  MessageCircle,
  ShieldCheck,
  Globe,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays
} from 'lucide-react';
import { TeacherTab, TeacherProfile } from '../types';
import { Avatar } from './Avatar';
import { loadUiPreferences, updateTeacherUiPreferences } from '../utils/uiPreferences';
import { useLanguage } from '../services/languageService';

interface TeacherSidebarProps {
  currentTab: TeacherTab;
  onSelectTab: (tab: TeacherTab) => void;
  profile: TeacherProfile;
  onSwitchToStudent: () => void;
  onOpenCopyright: () => void;
  onOpenProfileModal: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const TeacherSidebar: React.FC<TeacherSidebarProps> = ({
  currentTab,
  onSelectTab,
  profile,
  onSwitchToStudent,
  onOpenCopyright,
  onOpenProfileModal,
  isCollapsed: controlledCollapsed,
  onToggleCollapse
}) => {
  const lang = useLanguage();
  const isEn = lang === 'en';
  const [localCollapsed, setLocalCollapsed] = React.useState<boolean>(() => loadUiPreferences().teacher.sidebarCollapsed);
  const isCollapsed = typeof controlledCollapsed === 'boolean' ? controlledCollapsed : localCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !isCollapsed;
      setLocalCollapsed(next);
      updateTeacherUiPreferences({ sidebarCollapsed: next });
    }
  };
  const teacherNavItems = [
    { id: 'overview' as TeacherTab, label: isEn ? 'Overview' : 'Tổng quan', icon: LayoutDashboard },
    { id: 'classes' as TeacherTab, label: isEn ? 'Classes & Students' : 'Lớp & Học sinh', icon: Users },
    { id: 'timetable' as TeacherTab, label: isEn ? 'Timetable' : 'Thời khóa biểu', icon: CalendarDays },
    { id: 'notices' as TeacherTab, label: isEn ? 'Notice Board' : 'Bảng tin', icon: MessageCircle },
    { id: 'materials' as TeacherTab, label: isEn ? 'Materials' : 'Học liệu', icon: BookOpen },
    { id: 'ai_material' as TeacherTab, label: isEn ? 'AI Material Studio' : 'AI tạo học liệu', icon: Sparkles, badge: 'AI', isAi: true },
    { id: 'exams' as TeacherTab, label: isEn ? 'Exams' : 'Thi cử', icon: ClipboardList },
    { id: 'vnedu' as any, label: 'VNEDU', icon: Globe, isExternal: true, externalUrl: 'https://user.vnedu.vn/sso//?use_cache=0&continue=tracuu.vnedu.vn/kqht/' },
  ];

  return (
    <aside
      data-no-translate
      className={`${isCollapsed ? 'w-20' : 'w-64'} bg-gradient-to-b from-[#030713] via-[#060e20] to-[#02050e] text-slate-100 flex flex-col h-screen sticky top-0 shrink-0 select-none border-r border-cyan-500/15 z-30 shadow-[4px_0_30px_rgba(2,6,23,0.8)] transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]`}
    >
      {/* Brand Header - Full Logo Image */}
      <div className="p-3 border-b border-cyan-500/15 flex flex-col gap-2">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
          {!isCollapsed && (
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400/90 pl-1">
              {isEn ? 'Teacher' : 'Giáo viên'}
            </span>
          )}
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="p-1.5 rounded-xl bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/25 transition cursor-pointer"
            title={isCollapsed ? (isEn ? 'Expand sidebar' : 'Mở rộng thanh bên') : (isEn ? 'Collapse sidebar' : 'Thu gọn thanh bên')}
            aria-label={isCollapsed ? (isEn ? 'Expand sidebar' : 'Mở rộng thanh bên') : (isEn ? 'Collapse sidebar' : 'Thu gọn thanh bên')}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {!isCollapsed && (
          <div 
            data-sound="nav"
            onClick={() => {
              onSelectTab('overview');
            }}
            className="relative h-24 rounded-3xl cursor-pointer hover:scale-[1.02] active:scale-[0.985] transition-transform duration-150 overflow-hidden group shadow-[0_8px_25px_-5px_rgba(255,51,102,0.25)]"
          >
            {/* Animated Running Light Border */}
            <div className="absolute inset-0 z-0 bg-[#020617]">
              <div className="absolute inset-[-150%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0%,transparent_35%,#ff3366_65%,#06b6d4_85%,#ff3366_100%)] opacity-90 group-hover:opacity-100 transition-opacity" />
            </div>
            
            {/* Inner Content Area */}
            <div className="absolute inset-[2.5px] bg-gradient-to-b from-white via-[#fcfdff] to-[#f0f4f9] rounded-[22px] z-10 flex items-center justify-center overflow-hidden ring-1 ring-cyan-500/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.15)]">
              <img 
                src="/assets/aistudio/image_01a75996.png" 
                alt="StudyFlow" 
                className="w-full h-auto max-h-24 object-contain brightness-[1.05] contrast-[1.05] drop-shadow-sm scale-[1.1] origin-center group-hover:scale-[1.16] transition-transform duration-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* Teacher Profile Card */}
      <div 
        data-sound="tap"
        onClick={onOpenProfileModal}
        title={profile.name}
        className={`px-4 py-3 flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3'} border-b border-cyan-500/15 bg-gradient-to-r from-[#071324] to-[#0a1b32] hover:from-[#0a1c35] hover:to-[#0f2444] transition-colors duration-150 cursor-pointer group`}
      >
        <Avatar
          src={profile.avatar}
          fallbackText={profile.name || 'CP'}
          sizeClassName="w-10 h-10 rounded-xl shadow-md shadow-rose-900/30 shrink-0 ring-1 ring-rose-500/40"
          bgClassName="bg-gradient-to-tr from-[#ff3366] to-[#ff5b79]"
          textClassName="text-white font-black text-sm"
        />
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition">
                {profile.name}
              </h2>
              <KeyRound className="w-3 h-3 text-amber-400 shrink-0 opacity-80" />
            </div>
            <p className="text-[11px] text-cyan-300 font-mono truncate">
              {isEn ? 'User:' : 'Tên ĐN:'} <span className="underline">{profile.username}</span>
            </p>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto no-scrollbar">
        {teacherNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          if (item.isExternal) {
            return (
              <a
                key={item.id}
                href={item.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-sound="tap"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3.5'} py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-cyan-950/40 hover:text-cyan-200 border border-transparent hover:border-cyan-500/20 transition-colors duration-150 group`}
                title="Dẫn liên kết trực tiếp tới VNEDU"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!isCollapsed && (
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-cyan-300 shrink-0 transition-opacity" />
                )}
              </a>
            );
          }

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.97 }}
              data-sound="nav"
              onClick={() => {
                onSelectTab(item.id);
              }}
              title={item.label}
              className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3.5'} py-2.5 rounded-xl text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:bg-cyan-950/35 hover:text-cyan-200 border border-transparent hover:border-cyan-500/20'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="teacher-sidebar-active-pill"
                  transition={{ type: 'spring', stiffness: 640, damping: 42, mass: 0.65 }}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#092145] via-[#102c5a] to-[#1e1233] border border-cyan-400/50 shadow-[0_6px_22px_rgba(6,182,212,0.25),inset_0_1px_1px_rgba(186,230,253,0.16)] z-0"
                />
              )}
              {isActive && (
                <motion.div
                  layoutId="teacher-sidebar-active-bar"
                  transition={{ type: 'spring', stiffness: 640, damping: 42, mass: 0.65 }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-md bg-gradient-to-b from-cyan-300 via-sky-400 to-rose-400 shadow-[0_0_12px_#22d3ee] z-10"
                />
              )}
              <div className="flex items-center gap-3 min-w-0 relative z-10">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.85)]' : item.isAi ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]' : 'text-slate-400'}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!isCollapsed && item.badge && (
                <span
                  className={`relative z-10 text-[9px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                      : item.isAi
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                      : 'bg-[#09172c] text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom Switcher */}
      <div className="p-3 border-t border-cyan-500/15 space-y-2 bg-[#02050e]">
        <button
          data-sound="nav"
          onClick={onSwitchToStudent}
          title={isEn ? 'Switch to Student' : 'Chuyển về Học sinh'}
          className={`w-full flex items-center justify-center gap-2 py-2 ${isCollapsed ? 'px-2' : 'px-3'} rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 text-xs font-semibold border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-[0.98] transition-all duration-150 cursor-pointer`}
        >
          <GraduationCap className="w-3.5 h-3.5 shrink-0" />
          {!isCollapsed && <span>{isEn ? 'Switch to Student' : 'Chuyển về Học sinh'}</span>}
        </button>

        {!isCollapsed && (
          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
            <span className="truncate">{isEn ? 'Teacher:' : 'GV:'} {profile.name}</span>
            <button 
              data-sound="tap"
              onClick={onOpenCopyright}
              className="hover:text-cyan-300 transition flex items-center gap-0.5 cursor-pointer"
            >
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span>StudyFlow</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
