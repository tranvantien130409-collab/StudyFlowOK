import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  X,
  ArrowLeft,
  Sparkles,
  Wand2,
  FileCheck,
  UploadCloud,
  FileUp,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  PenLine,
  ClipboardPaste,
  Save,
  ScanText,
  Copy,
  Check,
  Eye,
  Code2,
  ChevronUp,
  Image as ImageIcon
} from 'lucide-react';
import { ExamItem, QuestionItem, TeacherClass } from '../types';
import { ExamReviewEditor, auditQuestion, stripOptionPrefix } from './ExamReviewEditor';

interface TeacherAiExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExam: (exam: ExamItem, options?: { notifyStudents?: boolean }) => void;
  defaultSubject?: string;
  classes?: TeacherClass[];
  isPage?: boolean;
}

const SAMPLE_EXAM_TEXT = `ĐỀ KIỂM TRA CHẤT LƯỢNG MÔN VẬT LÍ LỚP 12
Thời gian làm bài: 45 phút

Câu 1: Một chất điểm dao động điều hòa theo phương trình x = 5cos(4πt + π/3) (cm). Biên độ dao động của chất điểm là:
A. 5 cm
B. 4 cm
C. 10 cm
D. 2,5 cm
Lời giải: Nhìn vào phương trình chuẩn x = A cos(ωt + φ), biên độ A = 5 cm.

Câu 2: Chu kỳ dao động điều hòa của con lắc đơn có chiều dài l tại nơi có gia tốc trọng trường g là:
A. T = 2π√(l/g)
B. T = 2π√(g/l)
C. T = √(l/g)
D. T = 1/(2π)√(l/g)
Lời giải: Công thức chuẩn T = 2π√(l/g).

Câu 3: Khi xảy ra hiện tượng cộng hưởng cơ thì đại lượng nào sau đây đạt giá trị cực đại?
A. Biên độ dao động
B. Tần số dao động
C. Chu kỳ dao động
D. Pha ban đầu
Lời giải: Khi tần số ngoại lực bằng tần số riêng, biên độ dao động cưỡng bức đạt cực đại.

Câu 4: Một sóng cơ học truyền dọc theo trục Ox với phương trình u = 4cos(20πt - πx) (mm). Bước sóng của sóng này là:
A. 2 cm
B. 4 cm
C. 1 cm
D. 0,5 cm
Lời giải: Ta có 2πx/λ = πx => λ = 2 cm.

BẢNG ĐÁP ÁN:
1.A  2.A  3.A  4.A`;

export const TeacherAiExamModal: React.FC<TeacherAiExamModalProps> = ({
  isOpen,
  onClose,
  onSaveExam,
  defaultSubject = 'Vật lí',
  classes = [],
  isPage = false
}) => {
  const resolveClassGrade = (cls: TeacherClass): string => {
    if (cls.grade && cls.grade >= 1 && cls.grade <= 12) return String(cls.grade);
    const match = cls.name.match(/(?:^|\D)(1[0-2]|[1-9])(?:\D|$)/);
    return match ? match[1] : '12';
  };

  const [subject, setSubject] = useState(defaultSubject);
  const [grade, setGrade] = useState(() => (classes.length > 0 ? resolveClassGrade(classes[0]) : '12'));
  const [selectedGradeOrClass, setSelectedGradeOrClass] = useState<string>(() =>
    classes.length > 0 ? `class:${classes[0].id}` : '12'
  );
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [targetClass, setTargetClass] = useState(() =>
    classes.length > 0 ? classes[0].name : 'Tất cả mọi người'
  );
  const [notifyStudents, setNotifyStudents] = useState(true);

  // Matrix percentages
  const [matrixNb, setMatrixNb] = useState(40); // Nhận biết
  const [matrixTh, setMatrixTh] = useState(30); // Thông hiểu
  const [matrixVd, setMatrixVd] = useState(20); // Vận dụng
  const [matrixVdc, setMatrixVdc] = useState(10); // Vận dụng cao

  // Drag & Drop File Đề / File Kiến thức / Nhập thủ công + OCR state
  const [uploadMode, setUploadMode] = useState<'exam_file' | 'knowledge_file' | 'manual'>('exam_file');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parsingStageLabel, setParsingStageLabel] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);
  const [knowledgeContext, setKnowledgeContext] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrMeta, setOcrMeta] = useState<{
    ocrUsed: boolean;
    formulaCount: number;
    pageCount: number;
    source?: string;
  } | null>(null);
  const [showOcrPanel, setShowOcrPanel] = useState(false);
  const [ocrViewMode, setOcrViewMode] = useState<'katex' | 'raw'>('katex');
  const [ocrCopied, setOcrCopied] = useState(false);
  const [uploadedImagePreviews, setUploadedImagePreviews] = useState<Array<{ name: string; dataUrl: string }>>([]);
  const [activeImagePreviewIdx, setActiveImagePreviewIdx] = useState<number>(0);
  const [isPastingText, setIsPastingText] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [uploadNotice, setUploadNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionItem[]>([]);
  const [examTitle, setExamTitle] = useState('');
  const [isReviewConfirmed, setIsReviewConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSubject(defaultSubject || 'Vật lí');
      setErrorMsg(null);
      if (isPage) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [isOpen, defaultSubject, isPage]);

  useEffect(() => {
    if (isOpen) {
      setTopic('');
    }
  }, [isOpen]);

  // Keep Khối lớp selection synced when classes in "Lớp & Học sinh" are created/renamed/deleted
  useEffect(() => {
    if (selectedGradeOrClass.startsWith('class:')) {
      const clsId = selectedGradeOrClass.slice('class:'.length);
      const matched = classes.find((c) => c.id === clsId);
      if (matched) {
        setGrade(resolveClassGrade(matched));
        setTargetClass(matched.name);
      } else if (classes.length > 0) {
        setSelectedGradeOrClass(`class:${classes[0].id}`);
        setGrade(resolveClassGrade(classes[0]));
        setTargetClass(classes[0].name);
      } else {
        setSelectedGradeOrClass('12');
        setGrade('12');
        setTargetClass('Tất cả mọi người');
      }
    } else if (classes.length > 0 && targetClass === 'Tất cả mọi người') {
      // Allow keeping general grade if user intentionally picked it
    }
  }, [classes, selectedGradeOrClass]);

  const selectedLinkedClass = selectedGradeOrClass.startsWith('class:')
    ? classes.find((c) => `class:${c.id}` === selectedGradeOrClass) || null
    : null;

  const subjectOptions = Array.from(
    new Set(
      [
        defaultSubject,
        subject,
        ...classes.map((c) => c.subject).filter(Boolean),
        'Vật lí',
        'Toán',
        'Toán học',
        'Hóa học',
        'Sinh học',
        'Lịch sử',
        'Địa lí',
        'Tiếng Anh',
        'Ngữ văn',
        'Tin học',
        'GDCD'
      ].filter(Boolean)
    )
  );

  const handleGradeOrClassChange = (value: string) => {
    setSelectedGradeOrClass(value);
    if (value.startsWith('class:')) {
      const clsId = value.slice('class:'.length);
      const cls = classes.find((c) => c.id === clsId);
      if (cls) {
        setGrade(resolveClassGrade(cls));
        setTargetClass(cls.name);
        if (cls.subject && cls.subject.trim()) {
          setSubject(cls.subject.trim());
        }
      }
    } else {
      setGrade(value);
      setTargetClass('Tất cả mọi người');
    }
  };

  if (!isOpen) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const buildFallbackQuestions = (customTopic?: string): QuestionItem[] => {
    const topicLabel = customTopic || topic || subject;
    return [
      {
        id: 1,
        questionText: `Một chất điểm dao động điều hòa theo phương trình x = 5cos(4πt + π/3) (cm). Biên độ dao động của chất điểm là:`,
        options: ['A. 5 cm', 'B. 4 cm', 'C. 10 cm', 'D. 2,5 cm'],
        correctOption: 0,
        explanation: 'Nhìn vào phương trình chuẩn x = A cos(ωt + φ), ta thấy biên độ A = 5 cm.'
      },
      {
        id: 2,
        questionText: `Chu kỳ dao động điều hòa của con lắc đơn có chiều dài l tại nơi có gia tốc trọng trường g là:`,
        options: ['A. T = 2π√(l/g)', 'B. T = 2π√(g/l)', 'C. T = √(l/g)', 'D. T = 1/(2π)√(l/g)'],
        correctOption: 0,
        explanation: 'Công thức tính chu kỳ con lắc đơn là T = 2π√(l/g).'
      },
      {
        id: 3,
        questionText: `Khi xảy ra hiện tượng cộng hưởng cơ thì đại lượng nào sau đây của hệ dao động đạt giá trị cực đại?`,
        options: ['A. Biên độ dao động', 'B. Tần số dao động', 'C. Chu kỳ dao động', 'D. Pha ban đầu'],
        correctOption: 0,
        explanation: 'Khi tần số ngoại lực bằng tần số dao động riêng, hiện tượng cộng hưởng xảy ra và biên độ dao động cưỡng bức đạt giá trị cực đại.'
      },
      {
        id: 4,
        questionText: `Một sóng cơ học truyền dọc theo trục Ox với phương trình u = 4cos(20πt - πx) (mm). Bước sóng của sóng này là:`,
        options: ['A. 2 cm', 'B. 4 cm', 'C. 1 cm', 'D. 0,5 cm'],
        correctOption: 0,
        explanation: 'Ta có 2πx/λ = πx => λ = 2 cm.'
      },
      {
        id: 5,
        questionText: `Câu hỏi vận dụng chuyên đề "${topicLabel}": Một con lắc lò xo gồm lò xo nhẹ k = 100 N/m và vật m = 100 g. Tần số góc dao động riêng của con lắc là:`,
        options: ['A. 31,6 rad/s', 'B. 10 rad/s', 'C. 100 rad/s', 'D. 1 rad/s'],
        correctOption: 0,
        explanation: 'ω = √(k/m) = √(100 / 0.1) = √1000 ≈ 31,6 rad/s.'
      }
    ].slice(0, questionCount);
  };

  const scrollToReviewStudio = () => {
    window.setTimeout(() => {
      reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  const handleGenerate = async (overrideTopic?: string, overrideKnowledgeContent?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    const activeKnowledge = overrideKnowledgeContent ?? knowledgeContext;
    const rawTopic = (overrideTopic ?? topic).trim();
    const activeTopic = rawTopic || subject;
    const titleScope = selectedLinkedClass ? selectedLinkedClass.name : `Khối ${grade}`;
    const generatedTitle = rawTopic
      ? `Đề kiểm tra ${subject} ${titleScope} - ${rawTopic}`
      : `Đề kiểm tra ${subject} ${titleScope}`;
    try {
      const res = await fetch('/api/ai/generate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          grade,
          topic: activeTopic,
          knowledgeContent: activeKnowledge || undefined,
          count: questionCount,
          durationMinutes,
          matrix: { nb: matrixNb, th: matrixTh, vd: matrixVd, vdc: matrixVdc }
        })
      });

      const data = await res.json();
      if (data.questions && Array.isArray(data.questions)) {
        setGeneratedQuestions(data.questions);
        setExamTitle(generatedTitle);
        setIsReviewConfirmed(false);
        scrollToReviewStudio();
      } else {
        throw new Error('Không nhận được câu hỏi hợp lệ.');
      }
    } catch (err: any) {
      console.warn('API error, using local generator:', err);
      setGeneratedQuestions(buildFallbackQuestions(rawTopic || undefined));
      setExamTitle(generatedTitle);
      setIsReviewConfirmed(false);
      scrollToReviewStudio();
    } finally {
      setIsLoading(false);
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Không thể đọc tệp "${file.name}" từ thiết bị.`));
      reader.readAsDataURL(file);
    });

  const isOcrCapableFile = (fileName?: string, mimeType?: string) => {
    const lower = (fileName || '').toLowerCase();
    return (
      lower.endsWith('.pdf') ||
      /\.(png|jpe?g|webp|gif|bmp)$/i.test(lower) ||
      Boolean(mimeType?.includes('pdf')) ||
      Boolean(mimeType?.startsWith('image/'))
    );
  };

  // Parse uploaded exam or knowledge file (with automatic OCR for Images & PDFs)
  const sendFileForParsing = async (payload: {
    rawText?: string;
    fileBase64?: string;
    fileName?: string;
    mimeType?: string;
    files?: Array<{ fileBase64: string; fileName: string; mimeType: string }>;
  }) => {
    try {
      const isMultiFile = Array.isArray(payload.files) && payload.files.length > 0;
      const primaryName = payload.fileName || payload.files?.[0]?.fileName || 'tài liệu';
      const ocrTargeted =
        isOcrCapableFile(primaryName, payload.mimeType) ||
        Boolean(payload.files?.some((f) => isOcrCapableFile(f.fileName, f.mimeType)));

      if (uploadMode === 'knowledge_file') {
        const cleanTitle = primaryName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Tài liệu kiến thức';
        let extractedText = payload.rawText || '';
        let formulaCount = 0;
        let pageCount = payload.files?.length || 1;
        let ocrUsed = false;

        if (!extractedText && (payload.fileBase64 || isMultiFile)) {
          setParsingStageLabel(
            ocrTargeted
              ? 'Đang chạy OCR nhận diện văn bản & công thức Toán từ ảnh/PDF...'
              : 'Đang đọc nội dung tài liệu kiến thức...'
          );
          const ocrRes = await fetch('/api/ai/ocr-extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const ocrData = await ocrRes.json();
          if (!ocrRes.ok || !ocrData.success || !ocrData.ocrText) {
            throw new Error(ocrData.error || 'Không thể chạy OCR trích xuất nội dung từ file này.');
          }
          extractedText = String(ocrData.ocrText || '');
          formulaCount = Number(ocrData.formulaCount || 0);
          pageCount = Number(ocrData.pageCount || pageCount);
          ocrUsed = ocrTargeted || ocrData.source === 'gemini_ocr';
          if (ocrData.subject && ocrData.subject !== 'Tổng hợp') {
            setSubject(ocrData.subject);
          }
        }

        const effectiveTitle = cleanTitle;
        setOcrText(extractedText);
        setOcrMeta({ ocrUsed, formulaCount, pageCount, source: ocrUsed ? 'gemini_ocr' : 'text' });
        if (extractedText) setShowOcrPanel(true);
        setKnowledgeContext(extractedText || effectiveTitle);
        setTopic(effectiveTitle);
        setUploadNotice({
          type: 'success',
          message: ocrUsed
            ? `OCR đã trích xuất ${extractedText.length.toLocaleString('vi-VN')} ký tự${formulaCount > 0 ? ` và ${formulaCount} công thức Toán LaTeX` : ''} từ "${primaryName}" — AI đang tự động sinh ${questionCount} câu hỏi bám sát nội dung...`
            : `Đã nạp tài liệu kiến thức "${primaryName}" — AI đang tự động sinh ${questionCount} câu hỏi bám sát nội dung file...`
        });
        setIsParsingFile(false);
        await handleGenerate(effectiveTitle, extractedText || effectiveTitle);
        return;
      }

      setParsingStageLabel(
        ocrTargeted
          ? 'Đang chạy OCR trích xuất văn bản & công thức Toán học từ ảnh/PDF...'
          : 'Đang bóc tách câu hỏi & bảng đáp án chuẩn Azota...'
      );

      const res = await fetch('/api/ai/parse-exam-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (typeof data.ocrText === 'string' && data.ocrText.trim().length > 0) {
        setOcrText(data.ocrText);
        setOcrMeta({
          ocrUsed: Boolean(data.ocrUsed),
          formulaCount: Number(data.formulaCount || 0),
          pageCount: Number(data.pageCount || payload.files?.length || 1),
          source: data.source
        });
        if (data.ocrUsed) {
          setShowOcrPanel(true);
        }
      }

      if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
        const normalized: QuestionItem[] = data.questions.map((q: any, idx: number) => ({
          id: q.id || Date.now() + idx,
          questionText: q.questionText || `Câu hỏi ${idx + 1}`,
          options:
            Array.isArray(q.options) && q.options.length > 0
              ? q.options.map((opt: any) => stripOptionPrefix(String(opt || '')))
              : ['', '', '', ''],
          correctOption:
            typeof q.correctOption === 'number' && q.correctOption >= 0 && q.correctOption <= 3
              ? q.correctOption
              : -1,
          explanation: q.explanation || ''
        }));
        const detectedAnsCount = normalized.filter((q) => q.correctOption >= 0).length;
        const missingAnsCount = normalized.length - detectedAnsCount;
        const formulaCount = Number(data.formulaCount || 0);

        setGeneratedQuestions(normalized);
        setExamTitle(data.title || primaryName.replace(/\.[^/.]+$/, '') || `Đề kiểm tra ${subject}`);
        if (data.subject && data.subject !== 'Tổng hợp') setSubject(data.subject);
        if (data.durationMinutes) setDurationMinutes(Number(data.durationMinutes) || 45);
        setIsPastingText(false);
        setIsReviewConfirmed(false);

        const ocrBadgeInfo = data.ocrUsed
          ? ` (OCR nhận diện${formulaCount > 0 ? ` ${formulaCount} công thức Toán LaTeX` : ' nội dung ảnh/PDF'})`
          : formulaCount > 0
          ? ` (${formulaCount} công thức LaTeX)`
          : '';

        const answerSummary =
          missingAnsCount === 0
            ? `Đã tự động nhận diện sẵn ${detectedAnsCount}/${normalized.length} đáp án.`
            : detectedAnsCount > 0
            ? `Nhận diện sẵn ${detectedAnsCount}/${normalized.length} đáp án — còn ${missingAnsCount} câu chưa có đáp án để Thầy/Cô chọn thêm bên dưới.`
            : `File chưa có bảng đáp án — Thầy/Cô hãy chọn đáp án A/B/C/D cho từng câu hoặc dùng "Nhập bảng đáp án" bên dưới trước khi xuất bản.`;

        setUploadNotice({
          type: 'success',
          message: `Đã bóc tách chính xác ${normalized.length} câu hỏi từ "${primaryName}"${ocrBadgeInfo}. ${answerSummary}`
        });
        scrollToReviewStudio();
      } else {
        throw new Error(data.error || 'Không bóc tách được câu hỏi hợp lệ từ file.');
      }
    } catch (err: any) {
      setUploadNotice({
        type: 'error',
        message: err?.message || 'Không thể phân tích file này. Bạn có thể kiểm tra định dạng Câu 1 / A. B. C. D. hoặc chỉnh sửa văn bản OCR.'
      });
    } finally {
      setIsParsingFile(false);
      setParsingStageLabel('');
    }
  };

  const processUploadedFiles = async (fileList: FileList | File[]) => {
    const selectedFiles = Array.from(fileList || []);
    if (selectedFiles.length === 0) return;

    const sortedFiles = [...selectedFiles].sort((a, b) =>
      a.name.localeCompare(b.name, 'vi', { numeric: true })
    );
    const totalBytes = sortedFiles.reduce((acc, f) => acc + f.size, 0);
    const displayName =
      sortedFiles.length === 1
        ? sortedFiles[0].name
        : `${sortedFiles[0].name} (+${sortedFiles.length - 1} tệp)`;

    setIsParsingFile(true);
    setParsingStageLabel('Đang đọc dữ liệu tệp...');
    setUploadNotice(null);
    setUploadedFileName(displayName);
    setUploadedFileSize(formatFileSize(totalBytes));
    setUploadedImagePreviews([]);
    setActiveImagePreviewIdx(0);

    try {
      // Single JSON / TXT / MD / CSV fast path
      if (sortedFiles.length === 1) {
        const file = sortedFiles[0];
        const fileName = file.name;
        const lower = fileName.toLowerCase();
        const isTxt = lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv');
        const isJson = lower.endsWith('.json');

        if (isJson) {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : null;
          if (list && list.length > 0) {
            const normalizedJson: QuestionItem[] = list.map((q: any, idx: number) => ({
              id: q.id || Date.now() + idx,
              questionText: String(q.questionText || ''),
              options: Array.isArray(q.options)
                ? q.options.map((opt: any) => stripOptionPrefix(String(opt || '')))
                : ['', '', '', ''],
              correctOption: typeof q.correctOption === 'number' ? q.correctOption : 0,
              explanation: q.explanation || ''
            }));
            setGeneratedQuestions(normalizedJson);
            setExamTitle(parsed?.title || fileName.replace(/\.[^/.]+$/, ''));
            setIsReviewConfirmed(false);
            setUploadNotice({
              type: 'success',
              message: `Nhận diện thành công ${normalizedJson.length} câu hỏi từ file JSON "${fileName}" — Bản xem thử đã sẵn sàng bên dưới.`
            });
            setIsParsingFile(false);
            setParsingStageLabel('');
            scrollToReviewStudio();
            return;
          }
        }

        if (isTxt) {
          const text = await file.text();
          await sendFileForParsing({ rawText: text, fileName });
          return;
        }
      }

      const encodedFiles: Array<{ fileBase64: string; fileName: string; mimeType: string }> = [];
      const previews: Array<{ name: string; dataUrl: string }> = [];

      for (const file of sortedFiles.slice(0, 10)) {
        const dataUrl = await readFileAsDataUrl(file);
        const base64String = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
        const lower = file.name.toLowerCase();
        const isPdf = lower.endsWith('.pdf');
        const isImg = /\.(png|jpe?g|webp|gif|bmp)$/i.test(lower) || file.type.startsWith('image/');
        const resolvedMime =
          file.type ||
          (isPdf
            ? 'application/pdf'
            : isImg
            ? 'image/jpeg'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        if (isImg && dataUrl) {
          previews.push({ name: file.name, dataUrl });
        }

        if (base64String) {
          encodedFiles.push({
            fileBase64: base64String,
            fileName: file.name,
            mimeType: resolvedMime
          });
        }
      }

      setUploadedImagePreviews(previews);

      if (encodedFiles.length === 0) {
        throw new Error('Không đọc được dữ liệu từ tệp đã chọn.');
      }

      if (encodedFiles.length === 1) {
        await sendFileForParsing({
          fileBase64: encodedFiles[0].fileBase64,
          fileName: encodedFiles[0].fileName,
          mimeType: encodedFiles[0].mimeType
        });
      } else {
        await sendFileForParsing({
          files: encodedFiles,
          fileName: displayName,
          mimeType: encodedFiles[0].mimeType
        });
      }
    } catch (err: any) {
      setUploadNotice({ type: 'error', message: err?.message || 'Lỗi xử lý file.' });
      setIsParsingFile(false);
      setParsingStageLabel('');
    }
  };

  const handleLoadSample = async () => {
    setIsParsingFile(true);
    setParsingStageLabel('Đang nạp đề thi mẫu chuẩn Azota...');
    setUploadNotice(null);
    setUploadedFileName('De_Khao_Sat_Vat_Ly_12_Chuan.docx');
    setUploadedFileSize('24.5 KB');
    setUploadedImagePreviews([]);
    await sendFileForParsing({
      rawText: SAMPLE_EXAM_TEXT,
      fileName: 'Đề khảo sát Vật lí 12 Chuẩn Azota'
    });
  };

  const handleClearFile = () => {
    setUploadedFileName(null);
    setUploadedFileSize(null);
    setKnowledgeContext('');
    setOcrText('');
    setOcrMeta(null);
    setShowOcrPanel(false);
    setUploadedImagePreviews([]);
    setActiveImagePreviewIdx(0);
    setUploadNotice(null);
    setGeneratedQuestions([]);
    setIsReviewConfirmed(false);
  };

  const handleCopyOcrText = async () => {
    if (!ocrText) return;
    try {
      await navigator.clipboard.writeText(ocrText);
      setOcrCopied(true);
      setTimeout(() => setOcrCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const createBlankQuestion = (): QuestionItem => ({
    id: Date.now() + Math.floor(Math.random() * 10000),
    questionText: '',
    options: ['', '', '', ''],
    correctOption: 0,
    explanation: ''
  });

  const ensureDefaultExamTitle = () => {
    if (!examTitle.trim()) {
      const titleScope = selectedLinkedClass ? selectedLinkedClass.name : `Khối ${grade}`;
      setExamTitle(`Đề kiểm tra ${subject} ${titleScope}`);
    }
  };

  const handleSwitchUploadMode = (nextMode: 'exam_file' | 'knowledge_file' | 'manual') => {
    setUploadMode(nextMode);
    setErrorMsg(null);
    if (nextMode === 'manual') {
      ensureDefaultExamTitle();
      if (generatedQuestions.length === 0) {
        setGeneratedQuestions([createBlankQuestion()]);
      }
      setIsReviewConfirmed(false);
    }
  };

  const handleTargetClassSelect = (nextVal: string) => {
    setTargetClass(nextVal);
    const matched = classes.find((c) => c.name === nextVal);
    if (matched) {
      setSelectedGradeOrClass(`class:${matched.id}`);
      setGrade(resolveClassGrade(matched));
    } else if (nextVal === 'Tất cả mọi người') {
      setSelectedGradeOrClass(grade);
    }
  };

  const handleSaveExamWithStatus = (publishStatus: 'published' | 'draft') => {
    setErrorMsg(null);
    if (!examTitle.trim()) {
      setErrorMsg('Vui lòng nhập tên đề thi trước khi lưu hoặc xuất bản.');
      scrollToReviewStudio();
      return;
    }
    if (generatedQuestions.length === 0) {
      setErrorMsg('Đề thi cần có ít nhất 1 câu hỏi.');
      return;
    }

    const firstBadIdx = generatedQuestions.findIndex((q) => auditQuestion(q).hasError);
    if (firstBadIdx !== -1) {
      const badAudit = auditQuestion(generatedQuestions[firstBadIdx]);
      setErrorMsg(`Câu ${firstBadIdx + 1}: ${badAudit.messages.join(', ')}. Vui lòng kiểm tra lại trước khi xuất bản.`);
      scrollToReviewStudio();
      return;
    }

    if (publishStatus === 'published' && !isReviewConfirmed) {
      setErrorMsg('Vui lòng kiểm tra bản xem thử đề thi và tích xác nhận "Tôi đã kiểm tra bản xem thử..." trước khi xuất bản.');
      scrollToReviewStudio();
      return;
    }

    const sanitizedQuestions = generatedQuestions.map((q) => ({
      ...q,
      questionText: q.questionText.trim(),
      options: q.options.map((opt) => stripOptionPrefix(opt)),
      explanation: q.explanation?.trim() || ''
    }));

    const newExam: ExamItem = {
      id: Date.now(),
      title: examTitle.trim(),
      subject,
      durationMinutes,
      submissionsCount: 0,
      status: publishStatus,
      assignedTo: targetClass,
      assignedAt: publishStatus === 'published' ? new Date().toISOString() : undefined,
      createdAt: new Date().toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      price: 'Miễn phí',
      questions: sanitizedQuestions,
      fileName: uploadMode === 'manual' ? undefined : uploadedFileName || undefined,
      description:
        uploadMode === 'manual'
          ? `Đề thi soạn thủ công (${sanitizedQuestions.length} câu trắc nghiệm).`
          : uploadedFileName
          ? `Đề thi bóc tách & kiểm duyệt từ file "${uploadedFileName}" (${sanitizedQuestions.length} câu trắc nghiệm).`
          : `Đề thi trắc nghiệm được sinh bởi AI theo ma trận nhận thức (${matrixNb}% Nhận biết, ${matrixTh}% Thông hiểu, ${matrixVd}% Vận dụng, ${matrixVdc}% Vận dụng cao).`
    };

    onSaveExam(newExam, {
      notifyStudents: publishStatus === 'published' ? notifyStudents : false
    });
    onClose();
  };

  const matrixTotal = matrixNb + matrixTh + matrixVd + matrixVdc;

  return (
    <div
      className={
        isPage
          ? 'w-full space-y-5 sf-panel-enter'
          : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#030b1c]/70 backdrop-blur-sm sf-panel-enter'
      }
    >
      <div
        className={
          isPage
            ? 'sf-teacher-surface rounded-3xl w-full flex flex-col overflow-hidden border border-slate-200/85 dark:border-cyan-400/25 shadow-[0_18px_42px_-24px_rgba(3,17,38,0.22)] dark:shadow-[0_24px_56px_-22px_rgba(0,0,0,0.72)]'
            : 'sf-teacher-surface rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/90 dark:border-cyan-400/30 shadow-2xl'
        }
      >
        {/* Header */}
        <div className="sf-navy-hero-banner p-4 sm:p-6 border-b border-cyan-400/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative z-10 flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {isPage && (
              <button
                type="button"
                data-sound="nav"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-cyan-300/35 backdrop-blur-md text-xs font-extrabold font-display tracking-wide transition-all duration-150 active:scale-95 shadow-sm cursor-pointer shrink-0"
                title="Quay lại trang trước"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-300" />
                <span>BACK</span>
              </button>
            )}
            <div className="w-11 h-11 rounded-2xl bg-cyan-400/15 border border-cyan-300/40 text-cyan-300 flex items-center justify-center shadow-[0_0_24px_-4px_rgba(34,211,238,0.55)] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold font-display text-white tracking-tight flex items-center gap-2 flex-wrap">
                <span>Tạo Đề Thi Thông Minh &amp; Bóc Tách File Đề</span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Kéo thả file đề / tài liệu kiến thức hoặc cấu hình AI theo 4 mức độ nhận thức · Tự động thông báo tới học sinh
              </p>
            </div>
          </div>
          {!isPage && (
            <button
              type="button"
              data-sound="nav"
              onClick={onClose}
              className="relative z-10 p-2 rounded-2xl text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all duration-150 active:scale-95 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div
          className={
            isPage
              ? 'p-4 sm:p-6 space-y-6'
              : 'flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar'
          }
        >
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 dark:bg-rose-950/45 border border-rose-400/40 text-xs font-bold text-rose-700 dark:text-rose-200 flex items-center gap-2 sf-panel-enter">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 01: Kéo thả File Đề thi, File Kiến thức hoặc Nhập thủ công */}
          <div className="sf-teacher-surface relative overflow-hidden p-4 sm:p-5 rounded-3xl border border-slate-200/85 dark:border-cyan-400/25 shadow-[0_12px_32px_-20px_rgba(3,17,38,0.18)] dark:shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)] space-y-4">
            <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-[#081b3d] via-cyan-400 to-emerald-400" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-0.5">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#081b3d] dark:bg-cyan-400/15 border border-cyan-400/35 text-cyan-300 flex items-center justify-center shadow-[0_0_16px_-4px_rgba(34,211,238,0.45)] shrink-0">
                  {uploadMode === 'manual' ? (
                    <PenLine className="w-4 h-4" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold font-display text-slate-900 dark:text-white tracking-tight">
                    01. Kéo thả File đề, File kiến thức hoặc Nhập thủ công
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {uploadMode === 'manual'
                      ? 'Tự nhập tên đề, từng câu hỏi trắc nghiệm A-B-C-D, chọn đáp án đúng và lời giải chi tiết'
                      : 'Tích hợp OCR trích xuất text & công thức Toán (LaTeX) từ Ảnh chụp (.png, .jpg), PDF (.pdf), Word (.docx), TXT, JSON'}
                  </p>
                </div>
              </div>

              {/* Mode toggle */}
              <div className="inline-flex flex-wrap sm:flex-nowrap p-1 rounded-2xl bg-slate-200/80 dark:bg-[#050f24] border border-slate-200 dark:border-cyan-400/20 self-start lg:self-auto gap-1">
                <button
                  type="button"
                  data-sound="toggle"
                  onClick={() => handleSwitchUploadMode('exam_file')}
                  className={`px-3.5 py-1.5 text-[11px] font-extrabold font-display rounded-xl transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                    uploadMode === 'exam_file'
                      ? 'bg-[#081b3d] dark:bg-cyan-400 text-cyan-200 dark:text-[#031126] shadow-[0_6px_16px_-6px_rgba(8,27,61,0.55)] dark:shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Bóc tách File đề có sẵn
                </button>
                <button
                  type="button"
                  data-sound="toggle"
                  onClick={() => handleSwitchUploadMode('knowledge_file')}
                  className={`px-3.5 py-1.5 text-[11px] font-extrabold font-display rounded-xl transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                    uploadMode === 'knowledge_file'
                      ? 'bg-[#081b3d] dark:bg-cyan-400 text-cyan-200 dark:text-[#031126] shadow-[0_6px_16px_-6px_rgba(8,27,61,0.55)] dark:shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  AI Ra đề từ File kiến thức
                </button>
                <button
                  type="button"
                  data-sound="toggle"
                  onClick={() => handleSwitchUploadMode('manual')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-extrabold font-display rounded-xl transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                    uploadMode === 'manual'
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.55)]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <PenLine className="w-3 h-3 shrink-0" />
                  <span>Nhập đề thủ công</span>
                </button>
              </div>
            </div>

            {uploadMode === 'manual' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50/90 dark:bg-[#06142c] border border-slate-200/80 dark:border-cyan-400/20">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Soạn đề trắc nghiệm trực tiếp hoặc dán văn bản thô để tách nhanh thành thẻ câu hỏi.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      data-sound="toggle"
                      onClick={() => setIsPastingText((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                        isPastingText
                          ? 'bg-[#081b3d] dark:bg-cyan-400/20 border-cyan-400 text-cyan-200'
                          : 'sf-teacher-tile bg-white dark:bg-[#091a38] border-slate-200 dark:border-cyan-400/25 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-300 shrink-0" />
                      <span>Dán văn bản đề</span>
                    </button>

                    <button
                      type="button"
                      data-sound="tap"
                      onClick={handleLoadSample}
                      disabled={isParsingFile}
                      className="sf-teacher-tile inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-cyan-400/25 bg-white dark:bg-[#091a38] text-slate-700 dark:text-slate-200 text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <span>Nạp đề mẫu</span>
                    </button>
                  </div>
                </div>

                {isPastingText && (
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#081834] border border-cyan-400/40 space-y-2.5 sf-panel-enter">
                    <label className="block text-xs font-extrabold font-display text-slate-800 dark:text-cyan-200">
                      Dán nội dung đề thi để tự động tách thành thẻ câu hỏi chỉnh sửa:
                    </label>
                    <textarea
                      rows={5}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Dán nội dung đề thi (Câu 1: ... A. ... B. ... C. ... D. ... Đáp án: 1.A ...)"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-[#050f24] border border-slate-200 dark:border-cyan-400/25 rounded-2xl text-slate-900 dark:text-white font-mono focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        data-sound="tap"
                        onClick={() => setIsPastingText(false)}
                        className="px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
                      >
                        Đóng
                      </button>
                      <button
                        type="button"
                        data-sound="success"
                        disabled={!pastedText.trim() || isParsingFile}
                        onClick={() => {
                          setIsParsingFile(true);
                          setUploadedFileName('Văn bản dán trực tiếp');
                          sendFileForParsing({
                            rawText: pastedText,
                            fileName: examTitle.trim() || 'Đề thi nhập từ văn bản'
                          });
                        }}
                        className="sf-neon-cta px-4 py-1.5 text-xs disabled:opacity-50 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer"
                      >
                        {isParsingFile ? 'Đang tách...' : 'Tách thành các câu hỏi'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Drag and Drop Area */}
                <div
                  data-sound="tap"
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
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      processUploadedFiles(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`group relative overflow-hidden border-2 border-dashed rounded-3xl p-5 sm:p-7 text-center cursor-pointer transition-all duration-150 active:scale-[0.995] ${
                    isDragging
                      ? 'border-cyan-400 bg-gradient-to-br from-cyan-500/15 via-sky-500/10 to-emerald-500/10 dark:from-cyan-500/20 dark:via-[#0a2149] dark:to-emerald-500/15 scale-[1.005] shadow-[0_0_28px_-6px_rgba(34,211,238,0.45)]'
                      : 'border-sky-300/80 dark:border-cyan-400/35 bg-gradient-to-br from-sky-50/75 via-white to-indigo-50/45 dark:from-[#071836]/95 dark:via-[#050f24]/95 dark:to-[#081d42]/95 hover:border-sky-500 dark:hover:border-cyan-300 hover:shadow-[0_12px_28px_-16px_rgba(14,165,233,0.45)]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".docx,.doc,.pdf,.txt,.json,.csv,.md,.png,.jpg,.jpeg,.webp,.bmp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        processUploadedFiles(e.target.files);
                        e.target.value = '';
                      }
                    }}
                  />

                  {isParsingFile ? (
                    <div className="py-4 flex flex-col items-center justify-center gap-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-[#081b3d] dark:bg-cyan-400/15 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_20px_-4px_rgba(34,211,238,0.5)]">
                        <RefreshCw className="w-6 h-6 text-cyan-300 animate-spin" />
                      </div>
                      <p className="text-xs sm:text-sm font-extrabold font-display text-slate-900 dark:text-white">
                        {parsingStageLabel || `Đang xử lý & trích xuất nội dung từ "${uploadedFileName}"...`}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Tự động nhận diện chữ tiếng Việt, công thức Toán học (LaTeX) và cấu trúc đáp án A-B-C-D
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-left">
                      <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#081b3d] via-sky-600 to-cyan-400 text-white flex items-center justify-center shadow-[0_0_24px_-4px_rgba(34,211,238,0.5)] group-hover:scale-105 transition-transform duration-150 shrink-0">
                        <FileUp className="w-6 h-6" />
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="text-xs sm:text-sm font-extrabold font-display text-slate-900 dark:text-white">
                          {uploadMode === 'exam_file'
                            ? 'Kéo thả file đề thi (Word, PDF hoặc nhiều ảnh trang đề) vào đây'
                            : 'Kéo thả file tài liệu kiến thức (Word, PDF, Ảnh chụp bài giảng) vào đây'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {uploadMode === 'exam_file'
                            ? 'Tích hợp công cụ OCR tự động trích xuất văn bản + công thức Toán LaTeX từ ảnh/PDF, bóc tách câu hỏi & đáp án A-B-C-D'
                            : 'Công cụ OCR tự động trích xuất text và công thức Toán học từ ảnh/PDF để AI sinh bộ đề chuẩn ma trận'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick utility bar under Dropzone */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-sound="toggle"
                      onClick={() => setIsPastingText((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[11.5px] font-bold transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                        isPastingText
                          ? 'bg-[#081b3d] dark:bg-cyan-400/20 border-cyan-400 text-cyan-200 shadow-[0_0_14px_-4px_rgba(34,211,238,0.45)]'
                          : 'sf-teacher-tile bg-white dark:bg-[#091a38] border-slate-200/90 dark:border-cyan-400/25 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-300 shrink-0" />
                      <span>Dán văn bản đề</span>
                    </button>

                    {uploadMode === 'exam_file' && (
                      <button
                        type="button"
                        data-sound="tap"
                        onClick={handleLoadSample}
                        disabled={isParsingFile}
                        className="sf-teacher-tile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 dark:border-cyan-400/25 bg-white dark:bg-[#091a38] text-slate-700 dark:text-slate-200 text-[11.5px] font-bold transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                        <span>Thử ngay với đề mẫu</span>
                      </button>
                    )}

                    {ocrText && (
                      <button
                        type="button"
                        data-sound="toggle"
                        onClick={() => setShowOcrPanel((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[11.5px] font-bold transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                          showOcrPanel
                            ? 'bg-[#081b3d] dark:bg-indigo-500/25 border-cyan-400/60 text-cyan-200 shadow-[0_0_14px_-4px_rgba(99,102,241,0.5)]'
                            : 'sf-teacher-tile bg-white dark:bg-[#091a38] border-slate-200/90 dark:border-cyan-400/25 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <ScanText className="w-3.5 h-3.5 text-indigo-500 dark:text-cyan-300 shrink-0" />
                        <span>{showOcrPanel ? 'Ẩn kết quả OCR' : 'Xem kết quả OCR & Công thức'}</span>
                      </button>
                    )}
                  </div>

                  {uploadedFileName && (
                    <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-[#081834] border border-slate-200/80 dark:border-cyan-400/25 text-xs text-slate-700 dark:text-cyan-200 font-semibold">
                      <span className="font-mono">
                        Tệp: <strong className="font-sans text-slate-900 dark:text-white">{uploadedFileName}</strong>{' '}
                        {uploadedFileSize ? `(${uploadedFileSize})` : ''}
                      </span>
                      <button
                        type="button"
                        data-sound="tap"
                        onClick={handleClearFile}
                        className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 font-bold transition cursor-pointer"
                      >
                        Gỡ tệp
                      </button>
                    </div>
                  )}
                </div>

                {/* Paste text area */}
                {isPastingText && (
                  <div className="space-y-2.5 pt-3 border-t border-slate-200/80 dark:border-cyan-400/15 sf-panel-enter">
                    <textarea
                      rows={5}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Dán nội dung đề thi (Câu 1: ... A. ... B. ... C. ... D. ...) hoặc văn bản kiến thức cần ra đề..."
                      className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-[#050f24] border border-slate-200 dark:border-cyan-400/25 rounded-2xl text-slate-900 dark:text-white font-mono focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        data-sound="success"
                        disabled={!pastedText.trim() || isParsingFile}
                        onClick={() => {
                          setIsParsingFile(true);
                          setUploadedFileName('Văn bản dán trực tiếp');
                          sendFileForParsing({
                            rawText: pastedText,
                            fileName: 'Đề thi từ văn bản dán trực tiếp'
                          });
                        }}
                        className="sf-neon-cta px-4 py-2 text-xs disabled:opacity-50 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer"
                      >
                        {uploadMode === 'exam_file' ? 'Bóc tách & mở bản xem thử' : 'Sinh đề từ văn bản này'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Upload feedback notice */}
            {uploadNotice && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 sf-panel-enter ${
                  uploadNotice.type === 'success'
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/35 text-emerald-800 dark:text-emerald-200 font-bold'
                    : 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/35 text-rose-800 dark:text-rose-200 font-bold'
                }`}
              >
                {uploadNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>{uploadNotice.message}</span>
              </div>
            )}

            {/* OCR Text & Math Formula Inspector Card */}
            {ocrText && showOcrPanel && uploadMode !== 'manual' && (
              <div className="rounded-2xl border border-cyan-400/35 bg-white dark:bg-[#07142b] overflow-hidden shadow-[0_12px_28px_-16px_rgba(34,211,238,0.3)] sf-panel-enter">
                <div className="px-4 py-3 bg-[#081b3d] text-white border-b border-cyan-400/25 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ScanText className="w-4 h-4 text-cyan-300 shrink-0" />
                    <span className="text-xs font-extrabold font-display text-white">
                      Kết quả OCR Văn bản &amp; Công thức Toán (LaTeX)
                    </span>
                    {ocrMeta && ocrMeta.formulaCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-cyan-400/20 border border-cyan-300/30 text-cyan-200 text-[10.5px] font-bold font-mono tabular-nums">
                        {ocrMeta.formulaCount} công thức
                      </span>
                    )}
                    {ocrMeta && ocrMeta.pageCount > 1 && (
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-200 text-[10.5px] font-bold font-mono tabular-nums">
                        {ocrMeta.pageCount} trang
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="inline-flex p-0.5 rounded-xl bg-[#040f24] border border-cyan-400/25">
                      <button
                        type="button"
                        data-sound="toggle"
                        onClick={() => setOcrViewMode('katex')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                          ocrViewMode === 'katex'
                            ? 'bg-cyan-400 text-[#031126] shadow-xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        <span>Xem công thức</span>
                      </button>
                      <button
                        type="button"
                        data-sound="toggle"
                        onClick={() => setOcrViewMode('raw')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                          ocrViewMode === 'raw'
                            ? 'bg-cyan-400 text-[#031126] shadow-xs'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Code2 className="w-3 h-3" />
                        <span>Sửa text / LaTeX</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      data-sound="tap"
                      onClick={handleCopyOcrText}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-cyan-300/30 bg-white/10 hover:bg-white/20 text-cyan-100 text-[11px] font-bold transition-all duration-150 active:scale-95 cursor-pointer"
                    >
                      {ocrCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{ocrCopied ? 'Đã chép' : 'Sao chép'}</span>
                    </button>

                    {uploadMode === 'exam_file' ? (
                      <button
                        type="button"
                        data-sound="success"
                        disabled={isParsingFile || !ocrText.trim()}
                        onClick={() => {
                          setIsParsingFile(true);
                          setParsingStageLabel('Đang tách lại câu hỏi từ văn bản OCR đã chỉnh sửa...');
                          sendFileForParsing({
                            rawText: ocrText,
                            fileName: uploadedFileName || 'Văn bản OCR'
                          });
                        }}
                        className="sf-neon-cta inline-flex items-center gap-1 px-3 py-1 rounded-xl disabled:opacity-50 text-[11px] transition-all duration-150 active:scale-95 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Tách lại câu hỏi từ OCR</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-sound="success"
                        disabled={isLoading || !ocrText.trim()}
                        onClick={() => handleGenerate(topic, ocrText)}
                        className="sf-neon-cta inline-flex items-center gap-1 px-3 py-1 rounded-xl disabled:opacity-50 text-[11px] transition-all duration-150 active:scale-95 cursor-pointer"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Sinh đề lại từ OCR</span>
                      </button>
                    )}

                    <button
                      type="button"
                      data-sound="tap"
                      onClick={() => setShowOcrPanel(false)}
                      className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                      title="Thu gọn bảng OCR"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div
                  className={`p-3.5 grid gap-3.5 ${
                    uploadedImagePreviews.length > 0 ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
                  }`}
                >
                  {uploadedImagePreviews.length > 0 && (
                    <div className="lg:col-span-4 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-cyan-500" />
                          Ảnh gốc ({uploadedImagePreviews.length})
                        </span>
                        <span className="truncate max-w-[160px] text-slate-400">
                          {uploadedImagePreviews[activeImagePreviewIdx]?.name}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-cyan-400/25 bg-slate-50 dark:bg-[#040b18] overflow-hidden flex items-center justify-center max-h-64">
                        <img
                          src={uploadedImagePreviews[activeImagePreviewIdx]?.dataUrl}
                          alt={uploadedImagePreviews[activeImagePreviewIdx]?.name || 'Ảnh đề thi'}
                          className="max-h-64 w-auto object-contain"
                        />
                      </div>
                      {uploadedImagePreviews.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                          {uploadedImagePreviews.map((img, idx) => (
                            <button
                              key={img.name + idx}
                              type="button"
                              data-sound="nav"
                              onClick={() => setActiveImagePreviewIdx(idx)}
                              className={`shrink-0 rounded-lg border overflow-hidden p-0.5 transition cursor-pointer ${
                                idx === activeImagePreviewIdx
                                  ? 'border-cyan-400 ring-1 ring-cyan-400'
                                  : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                              }`}
                            >
                              <img src={img.dataUrl} alt={img.name} className="w-10 h-10 object-cover rounded-md" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={uploadedImagePreviews.length > 0 ? 'lg:col-span-8' : ''}>
                    {ocrViewMode === 'katex' ? (
                      <div className="max-h-72 overflow-y-auto p-3.5 rounded-2xl bg-slate-50/90 dark:bg-[#050f22] border border-slate-200/80 dark:border-cyan-400/20 text-xs sm:text-[13px] leading-relaxed text-slate-800 dark:text-slate-100 prose prose-sm dark:prose-invert max-w-none custom-scrollbar">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {ocrText}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <textarea
                        rows={11}
                        value={ocrText}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setOcrText(nextVal);
                          if (uploadMode === 'knowledge_file') {
                            setKnowledgeContext(nextVal);
                          }
                        }}
                        className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-[#050f22] border border-slate-200 dark:border-cyan-400/25 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
                        placeholder="Nội dung văn bản và công thức LaTeX ($...$) sau khi OCR..."
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bản Xem Thử, Kiểm Tra & Chỉnh Sửa Đề Thi (Hiện ngay sau khi kéo thả file đề, AI sinh đề hoặc ở chế độ thủ công) */}
          {generatedQuestions.length > 0 && (uploadMode === 'exam_file' || uploadMode === 'manual') && (
            <div ref={reviewSectionRef}>
              <ExamReviewEditor
                questions={generatedQuestions}
                onChangeQuestions={setGeneratedQuestions}
                examTitle={examTitle}
                onChangeExamTitle={setExamTitle}
                subject={subject}
                onChangeSubject={setSubject}
                subjectOptions={subjectOptions}
                durationMinutes={durationMinutes}
                onChangeDurationMinutes={setDurationMinutes}
                targetClass={targetClass}
                onChangeTargetClass={handleTargetClassSelect}
                classes={classes}
                notifyStudents={notifyStudents}
                onChangeNotifyStudents={setNotifyStudents}
                uploadedFileName={uploadMode === 'manual' ? null : uploadedFileName}
                sourceBadgeText={uploadMode === 'manual' ? 'Soạn thủ công' : 'Bóc tách từ file đề'}
                isReviewConfirmed={isReviewConfirmed}
                onChangeReviewConfirmed={setIsReviewConfirmed}
                sectionNumberLabel="02"
              />
            </div>
          )}

          {/* Section 02: Thông số cơ bản & Ma trận AI (Hiển thị khi chưa có đề bóc tách hoặc ở chế độ File kiến thức / AI) */}
          {(uploadMode === 'knowledge_file' ||
            (uploadMode === 'exam_file' && generatedQuestions.length === 0)) && (
            <div className="sf-teacher-surface relative overflow-hidden p-4 sm:p-5 rounded-3xl border border-slate-200/85 dark:border-cyan-400/25 space-y-4 shadow-[0_12px_32px_-20px_rgba(3,17,38,0.18)]">
              <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-[#081b3d] via-indigo-400 to-cyan-400" />
              <h3 className="text-xs sm:text-sm font-extrabold font-display text-slate-900 dark:text-white tracking-tight pt-0.5">
                02. Thông số Đề thi &amp; Ma trận AI
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-cyan-200/90 mb-1.5">
                    Môn học
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl text-xs font-bold border border-slate-200/90 dark:border-cyan-400/25 bg-white dark:bg-[#050f24] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition cursor-pointer"
                  >
                    {subjectOptions.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-cyan-200/90 mb-1.5">
                    Khối lớp <span className="text-[10px] font-semibold normal-case text-sky-600 dark:text-cyan-400">(Đồng bộ Lớp &amp; HS)</span>
                  </label>
                  <select
                    value={selectedGradeOrClass}
                    onChange={(e) => handleGradeOrClassChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl text-xs font-bold border border-slate-200/90 dark:border-cyan-400/25 bg-white dark:bg-[#050f24] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition cursor-pointer"
                  >
                    {classes.length > 0 && (
                      <optgroup label="Lớp đã tạo (Lớp & Học sinh)">
                        {classes.map((cls) => (
                          <option key={cls.id} value={`class:${cls.id}`}>
                            {cls.name} · Khối {resolveClassGrade(cls)} ({cls.studentsCount} HS)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Khối lớp chung">
                      <option value="12">Khối 12 (Thi THPT QG)</option>
                      <option value="11">Khối 11</option>
                      <option value="10">Khối 10</option>
                    </optgroup>
                  </select>
                  {selectedLinkedClass && (
                    <p className="mt-1 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                      Đã liên kết lớp {selectedLinkedClass.name} ({selectedLinkedClass.studentsCount} HS)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-cyan-200/90 mb-1.5">
                    Số câu hỏi
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-2xl text-xs font-bold border border-slate-200/90 dark:border-cyan-400/25 bg-white dark:bg-[#050f24] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition tabular-nums cursor-pointer"
                  >
                    <option value={4}>4 câu (Kiểm tra nhanh)</option>
                    <option value={5}>5 câu</option>
                    <option value={10}>10 câu (15 phút)</option>
                    <option value={20}>20 câu (45 phút)</option>
                    <option value={40}>40 câu (Chuẩn THPT QG)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-cyan-200/90 mb-1.5">
                    Thời gian làm bài
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-2xl text-xs font-bold border border-slate-200/90 dark:border-cyan-400/25 bg-white dark:bg-[#050f24] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition tabular-nums cursor-pointer"
                  >
                    <option value={15}>15 phút</option>
                    <option value={45}>45 phút (1 tiết)</option>
                    <option value={50}>50 phút</option>
                    <option value={90}>90 phút (Học kỳ / THPT)</option>
                  </select>
                </div>
              </div>

              {/* Chủ đề / Chuyên đề kiến thức */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-cyan-200/90 mb-1.5">
                  Chuyên đề / Bài học kiến thức cần ra đề
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-medium border border-slate-200/90 dark:border-cyan-400/25 bg-white dark:bg-[#050f24] text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition"
                />
              </div>

              {/* Cấu hình Ma trận Nhận thức */}
              <div className="bg-slate-50/90 dark:bg-[#06132b]/95 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-cyan-400/25">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold font-display text-slate-900 dark:text-white">
                    Tỉ lệ Ma trận nhận thức (%)
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold font-mono tabular-nums ${
                      matrixTotal === 100
                        ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 border border-amber-500/35 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    Tổng: {matrixTotal}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="sf-teacher-kpi p-3 rounded-2xl border border-slate-200/80 dark:border-cyan-400/20">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-cyan-300/85">Nhận biết</span>
                    <div className="flex items-center justify-between mt-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={matrixNb}
                        onChange={(e) => setMatrixNb(Number(e.target.value))}
                        className="w-16 px-2.5 py-1 font-extrabold font-mono text-slate-900 dark:text-white bg-slate-50 dark:bg-[#050f24] border border-slate-200 dark:border-cyan-400/30 rounded-xl text-xs tabular-nums focus:outline-none focus:border-cyan-400"
                      />
                      <span className="text-sky-600 dark:text-cyan-400 font-extrabold">%</span>
                    </div>
                  </div>

                  <div className="sf-teacher-kpi p-3 rounded-2xl border border-slate-200/80 dark:border-cyan-400/20">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-cyan-300/85">Thông hiểu</span>
                    <div className="flex items-center justify-between mt-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={matrixTh}
                        onChange={(e) => setMatrixTh(Number(e.target.value))}
                        className="w-16 px-2.5 py-1 font-extrabold font-mono text-slate-900 dark:text-white bg-slate-50 dark:bg-[#050f24] border border-slate-200 dark:border-cyan-400/30 rounded-xl text-xs tabular-nums focus:outline-none focus:border-cyan-400"
                      />
                      <span className="text-sky-600 dark:text-cyan-400 font-extrabold">%</span>
                    </div>
                  </div>

                  <div className="sf-teacher-kpi p-3 rounded-2xl border border-slate-200/80 dark:border-cyan-400/20">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-cyan-300/85">Vận dụng</span>
                    <div className="flex items-center justify-between mt-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={matrixVd}
                        onChange={(e) => setMatrixVd(Number(e.target.value))}
                        className="w-16 px-2.5 py-1 font-extrabold font-mono text-slate-900 dark:text-white bg-slate-50 dark:bg-[#050f24] border border-slate-200 dark:border-cyan-400/30 rounded-xl text-xs tabular-nums focus:outline-none focus:border-cyan-400"
                      />
                      <span className="text-sky-600 dark:text-cyan-400 font-extrabold">%</span>
                    </div>
                  </div>

                  <div className="sf-teacher-kpi p-3 rounded-2xl border border-slate-200/80 dark:border-cyan-400/20">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-cyan-300/85">Vận dụng cao</span>
                    <div className="flex items-center justify-between mt-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={matrixVdc}
                        onChange={(e) => setMatrixVdc(Number(e.target.value))}
                        className="w-16 px-2.5 py-1 font-extrabold font-mono text-slate-900 dark:text-white bg-slate-50 dark:bg-[#050f24] border border-slate-200 dark:border-cyan-400/30 rounded-xl text-xs tabular-nums focus:outline-none focus:border-cyan-400"
                      />
                      <span className="text-sky-600 dark:text-cyan-400 font-extrabold">%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    data-sound="success"
                    onClick={() => handleGenerate()}
                    disabled={isLoading}
                    className="sf-neon-cta flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs transition-all duration-150 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#031126]/30 border-t-[#031126] rounded-full animate-spin" />
                        <span>AI đang phân tích &amp; sinh câu hỏi...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        <span>AI Sinh đề thi tự động</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bản Xem Thử & Chỉnh Sửa cho chế độ AI / File kiến thức */}
          {generatedQuestions.length > 0 && uploadMode === 'knowledge_file' && (
            <div ref={reviewSectionRef}>
              <ExamReviewEditor
                questions={generatedQuestions}
                onChangeQuestions={setGeneratedQuestions}
                examTitle={examTitle}
                onChangeExamTitle={setExamTitle}
                subject={subject}
                onChangeSubject={setSubject}
                subjectOptions={subjectOptions}
                durationMinutes={durationMinutes}
                onChangeDurationMinutes={setDurationMinutes}
                targetClass={targetClass}
                onChangeTargetClass={handleTargetClassSelect}
                classes={classes}
                notifyStudents={notifyStudents}
                onChangeNotifyStudents={setNotifyStudents}
                uploadedFileName={uploadedFileName}
                sourceBadgeText="AI sinh theo ma trận"
                isReviewConfirmed={isReviewConfirmed}
                onChangeReviewConfirmed={setIsReviewConfirmed}
                sectionNumberLabel="03"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-cyan-400/20 flex flex-wrap items-center justify-between gap-3 bg-slate-50/85 dark:bg-[#050f24]/95">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 hidden sm:block">
            {generatedQuestions.length === 0
              ? 'Kéo thả file đề, chọn AI sinh đề hoặc nhập thủ công để mở bản xem thử trước khi xuất bản'
              : !isReviewConfirmed
              ? 'Kiểm tra bản xem thử ở trên và tích xác nhận để mở khóa nút xuất bản đề thi'
              : notifyStudents
              ? 'Sẵn sàng xuất bản vào Thi cử, gửi thông báo cho học sinh và mở thống kê phổ điểm'
              : 'Sẵn sàng xuất bản đề thi vào hệ thống để học sinh làm bài'}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            {isPage ? (
              <button
                type="button"
                data-sound="nav"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#081b3d] dark:bg-cyan-400/15 text-cyan-200 dark:text-cyan-300 border border-cyan-400/35 hover:bg-[#0d2654] dark:hover:bg-cyan-400/25 text-xs font-extrabold font-display tracking-wide transition-all duration-150 active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>BACK</span>
              </button>
            ) : (
              <button
                type="button"
                data-sound="nav"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-all duration-150 active:scale-95 cursor-pointer"
              >
                Hủy bỏ
              </button>
            )}

            {generatedQuestions.length > 0 && (
              <button
                type="button"
                data-sound="tap"
                onClick={() => handleSaveExamWithStatus('draft')}
                className="sf-teacher-tile inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-200/90 dark:border-cyan-400/30 bg-white dark:bg-[#091a38] text-slate-700 dark:text-cyan-200 text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4 text-sky-600 dark:text-cyan-300" />
                <span>Lưu bản nháp</span>
              </button>
            )}

            <button
              type="button"
              data-sound="success"
              onClick={() => handleSaveExamWithStatus('published')}
              disabled={generatedQuestions.length === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-extrabold font-display transition-all duration-150 active:scale-95 disabled:opacity-50 cursor-pointer ${
                isReviewConfirmed
                  ? 'sf-neon-cta'
                  : 'bg-gradient-to-r from-[#081b3d] to-[#133168] dark:from-indigo-600 dark:to-cyan-600 text-white border border-cyan-400/35 shadow-[0_8px_22px_-8px_rgba(8,27,61,0.55)]'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Xuất bản Đề thi vào Hệ thống</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

