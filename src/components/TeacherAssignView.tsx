import React, { useState, useRef } from 'react';
import {
  Send,
  UploadCloud,
  FileText,
  Calendar,
  Clock,
  CheckSquare,
  Plus,
  Trash2,
  X,
  Eye,
  BellRing,
  Sparkles,
  Link2,
  FolderOpen,
  ClipboardList,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  Edit3,
  ArrowLeft,
  Paperclip,
  Download,
  Pin
} from 'lucide-react';
import {
  TeacherClass,
  TaskItem,
  TaskSubtask,
  ExamItem,
  LibraryItem,
  QuestionItem
} from '../types';
import { DocumentViewerModal } from './DocumentViewerModal';

export interface TeacherAssignPayload {
  task: Omit<TaskItem, 'id'>;
  targetClassId: string;
  sendNotification: boolean;
  pinNotification: boolean;
  saveToLibrary: boolean;
  newExamToSave?: ExamItem | null;
}

interface TeacherAssignViewProps {
  classes: TeacherClass[];
  tasks: TaskItem[];
  exams: ExamItem[];
  library: LibraryItem[];
  teacherName: string;
  defaultSubject?: string;
  defaultClassId?: string;
  onAssignSubmit: (payload: TeacherAssignPayload) => void;
  onUpdateTask: (task: TaskItem) => void;
  onDeleteTask: (id: number) => void;
  onResendNotice: (task: TaskItem) => void;
  onBackToOverview?: () => void;
}

const SUBJECT_OPTIONS = [
  'Toán',
  'Vật lí',
  'Hóa học',
  'Ngữ văn',
  'Tiếng Anh',
  'Sinh học',
  'Lịch sử',
  'Địa lí',
  'Tin học',
  'GDCD'
];

const WEIGHT_OPTIONS = [
  'Hệ số 1',
  'Hệ số 2',
  'Kiểm tra 15 phút',
  'Kiểm tra 1 tiết',
  'Ôn tập tự chọn'
];

function getDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const TeacherAssignView: React.FC<TeacherAssignViewProps> = ({
  classes,
  tasks,
  exams,
  library,
  teacherName,
  defaultSubject = 'Vật lí',
  defaultClassId = 'all',
  onAssignSubmit,
  onUpdateTask,
  onDeleteTask,
  onResendNotice,
  onBackToOverview
}) => {
  // Form State
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClassId || 'all');
  const [assignMode, setAssignMode] = useState<'homework' | 'quiz'>('homework');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(defaultSubject || 'Vật lí');
  const [weight, setWeight] = useState('Hệ số 1');
  const [dueDate, setDueDate] = useState(getDefaultDueDate);
  const [dueTime, setDueTime] = useState('23:59');
  const [note, setNote] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [pinNotification, setPinNotification] = useState(false);
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  // Subtasks builder
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  // Attachment & Drag-Drop State
  const [attachmentSourceTab, setAttachmentSourceTab] = useState<'upload' | 'exam' | 'library' | 'link'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsingExam, setIsParsingExam] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentType, setAttachmentType] = useState<'pdf' | 'image' | 'text' | 'docx' | 'link'>('pdf');
  const [attachmentContent, setAttachmentContent] = useState('');
  const [externalLinkInput, setExternalLinkInput] = useState('');

  // Linked or parsed interactive exam
  const [linkedExamId, setLinkedExamId] = useState<number | undefined>(undefined);
  const [parsedQuestions, setParsedQuestions] = useState<QuestionItem[]>([]);
  const [examDuration, setExamDuration] = useState<number>(45);
  const [showParsedPreview, setShowParsedPreview] = useState(false);

  // Right Panel Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'has_file' | 'important' | 'pending'>('all');

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState<LibraryItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalStudents = classes.reduce((sum, c) => sum + c.studentsCount, 0);
  const subjectChoices = Array.from(new Set([defaultSubject, ...SUBJECT_OPTIONS].filter(Boolean)));

  const resetForm = () => {
    setEditingTaskId(null);
    setSelectedClassId(defaultClassId || 'all');
    setAssignMode('homework');
    setTitle('');
    setSubject(defaultSubject || 'Vật lí');
    setWeight('Hệ số 1');
    setDueDate(getDefaultDueDate());
    setDueTime('23:59');
    setNote('');
    setIsImportant(false);
    setSendNotification(true);
    setPinNotification(false);
    setSaveToLibrary(false);
    setSubtasks([]);
    setNewSubtaskInput('');
    setAttachmentName('');
    setAttachmentUrl('');
    setAttachmentType('pdf');
    setAttachmentContent('');
    setExternalLinkInput('');
    setLinkedExamId(undefined);
    setParsedQuestions([]);
    setShowParsedPreview(false);
    setUploadStatus(null);
  };

  // File Upload Processing (supports Drag & Drop and file picker)
  const handleProcessFile = async (file: File) => {
    setIsUploading(true);
    setUploadStatus(null);
    setParsedQuestions([]);

    const lower = file.name.toLowerCase();
    let detectedType: 'pdf' | 'image' | 'text' | 'docx' | 'link' = 'link';
    if (lower.endsWith('.pdf') || file.type.includes('pdf')) detectedType = 'pdf';
    else if (lower.match(/\.(png|jpe?g|gif|webp|svg)$/) || file.type.startsWith('image/')) detectedType = 'image';
    else if (lower.endsWith('.docx') || lower.endsWith('.doc')) detectedType = 'docx';
    else if (lower.match(/\.(txt|md|json|csv)$/)) detectedType = 'text';

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1] || '');
        };
        reader.onerror = () => reject(new Error('Không thể đọc file từ thiết bị.'));
        reader.readAsDataURL(file);
      });

      // Upload to server so URL is lightweight and persistent across sessions
      const uploadRes = await fetch('/api/upload-assignment-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileBase64: base64
        })
      });

      const data = await uploadRes.json();
      if (uploadRes.ok && data.success) {
        setAttachmentName(data.fileName || file.name);
        setAttachmentUrl(data.fileUrl);
        setAttachmentType(data.attachmentType || detectedType);
        setAttachmentContent(data.extractedText || '');
        if (!title.trim()) {
          setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '));
        }
        setUploadStatus({
          type: 'success',
          message: `Đã tải lên "${file.name}" thành công. Học sinh có thể xem và tải trực tiếp từ thông báo.`
        });
      } else {
        throw new Error(data.error || 'Tải lên thất bại');
      }
    } catch (err: any) {
      // Graceful fallback to local Data URL for smaller files
      if (file.size <= 2 * 1024 * 1024) {
        const dataUrl = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve((r.result as string) || '');
          r.readAsDataURL(file);
        });
        setAttachmentName(file.name);
        setAttachmentUrl(dataUrl);
        setAttachmentType(detectedType);
        if (detectedType === 'text') {
          try {
            setAttachmentContent(await file.text());
          } catch {}
        }
        if (!title.trim()) {
          setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '));
        }
        setUploadStatus({
          type: 'success',
          message: `Đã đính kèm "${file.name}" vào bài tập.`
        });
      } else {
        setUploadStatus({
          type: 'error',
          message: err?.message || 'Không thể tải lên file quá lớn. Vui lòng thử file dưới 10MB.'
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Optional: Parse attached file into interactive quiz questions using Azota AI endpoint
  const handleParseAttachedExam = async () => {
    if (!attachmentName) return;
    setIsParsingExam(true);
    setUploadStatus(null);

    try {
      let payload: any = { fileName: attachmentName };
      if (attachmentContent.trim()) {
        payload.rawText = attachmentContent;
      } else if (attachmentUrl.startsWith('data:')) {
        payload.fileBase64 = attachmentUrl.split(',')[1];
        const mimeMatch = attachmentUrl.match(/^data:([^;]+);/);
        if (mimeMatch) payload.mimeType = mimeMatch[1];
      } else if (attachmentUrl.startsWith('/uploads/')) {
        const fileRes = await fetch(attachmentUrl);
        const blob = await fileRes.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(((reader.result as string) || '').split(',')[1] || '');
          reader.readAsDataURL(blob);
        });
        payload.fileBase64 = base64;
        payload.mimeType = blob.type;
      }

      const res = await fetch('/api/ai/parse-exam-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
        const normalized = data.questions.map((q: any, idx: number) => ({
          id: q.id || idx + 1,
          questionText: String(q.questionText || ''),
          options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
          correctOption: typeof q.correctOption === 'number' && q.correctOption >= 0 ? q.correctOption : 0,
          explanation: String(q.explanation || '')
        }));
        const detectedCount = data.questions.filter((q: any) => typeof q.correctOption === 'number' && q.correctOption >= 0).length;
        const ocrNote = data.ocrUsed
          ? ` (OCR trích xuất${data.formulaCount > 0 ? ` ${data.formulaCount} công thức Toán LaTeX` : ' văn bản ảnh/PDF'})`
          : '';
        setParsedQuestions(normalized);
        setAssignMode('quiz');
        if (data.subject && data.subject !== 'Tổng hợp') setSubject(data.subject);
        if (data.durationMinutes) setExamDuration(data.durationMinutes);
        setShowParsedPreview(true);
        setUploadStatus({
          type: 'success',
          message:
            detectedCount < normalized.length
              ? `Đã bóc tách ${normalized.length} câu hỏi${ocrNote} từ "${attachmentName}" (${detectedCount}/${normalized.length} câu có đáp án sẵn — Thầy/Cô có thể kiểm tra và chỉnh đáp án trước khi giao).`
              : `Đã bóc tách thành công ${normalized.length} câu hỏi trắc nghiệm${ocrNote} từ "${attachmentName}"! Khi giao bài, học sinh có thể làm trực tuyến và chấm điểm tự động.`
        });
      } else {
        setUploadStatus({
          type: 'error',
          message:
            data.error ||
            'Không tìm thấy cấu trúc câu hỏi trắc nghiệm chuẩn (Câu 1: ... A. B. C. D.) trong file này. File gốc vẫn được đính kèm đầy đủ cho học sinh tải về.'
        });
      }
    } catch {
      setUploadStatus({
        type: 'error',
        message: 'Không thể phân tích tự động file này. File gốc vẫn được đính kèm bình thường.'
      });
    } finally {
      setIsParsingExam(false);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskInput.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text: newSubtaskInput.trim(), done: false }
    ]);
    setNewSubtaskInput('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSelectExistingExam = (examIdStr: string) => {
    if (!examIdStr) {
      setLinkedExamId(undefined);
      return;
    }
    const id = Number(examIdStr);
    const ex = exams.find((e) => e.id === id);
    if (ex) {
      setLinkedExamId(ex.id);
      setAssignMode('quiz');
      if (!title.trim()) setTitle(ex.title);
      if (ex.subject) setSubject(ex.subject);
      setParsedQuestions([]);
      setUploadStatus({
        type: 'success',
        message: `Đã liên kết đề thi "${ex.title}" (${ex.questions.length} câu hỏi).`
      });
    }
  };

  const handleSelectLibraryResource = (libIdStr: string) => {
    if (!libIdStr) return;
    const id = Number(libIdStr);
    const lib = library.find((l) => l.id === id);
    if (lib) {
      setAttachmentName(lib.fileName || lib.t);
      setAttachmentUrl(lib.url || '');
      setAttachmentType(
        lib.fileType === 'pdf' || lib.fileType === 'image' || lib.fileType === 'text' || lib.fileType === 'link'
          ? lib.fileType
          : 'text'
      );
      setAttachmentContent(lib.fileContent || lib.d || '');
      if (!title.trim()) setTitle(`Bài tập: ${lib.t}`);
      if (lib.sub) setSubject(lib.sub);
      setUploadStatus({
        type: 'success',
        message: `Đã đính kèm tài liệu "${lib.t}" từ Kho học liệu.`
      });
    }
  };

  const handleApplyExternalLink = () => {
    let url = externalLinkInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    setAttachmentName(url);
    setAttachmentUrl(url);
    setAttachmentType('link');
    setAttachmentContent('');
    setUploadStatus({
      type: 'success',
      message: `Đã đính kèm liên kết tài liệu: ${url}`
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const targetCls = classes.find((c) => c.id === selectedClassId);
    const targetClassName = targetCls ? targetCls.name : `Tất cả ${classes.length} lớp`;

    // If editing an existing task
    if (editingTaskId !== null) {
      const existing = tasks.find((t) => t.id === editingTaskId);
      if (existing) {
        onUpdateTask({
          ...existing,
          t: title.trim(),
          sub: subject,
          due: dueDate,
          dueTime,
          weight,
          hi: isImportant || weight === 'Hệ số 2',
          priority: isImportant ? 'high' : 'medium',
          quadrant: isImportant ? 1 : 2,
          note: note.trim() || undefined,
          subtasks,
          targetClassId: selectedClassId,
          targetClassName,
          assignedBy: teacherName,
          attachmentName: attachmentName || undefined,
          attachmentUrl: attachmentUrl || undefined,
          attachmentType: attachmentName ? attachmentType : undefined,
          attachmentContent: attachmentContent || undefined,
          linkedExamId
        });
        resetForm();
        return;
      }
    }

    // Create new ExamItem if teacher parsed questions from dragged file
    let finalExamId = linkedExamId;
    let newExamToSave: ExamItem | null = null;
    if (assignMode === 'quiz' && !finalExamId && parsedQuestions.length > 0) {
      const generatedId = Date.now() + 1;
      finalExamId = generatedId;
      newExamToSave = {
        id: generatedId,
        title: title.trim(),
        subject,
        durationMinutes: examDuration || 45,
        submissionsCount: 0,
        status: 'published',
        assignedTo: targetClassName,
        assignedAt: new Date().toISOString(),
        createdAt:
          new Date().toLocaleDateString('vi-VN') +
          ' ' +
          new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        price: 'Miễn phí',
        questions: parsedQuestions,
        description: note.trim() || `Bài tập trắc nghiệm giao bởi ${teacherName}`,
        fileName: attachmentName || undefined,
        fileUrl: attachmentUrl || undefined
      };
    }

    onAssignSubmit({
      task: {
        t: title.trim(),
        sub: subject,
        due: dueDate,
        dueTime,
        done: false,
        status: 'todo',
        priority: isImportant ? 'high' : 'medium',
        quadrant: isImportant ? 1 : 2,
        hi: isImportant || weight === 'Hệ số 2',
        weight,
        note: note.trim() || undefined,
        subtasks,
        assignedBy: teacherName,
        targetClassId: selectedClassId,
        targetClassName,
        attachmentName: attachmentName || undefined,
        attachmentUrl: attachmentUrl || undefined,
        attachmentType: attachmentName ? attachmentType : undefined,
        attachmentContent: attachmentContent || undefined,
        linkedExamId: finalExamId,
        createdAt: new Date().toISOString()
      },
      targetClassId: selectedClassId,
      sendNotification,
      pinNotification: pinNotification || isImportant,
      saveToLibrary,
      newExamToSave
    });

    resetForm();
  };

  const handleLoadTaskForEdit = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setTitle(task.t);
    setSubject(task.sub || defaultSubject);
    setDueDate(task.due || getDefaultDueDate());
    setDueTime(task.dueTime || '23:59');
    setWeight(task.weight || 'Hệ số 1');
    setNote(task.note || '');
    setIsImportant(!!task.hi || task.priority === 'high');
    setSubtasks(task.subtasks || []);
    setSelectedClassId(task.targetClassId || 'all');
    setAttachmentName(task.attachmentName || '');
    setAttachmentUrl(task.attachmentUrl || '');
    setAttachmentType(task.attachmentType || 'pdf');
    setAttachmentContent(task.attachmentContent || '');
    setLinkedExamId(task.linkedExamId);
    setAssignMode(task.linkedExamId ? 'quiz' : 'homework');
    setUploadStatus(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPreview = (
    name: string,
    url?: string,
    type?: 'pdf' | 'image' | 'text' | 'docx' | 'link',
    content?: string,
    sub?: string
  ) => {
    setPreviewDoc({
      id: Date.now(),
      t: name,
      sub: sub || subject,
      type: 'Đề bài tập',
      d: content || `Tài liệu bài tập đính kèm: ${name}`,
      url: url || undefined,
      fileName: name,
      fileType: type === 'docx' ? 'text' : type || 'text',
      fileContent: content || (type === 'docx' ? `Tệp Word "${name}". Bấm nút tải xuống ở góc trên để mở bản gốc định dạng .docx.` : undefined)
    });
  };

  // Filter assigned tasks list
  const filteredTasks = tasks.filter((t) => {
    if (listFilter === 'has_file' && !t.attachmentName && !t.linkedExamId) return false;
    if (listFilter === 'important' && !t.hi && t.priority !== 'high') return false;
    if (listFilter === 'pending' && t.done) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.t.toLowerCase().includes(q) ||
        t.sub.toLowerCase().includes(q) ||
        (t.targetClassName || '').toLowerCase().includes(q) ||
        (t.attachmentName || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const teacherCreatedCount = tasks.filter((t) => t.assignedBy || t.targetClassName).length || tasks.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            {onBackToOverview && (
              <button
                type="button"
                onClick={onBackToOverview}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Quay lại Tổng quan"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Giao nhiệm vụ & Bài tập cho học sinh
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Soạn bài tập, kéo thả file đề thi hoặc tài liệu đính kèm và gửi thông báo tức thì đến học sinh.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
          <span>
            <strong className="font-semibold text-slate-900 dark:text-white">{classes.length}</strong> lớp quản lý
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span>
            <strong className="font-semibold text-slate-900 dark:text-white">{totalStudents}</strong> học sinh
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
          <span>
            <strong className="font-semibold text-emerald-600 dark:text-emerald-400">{teacherCreatedCount}</strong> nhiệm vụ
          </span>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): Assignment Composer */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {editingTaskId !== null ? 'Chỉnh sửa nhiệm vụ đã giao' : 'Soạn nhiệm vụ mới'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Học sinh nhận bài qua Thông báo và danh sách Bài tập
                </p>
              </div>
            </div>

            {editingTaskId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Hủy sửa
              </button>
            )}
          </div>

          {/* Class & Mode Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Lớp nhận nhiệm vụ
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Tất cả {classes.length} lớp ({totalStudents} học sinh)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number}. {c.name} ({c.studentsCount} HS)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Hình thức giao bài
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setAssignMode('homework')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                    assignMode === 'homework'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Bài tập & File đề
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode('quiz')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                    assignMode === 'quiz'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Trắc nghiệm Online
                </button>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tiêu đề nhiệm vụ / Bài tập *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Hoàn thành đề kiểm tra Dao động điều hòa - Tuần 12..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Subject, Weight, Due Date, Due Time */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Môn học
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {subjectChoices.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Hệ số / Loại
              </label>
              <select
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                  if (e.target.value === 'Hệ số 2' || e.target.value === 'Kiểm tra 1 tiết') {
                    setIsImportant(true);
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {WEIGHT_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Hạn nộp (Ngày)
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Giờ chốt nộp
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Drag & Drop File Zone + Quick Sources */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Đính kèm file đề & tài liệu
              </label>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setAttachmentSourceTab('upload')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer whitespace-nowrap ${
                    attachmentSourceTab === 'upload'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Kéo thả File
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentSourceTab('exam')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer whitespace-nowrap ${
                    attachmentSourceTab === 'exam'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Kho đề ({exams.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentSourceTab('library')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer whitespace-nowrap ${
                    attachmentSourceTab === 'library'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Học liệu ({library.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttachmentSourceTab('link')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer whitespace-nowrap ${
                    attachmentSourceTab === 'link'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Gắn Link
                </button>
              </div>
            </div>

            {attachmentSourceTab === 'upload' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleProcessFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-emerald-500/70 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc,.pdf,.txt,.md,.json,.csv,.png,.jpg,.jpeg,.webp,.xlsx,.pptx"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessFile(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                />

                {isUploading ? (
                  <div className="py-3 flex flex-col items-center gap-2">
                    <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Đang tải lên và xử lý file đề...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Kéo thả file đề vào đây, hoặc <span className="text-emerald-600 dark:text-emerald-400 underline">chọn file từ máy tính</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Hỗ trợ Word (.docx) · PDF (.pdf) · Ảnh đề bài (.png, .jpg) · Văn bản (.txt, .json)
                    </p>
                  </div>
                )}
              </div>
            )}

            {attachmentSourceTab === 'exam' && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Chọn đề thi trắc nghiệm có sẵn để giao cho học sinh:
                </label>
                <select
                  value={linkedExamId || ''}
                  onChange={(e) => handleSelectExistingExam(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">-- Chọn đề thi trong kho --</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.subject} · {ex.questions.length} câu · {ex.durationMinutes} phút)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {attachmentSourceTab === 'library' && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Đính kèm tài liệu từ Kho học liệu StudyFlow:
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => handleSelectLibraryResource(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">-- Chọn tài liệu học tập --</option>
                  {library.map((lib) => (
                    <option key={lib.id} value={lib.id}>
                      {lib.t} ({lib.sub} · {lib.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {attachmentSourceTab === 'link' && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={externalLinkInput}
                  onChange={(e) => setExternalLinkInput(e.target.value)}
                  placeholder="Dán liên kết Google Drive, Docs, PDF hoặc video bài giảng..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleApplyExternalLink}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 transition cursor-pointer whitespace-nowrap"
                >
                  Đính kèm
                </button>
              </div>
            )}

            {/* Status Notice */}
            {uploadStatus && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  uploadStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {uploadStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="flex-1">{uploadStatus.message}</span>
              </div>
            )}

            {/* Attached File Preview Card */}
            {attachmentName && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {attachmentName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Định dạng: {attachmentType.toUpperCase()} {attachmentContent ? '· Đã trích xuất nội dung xem nhanh' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(attachmentName, attachmentUrl, attachmentType, attachmentContent, subject)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem trước</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentName('');
                        setAttachmentUrl('');
                        setAttachmentContent('');
                        setParsedQuestions([]);
                        setUploadStatus(null);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="Gỡ file đính kèm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Offer Azota AI Parse for docx/pdf/txt/json */}
                {(attachmentType === 'docx' || attachmentType === 'pdf' || attachmentType === 'text') && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/70">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {parsedQuestions.length > 0
                        ? `Đã tạo đề thi tương tác gồm ${parsedQuestions.length} câu trắc nghiệm.`
                        : 'File chứa câu hỏi trắc nghiệm? Có thể chuyển thành bài làm tự chấm điểm.'}
                    </span>
                    <button
                      type="button"
                      disabled={isParsingExam}
                      onClick={handleParseAttachedExam}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                    >
                      {isParsingExam ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>{isParsingExam ? 'Đang bóc tách...' : 'Bóc tách trắc nghiệm (Azota AI)'}</span>
                    </button>
                  </div>
                )}

                {parsedQuestions.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/70 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {parsedQuestions.length} câu hỏi trắc nghiệm
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowParsedPreview(!showParsedPreview)}
                          className="text-slate-500 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
                        >
                          {showParsedPreview ? 'Thu gọn' : 'Xem danh sách câu'}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Thời gian:</span>
                        <input
                          type="number"
                          min={5}
                          max={180}
                          value={examDuration}
                          onChange={(e) => setExamDuration(Number(e.target.value) || 45)}
                          className="w-16 px-2 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 tabular-nums"
                        />
                        <span className="text-slate-500">phút</span>
                      </div>
                    </div>

                    {showParsedPreview && (
                      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {parsedQuestions.map((q, idx) => (
                          <div
                            key={q.id || idx}
                            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300"
                          >
                            <span className="font-semibold text-slate-900 dark:text-white">Câu {idx + 1}:</span>{' '}
                            {q.questionText}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Instructions / Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Hướng dẫn & Yêu cầu làm bài
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập hướng dẫn giải bài, phần kiến thức cần ôn hoặc cách thức nộp bài cho học sinh..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Subtasks / Checklist Builder */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Checklist các bước thực hiện cho học sinh (tùy chọn)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSubtaskInput}
                onChange={(e) => setNewSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="VD: Xem lại công thức chương 1, làm câu 1-10..."
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm bước</span>
              </button>
            </div>

            {subtasks.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {subtasks.map((st, idx) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-200 truncate">
                      {idx + 1}. {st.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(st.id)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notification & Options */}
          <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={sendNotification}
                onChange={(e) => setSendNotification(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
              />
              <span>Gửi thông báo ngay đến học sinh (Hiển thị ở Chuông thông báo & Bảng tin NEWS)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isImportant}
                onChange={(e) => {
                  setIsImportant(e.target.checked);
                  if (e.target.checked) setPinNotification(true);
                }}
                className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
              />
              <span>Đánh dấu nhiệm vụ quan trọng & Ghim thông báo lên đầu</span>
            </label>

            {attachmentName && (
              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={(e) => setSaveToLibrary(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                />
                <span>Đồng thời lưu file đính kèm vào Kho học liệu chung</span>
              </label>
            )}
          </div>

          {/* Submit Bar */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer whitespace-nowrap"
            >
              Đặt lại
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              <span>
                {editingTaskId !== null
                  ? 'Lưu thay đổi nhiệm vụ'
                  : sendNotification
                  ? 'Giao nhiệm vụ & Gửi thông báo'
                  : 'Giao nhiệm vụ'}
              </span>
            </button>
          </div>
        </form>

        {/* RIGHT COLUMN (5 cols): Assigned Tasks History & Monitoring */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Nhiệm vụ đã giao
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {filteredTasks.length} nhiệm vụ hiển thị
              </p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên bài tập, môn, lớp..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'has_file', label: 'Có file đề' },
                { id: 'important', label: 'Quan trọng' },
                { id: 'pending', label: 'Đang mở' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setListFilter(tab.id as any)}
                  className={`flex-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                    listFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Assigned Tasks */}
          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => {
                const linkedExam = task.linkedExamId ? exams.find((e) => e.id === task.linkedExamId) : null;
                return (
                  <div
                    key={task.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700 transition space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                          {task.t}
                        </h3>
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>{task.sub || 'Tổng hợp'}</span>
                          {task.targetClassName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{task.targetClassName}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>
                            Hạn: {task.due}
                            {task.dueTime ? ` ${task.dueTime}` : ''}
                          </span>
                          {(task.hi || task.priority === 'high') && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">Quan trọng</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {task.note && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {task.note}
                      </p>
                    )}

                    {/* Attachment & Linked Exam Indicators */}
                    {(task.attachmentName || linkedExam) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {task.attachmentName && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenPreview(
                                task.attachmentName!,
                                task.attachmentUrl,
                                task.attachmentType,
                                task.attachmentContent,
                                task.sub
                              )
                            }
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:border-emerald-500 transition cursor-pointer max-w-full"
                          >
                            <Paperclip className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[180px]">{task.attachmentName}</span>
                          </button>
                        )}
                        {linkedExam && (
                          <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 tabular-nums">
                            Đề trắc nghiệm ({linkedExam.questions.length} câu)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => onResendNotice(task)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        <BellRing className="w-3 h-3" />
                        <span>Nhắc lại qua Thông báo</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleLoadTaskForEdit(task)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer"
                          title="Chỉnh sửa nhiệm vụ"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTask(task.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Xóa nhiệm vụ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <ClipboardList className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Chưa có nhiệm vụ nào phù hợp
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Hãy điền thông tin và kéo thả file đề ở khung bên trái để giao bài tập đầu tiên cho học sinh.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      <DocumentViewerModal item={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
};
