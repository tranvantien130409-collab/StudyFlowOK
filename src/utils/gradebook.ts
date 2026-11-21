import { StudentGradeRecord, TeacherStudent } from '../types';

export type ExamCategoryKey = 'all' | 'tx1' | 'tx2' | 'tx3' | 'tx4' | 'gk' | 'ck';
export type SemesterKey = 'hk1' | 'hk2';

export interface ExamCategoryMeta {
  key: ExamCategoryKey;
  label: string;
  shortLabel: string;
  group: 'Tổng hợp' | 'ĐDGtx' | 'ĐDGgk' | 'ĐDGck';
  coefficientLabel: string;
  description: string;
}

export const EXAM_CATEGORIES: ExamCategoryMeta[] = [
  {
    key: 'all',
    label: 'Tổng hợp (ĐTBm)',
    shortLabel: 'Tổng hợp',
    group: 'Tổng hợp',
    coefficientLabel: 'Trung bình môn',
    description: 'Xem toàn bộ cột điểm và điểm trung bình môn HKI'
  },
  {
    key: 'tx1',
    label: 'Thường xuyên 1 (TX1)',
    shortLabel: 'TX 1',
    group: 'ĐDGtx',
    coefficientLabel: 'Hệ số 1',
    description: 'Kiểm tra đánh giá thường xuyên lần 1'
  },
  {
    key: 'tx2',
    label: 'Thường xuyên 2 (TX2)',
    shortLabel: 'TX 2',
    group: 'ĐDGtx',
    coefficientLabel: 'Hệ số 1',
    description: 'Kiểm tra đánh giá thường xuyên lần 2'
  },
  {
    key: 'tx3',
    label: 'Thường xuyên 3 (TX3)',
    shortLabel: 'TX 3',
    group: 'ĐDGtx',
    coefficientLabel: 'Hệ số 1',
    description: 'Kiểm tra đánh giá thường xuyên lần 3'
  },
  {
    key: 'tx4',
    label: 'Kiểm tra Miệng (M)',
    shortLabel: 'Miệng (M)',
    group: 'ĐDGtx',
    coefficientLabel: 'Hệ số 1',
    description: 'Kiểm tra vấn đáp / Miệng (cột M)'
  },
  {
    key: 'gk',
    label: 'Kiểm tra Giữa kỳ',
    shortLabel: 'Giữa kỳ (ĐDGgk)',
    group: 'ĐDGgk',
    coefficientLabel: 'Hệ số 2',
    description: 'Bài kiểm tra đánh giá giữa học kỳ'
  },
  {
    key: 'ck',
    label: 'Kiểm tra Cuối kỳ',
    shortLabel: 'Cuối kỳ (ĐDGck)',
    group: 'ĐDGck',
    coefficientLabel: 'Hệ số 3',
    description: 'Bài kiểm tra đánh giá cuối học kỳ'
  }
];

export const isValidScore = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10;

export const calcStudentAvgScore = (
  scores?: StudentGradeRecord,
  fallback = 0
): number => {
  if (!scores) return fallback;
  let weightedSum = 0;
  let totalWeight = 0;

  const txKeys: Array<keyof Pick<StudentGradeRecord, 'tx1' | 'tx2' | 'tx3' | 'tx4'>> = [
    'tx1',
    'tx2',
    'tx3',
    'tx4'
  ];
  for (const k of txKeys) {
    const val = scores[k];
    if (isValidScore(val)) {
      weightedSum += val;
      totalWeight += 1;
    }
  }

  if (isValidScore(scores.gk)) {
    weightedSum += scores.gk * 2;
    totalWeight += 2;
  }

  if (isValidScore(scores.ck)) {
    weightedSum += scores.ck * 3;
    totalWeight += 3;
  }

  if (totalWeight === 0) return fallback;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
};

export const getStudentStatusFromAvg = (
  avg: number,
  hasAnyScore = true
): 'good' | 'average' | 'needs_attention' => {
  if (!hasAnyScore) return 'average';
  if (avg >= 8) return 'good';
  if (avg >= 5) return 'average';
  return 'needs_attention';
};

export const countEnteredScores = (scores?: StudentGradeRecord): number => {
  if (!scores) return 0;
  let count = 0;
  (['tx1', 'tx2', 'tx3', 'tx4', 'gk', 'ck'] as const).forEach((k) => {
    if (isValidScore(scores[k])) count += 1;
  });
  return count;
};

export const calcClassAvgScore = (students: TeacherStudent[]): number => {
  const scored = students.filter((s) => {
    if (s.scores) return countEnteredScores(s.scores) > 0;
    return s.avgScore > 0;
  });
  if (scored.length === 0) return 0;
  const total = scored.reduce((sum, s) => sum + s.avgScore, 0);
  return Math.round((total / scored.length) * 10) / 10;
};

export const getStudentScoresBySemester = (
  student: TeacherStudent,
  semester: SemesterKey = 'hk1'
): StudentGradeRecord | undefined => {
  return semester === 'hk2' ? student.scoresHk2 : student.scores;
};

export const getScoreForCategory = (
  student: TeacherStudent,
  cat: ExamCategoryKey,
  semester: SemesterKey = 'hk1'
): number | null => {
  const sc = getStudentScoresBySemester(student, semester);
  if (cat === 'all') {
    if (semester === 'hk2') {
      if (!sc || countEnteredScores(sc) === 0) {
        return isValidScore(student.avgScoreHk2) ? student.avgScoreHk2 : null;
      }
      return calcStudentAvgScore(sc, 0);
    }
    if (student.scores && countEnteredScores(student.scores) === 0) {
      return null;
    }
    return isValidScore(student.avgScore) ? student.avgScore : null;
  }
  const val = sc?.[cat];
  return isValidScore(val) ? val : null;
};

export const calcYearlyAvg = (hk1: number | null, hk2: number | null): number | null => {
  if (hk1 === null || hk2 === null) return null;
  return Math.round(((hk1 + hk2 * 2) / 3) * 10) / 10;
};

export type CompactRosterRow = [
  name: string,
  tx1: number | null,
  tx2: number | null,
  tx3?: number | null,
  tx4?: number | null,
  gk?: number | null,
  ck?: number | null
];

export const buildRosterStudents = (
  classCode: string,
  rows: CompactRosterRow[]
): TeacherStudent[] => {
  return rows.map((row, index) => {
    const [name, tx1, tx2, tx3 = null, tx4 = null, gk = null, ck = null] = row;
    const scores: StudentGradeRecord = {
      tx1,
      tx2,
      tx3,
      tx4,
      gk,
      ck
    };
    const entered = countEnteredScores(scores);
    const avgScore = calcStudentAvgScore(scores, 0);
    const num = String(index + 1).padStart(2, '0');
    return {
      id: `${classCode.toLowerCase()}_s${index + 1}`,
      name,
      rollNumber: `${classCode}-${num}`,
      avgScore,
      completedTasks: entered,
      totalTasks: 4,
      status: getStudentStatusFromAvg(avgScore, entered > 0),
      scores
    };
  });
};
