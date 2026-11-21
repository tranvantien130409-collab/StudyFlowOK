import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Star,
  ExternalLink,
  Edit3,
  Trash2,
  Search,
  X,
  FileText,
  Paperclip,
  Check,
  Eye,
  FileCode,
  Image as ImageIcon,
  FolderOpen,
  Save,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { LibraryItem, UserRole } from '../types';
import { DocumentViewerModal } from './DocumentViewerModal';
import { loadUiPreferences, updateStudentUiPreferences, updateTeacherUiPreferences } from '../utils/uiPreferences';
import { AnimatePresence, motion } from 'motion/react';

interface LibraryViewProps {
  library: LibraryItem[];
  role: UserRole;
  onAddResource: (item: Omit<LibraryItem, 'id'>) => void;
  onUpdateResource: (item: LibraryItem) => void;
  onDeleteResource: (id: number) => void;
  onToggleFavorite: (id: number) => void;
  onSavePermanent?: () => void;
  initialSearch?: string;
  teacherPrivateLibrary?: LibraryItem[];
  onAddPrivateResource?: (item: Omit<LibraryItem, 'id'>) => void;
  onUpdatePrivateResource?: (item: LibraryItem) => void;
  onDeletePrivateResource?: (id: number) => void;
  onTogglePrivateFavorite?: (id: number) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  library,
  role,
  onAddResource,
  onUpdateResource,
  onDeleteResource,
  onToggleFavorite,
  onSavePermanent,
  initialSearch = '',
  teacherPrivateLibrary = [],
  onAddPrivateResource,
  onUpdatePrivateResource,
  onDeletePrivateResource,
  onTogglePrivateFavorite
}) => {
  const isTeacher = role === 'teacher';
  const hasPrivateVault = isTeacher && Boolean(onAddPrivateResource);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedSubject, setSelectedSubject] = useState<string>(() => {
    const prefs = loadUiPreferences();
    return role === 'teacher' ? prefs.teacher.materialsSelectedSubject : prefs.student.librarySelectedSubject;
  });

  const [teacherScope, setTeacherScope] = useState<'all' | 'private' | 'shared'>(() => {
    const prefs = loadUiPreferences();
    return prefs.teacher.materialsScope || 'all';
  });
  const [selectedVaultGrade, setSelectedVaultGrade] = useState<string>('Tất cả Toán');

  useEffect(() => {
    if (role === 'teacher') {
      updateTeacherUiPreferences({
        materialsSelectedSubject: selectedSubject,
        materialsScope: teacherScope
      });
    } else {
      updateStudentUiPreferences({ librarySelectedSubject: selectedSubject });
    }
  }, [role, selectedSubject, teacherScope]);

  // Preview Document Modal state
  const [viewingItem, setViewingItem] = useState<LibraryItem | null>(null);

  // Add / Edit Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [modalTarget, setModalTarget] = useState<'shared' | 'private'>('shared');
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formGradeLevel, setFormGradeLevel] = useState('Toán 12');
  const [formType, setFormType] = useState('Ghi chú');
  const [formDesc, setFormDesc] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [formFileContent, setFormFileContent] = useState('');
  const [formFileType, setFormFileType] = useState<'pdf' | 'image' | 'text' | 'video' | 'audio' | 'link'>('text');

  // Extract subjects for shared library
  const subjects = ['Tất cả', '★ Yêu thích', ...Array.from(new Set(library.map((l) => l.sub).filter(Boolean)))];

  // Extract grade levels for private Math vault
  const vaultGrades = [
    'Tất cả Toán',
    ...Array.from(new Set(teacherPrivateLibrary.map((l) => l.gradeLevel).filter(Boolean) as string[])),
    '★ Yêu thích'
  ];

  const handleOpenAddModal = (target: 'shared' | 'private' = 'shared') => {
    setEditingItem(null);
    setModalTarget(target);
    setFormTitle('');
    setFormSubject(target === 'private' ? 'Toán' : '');
    setFormGradeLevel('Toán 12');
    setFormType(target === 'private' ? 'Tài liệu' : 'Ghi chú');
    setFormDesc('');
    setFormUrl('');
    setFormFileName('');
    setFormFileContent('');
    setFormFileType('text');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: LibraryItem, target: 'shared' | 'private' = 'shared') => {
    setEditingItem(item);
    setModalTarget(target);
    setFormTitle(item.t);
    setFormSubject(item.sub);
    setFormGradeLevel(item.gradeLevel || 'Toán 12');
    setFormType(item.type);
    setFormDesc(item.d);
    setFormUrl(item.url || '');
    setFormFileName(item.fileName || '');
    setFormFileContent(item.fileContent || '');
    setFormFileType(item.fileType || 'text');
    setIsModalOpen(true);
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    let processedUrl = formUrl.trim();
    if (processedUrl && !/^https?:\/\//i.test(processedUrl) && !processedUrl.startsWith('data:')) {
      processedUrl = 'https://' + processedUrl;
    }

    const isPrivateSave = hasPrivateVault && modalTarget === 'private';

    if (editingItem) {
      const updatedPayload: LibraryItem = {
        ...editingItem,
        t: formTitle.trim(),
        sub: formSubject.trim() || (isPrivateSave ? 'Toán' : 'Khác'),
        gradeLevel: isPrivateSave ? formGradeLevel.trim() || undefined : editingItem.gradeLevel,
        type: formType,
        d: formDesc.trim() || 'Chưa có mô tả chi tiết.',
        url: processedUrl,
        fileName: formFileName.trim() || undefined,
        fileContent: formFileContent.trim() || undefined,
        fileType: formFileType
      };
      if (isPrivateSave && onUpdatePrivateResource) {
        onUpdatePrivateResource(updatedPayload);
      } else {
        onUpdateResource(updatedPayload);
      }
    } else {
      const newPayload: Omit<LibraryItem, 'id'> = {
        t: formTitle.trim(),
        sub: formSubject.trim() || (isPrivateSave ? 'Toán' : 'Khác'),
        gradeLevel: isPrivateSave ? formGradeLevel.trim() || undefined : undefined,
        type: formType,
        d: formDesc.trim() || 'Chưa có mô tả chi tiết.',
        url: processedUrl,
        fav: false,
        fileName: formFileName.trim() || undefined,
        fileContent: formFileContent.trim() || undefined,
        fileType: formFileType
      };
      if (isPrivateSave && onAddPrivateResource) {
        onAddPrivateResource(newPayload);
      } else {
        onAddResource(newPayload);
      }
    }

    setIsModalOpen(false);
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormFileName(file.name);
    const fname = file.name.toLowerCase();

    if (file.type.includes('pdf') || fname.endsWith('.pdf')) {
      setFormFileType('pdf');
    } else if (file.type.includes('image') || fname.match(/\.(png|jpe?g|gif|webp|svg)$/)) {
      setFormFileType('image');
    } else if (file.type.includes('video') || fname.match(/\.(mp4|webm)$/)) {
      setFormFileType('video');
    } else if (file.type.includes('text') || fname.match(/\.(txt|md|csv)$/)) {
      setFormFileType('text');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormUrl(result);

      if (file.type.includes('text') || fname.endsWith('.txt') || fname.endsWith('.md')) {
        setFormFileContent(result);
      }
    };

    if (file.type.includes('text') || fname.endsWith('.txt') || fname.endsWith('.md')) {
      const textReader = new FileReader();
      textReader.onload = (te) => {
        setFormFileContent(te.target?.result as string);
      };
      textReader.readAsText(file);
    }

    reader.readAsDataURL(file);
  };

  const matchesSearch = (item: LibraryItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.t.toLowerCase().includes(q) ||
      item.sub.toLowerCase().includes(q) ||
      item.d.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      (item.gradeLevel || '').toLowerCase().includes(q)
    );
  };

  // Filter private teacher vault
  const filteredPrivateVault = teacherPrivateLibrary.filter((item) => {
    if (selectedVaultGrade === '★ Yêu thích') {
      if (!item.fav) return false;
    } else if (selectedVaultGrade !== 'Tất cả Toán' && item.gradeLevel !== selectedVaultGrade) {
      return false;
    }
    return matchesSearch(item);
  });

  // Filter shared library
  const filteredLibrary = library.filter((item) => {
    if (selectedSubject === '★ Yêu thích') {
      if (!item.fav) return false;
    } else if (selectedSubject !== 'Tất cả' && item.sub !== selectedSubject) {
      return false;
    }
    return matchesSearch(item);
  });

  const totalFavorites = library.filter((l) => l.fav).length;
  const totalPrivatePermanent = teacherPrivateLibrary.filter((l) => l.isPermanent).length;
  const showPrivateSection = hasPrivateVault && (teacherScope === 'all' || teacherScope === 'private');
  const showSharedSection = !hasPrivateVault || teacherScope === 'all' || teacherScope === 'shared';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <AnimatePresence mode="wait" initial={false}>
        {viewingItem ? (
          <motion.div
            key={`doc-page-${viewingItem.id}`}
            initial={{ opacity: 0, y: 10, scale: 0.996 }}
            animate={{ opacity: 1, y: 0, scale: 1, transitionEnd: { transform: 'none' } }}
            exit={{ opacity: 0, y: -8, scale: 0.996 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <DocumentViewerModal
              item={viewingItem}
              isPage={true}
              onClose={() => setViewingItem(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="library-catalog"
            initial={{ opacity: 0, y: 10, scale: 0.996 }}
            animate={{ opacity: 1, y: 0, scale: 1, transitionEnd: { transform: 'none' } }}
            exit={{ opacity: 0, y: -8, scale: 0.996 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* 1. TOP HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-700 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-cyan-400/40 shrink-0">
                  <BookOpen className="w-6 h-6 text-cyan-200" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 dark:from-white dark:via-cyan-100 dark:to-blue-200 bg-clip-text text-transparent tracking-tight">
                    {isTeacher ? 'Kho học liệu giáo viên' : 'Library'}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isTeacher ? (
                      <>
                        <span>Kho tài liệu riêng lưu cố định môn Toán</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{teacherPrivateLibrary.length} tài liệu riêng</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{library.length} học liệu chung</span>
                      </>
                    ) : (
                      <>
                        <span>Lưu trữ ghi chú, đề thi mẫu, công thức và liên kết học liệu</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{library.length} tài liệu</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{totalFavorites} yêu thích</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
                {onSavePermanent && (
                  <button
                    type="button"
                    onClick={onSavePermanent}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700/60 rounded-xl transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                    title="Lưu cố định toàn bộ học liệu lên máy chủ"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu cố định</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenAddModal(hasPrivateVault && teacherScope === 'private' ? 'private' : 'shared')}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:via-cyan-500 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-cyan-600/30 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{hasPrivateVault && teacherScope === 'private' ? 'Thêm vào kho riêng' : 'Thêm tài liệu'}</span>
                </button>
              </div>
            </div>

            {/* 2. TEACHER SCOPE SWITCHER + GLOBAL SEARCH */}
            <div className="space-y-3.5">
              {hasPrivateVault && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div
                    role="tablist"
                    aria-label="Phạm vi kho tài liệu"
                    className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-[#071328] border border-slate-200/90 dark:border-cyan-500/20"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={teacherScope === 'all'}
                      onClick={() => setTeacherScope('all')}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        teacherScope === 'all'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-cyan-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Tất cả ({teacherPrivateLibrary.length + library.length})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={teacherScope === 'private'}
                      onClick={() => setTeacherScope('private')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        teacherScope === 'private'
                          ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-cyan-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Kho riêng giáo viên ({teacherPrivateLibrary.length})</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={teacherScope === 'shared'}
                      onClick={() => setTeacherScope('shared')}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        teacherScope === 'shared'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-cyan-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Học liệu chung ({library.length})
                    </button>
                  </div>
                </div>
              )}

              <div className="relative">
                <Search className="w-4 h-4 text-cyan-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isTeacher
                      ? 'Tìm kiếm trong kho riêng môn Toán hoặc học liệu chung (VD: Tích phân, Oxyz, Lượng giác)...'
                      : 'Tìm theo tên bài học, môn học, công thức hoặc loại tài liệu...'
                  }
                  className="w-full pl-11 pr-4 py-3 text-xs sm:text-sm bg-white/80 dark:bg-[#060c18]/90 backdrop-blur-md border border-slate-200/90 dark:border-cyan-500/25 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-400 shadow-sm transition-all"
                />
              </div>
            </div>

            {/* 3. TEACHER PRIVATE REPOSITORY (PERMANENT MATH VAULT) */}
            {showPrivateSection && (
              <section
                aria-labelledby="teacher-private-vault-heading"
                className="rounded-3xl bg-white/90 dark:bg-[#071328]/90 border border-slate-200/90 dark:border-cyan-500/25 p-5 sm:p-6 space-y-5 shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-700/60 text-indigo-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h2
                        id="teacher-private-vault-heading"
                        className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight"
                      >
                        Kho tài liệu riêng của giáo viên
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-cyan-300">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Chỉ hiển thị cho giáo viên
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">Lưu cố định {totalPrivatePermanent} tài liệu môn Toán</span>
                        <span aria-hidden="true">·</span>
                        <span>Không tự động xóa khi đặt lại dữ liệu</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAddModal('private')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-cyan-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 border border-indigo-200 dark:border-cyan-500/30 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start md:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Lưu thêm vào kho riêng</span>
                  </button>
                </div>

                {/* Grade / Topic Filter Buttons for Private Vault */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {vaultGrades.map((grade) => {
                    const isSelected = selectedVaultGrade === grade;
                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => setSelectedVaultGrade(grade)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
                        }`}
                      >
                        {grade}
                      </button>
                    );
                  })}
                </div>

                {/* Private Vault Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPrivateVault.length > 0 ? (
                    filteredPrivateVault.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-2xl bg-slate-50/70 dark:bg-[#050d1d] border border-slate-200/90 dark:border-slate-800 p-5 flex flex-col justify-between group hover:border-cyan-500/50 transition-colors"
                      >
                        <div>
                          {/* Clean Unboxed Metadata Line + Star Toggle */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 min-w-0 truncate">
                              <span className="text-indigo-700 dark:text-cyan-300 font-bold">
                                {item.gradeLevel || item.sub}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                <Lock className="w-3 h-3" />
                                {item.isPermanent ? 'Lưu cố định' : 'Kho riêng'}
                              </span>
                            </div>

                            {onTogglePrivateFavorite && (
                              <button
                                type="button"
                                onClick={() => onTogglePrivateFavorite(item.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer shrink-0"
                                title={item.fav ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    item.fav ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
                                  }`}
                                />
                              </button>
                            )}
                          </div>

                          <h3 className="text-sm sm:text-[15px] font-extrabold text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors leading-snug line-clamp-2">
                            {item.t}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed line-clamp-3">
                            {item.d}
                          </p>
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5 truncate">
                            <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-cyan-400 shrink-0" />
                            <span>{item.sub}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{item.type}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              data-sound="nav"
                              onClick={() => setViewingItem(item)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-blue-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              title="Xem tài liệu môn Toán trực tiếp"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Xem</span>
                            </button>

                            {item.url && !item.url.startsWith('data:') && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Mở liên kết gốc"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item, 'private')}
                              className="p-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Chỉnh sửa ghi chú / nội dung"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {!item.isPermanent && onDeletePrivateResource && (
                              <button
                                type="button"
                                onClick={() => onDeletePrivateResource(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Xóa tài liệu tùy chỉnh"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="col-span-full py-10 text-center space-y-2">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        Không có tài liệu Toán nào khớp bộ lọc hiện tại
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Chọn "Tất cả Toán" hoặc xóa từ khóa tìm kiếm để xem lại toàn bộ tài liệu cố định.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 4. SHARED LIBRARY SECTION */}
            {showSharedSection && (
              <section className="space-y-4">
                {hasPrivateVault && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                        Kho học liệu chung
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Học liệu chia sẻ theo từng môn học và các bài giảng được tạo bởi AI
                      </p>
                    </div>
                  </div>
                )}

                {/* Subject Filter Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {subjects.map((sub) => {
                    const isSelected = selectedSubject === sub;
                    const isFav = sub === '★ Yêu thích';
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSelectedSubject(sub)}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                          isSelected
                            ? isFav
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                              : 'bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 text-white shadow-sm'
                            : 'bg-white/80 dark:bg-[#071328]/80 border border-slate-200/80 dark:border-cyan-500/20 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:border-cyan-500/40'
                        }`}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>

                {/* Shared Resource Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {filteredLibrary.length > 0 ? (
                    filteredLibrary.map((item) => (
                      <article
                        key={item.id}
                        className="library-card-glass rounded-3xl p-5 sm:p-6 flex flex-col justify-between group relative overflow-hidden"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                              {item.sub} · {item.type}
                            </span>

                            <button
                              type="button"
                              onClick={() => onToggleFavorite(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                              title={item.fav ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  item.fav ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
                                }`}
                              />
                            </button>
                          </div>

                          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors leading-snug line-clamp-2">
                            {item.t}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed line-clamp-3">
                            {item.d}
                          </p>
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-cyan-500/15 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 truncate">
                            {item.fileType === 'pdf' ? (
                              <div className="w-5 h-5 rounded-md bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0 border border-rose-500/30">
                                <FileText className="w-3 h-3" />
                              </div>
                            ) : item.fileType === 'image' ? (
                              <div className="w-5 h-5 rounded-md bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/30">
                                <ImageIcon className="w-3 h-3" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-md bg-cyan-500/15 text-cyan-500 flex items-center justify-center shrink-0 border border-cyan-500/30">
                                <FileCode className="w-3 h-3" />
                              </div>
                            )}
                            <span className="font-bold text-slate-600 dark:text-slate-300">{item.type}</span>
                            {item.fileName && <span className="truncate text-slate-400">· {item.fileName}</span>}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              data-sound="nav"
                              onClick={() => setViewingItem(item)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:via-cyan-500 hover:to-teal-400 text-white rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                              title="Xem tài liệu trực tiếp trên trang"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Xem</span>
                            </button>

                            {item.url && !item.url.startsWith('data:') && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 rounded-xl transition"
                                title="Mở liên kết gốc"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item, 'shared')}
                              className="p-1.5 text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 rounded-xl transition cursor-pointer"
                              title="Chỉnh sửa tài liệu"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteResource(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                              title="Xóa tài liệu"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="col-span-full library-card-glass rounded-3xl py-16 px-6 text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 text-cyan-500 flex items-center justify-center mx-auto border border-cyan-500/30">
                        <FolderOpen className="w-7 h-7" />
                      </div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white">
                        Không tìm thấy tài liệu phù hợp
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Không tìm thấy học liệu nào phù hợp với bộ lọc hiện tại. Bạn có thể thêm tài liệu mới hoặc chọn bộ lọc môn khác.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 5. ADD / EDIT RESOURCE MODAL */}
            {isModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xl">
                <div className="calendar-modal-shadow animate-modal-spring relative w-full max-w-lg bg-white/95 dark:bg-[#071328]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-cyan-500/30 rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-cyan-500/15 mb-4">
                    <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-500 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                        {modalTarget === 'private' ? <Lock className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                      </div>
                      <span>
                        {editingItem
                          ? 'Chỉnh sửa tài liệu học tập'
                          : modalTarget === 'private'
                          ? 'Lưu tài liệu vào Kho riêng giáo viên'
                          : 'Thêm tài liệu học tập mới'}
                      </span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-8 h-8 rounded-full border border-slate-200/80 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveResource} className="space-y-4">
                    {/* Destination toggle when Teacher creates a new item */}
                    {hasPrivateVault && !editingItem && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Nơi lưu trữ tài liệu
                        </label>
                        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setModalTarget('private');
                              if (!formSubject.trim()) setFormSubject('Toán');
                            }}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              modalTarget === 'private'
                                ? 'bg-white dark:bg-[#071328] text-indigo-700 dark:text-cyan-300 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Kho riêng giáo viên</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalTarget('shared')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              modalTarget === 'shared'
                                ? 'bg-white dark:bg-[#071328] text-slate-900 dark:text-cyan-300 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Học liệu chung</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Tiêu đề tài liệu *
                      </label>
                      <input
                        type="text"
                        required
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Ví dụ: Chuyên đề Khảo sát hàm số Toán 12..."
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50/80 dark:bg-[#040c1a]/80 border border-slate-200 dark:border-cyan-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Môn học
                        </label>
                        <input
                          type="text"
                          required
                          value={formSubject}
                          onChange={(e) => setFormSubject(e.target.value)}
                          placeholder="Toán, Văn, Anh..."
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50/80 dark:bg-[#040c1a]/80 border border-slate-200 dark:border-cyan-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Thể loại
                        </label>
                        <select
                          value={formType}
                          onChange={(e) => setFormType(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50/80 dark:bg-[#040c1a]/80 border border-slate-200 dark:border-cyan-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner cursor-pointer"
                        >
                          <option value="Giáo án">Giáo án</option>
                          <option value="Ghi chú">Ghi chú</option>
                          <option value="Tài liệu">Tài liệu</option>
                          <option value="Đề thi">Đề thi</option>
                          <option value="Mẫu bài">Mẫu bài</option>
                          <option value="Video">Video bài giảng</option>
                        </select>
                      </div>
                    </div>

                    {modalTarget === 'private' && hasPrivateVault && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Khối lớp / Nhóm chuyên đề
                        </label>
                        <select
                          value={formGradeLevel}
                          onChange={(e) => setFormGradeLevel(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-50/80 dark:bg-[#040c1a]/80 border border-slate-200 dark:border-cyan-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner cursor-pointer"
                        >
                          <option value="Toán 10">Toán 10</option>
                          <option value="Toán 11">Toán 11</option>
                          <option value="Toán 12">Toán 12</option>
                          <option value="Chuyên đề THPT">Chuyên đề THPT</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Mô tả nội dung tóm tắt
                      </label>
                      <input
                        type="text"
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        placeholder="Điểm chính cần ghi nhớ trong tài liệu này..."
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50/80 dark:bg-[#040c1a]/80 border border-slate-200 dark:border-cyan-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          Nội dung chi tiết (Hỗ trợ xem trực tiếp)
                        </label>
                        <span className="text-[10px] text-cyan-500 font-bold">Xem được ngay trong trang</span>
                      </div>
                      <textarea
                        rows={4}
                        value={formFileContent}
                        onChange={(e) => setFormFileContent(e.target.value)}
                        placeholder="Dán nội dung giáo án, định lý, công thức tại đây để xem trực tiếp không cần tải về..."
                        className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50/80 dark:bg-[#040c1a]/80 border border-slate-200 dark:border-cyan-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Tải tệp lên để xem trực tiếp (PDF, Ảnh, Văn bản...)
                      </label>
                      <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-cyan-400/50 dark:border-cyan-500/40 bg-cyan-50/40 dark:bg-cyan-950/20 rounded-xl hover:bg-cyan-50 dark:hover:bg-cyan-950/40 cursor-pointer text-xs text-slate-700 dark:text-slate-300 transition shadow-xs">
                        <Paperclip className="w-4 h-4 text-cyan-500 shrink-0" />
                        <span className="truncate flex-1 font-medium">
                          {formFileName ? `Đã chọn: ${formFileName}` : 'Chọn tệp từ máy tính để nhúng xem trực tiếp'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.md,.csv,.mp4"
                          className="hidden"
                          onChange={handleFileAttach}
                        />
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Hoặc đường dẫn liên kết ngoài (URL)
                      </label>
                      <input
                        type="text"
                        value={formUrl.startsWith('data:') ? '' : formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        placeholder="https://drive.google.com/... hoặc trang web"
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50/80 dark:bg-[#040c1a]/80 border border-slate-200 dark:border-cyan-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-cyan-500/15">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:via-cyan-500 hover:to-teal-400 rounded-xl transition-all shadow-md shadow-cyan-600/30 active:scale-95 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{editingItem ? 'Lưu thay đổi' : 'Lưu tài liệu'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

