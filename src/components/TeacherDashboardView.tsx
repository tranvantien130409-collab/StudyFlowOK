import React from 'react';
import {
  Users,
  BookOpen,
  ClipboardList,
  Sparkles,
  UploadCloud,
  Bot,
  Settings,
  KeyRound,
  ChevronRight,
  Calendar,
  GraduationCap,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  MapPin,
  Layers,
  Globe,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { TeacherProfile, TeacherClass, TeacherTab } from '../types';
import { Avatar } from './Avatar';

interface TeacherDashboardViewProps {
  profile: TeacherProfile;
  classes: TeacherClass[];
  totalExamsCount: number;
  totalMaterialsCount: number;
  assignedTasksCount?: number;
  onOpenProfileModal: () => void;
  onOpenAiExamModal: () => void;
  onOpenAiMaterialModal: () => void;
  onOpenAiAssistantModal: () => void;
  onOpenAssignModal?: () => void;
  onSelectClass: (c: TeacherClass) => void;
  onNavigateTab: (tab: TeacherTab) => void;
  onOpenScoreDistribution?: () => void;
}

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  profile,
  classes,
  totalExamsCount,
  totalMaterialsCount,
  onOpenProfileModal,
  onOpenAiExamModal,
  onOpenAiMaterialModal,
  onOpenAiAssistantModal,
  onSelectClass,
  onNavigateTab,
  onOpenScoreDistribution
}) => {
  const totalStudents = classes.reduce((sum, c) => sum + c.studentsCount, 0);
  const overallAvgScore =
    classes.length > 0
      ? (classes.reduce((sum, c) => sum + (Number(c.avgScore) || 0), 0) / classes.length).toFixed(1)
      : '—';

  const kpiCards = [
    {
      id: 'students',
      label: 'Tổng số học sinh',
      value: totalStudents,
      meta: `${classes.length} lớp đang quản lý`,
      hint: overallAvgScore !== '—' ? `ĐTB ${overallAvgScore}` : 'Quản lý lớp',
      tab: 'classes' as TeacherTab,
      icon: Users,
      iconTone:
        'bg-gradient-to-br from-emerald-500/18 to-teal-500/18 border-emerald-400/40 text-emerald-700 dark:text-emerald-300 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.45)]',
      topGlow: 'from-emerald-400 via-teal-400 to-cyan-400',
      hintTone: 'text-emerald-700 dark:text-emerald-300'
    },
    {
      id: 'materials',
      label: 'Học liệu giảng dạy',
      value: totalMaterialsCount,
      meta: 'Giáo án & tài liệu số',
      hint: 'Mở kho học liệu',
      tab: 'materials' as TeacherTab,
      icon: BookOpen,
      iconTone:
        'bg-gradient-to-br from-cyan-500/18 to-sky-500/18 border-cyan-400/40 text-cyan-700 dark:text-cyan-300 shadow-[0_8px_20px_-8px_rgba(6,182,212,0.45)]',
      topGlow: 'from-cyan-400 via-sky-400 to-blue-400',
      hintTone: 'text-sky-700 dark:text-cyan-300'
    },
    {
      id: 'exams',
      label: 'Đề thi & khảo thí',
      value: totalExamsCount,
      meta: 'Ngân hàng đề kiểm tra',
      hint: 'Quản lý đề thi',
      tab: 'exams' as TeacherTab,
      icon: ClipboardList,
      iconTone:
        'bg-gradient-to-br from-indigo-500/18 to-blue-600/18 border-indigo-400/40 text-indigo-700 dark:text-indigo-300 shadow-[0_8px_20px_-8px_rgba(99,102,241,0.45)]',
      topGlow: 'from-blue-500 via-indigo-400 to-cyan-400',
      hintTone: 'text-indigo-700 dark:text-indigo-300'
    }
  ];

  const quickActions: Array<{
    id: string;
    title: string;
    subtitle: string;
    tag: string;
    icon: React.ComponentType<{ className?: string }>;
    featured?: boolean;
    iconTone: string;
    href?: string;
    onClick?: () => void;
  }> = [
    {
      id: 'manage-classes',
      title: `Quản lý ${classes.length} lớp học`,
      subtitle: 'Sổ điểm, sĩ số và hồ sơ học sinh',
      tag: `${totalStudents} học sinh`,
      icon: Users,
      featured: false,
      iconTone:
        'bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
      onClick: () => onNavigateTab('classes')
    },
    {
      id: 'ai-material',
      title: 'Soạn học liệu AI',
      subtitle: 'Tóm tắt trọng tâm & giáo án theo chương',
      tag: `${totalMaterialsCount} tài liệu`,
      icon: UploadCloud,
      featured: false,
      iconTone:
        'bg-gradient-to-br from-cyan-500/15 to-sky-500/15 border-cyan-500/30 text-cyan-700 dark:text-cyan-300',
      onClick: onOpenAiMaterialModal
    },
    {
      id: 'ai-exam',
      title: 'Tạo đề theo Ma trận AI',
      subtitle: 'Chuẩn Bộ GD&ĐT · Nhận biết đến Vận dụng cao',
      tag: 'Công cụ trọng tâm',
      icon: Sparkles,
      featured: true,
      iconTone:
        'bg-gradient-to-tr from-cyan-400 via-sky-300 to-emerald-300 border-cyan-200/60 text-[#031126] shadow-[0_0_20px_rgba(34,211,238,0.45)]',
      onClick: onOpenAiExamModal
    },
    {
      id: 'vnedu',
      title: 'VNEDU',
      subtitle: 'Cổng sổ điểm & tra cứu kết quả học tập',
      tag: 'Liên kết ngoài',
      icon: Globe,
      featured: false,
      iconTone:
        'bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300',
      href: 'https://user.vnedu.vn/sso//?use_cache=0&continue=tracuu.vnedu.vn/kqht/'
    },
    {
      id: 'timetable',
      title: 'Thời khóa biểu',
      subtitle: 'Lịch giảng dạy & đồng bộ Trường Học Việt',
      tag: 'Lịch tuần',
      icon: Calendar,
      featured: false,
      iconTone:
        'bg-gradient-to-br from-amber-500/15 to-orange-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300',
      onClick: () => onNavigateTab('timetable')
    },
    {
      id: 'score-distribution',
      title: 'Phổ điểm',
      subtitle: 'Thống kê phân bố điểm số & xếp loại lớp',
      tag: `${totalExamsCount} đề thi`,
      icon: BarChart3,
      featured: false,
      iconTone:
        'bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border-violet-500/30 text-violet-700 dark:text-violet-300',
      onClick: () => (onOpenScoreDistribution ? onOpenScoreDistribution() : onNavigateTab('exams'))
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* 1. Signature Executive Navy Hero Banner */}
      <section className="sf-navy-hero-banner sf-shimmer-card sf-panel-enter relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,rgba(186,230,253,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(186,230,253,0.5)_1px,transparent_1px)] bg-[size:36px_36px]"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300 tracking-wide">
              <GraduationCap className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>Cổng Giảng Viên · Quản Trị Học Tập</span>
            </div>

            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <Avatar
                  src={profile.avatar}
                  fallbackText={profile.name || 'GV'}
                  sizeClassName="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl shadow-[0_0_24px_rgba(34,211,238,0.28)] ring-2 ring-cyan-400/45"
                  bgClassName="bg-gradient-to-tr from-cyan-500 to-indigo-600"
                  textClassName="text-white font-black text-lg"
                />
              </div>

              <div className="min-w-0">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance leading-tight">
                  Xin chào,{' '}
                  <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
                    {profile.name}
                  </span>
                  !
                </h1>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300">
                  <span>
                    Môn giảng dạy:{' '}
                    <strong className="font-semibold text-white">{profile.subject || 'Toàn diện'}</strong>
                  </span>
                  <span aria-hidden="true" className="text-cyan-400/50">·</span>
                  <span>
                    Tên đăng nhập:{' '}
                    <span className="font-mono tabular-nums font-semibold text-cyan-200">{profile.username}</span>
                  </span>
                  <span aria-hidden="true" className="text-cyan-400/50">·</span>
                  <span>
                    Mã dự phòng:{' '}
                    <span className="font-mono tabular-nums font-semibold text-emerald-300">{profile.backupCode}</span>
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-200/90 max-w-2xl leading-relaxed">
              Không gian điều hành giảng dạy chuyên nghiệp. Theo dõi sĩ số lớp học, biên soạn đề thi theo ma trận thông minh và phân phối học liệu tức thì.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              data-sound="success"
              onClick={onOpenAiExamModal}
              className="sf-neon-cta min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>AI Tạo đề trắc nghiệm</span>
            </button>

            <button
              type="button"
              data-sound="tap"
              onClick={onOpenProfileModal}
              className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/16 text-white text-xs font-semibold border border-cyan-300/30 hover:border-cyan-300/60 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <KeyRound className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>Đổi mật khẩu</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Architectural 3-Column KPI Strip */}
      <section aria-label="Thống kê nhanh" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              data-sound="nav"
              onClick={() => onNavigateTab(card.tab)}
              style={{ animationDelay: `${idx * 35}ms` }}
              className="sf-teacher-kpi sf-shimmer-card sf-panel-enter rounded-2xl p-5 text-left flex flex-col justify-between gap-4 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute top-0 left-5 right-5 h-[2.5px] rounded-full bg-gradient-to-r ${card.topGlow} opacity-55 group-hover:opacity-100 transition-opacity duration-200`}
              />

              <div className="flex items-start justify-between gap-3 w-full">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105 ${card.iconTone}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-500 dark:text-cyan-200/80 truncate">
                      {card.label}
                    </div>
                    <div className="font-display text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white leading-none mt-1.5">
                      {card.value}
                    </div>
                  </div>
                </div>

                <span className="w-8 h-8 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-cyan-400/20 flex items-center justify-center text-slate-400 dark:text-cyan-300/70 group-hover:text-sky-600 dark:group-hover:text-cyan-200 group-hover:border-sky-300 dark:group-hover:border-cyan-300/50 transition-colors shrink-0">
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-150" />
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200/70 dark:border-cyan-400/15 flex items-center justify-between gap-2 w-full text-xs">
                <span className="text-slate-500 dark:text-slate-400 truncate">{card.meta}</span>
                <span className={`font-bold font-mono tabular-nums whitespace-nowrap shrink-0 ${card.hintTone}`}>
                  {card.hint}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      {/* 3. Main Asymmetric Command Studio: Row 1 (Equal Height Split) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Quick Actions Studio (8/12) */}
        <section className="xl:col-span-8 sf-teacher-surface sf-panel-enter rounded-3xl p-6 flex flex-col justify-between gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Thao tác nhanh cho giảng viên
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Truy cập trực tiếp các công cụ quản lý lớp học, biên soạn học liệu và ra đề thông minh
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-cyan-300 whitespace-nowrap shrink-0">
              <Layers className="w-3.5 h-3.5" />
              <span>6 công cụ chính</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              if (action.featured) {
                return (
                  <button
                    key={action.id}
                    type="button"
                    data-sound="success"
                    onClick={action.onClick}
                    className="sf-navy-hero-banner sf-shimmer-card interactive-spring rounded-2xl p-4 sm:p-5 text-left flex items-center justify-between gap-4 relative overflow-hidden cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    <div className="flex items-center gap-4 min-w-0 relative z-10">
                      <div
                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105 ${action.iconTone}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-cyan-300 mb-0.5">
                          {action.tag}
                        </div>
                        <div className="font-display text-sm sm:text-[15px] font-extrabold text-white truncate">
                          {action.title}
                        </div>
                        <div className="text-xs text-cyan-100/80 mt-0.5 line-clamp-1">
                          {action.subtitle}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-cyan-300 group-hover:translate-x-1 transition-transform duration-150 shrink-0 relative z-10" />
                  </button>
                );
              }

              if (action.href) {
                return (
                  <a
                    key={action.id}
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-sound="nav"
                    className="sf-teacher-tile sf-shimmer-card rounded-2xl p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105 ${action.iconTone}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-sky-700 dark:text-cyan-300/85 mb-0.5">
                          {action.tag}
                        </div>
                        <div className="font-display text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-700 dark:group-hover:text-cyan-300 transition-colors">
                          {action.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {action.subtitle}
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-400 dark:text-cyan-400/50 group-hover:text-sky-600 dark:group-hover:text-cyan-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0" />
                  </a>
                );
              }

              return (
                <button
                  key={action.id}
                  type="button"
                  data-sound="nav"
                  onClick={action.onClick}
                  className="sf-teacher-tile sf-shimmer-card rounded-2xl p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105 ${action.iconTone}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-sky-700 dark:text-cyan-300/85 mb-0.5">
                        {action.tag}
                      </div>
                      <div className="font-display text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-700 dark:group-hover:text-cyan-300 transition-colors">
                        {action.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {action.subtitle}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-cyan-400/50 group-hover:text-sky-600 dark:group-hover:text-cyan-300 group-hover:translate-x-1 transition-all duration-150 shrink-0" />
                </button>
              );
            })}
          </div>
        </section>

        {/* AI Assistant Spotlight (4/12) */}
        <section className="xl:col-span-4 sf-navy-hero-banner sf-shimmer-card sf-panel-enter text-white rounded-3xl p-6 flex flex-col justify-between gap-5 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,rgba(186,230,253,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(186,230,253,0.5)_1px,transparent_1px)] bg-[size:28px_28px]"
          />

          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-400/15 border border-cyan-300/40 backdrop-blur-md flex items-center justify-center shrink-0 shadow-[0_0_22px_rgba(34,211,238,0.28)]">
                <Bot className="w-6 h-6 text-cyan-300" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
                  Trợ lý AI {profile.name}
                </h3>
                <p className="text-xs text-cyan-200/85 font-medium truncate">
                  Phân tích chuyên sâu &amp; Ma trận đề
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-[13px] text-slate-200/90 leading-relaxed">
              Hệ thống AI tự động phân tích phổ điểm lớp học, nhận diện lỗ hổng kiến thức từng học sinh và gợi ý đề xuất bài tập phân hóa.
            </p>

            <div className="pt-2 border-t border-cyan-300/15 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[11px] text-cyan-200/70">Phạm vi theo dõi</div>
                <div className="font-mono tabular-nums font-bold text-white mt-0.5">
                  {classes.length} lớp · {totalStudents} HS
                </div>
              </div>
              <div>
                <div className="text-[11px] text-cyan-200/70">ĐTB toàn khối</div>
                <div className="font-mono tabular-nums font-bold text-emerald-300 mt-0.5">
                  {overallAvgScore} điểm
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            data-sound="success"
            onClick={onOpenAiAssistantModal}
            className="sf-neon-cta min-h-[44px] w-full py-2.5 px-4 rounded-2xl font-extrabold text-xs text-center flex items-center justify-center gap-2 relative z-10 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Mở trợ lý phân tích học tập</span>
          </button>
        </section>
      </div>

      {/* 4. Operational Workspace: Row 2 (Class Directory + Schedule & Settings) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Classes Directory (8/12) */}
        <section className="xl:col-span-8 sf-teacher-surface sf-panel-enter rounded-3xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/75 dark:border-cyan-400/15">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Danh sách lớp học đang quản lý
                </h2>
                <span className="text-xs font-mono tabular-nums font-bold text-sky-700 dark:text-cyan-300">
                  ({classes.length})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Chọn từng lớp để xem sổ điểm chi tiết, phổ điểm khảo thí và giao nhiệm vụ
              </p>
            </div>

            <button
              type="button"
              data-sound="nav"
              onClick={() => onNavigateTab('classes')}
              className="text-xs font-bold text-sky-700 dark:text-cyan-300 hover:text-sky-600 dark:hover:text-cyan-200 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg px-2 py-1.5"
            >
              <span>Xem tất cả lớp</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {classes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {classes.map((cls) => {
                const scoreVal = Number(cls.avgScore) || 0;
                const scoreTone =
                  scoreVal >= 8
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : scoreVal >= 6.5
                    ? 'text-sky-600 dark:text-cyan-300'
                    : 'text-amber-600 dark:text-amber-300';

                return (
                  <div
                    key={cls.id}
                    role="button"
                    tabIndex={0}
                    data-sound="nav"
                    onClick={() => onSelectClass(cls)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectClass(cls);
                      }
                    }}
                    className="sf-teacher-tile sf-shimmer-card p-4 rounded-2xl flex items-center justify-between gap-3.5 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#081b3d] to-[#0f3470] text-cyan-300 border border-cyan-400/35 font-display font-extrabold text-sm flex items-center justify-center shrink-0 group-hover:from-cyan-400 group-hover:to-sky-500 group-hover:text-[#041126] transition-all duration-150 shadow-xs font-mono tabular-nums">
                        {String(cls.number).padStart(2, '0')}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-700 dark:group-hover:text-cyan-300 transition-colors">
                          {cls.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {cls.subject || profile.subject || 'Toàn diện'} · {cls.room || 'Phòng học'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className={`text-sm font-extrabold font-mono tabular-nums ${scoreTone}`}>
                          {cls.avgScore}đ
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {cls.studentsCount} HS
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 dark:group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-transform duration-150 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-cyan-500/30 p-8 text-center space-y-2.5">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Chưa có lớp học nào được tạo
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mở mục Lớp &amp; Học sinh để tạo lớp học mới và theo dõi sĩ số.
              </p>
              <button
                type="button"
                data-sound="nav"
                onClick={() => onNavigateTab('classes')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950 text-xs font-bold cursor-pointer"
              >
                <span>Đi tới Lớp &amp; Học sinh</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </section>

        {/* Right Column (4/12): Schedule + Account Settings */}
        <div className="xl:col-span-4 space-y-5">
          {/* Quick Schedule */}
          <section className="sf-teacher-surface sf-panel-enter rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/75 dark:border-cyan-400/15">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
                <span>Lịch dạy trong tuần</span>
              </h3>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Trực tuyến</span>
              </span>
            </div>

            {classes.length > 0 ? (
              <div className="divide-y divide-slate-200/70 dark:divide-cyan-400/15">
                {classes.slice(0, 3).map((cls, idx) => (
                  <button
                    key={cls.id}
                    type="button"
                    data-sound="nav"
                    onClick={() => onSelectClass(cls)}
                    className="w-full py-3 first:pt-1 last:pb-1 text-left flex items-center justify-between gap-3 hover:bg-sky-50/50 dark:hover:bg-white/[0.03] rounded-xl px-2 -mx-2 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-700 dark:group-hover:text-cyan-300 transition-colors">
                        {cls.name} · {cls.subject || profile.subject || 'Toàn diện'}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        <span className="inline-flex items-center gap-1 truncate">
                          <Clock className="w-3 h-3 shrink-0 text-slate-400" />
                          {cls.schedule || 'Lịch học linh hoạt'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                          {cls.room || 'Phòng học'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold shrink-0 whitespace-nowrap ${
                        idx === 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : idx === 1
                          ? 'text-sky-700 dark:text-cyan-300'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {idx === 0 ? 'Đã dạy' : idx === 1 ? 'Hôm nay' : 'Sắp tới'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#08152d] border border-slate-200/70 dark:border-cyan-500/20 text-slate-500 dark:text-slate-400 text-xs text-center">
                Chưa có lớp học nào. Vào mục Lớp &amp; Học sinh để tạo lớp mới.
              </div>
            )}

            <button
              type="button"
              data-sound="nav"
              onClick={() => onNavigateTab('timetable')}
              className="min-h-[42px] w-full py-2.5 px-4 rounded-2xl bg-sky-500/10 hover:bg-sky-500/18 dark:bg-cyan-500/12 dark:hover:bg-cyan-500/22 text-sky-800 dark:text-cyan-200 font-bold text-xs border border-sky-500/25 dark:border-cyan-400/30 transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Mở Thời khóa biểu &amp; Trường Học Việt</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </section>

          {/* System Settings Widget */}
          <section className="sf-teacher-surface sf-panel-enter rounded-3xl p-6 space-y-3.5">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
              <span>Cài đặt hệ thống &amp; Tài khoản</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Quản lý thông tin giáo viên, thay đổi mật khẩu đăng nhập và tùy chỉnh bảo mật tài khoản.
            </p>

            <button
              type="button"
              data-sound="tap"
              onClick={onOpenProfileModal}
              className="min-h-[42px] w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#06142e] via-[#0b234d] to-[#103069] hover:from-[#091c3f] hover:to-[#153e85] border border-cyan-400/35 hover:border-cyan-300/60 text-white font-bold text-xs shadow-md transition-all duration-150 active:scale-[0.98] text-center flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <KeyRound className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span>Cài đặt &amp; Đổi mật khẩu</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
