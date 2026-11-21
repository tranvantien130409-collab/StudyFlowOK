import React, { useState, useEffect } from 'react';
import { X, Save, Award, BookOpen, FileText, Bell } from 'lucide-react';
import { StudentGradeRecord, TeacherStudent } from '../types';
import {
  SemesterKey,
  calcStudentAvgScore,
  calcYearlyAvg,
  countEnteredScores,
  getStudentStatusFromAvg
} from '../utils/gradebook';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: TeacherStudent;
  initialSemester?: SemesterKey;
  onSave: (student: TeacherStudent, editedSemester?: SemesterKey) => void;
}

const toInputString = (val?: number | null) =>
  typeof val === 'number' && Number.isFinite(val) ? String(val) : '';

const parseScoreInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(10, Math.round(num * 10) / 10));
};

interface DraftInputFields {
  tx1: string;
  tx2: string;
  tx3: string;
  tx4: string;
  gk: string;
  ck: string;
  comment: string;
}

const fromRecord = (rec?: StudentGradeRecord): DraftInputFields => ({
  tx1: toInputString(rec?.tx1),
  tx2: toInputString(rec?.tx2),
  tx3: toInputString(rec?.tx3),
  tx4: toInputString(rec?.tx4),
  gk: toInputString(rec?.gk),
  ck: toInputString(rec?.ck),
  comment: rec?.comment || ''
});

const toRecord = (f: DraftInputFields): StudentGradeRecord => ({
  tx1: parseScoreInput(f.tx1),
  tx2: parseScoreInput(f.tx2),
  tx3: parseScoreInput(f.tx3),
  tx4: parseScoreInput(f.tx4),
  gk: parseScoreInput(f.gk),
  ck: parseScoreInput(f.ck),
  comment: f.comment.trim() || undefined
});

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  initialSemester = 'hk1',
  onSave
}) => {
  const [semester, setSemester] = useState<SemesterKey>(initialSemester);
  const [name, setName] = useState(student.name);
  const [rollNumber, setRollNumber] = useState(student.rollNumber);
  const [hk1Fields, setHk1Fields] = useState<DraftInputFields>(() => fromRecord(student.scores));
  const [hk2Fields, setHk2Fields] = useState<DraftInputFields>(() => fromRecord(student.scoresHk2));

  useEffect(() => {
    if (isOpen && student) {
      setSemester(initialSemester);
      setName(student.name);
      setRollNumber(student.rollNumber);
      setHk1Fields(fromRecord(student.scores));
      setHk2Fields(fromRecord(student.scoresHk2));
    }
  }, [isOpen, student, initialSemester]);

  if (!isOpen) return null;

  const activeFields = semester === 'hk2' ? hk2Fields : hk1Fields;
  const setActiveFields = (updater: (prev: DraftInputFields) => DraftInputFields) => {
    if (semester === 'hk2') {
      setHk2Fields(updater);
    } else {
      setHk1Fields(updater);
    }
  };

  const hk1Record = toRecord(hk1Fields);
  const hk2Record = toRecord(hk2Fields);
  const hk1Count = countEnteredScores(hk1Record);
  const hk2Count = countEnteredScores(hk2Record);
  const hk1Avg = hk1Count > 0 ? calcStudentAvgScore(hk1Record, 0) : 0;
  const hk2Avg = hk2Count > 0 ? calcStudentAvgScore(hk2Record, 0) : 0;
  const yearlyAvg = calcYearlyAvg(hk1Count > 0 ? hk1Avg : null, hk2Count > 0 ? hk2Avg : null);

  const activeCount = semester === 'hk2' ? hk2Count : hk1Count;
  const activeAvg = semester === 'hk2' ? hk2Avg : hk1Avg;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(
      {
        ...student,
        name: name.trim(),
        rollNumber: rollNumber.trim() || student.rollNumber,
        scores: hk1Record,
        avgScore: hk1Avg,
        scoresHk2: hk2Record,
        avgScoreHk2: hk2Count > 0 ? hk2Avg : undefined,
        completedTasks: hk1Count + hk2Count,
        totalTasks: Math.max(student.totalTasks || 4, hk1Count + hk2Count),
        status: getStudentStatusFromAvg(
          yearlyAvg ?? (semester === 'hk2' && hk2Count > 0 ? hk2Avg : hk1Avg),
          hk1Count > 0 || hk2Count > 0
        )
      },
      semester
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Cập nhật điểm & Thông tin học sinh
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nhập điểm theo từng dạng bài kiểm tra (0 - 10 điểm, bỏ trống nếu chưa thi)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Semester Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setSemester('hk1')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              semester === 'hk1'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Học kỳ I ({hk1Count} cột)
          </button>
          <button
            type="button"
            onClick={() => setSemester('hk2')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
              semester === 'hk2'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Học kỳ II ({hk2Count} cột)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Họ và tên học sinh *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Mã học sinh
              </label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ĐDGtx */}
          <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                Đánh giá thường xuyên ({semester === 'hk2' ? 'HKII' : 'HKI'})
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                Hệ số 1
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(
                [
                  { key: 'tx1', label: 'TX 1' },
                  { key: 'tx2', label: 'TX 2' },
                  { key: 'tx3', label: 'TX 3' },
                  { key: 'tx4', label: 'Miệng (M)' }
                ] as const
              ).map((field) => (
                <div key={field.key}>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    {field.label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    placeholder="-"
                    value={activeFields[field.key]}
                    onChange={(e) => {
                      const val = e.target.value;
                      setActiveFields((prev) => ({ ...prev, [field.key]: val }));
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-center rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ĐDGgk & ĐDGck */}
          <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-purple-600" />
                Đánh giá định kỳ ({semester === 'hk2' ? 'HKII' : 'HKI'})
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                Hệ số 2 & 3
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Giữa kỳ (ĐDGgk • HS 2)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  placeholder="Chưa có điểm"
                  value={activeFields.gk}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActiveFields((prev) => ({ ...prev, gk: val }));
                  }}
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold text-center rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Cuối kỳ (ĐDGck • HS 3)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  placeholder="Chưa có điểm"
                  value={activeFields.ck}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActiveFields((prev) => ({ ...prev, ck: val }));
                  }}
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold text-center rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Nhận xét sự tiến bộ, ưu điểm, hạn chế ({semester === 'hk2' ? 'Học kỳ II' : 'Học kỳ I'})</span>
            </label>
            <textarea
              rows={2}
              value={activeFields.comment}
              onChange={(e) => {
                const val = e.target.value;
                setActiveFields((prev) => ({ ...prev, comment: val }));
              }}
              placeholder="Ghi chú nhận xét cho học sinh..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Computed average preview */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                ĐTBm {semester === 'hk2' ? 'HKII' : 'HKI'} dự kiến ({activeCount} cột điểm):
              </span>
              <span
                className={`text-base font-black font-mono px-2.5 py-0.5 rounded-lg ${
                  activeCount === 0
                    ? 'text-slate-400 bg-slate-200/60 dark:bg-slate-700'
                    : activeAvg >= 8
                    ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                    : activeAvg >= 5
                    ? 'text-blue-700 bg-blue-100 dark:bg-blue-950 dark:text-blue-300'
                    : 'text-rose-700 bg-rose-100 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {activeCount > 0 ? `${activeAvg}/10` : 'Chưa có'}
              </span>
            </div>
            {yearlyAvg !== null && (
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                <span className="text-slate-500 dark:text-slate-400">
                  ĐTB Cả năm dự kiến ((HKI + 2×HKII) / 3):
                </span>
                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                  {yearlyAvg}/10
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
            <Bell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Khi nhấn Lưu bảng điểm, nhận xét và kết quả sẽ được gửi riêng cho học sinh này (xem tại trang Tasks, không đăng lên bảng thông báo chung).</span>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu bảng điểm</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
