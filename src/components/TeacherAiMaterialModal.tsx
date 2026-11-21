import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Wand2, Save, UploadCloud, FileText, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { LibraryItem } from '../types';

interface TeacherAiMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveResource: (item: Omit<LibraryItem, 'id'>) => void;
  defaultSubject?: string;
  teacherName?: string;
}

interface UploadedMaterialFile {
  fileName: string;
  fileUrl: string;
  fileType: 'pdf' | 'image' | 'text' | 'link';
  extractedText: string;
  sizeLabel: string;
}

export const TeacherAiMaterialModal: React.FC<TeacherAiMaterialModalProps> = ({
  isOpen,
  onClose,
  onSaveResource,
  teacherName = 'Giáo viên'
}) => {
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [topic, setTopic] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [title, setTitle] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Drag & Drop File Upload states
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedMaterialFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = async (file: File) => {
    setIsUploadingFile(true);
    setErrorMsg(null);

    try {
      const lowerName = file.name.toLowerCase();
      let localText = '';
      if (
        file.type.startsWith('text/') ||
        /\.(txt|md|csv|json)$/i.test(lowerName)
      ) {
        try {
          localText = await file.text();
        } catch {
          // ignore local text read error
        }
      }

      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Không thể đọc tệp từ thiết bị.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/upload-assignment-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileBase64
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Tải tệp lên thất bại.');
      }

      const mappedType: 'pdf' | 'image' | 'text' | 'link' =
        data.attachmentType === 'pdf'
          ? 'pdf'
          : data.attachmentType === 'image'
            ? 'image'
            : data.attachmentType === 'text' || data.attachmentType === 'docx'
              ? 'text'
              : 'link';

      const extracted = (data.extractedText || localText || '').trim();

      setUploadedFile({
        fileName: data.fileName || file.name,
        fileUrl: data.fileUrl,
        fileType: mappedType,
        extractedText: extracted,
        sizeLabel: formatFileSize(file.size)
      });

      if (!title) {
        setTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tải tệp lên. Vui lòng thử lại.');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim() && !uploadedFile) {
      setErrorMsg('Vui lòng nhập Tên bài học / Chuyên đề hoặc tải lên một tệp tài liệu.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    const effectiveTopic = topic.trim() || uploadedFile?.fileName.replace(/\.[^.]+$/, '') || 'Tài liệu học tập';

    try {
      const res = await fetch('/api/ai/generate-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject || undefined,
          grade: grade || undefined,
          topic: effectiveTopic,
          materialType: materialType || undefined,
          sourceContent: uploadedFile?.extractedText || undefined,
          sourceFileName: uploadedFile?.fileName || undefined
        })
      });

      const data = await res.json();
      if (data.content) {
        setGeneratedContent(data.content);
        const metaParts = [subject, grade ? `Khối ${grade}` : ''].filter(Boolean).join(' ');
        setTitle(metaParts ? `Học liệu: ${effectiveTopic} (${metaParts})` : `Học liệu: ${effectiveTopic}`);
      } else {
        throw new Error('Lỗi dữ liệu.');
      }
    } catch {
      const fallbackHeaderParts = [
        subject ? `**Môn:** ${subject}` : '',
        grade ? `**Khối:** ${grade}` : '',
        materialType ? `**Phân loại:** ${materialType}` : ''
      ].filter(Boolean).join(' | ');

      const fallback = `# 📖 HỌC LIỆU: ${effectiveTopic.toUpperCase()}
${fallbackHeaderParts ? fallbackHeaderParts + '\n' : ''}**Biên soạn:** ${teacherName}

---

${uploadedFile?.extractedText ? `## NỘI DUNG TỪ TÀI LIỆU NGUỒN (${uploadedFile.fileName})\n${uploadedFile.extractedText.slice(0, 3000)}\n\n---\n\n` : ''}## 1. MỤC TIÊU CẦN ĐẠT
- Nắm chắc các khái niệm và kiến thức trọng tâm của chuyên đề ${effectiveTopic}.
- Biết cách vận dụng lý thuyết để giải quyết các dạng bài tập từ cơ bản đến nâng cao.

## 2. LƯU Ý PHÂN HÓA HỌC SINH
- **Học sinh cơ bản:** Nắm vững định nghĩa, công thức nền tảng và bài tập 1 bước.
- **Học sinh khá - giỏi:** Rèn luyện phân tích đề, kết hợp nhiều bước suy luận và bài tập tổng hợp.`;
      setGeneratedContent(fallback);
      setTitle(`Học liệu: ${effectiveTopic}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToLibrary = () => {
    if (!generatedContent.trim() && !uploadedFile) return;

    const effectiveTitle =
      title.trim() ||
      (topic.trim() ? `Học liệu: ${topic.trim()}` : '') ||
      uploadedFile?.fileName.replace(/\.[^.]+$/, '') ||
      'Học liệu mới';

    const descParts = [
      materialType || (uploadedFile ? `Tệp đính kèm: ${uploadedFile.fileName}` : 'Học liệu'),
      grade ? `dành cho học sinh khối ${grade}` : ''
    ].filter(Boolean);

    onSaveResource({
      t: effectiveTitle,
      sub: subject || 'Khác',
      type: 'Tài liệu',
      d: `${descParts.join(' ')}, biên soạn bởi ${teacherName}.`,
      url: uploadedFile?.fileUrl || undefined,
      fileName: uploadedFile?.fileName || undefined,
      fileType: generatedContent.trim() ? 'text' : (uploadedFile?.fileType || 'link'),
      fileContent: generatedContent.trim() || uploadedFile?.extractedText || undefined,
      fav: true
    });

    setSubject('');
    setGrade('');
    setTopic('');
    setMaterialType('');
    setGeneratedContent('');
    setTitle('');
    setUploadedFile(null);
    onClose();
  };

  const canSave = Boolean(generatedContent.trim() || uploadedFile);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-white dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>AI Tạo học liệu theo Chương</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                  Gemini Pro
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Soạn bài giảng, đề cương và phiếu bài tập phân hóa tự động
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Môn học
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value=""></option>
                <option value="Toán học">Toán học</option>
                <option value="Vật lí">Vật lí</option>
                <option value="Hóa học">Hóa học</option>
                <option value="Sinh học">Sinh học</option>
                <option value="Ngữ văn">Ngữ văn</option>
                <option value="Tiếng Anh">Tiếng Anh</option>
                <option value="Lịch sử">Lịch sử</option>
                <option value="Địa lí">Địa lí</option>
                <option value="Tin học">Tin học</option>
                <option value="GDCD">GDCD</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Khối lớp
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value=""></option>
                <option value="12">Lớp 12</option>
                <option value="11">Lớp 11</option>
                <option value="10">Lớp 10</option>
                <option value="9">Lớp 9</option>
                <option value="8">Lớp 8</option>
                <option value="7">Lớp 7</option>
                <option value="6">Lớp 6</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Định dạng học liệu
              </label>
              <select
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value=""></option>
                <option value="Tóm tắt lý thuyết & Sơ đồ tư duy">Tóm tắt lý thuyết & Sơ đồ</option>
                <option value="Bảng công thức & Bài tập ví dụ mẫu">Bảng công thức & Bài mẫu</option>
                <option value="Phiếu bài tập phân hóa 3 mức độ">Phiếu bài tập phân hóa</option>
                <option value="Giáo án & Câu hỏi phát vấn">Giáo án & Câu hỏi phát vấn</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tên bài học / Chuyên đề
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Drag & Drop File Upload Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tải tệp tài liệu lên
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
                e.target.value = '';
              }}
            />

            {!uploadedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isUploadingFile && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 scale-[1.01]'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-slate-800/70'
                }`}
              >
                {isUploadingFile ? (
                  <div className="flex flex-col items-center gap-2 py-1">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Đang tải và xử lý tệp...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Kéo thả tệp vào đây, hoặc <span className="text-emerald-600 dark:text-emerald-400 underline">bấm để chọn tệp</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Hỗ trợ PDF, Word (.docx), TXT, MD, CSV, JSON, Ảnh
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/25">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {uploadedFile.fileName}
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      {uploadedFile.sizeLabel}
                      {uploadedFile.extractedText ? ` · Đã trích xuất ${uploadedFile.extractedText.length} ký tự` : ' · Đã đính kèm'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition cursor-pointer"
                  >
                    Đổi tệp
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                    title="Xóa tệp"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isLoading || isUploadingFile}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>AI đang biên soạn tài liệu...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>✨ AI Biên soạn học liệu</span>
                </>
              )}
            </button>
          </div>

          {generatedContent && (
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-slate-900 dark:text-white">
                Bản xem trước tài liệu:
              </label>
              <textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                rows={10}
                className="w-full p-3 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
          <p className="text-xs text-slate-400">
            Học liệu sau khi lưu sẽ có thể xem trực tiếp hoặc tải về
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Đóng
            </button>
            <button
              onClick={handleSaveToLibrary}
              disabled={!canSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Lưu vào Thư viện học liệu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

