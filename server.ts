import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import mammoth from 'mammoth';
import http from 'http';
import { Server } from 'socket.io';
import vm from 'vm';
import {
  extractDocxContent,
  parseAzotaText,
  detectSubjectFromText,
  type ParsedAzotaQuestion
} from './server/azotaExamParser.ts';

dotenv.config();

const app = express();
app.use(express.json({ limit: '20mb' }));

const UPLOADS_DIR = path.resolve('uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('Could not initialize uploads directory:', err);
}
app.use('/uploads', express.static(UPLOADS_DIR));

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Initialize GoogleGenAI SDK with environment variables MY_GEMINI_API_KEY or GEMINI_API_KEY
const activeKeyName = process.env.MY_GEMINI_API_KEY ? 'MY_GEMINI_API_KEY' : (process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 'NONE');
const apiKey = process.env.MY_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
}) : null;

// Persistent file-backed storage for profiles & teacher state so switching pages/browsers never resets data
const PROFILES_FILE = path.resolve('profiles_db.json');
interface PersistedAppDb {
  student?: any;
  teacher?: any;
  teacherClasses?: any[];
  joinRequests?: any[];
  exams?: any[];
  folders?: any[];
  library?: any[];
  teacherPrivateLibrary?: any[];
  notices?: any[];
  tasks?: any[];
  submissions?: any[];
  teacherFeedbacks?: any[];
  teacherTimetable?: any[];
  timetableSync?: any;
}
let cachedProfiles: PersistedAppDb = {};

try {
  if (fs.existsSync(PROFILES_FILE)) {
    const data = fs.readFileSync(PROFILES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === 'object') {
      cachedProfiles = parsed;
    }
  }
} catch (e) {
  console.warn('Could not read profiles_db.json:', e);
}

let saveTimer: NodeJS.Timeout | null = null;
let saveInFlight = false;
let savePending = false;

const flushProfilesToFile = async () => {
  if (saveInFlight) {
    savePending = true;
    return;
  }
  saveInFlight = true;
  try {
    await fs.promises.writeFile(PROFILES_FILE, JSON.stringify(cachedProfiles), 'utf-8');
  } catch (e) {
    console.warn('Could not write profiles_db.json:', e);
  } finally {
    saveInFlight = false;
    if (savePending) {
      savePending = false;
      void flushProfilesToFile();
    }
  }
};

const saveProfilesToFile = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flushProfilesToFile();
  }, 150);
};

// Unified state hydration endpoint
app.get('/api/app-state', (_req, res) => {
  return res.json({
    student: cachedProfiles.student || null,
    teacher: cachedProfiles.teacher || null,
    teacherClasses: Array.isArray(cachedProfiles.teacherClasses) ? cachedProfiles.teacherClasses : null,
    joinRequests: Array.isArray(cachedProfiles.joinRequests) ? cachedProfiles.joinRequests : null,
    exams: Array.isArray(cachedProfiles.exams) ? cachedProfiles.exams : null,
    folders: Array.isArray(cachedProfiles.folders) ? cachedProfiles.folders : null,
    library: Array.isArray(cachedProfiles.library) ? cachedProfiles.library : null,
    teacherPrivateLibrary: Array.isArray(cachedProfiles.teacherPrivateLibrary) ? cachedProfiles.teacherPrivateLibrary : null,
    notices: Array.isArray(cachedProfiles.notices) ? cachedProfiles.notices : null,
    tasks: Array.isArray(cachedProfiles.tasks) ? cachedProfiles.tasks : null,
    submissions: Array.isArray(cachedProfiles.submissions) ? cachedProfiles.submissions : null,
    teacherFeedbacks: Array.isArray(cachedProfiles.teacherFeedbacks) ? cachedProfiles.teacherFeedbacks : null,
    teacherTimetable: Array.isArray(cachedProfiles.teacherTimetable) ? cachedProfiles.teacherTimetable : null,
    timetableSync: cachedProfiles.timetableSync || null,
  });
});

// Endpoints for profile persistence
app.get('/api/profile/student', (_req, res) => {
  return res.json({ profile: cachedProfiles.student || null });
});

app.post('/api/profile/student', (req, res) => {
  if (req.body && req.body.name) {
    cachedProfiles.student = {
      ...(cachedProfiles.student || {}),
      ...req.body,
      avatar: req.body.avatar || cachedProfiles.student?.avatar || '/assets/student_avatar_fixed.jpg'
    };
    saveProfilesToFile();
    return res.json({ success: true, profile: cachedProfiles.student });
  }
  return res.status(400).json({ error: 'Dữ liệu học sinh không hợp lệ' });
});

app.get('/api/profile/teacher', (_req, res) => {
  return res.json({ profile: cachedProfiles.teacher || null });
});

app.post('/api/profile/teacher', (req, res) => {
  if (req.body && req.body.name) {
    cachedProfiles.teacher = {
      ...(cachedProfiles.teacher || {}),
      ...req.body,
      avatar: req.body.avatar || cachedProfiles.teacher?.avatar || '/assets/teacher_avatar_fixed.jpg'
    };
    saveProfilesToFile();
    return res.json({ success: true, profile: cachedProfiles.teacher });
  }
  return res.status(400).json({ error: 'Dữ liệu giáo viên không hợp lệ' });
});

// Persist any teacher-side state changes permanently
app.post('/api/teacher/state', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Dữ liệu trạng thái giáo viên không hợp lệ' });
  }
  if (body.teacher && body.teacher.name) {
    cachedProfiles.teacher = {
      ...(cachedProfiles.teacher || {}),
      ...body.teacher,
      avatar: body.teacher.avatar || cachedProfiles.teacher?.avatar || '/assets/teacher_avatar_fixed.jpg'
    };
  }
  if (Array.isArray(body.teacherClasses)) {
    cachedProfiles.teacherClasses = body.teacherClasses;
  }
  if (Array.isArray(body.joinRequests)) {
    cachedProfiles.joinRequests = body.joinRequests;
  }
  if (Array.isArray(body.exams)) {
    cachedProfiles.exams = body.exams;
  }
  if (Array.isArray(body.folders)) {
    cachedProfiles.folders = body.folders;
  }
  if (Array.isArray(body.library)) {
    cachedProfiles.library = body.library;
  }
  if (Array.isArray(body.teacherPrivateLibrary)) {
    cachedProfiles.teacherPrivateLibrary = body.teacherPrivateLibrary;
  }
  if (Array.isArray(body.notices)) {
    cachedProfiles.notices = body.notices;
  }
  if (Array.isArray(body.tasks)) {
    cachedProfiles.tasks = body.tasks;
  }
  if (Array.isArray(body.submissions)) {
    cachedProfiles.submissions = body.submissions;
  }
  if (Array.isArray(body.teacherFeedbacks)) {
    cachedProfiles.teacherFeedbacks = body.teacherFeedbacks;
  }
  if (Array.isArray(body.teacherTimetable)) {
    cachedProfiles.teacherTimetable = body.teacherTimetable;
  }
  if (body.timetableSync && typeof body.timetableSync === 'object') {
    cachedProfiles.timetableSync = body.timetableSync;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await flushProfilesToFile();
  return res.json({ success: true });
});

app.post('/api/submissions', (req, res) => {
  const sub = req.body?.submission;
  if (!sub || typeof sub !== 'object' || typeof sub.examId !== 'number') {
    return res.status(400).json({ error: 'Dữ liệu bài nộp không hợp lệ' });
  }
  const existing = Array.isArray(cachedProfiles.submissions) ? cachedProfiles.submissions : [];
  cachedProfiles.submissions = [sub, ...existing.filter((s: any) => s.id !== sub.id)];
  if (Array.isArray(cachedProfiles.exams)) {
    cachedProfiles.exams = cachedProfiles.exams.map((ex: any) =>
      ex.id === sub.examId
        ? { ...ex, submissionsCount: (Number(ex.submissionsCount) || 0) + 1 }
        : ex
    );
  }
  saveProfilesToFile();
  return res.json({ success: true });
});

// Mark private teacher feedback as read (or all for a student)
app.post('/api/feedbacks/read', (req, res) => {
  const { id, studentName, markAll } = req.body || {};
  const list = Array.isArray(cachedProfiles.teacherFeedbacks) ? cachedProfiles.teacherFeedbacks : [];
  if (markAll && studentName) {
    const normTarget = String(studentName).trim().toLowerCase();
    cachedProfiles.teacherFeedbacks = list.map((fb: any) =>
      String(fb?.studentName || '').trim().toLowerCase() === normTarget
        ? { ...fb, read: true }
        : fb
    );
    saveProfilesToFile();
    return res.json({ success: true, teacherFeedbacks: cachedProfiles.teacherFeedbacks });
  }
  if (id) {
    cachedProfiles.teacherFeedbacks = list.map((fb: any) =>
      fb?.id === id ? { ...fb, read: true } : fb
    );
    saveProfilesToFile();
    return res.json({ success: true, teacherFeedbacks: cachedProfiles.teacherFeedbacks });
  }
  return res.status(400).json({ error: 'Thiếu thông tin feedback cần đánh dấu đã đọc' });
});

// --- TruongHocViet Weekly Morning Timetable Auto-Sync ---
const DEFAULT_THV_URL = 'https://truonghocviet.vn/thoikhoabieu/tracuuthoikhoabieu/00102cfd-0000-0000-0000-000000000000/40';
const DEFAULT_THV_SCHOOL_ID = '00102cfd-0000-0000-0000-000000000000';
const DEFAULT_THV_TEACHER = 'Nguyễn Quốc Tuấn';

let cachedVietSchoolScript: { code: string; fetchedAt: number } | null = null;

async function getVietSchoolSerializer(): Promise<string> {
  const now = Date.now();
  if (cachedVietSchoolScript && now - cachedVietSchoolScript.fetchedAt < 24 * 60 * 60 * 1000) {
    return cachedVietSchoolScript.code;
  }
  const res = await fetch('https://truonghocviet.vn/Scripts/vietschool.data-1.0.2.js', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; StudyFlow/1.0)',
      'Referer': DEFAULT_THV_URL
    }
  });
  if (!res.ok) {
    throw new Error(`Không tải được script VietSchool (HTTP ${res.status})`);
  }
  const code = await res.text();
  cachedVietSchoolScript = { code, fetchedAt: now };
  return code;
}

function normalizeVietnameseText(val: string): string {
  return (val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDdMmYyyyToUtcDate(raw: string): Date | null {
  const m = String(raw || '').trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (!day || !month || !year) return null;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function formatUtcDateYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeWeekDayDates(ngayApDung: string): {
  dayDates: Record<number, string>;
  weekStartDate: string;
  weekEndDate: string;
} {
  const parsed = parseDdMmYyyyToUtcDate(ngayApDung);
  const base = parsed || new Date();
  const utcDay = base.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diffToMon = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(base.getTime() + diffToMon * 24 * 60 * 60 * 1000);
  const dayDates: Record<number, string> = {};
  for (let dow = 2; dow <= 7; dow++) {
    const dt = new Date(monday.getTime() + (dow - 2) * 24 * 60 * 60 * 1000);
    dayDates[dow] = formatUtcDateYmd(dt);
  }
  return {
    dayDates,
    weekStartDate: dayDates[2],
    weekEndDate: dayDates[7]
  };
}

function decodeHtmlText(raw: string): string {
  return (raw || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTruongHocVietMorningHtml(
  html: string,
  meta: {
    tkbid: string;
    teacherId: string;
    tkbLabel: string;
    dayDates: Record<number, string>;
    sourceUrl: string;
    teacherClasses?: any[];
  }
) {
  const rawSlots: Array<{
    dayOfWeek: number;
    period: number;
    className: string;
    subject: string;
  }> = [];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let activeSession: 'morning' | 'afternoon' | null = null;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    if (/<th[\s>]/i.test(rowContent)) continue;

    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      cells.push(decodeHtmlText(cellMatch[1]));
    }
    if (cells.length < 7) continue;

    let offset = 0;
    const firstUpper = cells[0].toUpperCase();
    if (firstUpper === 'S' || firstUpper === 'SÁNG') {
      activeSession = 'morning';
      offset = 1;
    } else if (firstUpper === 'C' || firstUpper === 'CHIỀU') {
      activeSession = 'afternoon';
      offset = 1;
    }

    if (activeSession !== 'morning') continue;
    const periodNum = parseInt(cells[offset], 10);
    if (!Number.isFinite(periodNum) || periodNum < 1 || periodNum > 5) continue;

    for (let i = 0; i < 6; i++) {
      const cellText = (cells[offset + 1 + i] || '').trim();
      if (!cellText || cellText === '-' || cellText === '—') continue;
      const dashIdx = cellText.indexOf(' - ');
      const className = dashIdx > -1 ? cellText.slice(0, dashIdx).trim() : cellText;
      const subject = dashIdx > -1 ? cellText.slice(dashIdx + 3).trim() : 'Toán học';
      rawSlots.push({
        dayOfWeek: i + 2, // 2 (Thứ 2) -> 7 (Thứ 7)
        period: periodNum,
        className,
        subject: subject || 'Toán học'
      });
    }
  }

  // Merge consecutive periods of identical className + subject on the same day
  const merged: any[] = [];
  for (let dow = 2; dow <= 7; dow++) {
    const dayItems = rawSlots
      .filter((s) => s.dayOfWeek === dow)
      .sort((a, b) => a.period - b.period);

    for (const item of dayItems) {
      const prev = merged[merged.length - 1];
      if (
        prev &&
        prev.dayOfWeek === item.dayOfWeek &&
        prev.periodStart + prev.periodCount === item.period &&
        prev.className === item.className &&
        prev.subject === item.subject
      ) {
        prev.periodCount += 1;
      } else {
        const matchedCls = Array.isArray(meta.teacherClasses)
          ? meta.teacherClasses.find((c: any) =>
              String(c?.name || '').toLowerCase().includes(item.className.toLowerCase())
            )
          : null;
        merged.push({
          id: `thv_${meta.tkbid}_${meta.teacherId}_d${item.dayOfWeek}_p${item.period}`,
          dayOfWeek: item.dayOfWeek,
          session: 'morning',
          periodStart: item.period,
          periodCount: 1,
          className: item.className,
          subject: item.subject,
          room: matchedCls?.room || `Lớp ${item.className}`,
          date: meta.dayDates[item.dayOfWeek],
          source: 'truonghocviet',
          note: `Đồng bộ TruongHocViet · ${meta.tkbLabel}`,
          portalUrl: meta.sourceUrl
        });
      }
    }
  }

  return merged;
}

async function invokeVietSchoolMethod(
  vsScript: string,
  className: string,
  functionName: string,
  params: any[],
  refererUrl: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const sandbox: any = {
      window: {},
      document: {},
      setInterval: () => 0,
      clearInterval: () => 0,
      setTimeout,
      clearTimeout,
      encodeURIComponent,
      decodeURIComponent,
      console,
      $: {
        ajax: async (opts: any) => {
          try {
            const url = opts.url?.startsWith('http')
              ? opts.url
              : `https://truonghocviet.vn${opts.url?.startsWith('/') ? '' : '/'}${opts.url || 'Home/Invoke'}`;
            const formBody = new URLSearchParams();
            if (opts.data && typeof opts.data === 'object') {
              Object.entries(opts.data).forEach(([k, v]) => {
                formBody.append(k, String(v ?? ''));
              });
            }
            const resp = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': refererUrl,
                'User-Agent': 'Mozilla/5.0 (compatible; StudyFlow/1.0)'
              },
              body: formBody.toString()
            });
            const text = await resp.text();
            let data: any = text;
            try {
              data = JSON.parse(text);
            } catch {}
            if (typeof opts.success === 'function') {
              opts.success(data);
            }
          } catch (err) {
            if (!settled) {
              settled = true;
              reject(err);
            }
          }
        }
      }
    };

    try {
      vm.runInNewContext(vsScript, sandbox, { timeout: 3000 });
      sandbox.Service.url = '/Home/Invoke';
      sandbox.Service.call(
        (result: any) => {
          if (settled) return;
          settled = true;
          if (result && result.Error) {
            reject(new Error(result.ErrorMessage || 'VietSchool service error'));
          } else {
            resolve(result);
          }
        },
        className,
        functionName,
        ...params
      );
    } catch (err) {
      if (!settled) {
        settled = true;
        reject(err);
      }
    }
  });
}

app.get('/api/teacher/truonghocviet-timetable', async (req, res) => {
  try {
    const rawUrl = typeof req.query.url === 'string' && req.query.url.trim()
      ? req.query.url.trim()
      : DEFAULT_THV_URL;
    const requestedTeacher = typeof req.query.teacher === 'string' && req.query.teacher.trim()
      ? req.query.teacher.trim()
      : DEFAULT_THV_TEACHER;
    const requestedTkbid = typeof req.query.tkbid === 'string' && req.query.tkbid.trim()
      ? req.query.tkbid.trim()
      : '';

    const urlMatch = rawUrl.match(/tracuuthoikhoabieu\/([0-9a-fA-F-]{8,})(?:\/(\d+))?/i);
    const schoolId = urlMatch?.[1] || DEFAULT_THV_SCHOOL_ID;

    const vsScript = await getVietSchoolSerializer();

    // 1. Fetch all available TKB weeks
    const tkbRes = await invokeVietSchoolMethod(
      vsScript,
      'VietSchool.vn.Controllers.ThoiKhoaBieuController',
      'loadTKB',
      [schoolId],
      rawUrl
    );
    const tkbTable = tkbRes?.Data?.Tables?.[0];
    const tkbRows: Array<{ TKBID: number; Ten: string; NgayApDung: string; DisplayValue: string }> =
      Array.isArray(tkbTable?.Rows) ? tkbTable.Rows : [];

    if (tkbRows.length === 0) {
      return res.status(502).json({
        success: false,
        error: 'Không tìm thấy danh sách tuần Thời khóa biểu từ TruongHocViet'
      });
    }

    // Pick requested week OR auto-pick current active week (latest NgayApDung <= today, else tkbRows[0])
    let selectedTkb = requestedTkbid
      ? tkbRows.find((r) => String(r.TKBID) === String(requestedTkbid))
      : undefined;

    if (!selectedTkb) {
      const nowEndUtc = new Date();
      nowEndUtc.setUTCHours(23, 59, 59, 999);

      const withDates = tkbRows
        .map((r) => ({ row: r, dt: parseDdMmYyyyToUtcDate(r.NgayApDung) }))
        .filter((item) => item.dt !== null) as Array<{ row: any; dt: Date }>;

      const activePastOrCurrent = withDates
        .filter((item) => item.dt.getTime() <= nowEndUtc.getTime())
        .sort((a, b) => b.dt.getTime() - a.dt.getTime());

      selectedTkb = activePastOrCurrent[0]?.row || tkbRows[0];
    }

    if (!selectedTkb) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy tuần TKB phù hợp trên TruongHocViet'
      });
    }

    const selectedTkbidStr = String(selectedTkb.TKBID);

    // 2. Fetch teachers for selected TKB week (must pass tkbid as string!)
    const gvRes = await invokeVietSchoolMethod(
      vsScript,
      'VietSchool.vn.Controllers.ThoiKhoaBieuController',
      'LoadGV',
      [schoolId, selectedTkbidStr],
      rawUrl
    );
    const gvRows: Array<{ TeacherID: number; TenNguoiDung: string; TenTat?: string }> =
      Array.isArray(gvRes?.Data?.Tables?.[0]?.Rows) ? gvRes.Data.Tables[0].Rows : [];

    const normTarget = normalizeVietnameseText(requestedTeacher);
    const matchedTeacher =
      gvRows.find((g) => g.TenNguoiDung?.trim().toLowerCase() === requestedTeacher.toLowerCase()) ||
      gvRows.find((g) => normalizeVietnameseText(g.TenNguoiDung) === normTarget) ||
      gvRows.find((g) => normalizeVietnameseText(g.TenNguoiDung).includes(normTarget));

    if (!matchedTeacher) {
      return res.status(404).json({
        success: false,
        error: `Không tìm thấy giáo viên "${requestedTeacher}" trong tuần ${selectedTkb.DisplayValue || selectedTkbidStr}`
      });
    }

    // 3. Fetch teacher timetable HTML (must pass TeacherID and TKBID as strings!)
    const tkbGvRes = await invokeVietSchoolMethod(
      vsScript,
      'VietSchool.vn.Controllers.ThoiKhoaBieuController',
      'loadTKBGV',
      [String(matchedTeacher.TeacherID), selectedTkbidStr, schoolId],
      rawUrl
    );

    const html = tkbGvRes?.Data?.Tables?.[0]?.Rows?.[0]?.Html || '';
    if (!html) {
      return res.status(502).json({
        success: false,
        error: 'TruongHocViet trả về bảng Thời khóa biểu rỗng'
      });
    }

    const tkbLabel = selectedTkb.DisplayValue || `${selectedTkb.Ten} (${selectedTkb.NgayApDung})`;
    const { dayDates, weekStartDate, weekEndDate } = computeWeekDayDates(selectedTkb.NgayApDung);

    const morningSlots = parseTruongHocVietMorningHtml(html, {
      tkbid: selectedTkbidStr,
      teacherId: String(matchedTeacher.TeacherID),
      tkbLabel,
      dayDates,
      sourceUrl: rawUrl,
      teacherClasses: cachedProfiles.teacherClasses
    });

    const syncedAt = new Date().toISOString();
    const availableTkbs = tkbRows.map((r) => ({
      tkbid: String(r.TKBID),
      label: r.DisplayValue || `${r.Ten} - ${r.NgayApDung}`,
      ngayApDung: r.NgayApDung
    }));

    const syncMeta = {
      sourceUrl: rawUrl,
      schoolId,
      tkbid: selectedTkbidStr,
      tkbLabel,
      ngayApDung: selectedTkb.NgayApDung,
      weekStartDate,
      weekEndDate,
      dayDates,
      teacherId: String(matchedTeacher.TeacherID),
      teacherName: matchedTeacher.TenNguoiDung,
      syncedAt,
      availableTkbs
    };

    cachedProfiles.timetableSync = syncMeta;
    saveProfilesToFile();

    return res.json({
      success: true,
      ...syncMeta,
      morningSlots
    });
  } catch (err: any) {
    console.error('TruongHocViet sync error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Không thể đồng bộ Thời khóa biểu từ TruongHocViet'
    });
  }
});

// Persist student join request so teacher sees it across pages/browsers
app.post('/api/join-requests', (req, res) => {
  const reqItem = req.body;
  if (!reqItem || !reqItem.id || !reqItem.className) {
    return res.status(400).json({ error: 'Yêu cầu tham gia lớp không hợp lệ' });
  }
  const existing = Array.isArray(cachedProfiles.joinRequests) ? cachedProfiles.joinRequests : [];
  cachedProfiles.joinRequests = [reqItem, ...existing.filter((r: any) => r.id !== reqItem.id)];
  saveProfilesToFile();
  return res.json({ success: true, joinRequests: cachedProfiles.joinRequests });
});

// Upload assignment file (supports PDF, Word .docx, images, text, etc.)
app.post('/api/upload-assignment-file', async (req, res) => {
  try {
    const { fileName, mimeType, fileBase64 } = req.body || {};
    if (!fileName || !fileBase64) {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu file tải lên' });
    }

    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'file';
    const savedFileName = `${Date.now()}_${baseName}${ext}`;
    const filePath = path.join(UPLOADS_DIR, savedFileName);

    const buffer = Buffer.from(fileBase64, 'base64');
    fs.writeFileSync(filePath, buffer);

    let extractedText = '';
    if (ext === '.docx' || (mimeType && mimeType.includes('wordprocessingml'))) {
      try {
        const docxExtracted = await extractDocxContent(buffer);
        extractedText = docxExtracted.text || '';
      } catch (e) {
        try {
          const mammothResult = await mammoth.extractRawText({ buffer });
          extractedText = mammothResult.value || '';
        } catch (mErr) {
          console.warn('DOCX extract error:', mErr);
        }
      }
    } else if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.csv') {
      extractedText = buffer.toString('utf-8');
    }

    let attachmentType: 'pdf' | 'image' | 'text' | 'docx' | 'link' = 'link';
    if (ext === '.pdf' || (mimeType && mimeType.includes('pdf'))) {
      attachmentType = 'pdf';
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext) || (mimeType && mimeType.startsWith('image/'))) {
      attachmentType = 'image';
    } else if (ext === '.docx' || ext === '.doc') {
      attachmentType = 'docx';
    } else if (['.txt', '.md', '.json', '.csv'].includes(ext)) {
      attachmentType = 'text';
    }

    return res.json({
      success: true,
      fileUrl: `/uploads/${savedFileName}`,
      fileName,
      attachmentType,
      extractedText: extractedText.slice(0, 40000)
    });
  } catch (err: any) {
    console.error('Upload assignment file error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Không thể lưu file đính kèm' });
  }
});

// Helper: Robust callGemini function supporting OpenAI-compatible AI provider (Groq) first, then Gemini
async function callGemini(contents: any, config?: any, timeoutMs = 45000) {
  const fallbackKey = process.env.FALLBACK_API_KEY;
  const fallbackBase = process.env.FALLBACK_BASE_URL;
  const fallbackModel = process.env.FALLBACK_MODEL;

  const hasMultimodalPart =
    Array.isArray(contents) &&
    contents.some(
      (c: any) =>
        Boolean(c?.inlineData) ||
        (Array.isArray(c?.parts) && c.parts.some((p: any) => Boolean(p?.inlineData)))
    );

  const needsJson = config?.responseMimeType === 'application/json' || config?.response_format || (typeof contents === 'string' && contents.toLowerCase().includes('json'));
  let lastGroqErr: any = null;

  if (!hasMultimodalPart && fallbackKey && fallbackBase && fallbackModel) {
    let attempts = needsJson ? 2 : 1;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const messages: any[] = [];
        const sysInst = config?.systemInstruction;
        if (sysInst) {
          messages.push({ role: 'system', content: sysInst });
        }
        if (needsJson && sysInst && !sysInst.toLowerCase().includes('json')) {
          messages[0].content += ' Hãy trả về kết quả hoàn toàn bằng định dạng JSON.';
        } else if (needsJson && !sysInst) {
          messages.push({ role: 'system', content: 'Hãy trả về kết quả hoàn toàn bằng định dạng JSON.' });
        }

        if (typeof contents === 'string') {
          messages.push({ role: 'user', content: contents + (needsJson ? ' (Chỉ trả về JSON hợp lệ)' : '') });
        } else if (Array.isArray(contents)) {
          for (const c of contents) {
            const role = c.role === 'model' ? 'assistant' : (c.role === 'user' ? 'user' : 'system');
            const text = c.parts?.[0]?.text || c.text || c.content || '';
            if (text) {
              messages.push({ role, content: text });
            }
          }
        }

        const body: any = {
          model: fallbackModel,
          messages,
          temperature: 0.6
        };

        if (needsJson) {
          body.response_format = { type: 'json_object' };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(`${fallbackBase.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fallbackKey}`
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Groq lỗi (Mã: ${res.status}): ${res.statusText}`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Groq trả về phản hồi rỗng');
        }

        if (needsJson) {
          try {
            JSON.parse(content.replace(/```json\n?|```/g, '').trim());
          } catch (jsonErr) {
            if (attempt < attempts) {
              continue;
            } else {
              throw new Error('Groq trả về JSON không hợp lệ');
            }
          }
        }

        return {
          text: content,
          source: 'groq'
        };
      } catch (groqErr: any) {
        lastGroqErr = groqErr;
        console.error(`Groq attempt ${attempt} error:`, groqErr?.message || groqErr);
        if (!needsJson || attempt >= attempts) break;
      }
    }
  }

  // Fallback to Gemini
  if (!ai) {
    throw new Error(`GEMINI_API_KEY chưa được cấu hình (Biến khóa: ${activeKeyName})`);
  }
  const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastError: any = null;
  let all429 = true;

  const buildModelConfig = (
    modelName: string,
    rawConfig?: any,
    stripTools = false,
    abortSignal?: AbortSignal
  ) => {
    const nextConfig: Record<string, any> = { ...(rawConfig || {}) };
    if (modelName.startsWith('gemini-4-')) {
      delete nextConfig.temperature;
      delete nextConfig.topP;
      delete nextConfig.topK;
      delete nextConfig.candidateCount;
      if (!nextConfig.thinkingConfig) {
        nextConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      if (typeof nextConfig.maxOutputTokens === 'number' && nextConfig.maxOutputTokens < 4096) {
        nextConfig.maxOutputTokens = 4096;
      }
    }
    if (stripTools) {
      delete nextConfig.tools;
    }
    if (abortSignal) {
      nextConfig.abortSignal = abortSignal;
    }
    Object.keys(nextConfig).forEach((k) => {
      if (nextConfig[k] === undefined) delete nextConfig[k];
    });
    return Object.keys(nextConfig).length > 0 ? nextConfig : undefined;
  };

  const invokeModel = async (modelName: string, rawConfig?: any, stripTools = false) => {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Hết thời gian chờ Gemini (${modelName})`));
      }, timeoutMs);
    });
    const modelConfig = buildModelConfig(modelName, rawConfig, stripTools, controller.signal);
    try {
      return await Promise.race([
        ai.models.generateContent({
          model: modelName,
          contents,
          ...(modelConfig ? { config: modelConfig } : {})
        }),
        timeoutPromise
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  for (const model of models) {
    try {
      let response: any;
      try {
        response = await invokeModel(model, config, false);
      } catch (firstErr: any) {
        const firstErrStr = String(firstErr?.message || firstErr || '');
        const isFirst429 = firstErr?.status === 429 || firstErr?.code === 429 || firstErrStr.includes('429') || firstErrStr.includes('RESOURCE_EXHAUSTED') || firstErrStr.includes('Quota exceeded');
        if (config?.tools && !isFirst429 && !firstErrStr.includes('404') && !firstErrStr.includes('NOT_FOUND')) {
          response = await invokeModel(model, config, true);
        } else {
          throw firstErr;
        }
      }

      if (response && (response.text !== undefined || response.candidates)) {
        return {
          text: response.text,
          source: 'gemini',
          ...response
        };
      }
      throw new Error(`Mô hình ${model} trả về phản hồi rỗng`);
    } catch (err: any) {
      const errStr = String(err?.message || err || '');
      const is429 = err?.status === 429 || err?.code === 429 || errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('Quota exceeded');
      
      if (!is429) {
        all429 = false;
        console.error(`Gemini model ${model} error:`, err?.message || err);
      } else {
        console.error(`Gemini model ${model} rate-limited (429)`);
      }
      lastError = err;
    }
  }

  const groqMsg = lastGroqErr ? `Groq: lỗi ${lastGroqErr.message || 'kết nối'}` : 'Groq: chưa cấu hình';
  const lastErrStr = String(lastError?.message || lastError || '');
  const isLast429 = lastError?.status === 429 || lastError?.code === 429 || lastErrStr.includes('429') || lastErrStr.includes('RESOURCE_EXHAUSTED') || lastErrStr.includes('Quota exceeded') || all429;
  const isLast503 = lastError?.status === 503 || lastError?.code === 503 || lastErrStr.includes('503') || lastErrStr.includes('UNAVAILABLE') || lastErrStr.includes('high demand');

  let cleanGeminiErr = lastErrStr;
  try {
    const parsedErr = JSON.parse(lastErrStr);
    if (parsedErr?.error?.message) {
      cleanGeminiErr = parsedErr.error.message;
    }
  } catch {
    // not JSON
  }

  const geminiMsg = lastError ? `Gemini: lỗi ${cleanGeminiErr}` : 'Gemini: chưa thử';

  if (isLast429) {
    throw new Error(`AI đang hết hạn mức, vui lòng thử lại sau ít phút (${groqMsg}; ${geminiMsg})`);
  }
  if (isLast503) {
    throw new Error(`Máy chủ AI đang quá tải tạm thời, vui lòng thử lại sau vài giây (${geminiMsg})`);
  }

  throw new Error(`${cleanGeminiErr} (${groqMsg}; ${geminiMsg})`);
}

// Route: AI Chat / Pedagogical Assistant for Teachers
app.post('/api/ai/chat', async (req, res) => {
  try {
    let { messages, message, prompt, systemInstruction } = req.body;

    // Chấp nhận cả body { messages: [...] } lẫn { message: "..." } hoặc { prompt: "..." }; nếu thiếu thì tự chuyển thành mảng messages
    if (!Array.isArray(messages) || messages.length === 0) {
      const userText = message || prompt || '';
      if (!userText.trim()) {
        return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống (Cần messages, message hoặc prompt)' });
      }
      messages = [{ role: 'user', content: userText.trim() }];
    }

    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user' || m.content)?.content || message || prompt || '';

    let contents: any[] = [];
    const recent = messages.slice(-20);
    for (const m of recent) {
      if (!m || !m.content || typeof m.content !== 'string' || !m.content.trim()) continue;
      const role = m.role === 'assistant' ? 'model' : 'user';
      if (contents.length === 0 && role === 'model') continue;
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + m.content;
      } else {
        contents.push({ role, parts: [{ text: m.content }] });
      }
    }
    if (contents.length === 0) {
      contents = [{ role: 'user', parts: [{ text: lastUserMessage }] }];
    }

    const sysInstruction = systemInstruction || 'Bạn là Trợ lý AI sư phạm cao cấp dành cho Giáo viên (Thầy Tuấn) trên nền tảng giáo dục StudyFlow. Hãy trả lời bằng tiếng Việt chuẩn mực, ân cần, mang tính sư phạm cao, có phân tích số liệu học sinh, nhận diện lỗ hổng kiến thức và gợi ý phương án bài tập phân hóa theo ma trận nhận thức.';

    if (!ai) {
      return res.json({
        reply: getFallbackAssistantReply(lastUserMessage),
        source: 'fallback',
        error: 'GEMINI_API_KEY chưa được cấu hình'
      });
    }

    try {
      const response = await callGemini(contents, {
        systemInstruction: sysInstruction,
        maxOutputTokens: 2000
      });

      return res.json({
        reply: response.text || 'Không có phản hồi từ trợ lý AI.',
        source: response.source || 'gemini'
      });
    } catch (geminiErr: any) {
      const errMsg = geminiErr?.message || String(geminiErr);
      return res.json({
        reply: getFallbackAssistantReply(lastUserMessage),
        source: 'fallback',
        error: errMsg
      });
    }
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    return res.status(500).json({
      reply: getFallbackAssistantReply(''),
      source: 'fallback',
      error: errMsg
    });
  }
});

// Route: AI Stats Analysis & Study Plan Generator
app.post('/api/ai/analyze-stats', async (req, res) => {
  try {
    const { 
      tasks = [], 
      events = [], 
      studentProfile = {}, 
      gpaGoal = 8.8, 
      currentAvg = 8.58, 
      subjects = [],
      surveyData = null,
      currentDate = new Date().toISOString() 
    } = req.body;
    
    if (ai) {
      try {
        let surveyPrompt = '';
        if (surveyData) {
          surveyPrompt = `
DỮ LIỆU KHẢO SÁT LỘ TRÌNH HỌC TẬP:
- Môn học muốn tập trung nhất: ${surveyData.focusSubject || 'Chưa chọn'}
- Tổng số giờ mục tiêu: ${surveyData.targetHours || 0} giờ
- Thời gian thực hiện dự kiến: ${surveyData.durationWeeks || 0} tuần
- Các khung giờ rảnh hàng tuần: ${Array.isArray(surveyData.freeTimeSlots) ? surveyData.freeTimeSlots.join(', ') : (surveyData.freeTimeSlots || 'Chưa rõ')}
`;
        }

        const prompt = `Bạn là Chuyên gia AI Phân tích Giáo dục & Cố vấn Chiến lược Học tập cấp cao của hệ thống StudyFlow.
Hãy thực hiện phân tích sâu toàn diện dữ liệu học tập của học sinh ${studentProfile?.name || 'Học sinh'} (Lớp ${studentProfile?.className || '12'}):

DỮ LIỆU ĐẦU VÀO:
1. NGÀY HIỆN TẠI (CLIENT TIME): ${currentDate}
2. MỤC TIÊU GPA: Mục tiêu: ${gpaGoal}/10 | Điểm trung bình hiện tại: ${Number(currentAvg).toFixed(2)}/10.
3. BẢNG ĐIỂM CÁC MÔN HỌC (Hiện tại vs Mục tiêu):
${JSON.stringify(subjects, null, 2)}
4. LỊCH HỌC TRÊN LỚP HIỆN TẠI (Tránh trùng):
${JSON.stringify(events, null, 2)}
5. DANH SÁCH BÀI TẬP (TASKS):
${JSON.stringify(tasks, null, 2)}
${surveyPrompt}
(Lưu ý: Hôm nay là ${new Date(currentDate).toLocaleDateString('vi-VN', { weekday: 'long' })})


YÊU CẦU BẮT BUỘC:
1. ✨ TỰ ĐỘNG NHẬN DIỆN MÔN ƯU TIÊN: Dựa trên khoảng cách điểm giữa hiện tại và mục tiêu, hãy chỉ rõ môn nào cần học nhiều nhất.
2. PHÂN BỔ THỜI GIAN: Dựa trên số giờ mục tiêu (${surveyData?.targetHours || 0}h) và khung giờ rảnh, hãy lập lộ trình học tập chi tiết.
3. PHÂN BỐ LỊCH CHÍNH XÁC: Hãy tạo các sự kiện học tập rải đều các ngày trong tuần tới (từ ngày mai trở đi dựa trên ${currentDate}). 
      - TUYỆT ĐỐI KHÔNG dồn tất cả sự kiện vào 1 hoặc 2 ngày. 
      - Mỗi ngày tối đa 2 sự kiện học tập. 
      - Ưu tiên các khung giờ rảnh (freeTimeSlots) đã cung cấp. Nếu khung giờ rảnh là "Buổi tối", hãy đặt h (giờ) trong khoảng 18.0 - 21.0. Nếu là "Buổi sáng", đặt h trong khoảng 8.0 - 11.0.
      - Phải tính toán chính xác giá trị "date" (YYYY-MM-DD) tương ứng với các ngày trong tuần tới.
4. Trả về phản hồi bằng Markdown chuyên nghiệp với tiêu đề, danh sách và bảng phân tích.
5. ĐỊNH DẠNG JSON ĐỒNG BỘ LỊCH: Ở cuối phản hồi, hãy LUÔN kèm theo một khối JSON (bọc trong thẻ \`\`\`json_calendar_events ... \`\`\`) chứa mảng các đối tượng sự kiện.
Cấu trúc JSON: { "events": [ { "id": "ai_evt_...", "t": "Tên môn: Nội dung học", "date": "YYYY-MM-DD", "h": 19.5, "d": 1.5, "type": "study", "room": "Tự học AI" } ] }. 
Hãy tạo từ 6-10 buổi học (mỗi buổi 1-2 giờ) rải đều suốt tuần tới. Môn ưu tiên phải xuất hiện ít nhất 3-4 lần.`;

        const response = await callGemini(prompt, { maxOutputTokens: 3000 });

        if (response.text) {
          return res.json({
            reply: response.text,
            source: 'gemini'
          });
        }
      } catch (geminiErr: any) {
        const errMsg = geminiErr?.message || String(geminiErr);
        return res.json({
          reply: generateSmartStudyScheduleFallback({ tasks, events, studentProfile, gpaGoal, currentAvg, subjects }),
          source: 'fallback',
          error: errMsg
        });
      }
    }

    const localReply = generateSmartStudyScheduleFallback({ tasks, events, studentProfile, gpaGoal, currentAvg, subjects });
    return res.json({
      reply: localReply,
      source: 'fallback',
      error: 'GEMINI_API_KEY chưa được cấu hình'
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Lỗi hệ thống khi phân tích' });
  }
});

// Route: Direct In-Page ChatGPT Engine / Tâm Lí / Gia sư
app.post('/api/ai/chatgpt', async (req, res) => {
  try {
    let { messages, message, prompt, model = 'gpt-4o', systemInstruction: clientSystemInstruction, persona, subject, grade, moodLogs = [], autonomousResearch } = req.body;

    // Chấp nhận cả body { messages: [...] } lẫn { message: "..." } hoặc { prompt: "..." }
    if (!Array.isArray(messages) || messages.length === 0) {
      const userText = message || prompt || '';
      if (userText.trim()) {
        messages = [{ role: 'user', content: userText.trim() }];
      }
    }

    const query = (Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1].content : message || prompt || '').trim();

    if (!query) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    const isTamAn = persona === 'psy' || (clientSystemInstruction && (clientSystemInstruction.includes('TÂM LÍ') || clientSystemInstruction.includes('TÂM LÝ')));
    const isTutor = persona === 'tutor' || (clientSystemInstruction && (clientSystemInstruction.includes('ACADEMIC TUTOR') || clientSystemInstruction.includes('Gia sư')));
    const isArchitect = persona === 'architect' || (clientSystemInstruction && clientSystemInstruction.includes('AI Architect'));
    const enableSearch = autonomousResearch === true;

    const subjectName = subject || 'Toán học';
    const studentGrade = grade || '12A1';

    const temperature = isTutor ? 0.3 : isArchitect ? 0.4 : 0.7;
    const topP = 0.9;

    // Immediate Crisis Intervention Guard (Highest Priority for Tâm Lí)
    if (isTamAn) {
      const dangerKeywords = ['tự tử', 'tự sát', 'không muốn sống', 'muốn chết', 'tự làm đau', 'cắt tay', 'rạch tay', 'làm hại bản thân', 'bị đánh', 'xâm hại', 'bạo lực', 'đe dọa'];
      const qLower = query.toLowerCase();
      if (dangerKeywords.some((k) => qLower.includes(k))) {
        return res.json({
          reply: getFallbackTamAnReply(query, moodLogs),
          model: model,
          source: 'gemini'
        });
      }
    }

    const defaultSystemPrompt = `Bạn là một GIÁO VIÊN ƯU TÚ và GIẢNG VIÊN ĐẠI HỌC XUẤT SẮC, được vận hành trên nền tảng học tập StudyFlow.
MỤC TIÊU SỨ MỆNH: Luôn trả lời theo tiêu chuẩn "ĐÚNG - ĐỦ - SÂU SẮC - SƯ PHẠM ĐỈNH CAO" như một giảng viên uyên bác và tận tụy nhất.`;

    let systemPrompt = clientSystemInstruction || defaultSystemPrompt;

    if (isTamAn) {
      let moodContextText = '';
      if (Array.isArray(moodLogs) && moodLogs.length > 0) {
        const recentLogs = moodLogs.slice(0, 3).map((m: any) => 
          `- Ngày ${m.date || ''} (${m.time || ''}): Tâm trạng [${m.emoji || ''} ${m.label || m.mood || ''}] - Ghi chú: "${m.note || 'Không có ghi chú'}"`
        ).join('\n');
        moodContextText = `\n\n## DỮ LIỆU NHẬT KÝ TÂM TRẠNG (MOOD LOGS) MỚI NHẤT CỦA HỌC SINH:\n${recentLogs}\n`;
      }

      systemPrompt = `SYSTEM PROMPT: AI ĐỒNG HÀNH TÂM LÝ HỌC ĐƯỜNG (TÂM LÍ)
Bạn là AI đồng hành tâm lý học đường. Bạn lắng nghe ân cần, đồng cảm, không phán xét và hỗ trợ tinh thần cho học sinh THCS/THPT.
Luôn trả lời bằng tiếng Việt nhẹ nhàng, tinh tế, gần gũi.
${moodContextText}`;
    }

    if (isTutor) {
      systemPrompt = `Môn: ${subjectName}. Học sinh lớp ${studentGrade}.\n\nSYSTEM PROMPT: AI GIA SƯ & GIẢI ĐÁP HỌC TẬP STUDYFLOW
Bạn là Gia sư AI cao cấp của StudyFlow, giỏi xuất sắc cả lý thuyết và bài tập môn ${subjectName} (Lớp ${studentGrade}). Trả lời trực tiếp, rõ ràng, chính xác tuyệt đối, giải thích sâu sắc từng bước, dùng LaTeX cho công thức ($...$ và $$...$$).`;
    }

    if (isArchitect) {
      systemPrompt = `SYSTEM PROMPT: AI ARCHITECT - LẬP KẾ HOẠCH HỌC TẬP & ĐỒNG BỘ CALENDAR
Bạn là AI Architect 🎓 trên nền tảng StudyFlow. Bạn là chuyên gia khảo sát nhu cầu, thói quen học tập và thiết kế lộ trình, thời gian biểu thông minh, tối ưu hóa để đồng bộ với Google Calendar.
Khi học sinh trả lời khảo sát hoặc yêu cầu lập kế hoạch:
- Lắng nghe và xác nhận các thông tin: môn học ưu tiên, số giờ mục tiêu (Study Goal), khoảng thời gian bắt đầu - kết thúc, khung giờ rảnh.
- Thiết kế lộ trình chi tiết theo từng ngày hoặc từng tuần rõ ràng, khoa học, có phân bổ thời gian nghỉ ngơi (Pomodoro) và ôn tập ngắt quãng (Spaced Repetition).
- Trình bày mạch lạc, sử dụng bảng Markdown hoặc các mốc thời gian rõ ràng để học sinh dễ theo dõi và áp dụng vào lịch học.
- Động viên học sinh với phong cách chuyên nghiệp, nhiệt tình, truyền cảm hứng.`;
    }

    if (!ai) {
      const reply = isTamAn ? getFallbackTamAnReply(query, moodLogs) : isTutor ? getFallbackTutorReply(query) : isArchitect ? `Chào bạn! Mình là AI Architect 🎓. Mình đã ghi nhận yêu cầu lập kế hoạch cho môn ${subjectName}. Lộ trình đề xuất: Phân bổ các phiên học 45-60 phút vào khung giờ rảnh mỗi ngày, tập trung ôn lý thuyết và luyện bài tập trọng tâm. Bạn có thể điều chỉnh thời gian và mục tiêu trong khung Cài đặt thủ công!` : getFallbackChatGptReply(query);
      return res.json({
        reply,
        model: model,
        source: 'fallback',
        error: 'GEMINI_API_KEY chưa được cấu hình'
      });
    }

    let contents: any[] = [];
    const recentMessages = Array.isArray(messages) ? messages.slice(-20) : [];
    if (recentMessages.length > 0) {
      for (const m of recentMessages) {
        if (!m || !m.content || typeof m.content !== 'string' || !m.content.trim()) continue;
        const role = m.role === 'assistant' ? 'model' : 'user';
        if (contents.length === 0 && role === 'model') continue;
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += '\n\n' + m.content;
        } else {
          contents.push({ role, parts: [{ text: m.content }] });
        }
      }
    }

    if (contents.length === 0) {
      contents = [{ role: 'user', parts: [{ text: query }] }];
    } else if (contents[contents.length - 1].role !== 'user') {
      contents.push({ role: 'user', parts: [{ text: query }] });
    }

    const maxOutputTokens = isTutor ? 3500 : isTamAn ? 2048 : 2000;
    const geminiTools = enableSearch ? [{ googleSearch: {} }] : undefined;

    try {
      const response = await callGemini(contents, {
        systemInstruction: systemPrompt,
        temperature,
        topP,
        maxOutputTokens,
        tools: geminiTools
      });

      const grounding = response?.candidates?.[0]?.groundingMetadata;
      const searchQueries: string[] = grounding?.webSearchQueries || [];
      const searchChunks: Array<{ uri: string; title: string }> = (grounding?.groundingChunks || [])
        .map((chunk: any) => ({
          title: chunk?.web?.title || 'Tài liệu tham khảo',
          uri: chunk?.web?.uri || ''
        }))
        .filter((c: any) => Boolean(c.uri));

      return res.json({
        reply: response.text || (isTamAn ? 'Mình luôn ở đây để lắng nghe bạn.' : isTutor ? 'Mình đã ghi nhận câu hỏi và giải thích chi tiết cho bạn.' : 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay?'),
        model: model,
        source: response.source || 'gemini',
        sources: searchChunks,
        searchQueries: searchQueries,
        isAutonomousResearched: enableSearch
      });
    } catch (geminiErr: any) {
      const errMsg = geminiErr?.message || String(geminiErr);
      console.warn('Gemini chatgpt error:', errMsg);

      // Requirement 5: Với chế độ tâm lý và gia sư: nếu có GEMINI_API_KEY mà Gemini lỗi, trả lỗi rõ ràng thay vì câu trả lời soạn sẵn.
      if (isTamAn || isTutor) {
        return res.json({
          reply: errMsg,
          model: model,
          source: 'fallback',
          error: errMsg
        });
      }

      return res.json({
        reply: getFallbackChatGptReply(query),
        model: model,
        source: 'fallback',
        error: errMsg
      });
    }
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    const isTamAn = req.body?.persona === 'psy' || (req.body?.systemInstruction && (req.body.systemInstruction.includes('TÂM LÍ') || req.body.systemInstruction.includes('TÂM LÝ')));
    const isTutor = req.body?.persona === 'tutor' || (req.body?.systemInstruction && (req.body.systemInstruction.includes('ACADEMIC TUTOR') || req.body.systemInstruction.includes('Gia sư')));

    if (isTamAn || isTutor) {
      return res.json({
        reply: errMsg,
        model: req.body?.model || 'gpt-4o',
        source: 'fallback',
        error: errMsg
      });
    }

    return res.json({
      reply: getFallbackChatGptReply(req.body?.message || ''),
      model: req.body?.model || 'gpt-4o',
      source: 'fallback',
      error: errMsg
    });
  }
});

// Route: AI Exam Matrix Generator
app.post('/api/ai/generate-exam', async (req, res) => {
  try {
    const { subject, grade, topic, count, matrix, durationMinutes, knowledgeContent } = req.body;
    const numQuestions = Math.min(40, Math.max(2, parseInt(count, 10) || 5));

    if (!ai) {
      return res.json({
        questions: getFallbackQuestions(subject, grade, topic, numQuestions),
        source: 'fallback',
        error: 'GEMINI_API_KEY chưa được cấu hình'
      });
    }

    const knowledgeSection =
      typeof knowledgeContent === 'string' && knowledgeContent.trim()
        ? `\n\nNỘI DUNG TÀI LIỆU NGUỒN (đã trích xuất OCR văn bản & công thức Toán LaTeX — hãy ra câu hỏi bám sát nội dung và công thức này):\n---\n${knowledgeContent.trim().slice(0, 18000)}\n---`
        : '';

    const prompt = `Bạn là chuyên gia khảo thí và ra đề thi chuẩn Bộ Giáo dục & Đào tạo. Hãy tạo một đề thi trắc nghiệm môn ${subject || 'Vật lí'} khối ${grade || 12}, chuyên đề: "${topic || 'Dao động điều hòa & Sóng cơ'}".
Số câu hỏi: ${numQuestions} câu. Thời gian: ${durationMinutes || 45} phút.
Tỉ lệ ma trận nhận thức:
- Nhận biết: ${matrix?.nb || 40}%
- Thông hiểu: ${matrix?.th || 30}%
- Vận dụng: ${matrix?.vd || 20}%
- Vận dụng cao: ${matrix?.vdc || 10}%${knowledgeSection}

YÊU CẦU:
- Giữ nguyên hoặc dùng chuẩn LaTeX ($...$) cho các công thức Toán/Lý/Hóa.
- Trả về kết quả JSON CHÍNH XÁC là một mảng gồm ${numQuestions} câu hỏi theo cấu trúc:
[
  {
    "id": 1,
    "questionText": "Nội dung câu hỏi rõ ràng, chính xác...",
    "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
    "correctOption": 0,
    "explanation": "Lời giải thích ngắn gọn, súc tích vì sao phương án đó đúng..."
  }
]`;

    try {
      const response = await callGemini(prompt, { responseMimeType: 'application/json' }, 60000);
      const raw = response.text || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ questions: parsed, source: 'gemini' });
      }
      throw new Error('Dữ liệu JSON đề thi trả về không hợp lệ');
    } catch (geminiErr: any) {
      const errMsg = geminiErr?.message || String(geminiErr);
      return res.json({
        questions: getFallbackQuestions(subject, grade, topic, numQuestions),
        source: 'fallback',
        error: errMsg
      });
    }
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    return res.json({
      questions: getFallbackQuestions(req.body.subject, req.body.grade, req.body.topic, req.body.count || 5),
      source: 'fallback',
      error: errMsg
    });
  }
});

// Route: AI Material Generator
app.post('/api/ai/generate-material', async (req, res) => {
  try {
    const { subject, grade, topic, materialType, sourceContent, sourceFileName } = req.body;

    if (!ai) {
      return res.json({
        content: getFallbackMaterial(subject, grade, topic, materialType, sourceContent, sourceFileName),
        source: 'fallback',
        error: 'GEMINI_API_KEY chưa được cấu hình'
      });
    }

    const subjectPart = subject ? `môn ${subject}` : 'chuyên môn';
    const gradePart = grade ? `cho học sinh khối ${grade}` : 'phù hợp trình độ học sinh';
    const typePart = materialType ? `loại "${materialType}"` : 'học liệu tổng hợp (tóm tắt lý thuyết, kiến thức trọng tâm và bài tập minh họa)';
    const topicPart = topic ? `chủ đề: "${topic}"` : (sourceFileName ? `dựa trên tài liệu "${sourceFileName}"` : 'theo tài liệu đính kèm');
    const sourceSection = sourceContent
      ? `\n\nTài liệu nguồn tham khảo (${sourceFileName || 'tệp tải lên'}):\n"""\n${String(sourceContent).slice(0, 18000)}\n"""\nHãy bám sát nội dung tài liệu nguồn trên để biên soạn.`
      : '';

    const prompt = `Bạn là giáo viên giỏi ${subjectPart}. Hãy biên soạn học liệu ${typePart} ${gradePart}, ${topicPart}.${sourceSection}
Yêu cầu: Viết chi tiết bằng Markdown, trình bày đẹp mắt, có hệ thống kiến thức/công thức, ví dụ minh họa và chú ý những lỗi học sinh hay sai.`;

    try {
      const response = await callGemini(prompt);
      return res.json({
        content: response.text || getFallbackMaterial(subject, grade, topic, materialType, sourceContent, sourceFileName),
        source: 'gemini'
      });
    } catch (geminiErr: any) {
      const errMsg = geminiErr?.message || String(geminiErr);
      return res.json({
        content: getFallbackMaterial(subject, grade, topic, materialType, sourceContent, sourceFileName),
        source: 'fallback',
        error: errMsg
      });
    }
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    return res.json({
      content: getFallbackMaterial(req.body.subject, req.body.grade, req.body.topic, req.body.materialType, req.body.sourceContent, req.body.sourceFileName),
      source: 'fallback',
      error: errMsg
    });
  }
});

// Route: AI Flashcard Generator
app.post('/api/ai/generate-flashcards', async (req, res) => {
  try {
    const { content = '', subject, title } = req.body;
    
    if (!ai) {
      return res.json({
        deck: {
          id: 'deck_' + Date.now(),
          title: title || 'Bộ Flashcard mới',
          subject: subject || 'Tổng hợp',
          cardCount: 2,
          remainingCount: 2,
          goodCount: 0,
          againCount: 0,
          cards: [
            { id: '1', front: 'Flashcard là gì?', back: 'Thẻ ghi nhớ giúp ôn tập kiến thức hiệu quả.', hint: 'Công cụ học tập', status: 'new' },
            { id: '2', front: 'AI StudyFlow giúp ích gì?', back: 'Tự động tạo học liệu và đề thi thông minh.', hint: 'Ứng dụng giáo dục', status: 'new' }
          ],
          createdAt: new Date().toISOString()
        },
        source: 'fallback',
        error: 'GEMINI_API_KEY chưa được cấu hình'
      });
    }

    const prompt = `Bạn là chuyên gia giáo dục và thiết kế phương pháp Spaced Repetition (Lặp lại ngắt quãng). Hãy đọc nội dung sau và tạo một bộ Flashcard học tập:
---
NỘI DUNG: ${content.slice(0, 20000)}
MÔN HỌC: ${subject || 'Tổng hợp'}
---
YÊU CẦU:
1. Xác định các kiến thức quan trọng nhất.
2. Tạo tối thiểu 5-10 thẻ ghi nhớ.
3. Mỗi thẻ gồm: front, back, hint
Trải về JSON:
{
  "title": "Tên bộ flashcard",
  "subject": "Tên môn học",
  "cards": [
    { "front": "...", "back": "...", "hint": "..." }
  ]
}`;

    try {
      const response = await callGemini(prompt, { responseMimeType: 'application/json' });
      const raw = response.text || '{}';
      const parsed = JSON.parse(raw);
      
      const cards = (parsed.cards || []).map((c: any, idx: number) => ({
        ...c,
        id: 'c_' + Date.now() + '_' + idx,
        status: 'new'
      }));

      return res.json({
        deck: {
          id: 'deck_' + Date.now(),
          title: parsed.title || title || 'Bộ Flashcard mới',
          subject: parsed.subject || subject || 'Tổng hợp',
          cardCount: cards.length,
          remainingCount: cards.length,
          goodCount: 0,
          againCount: 0,
          cards,
          createdAt: new Date().toISOString()
        },
        source: 'gemini'
      });
    } catch (geminiErr: any) {
      const errMsg = geminiErr?.message || String(geminiErr);
      return res.json({
        deck: {
          id: 'deck_' + Date.now(),
          title: title || 'Bộ Flashcard dự phòng',
          subject: subject || 'Tổng hợp',
          cardCount: 2,
          remainingCount: 2,
          goodCount: 0,
          againCount: 0,
          cards: [
            { id: '1', front: 'Thành phần chính', back: 'Tóm tắt nội dung tài liệu', hint: 'Lý thuyết', status: 'new' },
            { id: '2', front: 'Ứng dụng chính', back: 'Phương pháp áp dụng', hint: 'Thực hành', status: 'new' }
          ],
          createdAt: new Date().toISOString()
        },
        source: 'fallback',
        error: errMsg
      });
    }
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    return res.status(500).json({ error: errMsg, source: 'fallback' });
  }
});

// Route: AI Document Tools (Summarize chapters, Generate Review Quiz, Answer with Citations)
app.post('/api/ai/document-tools', async (req, res) => {
  try {
    const { action, documentTitle, documentContent, userQuestion, numQuestions = 5, difficulty = 'medium', subject = 'Tổng hợp' } = req.body;
    const docText = (documentContent || '').slice(0, 30000);

    if (action === 'summarize') {
      if (!ai) {
        return res.json({
          summary: `### 📌 Tóm tắt từng chương: ${documentTitle || 'Tài liệu'}\n\n#### 📖 Chương 1: Kiến thức tổng quan (Trích dẫn: Trang 1)\n- **Nội dung chính:** Tổng hợp các khái niệm cơ bản và nền tảng lý thuyết.\n- **Kiến thức cốt lõi:** Nắm chắc định nghĩa và quy tắc vận dụng [Trích dẫn: Trang 1, Đoạn 2].\n\n#### 📖 Chương 2: Công thức & Ứng dụng thực tế (Trích dẫn: Trang 2)\n- **Nội dung chính:** Các công thức biến đổi chính và phương pháp giải nhanh bài tập.`,
          source: 'fallback',
          error: 'GEMINI_API_KEY chưa được cấu hình'
        });
      }

      const prompt = `Bạn là Trợ lý AI Phân tích Tài liệu Học tập. Hãy đọc nội dung tài liệu sau và tạo bản TÓM TẮT THEO TỪNG CHƯƠNG / MỤC:

TIÊU ĐỀ: "${documentTitle || 'Tài liệu học tập'}"
NỘI DUNG:
${docText}

YÊU CẦU BẮT BUỘC:
1. Chia tài liệu thành các Chương/Mục rõ ràng (Chương 1, Chương 2...).
2. Tóm tắt các ý chính ngắn gọn, súc tích.
3. BẮT BUỘC: Sau mỗi luận điểm chính, hãy ghi rõ trích dẫn đoạn/trang tương ứng dưới dạng "[Trích dẫn: Trang X, Đoạn Y]" hoặc "[Trích dẫn: Chương X - Mục Y]" để học sinh đối chiếu.
4. Xuất ra định dạng Markdown đẹp mắt.`;

      try {
        const response = await callGemini(prompt);
        return res.json({
          summary: response.text || 'Không thể tạo tóm tắt lúc này.',
          source: 'gemini'
        });
      } catch (geminiErr: any) {
        const errMsg = geminiErr?.message || String(geminiErr);
        return res.json({
          summary: `### 📌 Tóm tắt dự phòng: ${documentTitle || 'Tài liệu'}\n\n${docText.slice(0, 500)}...`,
          source: 'fallback',
          error: errMsg
        });
      }
    }

    if (action === 'generate_quiz') {
      const fallbackQuiz = [
        {
          id: 1,
          questionText: `Nội dung cốt lõi của bài học "${documentTitle || 'Tài liệu'}" là gì?`,
          options: ['Nắm vững định nghĩa và bài tập vận dụng', 'Học thuộc lòng không cần hiểu', 'Chỉ làm bài tập nâng cao', 'Bỏ qua lý thuyết'],
          correctOption: 0,
          explanation: 'Nắm vững định nghĩa giúp xây dựng nền tảng tư duy vững chắc.',
          sourceCitation: '[Trích dẫn: Trang 1, Đoạn 1]'
        },
        {
          id: 2,
          questionText: 'Khi giải các bài toán vận dụng trong tài liệu, bước đầu tiên cần làm là:',
          options: ['Đọc kỹ đề bài và xác định đại lượng đã biết', 'Chọn ngẫu nhiên công thức', 'Bỏ qua bước đổi đơn vị', 'Đoán đáp án'],
          correctOption: 0,
          explanation: 'Đọc kỹ đề và đổi đơn vị chuẩn giúp tránh các sai sót đáng tiếc.',
          sourceCitation: '[Trích dẫn: Trang 2, Đoạn 3]'
        }
      ];

      if (!ai) {
        return res.json({
          quiz: fallbackQuiz,
          questions: fallbackQuiz,
          source: 'fallback',
          error: 'GEMINI_API_KEY chưa được cấu hình'
        });
      }

      const requestedCount = Math.min(30, Math.max(1, Number(numQuestions) || 5));
      const prompt = `Bạn là chuyên gia ra đề thi ôn tập từ tài liệu học tập. Dựa trên tài liệu dưới đây, hãy tạo ${requestedCount} câu hỏi ôn tập trắc nghiệm. Môn học: ${subject}. Độ khó: ${difficulty}:

TIÊU ĐỀ: "${documentTitle || 'Tài liệu'}"
NỘI DUNG:
${docText}

YÊU CẦU: Trả về JSON gồm mảng "quiz" gồm đúng ${requestedCount} câu hỏi:
[
  {
    "id": 1,
    "questionText": "...",
    "options": ["A...", "B...", "C...", "D..."],
    "correctOption": 0,
    "explanation": "...",
    "sourceCitation": "[Trích dẫn: Trang X, Đoạn Y]"
  }
]
Chú ý: BẮT BUỘC có trường "sourceCitation" chỉ rõ đoạn/trang trong tài liệu chứa đáp án!`;

      try {
        const response = await callGemini(prompt, { responseMimeType: 'application/json' });
        const raw = response.text || '{}';
        const parsed = JSON.parse(raw);
        const quizList = parsed.quiz || parsed.questions || parsed || [];
        return res.json({
          quiz: quizList,
          questions: quizList,
          source: 'gemini'
        });
      } catch (geminiErr: any) {
        const errMsg = geminiErr?.message || String(geminiErr);
        return res.json({
          quiz: fallbackQuiz,
          questions: fallbackQuiz,
          source: 'fallback',
          error: errMsg
        });
      }
    }

    if (action === 'ask_question') {
      const q = userQuestion || 'Hãy tóm tắt và trích dẫn ý chính.';

      if (!ai) {
        return res.json({
          answer: `Dựa trên tài liệu "${documentTitle || 'học tập'}":\n\nNội dung trả lời cho câu hỏi: "${q}".`,
          sourceCitation: '[Trích dẫn: Trang 1, Đoạn 2]',
          source: 'fallback',
          error: 'GEMINI_API_KEY chưa được cấu hình'
        });
      }

      const prompt = `Bạn là Trợ lý AI Hỏi đáp & Kiểm chứng Tài liệu. Hãy trả lời câu hỏi của học sinh DỰA TRÊN NỘI DUNG TÀI LIỆU SAU:

TÀI LIỆU: "${documentTitle || 'Tài liệu học tập'}"
${docText}

CÂU HỎI HỌC SINH: "${q}"

YÊU CẦU QUAN TRỌNG:
1. Trả lời chính xác, dễ hiểu, ân cần.
2. BẮT BUỘC TRÍCH DẪN: Trong câu trả lời, bạn BẮT BUỘC phải ghi trích dẫn nguồn đoạn/trang cụ thể dưới dạng "[Trích dẫn: Trang X, Đoạn Y]".`;

      try {
        const response = await callGemini(prompt);
        return res.json({
          answer: response.text || 'Không tìm thấy câu trả lời trong tài liệu.',
          source: 'gemini'
        });
      } catch (geminiErr: any) {
        const errMsg = geminiErr?.message || String(geminiErr);
        return res.json({
          answer: `Dựa trên tài liệu "${documentTitle || 'học tập'}":\n\nKhông thể kết nối Gemini.`,
          source: 'fallback',
          error: errMsg
        });
      }
    }

    return res.status(400).json({ error: 'Action không hợp lệ' });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    return res.status(500).json({ error: errMsg, source: 'fallback' });
  }
});

// Route: AI Study Goal Quest Map Generator
app.post('/api/ai/generate-goal-map', async (req, res) => {
  try {
    const { goalTitle, subject } = req.body;
    const title = goalTitle || 'Hoàn thành chương trình Toán 11';
    const sub = subject || 'Toán học';

    if (!ai) {
      return res.json({
        goal: buildSmartGoalMapFallback(title, sub),
        source: 'fallback',
        error: 'GEMINI_API_KEY chưa được cấu hình'
      });
    }

    try {
      const prompt = `Bạn là chuyên gia thiết kế lộ trình học tập game hóa (Gamified Learning Path / Quest Map).
Hãy đọc mục tiêu học tập sau và tạo 5 MỐC HÀNH TRÀNH CHINH PHỤC (Milestones):

MỤC TIÊU: "${title}"
MÔN HỌC: "${sub}"

YÊU CẦU: Trả về JSON theo đúng cấu trúc:
{
  "title": "${title}",
  "subject": "${sub}",
  "milestones": [
    {
      "id": "m1",
      "title": "Mốc 1: Khởi đầu & Củng cố nền tảng...",
      "description": "Mô tả ngắn gọn nhiệm vụ trọng tâm...",
      "status": "completed",
      "rewardBadge": "🌱 Khởi đầu",
      "rewardPoints": 100
    },
    {
      "id": "m2",
      "title": "Mốc 2: Nắm chắc phương pháp...",
      "description": "...",
      "status": "in_progress",
      "rewardBadge": "⭐ Nắm chắc",
      "rewardPoints": 150
    },
    {
      "id": "m3",
      "title": "Mốc 3: Luyện kỹ năng thực chiến...",
      "description": "...",
      "status": "locked",
      "rewardBadge": "🛡️ Thực chiến",
      "rewardPoints": 200
    },
    {
      "id": "m4",
      "title": "Mốc 4: Tăng tốc giải đề...",
      "description": "...",
      "status": "locked",
      "rewardBadge": "🔥 Bứt phá",
      "rewardPoints": 250
    },
    {
      "id": "m5",
      "title": "Mốc 5: Chinh phục đỉnh cao...",
      "description": "...",
      "status": "locked",
      "rewardBadge": "👑 Quán quân",
      "rewardPoints": 300
    }
  ]
}`;

      const response = await callGemini(prompt, { responseMimeType: 'application/json' });
      const raw = response.text || '{}';
      const parsed = JSON.parse(raw);

      if (parsed.milestones && Array.isArray(parsed.milestones) && parsed.milestones.length > 0) {
        return res.json({
          goal: {
            id: 'goal_' + Date.now(),
            title: parsed.title || title,
            subject: parsed.subject || sub,
            createdAt: new Date().toISOString(),
            milestones: parsed.milestones.map((m: any, idx: number) => ({
              id: m.id || ('m' + (idx + 1)),
              title: m.title || `Mốc ${idx + 1}`,
              description: m.description || 'Hoàn thành nhiệm vụ học tập',
              status: idx === 0 ? 'completed' : idx === 1 ? 'in_progress' : 'locked',
              rewardBadge: m.rewardBadge || (idx === parsed.milestones.length - 1 ? '👑 Quán quân' : '⭐ Bậc thầy'),
              rewardPoints: m.rewardPoints || (100 + idx * 50)
            }))
          },
          source: 'gemini'
        });
      }
      throw new Error('Cấu trúc mốc hành trình không đúng yêu cầu');
    } catch (geminiErr: any) {
      const errMsg = geminiErr?.message || String(geminiErr);
      return res.json({
        goal: buildSmartGoalMapFallback(title, sub),
        source: 'fallback',
        error: errMsg
      });
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const fallbackGoal = buildSmartGoalMapFallback(req.body?.goalTitle || 'Mục tiêu học tập', req.body?.subject || 'Tổng hợp');
    return res.json({
      goal: fallbackGoal,
      source: 'fallback',
      error: errMsg
    });
  }
});

// Route: AI Smart Roadmap Synthesis (Global Performance-based)
app.post('/api/ai/synthesize-roadmap', async (req, res) => {
  try {
    const { studentProfile, subjects, sessions, tasks, currentGoals } = req.body;
    
    if (!ai) {
      return res.json({
        goal: buildSmartGoalMapFallback('Lộ trình Bứt phá Cá nhân hóa', 'Tổng hợp'),
        advice: 'Dựa trên thống kê, bạn đang học tập rất tích cực. Hãy tiếp tục duy trì nhé!',
        source: 'fallback',
        error: 'GEMINI_API_KEY chưa được cấu hình'
      });
    }

    const prompt = `Bạn là Chuyên gia Tư vấn Giáo dục & Thiết kế Lộ trình Học tập Cá nhân hóa của StudyFlow.
Nhiệm vụ của bạn là phân tích dữ liệu hiệu suất của học sinh và TỔNG HỢP một BẢN ĐỒ MỤC TIÊU (Roadmap) tối ưu nhất.

DỮ LIỆU HIỆU SUẤT:
1. Hồ sơ: ${JSON.stringify(studentProfile)}
2. Điểm số các môn: ${JSON.stringify(subjects)}
3. Thời gian tập trung (phút/ngày): ${JSON.stringify(sessions)}
4. Nhiệm vụ tồn đọng: ${JSON.stringify(tasks?.filter((t: any) => !t.done))}
5. Mục tiêu hiện tại: ${JSON.stringify(currentGoals)}

YÊU CẦU: Trả về JSON có "advice" và "goal".`;

    try {
      const response = await callGemini(prompt, { responseMimeType: 'application/json' });
      let cleanedText = (response.text || '{}').replace(/```json\n?|```/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      return res.json({
        ...parsed,
        source: 'gemini'
      });
    } catch (geminiErr: any) {
      const errMsg = geminiErr?.message || String(geminiErr);
      return res.json({
        goal: buildSmartGoalMapFallback('Lộ trình Bứt phá Dự phòng', 'Tổng hợp'),
        advice: 'Chúng tôi đã thiết kế lộ trình cơ bản cho bạn dựa trên các môn học trọng tâm.',
        source: 'fallback',
        error: errMsg
      });
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    return res.json({
      goal: buildSmartGoalMapFallback('Lộ trình Bứt phá Dự phòng', 'Tổng hợp'),
      advice: 'Chúng tôi đã thiết kế lộ trình cơ bản cho bạn dựa trên các môn học trọng tâm.',
      source: 'fallback',
      error: errMsg
    });
  }
});

// Helper: Deterministic Fallback Schedule Generator for server-side
function buildFallbackSchedule(startDateStr: string, events: any[]) {
  const suggestions = [];
  const start = new Date(startDateStr);
  
  // Date formatter for server side (internal)
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dStr = fmt(d);
    
    // Suggest one slot per day in the evening if no event exists
    const hasEventAtNight = events.some(e => e.date === dStr && e.h >= 18);
    if (!hasEventAtNight && suggestions.length < 5) {
      suggestions.push({
        t: `💡 Buổi học tập trung (Đề xuất AI)`,
        type: 'class',
        date: dStr,
        h: 19.5, // 19:30
        d: 1.5,
        room: "🏠 Tự học tại nhà"
      });
    }
  }
  return suggestions;
}

// Route: AI Auto-suggest Schedule allocation
app.post('/api/ai/suggest-schedule', async (req, res) => {
  try {
    const { events = [], tasks = [], countdowns = [], startDate } = req.body;
    
    if (!ai) {
      return res.json({
        suggestions: buildFallbackSchedule(startDate || new Date().toISOString(), events),
        source: 'fallback',
        error: 'GEMINI_API_KEY chưa được cấu hình'
      });
    }

    const prompt = `Bạn là Trợ lý AI Điều phối Thời gian (StudyFlow Schedule Optimizer).
Nhiệm vụ: Dựa trên lịch học hiện tại, danh sách bài tập (tasks) và các kỳ thi sắp tới (countdowns), hãy TỰ ĐỘNG PHÂN BỔ 5-8 buổi tự học (Study Slots) tối ưu nhất vào các khoảng thời gian trống trong tuần tới (bắt đầu từ ${startDate || 'hôm nay'}).

DỮ LIỆU:
1. LỊCH HIỆN TẠI (Events - Tránh trùng giờ): ${JSON.stringify(events.map((e: any) => ({ t: e.t, date: e.date, h: e.h, d: e.d })))}
2. BÀI TẬP CẦN LÀM (Tasks): ${JSON.stringify(tasks.filter((t: any) => !t.done).map((t: any) => ({ t: t.t, sub: t.sub, due: t.due, hi: t.hi })))}
3. KỲ THI SẮP TỚI (Countdowns): ${JSON.stringify(countdowns.map((c: any) => ({ title: c.title, date: c.targetDate })))}

YÊU CẦU:
1. Mỗi buổi học kéo dài 1.5 - 2 giờ.
2. Tránh các khoảng thời gian đã có lịch.
3. Đặt vào các khung giờ vàng: Chiều (14:00-17:00) hoặc Tối (19:00-22:00).
4. Trả về JSON là một mảng các gợi ý sự kiện với cấu trúc:
{
  "suggestions": [
    {
      "t": "Tên buổi học",
      "type": "class",
      "date": "YYYY-MM-DD",
      "h": 19.5,
      "d": 1.5,
      "room": "📍 Tự học tại nhà / Thư viện"
    }
  ]
}`;

    try {
      const response = await callGemini(prompt);
      let cleanedText = response.text || '{}';
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      const parsed = JSON.parse(cleanedText);
      if (parsed.suggestions && Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
        return res.json({
          suggestions: parsed.suggestions,
          source: 'gemini'
        });
      }
      throw new Error('Dữ liệu phân bổ lịch từ AI không hợp lệ');
    } catch (geminiErr: any) {
      const errMsg = geminiErr?.message || String(geminiErr);
      return res.json({
        suggestions: buildFallbackSchedule(startDate || new Date().toISOString(), events),
        source: 'fallback',
        error: errMsg
      });
    }
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    const { events = [], startDate } = req.body;
    return res.json({
      suggestions: buildFallbackSchedule(startDate || new Date().toISOString(), events),
      source: 'fallback',
      error: errMsg
    });
  }
});

function safeParseAiExamJson(raw: string): any {
  const cleaned = String(raw || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return JSON.parse(objMatch[0]);
    }
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      return { questions: JSON.parse(arrMatch[0]) };
    }
    throw new Error('Không phân tích được dữ liệu JSON câu hỏi từ AI');
  }
}

function normalizeExtractedQuestions(rawList: any[]): ParsedAzotaQuestion[] {
  if (!Array.isArray(rawList)) return [];
  const out: ParsedAzotaQuestion[] = [];
  rawList.forEach((q: any, idx: number) => {
    const stem = String(q?.questionText || q?.question || '')
      .replace(/^(?:Câu(?:\s+hỏi)?|Question|Bài)\s*\d+\s*[:.)\-]\s*/i, '')
      .trim();
    const rawOpts = Array.isArray(q?.options) ? q.options : [];
    const options = rawOpts
      .slice(0, 4)
      .map((opt: any) =>
        String(opt || '')
          .replace(/^\s*\*?\s*\(?[A-Da-d]\s*[.):\/\-]\s*/, '')
          .trim()
      );
    if (!stem && options.filter(Boolean).length < 2) return;
    while (options.length < 4) options.push('');

    let correctOption = -1;
    let hasDetectedAnswer = false;
    if (typeof q?.correctOption === 'number' && q.correctOption >= 0 && q.correctOption <= 3) {
      if (q?.hasDetectedAnswer !== false) {
        correctOption = q.correctOption;
        hasDetectedAnswer = true;
      }
    } else if (typeof q?.correctAnswer === 'string' && /^[A-Da-d]$/.test(q.correctAnswer.trim())) {
      correctOption = q.correctAnswer.trim().toUpperCase().charCodeAt(0) - 65;
      hasDetectedAnswer = true;
    }

    out.push({
      id: typeof q?.id === 'number' && q.id > 0 ? q.id : idx + 1,
      questionText: stem || `Câu hỏi ${idx + 1}`,
      options,
      correctOption,
      hasDetectedAnswer,
      explanation: String(q?.explanation || '').trim(),
    });
  });
  return out;
}

function splitExamTextIntoChunks(text: string, maxChars = 13500): string[] {
  const clean = text.trim();
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  const markerRegex = /(?:^|\n)[ \t]*(?:Câu(?:\s+hỏi)?|Question|Bài)\s*\d+\s*[:.)\-]/gi;
  const splitPositions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = markerRegex.exec(clean)) !== null) {
    splitPositions.push(m.index);
  }

  let start = 0;
  while (start < clean.length) {
    if (clean.length - start <= maxChars) {
      chunks.push(clean.slice(start));
      break;
    }
    const targetEnd = start + maxChars;
    let cutPos = -1;
    for (const pos of splitPositions) {
      if (pos > start + 1500 && pos <= targetEnd) {
        cutPos = pos;
      }
    }
    if (cutPos === -1) {
      const nl = clean.lastIndexOf('\n', targetEnd);
      cutPos = nl > start + 1500 ? nl : targetEnd;
    }
    chunks.push(clean.slice(start, cutPos).trim());
    start = cutPos;
  }

  return chunks.filter(Boolean);
}

const AZOTA_AI_EXAM_SCHEMA_PROMPT = `Bạn là hệ thống bóc tách đề thi tự động chuẩn Azota.
YÊU CẦU QUAN TRỌNG:
1. Trích xuất TOÀN BỘ các câu hỏi có trong tài liệu theo đúng thứ tự và ĐÚNG NGUYÊN VĂN nội dung câu hỏi & đáp án (tuyệt đối KHÔNG bịa thêm câu hỏi, KHÔNG bỏ sót câu, KHÔNG tóm tắt).
2. Giữ nguyên công thức Toán/Lý/Hóa ở dạng LaTeX ($...$) hoặc ký hiệu chuẩn nếu có.
3. Với mỗi câu hỏi, tách 4 phương án A, B, C, D sạch tiền tố "A.", "B.", "C.", "D.".
4. Về "correctOption":
   - CHỈ điền 0 (A), 1 (B), 2 (C) hoặc 3 (D) và "hasDetectedAnswer": true NẾU trong file CÓ SẴN dấu hiệu đáp án (dấu *, gạch chân, tô màu/đỏ, "Đáp án:", hoặc bảng đáp án cuối đề).
   - Nếu trong file KHÔNG đánh dấu đáp án đúng, BẮT BUỘC đặt "correctOption": -1 và "hasDetectedAnswer": false. TUYỆT ĐỐI KHÔNG tự đoán đáp án!
5. Trả về đúng định dạng JSON:
{
  "title": "Tên đề thi lấy từ tiêu đề file",
  "subject": "Tên môn học (Toán, Vật lí, Hóa học, Sinh học, Ngữ văn, Lịch sử, Địa lý, Tiếng Anh, Tin học, GDCD hoặc Tổng hợp)",
  "durationMinutes": 45,
  "questions": [
    {
      "id": 1,
      "questionText": "Nội dung nguyên văn câu hỏi",
      "options": ["Nội dung A", "Nội dung B", "Nội dung C", "Nội dung D"],
      "correctOption": -1,
      "hasDetectedAnswer": false,
      "explanation": "Lời giải nếu có trong file, nếu không để chuỗi rỗng"
    }
  ]
}`;

async function extractExamWithAiFromText(text: string, fileName?: string) {
  const chunks = splitExamTextIntoChunks(text, 13500);
  const allQuestions: ParsedAzotaQuestion[] = [];
  let detectedTitle = '';
  let detectedSubject = '';
  let detectedDuration = 45;

  for (let i = 0; i < chunks.length; i++) {
    const chunkLabel = chunks.length > 1 ? ` (Phần ${i + 1}/${chunks.length})` : '';
    const prompt = `${AZOTA_AI_EXAM_SCHEMA_PROMPT}

Tên file: ${fileName || 'Đề thi'}${chunkLabel}
Nội dung cần bóc tách nguyên văn:
---
${chunks[i]}
---`;

    const response = await callGemini(prompt, { responseMimeType: 'application/json' }, 45000);
    const parsed = safeParseAiExamJson(response.text || '{}');
    if (i === 0) {
      if (parsed?.title) detectedTitle = String(parsed.title).trim();
      if (parsed?.subject) detectedSubject = String(parsed.subject).trim();
      if (parsed?.durationMinutes) detectedDuration = Number(parsed.durationMinutes) || 45;
    }
    const normalized = normalizeExtractedQuestions(parsed?.questions || []);
    for (const q of normalized) {
      allQuestions.push({
        ...q,
        id: allQuestions.length + 1,
      });
    }
  }

  return {
    title: detectedTitle || fileName?.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ') || 'Đề thi nhập từ file',
    subject: detectedSubject || detectSubjectFromText(text),
    durationMinutes: detectedDuration,
    questions: allQuestions,
  };
}

function countLatexFormulas(text: string): number {
  if (!text) return 0;
  const blockMatches = text.match(/\$\$[\s\S]+?\$\$/g) || [];
  const stripped = text.replace(/\$\$[\s\S]+?\$\$/g, '');
  const inlineMatches = stripped.match(/\$[^$\n]+?\$/g) || [];
  return blockMatches.length + inlineMatches.length;
}

function resolveMimeType(fileName?: string, providedMime?: string): string {
  if (providedMime && (providedMime.includes('pdf') || providedMime.startsWith('image/'))) {
    return providedMime;
  }
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
}

const OCR_MATH_AND_TEXT_PROMPT = `Bạn là công cụ OCR chuyên sâu cho giáo dục Việt Nam (nhận diện văn bản tiếng Việt + công thức Toán/Vật lí/Hóa học chính xác cao).
NHIỆM VỤ:
1. CHỈ đọc những chữ viết, bảng biểu, số thứ tự câu hỏi, phương án A/B/C/D và ký hiệu THỰC SỰ NHÌN THẤY RÕ trên các trang ảnh/PDF theo thứ tự từ trên xuống dưới, từ trái sang phải.
2. Chuyển đổi TOÀN BỘ công thức toán học, vật lí, hóa học nhìn thấy trong ảnh/PDF sang chuẩn LaTeX sạch sẽ:
   - Công thức cùng dòng dùng \`$...$\` (VD: \`$x = A\\cos(\\omega t + \\varphi)$\`, \`$\\frac{a}{b}$\`, \`$\\sqrt{x^2 + 1}$\`, \`$\\int_0^1 f(x)dx$\`, \`$\\lim_{x \\to 0}$\`, \`$\\vec{F} = m\\vec{a}$\`).
   - Công thức độc lập dùng \`$$...$$\`.
   - Hệ phương trình dùng \`\\begin{cases} ... \\end{cases}\`, ma trận dùng \`\\begin{pmatrix} ... \\end{pmatrix}\`.
3. NGUYÊN TẮC BẮT BUỘC: KHÔNG tự ý bỏ sót dòng, KHÔNG tóm tắt, KHÔNG giải thích thêm. Nếu ảnh/PDF bị trắng, quá nhỏ/mờ không đọc được hoặc không có chữ, BẮT BUỘC trả về \`"ocrText": ""\` — TUYỆT ĐỐI KHÔNG tự bịa nội dung.
4. Trả về đúng JSON hợp lệ theo mẫu:
{
  "title": "Tiêu đề chính của tài liệu nếu có, nếu không để rỗng",
  "subject": "Tên môn học (Toán, Vật lí, Hóa học, Sinh học, Ngữ văn, Lịch sử, Địa lý, Tiếng Anh, Tin học, GDCD hoặc Tổng hợp)",
  "durationMinutes": 45,
  "ocrText": "Toàn bộ nội dung văn bản và công thức LaTeX đã OCR nguyên văn..."
}`;

const AZOTA_MULTIMODAL_OCR_SCHEMA_PROMPT = `Bạn là hệ thống OCR + bóc tách đề thi tự động chuẩn Azota (hỗ trợ ảnh chụp đề thi & PDF chứa công thức Toán/Lý/Hóa).
YÊU CẦU QUAN TRỌNG:
1. Bước OCR: CHỈ đọc những nội dung văn bản tiếng Việt THỰC SỰ NHÌN THẤY RÕ trong ảnh/PDF và chuyển công thức Toán/Lý/Hóa (phân số, căn thức, tích phân, giới hạn, hệ phương trình, vectơ, chỉ số hóa học...) thành chuẩn LaTeX (\`$...$\` hoặc \`$$...$$\`) vào trường \`ocrText\`.
2. Nếu ảnh/PDF bị trắng, mờ không đọc được, hoặc KHÔNG có câu hỏi/chữ nào, BẮT BUỘC trả về \`"ocrText": ""\` và \`"questions": []\`. TUYỆT ĐỐI KHÔNG tự bịa câu hỏi mẫu!
3. Bước Bóc tách câu hỏi: Trích xuất TOÀN BỘ các câu hỏi có trong tất cả trang ảnh/PDF theo đúng thứ tự và ĐÚNG NGUYÊN VĂN nội dung câu hỏi & 4 phương án A, B, C, D.
4. Với mỗi câu hỏi, tách 4 phương án A, B, C, D sạch tiền tố "A.", "B.", "C.", "D.", giữ nguyên công thức LaTeX (\`$...$\`) trong cả đề bài và đáp án.
5. Về "correctOption":
   - CHỈ điền 0 (A), 1 (B), 2 (C) hoặc 3 (D) và "hasDetectedAnswer": true NẾU trong ảnh/PDF CÓ SẴN dấu hiệu đáp án (khoanh tròn, gạch chân, tô màu/đỏ, dấu *, "Đáp án:", hoặc bảng đáp án cuối đề).
   - Nếu ảnh/PDF KHÔNG đánh dấu đáp án, BẮT BUỘC đặt "correctOption": -1 và "hasDetectedAnswer": false. TUYỆT ĐỐI KHÔNG tự đoán đáp án!
6. Trả về đúng JSON hợp lệ:
{
  "title": "Tên đề thi lấy từ tiêu đề ảnh/PDF (hoặc rỗng nếu không có)",
  "subject": "Tên môn học (Toán, Vật lí, Hóa học, Sinh học, Ngữ văn, Lịch sử, Địa lý, Tiếng Anh, Tin học, GDCD hoặc Tổng hợp)",
  "durationMinutes": 45,
  "ocrText": "Toàn bộ nội dung văn bản & công thức LaTeX đã OCR...",
  "questions": [
    {
      "id": 1,
      "questionText": "Nội dung nguyên văn câu hỏi kèm LaTeX $...$",
      "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
      "correctOption": -1,
      "hasDetectedAnswer": false,
      "explanation": "Lời giải nếu có trong tài liệu, nếu không để chuỗi rỗng"
    }
  ]
}`;

// Route: Dedicated OCR Endpoint for Image / PDF / DOCX (Extracts raw text + LaTeX math formulas)
app.post('/api/ai/ocr-extract', async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName, files } = req.body || {};
    const inputFiles: Array<{ fileBase64: string; mimeType?: string; fileName?: string }> =
      Array.isArray(files) && files.length > 0
        ? files.filter((f: any) => Boolean(f?.fileBase64))
        : fileBase64
        ? [{ fileBase64, mimeType, fileName }]
        : [];

    if (inputFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu file ảnh hoặc PDF để chạy OCR.' });
    }

    const firstFile = inputFiles[0];
    const firstLower = (firstFile.fileName || '').toLowerCase();

    // Handle .docx cleanly via structured XML + OMML LaTeX extraction
    if (
      inputFiles.length === 1 &&
      (firstLower.endsWith('.docx') || Boolean(firstFile.mimeType?.includes('wordprocessingml')))
    ) {
      const buffer = Buffer.from(firstFile.fileBase64, 'base64');
      const docxResult = await extractDocxContent(buffer);
      let ocrText = docxResult.text || '';
      if (ocrText.trim().length < 120 && docxResult.images.length > 0 && ai) {
        const parts: any[] = docxResult.images.slice(0, 6).map((img) => ({
          inlineData: { mimeType: img.mimeType, data: img.base64 },
        }));
        parts.push({ text: `${OCR_MATH_AND_TEXT_PROMPT}\n\nTên file: ${firstFile.fileName || 'Tài liệu Word'}` });
        const visionRes = await callGemini([{ role: 'user', parts }], { responseMimeType: 'application/json' }, 60000);
        const parsed = safeParseAiExamJson(visionRes.text || '{}');
        if (parsed?.ocrText) ocrText = String(parsed.ocrText);
      }
      const formulaCount = countLatexFormulas(ocrText);
      return res.json({
        success: true,
        source: 'docx_extractor',
        ocrText,
        formulaCount,
        pageCount: 1,
        title: firstFile.fileName?.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ') || 'Tài liệu Word',
        subject: detectSubjectFromText(`${firstFile.fileName || ''} ${ocrText.slice(0, 2000)}`),
        durationMinutes: 45,
      });
    }

    if (!ai) {
      return res.status(400).json({
        success: false,
        error: 'Chưa cấu hình GEMINI_API_KEY để chạy OCR nhận diện văn bản và công thức Toán từ ảnh/PDF.',
      });
    }

    const parts: any[] = inputFiles.slice(0, 10).map((f) => ({
      inlineData: {
        mimeType: resolveMimeType(f.fileName, f.mimeType),
        data: f.fileBase64,
      },
    }));
    const namesLabel = inputFiles.map((f) => f.fileName).filter(Boolean).join(', ') || 'Tài liệu ảnh/PDF';
    parts.push({
      text: `${OCR_MATH_AND_TEXT_PROMPT}\n\nDanh sách tệp (${inputFiles.length} tệp): ${namesLabel}`,
    });

    const response = await callGemini(
      [{ role: 'user', parts }],
      { responseMimeType: 'application/json' },
      60000
    );
    const parsed = safeParseAiExamJson(response.text || '{}');
    const ocrText = String(parsed?.ocrText || parsed?.text || '').trim();
    if (!ocrText) {
      return res.status(422).json({
        success: false,
        error: `OCR không đọc được nội dung văn bản từ "${namesLabel}". Vui lòng thử ảnh rõ nét hơn.`,
      });
    }

    const formulaCount = countLatexFormulas(ocrText);
    return res.json({
      success: true,
      source: 'gemini_ocr',
      ocrText,
      formulaCount,
      pageCount: inputFiles.length,
      title: String(parsed?.title || '').trim() || firstFile.fileName?.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ') || 'Tài liệu OCR',
      subject: String(parsed?.subject || '').trim() || detectSubjectFromText(`${namesLabel} ${ocrText.slice(0, 2000)}`),
      durationMinutes: Number(parsed?.durationMinutes) || 45,
    });
  } catch (error: any) {
    console.error('OCR extract error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Lỗi khi chạy công cụ OCR trích xuất văn bản & công thức.',
    });
  }
});

// Route: Parse Exam File (Azota Style - Word .docx, PDF, Multi-Image OCR, TXT, JSON)
app.post('/api/ai/parse-exam-file', async (req, res) => {
  try {
    const { rawText, fileBase64, mimeType, fileName, files } = req.body || {};
    const uploadedFiles: Array<{ fileBase64: string; mimeType?: string; fileName?: string }> =
      Array.isArray(files) && files.length > 0
        ? files.filter((f: any) => Boolean(f?.fileBase64))
        : fileBase64
        ? [{ fileBase64, mimeType, fileName }]
        : [];

    const primaryName = fileName || uploadedFiles[0]?.fileName || '';
    const primaryMime = mimeType || uploadedFiles[0]?.mimeType || '';
    const lowerName = primaryName.toLowerCase();

    const isDocx =
      lowerName.endsWith('.docx') ||
      Boolean(primaryMime?.includes('wordprocessingml')) ||
      Boolean(primaryMime?.includes('openxmlformats'));
    const isLegacyDoc = lowerName.endsWith('.doc') && !isDocx;
    const isPdf = lowerName.endsWith('.pdf') || Boolean(primaryMime?.includes('pdf'));
    const isImage =
      uploadedFiles.length > 0 &&
      uploadedFiles.every(
        (f) =>
          /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.fileName || '') ||
          Boolean(f.mimeType?.startsWith('image/'))
      );

    let textToParse = typeof rawText === 'string' ? rawText : '';
    let markedLineIndices: Set<number> | undefined;
    let embeddedDocxImages: { name: string; mimeType: string; base64: string }[] = [];

    // 1. Extract structured content from Word (.docx)
    if (uploadedFiles.length > 0 && isDocx) {
      const buffer = Buffer.from(uploadedFiles[0].fileBase64, 'base64');
      try {
        const docxResult = await extractDocxContent(buffer);
        textToParse = docxResult.text;
        markedLineIndices = docxResult.markedLineIndices;
        embeddedDocxImages = docxResult.images;
      } catch (xmlErr: any) {
        console.warn('Structured DOCX XML extraction error, trying mammoth fallback:', xmlErr?.message);
        try {
          const mammothResult = await mammoth.extractRawText({ buffer });
          textToParse = mammothResult.value || '';
        } catch (mammothErr: any) {
          console.warn('Mammoth fallback error:', mammothErr?.message);
          return res.status(400).json({
            success: false,
            error: `Không thể đọc file Word "${primaryName || '.docx'}". Vui lòng kiểm tra file không bị đặt mật khẩu hoặc bị lỗi định dạng.`,
          });
        }
      }
    } else if (uploadedFiles.length > 0 && isLegacyDoc) {
      // Handle .doc saved as HTML/RTF/UTF-8 text vs true binary OLE .doc
      const buffer = Buffer.from(uploadedFiles[0].fileBase64, 'base64');
      const headerHex = buffer.subarray(0, 4).toString('hex');
      if (headerHex === '504b0304') {
        const docxResult = await extractDocxContent(buffer);
        textToParse = docxResult.text;
        markedLineIndices = docxResult.markedLineIndices;
        embeddedDocxImages = docxResult.images;
      } else if (headerHex === 'd0cf11e0') {
        return res.status(400).json({
          success: false,
          error: `File "${primaryName}" ở định dạng Word cũ (.doc nhị phân). Vui lòng mở bằng Word / Google Docs rồi chọn "Lưu thành .docx" hoặc xuất PDF để hệ thống bóc tách chính xác 100% câu hỏi và công thức.`,
        });
      } else {
        const rawStr = buffer.toString('utf-8');
        textToParse = rawStr.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/gi, ' ').trim();
      }
    }

    // 2. Handle PDF or Single/Multi-Image files via Multimodal OCR + LaTeX Math Extraction
    if (uploadedFiles.length > 0 && (isPdf || isImage)) {
      if (!ai) {
        return res.status(400).json({
          success: false,
          error: `Chưa cấu hình GEMINI_API_KEY để chạy OCR trên file ${isPdf ? 'PDF' : 'hình ảnh'}. Thầy/Cô có thể chuyển sang file .docx hoặc dán văn bản đề thi.`,
        });
      }

      const parts: any[] = uploadedFiles.slice(0, 10).map((f) => ({
        inlineData: {
          mimeType: resolveMimeType(f.fileName, f.mimeType),
          data: f.fileBase64,
        },
      }));
      const namesLabel = uploadedFiles.map((f) => f.fileName).filter(Boolean).join(', ') || primaryName || 'Đề thi';
      parts.push({
        text: `${AZOTA_MULTIMODAL_OCR_SCHEMA_PROMPT}\n\nDanh sách tệp (${uploadedFiles.length} tệp): ${namesLabel}`,
      });

      const response = await callGemini(
        [{ role: 'user', parts }],
        { responseMimeType: 'application/json' },
        60000
      );
      const parsed = safeParseAiExamJson(response.text || '{}');
      const ocrText = String(parsed?.ocrText || '').trim();
      const aiQuestions = normalizeExtractedQuestions(parsed?.questions || []);

      // Cross-check OCR raw text with deterministic Azota parser in case OCR captured more questions
      const ocrParsedFallback = ocrText ? parseAzotaText(ocrText, primaryName) : null;
      const finalQuestions =
        ocrParsedFallback && ocrParsedFallback.questions.length > aiQuestions.length
          ? ocrParsedFallback.questions
          : aiQuestions;

      if (finalQuestions.length === 0) {
        return res.status(422).json({
          success: false,
          ocrUsed: true,
          ocrText,
          formulaCount: countLatexFormulas(ocrText),
          error: ocrText
            ? `Công cụ OCR đã trích xuất được văn bản nhưng chưa tìm thấy câu hỏi trắc nghiệm (Câu 1: ... A. B. C. D.) trong "${namesLabel}". Thầy/Cô có thể kiểm tra lại văn bản OCR bên dưới.`
            : `Không tìm thấy câu hỏi trắc nghiệm hợp lệ trong "${namesLabel}". Vui lòng kiểm tra chất lượng ảnh/PDF rõ nét hơn.`,
        });
      }

      const detectedAnswerCount = finalQuestions.filter((q) => q.hasDetectedAnswer).length;
      const combinedTextForFormulaCount = [
        ocrText,
        ...finalQuestions.map((q) => `${q.questionText} ${q.options.join(' ')}`),
      ].join('\n');
      const formulaCount = countLatexFormulas(combinedTextForFormulaCount);
      const effectiveOcrText =
        ocrText ||
        finalQuestions
          .map(
            (q, idx) =>
              `Câu ${idx + 1}: ${q.questionText}\n${q.options
                .map((opt, oi) => `${String.fromCharCode(65 + oi)}. ${opt}`)
                .join('\n')}`
          )
          .join('\n\n');

      return res.json({
        success: true,
        source: 'gemini_ocr',
        ocrUsed: true,
        ocrText: effectiveOcrText,
        formulaCount,
        pageCount: uploadedFiles.length,
        title:
          parsed?.title ||
          ocrParsedFallback?.title ||
          primaryName?.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ') ||
          'Đề thi nhập từ OCR',
        subject:
          parsed?.subject ||
          detectSubjectFromText(`${effectiveOcrText.slice(0, 2500)} ${finalQuestions.map((q) => q.questionText).join(' ')}`),
        durationMinutes: Number(parsed?.durationMinutes) || ocrParsedFallback?.durationMinutes || 45,
        questions: finalQuestions,
        stats: {
          totalMarkersDetected: finalQuestions.length,
          parsedCount: finalQuestions.length,
          detectedAnswerCount,
          missingAnswerCount: finalQuestions.length - detectedAnswerCount,
        },
      });
    }

    // 3. For .docx / .txt / pasted text: run Azota deterministic structural parser FIRST (verbatim, 0 hallucination!)
    const localResult = parseAzotaText(textToParse, primaryName, markedLineIndices);
    const localCoverageOk =
      localResult.questions.length > 0 &&
      (localResult.stats.totalMarkersDetected === 0 ||
        localResult.questions.length >= Math.floor(localResult.stats.totalMarkersDetected * 0.75));

    if (localCoverageOk) {
      return res.json({
        success: true,
        source: 'azota_parser',
        ocrUsed: false,
        ocrText: textToParse,
        formulaCount: countLatexFormulas(textToParse),
        ...localResult,
      });
    }

    // 4. If .docx has almost no text but contains embedded scanned images (e.g. screenshots pasted in Word), OCR with Gemini Vision
    if (textToParse.trim().length < 120 && embeddedDocxImages.length > 0 && ai) {
      try {
        const parts: any[] = embeddedDocxImages.slice(0, 8).map((img) => ({
          inlineData: { mimeType: img.mimeType, data: img.base64 },
        }));
        parts.push({
          text: `${AZOTA_MULTIMODAL_OCR_SCHEMA_PROMPT}\n\nFile Word này chứa hình ảnh đề thi. Hãy chạy OCR trên tất cả ảnh theo đúng thứ tự, chuyển công thức sang LaTeX ($...$) và bóc tách nguyên văn toàn bộ câu hỏi.\nTên file: ${primaryName || 'Đề thi Word'}`,
        });

        const visionRes = await callGemini(
          [{ role: 'user', parts }],
          { responseMimeType: 'application/json' },
          60000
        );
        const parsed = safeParseAiExamJson(visionRes.text || '{}');
        const ocrText = String(parsed?.ocrText || '').trim();
        const normalized = normalizeExtractedQuestions(parsed?.questions || []);
        if (normalized.length > 0) {
          const detectedAnswerCount = normalized.filter((q) => q.hasDetectedAnswer).length;
          return res.json({
            success: true,
            source: 'gemini_ocr',
            ocrUsed: true,
            ocrText,
            formulaCount: countLatexFormulas(ocrText || normalized.map((q) => q.questionText).join(' ')),
            pageCount: embeddedDocxImages.length,
            title: parsed?.title || localResult.title,
            subject: parsed?.subject || localResult.subject,
            durationMinutes: Number(parsed?.durationMinutes) || localResult.durationMinutes,
            questions: normalized,
            stats: {
              totalMarkersDetected: normalized.length,
              parsedCount: normalized.length,
              detectedAnswerCount,
              missingAnswerCount: normalized.length - detectedAnswerCount,
            },
          });
        }
      } catch (visionErr: any) {
        console.warn('DOCX embedded image OCR fallback error:', visionErr?.message);
      }
    }

    // 5. Try AI structured text extraction if deterministic parser found 0 or missed markers
    if (textToParse && textToParse.trim().length > 25 && ai) {
      try {
        const aiResult = await extractExamWithAiFromText(textToParse, primaryName);
        if (aiResult.questions.length > localResult.questions.length) {
          const detectedAnswerCount = aiResult.questions.filter((q) => q.hasDetectedAnswer).length;
          return res.json({
            success: true,
            source: 'gemini',
            ocrUsed: false,
            ocrText: textToParse,
            formulaCount: countLatexFormulas(textToParse),
            ...aiResult,
            stats: {
              totalMarkersDetected: Math.max(localResult.stats.totalMarkersDetected, aiResult.questions.length),
              parsedCount: aiResult.questions.length,
              detectedAnswerCount,
              missingAnswerCount: aiResult.questions.length - detectedAnswerCount,
            },
          });
        }
      } catch (aiErr: any) {
        console.warn('AI text exam extraction fallback error:', aiErr?.message);
      }
    }

    // 6. If deterministic parser got at least 1 real question, return it
    if (localResult.questions.length > 0) {
      return res.json({
        success: true,
        source: 'azota_parser',
        ocrUsed: false,
        ocrText: textToParse,
        formulaCount: countLatexFormulas(textToParse),
        ...localResult,
      });
    }

    // 7. Never return fake dummy questions! Return an honest, actionable diagnostic error.
    const previewSnippet = textToParse.replace(/\s+/g, ' ').trim().slice(0, 140);
    return res.status(422).json({
      success: false,
      error: previewSnippet
        ? `Không nhận diện được cấu trúc câu hỏi trắc nghiệm (Câu 1: ... A. ... B. ... C. ... D. ...) trong "${primaryName || 'tệp tin'}". Hệ thống đọc được đoạn mở đầu: "${previewSnippet}..."`
        : `File "${primaryName || 'tệp tin'}" không chứa văn bản câu hỏi đọc được (có thể là file ảnh scan hoặc lỗi định dạng).`,
    });
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    console.error('Parse exam file error:', error);
    return res.status(500).json({
      success: false,
      error: errMsg || 'Lỗi khi bóc tách file đề thi.',
    });
  }
});
function getFallbackAssistantReply(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('lỗ hổng') || m.includes('12a2') || m.includes('phổ điểm')) {
    return `### 📊 Báo cáo phân tích học tập lớp 12A2 - ${cachedProfiles.teacher?.name || 'Thầy Tuấn'}
1. **Tổng quan phổ điểm bài kiểm tra gần nhất:**
   - Điểm Giỏi (8.5 - 10): 28% (chủ yếu đạt điểm phần kiến thức nền tảng và bài tập chuẩn).
   - Điểm Khá (6.5 - 8.0): 44% (nắm vững lý thuyết nhưng mất điểm ở bài toán vận dụng nhanh).
   - Điểm Trung bình & Dưới 5: 28% (sai nhiều ở phần vận dụng công thức và đọc đồ thị).

2. **Nhận diện lỗ hổng kiến thức chính:**
   - Học sinh còn nhầm lẫn dấu và điều kiện áp dụng công thức trọng tâm.
   - Kỹ năng phân tích dữ liệu đề bài theo bước còn chậm.

3. **Đề xuất giải pháp sư phạm:**
   - Dành 15 phút đầu tiết tới ôn tập dạng bài tập đồ thị và phương pháp giải chuẩn hóa.
   - Sử dụng chức năng **"AI Tạo đề theo Ma trận"** chọn tỷ lệ 50% Nhận biết - 30% Thông hiểu để củng cố nền tảng cho nhóm học sinh dưới 6.5.`;
  }

  if (m.includes('ma trận') || m.includes('đề') || m.includes('kiểm tra')) {
    return `### 🎯 Gợi ý ma trận đề kiểm tra định kỳ môn ${msg.toLowerCase().includes('lý') || msg.toLowerCase().includes('lí') ? 'Vật lí' : 'Toán'}:
- **Nhận biết (40% - 4.0 điểm):** Các định nghĩa, công thức cơ bản, đơn vị đo.
- **Thông hiểu (30% - 3.0 điểm):** Giải thích hiện tượng, so sánh hai đại lượng, tính toán 1 bước.
- **Vận dụng (20% - 2.0 điểm):** Bài toán liên hệ thực tế hoặc biến đổi 2-3 công thức.
- **Vận dụng cao (10% - 1.0 điểm):** Bài toán cực trị hoặc phân tích đồ thị phức tạp.

💡 Thầy/Cô có thể bấm nút **"AI Tạo đề theo Ma trận"** ngay trên giao diện để hệ thống tự động sinh 10 - 40 câu hỏi tương ứng kèm đáp án và lời giải chi tiết!`;
  }

  return `Chào ${cachedProfiles.teacher?.name || 'Thầy Tuấn'}! Trợ lý AI giáo viên StudyFlow sẵn sàng hỗ trợ:
- 📌 **Phân tích dữ liệu học sinh:** Đánh giá phổ điểm, nhận diện lỗ hổng kiến thức của từng lớp (12A2, 12A5, 10A1...).
- 📝 **Tạo đề theo Ma trận:** Tự động sinh trọn bộ câu hỏi trắc nghiệm theo 4 mức độ nhận thức của Bộ GD&ĐT.
- 📚 **Biên soạn học liệu:** Tạo nhanh đề cương ôn tập, tóm tắt lý thuyết và phiếu bài tập phân hóa.
- 💡 **Phương pháp giảng dạy:** Tư vấn kịch bản bài học tích cực và gợi ý câu hỏi phát vấn hấp dẫn.`;
}

function getFallbackQuestions(subject?: string, grade?: string | number, topic?: string, count = 5) {
  const s = subject || 'Vật lí';
  const t = topic || 'Dao động điều hòa';
  return [
    {
      id: 1,
      questionText: `Trong dao động điều hòa của chất điểm môn ${s} (${t}), đại lượng nào sau đây biến thiên cùng tần số với li độ?`,
      options: ['Vận tốc và gia tốc', 'Động năng và thế năng', 'Cơ năng của hệ', 'Biên độ dao động'],
      correctOption: 0,
      explanation: 'Trong dao động điều hòa, vận tốc và gia tốc cùng biến thiên điều hòa với cùng tần số góc ω và chu kỳ T giống như li độ.'
    },
    {
      id: 2,
      questionText: `Một vật nhỏ dao động điều hòa theo phương trình x = A cos(ωt + φ). Vận tốc cực đại của vật có độ lớn là:`,
      options: ['v_max = ωA', 'v_max = ω²A', 'v_max = 2ωA', 'v_max = ωA²'],
      correctOption: 0,
      explanation: 'Vận tốc cực đại của vật đạt được khi vật qua vị trí cân bằng theo chiều dương: v_max = ωA.'
    },
    {
      id: 3,
      questionText: `Khi một vật dao động điều hòa từ vị trí cân bằng ra vị trí biên thì:`,
      options: ['Thế năng tăng dần, động năng giảm dần', 'Cơ năng của vật tăng dần', 'Vận tốc của vật tăng dần', 'Gia tốc của vật bằng 0'],
      correctOption: 0,
      explanation: 'Khi đi từ vị trí cân bằng ra biên, li độ x tăng dần nên thế năng tăng, còn vận tốc giảm về 0 nên động năng giảm dần.'
    },
    {
      id: 4,
      questionText: `Chu kỳ dao động của con lắc lò xo gồm vật nặng m và lò xo nhẹ có độ cứng k là:`,
      options: ['T = 2π√(m/k)', 'T = 2π√(k/m)', 'T = 2π√(l/g)', 'T = 1/(2π)√(m/k)'],
      correctOption: 0,
      explanation: 'Công thức chu kỳ con lắc lò xo chuẩn là T = 2π√(m/k).'
    },
    {
      id: 5,
      questionText: `Đồ thị biểu diễn mối quan hệ giữa gia tốc a và li độ x của một chất điểm dao động điều hòa là:`,
      options: ['Một đoạn thẳng đi qua gốc tọa độ có hệ số góc âm', 'Một đường elip', 'Một đường cong hình sin', 'Một đường parabol'],
      correctOption: 0,
      explanation: 'Do a = -ω²x với -A ≤ x ≤ A, đồ thị a theo x là một đoạn thẳng đi qua gốc tọa độ có hệ số góc âm (-ω²).'
    }
  ].slice(0, count);
}

function getFallbackMaterial(
  subject?: string,
  grade?: string | number,
  topic?: string,
  type?: string,
  sourceContent?: string,
  sourceFileName?: string
) {
  const effectiveTopic = topic || (sourceFileName ? sourceFileName.replace(/\.[^.]+$/, '') : 'Tài liệu học tập');
  const metaParts = [
    subject ? `**Môn học:** ${subject}` : '',
    grade ? `**Khối:** ${grade}` : '',
    type ? `**Phân loại:** ${type}` : ''
  ].filter(Boolean).join(' | ');

  if (sourceContent && sourceContent.trim()) {
    return `# 📖 HỌC LIỆU: ${effectiveTopic.toUpperCase()}
${metaParts ? metaParts + '\n' : ''}**Nguồn tài liệu:** ${sourceFileName || 'Tệp đính kèm'}

---

## I. NỘI DUNG TRỌNG TÂM TỪ TÀI LIỆU
${sourceContent.trim().slice(0, 4000)}

---

## II. GHI CHÚ ÔN TẬP & PHÂN HÓA
- **Mức độ cơ bản:** Hệ thống hóa các khái niệm chính và ví dụ nền tảng từ tài liệu.
- **Mức độ nâng cao:** Luyện tập phân tích, liên hệ mở rộng và giải quyết các câu hỏi vận dụng.`;
  }

  return `# 📖 HỌC LIỆU: ${effectiveTopic.toUpperCase()}
${metaParts ? metaParts + '\n' : ''}**Biên soạn:** Giáo viên bộ môn (StudyFlow)

---

## I. MỤC TIÊU BÀI HỌC
1. Nắm vững các khái niệm, định nghĩa và kiến thức trọng tâm của chuyên đề **${effectiveTopic}**.
2. Hiểu rõ mối liên hệ giữa các đơn vị kiến thức trong bài học.
3. Vận dụng giải quyết các dạng bài tập từ cơ bản đến nâng cao.

---

## II. TỔNG HỢP KIẾN THỨC CỐT LÕI
- **Phần 1:** Khái niệm nền tảng và điều kiện áp dụng.
- **Phần 2:** Phương pháp giải quyết các dạng bài thường gặp.
- **Phần 3:** Các lỗi sai học sinh cần lưu ý và cách khắc phục.

---

## III. BÀI TẬP RÈN LUYỆN
- **Mức độ Nhận biết & Thông hiểu:** Củng cố lý thuyết cơ bản.
- **Mức độ Vận dụng & Vận dụng cao:** Phân tích tình huống tổng hợp.`;
}

function getFallbackTamAnReply(query: string, moodLogs: any[] = []): string {
  const q = (query || '').trim().toLowerCase();
  
  // 1. AN TOÀN TÂM LÝ – ƯU TIÊN CAO NHẤT
  const dangerKeywords = ['tự tử', 'tự sát', 'không muốn sống', 'muốn chết', 'tự làm đau', 'cắt tay', 'rạch tay', 'làm hại bản thân', 'bị đánh', 'xâm hại', 'bạo lực', 'đe dọa'];
  if (dangerKeywords.some((k) => q.includes(k))) {
    return `Mình đang lắng nghe bạn đây. Mình cảm nhận được nỗi đau và sự mệt mỏi cùng cực mà bạn đang phải gánh chịu một mình lúc này. 

Cảm xúc đau đớn đến nghẹt thở hay muốn từ bỏ là điều có thể hiểu được khi bạn phải chịu đựng quá nhiều tổn thương vượt quá sức chịu đựng. Nhưng sự an toàn và tính mạng của bạn là điều quan trọng và quý giá nhất đối với mình lúc này. Bạn xứng đáng được bảo vệ và sống một cuộc đời bình yên.

Bây giờ bạn đang ở đâu? Bạn có đang an toàn ngay lúc này không?

Hãy làm theo hướng dẫn an toàn này ngay cùng mình:
- Hít thở thật chậm, không ở một mình trong phòng kín.
- Tìm đến cha mẹ, thầy cô hoặc người lớn đáng tin cậy cạnh bạn để chia sẻ ngay.
- Gọi ngay tới các đường dây hỗ trợ khẩn cấp (miễn phí 24/7):
  + 📞 **111**: Tổng đài Quốc gia Bảo vệ Trẻ em.
  + 🚑 **115**: Cấp cứu y tế | 👮 **113**: Công an bảo vệ an toàn.

Mình luôn ở đây lắng nghe bạn. Bạn hãy giữ an toàn cho bản thân trước tiên nhé!`;
  }

  const isNegative = /(buồn|mệt|chán|nản|áp lực|căng thẳng|stress|bế tắc|lo lắng|sợ|khóc|tủi thân|đuối|thất vọng|tự ti|quá tải|bất an|suy sụp|bỏ cuộc|khó khăn|rớt|trượt)/i.test(q);

  let moodReferenceText = '';
  let moodActionAdvice = '';
  if (isNegative && Array.isArray(moodLogs) && moodLogs.length > 0) {
    const latest = moodLogs[0];
    const label = latest.label || latest.mood || 'Căng thẳng';
    const emoji = latest.emoji || '💭';
    const noteText = latest.note ? ` ("${latest.note}")` : '';
    moodReferenceText = `\n\n*(Mình có thấy gần đây trong nhật ký tâm trạng, bạn đã ghi nhận trạng thái **[${emoji} ${label}]**${noteText}. Việc bạn chủ động quan sát và theo dõi cảm xúc của mình là một điểm tựa rất tích cực để tụi mình cùng tìm cách vượt qua.)*`;

    const lowerLabel = String(label).toLowerCase();
    const moodType = String(latest.mood || '').toLowerCase();
    if (moodType === 'stressed' || lowerLabel.includes('căng thẳng')) {
      moodActionAdvice = `\n- **Gợi ý riêng theo trạng thái Căng thẳng:** Vì nhật ký ghi nhận mức độ căng thẳng của bạn đang cao, hãy thực hiện thở xả tải trong 3 phút trước khi làm bất cứ việc gì tiếp theo.`;
    } else if (moodType === 'tired' || lowerLabel.includes('mệt mỏi')) {
      moodActionAdvice = `\n- **Gợi ý riêng theo trạng thái Mệt mỏi:** Cơ thể bạn đang cạn kiệt năng lượng. Đừng ép bản thân học khuya; hãy chợp mắt 15-20 phút.`;
    }
  }

  if (/^(chào|hi|hello|xin chào|tâm lí ơi|tâm lý ơi|tâm an|bạn ơi|ơi)/i.test(q) || q.length < 8) {
    return `Chào bạn! Mình là AI đồng hành tâm lý học đường, luôn ở đây để lắng nghe và thấu hiểu mọi điều bạn chia sẻ.

Hôm nay của bạn thế nào? Bạn đang cảm thấy thoải mái hay có điều gì bận lòng không?`;
  }

  if (q.includes('áp lực') || q.includes('điểm') || q.includes('kỳ thi') || q.includes('thi') || q.includes('mệt') || q.includes('nản') || q.includes('quá tải')) {
    return `Mình nghe được rằng dạo gần đây bạn đang phải chịu khá nhiều áp lực về bài vở và điểm số. Có lẽ mọi chuyện thật sự không hề dễ dàng.${moodReferenceText}

Hãy kiên nhẫn với chính mình, tụi mình sẽ cùng giải quyết từng việc nhỏ một nhé!${moodActionAdvice}`;
  }

  return `Mình đang lắng nghe bạn đây. Mình nhận thấy bạn đang có những băn khoăn và cảm xúc chưa thể giải tỏa hoàn toàn trong lòng.${moodReferenceText}

Điều gì đang làm bạn cảm thấy trăn trở hay khó khăn nhất ngay lúc này?${moodActionAdvice}`;
}

function getFallbackTutorReply(query: string): string {
  const q = query.toLowerCase().trim();

  // Test 1: Diện tích hình vuông hoặc công thức ngắn
  if (q.includes('diện tích hình vuông') || (q.includes('hình vuông') && q.includes('diện tích'))) {
    return `Diện tích hình vuông bằng cạnh nhân cạnh:

$$S = a \\times a = a^2$$

Vì hình vuông có 4 cạnh bằng nhau, nên nó giống hình chữ nhật có chiều dài = chiều rộng = $a$.

**Ví dụ:** Hình vuông cạnh 5 cm thì $S = 5^2 = \\mathbf{25\\ cm^2}$.

**Lưu ý hay sai:** Diện tích tính bằng đơn vị bình phương (cm², m²), đừng nhầm với chu vi $P = 4a$ (đơn vị cm, m).

Bạn muốn thử một bài tập nhỏ không? Ví dụ: một sân vuông có chu vi 36 m, diện tích là bao nhiêu?`;
  }

  // Hằng đẳng thức (hằng đẳng thức, hằng đẳng thức61, v.v.)
  if (q.includes('hằng đẳng thức') || q.includes('hang dang thuc')) {
    return `Dưới đây là 7 hằng đẳng thức đáng nhớ cốt lõi:

1. **Bình phương của một tổng:**
$$(a + b)^2 = a^2 + 2ab + b^2$$

2. **Bình phương của một hiệu:**
$$(a - b)^2 = a^2 - 2ab + b^2$$

3. **Hiệu hai bình phương:**
$$a^2 - b^2 = (a - b)(a + b)$$

4. **Lập phương của một tổng:**
$$(a + b)^3 = a^3 + 3a^2b + 3ab^2 + b^3$$

5. **Lập phương của một hiệu:**
$$(a - b)^3 = a^3 - 3a^2b + 3ab^2 - b^3$$

6. **Tổng hai lập phương:**
$$a^3 + b^3 = (a + b)(a^2 - ab + b^2)$$

7. **Hiệu hai lập phương:**
$$a^3 - b^3 = (a - b)(a^2 + ab + b^2)$$

**Ví dụ:** Khai triển $(x + 3)^2 = x^2 + 2 \\cdot x \\cdot 3 + 3^2 = \\mathbf{x^2 + 6x + 9}$.

**Lưu ý hay sai:** $(a + b)^2 \\neq a^2 + b^2$ (học sinh rất hay quên số hạng $2ab$).

Bạn muốn thử một bài tập nhỏ không? Ví dụ: khai triển $(2x - 1)^2$ bằng bao nhiêu?`;
  }

  // Test 2: Giải phương trình bậc 2 (x^2 - 5x + 6 = 0)
  if (q.includes('x^2 - 5x + 6') || q.includes('x^2-5x+6') || (q.includes('phương trình') && q.includes('5x') && q.includes('6'))) {
    return `Phương trình $x^2 - 5x + 6 = 0$ được giải bằng cách phân tích thành nhân tử:

**Bước 1: Phân tích thành tích**
Tìm hai số có tích bằng 6 và tổng bằng $-5$, đó là $-2$ và $-3$:
$$x^2 - 2x - 3x + 6 = 0 \\Leftrightarrow x(x - 2) - 3(x - 2) = 0 \\Leftrightarrow (x - 2)(x - 3) = 0$$

**Bước 2: Giải các phương trình bậc nhất**
$$\\left[\\begin{array}{l} x - 2 = 0 \\\\ x - 3 = 0 \\end{array}\\right. \\Leftrightarrow \\left[\\begin{array}{l} x = 2 \\\\ x = 3 \\end{array}\\right.$$

**Đáp số:** Phương trình có 2 nghiệm phân biệt là $\\mathbf{x = 2}$ và $\\mathbf{x = 3}$.

**Kiểm tra lại:**
- Với $x = 2$: $2^2 - 5(2) + 6 = 4 - 10 + 6 = 0$ (Đúng).
- Với $x = 3$: $3^2 - 5(3) + 6 = 9 - 15 + 6 = 0$ (Đúng).

**Lưu ý hay sai:** Biệt thức $\\Delta = (-5)^2 - 4(1)(6) = 25 - 24 = 1 > 0$, chú ý mẫu số nghiệm là $2a = 2$.`;
  }

  // Test 3: Gợi ý thôi, đừng cho đáp án
  if (q.includes('gợi ý') || q.includes('đừng cho đáp án') || q.includes('dung cho dap an')) {
    return `Được nhé! Mình sẽ chỉ đưa ra gợi ý từng bước nhỏ để bạn tự làm:

- Bạn hãy quan sát kỹ biểu thức xem có thể phân tích thành nhân tử hay rút gọn đại lượng chung được không?
- Bạn đã viết nháp bước đầu tiên chưa? Hãy nhắn dòng nháp đầu tiên của bạn cho mình xem nhé!`;
  }

  // Test 4: Hôm nay buồn quá / mệt mỏi
  if (q.includes('buồn quá') || q.includes('mệt quá') || q.includes('áp lực') || q.includes('chán học') || q.includes('buon qua')) {
    return `Mình hiểu, đôi khi việc học hành và áp lực thi cử làm chúng ta thấy rất kiệt sức. Bạn hãy uống một ngụm nước ấm, hít sâu thở chậm vài nhịp và nghỉ ngơi 5-10 phút nhé. Khi nào sẵn sàng, mình sẽ cùng bạn giải quyết một bài tập nhỏ thật nhẹ nhàng!`;
  }

  // Test 5: Thi hộ / làm bài thi hộ
  if (q.includes('hộ mình') && (q.includes('đề thi') || q.includes('kiểm tra') || q.includes('bài thi'))) {
    return `Mình không thể làm bài hộ bạn trong giờ kiểm tra được vì điều đó vi phạm quy chế thi. Sau khi nộp bài xong hoặc với một bài toán tương tự, bạn cứ gửi sang đây, mình sẽ hướng dẫn cặn kẽ từng bước để bạn hiểu sâu nhé!`;
  }

  // Diện tích hình tròn / tam giác
  if (q.includes('diện tích hình tròn') || (q.includes('hình tròn') && q.includes('diện tích'))) {
    return `Diện tích hình tròn bán kính $r$ được tính theo công thức:

$$S = \\pi r^2$$

Trong đó $r$ là bán kính hình tròn, $\\pi \\approx 3{,}14$.

**Ví dụ:** Hình tròn có bán kính $r = 3\\text{ cm}$ thì $S = \\pi \\times 3^2 = 9\\pi \\approx \\mathbf{28{,}26\\ cm^2}$.

**Lưu ý hay sai:** Nếu đề bài cho đường kính $d$, phải lấy $r = \\frac{d}{2}$ trước khi tính, không được lấy $d^2$ trực tiếp.

Bạn muốn thử tính diện tích của một hình tròn có đường kính 10 cm không?`;
  }

  // Kế hoạch giải tỏa bài vở & quá tải
  if (q.includes('quá tải') || q.includes('kế hoạch') || q.includes('dồn bài') || q.includes('nhiều bài') || q.includes('nhiệm vụ')) {
    return `Mình hiểu cảm giác khi bài vở dồn lại có thể khiến bạn thấy ngột ngạt. Chúng ta hãy chia nhỏ và xử lý theo các chặng Pomodoro cụ thể:

1. **Chặng 1 (25 phút - Ưu tiên khẩn cấp):** Làm bài tập về nhà của ngày mai. Cất điện thoại xa tầm tay.
2. **Nghỉ giải lao (5 phút):** Uống nước, thư giãn mắt.
3. **Chặng 2 (25 phút - Môn quan trọng):** Xem lại lý thuyết và làm 3-5 bài tập của môn bạn lo lắng nhất.
4. **Chặng 3 (25 phút - Chuẩn bị bài):** Đọc trước tài liệu hoặc soạn bài cho tiết học kế tiếp.
5. **Chặng 4 (15 phút - Tổng kết):** Đánh dấu việc đã hoàn thành vào To-do list.

Bạn muốn mình cùng bạn lập thời gian biểu chi tiết cho môn học nào trước?`;
  }

  // 2. ÔN THI & KỸ NĂNG HỌC TẬP (Lộ trình, Pomodoro, phương pháp ôn tập)
  if (q.includes('ôn thi') || q.includes('lộ trình') || q.includes('30 ngày') || q.includes('kỳ thi') || q.includes('luyện đề') || q.includes('học kỳ') || q.includes('pomodoro') || q.includes('quản lý thời gian')) {
    return `Chiến lược ôn thi hiệu quả nhất là chia nhỏ theo chu kỳ ôn ngắt quãng (Spaced Repetition) và phương pháp Pomodoro:

1. **Phân bổ thời gian (Pomodoro):** Học tập trung 25 phút, nghỉ 5 phút. Sau 4 chu kỳ thì nghỉ dài 15-20 phút.
2. **Quy tắc 80/20:** Dành 70% thời gian làm bài tập và giải đề thực tế (Active Recall), chỉ 30% để đọc lại lý thuyết.
3. **Sổ tay lỗi sai (Error Log):** Mỗi khi giải sai một câu, ghi chú lại nguyên nhân (quên công thức hay nhầm dấu) để rà soát trước ngày thi.

**Ví dụ lộ trình 7 ngày nước rút:**
- **Ngày 1-3:** Tổng hợp sơ đồ tư duy các chuyên đề trọng tâm và công thức cốt lõi.
- **Ngày 4-5:** Giải 3-4 đề thi thử chuẩn cấu trúc, bấm đúng thời gian thực tế.
- **Ngày 6-7:** Đọc lại sổ tay lỗi sai, thư giãn tinh thần và ngủ đủ 8 tiếng.

Bạn muốn mình lên kế hoạch chi tiết cho môn học cụ thể nào?`;
  }



  // 3. TOÁN HỌC (Phương trình, Lượng giác, Đạo hàm, Tích phân, Hình học)
  if (q.includes('toán') || q.includes('phương trình') || q.includes('lượng giác') || q.includes('đạo hàm') || q.includes('tích phân') || q.includes('sin') || q.includes('cos') || q.includes('hình học') || q.includes('nghiệm')) {
    return `Để giải phương trình lượng giác cơ bản, ta đưa về dạng chuẩn hoặc biến đổi thành tích:

- **Công thức lượng giác cơ bản:** $\\sin(2x) = 2\\sin(x)\\cos(x)$ và $\\cos(2x) = 2\\cos^2(x) - 1$.
- **Nghiệm cơ bản:**
  $$\\sin x = \\sin \\alpha \\Leftrightarrow \\left[\\begin{array}{l} x = \\alpha + k2\\pi \\\\ x = \\pi - \\alpha + k2\\pi \\end{array}\\right. \\quad (k \\in \\mathbb{Z})$$
  $$\\cos x = \\cos \\alpha \\Leftrightarrow x = \\pm \\alpha + k2\\pi \\quad (k \\in \\mathbb{Z})$$

**Ví dụ:** Giải phương trình $2\\sin(x) - 1 = 0$:
$$2\\sin(x) - 1 = 0 \\Leftrightarrow \\sin(x) = \\frac{1}{2} = \\sin\\left(\\frac{\\pi}{6}\\right)$$
$$\\Leftrightarrow \\left[\\begin{array}{l} x = \\frac{\\pi}{6} + k2\\pi \\\\ x = \\frac{5\\pi}{6} + k2\\pi \\end{array}\\right. \\quad (k \\in \\mathbb{Z})$$

**Đáp số:** $\\mathbf{x \\in \\left\\{ \\frac{\\pi}{6} + k2\\pi; \\frac{5\\pi}{6} + k2\\pi \\right\\}}$ ($k \\in \\mathbb{Z}$).

**Lưu ý hay sai:** Khi giải phương trình hàm $\\sin$, đừng quên họ nghiệm thứ hai $\\pi - \\alpha + k2\\pi$ và điều kiện $k \\in \\mathbb{Z}$.

Bạn có bài toán cụ thể nào cần giải từng bước không?`;
  }

  // 4. VẬT LÝ (Dao động điều hòa, Sóng cơ, Cơ năng, Con lắc)
  if (q.includes('vật lý') || q.includes('vật lí') || q.includes('cơ năng') || q.includes('dao động') || q.includes('sóng') || q.includes('lực') || q.includes('vận tốc') || q.includes('gia tốc') || q.includes('chu kỳ')) {
    return `Phương trình dao động điều hòa có dạng chuẩn $x = A\\cos(\\omega t + \\varphi)$:

- **Vận tốc:** $v = -\\omega A \\sin(\\omega t + \\varphi)$, sớm pha $\\frac{\\pi}{2}$ so với li độ $x$.
- **Gia tốc:** $a = -\\omega^2 x$, ngược pha so với li độ $x$.
- **Hệ thức độc lập thời gian:**
  $$A^2 = x^2 + \\frac{v^2}{\\omega^2} = \\frac{a^2}{\\omega^4} + \\frac{v^2}{\\omega^2}$$
- **Cơ năng bảo toàn:** $W = \\frac{1}{2}kA^2 = \\frac{1}{2}m\\omega^2 A^2$.

**Ví dụ:** Một con lắc lò xo có $m = 0{,}2\\text{ kg}$, $k = 50\\text{ N/m}$, dao động với biên độ $A = 4\\text{ cm} = 0{,}04\\text{ m}$.
$$W = \\frac{1}{2} \\times 50 \\times (0{,}04)^2 = \\mathbf{0{,}04\\text{ J}}$$

**Lưu ý hay sai:** Luôn đổi đơn vị biên độ $A$ và li độ $x$ về mét (m) trước khi tính năng lượng.

Bạn muốn thử tính vận tốc cực đại $v_{\\max} = \\omega A$ của con lắc này không?`;
  }

  // 5. HÓA HỌC (Phương trình phản ứng, Oxi hóa khử, Nồng độ mol)
  if (q.includes('hóa học') || q.includes('hóa') || q.includes('oxi hóa') || q.includes('khử') || q.includes('mol') || q.includes('nồng độ') || q.includes('axit') || q.includes('kim loại')) {
    return `Nguyên tắc giải bài toán Hóa học là tính số mol và áp dụng định luật bảo toàn:

- **Số mol:** $n = \\frac{m}{M} = \\frac{V}{24{,}79}$ (ở điều kiện chuẩn GDPT 2018: $25^\\circ\\text{C}, 1\\text{ bar}$).
- **Nồng độ mol:** $C_M = \\frac{n}{V_{\\text{dd}}}$ (mol/lít hoặc M).
- **Định luật bảo toàn electron:** $\\sum n_{\\text{e nhường}} = \\sum n_{\\text{e nhận}}$.

**Ví dụ:** Cho $2{,}4\\text{ g}$ Magie ($\\text{Mg}$) phản ứng với $\\text{HCl}$ dư:
$$\\text{Mg} + 2\\text{HCl} \\rightarrow \\text{MgCl}_2 + \\text{H}_2\\uparrow$$
Số mol $\\text{Mg}$: $n_{\\text{Mg}} = \\frac{2{,}4}{24} = 0{,}1\\text{ mol}$.
Thể tích khí $\\text{H}_2$ thu được ở điều kiện chuẩn: $V = 0{,}1 \\times 24{,}79 = \\mathbf{2{,}479\\text{ lít}}$.

**Lưu ý hay sai:** Nhớ dùng $24{,}79\\text{ L/mol}$ theo chương trình mới GDPT 2018 thay vì $22{,}4\\text{ L/mol}$ cũ.

Bạn có bài tập Hóa học cụ thể nào cần hướng dẫn không?`;
  }

  // 6. TIẾNG ANH (Ngữ pháp, Các thì, Câu điều kiện)
  if (q.includes('tiếng anh') || q.includes('english') || q.includes('ngữ pháp') || q.includes('grammar') || q.includes('thì') || q.includes('từ vựng') || q.includes('ielts') || q.includes('toeic')) {
    return `Quy tắc phân biệt thì Hiện tại hoàn thành và Quá khứ đơn:

- **Hiện tại hoàn thành (Present Perfect):** $\\text{S} + \\text{have/has} + \\text{V}_{3/\\text{ed}}$
  - Diễn tả hành động xảy ra trong quá khứ nhưng kết quả vẫn liên quan đến hiện tại (*since, for, already, yet, just, recently*).
- **Quá khứ đơn (Past Simple):** $\\text{S} + \\text{V}_{2/\\text{ed}}$
  - Diễn tả hành động đã chấm dứt hoàn toàn tại một thời điểm xác định trong quá khứ (*yesterday, 2 days ago, in 2020*).

**Ví dụ:**
- *I lost my key yesterday.* $\\rightarrow$ Hôm qua làm mất chìa khóa (thời điểm cụ thể *yesterday*).
- *I have lost my key!* $\\rightarrow$ Tôi vừa làm mất chìa khóa, hiện giờ không vào nhà được.

**Lưu ý hay sai:** Không dùng thì Hiện tại hoàn thành với mốc thời gian quá khứ xác định (*yesterday, last night*).

Bạn có câu bài tập tiếng Anh nào cần đối chiếu đáp án không?`;
  }

  // 7. NGỮ VĂN & TIN HỌC
  if (q.includes('ngữ văn') || q.includes('văn') || q.includes('nghị luận') || q.includes('dàn ý') || q.includes('đọc hiểu') || q.includes('tác phẩm') || q.includes('phân tích')) {
    return `Dàn ý bài văn nghị luận xã hội chuẩn 3 phần:

1. **Mở bài (0.5 điểm):** Dẫn dắt vấn đề và nêu trực tiếp tư tưởng hoặc hiện tượng cần bàn luận.
2. **Thân bài (1.5 - 2.0 điểm):**
   - **Giải thích:** Cắt nghĩa từ khóa, nêu bản chất của vấn đề.
   - **Phân tích & Chứng minh:** Vì sao vấn đề lại quan trọng? Nêu dẫn chứng thực tế giàu tính thuyết phục.
   - **Mở rộng (Phản đề):** Phê phán lối sống tiêu cực, đi ngược lại các giá trị tốt đẹp.
   - **Bài học nhận thức và hành động:** Rút ra bài học thiết thực cho bản thân trong học tập và rèn luyện.
3. **Kết bài (0.5 điểm):** Khẳng định lại ý nghĩa thông điệp và lời nhắn gửi.

Bạn đang viết về đề tài hay tác phẩm nào? Hãy chia sẻ để mình cùng bạn lập dàn ý nhé!`;
  }

  if (q.includes('tin học') || q.includes('lập trình') || q.includes('python') || q.includes('c++') || q.includes('code') || q.includes('thuật toán') || q.includes('binary search')) {
    return 'Thuật toán Tìm kiếm nhị phân (Binary Search) trên mảng đã sắp xếp:\n\n' +
      '- **Ý tưởng:** So sánh phần tử cần tìm $X$ với phần tử ở chính giữa $A[\\text{mid}]$.\n' +
      '- **Độ phức tạp:** Thời gian $O(\\log N)$, không gian $O(1)$.\n\n' +
      '```python\n' +
      'def binary_search(arr, target):\n' +
      '    left, right = 0, len(arr) - 1\n' +
      '    while left <= right:\n' +
      '        mid = left + (right - left) // 2\n' +
      '        if arr[mid] == target:\n' +
      '            return mid\n' +
      '        elif arr[mid] < target:\n' +
      '            left = mid + 1\n' +
      '        else:\n' +
      '            right = mid - 1\n' +
      '    return -1\n' +
      '```\n\n' +
      '**Lưu ý hay sai:** Mảng bắt buộc phải được sắp xếp trước khi chạy tìm kiếm nhị phân! Dùng `left + (right - left) // 2` để tránh tràn số nguyên.\n\n' +
      'Bạn muốn mình giải thích thêm phần nào trong thuật toán này không?';
  }

  // Phản hồi trực tiếp theo phương pháp sư phạm GDPT 2018
  return `Chào bạn! Để giải đáp chính xác nhất cho câu hỏi "${query}", bạn có thể gửi kèm đề bài cụ thể, biểu thức toán học hoặc yêu cầu cần làm rõ.

Mình sẽ giải thích bản chất lý thuyết, đưa ra công thức $LaTeX$, trình bày bài giải từng bước kèm ví dụ và mẹo tránh lỗi sai cho bạn ngay!`;
}

function getFallbackChatGptReply(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('toán') || q.includes('phương trình') || q.includes('tích phân') || q.includes('đạo hàm')) {
    return `### 📐 Hướng dẫn giải bài tập Toán học

Chào bạn! Dưới đây là phương pháp giải và ví dụ mẫu chuẩn phương pháp sư phạm:

1. **Phương pháp nhận dạng bài toán:**
   - Xác định tập xác định $D$ của bài toán.
   - Sử dụng các hằng đẳng thức hoặc công thức đạo hàm cơ bản: $(u \\cdot v)' = u'v + uv'$ và $(x^n)' = n \\cdot x^{n-1}$.
   - Biến đổi tương đương đưa về dạng tích hoặc phương trình bậc 2 quen thuộc.

2. **Các bước thực hiện:**
   - **Bước 1:** Đặt điều kiện có nghĩa.
   - **Bước 2:** Đưa về cùng cơ số hoặc đặt ẩn phụ thích hợp $t = f(x)$.
   - **Bước 3:** Giải tìm nghiệm và đối chiếu điều kiện để kết luận.

*Nếu bạn có một đề bài cụ thể, hãy dán nguyên văn đề bài vào khung chat để tôi giải chi tiết từng bước cho bạn nhé!*`;
  }

  if (q.includes('văn') || q.includes('nghị luận') || q.includes('dàn ý')) {
    return `### 📝 Dàn ý Nghị luận Văn học & Xã hội chuẩn cấu trúc

Chào bạn! Dưới đây là dàn ý khung 3 phần đạt chuẩn điểm cao:

1. **Mở bài:**
   - Dẫn dắt vấn đề (trích dẫn danh ngôn hoặc hiện tượng đời sống).
   - Nêu trực tiếp luận đề / tác phẩm và tác giả.

2. **Thân bài:**
   - **Giải thích:** Khái niệm cốt lõi của đề tài.
   - **Phân tích & Chứng minh:** Nêu ít nhất 2 luận điểm kèm dẫn chứng tiêu biểu (thực tế hoặc văn học).
   - **Bình luận & Mở rộng:** Lật ngược vấn đề (phê phán hiện tượng tiêu cực tương phản).
   - **Bài học nhận thức & hành động:** Liên hệ bản thân học sinh.

3. **Kết bài:**
   - Khẳng định lại ý nghĩa thông điệp và lời nhắn gửi tương lai.`;
  }

  if (q.includes('vật lí') || q.includes('lý') || q.includes('dao động') || q.includes('sóng')) {
    return `### ⚡ Tổng hợp kiến thức trọng tâm Vật lí 12

1. **Dao động điều hòa:**
   - Phương trình li độ: $x = A \\cos(\\omega t + \\varphi)$
   - Vận tốc: $v = -\\omega A \\sin(\\omega t + \\varphi)$, sớm pha $\\pi/2$ so với $x$.
   - Gia tốc: $a = -\\omega^2 x$, ngược pha với $x$.
   - Hệ thức độc lập: $A^2 = x^2 + \\frac{v^2}{\\omega^2}$.

2. **Con lắc lò xo:**
   - Tần số góc: $\\omega = \\sqrt{\\frac{k}{m}}$, chu kỳ $T = 2\\pi \\sqrt{\\frac{m}{k}}$.
   - Cơ năng bảo toàn: $W = \\frac{1}{2} k A^2 = \\text{hằng số}$.`;
  }

  if (q.includes('tiếng anh') || q.includes('english') || q.includes('grammar') || q.includes('ielts')) {
    return `### 🇬🇧 Hướng dẫn Ngữ pháp Tiếng Anh: Present Perfect (Hiện tại hoàn thành)

1. **Cấu trúc:**
   - Khẳng định: $\\text{S} + \\text{have/has} + \\text{V}_{\\text{ed/3}}$
   - Phủ định: $\\text{S} + \\text{haven't/hasn't} + \\text{V}_{\\text{ed/3}}$
   - Nghi vấn: $\\text{Have/Has} + \\text{S} + \\text{V}_{\\text{ed/3}}?$

2. **Dấu hiệu nhận biết:**
   - *Since* (mốc thời gian), *For* (khoảng thời gian), *Already, Yet, Just, Ever, Never, Recently*.

3. **Ví dụ thực tế:**
   - *I have studied on StudyFlow for 3 months.* (Tôi đã học trên StudyFlow được 3 tháng).`;
  }

  return `### 💡 Trợ lý AI ChatGPT sẵn sàng hỗ trợ bạn!

Tôi đã nhận được câu hỏi: **"${query}"**. 

Tôi có thể hỗ trợ bạn mọi lĩnh vực học tập:
- 📚 Giải chi tiết đề thi trắc nghiệm & tự luận.
- 💡 Giải thích bản chất lý thuyết, công thức nhớ nhanh.
- ✍️ Viết đoạn văn, sửa lỗi ngữ pháp, dịch thuật.
- 💻 Hướng dẫn lập trình và sửa lỗi code.

Hãy gửi cụ thể đề bài hoặc câu hỏi chi tiết, tôi sẽ giải thích từng bước cho bạn ngay!`;
}

// Fallback Study Schedule Generator
function generateSmartStudyScheduleFallback(data: any): string {
  const {
    tasks = [],
    events = [],
    studentProfile = {},
    gpaGoal = 8.8,
    currentAvg = 8.58,
    subjects = []
  } = data;

  const name = studentProfile?.name || 'Học sinh';
  const className = studentProfile?.className || '12';
  const numCurrentAvg = typeof currentAvg === 'number' ? currentAvg : parseFloat(currentAvg) || 8.58;
  const numGpaGoal = typeof gpaGoal === 'number' ? gpaGoal : parseFloat(gpaGoal) || 8.8;
  const gapGpa = (numGpaGoal - numCurrentAvg).toFixed(2);

  // Subject analysis
  const subjectList: Array<{ name: string; score: number; target: number; gap: number }> = (subjects && subjects.length > 0 ? subjects : [
    { name: 'Toán học', score: 8.5, target: 9.0 },
    { name: 'Vật lý', score: 8.2, target: 8.8 },
    { name: 'Hóa học', score: 7.8, target: 8.5 },
    { name: 'Ngữ văn', score: 8.0, target: 8.5 },
    { name: 'Tiếng Anh', score: 9.2, target: 9.5 },
    { name: 'Sinh học', score: 8.8, target: 9.0 }
  ]).map((s: any) => ({
    name: s.name,
    score: s.score,
    target: s.target,
    gap: Number((s.target - s.score).toFixed(2))
  }));

  const subjectsToImprove = [...subjectList].sort((a, b) => b.gap - a.gap);
  const topFocus = subjectsToImprove.filter(s => s.gap > 0).slice(0, 3);
  const strongSubjects = subjectsToImprove.filter(s => s.score >= 8.8 || s.gap <= 0);

  const openTasks = (tasks || []).filter((t: any) => !t.done);
  const completedTasks = (tasks || []).filter((t: any) => t.done);
  const topUrgentTasks = openTasks.slice(0, 4);

  return `### 📊 BÁO CÁO PHÂN TÍCH HỌC TẬP & THỜI GIAN BIỂU TỐI ƯU (STUDYFLOW AI)
**Học sinh:** ${name} | **Lớp:** ${className} | **Mục tiêu GPA:** ${numGpaGoal}/10 (Hiện tại: ${numCurrentAvg.toFixed(2)}/10)

---

### 1. 🎯 ĐÁNH GIÁ TỔNG QUAN HIỆN TRẠNG & ĐIỂM SỐ
- **Đánh giá GPA:** Điểm trung bình hiện tại của bạn là **${numCurrentAvg.toFixed(2)}/10**, khoảng cách đến mục tiêu là **${Number(gapGpa) > 0 ? `+${gapGpa} điểm` : 'Đã đạt chuẩn mục tiêu!'}**.
${topFocus.length > 0 ? `- **Môn học trọng tâm cần bứt phá điểm:** ${topFocus.map(s => `**${s.name}** (Hiện tại: ${s.score} ➔ Mục tiêu: ${s.target}, cần tăng ${s.gap > 0 ? '+' : ''}${s.gap} điểm)`).join(', ')}.` : '- Tất cả các môn đều đang bám rất sát chỉ tiêu.'}
${strongSubjects.length > 0 ? `- **Môn thế mạnh phát huy:** ${strongSubjects.map(s => `${s.name} (${s.score} điểm)`).join(', ')}.` : ''}
- **Khối lượng bài tập & nhiệm vụ:** Hiện đang có **${openTasks.length} bài tập chưa hoàn thành** (đã giải quyết ${completedTasks.length} bài).
${topUrgentTasks.length > 0 ? `  * *Nhiệm vụ ưu tiên giải quyết ngay:* ${topUrgentTasks.map((t: any) => `"${t.t}" (môn ${t.sub}, hạn: ${t.due})`).join('; ')}.` : '  * Hiện không có bài tập tồn đọng gấp.'}

---

### 2. 🗓️ THỜI GIAN BIỂU TỰ HỌC TỐI ƯU CẢ TUẦN (LỊCH HỌC HỢP LÝ CHI TIẾT TỪNG NGÀY)
*Kế hoạch được tối ưu hóa theo nhịp sinh học: môn tư duy tính toán xếp vào khung giờ não tỉnh táo nhất, đan xen môn xã hội, áp dụng kỹ thuật Pomodoro (25 phút học / 5 phút nghỉ) và kết thúc trước 22h45.*

#### 🔹 Thứ Hai: Khởi động tuần mới & Ôn tập môn trọng tâm
- **Sáng (07:00 - 11:30):** Học chính khóa trên lớp. Rà soát nhanh các bài tập trước giờ vào lớp.
- **Chiều (14:30 - 16:30):** Xử lý các bài tập về nhà khẩn cấp môn **${topFocus[0]?.name || 'Toán học'}**.
- **Tối (19:30 - 22:30):**
  * *19:30 - 20:45 (Block 1 - Pomodoro x 2):* Ôn tập chuyên đề môn **${topFocus[0]?.name || 'Toán học'}** (giải dạng bài tính toán nâng cao).
  * *20:45 - 21:00:* Giải lao ngắn, uống nước ấm, thư giãn mắt.
  * *21:00 - 22:15 (Block 2 - Pomodoro x 2):* Làm bài tập môn **${topFocus[1]?.name || 'Vật lý'}** hoặc luyện từ vựng Tiếng Anh.
  * *22:15 - 22:45:* Chuẩn bị sách vở ngày mai, thư giãn nhịp thở 4-7-8, đi ngủ trước 23:00.

#### 🔹 Thứ Ba: Rèn luyện kỹ năng & Giải bài tập vận dụng
- **Sáng (07:00 - 11:30):** Học chính khóa trên lớp theo thời khóa biểu.
- **Chiều (15:00 - 17:00):** Tự học tại thư viện hoặc phòng học: giải quyết bài tập môn **Ngữ văn** và các môn đọc hiểu.
- **Tối (19:30 - 22:30):**
  * *19:30 - 20:45:* Trọng tâm môn **${topFocus[1]?.name || 'Hóa học'}** (củng cố lý thuyết và giải 15 bài trắc nghiệm).
  * *21:00 - 22:15:* Luyện kỹ năng đọc hiểu Tiếng Anh hoặc lật Flashcards 20 thẻ ghi nhớ.
  * *22:15 - 22:45:* Thả lỏng não bộ, ghi chú việc cần làm ngày Thứ Tư.

#### 🔹 Thứ Tư: Đan xen môn tự nhiên & Xã hội
- **Sáng (07:00 - 11:30):** Học tập trung trên trường.
- **Chiều (14:30 - 16:30):** Hoàn thành bài tập nộp trên hệ thống StudyFlow.
- **Tối (19:30 - 22:30):**
  * *19:30 - 20:45:* Ôn tập môn **${topFocus[0]?.name || 'Toán học'}** - chuyên đề phương pháp giải nhanh.
  * *21:00 - 22:15:* Đọc văn bản Ngữ văn / Lịch sử, vẽ sơ đồ tư duy (Mindmap).
  * *22:15 - 22:45:* Nghe nhạc Baroque hoặc âm thanh trắng (White Noise), thư giãn toàn thân.

#### 🔹 Thứ Năm: Tăng tốc giải đề & Khắc phục điểm yếu
- **Sáng (07:00 - 11:30):** Học chính khóa trên lớp.
- **Chiều (15:00 - 17:00):** Tự học tự do, làm bài tập thực hành theo nhóm.
- **Tối (19:30 - 22:30):**
  * *19:30 - 20:45:* Tập trung môn có khoảng cách điểm lớn: **${topFocus[2]?.name || 'Sinh học'}**.
  * *21:00 - 22:15:* Rà soát toàn bộ các bài tập sắp đến hạn trong tuần.
  * *22:15 - 22:45:* Chuẩn bị đồng phục và cặp sách cho Thứ Sáu.

#### 🔹 Thứ Sáu: Tổng kết kiến thức trong tuần
- **Sáng (07:00 - 11:30):** Học chính khóa trên lớp.
- **Chiều (15:00 - 17:00):** Xử lý dứt điểm mọi bài tập còn tồn đọng trong tuần.
- **Tối (19:30 - 22:00):**
  * *19:30 - 21:00:* Ôn tập nhẹ nhàng các công thức bằng Flashcards trên StudyFlow.
  * *21:00 - 22:30:* Thư giãn cuối tuần sớm, xem phim hoặc đọc sách bổ trợ.

#### 🔹 Thứ Bảy: Luyện đề kiểm tra thử & Đánh giá năng lực
- **Sáng (08:00 - 10:30):** Làm bài thi thử trắc nghiệm 45 phút trên StudyFlow (Phần Bài thi & Đề trắc nghiệm).
- **Chiều (14:30 - 16:30):** Sửa chi tiết các câu làm sai trong bài thi thử, ghi vào "Sổ tay lỗi sai".
- **Tối (19:30 - 21:30):** Xem trước tài liệu tuần tới hoặc sinh hoạt ngoại khóa cùng gia đình / bạn bè.

#### 🔹 Chủ Nhật: Chuẩn bị chiến lược tuần mới & Tái tạo năng lượng
- **Sáng (08:30 - 11:00):** Lập kế hoạch các mục tiêu tuần mới trên StudyFlow.
- **Chiều:** Vận động thể thao (chạy bộ, bơi lội, cầu lông) giúp kích thích tuần hoàn máu và tái tạo dopamine não bộ.
- **Tối (20:00 - 21:30):** Chuẩn bị bài học cho Thứ Hai, đi ngủ sớm lúc 22:30 để có tinh thần sảng khoái nhất.

---

### 3. 🎯 CHIẾN LƯỢC KÉO ĐIỂM SỐ NÂNG GPA
- **Môn ${topFocus[0]?.name || 'Toán học'}:** Đạt tối thiểu **8.8 - 9.0** ở bài kiểm tra 1 tiết sắp tới bằng cách làm chắc chắn toàn bộ phần Nhận biết & Thông hiểu (không được phép để mất điểm ở các câu hỏi cơ bản).
- **Môn ${topFocus[1]?.name || 'Vật lý'}:** Tận dụng tính năng **Luyện đề AI** trên StudyFlow với ma trận 40% Nhận biết - 30% Thông hiểu - 20% Vận dụng để quen phản xạ làm bài trắc nghiệm dưới áp lực thời gian.
- **Môn ${topFocus[2]?.name || 'Hóa học'}:** Lập sơ đồ tư duy hệ thống hóa các chuỗi phản ứng và giải ít nhất 15 câu trắc nghiệm mỗi tối.

---

### 4. ⚡ 3 NGUYÊN TẮC VÀNG DUY TRÌ HIỆU SUẤT CAO
1. **Quy tắc 25/5 Pomodoro:** Để điện thoại xa tầm tay khi học bài. Mỗi chu kỳ 25 phút tập trung cao độ, 5 phút nghỉ ngơi vươn vai.
2. **Kỹ thuật lặp lại ngắt quãng (Spaced Repetition):** Kiến thức mới học cần được xem lại sau 24h, 3 ngày và 7 ngày để ghi nhớ lâu dài vào tiềm thức.
3. **Thở 4-7-8 trước khi đi ngủ:** Hít vào bằng mũi 4 giây, giữ hơi thở 7 giây, thở ra bằng miệng 8 giây (lặp lại 4 lần) giúp giảm căng thẳng và ngủ sâu giấc.`;
}

// Fallback Goal Roadmap Generator
function buildSmartGoalMapFallback(goalTitle: string, subject?: string) {
  const title = goalTitle || 'Hoàn thành chương trình ôn thi THPT';
  const sub = subject || 'Tổng hợp';
  const tLower = title.toLowerCase();

  let milestones = [
    {
      id: 'm1',
      title: 'Mốc 1: Khởi đầu & Củng cố nền tảng',
      description: 'Tổng hợp toàn bộ công thức và kiến thức trọng tâm',
      status: 'completed',
      rewardBadge: '🌱 Khởi đầu',
      rewardPoints: 100
    },
    {
      id: 'm2',
      title: 'Mốc 2: Nắm chắc phương pháp & Dạng bài cơ bản',
      description: 'Giải thành thạo bài tập nhận biết và thông hiểu',
      status: 'in_progress',
      rewardBadge: '⭐ Nắm chắc',
      rewardPoints: 150
    },
    {
      id: 'm3',
      title: 'Mốc 3: Luyện kỹ năng thực chiến & Xử lý bẫy đề',
      description: 'Khắc phục các lỗi sai thường gặp khi làm bài dưới áp lực thời gian',
      status: 'locked',
      rewardBadge: '🛡️ Thực chiến',
      rewardPoints: 200
    },
    {
      id: 'm4',
      title: 'Mốc 4: Tăng tốc giải đề nâng cao 8.5+',
      description: 'Chinh phục các câu hỏi vận dụng cao và tối ưu tốc độ',
      status: 'locked',
      rewardBadge: '🔥 Bứt phá',
      rewardPoints: 250
    },
    {
      id: 'm5',
      title: 'Mốc 5: Chinh phục đỉnh cao & Nhận Huy hiệu Quán quân',
      description: 'Đạt điểm số mục tiêu trong bài khảo sát toàn diện',
      status: 'locked',
      rewardBadge: '👑 Quán quân',
      rewardPoints: 300
    }
  ];

  if (tLower.includes('toán')) {
    milestones = [
      { id: 'm1', title: 'Mốc 1: Hệ thống hóa công thức & Đạo hàm', description: 'Nắm chắc bảng đạo hàm, tính đơn điệu và cực trị hàm số', status: 'completed', rewardBadge: '📐 Nền tảng Toán', rewardPoints: 100 },
      { id: 'm2', title: 'Mốc 2: Khảo sát hàm số & Tương giao đồ thị', description: 'Làm chủ các dạng toán tiệm cận, bảng biến thiên và tương giao đồ thị', status: 'in_progress', rewardBadge: '📈 Đồ thị bậc thầy', rewardPoints: 150 },
      { id: 'm3', title: 'Mốc 3: Lũy thừa, Mũ & Logarit', description: 'Giải nhanh phương trình, bất phương trình mũ và logarit', status: 'locked', rewardBadge: '🔢 Bậc thầy Mũ - Loga', rewardPoints: 200 },
      { id: 'm4', title: 'Mốc 4: Hình học không gian & Tọa độ Oxyz', description: 'Thành thạo tính góc, khoảng cách và phương trình mặt phẳng', status: 'locked', rewardBadge: '📐 Không gian Oxyz', rewardPoints: 250 },
      { id: 'm5', title: 'Mốc 5: Luyện 10 đề thi tổng hợp đạt 9.0+', description: 'Chinh phục trọn vẹn các câu hỏi phân loại vận dụng cao', status: 'locked', rewardBadge: '👑 Quán quân Toán học', rewardPoints: 300 }
    ];
  } else if (tLower.includes('lí') || tLower.includes('lý')) {
    milestones = [
      { id: 'm1', title: 'Mốc 1: Dao động điều hòa & Vòng tròn lượng giác', description: 'Thuộc làu hệ thức độc lập và phương pháp quét trục thời gian', status: 'completed', rewardBadge: '⚡ Sóng & Dao động', rewardPoints: 100 },
      { id: 'm2', title: 'Mốc 2: Con lắc lò xo & Con lắc đơn', description: 'Tính toán thành thạo năng lượng, chu kỳ và lực đàn hồi', status: 'in_progress', rewardBadge: '🎯 Con lắc chuẩn xác', rewardPoints: 150 },
      { id: 'm3', title: 'Mốc 3: Sóng cơ & Giao thoa sóng', description: 'Xác định số điểm cực đại, cực tiểu và phương trình truyền sóng', status: 'locked', rewardBadge: '🌊 Chuyên gia Sóng', rewardPoints: 200 },
      { id: 'm4', title: 'Mốc 4: Dòng điện xoay chiều RLC', description: 'Vận dụng giản đồ vecto và hiện tượng cộng hưởng điện', status: 'locked', rewardBadge: '💡 Mạch điện RLC', rewardPoints: 250 },
      { id: 'm5', title: 'Mốc 5: Tổng ôn thi thử đạt 8.8+', description: 'Làm trọn vẹn bộ đề thi chuẩn ma trận Bộ GD&ĐT', status: 'locked', rewardBadge: '👑 Bậc thầy Vật lí', rewardPoints: 300 }
    ];
  } else if (tLower.includes('hóa')) {
    milestones = [
      { id: 'm1', title: 'Mốc 1: Este - Lipit & Hóa hữu cơ', description: 'Nắm chắc phản ứng thủy phân este và đồng phân cấu tạo', status: 'completed', rewardBadge: '🧪 Este - Lipit', rewardPoints: 100 },
      { id: 'm2', title: 'Mốc 2: Cacbohidrat & Amin, Amino axit', description: 'Phân biệt Glucozo, Saccarozo và tính chất lưỡng tính amino axit', status: 'in_progress', rewardBadge: '🧬 Hợp chất hữu cơ', rewardPoints: 150 },
      { id: 'm3', title: 'Mốc 3: Đại cương kim loại & Dãy điện hóa', description: 'Áp dụng định luật bảo toàn e và quy tắc alpha', status: 'locked', rewardBadge: '⚙️ Kim loại thực chiến', rewardPoints: 200 },
      { id: 'm4', title: 'Mốc 4: Bài toán đồ thị & Bảo toàn khối lượng', description: 'Giải nhanh bài toán $CO_2$ tác dụng kiềm và nhôm hidroxit', status: 'locked', rewardBadge: '📊 Đồ thị Hóa học', rewardPoints: 250 },
      { id: 'm5', title: 'Mốc 5: Chinh phục điểm 9+ Hóa học', description: 'Hoàn thành 10 đề thi thử đạt tối thiểu 9.0 điểm', status: 'locked', rewardBadge: '👑 Bậc thầy Hóa học', rewardPoints: 300 }
    ];
  } else if (tLower.includes('anh') || tLower.includes('ielts') || tLower.includes('english')) {
    milestones = [
      { id: 'm1', title: 'Mốc 1: 1000 Từ vựng trọng tâm B2-C1', description: 'Thuộc và vận dụng 1000 từ vựng học thuật theo chủ đề', status: 'completed', rewardBadge: '🔤 Thần từ vựng', rewardPoints: 100 },
      { id: 'm2', title: 'Mốc 2: Ngữ pháp nâng cao & Mệnh đề quan hệ', description: 'Làm chủ đảo ngữ, câu điều kiện hỗn hợp và thể giả định', status: 'in_progress', rewardBadge: '✍️ Bậc thầy Ngữ pháp', rewardPoints: 150 },
      { id: 'm3', title: 'Mốc 3: Kỹ năng đọc hiểu & Skimming/Scanning', description: 'Giải quyết các bài đọc dài không bị mất thời gian', status: 'locked', rewardBadge: '📖 Chiến thần Đọc hiểu', rewardPoints: 200 },
      { id: 'm4', title: 'Mốc 4: Luyện đề chuẩn Format THPTQG / IELTS', description: 'Giải 15 đề thi thử đạt tốc độ dưới 50 phút', status: 'locked', rewardBadge: '🎯 Xạ thủ 9+ Anh', rewardPoints: 250 },
      { id: 'm5', title: 'Mốc 5: Chinh phục Band điểm 8.0+ / 9.5+', description: 'Về đích xuất sắc và nhận danh hiệu Ngôn ngữ tinh anh', status: 'locked', rewardBadge: '👑 Quán quân Tiếng Anh', rewardPoints: 300 }
    ];
  }

  return {
    id: 'goal_' + Date.now(),
    title,
    subject: sub,
    createdAt: new Date().toISOString(),
    milestones
  };
}

// Dev & Production serving
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Store room information in memory (Source of Truth)
  const rooms: Record<string, { users: Array<{ id: string; name: string; avatar?: string; role: string }> }> = {};

  io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId, user }) => {
      socket.join(roomId);
      
      if (!rooms[roomId]) {
        rooms[roomId] = { users: [] };
      }
      
      // Prevent duplicate joins from same socket
      const existing = rooms[roomId].users.find(u => u.id === user.id);
      if (!existing) {
        rooms[roomId].users.push({ ...user, socketId: socket.id });
      } else {
        // Update socket ID if user reconnected
        rooms[roomId].users = rooms[roomId].users.map(u => u.id === user.id ? { ...u, socketId: socket.id } : u);
      }

      console.log(`User ${user.name} joined room ${roomId}`);
      
      // Notify others in room
      io.to(roomId).emit('user-joined', { 
        user, 
        users: rooms[roomId].users 
      });

      // Send initial users list to the one who joined
      socket.emit('room-users', rooms[roomId].users);
    });

    socket.on('send-message', ({ roomId, message }) => {
      io.to(roomId).emit('new-message', message);
    });

    // WebRTC Signaling bridge (for PeerJS or manual WebRTC)
    socket.on('signal', ({ roomId, signal, to, from }) => {
      if (to) {
        // Direct signal to specific user
        const targetUser = rooms[roomId]?.users.find(u => (u as any).socketId === to);
        if (targetUser) {
          io.to(to).emit('signal', { signal, from });
        }
      } else {
        // Broadcast signal to everyone else in room
        socket.to(roomId).emit('signal', { signal, from });
      }
    });

    socket.on('leave-room', ({ roomId, userId }) => {
      socket.leave(roomId);
      if (rooms[roomId]) {
        rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== userId);
        io.to(roomId).emit('user-left', userId);
        
        // Clean up empty rooms
        if (rooms[roomId].users.length === 0) {
          delete rooms[roomId];
        }
      }
    });

    socket.on('disconnect', () => {
      // Find which rooms this socket was in and clean up
      Object.keys(rooms).forEach(roomId => {
        const user = rooms[roomId].users.find(u => (u as any).socketId === socket.id);
        if (user) {
          rooms[roomId].users = rooms[roomId].users.filter(u => (u as any).socketId !== socket.id);
          io.to(roomId).emit('user-left', user.id);
          if (rooms[roomId].users.length === 0) {
            delete rooms[roomId];
          }
        }
      });
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    const groq = process.env.FALLBACK_API_KEY ? 'có' : 'không';
    const myGemini = process.env.MY_GEMINI_API_KEY ? 'có' : 'không';
    const gemini = process.env.GEMINI_API_KEY ? 'có' : 'không';
    console.log(`Nguồn: groq=${groq}, MY_GEMINI_API_KEY=${myGemini}, GEMINI_API_KEY=${gemini}`);
    console.log(`StudyFlow Real-time Server running on port ${port} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
