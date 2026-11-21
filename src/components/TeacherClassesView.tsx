import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  BarChart3,
  ArrowRight,
  Calendar,
  MapPin,
  GraduationCap,
  Award,
  Clock,
  RotateCcw
} from 'lucide-react';
import { TeacherClass, ClassJoinRequest } from '../types';

interface TeacherClassesViewProps {
  classes: TeacherClass[];
  joinRequests: ClassJoinRequest[];
  onSelectClass: (cls: TeacherClass) => void;
  onOpenCreateClass: () => void;
  onRenameClass: (classId: string, newName: string) => void;
  onDeleteClass: (classId: string) => void;
  onApproveJoinRequest: (requestId: string) => void;
  onRejectJoinRequest: (requestId: string) => void;
}

type ClassSortMode = 'default' | 'score' | 'students' | 'name';

export const TeacherClassesView: React.FC<TeacherClassesViewProps> = ({
  classes,
  joinRequests,
  onSelectClass,
  onOpenCreateClass,
  onRenameClass,
  onDeleteClass,
  onApproveJoinRequest,
  onRejectJoinRequest
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<ClassSortMode>('default');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingClassName, setEditingClassName] = useState('');

  const pendingRequests = useMemo(
    () => joinRequests.filter((r) => r.status === 'pending'),
    [joinRequests]
  );

  const totalStudents = useMemo(
    () => classes.reduce((sum, c) => sum + c.studentsCount, 0),
    [classes]
  );

  const overallAvg = useMemo(() => {
    if (classes.length === 0) return '0.0';
    const sum = classes.reduce((acc, c) => acc + (Number(c.avgScore) || 0), 0);
    return (sum / classes.length).toFixed(1);
  }, [classes]);

  const filteredClasses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = classes.filter((cls) => {
      if (!q) return true;
      return (
        cls.name.toLowerCase().includes(q) ||
        (cls.subject || '').toLowerCase().includes(q) ||
        (cls.schedule || '').toLowerCase().includes(q) ||
        (cls.room || '').toLowerCase().includes(q) ||
        (cls.code || '').toLowerCase().includes(q)
      );
    });

    return [...matched].sort((a, b) => {
      if (sortMode === 'score') return (b.avgScore || 0) - (a.avgScore || 0);
      if (sortMode === 'students') return (b.studentsCount || 0) - (a.studentsCount || 0);
      if (sortMode === 'name') return a.name.localeCompare(b.name, 'vi');
      return (a.number || 0) - (b.number || 0);
    });
  }, [classes, searchQuery, sortMode]);

  const startRename = (cls: TeacherClass) => {
    setEditingClassId(cls.id);
    setEditingClassName(cls.name);
  };

  const commitRename = (classId: string) => {
    const trimmed = editingClassName.trim();
    if (!trimmed) return;
    onRenameClass(classId, trimmed);
    setEditingClassId(null);
    setEditingClassName('');
  };

  const cancelRename = () => {
    setEditingClassId(null);
    setEditingClassName('');
  };

  const summaryItems = [
    {
      id: 'classes',
      label: 'Lớp đang phụ trách',
      value: classes.length,
      meta: 'Đang hoạt động',
      icon: Users,
      iconTone:
        'bg-gradient-to-br from-cyan-500/20 to-sky-500/20 border-cyan-400/35 text-cyan-700 dark:text-cyan-300 shadow-[0_0_16px_-4px_rgba(6,182,212,0.45)]',
      topGlow: 'from-cyan-400/80 via-sky-400/70 to-transparent'
    },
    {
      id: 'students',
      label: 'Tổng sĩ số học sinh',
      value: totalStudents,
      meta: 'Trên toàn bộ lớp',
      icon: GraduationCap,
      iconTone:
        'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-emerald-400/35 text-emerald-700 dark:text-emerald-300 shadow-[0_0_16px_-4px_rgba(16,185,129,0.45)]',
      topGlow: 'from-emerald-400/80 via-cyan-400/70 to-transparent'
    },
    {
      id: 'avg',
      label: 'Điểm trung bình chung',
      value: overallAvg,
      meta: 'Thang điểm 10',
      icon: Award,
      iconTone:
        'bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border-indigo-400/35 text-indigo-700 dark:text-indigo-300 shadow-[0_0_16px_-4px_rgba(99,102,241,0.45)]',
      topGlow: 'from-indigo-400/80 via-cyan-400/70 to-transparent'
    },
    {
      id: 'pending',
      label: 'Yêu cầu gia nhập',
      value: pendingRequests.length,
      meta: pendingRequests.length > 0 ? 'Chờ giáo viên duyệt' : 'Không có chờ duyệt',
      icon: Clock,
      iconTone:
        pendingRequests.length > 0
          ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-400/40 text-amber-700 dark:text-amber-300 shadow-[0_0_16px_-4px_rgba(245,158,11,0.45)]'
          : 'bg-gradient-to-br from-slate-500/15 to-cyan-500/15 border-slate-400/30 text-slate-600 dark:text-slate-300',
      topGlow:
        pendingRequests.length > 0
          ? 'from-amber-400/85 via-orange-400/70 to-transparent'
          : 'from-slate-400/50 via-cyan-400/40 to-transparent'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* 1. Luxury Deep Navy & Neon Header Banner */}
      <section className="sf-navy-hero-banner sf-shimmer-card sf-panel-enter relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,rgba(186,230,253,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(186,230,253,0.5)_1px,transparent_1px)] bg-[size:36px_36px]"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300 tracking-wide">
              <Users className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>Cổng Giảng Viên · Quản Trị Lớp Học</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance leading-tight">
              Quản lý{' '}
              <span className="font-mono tabular-nums bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
                {classes.length}
              </span>{' '}
              Lớp học &amp; Học sinh
            </h1>

            <p className="text-xs sm:text-sm text-slate-200/90 max-w-2xl leading-relaxed">
              Theo dõi sĩ số, xem phổ điểm chi tiết từng lớp, đổi tên nhanh và duyệt yêu cầu tham gia lớp học từ học sinh.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              data-sound="success"
              onClick={onOpenCreateClass}
              className="sf-neon-cta min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Tạo lớp học mới</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Summary Metrics Strip */}
      <section aria-label="Tổng quan lớp học" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {summaryItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              style={{ animationDelay: `${idx * 30}ms` }}
              className="sf-teacher-kpi sf-panel-enter rounded-2xl p-4 sm:p-5 flex items-center gap-3.5"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r ${item.topGlow} opacity-55`}
              />
              <div
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${item.iconTone}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-600 dark:text-cyan-200/80 truncate">
                  {item.label}
                </div>
                <div className="font-display text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white leading-tight mt-0.5">
                  {item.value}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {item.meta}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* 3. Pending Join Requests Card */}
      {pendingRequests.length > 0 && (
        <section className="sf-teacher-surface sf-panel-enter p-5 rounded-3xl border-amber-300/80 dark:border-amber-400/35 space-y-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Yêu cầu tham gia lớp chờ duyệt (
                <span className="font-mono tabular-nums">{pendingRequests.length}</span>)
              </span>
            </h2>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Cần giáo viên phê duyệt
            </span>
          </div>

          <div className="divide-y divide-amber-200/60 dark:divide-amber-500/20">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white">
                    Học sinh:{' '}
                    <span className="text-sky-700 dark:text-cyan-300">{req.studentName}</span>{' '}
                    <span className="font-normal text-slate-500 dark:text-slate-400">
                      ({req.studentClass})
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Xin vào lớp: <strong className="text-slate-700 dark:text-slate-200">{req.className}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-sound="success"
                    onClick={() => onApproveJoinRequest(req.id)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs whitespace-nowrap cursor-pointer active:scale-95"
                  >
                    ✓ Duyệt tham gia
                  </button>
                  <button
                    type="button"
                    data-sound="tap"
                    onClick={() => onRejectJoinRequest(req.id)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition whitespace-nowrap cursor-pointer active:scale-95"
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Search & Sort Toolbar */}
      <section className="sf-teacher-surface sf-panel-enter rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 dark:text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên lớp, lịch dạy, phòng học hoặc mã lớp..."
            aria-label="Tìm kiếm lớp học"
            className="w-full min-h-[40px] pl-10 pr-9 py-2 rounded-xl bg-white/90 dark:bg-[#050e20] border border-slate-200/90 dark:border-cyan-500/25 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-cyan-400/20 transition"
          />
          {searchQuery && (
            <button
              type="button"
              data-sound="tap"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-[#050e20] border border-slate-200/80 dark:border-cyan-500/20 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'default' as ClassSortMode, label: 'Mặc định' },
            { id: 'score' as ClassSortMode, label: 'Điểm TB cao' },
            { id: 'students' as ClassSortMode, label: 'Sĩ số nhiều' },
            { id: 'name' as ClassSortMode, label: 'Tên A–Z' }
          ].map((tab) => {
            const active = sortMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-sound="toggle"
                onClick={() => setSortMode(tab.id)}
                className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#081b3d] dark:bg-cyan-500 text-white dark:text-[#031126] shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Class Cards Grid */}
      {filteredClasses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClasses.map((cls, idx) => {
            const isEditingName = editingClassId === cls.id;
            const scoreNum = Number(cls.avgScore) || 0;
            const scoreTone =
              scoreNum >= 7.5
                ? 'text-emerald-700 dark:text-emerald-300'
                : scoreNum >= 6.5
                ? 'text-sky-700 dark:text-cyan-300'
                : 'text-amber-700 dark:text-amber-300';

            return (
              <article
                key={cls.id}
                role="button"
                tabIndex={isEditingName ? -1 : 0}
                data-sound="nav"
                style={{ animationDelay: `${Math.min(idx, 6) * 25}ms` }}
                onClick={() => {
                  if (!isEditingName) onSelectClass(cls);
                }}
                onKeyDown={(e) => {
                  if (!isEditingName && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSelectClass(cls);
                  }
                }}
                className="sf-teacher-tile sf-shimmer-card sf-panel-enter p-5 sm:p-6 rounded-3xl cursor-pointer group flex flex-col justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <div className="space-y-4">
                  {/* Top Row: Index Badge + Clean Unboxed Score & Quick Actions */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#081b3d] to-[#0f3470] text-cyan-300 border border-cyan-400/35 font-display font-extrabold text-sm flex items-center justify-center shrink-0 group-hover:from-cyan-400 group-hover:to-sky-500 group-hover:text-[#031126] transition-all duration-150 shadow-xs tabular-nums">
                        {cls.number}
                      </span>

                      <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 text-xs">
                        <span className={`font-bold font-mono tabular-nums ${scoreTone}`}>
                          Điểm TB: {cls.avgScore}
                        </span>
                        {cls.code && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="font-mono tabular-nums text-slate-500 dark:text-cyan-300/80">
                              Mã: {cls.code}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        data-sound="tap"
                        onClick={() => startRename(cls)}
                        className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-sky-700 dark:text-cyan-300 bg-sky-50/90 dark:bg-cyan-500/12 hover:bg-sky-100 dark:hover:bg-cyan-500/22 border border-sky-200/80 dark:border-cyan-400/25 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        title="Thay đổi tên lớp"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Đổi tên</span>
                      </button>

                      <button
                        type="button"
                        data-sound="tap"
                        onClick={() => onDeleteClass(cls.id)}
                        className="w-8 h-8 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Giải tán lớp"
                        aria-label={`Giải tán lớp ${cls.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Class Title or Inline Editor */}
                  {isEditingName ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={editingClassName}
                        onChange={(e) => setEditingClassName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename(cls.id);
                          } else if (e.key === 'Escape') {
                            cancelRename();
                          }
                        }}
                        autoFocus
                        className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 text-sm font-bold rounded-xl border border-cyan-400 bg-slate-50 dark:bg-[#050e20] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      />
                      <button
                        type="button"
                        data-sound="success"
                        onClick={() => commitRename(cls.id)}
                        disabled={!editingClassName.trim()}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition cursor-pointer shrink-0"
                        title="Lưu tên lớp"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        data-sound="tap"
                        onClick={cancelRename}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
                        title="Hủy"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white group-hover:text-sky-700 dark:group-hover:text-cyan-300 transition-colors leading-snug">
                      {cls.name}
                    </h3>
                  )}

                  {/* Clean Unboxed Metadata Specs Strip */}
                  <div className="pt-3 border-t border-slate-200/70 dark:border-cyan-500/15 flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                      <Users className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400 shrink-0" />
                      <span>{cls.studentsCount} học sinh</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400 shrink-0" />
                      <span>{cls.schedule || 'Lịch học linh hoạt'}</span>
                    </span>
                    {cls.room && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400 shrink-0" />
                        <span>{cls.room}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Interactive Action Footer */}
                <div className="pt-1">
                  <div className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-slate-100/90 dark:bg-[#050e20]/90 group-hover:bg-gradient-to-r group-hover:from-[#061530] group-hover:to-[#0d2d63] text-sky-800 dark:text-cyan-300 group-hover:text-white border border-slate-200/80 dark:border-cyan-500/25 group-hover:border-cyan-400/50 text-xs font-bold transition-all duration-150 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <BarChart3 className="w-4 h-4 text-sky-600 dark:text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                      <span>Xem chi tiết &amp; Phổ điểm</span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-sky-600 dark:text-cyan-400 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-transform duration-150" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Clean Empty State */
        <div className="sf-teacher-surface sf-panel-enter rounded-3xl py-14 px-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 dark:bg-cyan-500/15 border border-sky-400/25 text-sky-600 dark:text-cyan-300 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {classes.length === 0 ? 'Chưa có lớp học nào được tạo' : 'Không tìm thấy lớp học phù hợp'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {classes.length === 0
              ? 'Tạo lớp học đầu tiên để bắt đầu quản lý danh sách học sinh, bảng điểm và phổ điểm.'
              : 'Thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc để xem toàn bộ lớp học đang quản lý.'}
          </p>
          <div className="pt-2">
            {classes.length === 0 ? (
              <button
                type="button"
                data-sound="success"
                onClick={onOpenCreateClass}
                className="sf-neon-cta min-h-[40px] inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo lớp học đầu tiên</span>
              </button>
            ) : (
              <button
                type="button"
                data-sound="tap"
                onClick={() => {
                  setSearchQuery('');
                  setSortMode('default');
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#081b3d] dark:bg-cyan-500 text-white dark:text-[#031126] text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại tìm kiếm</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
