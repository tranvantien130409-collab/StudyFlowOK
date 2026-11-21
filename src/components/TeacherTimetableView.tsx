import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  ExternalLink,
  Plus,
  Clock,
  MapPin,
  Users,
  Trash2,
  Edit3,
  Globe,
  RefreshCw,
  Download,
  X,
  PanelTop,
  BookOpen,
  AlertCircle,
  CalendarClock,
  Check,
  ChevronRight,
  Layers
} from 'lucide-react';
import { TeacherClass, TeacherProfile, TeacherTimetableSlot, TimetableSyncMeta } from '../types';

interface TeacherTimetableViewProps {
  profile: TeacherProfile;
  classes: TeacherClass[];
  onSelectClass: (cls: TeacherClass) => void;
  onToast?: (msg: string) => void;
}

const STORAGE_KEY = 'studyflow_teacher_timetable';
const META_STORAGE_KEY = 'studyflow_teacher_timetable_meta';
const AUTOSYNC_STORAGE_KEY = 'studyflow_teacher_timetable_autosync';
const TRUONG_HOC_VIET_URL =
  'https://truonghocviet.vn/thoikhoabieu/tracuuthoikhoabieu/00102cfd-0000-0000-0000-000000000000/40';
const DEFAULT_THV_TEACHER = 'Nguyễn Quốc Tuấn';

const DAYS_OF_WEEK = [
  { id: 2, label: 'Thứ 2', short: 'T2' },
  { id: 3, label: 'Thứ 3', short: 'T3' },
  { id: 4, label: 'Thứ 4', short: 'T4' },
  { id: 5, label: 'Thứ 5', short: 'T5' },
  { id: 6, label: 'Thứ 6', short: 'T6' },
  { id: 7, label: 'Thứ 7', short: 'T7' }
];

const MORNING_PERIODS = [
  { p: 1, session: 'morning' as const, label: 'Tiết 1', time: '07:00 - 07:45' },
  { p: 2, session: 'morning' as const, label: 'Tiết 2', time: '07:50 - 08:35' },
  { p: 3, session: 'morning' as const, label: 'Tiết 3', time: '08:50 - 09:35' },
  { p: 4, session: 'morning' as const, label: 'Tiết 4', time: '09:40 - 10:25' },
  { p: 5, session: 'morning' as const, label: 'Tiết 5', time: '10:30 - 11:15' }
];

const AFTERNOON_PERIODS = [
  { p: 6, session: 'afternoon' as const, label: 'Tiết 1', time: '13:30 - 14:15' },
  { p: 7, session: 'afternoon' as const, label: 'Tiết 2', time: '14:20 - 15:05' },
  { p: 8, session: 'afternoon' as const, label: 'Tiết 3', time: '15:20 - 16:05' },
  { p: 9, session: 'afternoon' as const, label: 'Tiết 4', time: '16:10 - 16:55' },
  { p: 10, session: 'afternoon' as const, label: 'Tiết 5', time: '17:00 - 17:45' }
];

const getLocalYmd = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (ymd?: string): string => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatShortDate = (ymd?: string): string => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}`;
};

const buildDefaultTimetableFromClasses = (
  classes: TeacherClass[],
  defaultSubject: string
): TeacherTimetableSlot[] => {
  const slots: TeacherTimetableSlot[] = [];

  classes.forEach((cls, idx) => {
    const sched = cls.schedule || '';
    const daysFound: number[] = [];
    const dayMatches = sched.match(/Thứ\s*([2-7])/gi) || [];
    dayMatches.forEach((m) => {
      const n = parseInt(m.replace(/\D+/g, ''), 10);
      if (n >= 2 && n <= 7 && !daysFound.includes(n)) daysFound.push(n);
    });
    if (daysFound.length === 0) {
      daysFound.push(((idx * 2) % 6) + 2);
    }

    const periodMatch = sched.match(/Tiết\s*(\d+)(?:\s*-\s*(\d+))?/i);
    let pStart = periodMatch ? parseInt(periodMatch[1], 10) : idx % 2 === 0 ? 1 : 3;
    const pEnd = periodMatch && periodMatch[2] ? parseInt(periodMatch[2], 10) : pStart + 1;
    if (pStart < 1 || pStart > 10) pStart = 1;
    const count = Math.min(3, Math.max(1, pEnd - pStart + 1));
    const session: 'morning' | 'afternoon' = pStart >= 6 ? 'afternoon' : 'morning';

    daysFound.forEach((day) => {
      slots.push({
        id: `tt_${cls.id}_d${day}_p${pStart}`,
        dayOfWeek: day,
        session,
        periodStart: pStart,
        periodCount: count,
        className: cls.name,
        subject: cls.subject || defaultSubject || 'Toán',
        room: cls.room || `Phòng ${201 + idx}`,
        source: 'manual',
        note: 'Giảng dạy chính khóa',
        portalUrl: TRUONG_HOC_VIET_URL
      });
    });
  });

  return slots;
};

export const TeacherTimetableView: React.FC<TeacherTimetableViewProps> = ({
  profile,
  classes,
  onSelectClass,
  onToast
}) => {
  const [slots, setSlots] = useState<TeacherTimetableSlot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return buildDefaultTimetableFromClasses(classes, profile.subject);
  });

  const [syncMeta, setSyncMeta] = useState<TimetableSyncMeta | null>(() => {
    try {
      const saved = localStorage.getItem(META_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [autoSyncWeekly, setAutoSyncWeekly] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUTOSYNC_STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const [isSyncingThv, setIsSyncingThv] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedTkbid, setSelectedTkbid] = useState<string>('');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [showEmbeddedPortal, setShowEmbeddedPortal] = useState(false);

  // Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TeacherTimetableSlot | null>(null);
  const [formDay, setFormDay] = useState<number>(2);
  const [formPeriodStart, setFormPeriodStart] = useState<number>(1);
  const [formPeriodCount, setFormPeriodCount] = useState<number>(2);
  const [formClassName, setFormClassName] = useState<string>(classes[0]?.name || '');
  const [formSubject, setFormSubject] = useState<string>(profile.subject || 'Toán');
  const [formRoom, setFormRoom] = useState<string>('Phòng 204');
  const [formNote, setFormNote] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const persistTimetableToServer = useCallback(
    (nextSlots: TeacherTimetableSlot[], nextMeta: TimetableSyncMeta | null) => {
      try {
        fetch('/api/teacher/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacherTimetable: nextSlots,
            ...(nextMeta ? { timetableSync: nextMeta } : {})
          })
        }).catch(() => {});
      } catch {}
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    } catch {}
  }, [slots]);

  useEffect(() => {
    try {
      if (syncMeta) {
        localStorage.setItem(META_STORAGE_KEY, JSON.stringify(syncMeta));
      }
    } catch {}
  }, [syncMeta]);

  useEffect(() => {
    try {
      localStorage.setItem(AUTOSYNC_STORAGE_KEY, String(autoSyncWeekly));
    } catch {}
  }, [autoSyncWeekly]);

  const syncMorningFromTruongHocViet = useCallback(
    async (tkbidOverride?: string, silent = false) => {
      setIsSyncingThv(true);
      setSyncError(null);
      try {
        const params = new URLSearchParams({
          url: TRUONG_HOC_VIET_URL,
          teacher: DEFAULT_THV_TEACHER
        });
        if (tkbidOverride) {
          params.set('tkbid', tkbidOverride);
        }

        const res = await fetch(`/api/teacher/truonghocviet-timetable?${params.toString()}`);
        const rawText = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error('Cổng TruongHocViet tạm thời chưa phản hồi dữ liệu hợp lệ.');
        }

        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Không thể lấy Thời khóa biểu từ TruongHocViet.');
        }

        const morningSlots: TeacherTimetableSlot[] = Array.isArray(data.morningSlots)
          ? data.morningSlots
          : [];

        const nextMeta: TimetableSyncMeta = {
          sourceUrl: data.sourceUrl || TRUONG_HOC_VIET_URL,
          teacherName: data.teacherName || DEFAULT_THV_TEACHER,
          schoolId: data.schoolId,
          tkbid: data.tkbid,
          tkbLabel: data.tkbLabel,
          ngayApDung: data.ngayApDung,
          weekStartDate: data.weekStartDate,
          weekEndDate: data.weekEndDate,
          dayDates: data.dayDates,
          syncedAt: data.syncedAt,
          availableTkbs: data.availableTkbs
        };

        setSyncMeta(nextMeta);
        if (data.tkbid) {
          setSelectedTkbid(String(data.tkbid));
        }

        setSlots((prev) => {
          const preservedAfternoon = prev.filter((s) => s.session === 'afternoon');
          const merged = [...morningSlots, ...preservedAfternoon];
          persistTimetableToServer(merged, nextMeta);
          return merged;
        });

        if (!silent) {
          onToast?.(
            `Đã cập nhật lịch buổi sáng (${data.teacherName || DEFAULT_THV_TEACHER}) tuần ${formatShortDate(data.weekStartDate)} – ${formatDisplayDate(data.weekEndDate)}.`
          );
        }
      } catch (err: any) {
        const rawMsg = err?.message || 'Lỗi kết nối Trường Học Việt.';
        const friendlyMsg = rawMsg.includes('Unexpected token') || rawMsg.includes('<!doctype')
          ? 'Cổng TruongHocViet tạm thời chưa phản hồi dữ liệu trực tuyến (đang hiển thị lịch đã lưu).'
          : rawMsg;
        setSyncError(friendlyMsg);
        if (!silent) {
          onToast?.(`Đồng bộ TruongHocViet tạm gián đoạn: ${friendlyMsg}`);
        }
      } finally {
        setIsSyncingThv(false);
      }
    },
    [onToast, persistTimetableToServer]
  );

  // Automatic weekly sync on mount when autoSyncWeekly is enabled
  useEffect(() => {
    if (!autoSyncWeekly) return;
    const todayYmd = getLocalYmd();
    const hasThvMorning = slots.some((s) => s.source === 'truonghocviet' && s.session === 'morning');
    const lastSyncMs = syncMeta?.syncedAt ? new Date(syncMeta.syncedAt).getTime() : 0;
    const isStale = !lastSyncMs || Date.now() - lastSyncMs > 6 * 60 * 60 * 1000;
    const outsideSyncedWeek =
      Boolean(syncMeta?.weekEndDate && todayYmd > syncMeta.weekEndDate) ||
      Boolean(syncMeta?.weekStartDate && todayYmd < syncMeta.weekStartDate);

    if (!hasThvMorning || isStale || outsideSyncedWeek) {
      syncMorningFromTruongHocViet(undefined, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncWeekly]);

  const localTodayYmd = useMemo(() => getLocalYmd(), []);
  const todayDow = useMemo(() => {
    const jsDay = new Date().getDay(); // 0=CN, 1=T2..6=T7
    return jsDay >= 1 && jsDay <= 6 ? jsDay + 1 : 2;
  }, []);

  const visiblePeriods = useMemo(() => {
    if (sessionFilter === 'morning') return MORNING_PERIODS;
    if (sessionFilter === 'afternoon') return AFTERNOON_PERIODS;
    return [...MORNING_PERIODS, ...AFTERNOON_PERIODS];
  }, [sessionFilter]);

  const classFilterOptions = useMemo(() => {
    const names = new Set<string>();
    classes.forEach((c) => names.add(c.name));
    slots.forEach((s) => {
      if (s.className) names.add(s.className);
    });
    return Array.from(names);
  }, [classes, slots]);

  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      if (classFilter !== 'all' && s.className !== classFilter) return false;
      if (sessionFilter !== 'all' && s.session !== sessionFilter) return false;
      return true;
    });
  }, [slots, classFilter, sessionFilter]);

  const morningPeriodsCount = useMemo(
    () => slots.filter((s) => s.session === 'morning').reduce((sum, s) => sum + (s.periodCount || 1), 0),
    [slots]
  );

  const afternoonPeriodsCount = useMemo(
    () => slots.filter((s) => s.session === 'afternoon').reduce((sum, s) => sum + (s.periodCount || 1), 0),
    [slots]
  );

  const totalWeeklyPeriods = useMemo(
    () => slots.reduce((sum, s) => sum + (s.periodCount || 1), 0),
    [slots]
  );

  const openAddModal = (day = 2, period = 6) => {
    setEditingSlot(null);
    setFormDay(day);
    setFormPeriodStart(period);
    setFormPeriodCount(1);
    setFormClassName(classes[0]?.name || 'Toán 10A3');
    setFormSubject(profile.subject || 'Toán');
    setFormRoom(classes[0]?.room || 'Phòng 204');
    setFormNote('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (slot: TeacherTimetableSlot) => {
    setEditingSlot(slot);
    setFormDay(slot.dayOfWeek);
    setFormPeriodStart(slot.periodStart);
    setFormPeriodCount(slot.periodCount);
    setFormClassName(slot.className);
    setFormSubject(slot.subject);
    setFormRoom(slot.room);
    setFormNote(slot.note || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClassName.trim() || !formSubject.trim()) {
      setFormError('Vui lòng nhập đầy đủ Tên lớp và Môn giảng dạy.');
      return;
    }

    const session: 'morning' | 'afternoon' = formPeriodStart >= 6 ? 'afternoon' : 'morning';
    const nextSlot: TeacherTimetableSlot = {
      id: editingSlot ? editingSlot.id : `tt_${Date.now()}`,
      dayOfWeek: formDay,
      session,
      periodStart: formPeriodStart,
      periodCount: formPeriodCount,
      className: formClassName.trim(),
      subject: formSubject.trim(),
      room: formRoom.trim() || 'Phòng học',
      date: syncMeta?.dayDates?.[formDay] || editingSlot?.date,
      source: 'manual',
      note: formNote.trim() || undefined,
      portalUrl: TRUONG_HOC_VIET_URL
    };

    const nextSlots = editingSlot
      ? slots.map((s) => (s.id === editingSlot.id ? nextSlot : s))
      : [...slots, nextSlot];

    setSlots(nextSlots);
    persistTimetableToServer(nextSlots, syncMeta);
    onToast?.(
      editingSlot
        ? `Đã cập nhật tiết dạy lớp ${nextSlot.className}!`
        : `Đã thêm tiết dạy lớp ${nextSlot.className} vào Thời khóa biểu!`
    );
    setIsModalOpen(false);
  };

  const handleDeleteSlot = (slotId: string) => {
    const nextSlots = slots.filter((s) => s.id !== slotId);
    setSlots(nextSlots);
    persistTimetableToServer(nextSlots, syncMeta);
    setIsModalOpen(false);
    onToast?.('Đã xóa tiết dạy khỏi Thời khóa biểu.');
  };

  const handleExportICS = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//StudyFlow//Teacher Timetable//VI'
    ];
    const now = new Date();
    const mondayOffset = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);

    slots.forEach((slot) => {
      const slotYmd = slot.date || syncMeta?.dayDates?.[slot.dayOfWeek];
      let ymd = '';
      if (slotYmd) {
        ymd = slotYmd.replace(/-/g, '');
      } else {
        const d = new Date(monday);
        d.setDate(monday.getDate() + (slot.dayOfWeek - 2));
        ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
      }
      const periodMeta = [...MORNING_PERIODS, ...AFTERNOON_PERIODS].find((p) => p.p === slot.periodStart);
      const startTime = (periodMeta?.time.split(' - ')[0] || '07:00').replace(':', '') + '00';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${slot.id}@studyflow.edu`,
        `DTSTART:${ymd}T${startTime}`,
        `SUMMARY:${slot.subject} - ${slot.className}`,
        `LOCATION:${slot.room}`,
        `DESCRIPTION:${slot.note || 'Lịch giảng dạy StudyFlow'} - ${TRUONG_HOC_VIET_URL}`,
        'END:VEVENT'
      );
    });
    lines.push('END:VCALENDAR');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'thoi_khoa_bieu_giang_day.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onToast?.('Đã xuất tệp lịch giảng dạy (.ics) thành công!');
  };

  const handleJumpToClass = (className: string) => {
    const cleanTarget = className.trim().toLowerCase();
    const matched =
      classes.find((c) => c.name.toLowerCase() === cleanTarget) ||
      classes.find(
        (c) =>
          c.name.toLowerCase().includes(cleanTarget) ||
          cleanTarget.includes(c.name.toLowerCase())
      );
    if (matched) {
      onSelectClass(matched);
    } else {
      onToast?.(`Lớp ${className} chưa có trong danh sách lớp StudyFlow.`);
    }
  };

  const currentDayLabel = DAYS_OF_WEEK.find((d) => d.id === todayDow)?.label || 'Hôm nay';

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 sf-panel-enter">
      {/* Luxury Deep Navy & Neon Hero Header */}
      <section className="sf-navy-hero-banner relative overflow-hidden rounded-3xl text-white p-6 sm:p-7">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-300/90 font-medium">
              <Globe className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span>Đồng bộ trực tuyến · Trường Học Việt</span>
              <span aria-hidden="true" className="text-cyan-400/50">·</span>
              <span className="text-sky-100">{syncMeta?.teacherName || DEFAULT_THV_TEACHER}</span>
              {syncMeta?.weekStartDate && syncMeta?.weekEndDate && (
                <>
                  <span aria-hidden="true" className="text-cyan-400/50">·</span>
                  <span className="font-mono tabular-nums text-emerald-300">
                    Tuần {formatShortDate(syncMeta.weekStartDate)} – {formatDisplayDate(syncMeta.weekEndDate)}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400/25 via-sky-500/20 to-indigo-500/25 border border-cyan-300/40 flex items-center justify-center shrink-0 shadow-[0_0_24px_-4px_rgba(34,211,238,0.45)]">
                <Calendar className="w-6 h-6 text-cyan-300" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance leading-tight">
                Thời khóa biểu Giảng dạy · {profile.name}
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-sky-100/85 leading-relaxed">
              Lịch <strong className="text-cyan-200 font-semibold">buổi sáng (Tiết 1–5)</strong> tự động đồng bộ theo từng tuần từ{' '}
              <a
                href={TRUONG_HOC_VIET_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-sound="tap"
                className="font-semibold text-cyan-300 underline decoration-cyan-400/50 hover:text-cyan-200 transition-colors"
              >
                TruongHocViet
              </a>
              . Lịch <strong className="text-indigo-200 font-semibold">buổi chiều (Tiết 1–5)</strong> lưu giữ riêng các tiết phụ đạo và bồi dưỡng của bạn.
            </p>

            {syncMeta?.syncedAt && (
              <p className="text-[11px] font-mono tabular-nums text-cyan-200/75">
                {syncMeta.tkbLabel || `Ngày ${syncMeta.ngayApDung}`} · Cập nhật lúc{' '}
                {new Date(syncMeta.syncedAt).toLocaleString('vi-VN')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-sound="success"
              disabled={isSyncingThv}
              onClick={() => syncMorningFromTruongHocViet(selectedTkbid || undefined, false)}
              className="sf-neon-cta inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-display font-bold text-xs disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingThv ? 'animate-spin' : ''}`} />
              <span>{isSyncingThv ? 'Đang đồng bộ...' : 'Đồng bộ tuần'}</span>
            </button>

            <a
              href={TRUONG_HOC_VIET_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-sound="tap"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/18 text-white text-xs font-semibold border border-white/20 backdrop-blur-xs transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-300" />
              <span>Mở trang gốc</span>
            </a>

            <button
              type="button"
              data-sound="toggle"
              onClick={() => setShowEmbeddedPortal((prev) => !prev)}
              aria-pressed={showEmbeddedPortal}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold border transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer ${
                showEmbeddedPortal
                  ? 'bg-cyan-400 text-[#031126] border-cyan-300 font-bold shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)]'
                  : 'bg-white/10 hover:bg-white/18 text-white border-white/20'
              }`}
            >
              <PanelTop className="w-3.5 h-3.5" />
              <span>{showEmbeddedPortal ? 'Ẩn cổng nhúng' : 'Xem nhúng'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Sync error banner if upstream fails */}
      {syncError && (
        <div className="sf-teacher-surface p-3.5 rounded-2xl border-rose-300/70 dark:border-rose-500/40 bg-rose-50/75 dark:bg-rose-950/35 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2.5 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{syncError}</span>
          </div>
          <button
            type="button"
            data-sound="tap"
            onClick={() => syncMorningFromTruongHocViet(selectedTkbid || undefined, false)}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs active:scale-[0.97] transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Collapsible Trường Học Việt Embedded Portal */}
      {showEmbeddedPortal && (
        <div className="sf-teacher-surface rounded-3xl overflow-hidden sf-panel-enter">
          <div className="px-4 py-3 bg-gradient-to-r from-[#051129] via-[#091f46] to-[#0d2b60] text-white border-b border-cyan-400/25 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <Globe className="w-4 h-4 text-cyan-300" />
              <span>Trang tra cứu Thời khóa biểu Trường Học Việt</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={TRUONG_HOC_VIET_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-sound="tap"
                className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#031126] text-[11px] font-bold flex items-center gap-1 transition"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Mở tab mới</span>
              </a>
              <button
                type="button"
                data-sound="tap"
                onClick={() => setShowEmbeddedPortal(false)}
                className="p-1.5 rounded-lg text-cyan-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
                aria-label="Đóng cổng nhúng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative h-[460px] bg-slate-100 dark:bg-[#030b1b]">
            <iframe
              src={TRUONG_HOC_VIET_URL}
              title="Trường Học Việt"
              className="w-full h-full border-0"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      {/* Interactive 4-KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          data-sound="toggle"
          onClick={() => setSessionFilter('morning')}
          className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
            sessionFilter === 'morning' ? 'ring-1.5 ring-sky-500 dark:ring-cyan-400' : ''
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Buổi sáng (Tiết 1–5)</span>
            <Calendar className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {morningPeriodsCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">tiết</span>
          </div>
        </button>

        <button
          type="button"
          data-sound="toggle"
          onClick={() => setSessionFilter('afternoon')}
          className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
            sessionFilter === 'afternoon' ? 'ring-1.5 ring-indigo-500 dark:ring-indigo-400' : ''
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Buổi chiều (Tiết 1–5)</span>
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {afternoonPeriodsCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">tiết</span>
          </div>
        </button>

        <button
          type="button"
          data-sound="toggle"
          onClick={() => setSessionFilter('all')}
          className={`sf-teacher-kpi p-4 rounded-2xl text-left cursor-pointer ${
            sessionFilter === 'all' ? 'ring-1.5 ring-emerald-500 dark:ring-emerald-400' : ''
          }`}
        >
          <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng định mức tuần</span>
            <CalendarClock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              {totalWeeklyPeriods}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">tiết / tuần</span>
          </div>
        </button>

        <div className="sf-teacher-kpi p-4 rounded-2xl">
          <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-500" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Lớp giảng dạy</span>
            <Layers className="w-4 h-4 text-sky-600 dark:text-cyan-300 shrink-0" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {classes.length}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">lớp</span>
            </div>
            <span className="text-[11px] font-semibold text-sky-700 dark:text-cyan-300 truncate">
              {currentDayLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Summary & Action Toolbar */}
      <div className="sf-teacher-surface flex flex-col xl:flex-row xl:items-center justify-between gap-3 rounded-2xl p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Session Segmented Control */}
          <div className="inline-flex bg-slate-100/90 dark:bg-[#051025] border border-slate-200/80 dark:border-cyan-500/20 p-1 rounded-xl">
            {[
              { id: 'all', label: 'Cả ngày (10 tiết)' },
              { id: 'morning', label: 'Buổi Sáng (1–5)' },
              { id: 'afternoon', label: 'Buổi Chiều (1–5)' }
            ].map((tab) => {
              const active = sessionFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-sound="toggle"
                  onClick={() => setSessionFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer ${
                    active
                      ? 'bg-[#081b3d] dark:bg-cyan-400 text-white dark:text-[#031126] shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-cyan-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Week Selector from TruongHocViet */}
          {syncMeta?.availableTkbs && syncMeta.availableTkbs.length > 0 && (
            <select
              value={selectedTkbid || syncMeta.tkbid || ''}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedTkbid(nextId);
                syncMorningFromTruongHocViet(nextId, false);
              }}
              className="px-3 py-2 rounded-xl bg-sky-50/90 dark:bg-[#091c3e] border border-sky-200/90 dark:border-cyan-500/30 text-xs font-bold text-sky-900 dark:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 cursor-pointer"
              title="Chọn tuần Thời khóa biểu trên TruongHocViet"
            >
              {syncMeta.availableTkbs.map((w) => (
                <option key={w.tkbid} value={w.tkbid}>
                  {w.label}
                </option>
              ))}
            </select>
          )}

          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#071530] border border-slate-200/90 dark:border-cyan-500/25 text-xs font-bold text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 cursor-pointer"
          >
            <option value="all">Tất cả các lớp ({classFilterOptions.length})</option>
            {classFilterOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={autoSyncWeekly}
            data-sound="toggle"
            onClick={() => setAutoSyncWeekly((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              autoSyncWeekly
                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300/80 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                : 'bg-white dark:bg-[#071530] border-slate-200 dark:border-cyan-500/25 text-slate-600 dark:text-slate-300'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
                autoSyncWeekly
                  ? 'bg-emerald-600 dark:bg-emerald-500 border-emerald-600 dark:border-emerald-400 text-white'
                  : 'border-slate-300 dark:border-slate-600 bg-transparent'
              }`}
            >
              {autoSyncWeekly && <Check className="w-3 h-3 stroke-[3]" />}
            </span>
            <span>Tự động cập nhật sáng theo tuần</span>
          </button>

          <button
            type="button"
            data-sound="tap"
            onClick={handleExportICS}
            className="sf-teacher-tile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-slate-700 dark:text-cyan-100 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Xuất .ICS</span>
          </button>

          <button
            type="button"
            data-sound="tap"
            onClick={() => openAddModal(todayDow, 6)}
            className="sf-neon-cta inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-display font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm tiết chiều / phụ đạo</span>
          </button>
        </div>
      </div>

      {/* Weekly Timetable Grid */}
      <div className="sf-teacher-surface rounded-3xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#051129] via-[#091f46] to-[#0d2b60] text-white border-b border-cyan-400/25">
                <th className="w-32 px-3.5 py-3.5 text-left text-[11px] font-display font-bold uppercase tracking-wider text-cyan-200 border-r border-cyan-400/20">
                  Tiết / Giờ
                </th>
                {DAYS_OF_WEEK.map((d) => {
                  const syncedDayYmd = syncMeta?.dayDates?.[d.id];
                  const isToday = syncedDayYmd ? syncedDayYmd === localTodayYmd : d.id === todayDow;
                  return (
                    <th
                      key={d.id}
                      className={`px-3 py-3 text-center border-r last:border-r-0 border-cyan-400/20 transition-colors ${
                        isToday
                          ? 'bg-cyan-500/20 text-white border-b-2 border-b-cyan-400'
                          : 'text-slate-100'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`font-display text-xs font-bold tracking-tight ${isToday ? 'text-cyan-200' : 'text-white'}`}>
                            {d.label}
                          </span>
                          {isToday && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                              · Hôm nay
                            </span>
                          )}
                        </div>
                        {syncedDayYmd && (
                          <span className="text-[10.5px] font-mono tabular-nums text-cyan-100/75">
                            {formatDisplayDate(syncedDayYmd)}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/75 dark:divide-cyan-900/35">
              {visiblePeriods.map((period) => {
                const isMorningStart = period.p === 1;
                const isAfternoonStart = period.p === 6;
                return (
                  <React.Fragment key={period.p}>
                    {isMorningStart && (
                      <tr className="bg-gradient-to-r from-sky-50/95 via-cyan-50/60 to-transparent dark:from-[#081e42] dark:via-[#0b254f]/80 dark:to-[#07152e]">
                        <td
                          colSpan={7}
                          className="px-4 py-2 text-[11px] font-display font-bold tracking-wide text-sky-900 dark:text-cyan-300 border-b border-sky-200/70 dark:border-cyan-500/25"
                        >
                          Buổi Sáng · Tiết 1 – Tiết 5 <span className="font-sans font-medium text-sky-700/80 dark:text-cyan-200/70">· Tự động đồng bộ theo tuần</span>
                        </td>
                      </tr>
                    )}
                    {isAfternoonStart && (
                      <tr className="bg-gradient-to-r from-indigo-50/95 via-sky-50/50 to-transparent dark:from-[#10183d] dark:via-[#151e4a]/80 dark:to-[#07152e]">
                        <td
                          colSpan={7}
                          className="px-4 py-2 text-[11px] font-display font-bold tracking-wide text-indigo-900 dark:text-indigo-300 border-b border-indigo-200/70 dark:border-indigo-500/25"
                        >
                          Buổi Chiều · Tiết 1 – Tiết 5 <span className="font-sans font-medium text-indigo-700/80 dark:text-indigo-200/70">· Lịch phụ đạo & bồi dưỡng</span>
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-sky-50/35 dark:hover:bg-[#091a38]/55 transition-colors duration-150">
                      <td className="px-3.5 py-2.5 border-r border-slate-200/75 dark:border-cyan-900/35 align-top bg-slate-50/60 dark:bg-[#061229]/70">
                        <div className="font-display text-xs font-extrabold text-slate-900 dark:text-white">
                          {period.label}
                        </div>
                        <div className="text-[10.5px] font-mono tabular-nums text-slate-500 dark:text-cyan-200/70 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-sky-600 dark:text-cyan-400 shrink-0" />
                          <span>{period.time}</span>
                        </div>
                      </td>

                      {DAYS_OF_WEEK.map((day) => {
                        const syncedDayYmd = syncMeta?.dayDates?.[day.id];
                        const isToday = syncedDayYmd ? syncedDayYmd === localTodayYmd : day.id === todayDow;
                        const cellSlots = filteredSlots.filter(
                          (s) =>
                            s.dayOfWeek === day.id &&
                            period.p >= s.periodStart &&
                            period.p < s.periodStart + (s.periodCount || 1)
                        );
                        const startingSlots = cellSlots.filter((s) => s.periodStart === period.p);
                        const isContinuation = cellSlots.length > 0 && startingSlots.length === 0;

                        return (
                          <td
                            key={day.id}
                            className={`p-1.5 border-r last:border-r-0 border-slate-200/75 dark:border-cyan-900/35 align-top min-h-[72px] ${
                              isToday ? 'bg-cyan-500/[0.045] dark:bg-cyan-400/[0.06]' : ''
                            }`}
                          >
                            {startingSlots.map((slot) => {
                              const isMorningSlot = slot.session === 'morning';
                              return (
                                <div
                                  key={slot.id}
                                  data-sound="tap"
                                  onClick={() => openEditModal(slot)}
                                  className={`sf-timetable-slot ${
                                    isMorningSlot ? 'sf-timetable-slot-morning' : 'sf-timetable-slot-afternoon'
                                  } p-2.5 rounded-xl cursor-pointer space-y-1.5 group`}
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span
                                      className={`font-display text-xs font-extrabold truncate ${
                                        isMorningSlot
                                          ? 'text-[#071936] dark:text-cyan-100'
                                          : 'text-indigo-950 dark:text-indigo-100'
                                      }`}
                                    >
                                      {slot.className}
                                    </span>
                                    <span
                                      className={`font-mono tabular-nums text-[10px] font-bold shrink-0 ${
                                        isMorningSlot
                                          ? 'text-sky-700 dark:text-cyan-300'
                                          : 'text-indigo-700 dark:text-indigo-300'
                                      }`}
                                    >
                                      {slot.periodCount} tiết
                                    </span>
                                  </div>

                                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 truncate">
                                    <BookOpen
                                      className={`w-3 h-3 shrink-0 ${
                                        isMorningSlot
                                          ? 'text-sky-600 dark:text-cyan-400'
                                          : 'text-indigo-600 dark:text-indigo-400'
                                      }`}
                                    />
                                    <span className="truncate">{slot.subject}</span>
                                  </div>

                                  <div className="flex items-center justify-between gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1 truncate">
                                      <MapPin className="w-2.5 h-2.5 shrink-0 opacity-75" />
                                      <span className="truncate">{slot.room}</span>
                                    </span>
                                    <button
                                      type="button"
                                      data-sound="nav"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleJumpToClass(slot.className);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[10px] font-bold text-sky-700 dark:text-cyan-300 hover:underline shrink-0 transition-opacity cursor-pointer"
                                    >
                                      Chi tiết →
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {isContinuation && (
                              <div
                                data-sound="tap"
                                onClick={() => openEditModal(cellSlots[0])}
                                className={`sf-timetable-slot p-2.5 rounded-xl border border-dashed text-[11px] font-semibold text-center cursor-pointer ${
                                  cellSlots[0].session === 'morning'
                                    ? 'bg-sky-50/75 dark:bg-cyan-950/30 border-sky-300/80 dark:border-cyan-500/35 text-sky-800 dark:text-cyan-200 hover:border-cyan-500'
                                    : 'bg-indigo-50/75 dark:bg-indigo-950/30 border-indigo-300/80 dark:border-indigo-500/35 text-indigo-800 dark:text-indigo-200 hover:border-indigo-400'
                                }`}
                              >
                                Tiếp tiết {cellSlots[0].className}
                              </div>
                            )}

                            {cellSlots.length === 0 && (
                              <button
                                type="button"
                                data-sound="tap"
                                onClick={() => openAddModal(day.id, period.p)}
                                className="w-full h-14 rounded-xl border border-dashed border-transparent hover:border-cyan-400/70 hover:bg-sky-50/70 dark:hover:bg-cyan-950/30 text-slate-300 hover:text-sky-600 dark:hover:text-cyan-300 flex items-center justify-center transition-all duration-150 cursor-pointer group"
                                title={`Thêm tiết dạy ${day.label} - ${period.session === 'morning' ? 'Buổi Sáng' : 'Buổi Chiều'} ${period.label}`}
                              >
                                <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Linked Classes Quick Strip */}
      <section className="sf-teacher-surface rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
            <span>Lớp giảng dạy đang liên kết ({classes.length} lớp)</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Nhấn vào từng lớp để mở sổ điểm & phổ điểm chi tiết
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {classes.map((cls, idx) => (
            <button
              key={cls.id}
              type="button"
              data-sound="nav"
              onClick={() => onSelectClass(cls)}
              className="sf-teacher-tile p-3.5 rounded-2xl text-left flex items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#081b3d] to-[#0f3574] dark:from-cyan-500/20 dark:to-indigo-500/25 border border-cyan-400/35 text-cyan-200 font-display font-extrabold text-sm flex items-center justify-center shrink-0">
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-sky-700 dark:group-hover:text-cyan-300 transition-colors">
                    {cls.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {cls.room || 'Phòng học'} · <span className="font-mono tabular-nums">{cls.studentsCount}</span> HS
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 dark:group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </section>

      {/* Add/Edit Timetable Slot Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="sf-teacher-surface rounded-3xl max-w-md w-full overflow-hidden shadow-2xl sf-panel-enter">
            <div className="sf-navy-hero-banner px-5 py-4 text-white flex items-center justify-between gap-3">
              <h3 className="font-display text-base font-bold flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-300" />
                <span>{editingSlot ? 'Cập nhật tiết giảng dạy' : 'Thêm tiết vào Thời khóa biểu'}</span>
              </h3>
              <button
                type="button"
                data-sound="tap"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-cyan-100 transition cursor-pointer"
                aria-label="Đóng hộp thoại"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="p-5 sm:p-6 space-y-4">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Thứ</label>
                  <select
                    value={formDay}
                    onChange={(e) => setFormDay(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-cyan-500/30 bg-white dark:bg-[#071530] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Tiết bắt đầu</label>
                  <select
                    value={formPeriodStart}
                    onChange={(e) => setFormPeriodStart(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-cyan-500/30 bg-white dark:bg-[#071530] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  >
                    {[...MORNING_PERIODS, ...AFTERNOON_PERIODS].map((p) => (
                      <option key={p.p} value={p.p}>
                        {p.session === 'morning' ? 'Sáng' : 'Chiều'} · {p.label} ({p.time})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Số tiết</label>
                  <select
                    value={formPeriodCount}
                    onChange={(e) => setFormPeriodCount(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-cyan-500/30 bg-white dark:bg-[#071530] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  >
                    <option value={1}>1 tiết</option>
                    <option value={2}>2 tiết</option>
                    <option value={3}>3 tiết</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Lớp giảng dạy *</label>
                  <input
                    type="text"
                    value={formClassName}
                    onChange={(e) => setFormClassName(e.target.value)}
                    placeholder="VD: Toán 12C2"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-cyan-500/30 bg-white dark:bg-[#071530] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Môn học *</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="VD: Toán"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-cyan-500/30 bg-white dark:bg-[#071530] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Phòng học</label>
                <input
                  type="text"
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  placeholder="VD: Phòng 204"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-cyan-500/30 bg-white dark:bg-[#071530] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Ghi chú bài dạy</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Nội dung tiết dạy hoặc lưu ý Trường Học Việt..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-cyan-500/30 bg-white dark:bg-[#071530] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                />
              </div>

              <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-200/80 dark:border-cyan-900/40">
                {editingSlot ? (
                  <button
                    type="button"
                    data-sound="tap"
                    onClick={() => handleDeleteSlot(editingSlot.id)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-xs font-bold transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa tiết</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-sound="tap"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    data-sound="success"
                    className="sf-neon-cta px-5 py-2 rounded-xl font-display font-bold text-xs cursor-pointer"
                  >
                    Lưu tiết dạy
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
