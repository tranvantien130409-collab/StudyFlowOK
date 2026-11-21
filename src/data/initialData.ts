import { CalendarEvent, TaskItem, LibraryItem, CountdownItem, TeacherProfile, TeacherClass, StudentProfile, Notice, FlashcardDeck } from '../types';
import { buildRosterStudents, calcClassAvgScore } from '../utils/gradebook';

export const pad = (n: number) => String(n).padStart(2, '0');

export const formatDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const getMonday = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const formatHours = (h: number) => {
  const hr = Math.floor(h);
  const min = Math.round((h % 1) * 60);
  return `${hr}:${pad(min)}`;
};

export const DOW_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const DOW_FULL_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

export const EVENT_TYPE_MAP: Record<string, { 
  label: string; 
  icon: string; 
  bgClass: string; 
  borderClass: string; 
  textClass: string; 
  color: string;
  gradientClass: string;
  gradientBadge: string;
  glowClass: string;
}> = {
  class: {
    label: 'Lịch học',
    icon: '📚',
    bgClass: 'bg-cyan-50/90 dark:bg-cyan-950/50 text-cyan-950 dark:text-cyan-100',
    borderClass: 'border-cyan-300 dark:border-cyan-700/60',
    textClass: 'text-cyan-900 dark:text-cyan-200',
    color: '#0891b2',
    gradientClass: 'cal-event-class',
    gradientBadge: 'bg-gradient-to-r from-cyan-500/20 via-sky-500/15 to-blue-500/20 text-cyan-900 dark:text-cyan-300 border border-cyan-500/35 shadow-xs shadow-cyan-500/15',
    glowClass: 'shadow-cyan-500/25'
  },
  exam: {
    label: 'Thi / Kiểm tra',
    icon: '📝',
    bgClass: 'bg-rose-50/90 dark:bg-rose-950/50 text-rose-950 dark:text-rose-100',
    borderClass: 'border-rose-300 dark:border-rose-700/60',
    textClass: 'text-rose-900 dark:text-rose-200',
    color: '#e11d48',
    gradientClass: 'cal-event-exam',
    gradientBadge: 'bg-gradient-to-r from-rose-500/20 via-pink-500/15 to-violet-500/20 text-rose-900 dark:text-rose-300 border border-rose-500/35 shadow-xs shadow-rose-500/15',
    glowClass: 'shadow-rose-500/25'
  },
  act: {
    label: 'Hoạt động',
    icon: '🎯',
    bgClass: 'bg-indigo-50/90 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-100',
    borderClass: 'border-indigo-300 dark:border-indigo-700/60',
    textClass: 'text-indigo-900 dark:text-indigo-200',
    color: '#6366f1',
    gradientClass: 'cal-event-act',
    gradientBadge: 'bg-gradient-to-r from-indigo-500/20 via-blue-500/15 to-cyan-500/20 text-indigo-900 dark:text-indigo-300 border border-indigo-500/35 shadow-xs shadow-indigo-500/15',
    glowClass: 'shadow-indigo-500/25'
  },
  due: {
    label: 'Hạn nộp bài',
    icon: '⏳',
    bgClass: 'bg-amber-50/90 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100',
    borderClass: 'border-amber-300 dark:border-amber-700/60',
    textClass: 'text-amber-900 dark:text-amber-200',
    color: '#d97706',
    gradientClass: 'cal-event-due',
    gradientBadge: 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/25 text-amber-900 dark:text-amber-300 border border-amber-500/35 shadow-xs shadow-amber-500/15',
    glowClass: 'shadow-amber-500/25'
  }
};

const today = new Date();
today.setHours(0, 0, 0, 0);
const thisMonday = getMonday(today);

export const INITIAL_EVENTS: CalendarEvent[] = [
  { id: 1, t: 'Sinh học', type: 'class', date: formatDate(addDays(thisMonday, 3)), dow: 3, h: 7, d: 1.5, room: 'Phòng 204 – Dãy B' },
  { id: 2, t: 'Thi giữa kỳ Toán', type: 'exam', date: formatDate(addDays(thisMonday, 3)), dow: 3, h: 9, d: 1.5, room: 'Hội trường A' },
  { id: 3, t: 'Họp BCH Đoàn trường', type: 'act', date: formatDate(addDays(thisMonday, 3)), dow: 3, h: 14, d: 1.5, room: 'Phòng Hội đồng' },
  { id: 4, t: 'Lịch sử', type: 'class', date: formatDate(addDays(thisMonday, 4)), dow: 4, h: 8, d: 1.5, room: 'Phòng 204' },
  { id: 5, t: 'Hạn nộp bài tập', type: 'due', date: formatDate(addDays(thisMonday, 5)), dow: 5, h: 23, d: 0.5, room: 'Nộp qua Google Classroom' },
  { id: 6, t: 'Toán – Giải tích', type: 'class', date: formatDate(addDays(thisMonday, 0)), dow: 0, h: 7, d: 1.5, room: 'Phòng 204' },
  { id: 7, t: 'Vật lý 12', type: 'class', date: formatDate(addDays(thisMonday, 1)), dow: 1, h: 8, d: 1.5, room: 'Lab 2' },
  { id: 8, t: 'Tiếng Anh', type: 'class', date: formatDate(addDays(thisMonday, 2)), dow: 2, h: 9, d: 1.5, room: 'Phòng 310' }
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 1,
    t: 'Thí nghiệm Vật lý: Khảo sát dao động con lắc lò xo',
    sub: 'Vật lý',
    due: '2026-11-07',
    done: false,
    status: 'in_progress',
    priority: 'high',
    hi: true,
    quadrant: 1,
    weight: 'HS 2',
    deadlineLabel: 'Còn 4 ngày nữa',
    actionBadge: '⚡ Xử lý ngay',
    targetGap: 'Vật lý đang thiếu -0.6đ so với mục tiêu...',
    aiReason: '⚡ Điểm số đang dưới mục tiêu (-0.6đ) + Bài thực hành hệ số 2 -> Cần hoàn thành sớm',
    subtasks: [
      { id: 'sub_1_1', text: 'Đo chu kỳ T qua 10 dao động toàn phần', done: true },
      { id: 'sub_1_2', text: 'Tính sai số thực nghiệm', done: false },
      { id: 'sub_1_3', text: 'Hoàn thiện bản báo cáo nộp giáo viên', done: false }
    ],
    dueTime: '16:30',
    note: 'Chú ý công thức tính sai số gián tiếp của gia tốc trọng trường g'
  },
  {
    id: 2,
    t: 'Ôn tập bài thơ Tây Tiến – Quang Dũng',
    sub: 'Ngữ văn',
    due: '2026-11-08',
    done: false,
    status: 'todo',
    priority: 'medium',
    quadrant: 2,
    weight: 'HS 2',
    deadlineLabel: 'Còn 5 ngày nữa',
    targetGap: 'Ngữ văn đang thiếu -0.5đ so với mục tiêu...',
    aiReason: '🎯 Ôn tập chuyên đề trọng tâm chuẩn bị kiểm tra giữa kỳ môn Văn',
    dueTime: '20:00',
    subtasks: [
      { id: 'sub_2_1', text: 'Học thuộc 14 câu đầu', done: false },
      { id: 'sub_2_2', text: 'Phân tích bức tranh thiên nhiên Tây Bắc hùng vĩ', done: false },
      { id: 'sub_2_3', text: 'Viết đoạn văn cảm nhận hình tượng người lính', done: false }
    ],
    note: 'Liên hệ với chất hào hoa, lãng mạn của thanh niên trí thức Hà Thành'
  },
  {
    id: 3,
    t: 'Giải 10 bài Đại số Chương 1 – Khảo sát hàm số',
    sub: 'Toán',
    due: '2026-11-03',
    done: false,
    status: 'in_progress',
    priority: 'high',
    hi: true,
    quadrant: 1,
    weight: 'HS 2',
    deadlineLabel: 'Còn 1 giờ (Hôm nay)',
    actionBadge: '⚡ Xử lý ngay',
    aiReason: '⚡ Sát ngày (Hôm nay) + Trọng số điểm cao (HS 2) -> Ô 1 (Làm ngay)',
    subtasks: [
      { id: 'sub_3_1', text: '5 câu khảo sát và vẽ đồ thị', done: true },
      { id: 'sub_3_2', text: '3 câu bài toán tương giao', done: false },
      { id: 'sub_3_3', text: '2 câu nâng cao min-max tham số m', done: false }
    ],
    note: 'Xem kĩ công thức đạo hàm cấp 2 và điểm cực trị'
  },
  {
    id: 4,
    t: 'Đọc SGK Lịch Sử Chương 3 và vẽ sơ đồ tư duy',
    sub: 'Lịch sử',
    due: '2026-11-02',
    done: true,
    status: 'done',
    priority: 'high',
    quadrant: 2,
    weight: 'HS 1',
    deadlineLabel: 'Hết hạn',
    subtasks: [
      { id: 'sub_4_1', text: 'Đọc 3 lượt SGK phần kháng chiến', done: true },
      { id: 'sub_4_2', text: 'Vẽ mindmap các mốc thời gian lớn', done: true }
    ],
    note: 'Ghi nhớ mốc Đại hội đại biểu toàn quốc lần thứ II (1951)'
  },
  {
    id: 5,
    t: 'Viết bài luận Tiếng Anh Task 2 về Môi trường',
    sub: 'Tiếng Anh',
    due: '2026-11-05',
    done: true,
    status: 'done',
    priority: 'high',
    quadrant: 2,
    weight: 'HS 1',
    deadlineLabel: 'Còn 2 ngày',
    subtasks: [
      { id: 'sub_5_1', text: 'Lập dàn ý 4 đoạn', done: true },
      { id: 'sub_5_2', text: 'Viết phần Body 1 & 2', done: true },
      { id: 'sub_5_3', text: 'Proofread ngữ pháp', done: true }
    ],
    note: 'Tập trung từ vựng C1 về climate change và carbon footprint'
  },
  {
    id: 6,
    t: 'Ôn lý thuyết Este – Lipit và bài tập thủy phân',
    sub: 'Hóa học',
    due: formatDate(addDays(today, 5)),
    done: false,
    status: 'todo',
    priority: 'high',
    quadrant: 2,
    weight: 'HS 2',
    deadlineLabel: 'Còn 5 ngày nữa',
    actionBadge: '🔥 Ưu tiên cao',
    aiReason: '🎯 Ôn tập chuyên đề quan trọng chuẩn bị cho kỳ thi giữa kỳ',
    subtasks: [
      { id: 'sub_6_1', text: 'Ôn tính chất este của phenol', done: false },
      { id: 'sub_6_2', text: 'Làm đề kiểm tra 15 phút online', done: false }
    ],
    note: 'Chú ý bài toán đốt cháy este đơn chức mạch hở'
  },
  {
    id: 7,
    t: 'Photo tài liệu Đề cương ôn thi cho nhóm bạn',
    sub: 'Toán',
    due: formatDate(addDays(today, 1)),
    done: false,
    status: 'todo',
    priority: 'low',
    quadrant: 3,
    weight: 'HS 1',
    deadlineLabel: 'Còn 1 ngày 1h (Ngày mai)',
    aiReason: '🤝 Sát hạn nhưng không tính điểm trực tiếp -> Ô 3 (Ủy quyền / Học nhóm)',
    subtasks: [],
    note: 'Tiệm in cổng trường, in 4 bộ đề cương có lời giải chi tiết'
  },
  {
    id: 8,
    t: 'Đọc thêm sách "Tư Duy Nhanh và Chậm" Chương 4',
    sub: 'Khác',
    due: formatDate(addDays(today, 7)),
    done: false,
    status: 'todo',
    priority: 'low',
    quadrant: 4,
    weight: 'HS 1',
    deadlineLabel: 'Còn 7 ngày nữa',
    aiReason: '🌱 AI NLP: Nhận diện "Đọc thêm sách" -> Ô 4 (Kho lưu trữ ý tưởng Someday/Maybe)',
    subtasks: [],
    note: 'Đọc thêm nâng cao kỹ năng tư duy phản biện'
  }
];

export const INITIAL_LIBRARY: LibraryItem[] = [
  {
    id: 1,
    t: 'Tổng hợp công thức Đại số 10',
    sub: 'Toán',
    type: 'Ghi chú',
    d: 'Hằng đẳng thức, phương trình bậc hai, hệ thức Vi-ét và các dạng bài thường gặp.',
    url: 'https://vi.wikipedia.org/wiki/%C4%90%E1%BA%A1i_s%E1%BB%91',
    fileType: 'text',
    fileContent: `# TỔNG HỢP CÔNG THỨC ĐẠI SỐ 10

## 1. 7 Hằng đẳng thức đáng nhớ:
1. (a + b)² = a² + 2ab + b²
2. (a - b)² = a² - 2ab + b²
3. a² - b² = (a - b)(a + b)
4. (a + b)³ = a³ + 3a²b + 3ab² + b³
5. (a - b)³ = a³ - 3a²b + 3ab² - b³
6. a³ + b³ = (a + b)(a² - ab + b²)
7. a³ - b³ = (a - b)(a² + ab + b²)

## 2. Phương trình bậc hai: ax² + bx + c = 0 (a ≠ 0)
- Biệt thức Delta: Δ = b² - 4ac
  - Nếu Δ > 0: Phương trình có 2 nghiệm phân biệt: x₁,₂ = (-b ± √Δ) / (2a)
  - Nếu Δ = 0: Phương trình có nghiệm kép: x = -b / (2a)
  - Nếu Δ < 0: Phương trình vô nghiệm trên tập số thực ℝ

## 3. Hệ thức Vi-ét:
- Tổng hai nghiệm: S = x₁ + x₂ = -b / a
- Tích hai nghiệm: P = x₁ · x₂ = c / a

*Lưu ý: Luôn kiểm tra điều kiện xác định trước khi giải phương trình.*`,
    fav: true
  },
  {
    id: 7,
    t: 'Chuyên đề Hàm số & Đạo hàm Toán 12',
    sub: 'Toán',
    type: 'Tài liệu',
    d: 'Tổng hợp tính đơn điệu, cực trị, GTLN-GTNN, tiệm cận và bảng đạo hàm sơ cấp kèm công cụ vẽ đồ thị Desmos.',
    url: 'https://www.desmos.com/calculator?lang=vi',
    fileType: 'text',
    fileContent: `# CHUYÊN ĐỀ HÀM SỐ & ĐẠO HÀM TOÁN 12

## 1. Bảng đạo hàm các hàm số sơ cấp & hàm hợp
- (c)' = 0  (c là hằng số)
- (xⁿ)' = n·xⁿ⁻¹  |  (uⁿ)' = n·uⁿ⁻¹·u'
- (√x)' = 1/(2√x)  |  (√u)' = u'/(2√u)
- (sin x)' = cos x  |  (cos x)' = -sin x
- (tan x)' = 1/cos²x  |  (cot x)' = -1/sin²x
- (eˣ)' = eˣ  |  (aˣ)' = aˣ·ln a
- (ln x)' = 1/x  |  (logₐ x)' = 1/(x·ln a)

## 2. Tính đơn điệu & Cực trị hàm số y = f(x)
- Hàm số đồng biến trên khoảng K ⇔ f'(x) ≥ 0 ∀x ∈ K (f'(x) = 0 tại hữu hạn điểm).
- Hàm số nghịch biến trên khoảng K ⇔ f'(x) ≤ 0 ∀x ∈ K.
- Điểm x₀ là cực đại nếu f'(x) đổi dấu từ (+) sang (-) khi đi qua x₀.
- Điểm x₀ là cực tiểu nếu f'(x) đổi dấu từ (-) sang (+) khi đi qua x₀.

## 3. Đường tiệm cận đồ thị hàm số
- Tiệm cận đứng x = x₀: khi lim(x→x₀⁺) f(x) = ±∞ hoặc lim(x→x₀⁻) f(x) = ±∞.
- Tiệm cận ngang y = y₀: khi lim(x→+∞) f(x) = y₀ hoặc lim(x→-∞) f(x) = y₀.

🔗 **Thực hành vẽ đồ thị trực tuyến:** Mở liên kết Desmos Calculator đi kèm để khảo sát hàm số bậc 3, bậc 4 trùng phương và phân thức hữu tỉ.`,
    fav: true
  },
  {
    id: 8,
    t: 'Nguyên hàm – Tích phân & Ứng dụng hình học',
    sub: 'Toán',
    type: 'Ghi chú',
    d: 'Bảng công thức nguyên hàm cơ bản, phương pháp đổi biến, từng phần và tính diện tích, thể tích khối tròn xoay.',
    url: 'https://vi.wikipedia.org/wiki/T%C3%ADch_ph%C3%A2n',
    fileType: 'text',
    fileContent: `# NGUYÊN HÀM – TÍCH PHÂN & ỨNG DỤNG

## 1. Công thức nguyên hàm cần nhớ
- ∫ xⁿ dx = xⁿ⁺¹/(n+1) + C  (n ≠ -1)
- ∫ (1/x) dx = ln|x| + C
- ∫ eˣ dx = eˣ + C  |  ∫ aˣ dx = aˣ/ln a + C
- ∫ cos x dx = sin x + C  |  ∫ sin x dx = -cos x + C
- ∫ (1/cos²x) dx = tan x + C  |  ∫ (1/sin²x) dx = -cot x + C

## 2. Hai phương pháp tính tích phân cốt lõi
1. **Đổi biến số:** Đặt u = u(x) ⇒ du = u'(x)dx (nhớ đổi cận x = a → u(a), x = b → u(b)).
2. **Tích phân từng phần:** ∫ u dv = [u·v]ₐᵇ - ∫ v du.
   - Thứ tự ưu tiên đặt u: **Nhất lô (log) – Nhì đa (đa thức) – Tam lượng (lượng giác) – Tứ mũ (eˣ, aˣ)**.

## 3. Ứng dụng hình học
- Diện tích hình phẳng giới hạn bởi y = f(x), y = g(x), x = a, x = b:
  👉 **S = ∫ₐᵇ |f(x) - g(x)| dx**
- Thể tích khối tròn xoay khi quay quanh trục Ox:
  👉 **V = π · ∫ₐᵇ [f(x)]² dx**`,
    fav: true
  },
  {
    id: 9,
    t: 'Công thức Lượng giác toàn tập (Lớp 11)',
    sub: 'Toán',
    type: 'Ghi chú',
    d: 'Hệ thức cơ bản, cung liên kết, công thức cộng, nhân đôi, hạ bậc, biến đổi tổng thành tích và nghiệm phương trình.',
    url: 'https://vi.wikipedia.org/wiki/L%C6%B0%E1%BB%A3ng_gi%C3%A1c',
    fileType: 'text',
    fileContent: `# CÔNG THỨC LƯỢNG GIÁC TOÀN TẬP

## 1. Hệ thức cơ bản & Cung liên kết
- sin²α + cos²α = 1  |  1 + tan²α = 1/cos²α  |  1 + cot²α = 1/sin²α
- Ghi nhớ cung liên kết: **Cos đối – Sin bù – Phụ chéo – Hơn kém π tan, cot**.

## 2. Công thức cộng & Nhân đôi
- sin(a ± b) = sin a·cos b ± cos a·sin b
- cos(a ± b) = cos a·cos b ∓ sin a·sin b
- sin 2a = 2 sin a·cos a
- cos 2a = cos²a - sin²a = 2cos²a - 1 = 1 - 2sin²a

## 3. Công thức hạ bậc & Biến đổi
- cos²a = (1 + cos 2a)/2  |  sin²a = (1 - cos 2a)/2
- cos a + cos b = 2 cos((a+b)/2) cos((a-b)/2)
- cos a - cos b = -2 sin((a+b)/2) sin((a-b)/2)
- sin a + sin b = 2 sin((a+b)/2) cos((a-b)/2)
- sin a - sin b = 2 cos((a+b)/2) sin((a-b)/2)`,
    fav: false
  },
  {
    id: 10,
    t: 'Hình học không gian & Tọa độ Oxyz + GeoGebra 3D',
    sub: 'Toán',
    type: 'Tài liệu',
    d: 'Vector, tích có hướng, phương trình mặt phẳng, đường thẳng, mặt cầu và thực hành trực quan trên GeoGebra 3D.',
    url: 'https://www.geogebra.org/3d',
    fileType: 'text',
    fileContent: `# HÌNH HỌC KHÔNG GIAN & TỌA ĐỘ OXYZ

## 1. Tích vô hướng & Tích có hướng
- Cho u = (x₁; y₁; z₁) và v = (x₂; y₂; z₂):
  - Tích vô hướng: **u · v = x₁x₂ + y₁y₂ + z₁z₂** (u ⊥ v ⇔ u · v = 0)
  - Tích có hướng: **[u, v] = (y₁z₂ - y₂z₁ ; z₁x₂ - z₂x₁ ; x₁y₂ - x₂y₁)**
  - Diện tích tam giác ABC: S = ½ |[AB, AC]|
  - Thể tích tứ diện ABCD: V = ⅙ |[AB, AC] · AD|

## 2. Mặt phẳng, Đường thẳng & Mặt cầu
- **Mặt phẳng (P):** Ax + By + Cz + D = 0 có VTPT n = (A; B; C).
- **Khoảng cách từ M(x₀; y₀; z₀) đến (P):** d(M, (P)) = |Ax₀ + By₀ + Cz₀ + D| / √(A² + B² + C²).
- **Mặt cầu (S):** (x - a)² + (y - b)² + (z - c)² = R² tâm I(a; b; c), bán kính R.

🔗 **Công cụ 3D tương tác:** Mở GeoGebra 3D từ liên kết đính kèm để dựng hình chóp, lăng trụ và mặt cầu Oxyz.`,
    fav: true
  },
  {
    id: 11,
    t: 'Hàm số Mũ – Lôgarit & Bài toán Lãi suất thực tế',
    sub: 'Toán',
    type: 'Mẫu bài',
    d: 'Quy tắc lũy thừa, công thức đổi cơ số lôgarit, bất phương trình mũ/log và công thức lãi kép ngân hàng.',
    url: 'https://www.khanacademy.org/math/algebra2',
    fileType: 'text',
    fileContent: `# MŨ – LÔGARIT & BÀI TOÁN LÃI SUẤT

## 1. Công thức Lôgarit (a > 0, a ≠ 1; b, c > 0)
- logₐ(b·c) = logₐ b + logₐ c
- logₐ(b/c) = logₐ b - logₐ c
- logₐ(bⁿ) = n·logₐ b  |  log_(aⁿ) b = (1/n)·logₐ b
- Công thức đổi cơ số: **logₐ b = log_c b / log_c a = 1 / log_b a**

## 2. Giải phương trình & bất phương trình cơ bản
- a^(f(x)) > a^(g(x)):
  - Nếu a > 1 ⇔ f(x) > g(x) (cùng chiều)
  - Nếu 0 < a < 1 ⇔ f(x) < g(x) (đổi chiều)

## 3. Công thức tăng trưởng & Lãi kép
- Gửi tiết kiệm số tiền ban đầu A, lãi suất r%/kỳ, sau n kỳ:
  👉 **Tₙ = A · (1 + r)ⁿ**
- Gửi đều đặn mỗi tháng số tiền A (đầu kỳ):
  👉 **Tₙ = [A(1 + r)/r] · [(1 + r)ⁿ - 1]**`,
    fav: false
  },
  {
    id: 12,
    t: 'Tổ hợp – Xác suất & Quy tắc đếm nâng cao',
    sub: 'Toán',
    type: 'Đề thi',
    d: 'Hoán vị, chỉnh hợp, tổ hợp, khai triển Nhị thức Newton và công thức tính xác suất biến cố.',
    url: 'https://www.wolframalpha.com/examples/mathematics/probability',
    fileType: 'text',
    fileContent: `# TỔ HỢP – XÁC SUẤT & NHỊ THỨC NEWTON

## 1. Hoán vị – Chỉnh hợp – Tổ hợp
- Hoán vị n phần tử: **Pₙ = n!**
- Chỉnh hợp chập k của n (có thứ tự): **Aₙᵏ = n! / (n - k)!**
- Tổ hợp chập k của n (không thứ tự): **Cₙᵏ = n! / [k!(n - k)!]**

## 2. Nhị thức Newton
- (a + b)ⁿ = Σ (k=0..n) Cₙᵏ · aⁿ⁻ᵏ · bᵏ
- Hệ quả hay dùng: Cₙ⁰ + Cₙ¹ + ... + Cₙⁿ = 2ⁿ

## 3. Xác suất cổ điển & Quy tắc tính
- Xác suất biến cố A: **P(A) = n(A) / n(Ω)**
- Biến cố đối: **P(Ā) = 1 - P(A)**
- Quy tắc cộng (xung khắc): P(A ∪ B) = P(A) + P(B)
- Quy tắc nhân (độc lập): P(A ∩ B) = P(A) · P(B)`,
    fav: false
  }
];

export const INITIAL_TEACHER_MATH_VAULT: LibraryItem[] = [
  {
    id: 9001,
    t: 'Giáo án Hàm số bậc hai, Tam thức bậc hai & Bất phương trình (Toán 10)',
    sub: 'Toán',
    gradeLevel: 'Toán 10',
    type: 'Giáo án',
    isPermanent: true,
    fav: true,
    d: 'Tài liệu giảng dạy chuẩn GDPT 2018 gồm đồ thị Parabol, định lý dấu tam thức bậc hai, bài toán chứa tham số m và hệ thống ví dụ phân hóa.',
    url: 'https://www.desmos.com/calculator?lang=vi',
    fileType: 'text',
    fileContent: `# GIÁO ÁN TOÁN 10: HÀM SỐ BẬC HAI & TAM THỨC BẬC HAI

## 1. Hàm số bậc hai y = ax² + bx + c (a ≠ 0)
- Đỉnh Parabol: I(-b/(2a) ; -Δ/(4a)) với Δ = b² - 4ac.
- Trục đối xứng: x = -b/(2a).
- Nếu a > 0: Bề lõm hướng lên; hàm số nghịch biến trên (-∞ ; -b/(2a)) và đồng biến trên (-b/(2a) ; +∞).
- Nếu a < 0: Bề lõm hướng xuống; hàm số đồng biến trên (-∞ ; -b/(2a)) và nghịch biến trên (-b/(2a) ; +∞).

## 2. Định lý về dấu tam thức bậc hai f(x) = ax² + bx + c (a ≠ 0)
- Trường hợp Δ < 0: f(x) luôn cùng dấu với hệ số a với mọi x ∈ ℝ.
- Trường hợp Δ = 0: f(x) cùng dấu với a với mọi x ≠ -b/(2a), và f(-b/(2a)) = 0.
- Trường hợp Δ > 0: f(x) có hai nghiệm x₁ < x₂. Trong khoảng hai nghiệm (x₁ ; x₂), f(x) trái dấu với a; ngoài khoảng hai nghiệm, f(x) cùng dấu với a ("Trong trái – Ngoài cùng").

## 3. Điều kiện bất phương trình bậc hai đúng với mọi x ∈ ℝ
- ax² + bx + c > 0 ∀x ∈ ℝ ⇔ a > 0 và Δ < 0 (xét thêm trường hợp a = 0 nếu chứa tham số).
- ax² + bx + c ≥ 0 ∀x ∈ ℝ ⇔ a > 0 và Δ ≤ 0.
- ax² + bx + c < 0 ∀x ∈ ℝ ⇔ a < 0 và Δ < 0.

## 4. Bài tập luyện tập trên lớp (Gợi ý giảng dạy)
- Mức độ Thông hiểu: Lập bảng biến thiên và vẽ đồ thị y = x² - 4x + 3.
- Mức độ Vận dụng: Tìm tất cả giá trị tham số m để (m - 1)x² - 2(m - 1)x + 3 > 0 nghiệm đúng với mọi x ∈ ℝ.`
  },
  {
    id: 9002,
    t: 'Chuyên đề Hệ thức lượng trong Tam giác & Vectơ mặt phẳng (Toán 10)',
    sub: 'Toán',
    gradeLevel: 'Toán 10',
    type: 'Tài liệu',
    isPermanent: true,
    fav: true,
    d: 'Hệ thống công thức Định lý Cosin, Định lý Sin, 5 công thức diện tích tam giác, quy tắc cộng trừ vectơ và tích vô hướng.',
    url: 'https://www.geogebra.org/geometry',
    fileType: 'text',
    fileContent: `# CHUYÊN ĐỀ TOÁN 10: HỆ THỨC LƯỢNG & VECTƠ

## 1. Định lý Cosin & Định lý Sin trong tam giác ABC
- Định lý Cosin: a² = b² + c² - 2bc·cos A ; cos A = (b² + c² - a²) / (2bc).
- Định lý Sin: a / sin A = b / sin B = c / sin C = 2R (R là bán kính đường tròn ngoại tiếp).
- Độ dài đường trung tuyến: mₐ² = (b² + c²)/2 - a²/4.

## 2. 5 Công thức tính diện tích tam giác ABC
- S = ½ a·hₐ = ½ b·h_b = ½ c·h_c
- S = ½ ab·sin C = ½ bc·sin A = ½ ca·sin B
- S = abc / (4R)
- S = p·r (với p = (a + b + c)/2 là nửa chu vi, r là bán kính đường tròn nội tiếp)
- Công thức Heron: S = √[p(p - a)(p - b)(p - c)]

## 3. Tích vô hướng của hai vectơ & Ứng dụng tọa độ Oxy
- Định nghĩa: u · v = |u| · |v| · cos(u, v).
- Trong hệ tọa độ Oxy: Cho u = (x₁; y₁), v = (x₂; y₂):
  - u · v = x₁x₂ + y₁y₂
  - |u| = √(x₁² + y₁²)
  - u ⊥ v ⇔ x₁x₂ + y₁y₂ = 0
  - cos(u, v) = (x₁x₂ + y₁y₂) / [√(x₁² + y₁²) · √(x₂² + y₂²)].`
  },
  {
    id: 9003,
    t: 'Hệ thống Công thức & Phương trình Lượng giác trọng tâm (Toán 11)',
    sub: 'Toán',
    gradeLevel: 'Toán 11',
    type: 'Tài liệu',
    isPermanent: true,
    fav: false,
    d: 'Tổng hợp cung liên kết, công thức biến đổi, phương trình lượng giác cơ bản và kỹ thuật giải phương trình chứa tham số.',
    url: 'https://vi.wikipedia.org/wiki/L%C6%B0%E1%BB%A3ng_gi%C3%A1c',
    fileType: 'text',
    fileContent: `# CHUYÊN ĐỀ TOÁN 11: LƯỢNG GIÁC & PHƯƠNG TRÌNH LƯỢNG GIÁC

## 1. Quy tắc cung liên kết & Công thức biến đổi cốt lõi
- Ghi nhớ nhanh: Cos đối – Sin bù – Phụ chéo – Hơn kém π tan, cot.
- Công thức cộng:
  - sin(a ± b) = sin a·cos b ± cos a·sin b
  - cos(a ± b) = cos a·cos b ∓ sin a·sin b
  - tan(a ± b) = (tan a ± tan b) / (1 ∓ tan a·tan b)
- Công thức nhân đôi & hạ bậc:
  - sin 2a = 2 sin a·cos a
  - cos 2a = cos²a - sin²a = 2cos²a - 1 = 1 - 2sin²a
  - cos²a = (1 + cos 2a)/2 ; sin²a = (1 - cos 2a)/2.

## 2. Công thức nghiệm phương trình lượng giác cơ bản (k ∈ ℤ)
- sin x = sin α ⇔ x = α + k2π hoặc x = π - α + k2π.
- cos x = cos α ⇔ x = ±α + k2π.
- tan x = tan α ⇔ x = α + kπ (điều kiện: cos x ≠ 0).
- cot x = cot α ⇔ x = α + kπ (điều kiện: sin x ≠ 0).

## 3. Lưu ý sư phạm khi chấm bài học sinh
- Luôn kiểm tra điều kiện xác định của mẫu số và hàm tan x, cot x.
- Đối chiếu nghiệm trên khoảng/đoạn [a; b] bằng đường tròn lượng giác hoặc bất phương trình chặn k.`
  },
  {
    id: 9004,
    t: 'Giáo án Khảo sát Hàm số, Cực trị & Tiệm cận (Toán 12)',
    sub: 'Toán',
    gradeLevel: 'Toán 12',
    type: 'Giáo án',
    isPermanent: true,
    fav: true,
    d: 'Quy trình giảng dạy 4 bước khảo sát hàm bậc 3, phân thức bậc 1/1 và bậc 2/1 theo SGK mới, kèm bài toán tham số m.',
    url: 'https://www.desmos.com/calculator?lang=vi',
    fileType: 'text',
    fileContent: `# GIÁO ÁN TOÁN 12: ỨNG DỤNG ĐẠO HÀM & KHẢO SÁT HÀM SỐ

## 1. Bảng đạo hàm cần thuộc
- (xⁿ)' = n·xⁿ⁻¹  |  (uⁿ)' = n·uⁿ⁻¹·u'
- (√u)' = u' / (2√u)
- (eˣ)' = eˣ  |  (aˣ)' = aˣ·ln a
- (ln x)' = 1/x  |  (logₐ x)' = 1/(x·ln a)
- (sin u)' = u'·cos u  |  (cos u)' = -u'·sin u

## 2. Điều kiện đơn điệu của hàm bậc ba y = ax³ + bx² + cx + d (a ≠ 0)
- Đạo hàm: y' = 3ax² + 2bx + c.
- Hàm số đồng biến trên ℝ ⇔ a > 0 và Δ' = b² - 3ac ≤ 0.
- Hàm số nghịch biến trên ℝ ⇔ a < 0 và Δ' = b² - 3ac ≤ 0.
- Hàm số có 2 điểm cực trị ⇔ Δ' = b² - 3ac > 0.

## 3. Tiệm cận đứng, tiệm cận ngang & tiệm cận xiên (GDPT 2018)
- Tiệm cận đứng x = x₀: lim(x→x₀⁺) f(x) = ±∞ hoặc lim(x→x₀⁻) f(x) = ±∞.
- Tiệm cận ngang y = y₀: lim(x→+∞) f(x) = y₀ hoặc lim(x→-∞) f(x) = y₀.
- Tiệm cận xiên y = ax + b (a ≠ 0):
  - a = lim(x→±∞) [f(x)/x]
  - b = lim(x→±∞) [f(x) - ax].`
  },
  {
    id: 9005,
    t: 'Chuyên đề Nguyên hàm – Tích phân & Ứng dụng Hình học (Toán 12)',
    sub: 'Toán',
    gradeLevel: 'Toán 12',
    type: 'Tài liệu',
    isPermanent: true,
    fav: true,
    d: 'Tổng hợp bảng nguyên hàm chuẩn, tích phân từng phần, đổi biến và các dạng toán diện tích – thể tích khối tròn xoay.',
    url: 'https://vi.wikipedia.org/wiki/T%C3%ADch_ph%C3%A2n',
    fileType: 'text',
    fileContent: `# CHUYÊN ĐỀ TOÁN 12: NGUYÊN HÀM – TÍCH PHÂN

## 1. Bảng nguyên hàm cơ bản & mở rộng
- ∫ xⁿ dx = xⁿ⁺¹/(n + 1) + C  (n ≠ -1)
- ∫ (1/x) dx = ln|x| + C
- ∫ (1/(ax + b)) dx = (1/a)·ln|ax + b| + C
- ∫ e^(ax + b) dx = (1/a)·e^(ax + b) + C
- ∫ aˣ dx = aˣ / ln a + C
- ∫ cos(ax + b) dx = (1/a)·sin(ax + b) + C
- ∫ sin(ax + b) dx = -(1/a)·cos(ax + b) + C

## 2. Phương pháp tính tích phân trọng tâm
- Đổi biến số loại 1: Đặt t = u(x) ⇒ dt = u'(x)dx, đổi cận x = a → t = u(a), x = b → t = u(b).
- Tích phân từng phần: ∫ₐᵇ u dv = [u·v]ₐᵇ - ∫ₐᵇ v du.
- Thứ tự ưu tiên đặt u: Nhất lô (ln, log) – Nhì đa (đa thức) – Tam lượng (sin, cos) – Tứ mũ (eˣ, aˣ).

## 3. Diện tích hình phẳng & Thể tích khối tròn xoay
- Diện tích hình phẳng giới hạn bởi y = f(x), y = g(x), x = a, x = b:
  S = ∫ₐᵇ |f(x) - g(x)| dx.
- Thể tích khối tròn xoay khi quay hình phẳng quanh trục Ox:
  V = π · ∫ₐᵇ [f(x)]² dx.`
  },
  {
    id: 9006,
    t: 'Chuyên đề Hình học Không gian & Tọa độ Oxyz (Toán 12)',
    sub: 'Toán',
    gradeLevel: 'Toán 12',
    type: 'Tài liệu',
    isPermanent: true,
    fav: false,
    d: 'Vector Oxyz, tích có hướng, phương trình mặt phẳng, đường thẳng, mặt cầu và công thức tính khoảng cách – góc trong không gian.',
    url: 'https://www.geogebra.org/3d',
    fileType: 'text',
    fileContent: `# CHUYÊN ĐỀ TOÁN 12: HÌNH HỌC TỌA ĐỘ OXYZ

## 1. Phép toán Vectơ trong không gian Oxyz
- Cho u = (x₁; y₁; z₁) và v = (x₂; y₂; z₂):
  - Tích vô hướng: u · v = x₁x₂ + y₁y₂ + z₁z₂
  - Tích có hướng: [u, v] = (y₁z₂ - y₂z₁ ; z₁x₂ - z₂x₁ ; x₁y₂ - x₂y₁)
  - Diện tích tam giác ABC: S = ½ |[AB, AC]|
  - Thể tích tứ diện ABCD: V = ⅙ |[AB, AC] · AD|.

## 2. Phương trình Mặt phẳng, Đường thẳng & Mặt cầu
- Mặt phẳng (P): Ax + By + Cz + D = 0 có vectơ pháp tuyến n = (A; B; C).
- Khoảng cách từ M(x₀; y₀; z₀) đến (P):
  d(M, (P)) = |Ax₀ + By₀ + Cz₀ + D| / √(A² + B² + C²).
- Đường thẳng Δ đi qua M₀(x₀; y₀; z₀) có VTCP u = (a; b; c):
  x = x₀ + at ; y = y₀ + bt ; z = z₀ + ct.
- Mặt cầu (S) tâm I(a; b; c), bán kính R:
  (x - a)² + (y - b)² + (z - c)² = R².

## 3. Công thức tính góc trong không gian
- Góc giữa hai mặt phẳng (P), (Q): cos((P), (Q)) = |n_P · n_Q| / (|n_P| · |n_Q|).
- Góc giữa đường thẳng Δ và mặt phẳng (P): sin(Δ, (P)) = |u_Δ · n_P| / (|u_Δ| · |n_P|).`
  },
  {
    id: 9007,
    t: 'Ma trận Đề kiểm tra & Đề cương Ôn thi Toán THPT (Cấu trúc 2025–2026)',
    sub: 'Toán',
    gradeLevel: 'Chuyên đề THPT',
    type: 'Đề thi',
    isPermanent: true,
    fav: true,
    d: 'Mẫu ma trận đề kiểm tra 3 phần môn Toán theo cấu trúc Bộ GD&ĐT (Trắc nghiệm 4 chọn 1, Đúng/Sai, Trả lời ngắn) dùng cho giáo viên ra đề.',
    url: 'https://www.wolframalpha.com/examples/mathematics',
    fileType: 'text',
    fileContent: `# MA TRẬN ĐỀ KIỂM TRA MÔN TOÁN THPT (CHUẨN GDPT 2018)

## 1. Cấu trúc đề thi chuẩn 90 phút (Tổng 10,0 điểm)
- Phần I – Trắc nghiệm nhiều phương án lựa chọn (12 câu · 3,0 điểm):
  - Mỗi câu 0,25 điểm, kiểm tra mức độ Nhận biết và Thông hiểu.
- Phần II – Trắc nghiệm Đúng/Sai (4 câu · 4,0 điểm):
  - Mỗi câu gồm 4 ý a, b, c, d. Thang điểm lũy tiến: đúng 1 ý (0,1đ), 2 ý (0,25đ), 3 ý (0,5đ), 4 ý (1,0đ).
- Phần III – Trắc nghiệm Trả lời ngắn (6 câu · 3,0 điểm):
  - Mỗi câu 0,5 điểm, tập trung bài toán thực tế, tối ưu và vận dụng cao.

## 2. Phân bổ chuyên đề trọng tâm ôn tập học kỳ & Tốt nghiệp
- Khối 10: Mệnh đề – Tập hợp, Bất phương trình bậc nhất hai ẩn, Hàm số bậc hai, Hệ thức lượng & Vectơ, Thống kê – Xác suất.
- Khối 11: Lượng giác, Dãy số – Cấp số cộng/nhân, Giới hạn – Liên tục, Mũ & Lôgarit, Quan hệ vuông góc trong không gian.
- Khối 12: Ứng dụng đạo hàm khảo sát hàm số, Vectơ & Tọa độ Oxyz, Nguyên hàm – Tích phân, Xác suất có điều kiện (Công thức Bayes).`
  }
];


export const INITIAL_COUNTDOWNS: CountdownItem[] = [
  {
    id: 1,
    title: 'Kỳ thi Tốt nghiệp THPT Quốc gia',
    targetDate: '2027-06-26',
    targetTime: '07:30',
    category: 'thpt',
    color: 'rose',
    targetScore: 'Mục tiêu: 28.0+ điểm Khối A00 / D01',
    note: 'Kiên trì từng ngày, mỗi bài tập giải hôm nay là một bước vững chắc bước vào giảng đường Đại học mơ ước!'
  },
  {
    id: 2,
    title: 'Kỳ thi Học sinh giỏi (HSG) Cấp Tỉnh',
    targetDate: '2027-01-15',
    targetTime: '07:00',
    category: 'hsg',
    color: 'emerald',
    targetScore: 'Mục tiêu: Đạt giải Nhất môn Toán / Tin học',
    note: 'Vượt qua giới hạn bản thân, tự tin vào những tháng ngày ôn luyện bền bỉ.'
  },
  {
    id: 3,
    title: 'Kỳ thi Giữa Học Kỳ',
    targetDate: '2026-11-20',
    targetTime: '07:30',
    category: 'term',
    color: 'amber',
    targetScore: 'Mục tiêu: Điểm trung bình các môn ≥ 9.0',
    note: 'Nắm chắc kiến thức cơ bản trong sách giáo khoa và luyện các dạng bài tập thầy cô đã giao.'
  },
  {
    id: 4,
    title: 'Kỳ thi Chứng chỉ IELTS / Tin học quốc tế',
    targetDate: '2027-04-10',
    targetTime: '08:00',
    category: 'cert',
    color: 'blue',
    targetScore: 'Mục tiêu: IELTS Band 7.5+',
    note: 'Duy trì luyện nghe và đọc tiếng Anh 30 phút mỗi sáng.'
  }
];

export const INITIAL_FOLDERS: { id: string; name: string; tag?: string; examCount?: number }[] = [];

export const INITIAL_EXAMS: any[] = [
  {
    id: 101,
    title: 'vantien1304-SỬ',
    subject: 'Lịch sử',
    durationMinutes: 90,
    submissionsCount: 7,
    status: 'published',
    assignedTo: 'Tất cả mọi người',
    assignedAt: '27/10/2026 19:13',
    createdAt: '27/10/2026 19:13',
    price: 'Miễn phí',
    isRecommended: true,
    description: 'Đề thi thử khảo sát kiến thức Lịch sử Việt Nam và Lịch sử Thế giới hiện đại - Phân hóa mức độ nhận biết, thông hiểu và vận dụng.',
    questions: [
      {
        id: 1,
        questionText: 'Hội nghị Ban Chấp hành Trung ương Đảng Cộng sản Đông Dương tháng 5/1941 đã chủ trương thành lập mặt trận nào?',
        options: [
          'A. Mặt trận Việt Minh (Việt Nam Độc lập Đồng minh)',
          'B. Mặt trận Thống nhất Dân tộc Phản đế Đông Dương',
          'C. Mặt trận Liên Việt',
          'D. Mặt trận Dân chủ Đông Dương'
        ],
        correctOption: 0,
        explanation: 'Tháng 5/1941, tại Pác Bó (Cao Bằng), Hội nghị Trung ương 8 do Nguyễn Ái Quốc chủ trì quyết định thành lập Mặt trận Việt Nam Độc lập Đồng minh (gọi tắt là Việt Minh).'
      },
      {
        id: 2,
        questionText: 'Thắng lợi nào của quân dân ta đã buộc thực dân Pháp phải ký Hiệp định Giơ-ne-vơ năm 1954 về Đông Dương?',
        options: [
          'A. Chiến thắng Việt Bắc thu - đông 1947',
          'B. Chiến dịch Biên giới thu - đông 1950',
          'C. Chiến thắng lịch sử Điện Biên Phủ 1954',
          'D. Cuộc tiến công chiến lược Đông - Xuân 1953 - 1954'
        ],
        correctOption: 2,
        explanation: 'Chiến thắng Điện Biên Phủ "lừng lẫy năm châu, chấn động địa cầu" ngày 7/5/1954 đã đập tan kế hoạch Nava và buộc Pháp ký Hiệp định Giơ-ne-vơ chấm dứt chiến tranh xâm lược.'
      },
      {
        id: 3,
        questionText: 'Sự kiện nào đánh dấu bước ngoặt chấm dứt hoàn toàn sự thống trị của chủ nghĩa thực dân cũ ở Việt Nam?',
        options: [
          'A. Cách mạng tháng Tám năm 1945 thành công',
          'B. Chiến dịch Hồ Chí Minh lịch sử 1975 toàn thắng',
          'C. Hiệp định Paris năm 1973 được ký kết',
          'D. Tổng tuyển cử bầu Quốc hội khóa I năm 1946'
        ],
        correctOption: 0,
        explanation: 'Cách mạng tháng Tám 1945 đã lật đổ ách thống trị của phát xít Nhật và thực dân Pháp hơn 80 năm, xóa bỏ chế độ phong kiến ngàn năm.'
      },
      {
        id: 4,
        questionText: 'Năm 1945, nhân dân Việt Nam giành được chính quyền từ tay lực lượng nào?',
        options: [
          'A. Thực dân Pháp',
          'B. Phát xít Nhật',
          'C. Quân đội Tưởng Giới Thạch',
          'D. Quân đội Anh'
        ],
        correctOption: 1,
        explanation: 'Ngày 9/3/1945 Nhật đảo chính Pháp. Trong Tổng khởi nghĩa tháng Tám năm 1945, nhân dân ta đứng lên giành chính quyền từ tay phát xít Nhật và chính phủ bù nhìn tay sai.'
      },
      {
        id: 5,
        questionText: 'Mục tiêu cao nhất của Đảng và nhân dân ta trong giai đoạn 1939 - 1945 là gì?',
        options: [
          'A. Đấu tranh đòi tự do, dân chủ, cơm áo, hòa bình',
          'B. Tạm gác khẩu hiệu cách mạng ruộng đất, tập trung giải phóng dân tộc',
          'C. Cải cách văn hóa giáo dục',
          'D. Xây dựng chủ nghĩa xã hội'
        ],
        correctOption: 1,
        explanation: 'Tại Hội nghị Trung ương 6 (1939) và Hội nghị Trung ương 8 (1941), Đảng ta xác định nhiệm vụ giải phóng dân tộc là bức thiết nhất, hàng đầu của cách mạng.'
      }
    ]
  },
  {
    id: 102,
    title: 'Đề thi thử THPT Quốc Gia - Môn Toán (Mã đề 102)',
    subject: 'Toán học',
    durationMinutes: 90,
    submissionsCount: 19,
    status: 'published',
    assignedTo: 'Tất cả mọi người',
    assignedAt: '25/10/2026 08:00',
    createdAt: '25/10/2026 08:00',
    price: 'Miễn phí',
    isRecommended: false,
    description: 'Bộ đề thi chuẩn hóa bám sát cấu trúc đề minh họa Bộ Giáo dục và Đào tạo gồm hàm số, tích phân, hình học không gian Oxyz và xác suất.',
    questions: [
      {
        id: 11,
        questionText: 'Cho hàm số y = f(x) có bảng biến thiên với f\'(x) > 0 trên khoảng (1; 3). Mệnh đề nào sau đây đúng?',
        options: [
          'A. Hàm số nghịch biến trên khoảng (1; 3)',
          'B. Hàm số đồng biến trên khoảng (1; 3)',
          'C. Hàm số đạt cực đại tại x = 2',
          'D. Hàm số không đổi trên khoảng (1; 3)'
        ],
        correctOption: 1,
        explanation: 'Đạo hàm f\'(x) > 0 trên khoảng (a; b) suy ra hàm số đồng biến trên khoảng đó.'
      },
      {
        id: 12,
        questionText: 'Tập nghiệm của bất phương trình log₂(x - 1) < 3 là:',
        options: [
          'A. (1; 9)',
          'B. (-∞; 9)',
          'C. (1; 8)',
          'D. (2; 9)'
        ],
        correctOption: 0,
        explanation: 'Điều kiện: x - 1 > 0 ⇔ x > 1. Khi đó x - 1 < 2³ = 8 ⇔ x < 9. Kết hợp điều kiện ta được tập nghiệm (1; 9).'
      }
    ]
  },
  {
    id: 103,
    title: 'Đề kiểm tra Tiếng Anh THPT - Reading & Grammar',
    subject: 'Tiếng Anh',
    durationMinutes: 60,
    submissionsCount: 14,
    status: 'published',
    assignedTo: 'Tất cả mọi người',
    assignedAt: '26/10/2026 14:00',
    createdAt: '26/10/2026 14:00',
    price: 'Miễn phí',
    isRecommended: false,
    description: 'Kiểm tra ngữ pháp trọng điểm: thì của động từ, mệnh đề quan hệ, câu bị động và đọc hiểu.',
    questions: [
      {
        id: 21,
        questionText: 'If she had studied harder for the exam, she ______ higher grades.',
        options: [
          'A. would get',
          'B. would have got',
          'C. will get',
          'D. had got'
        ],
        correctOption: 1,
        explanation: 'Câu điều kiện loại 3 diễn tả sự việc trái ngược với thực tế quá khứ: If + had + P2, S + would have + P2.'
      }
    ]
  }
];

export const STUDY_TIPS = [
  'Kỹ thuật Pomodoro: Học 25 phút, nghỉ 5 phút giúp não duy trì sự tập trung tối ưu.',
  'Chủ động gợi nhớ (Active Recall) hiệu quả gấp 3 lần việc chỉ đọc lại tài liệu nhiều lần.',
  'Giải thích lại kiến thức cho một người khác (Kỹ thuật Feynman) là cách tốt nhất để hiểu sâu.',
  'Uống đủ nước và ngủ đủ 7-8 tiếng trước ngày thi để não lưu trữ ký ức dài hạn tốt nhất.',
  'Ôn ngắt quãng (Spaced Repetition): Ôn lại sau 1 ngày, 3 ngày, 1 tuần để nhớ lâu hơn gấp nhiều lần.'
];

export const COPYRIGHT_INFO = {
  appName: 'StudyFlow – Quản lý học tập',
  version: '2.5.0 Pro Edition',
  author: 'Trần Văn Tiến',
  email: 'tranvantien13042009@gmail.com',
  year: '2026',
  license: 'Bản quyền được đăng ký & bảo lưu bởi tác giả.',
  description: 'Hệ thống quản lý học tập đa năng dành cho học sinh, sinh viên và giáo viên Việt Nam.'
};

export const INITIAL_STUDENT_PROFILE: StudentProfile = {
  name: 'Trần Văn Tiến',
  className: '12A1',
  schoolName: 'THPT Nguyễn Văn Trỗi',
  avatar: '/assets/student_avatar_fixed.jpg',
  avatarUpdatedAt: 1794922224224,
  subjects: [
    { name: 'Toán học', currentScore: 8.5, targetScore: 9.5 },
    { name: 'Vật lí', currentScore: 7.2, targetScore: 9.0 },
    { name: 'Hóa học', currentScore: 8.0, targetScore: 9.0 },
    { name: 'Tiếng Anh', currentScore: 9.2, targetScore: 9.5 },
    { name: 'Ngữ văn', currentScore: 7.5, targetScore: 8.5 }
  ]
};

export const INITIAL_TEACHER_PROFILE: TeacherProfile = {
  name: 'Thầy Tuấn',
  username: 'giaovien',
  backupCode: 'giaovien',
  subject: 'Toán',
  password: '123456',
  avatar: '/assets/teacher_avatar_fixed.jpg',
  avatarUpdatedAt: 1794922210179
};

export const INITIAL_NOTICES: Notice[] = [
  {
    id: 1,
    title: '📢 Lịch ôn tập kiểm tra Giữa Kỳ 1 môn Vật lí & Toán',
    content: 'Các em học sinh lưu ý: Tuần tới chúng ta sẽ có bài kiểm tra khảo sát chất lượng giữa kỳ. Đề nghị các em ôn tập kỹ chuyên đề Dao động cơ và Đại số chương 2.',
    pinned: true,
    createdAt: '2026-10-28T08:00:00.000Z',
    reactions: { '❤️': 12, '👍': 18, '🔥': 9 }
  },
  {
    id: 2,
    title: '🎉 Lịch nộp bài tập lớn và Danh sách chia nhóm',
    content: 'Hạn nộp bài tập lớn nhóm là 23h59 ngày Chủ Nhật. Các nhóm nộp qua hệ thống StudyFlow hoặc gửi trực tiếp cho giáo viên bộ môn.',
    pinned: false,
    createdAt: '2026-10-29T10:30:00.000Z',
    reactions: { '❤️': 8, '👍': 14 }
  }
];

const students10A3 = buildRosterStudents('10A3', [
  ['Huỳnh Văn Quốc Anh', 6, 7, null, 7],
  ['Lương Văn Anh', 8, 7, null, 6],
  ['Nguyễn Đình Anh', 6, 8, null, 7],
  ['Nguyễn Đức Bảo', 5, 7, null, 7],
  ['Nguyễn Thị Thanh Chúc', 9, 10, null, 7],
  ['Nguyễn Thị Hoàng Dung', 8, 7, null, 8],
  ['Nguyễn Anh Duy', 9, 8, null, 7],
  ['Nguyễn Thùy Duyên', 8, 8, null, 9],
  ['Phạm Hồ Thùy Dương', 8, 7, null, 6],
  ['Trần Bảo Hân', 8, 8, null, 8],
  ['Hồ Việt Hoàng', 8, 6, null, 6],
  ['Bùi Ngọc Gia Huy', 9, 7, null, 6],
  ['Nguyễn Quốc Hưng', 9, 8, null, 7],
  ['Nguyễn Hữu Khang', 9, 10, null, 9],
  ['Nguyễn Minh Vĩnh Khang', 6, 7, null, 7],
  ['Dương Tuấn Khôi', 8, 7, null, 4],
  ['Đặng Phạm Cẩm Linh', 5, 10, null, 6],
  ['Nguyễn Thùy Linh', 9, 9, null, 8],
  ['Nguyễn Hồng Phi Long', 8, 10, null, 9],
  ['Nguyễn Thị Kiều My', 8, 8, null, 8],
  ['Phạm Ngọc Nam', 9, 7, null, 7],
  ['Hồ Phương Mỹ Ngọc', 8, 10, null, 9],
  ['Nguyễn Thiện Nhân', 8, 7, null, 7],
  ['Trần Nguyễn Hiền Nhân', 8, 7, null, 7],
  ['Nguyễn Ngọc Bảo Như', 8, 10, null, 6],
  ['Nguyễn Vũ Phong', 5, 8, null, 7],
  ['Nguyễn Đắc Thiên Phú', 8, 7, null, 7],
  ['Trần Trung Phúc', 8, 7, null, 6],
  ['Trần Thị Lệ Quyên', 10, 10, null, 8],
  ['Lâm Thanh Gia Quỳnh', 8, 8, null, 6],
  ['Lê Chí Tân', 8, 7, null, 7],
  ['Bùi Thị Bảo Thi', 8, 8, null, 7],
  ['Nguyễn Văn Thiện', 8, 8, null, 7],
  ['Nguyễn Ánh Anh Thư', 8, 7, null, 7],
  ['Nguyễn Trần Anh Thư', 8, null, null, null],
  ['Nguyễn Sinh Thương', 7, 7, null, 6],
  ['Đặng Nguyễn Thủy Tiên', 8, 8, null, 7],
  ['Phạm Ngọc Tiền', 8, 7, null, 7],
  ['Nguyễn Thị Quỳnh Trâm', 9, 9, null, 7],
  ['Nguyễn Mạnh Trí', 5, 8, null, 6],
  ['Bùi Nguyễn Thanh Trúc', 8, 7, null, 7],
  ['Lương Anh Tú', 8, 7, null, 7],
  ['Mạc Thị Ánh Tuyết', 8, 8, null, 7],
  ['Phan Phương Uyên', 6, 9, null, 8],
  ['Lê Thị Như Ý', 8, 8, null, 8]
]);

const students10A4 = buildRosterStudents('10A4', [
  ['Phạm Trường An', 10, 7, null, 9],
  ['Lê Văn Tuấn Anh', 8, 6, null, 7],
  ['Ngô Trần Hồng Anh', 2, 8, null, 8],
  ['Phạm Thị Kỳ Duyên', null, null, null, null],
  ['Nguyễn Khánh Đan', 7, 6, null, 8],
  ['Trần Phạm Bảo Đan', 9, null, null, 10],
  ['Nguyễn Anh Đức', 6, 7, null, 7],
  ['Huỳnh Ngọc Hải', 2, 6, null, 7],
  ['Lê Thị Minh Hằng', 6, 5, null, 2],
  ['Nguyễn Quỳnh Hoa', 6, 6, null, 4],
  ['Lê Đức Khang', 8, 7, null, 8],
  ['Trần Phú Khang', 8, 6, null, 7],
  ['Võ Anh Khôi', 6, null, null, 9],
  ['Lê Hà Kiều Linh', 4, 5, null, 6],
  ['Đặng Lê Tiến Long', 4, 8, null, 7],
  ['Trần Hữu Lộc', 9, 7, null, 7],
  ['Võ Tấn Lộc', 5, 6, null, 6],
  ['Đặng Thị Bích Ngọc', 10, 7, null, 8],
  ['Lê Văn Hạnh Nhân', 6, 10, null, 8],
  ['Đỗ Nguyễn Phương Nhi', 4, 6, null, 8],
  ['Hoàng Thị Yến Nhi', 8, 9, null, 8],
  ['Nguyễn Thị Kiều Như', 8, 9, null, 7],
  ['Trần Ngọc Oai', 6, 6, null, 7],
  ['Nguyễn Hoàng Phúc', 4, 7, null, 8],
  ['Lê Nguyễn Hoàng Quân', 8, 7, null, 7],
  ['Nguyễn Đình Quân', 6, 7, null, 4],
  ['Lê Ngọc Khánh Quỳnh', 10, 8, null, 9],
  ['Nguyễn Hữu Tài', 10, 7, null, 8],
  ['Võ Tấn Tài', 6, 6, null, 6],
  ['Đặng Cao Minh Thiện', 8, 6, null, 7],
  ['Nguyễn Ngọc Đức Thiện', 10, 10, null, 10],
  ['Nguyễn Mậu Minh Thông', 6, 6, null, 6],
  ['Nguyễn Vũ Hoàng Thuyết', 8, 7, null, 7],
  ['Hồ Văn Tịnh', 8, 6, null, 7],
  ['Trần Vy Quỳnh Trâm', 5, 6, null, 10],
  ['Lê Thị Trân', 2, 6, null, 2],
  ['Bùi Trần Trọng Trí', 8, 6, null, 4],
  ['Nguyễn Tấn Trường', 2, 6, null, 10],
  ['Phan Nguyễn Minh Trường', 2, 6, null, 6],
  ['Đặng Nguyễn Tường Vy', 8, 7, null, 8],
  ['Đinh Yến Vy', 10, 9, null, 10],
  ['Nguyễn Ngọc Tường Vy', 10, 10, null, 8],
  ['Nguyễn Thị Ngọc Vy', 8, 6, null, 7],
  ['Trần Ngọc Như Ý', 8, 7, null, 7],
  ['Nguyễn Thị Hoàng Yến', 10, 10, null, 9]
]);

const students10C3 = buildRosterStudents('10C3', [
  ['Bùi Ngọc Hoài An', 5, 5, null, 4],
  ["K' Phan Kim Anh", 5, null, null, null],
  ['Nguyễn Ngọc Tú Anh', 7, 7, null, 6],
  ['Lê Hữu Bảo', 7, 7, null, 8],
  ['Nguyễn Đỗ Gia Bảo', 3, 6, null, 4],
  ['Vương Nhật Mỹ Châu', 8, 7, null, 6],
  ['K Dãi', 5, 4, null, 4],
  ['Bùi Thị Ngọc Duyên', 10, 9, null, 4],
  ['Dành Thanh Dược', 7, 7, null, 5],
  ['Võ Văn Hào', 9, 9, null, 5],
  ['Nguyễn Hoàng Hậu', 3, 7, null, 6],
  ['Trần Kế Hiểu', 8, null, null, 4],
  ['Nguyễn Như Huy', 7, 7, null, 4],
  ['Giòng Thanh Huyền', 10, 8, null, 5],
  ['Lê Văn Khang', 7, 6, null, 6],
  ['Phó Duy Khang', 6, 8, null, 5],
  ['Phan Đăng Khôi', 6, null, null, 3],
  ['Nguyễn Hoàng Khương', 6, 4, null, 4],
  ['Nguyễn Thùy Linh', 10, 10, null, 9],
  ['Nguyễn Thị Cẩm Ly', 3, 7, null, null],
  ['Trần Xuân Minh', 5, 2, null, 4],
  ['Trần Trà My', 7, 7, null, 4],
  ['Trương Minh Kỳ Nam', 7, 8, null, 8],
  ['Ngô Thị Bích Ngọc', 8, 8, null, 5],
  ['Lê Văn Nhân', 5, 6, null, 6],
  ['Phạm Hoàng Yến Nhi', 3, null, null, null],
  ['Nguyễn Quỳnh Như', 7, 8, null, 4],
  ['Vũ Thành Phát', 6, 2, null, 4],
  ['Nguyễn Thị Ánh Phúc', 5, 7, null, 3],
  ['Đặng Hữu Nhật Quân', 3, 8, null, 4],
  ['Nguyễn Văn Quý', 8, 8, null, 6],
  ['Bờ Đam Thị Quyên', 5, 5, null, 6],
  ['Nguyễn Lê Kim My Sun', 3, 2, null, 4],
  ['Nguyễn Phương Thảo', 10, 9, null, 3],
  ['Nguyễn Thị Minh Thuận', 5, 5, null, 3],
  ['Phan Thị Kim Thư', 5, null, null, null],
  ['Nguyễn Thị Hoài Thương', 10, 10, null, 10],
  ['Lê Ý Cẩm Tiên', 3, 8, null, null],
  ['Bùi Huy Minh Tiến', 10, 10, null, 5],
  ['Nguyễn Thị Ngọc Trinh', 7, null, null, 6],
  ['Lê Thị Ngọc Trúc', 5, 6, null, 5],
  ['K Lê Anh Tú', 7, 3, null, 4],
  ['Phan Thanh Trường Vũ', null, null, null, null],
  ['Phạm Hoàng Yến', 6, null, null, 4]
]);

const students12A4 = buildRosterStudents('12A4', [
  ['Nguyễn Quỳnh Anh', 9, 8],
  ['Nguyễn Thị Ngọc Ánh', 10, 8],
  ['Nguyễn Duy Bảo', 9, 3],
  ['Lê Thanh Bin', 7, 2],
  ['Trương Thị Mỹ Duyên', null, 8],
  ['Bùi Thanh Đạt', null, 8],
  ['Vũ Cao Đạt', null, 9],
  ['Trần Minh Đăng', 9, 3],
  ['Trần Minh Đức', null, 9],
  ['Trần Ngọc Thúy Hiền', 9, 8],
  ['Nguyễn Trung Hiệu', 9, 9],
  ['Trịnh Gia Huy', 10, 8],
  ['Lê Thanh Hưng', 8, 5],
  ['Nguyễn Thị Thu Hương', null, 8],
  ['Trịnh Tuấn Khang', 8, 9],
  ['Lương Thế Kiệt', 7, 8],
  ['Bùi Nguyễn Hoàng Long', 9, 8],
  ['Ngô Long', 9, 10],
  ['Nguyễn Thị Thảo My', 8, 8],
  ['Phan Thị Hoàng My', 10, 10],
  ['Trương Thị Bích Ngân', 7, 5],
  ['Nguyễn Thị Thảo Nguyên', 10, 10],
  ['Đỗ Hân Nhi', 7, 7],
  ['Lê Hoàng Uyển Nhi', null, 7],
  ['Nguyễn Thị Ngọc Nhi', null, 7],
  ['Lương Võ Song Nhiên', 9, 9],
  ['Phan Thị Quỳnh Như', null, 7],
  ['Lê Thị Hoàng Oanh', 7, 7],
  ['Lê Quang Phát', 7, 5],
  ['Võ Văn Anh Phú', 9, 8],
  ['Trần Nguyễn Hồng Phúc', 8, 7],
  ['Nguyễn Đình Minh Thông', 4, 7],
  ['Nguyễn Thị Bảo Trâm', null, 8],
  ['Lê Sỹ Việt', 8, 5],
  ['Tiêu Đình Vũ', 9, 8],
  ['Trần Huy Vũ', 9, 7],
  ['Phạm Quang Vương', 8, 8],
  ['Lê Phạm Tường Vy', 5, 8],
  ['Nguyễn Đỗ Tường Vy', null, 7]
]);

const students12C2 = buildRosterStudents('12C2', [
  ['Phạm Quỳnh Anh', 5, 7],
  ['Trương Anh', 8, 9],
  ['Nguyễn Hồng Ân', 5, 8],
  ['Trần Thành Tâm Bảo', 8, 8],
  ['Nguyễn Ngọc Bảo Châu', 5, 8],
  ['Nguyễn Văn Danh', 4, 7],
  ['Hoàng Phi Đạt', 5, 7],
  ['Lê Văn Đạt', 7, 6],
  ['Võ Đại Giang', 8, 10],
  ['Hồ Huỳnh Công Hải', 5, 7],
  ['Cáp Hữu Hậu', 8, 7],
  ['Phạm Đinh Dịu Hiền', 5, 7],
  ['Trần Thị Mỹ Huyền', 5, 7],
  ['Trương Thị Mộng Kiều', 9, 10],
  ['Nguyễn Gia Linh', 10, 10],
  ['Nguyễn Hoàng Luân', 7, null],
  ['Đỗ Thị Ngọc Ly', 6, 9],
  ['Khổng Diệu Ngân', 4, 6],
  ['Đặng Ngọc Nghĩa', 10, 10],
  ['Lường Khánh Ngọc', 6, 6],
  ['Nguyễn Thị Mỹ Ngọc', 10, 10],
  ['Lâm Gia Như', 7, 7],
  ['Ngô Thị Quỳnh Như', 4, 7],
  ['Lê Minh Quân', 6, 8],
  ['Phan Anh Quốc', 3, 6],
  ['Phạm Thị Hồng Thắm', 6, 7],
  ['Cao Hữu Thắng', null, 7],
  ['Nguyễn Minh Thắng', 5, 8],
  ['Trần Thị Kim Thuyên', 3, 6],
  ['Nguyễn Thị Hoài Thương', 2, 8],
  ['Lê Thu Trang', 4, 7],
  ['Hoàng Nguyễn Thùy Trâm', 2, 9],
  ['Huỳnh Thị Bích Trâm', 7, 8],
  ['Phạm Đình Trí', 8, 10],
  ['Nguyễn Xuân Triết', 7, 9],
  ['Nguyễn Thị Thanh Trúc', 9, 8],
  ['Đỗ Mạnh Tú', 7, null],
  ['Phạm Anh Tuấn', 9, 10],
  ['Phạm Thị Ngọc Tuyền', 7, 7],
  ['Nguyễn Xuân Vỹ', 8, 6]
]);

export const INITIAL_TEACHER_CLASSES: TeacherClass[] = [
  {
    id: 'class_1',
    number: 1,
    name: 'Toán 10A3',
    subject: 'Toán',
    grade: 10,
    studentsCount: students10A3.length,
    lessonsCount: 14,
    examsCount: 3,
    avgScore: calcClassAvgScore(students10A3),
    room: 'Phòng 204',
    schedule: 'Thứ 2, Thứ 4 (Tiết 1-2)',
    students: students10A3
  },
  {
    id: 'class_2',
    number: 2,
    name: 'Toán 10A4',
    subject: 'Toán',
    grade: 10,
    studentsCount: students10A4.length,
    lessonsCount: 12,
    examsCount: 3,
    avgScore: calcClassAvgScore(students10A4),
    room: 'Phòng 305',
    schedule: 'Thứ 3, Thứ 6 (Tiết 3-4)',
    students: students10A4
  },
  {
    id: 'class_3',
    number: 3,
    name: 'Toán 10C3',
    subject: 'Toán',
    grade: 10,
    studentsCount: students10C3.length,
    lessonsCount: 20,
    examsCount: 3,
    avgScore: calcClassAvgScore(students10C3),
    room: 'Phòng Đa năng A',
    schedule: 'Thứ 5, Thứ 7 (Tiết 1-3)',
    students: students10C3
  },
  {
    id: 'class_4',
    number: 4,
    name: 'Toán 12A4',
    subject: 'Toán',
    grade: 12,
    studentsCount: students12A4.length,
    lessonsCount: 18,
    examsCount: 2,
    avgScore: calcClassAvgScore(students12A4),
    room: 'Phòng Đa năng B',
    schedule: 'Thứ 4, Chủ Nhật (Tiết 4-6)',
    students: students12A4
  },
  {
    id: 'class_5',
    number: 5,
    name: 'Toán 12C2',
    subject: 'Toán',
    grade: 12,
    studentsCount: students12C2.length,
    lessonsCount: 10,
    examsCount: 2,
    avgScore: calcClassAvgScore(students12C2),
    room: 'Lab 1',
    schedule: 'Thứ 2 (Tiết 3-5)',
    students: students12C2
  }
];


export const INITIAL_DECKS: FlashcardDeck[] = [
  {
    id: 'deck_1',
    title: 'Từ vựng IELTS Academic Band 7.5+',
    subject: 'Tiếng Anh',
    description: 'Bộ từ vựng học thuật C1/C2 nâng cao bám sát đề thi IELTS, kèm câu ví dụ ngữ cảnh thực tế.',
    cardCount: 8,
    remainingCount: 4,
    goodCount: 4,
    againCount: 2,
    createdAt: new Date().toISOString(),
    lastStudyDate: '2026-11-03T14:21:55.956Z',
    streak: 1,
    cards: [
      { id: 'c1', front: 'Ubiquitous', back: 'Phổ biến khắp nơi, đâu đâu cũng thấy', hint: 'Smartphones have become ubiquitous in modern society.', status: 'mastered', interval: 6, easiness: 2.6, repetitions: 2, isStarred: true },
      { id: 'c2', front: 'Mitigate', back: 'Làm giảm nhẹ, giảm bớt tác động tiêu cực', hint: 'Governments must act quickly to mitigate the impact of climate change.', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'c3', front: 'Pernicious', back: 'Có tác hại nguy hiểm, độc hại ngầm ngẫm', hint: 'The pernicious influence of disinformation on social media.', status: 'learning', interval: 1, easiness: 2.4, repetitions: 1, isStarred: false },
      { id: 'c4', front: 'Catalyst', back: 'Chất xúc tác, tác nhân thúc đẩy sự thay đổi', hint: 'Technological innovation acted as a catalyst for economic growth.', status: 'mastered', interval: 4, easiness: 2.5, repetitions: 2, isStarred: false },
      { id: 'c5', front: 'Resilience', back: 'Khả năng phục hồi, kiên cường vượt qua nghịch cảnh', hint: 'Students demonstrated remarkable resilience during the pandemic.', status: 'mastered', interval: 6, easiness: 2.6, repetitions: 2, isStarred: true },
      { id: 'c6', front: 'Pragmatic', back: 'Thực tế, thực dụng, dựa trên tính khả thi', hint: 'We need to adopt a pragmatic approach to solve this dilemma.', status: 'mastered', interval: 4, easiness: 2.5, repetitions: 2, isStarred: false },
      { id: 'c7', front: 'Exacerbate', back: 'Làm trầm trọng thêm, làm tồi tệ hơn', hint: 'Deforestation will exacerbate global warming and soil erosion.', status: 'again', interval: 0, easiness: 2.2, repetitions: 0, isStarred: false },
      { id: 'c8', front: 'Prevalent', back: 'Thịnh hành, phổ biến rộng rãi trong cộng đồng', hint: 'This health concern is especially prevalent among teenagers.', status: 'again', interval: 0, easiness: 2.2, repetitions: 0, isStarred: false }
    ]
  },
  {
    id: 'deck_2',
    title: 'Công thức Giải tích & Đạo hàm 12',
    subject: 'Toán',
    description: 'Tổng hợp các công thức đạo hàm cơ bản, đạo hàm hàm hợp, tích phân và nguyên hàm chuẩn THPTQG.',
    cardCount: 8,
    remainingCount: 7,
    goodCount: 1,
    againCount: 1,
    createdAt: new Date().toISOString(),
    lastStudyDate: '2 ngày trước',
    streak: 1,
    cards: [
      { id: 'm1', front: '(u · v)\'', back: 'u\'·v + u·v\' (Đạo hàm tích hai hàm số)', hint: 'Quy tắc nhân cơ bản', status: 'mastered', interval: 4, easiness: 2.5, repetitions: 1, isStarred: true },
      { id: 'm2', front: '(u / v)\'', back: '(u\'·v - u·v\') / v² (với v ≠ 0)', hint: 'Quy tắc chia hai hàm số', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'm3', front: '(sin x)\'', back: 'cos x', hint: 'Đạo hàm lượng giác cơ bản', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'm4', front: '(cos x)\'', back: '-sin x', hint: 'Lưu ý dấu âm đằng trước', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'm5', front: '(tan x)\'', back: '1 / cos²x = 1 + tan²x', hint: 'Đạo hàm hàm lượng giác', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'm6', front: '(ln x)\'', back: '1 / x (với điều kiện x > 0)', hint: 'Đạo hàm logarit tự nhiên', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'm7', front: '(e^x)\'', back: 'e^x', hint: 'Hàm số mũ cơ số e', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'm8', front: '∫ x^α dx', back: '(x^(α+1))/(α+1) + C (với α ≠ -1)', hint: 'Nguyên hàm hàm lũy thừa', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false }
    ]
  },
  {
    id: 'deck_3',
    title: 'Thuật ngữ Sinh học Di truyền & Gen',
    subject: 'Sinh Học',
    description: 'Bộ khái niệm trọng tâm về ADN, ARN, đột biến gen và quy luật di truyền Men-đen.',
    cardCount: 6,
    remainingCount: 5,
    goodCount: 1,
    againCount: 0,
    createdAt: new Date().toISOString(),
    lastStudyDate: 'Tuần trước',
    streak: 1,
    cards: [
      { id: 'b1', front: 'Đột biến điểm (Point mutation)', back: 'Là những biến đổi trong cấu trúc của gen liên quan đến một cặp nuclêôtit (thay thế, thêm hoặc mất).', hint: 'Liên quan đến đúng 1 cặp nu', status: 'mastered', interval: 5, easiness: 2.5, repetitions: 1, isStarred: true },
      { id: 'b2', front: 'Mã di truyền có tính thoái hóa', back: 'Nhiều bộ ba khác nhau cùng mã hóa cho một loại axit amin (trừ hai bộ ba AUG và UGG).', hint: 'Tính dư thừa của mã di truyền', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'b3', front: 'Nguyên tắc bổ sung trong ADN', back: 'A liên kết với T bằng 2 liên kết hiđrô, G liên kết với X bằng 3 liên kết hiđrô.', hint: 'A-T, G-X', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'b4', front: 'Alen (Allele)', back: 'Các trạng thái khác nhau của cùng một gen, chiếm cùng một locus trên cặp nhiễm sắc thể tương đồng.', hint: 'Trạng thái biểu hiện của gen', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'b5', front: 'Phiên mã (Transcription)', back: 'Quá trình tổng hợp phân tử ARN trên mạch khuôn ADN do enzim ARN polimeraza xúc tác.', hint: 'ADN -> mARN', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false },
      { id: 'b6', front: 'Dịch mã (Translation)', back: 'Quá trình tổng hợp chuỗi pôlipeptit (protein) dựa trên thông tin di truyền chứa trong mARN.', hint: 'mARN -> Protein tại Ribosome', status: 'learning', interval: 1, easiness: 2.5, repetitions: 1, isStarred: false }
    ]
  }
];

export const INITIAL_SUBMISSIONS: import('../types').ExamSubmission[] = [
  // Exam 101: vantien1304-SỬ (7 submissions, 5 questions: id 1..5, correctOption: 0,2,0,1,1)
  {
    id: 910101,
    examId: 101,
    examTitle: 'vantien1304-SỬ',
    studentName: 'Nguyễn Thị Thanh Chúc',
    score: 10.0,
    correctCount: 5,
    totalQuestions: 5,
    submittedAt: '28/10/2026 19:45',
    timeSpentSeconds: 1840,
    answers: { 1: 0, 2: 2, 3: 0, 4: 1, 5: 1 }
  },
  {
    id: 910102,
    examId: 101,
    examTitle: 'vantien1304-SỬ',
    studentName: 'Trần Văn Tiến',
    score: 8.0,
    correctCount: 4,
    totalQuestions: 5,
    submittedAt: '28/10/2026 20:10',
    timeSpentSeconds: 2120,
    answers: { 1: 0, 2: 2, 3: 0, 4: 1, 5: 0 }
  },
  {
    id: 910103,
    examId: 101,
    examTitle: 'vantien1304-SỬ',
    studentName: 'Nguyễn Hữu Khang',
    score: 8.0,
    correctCount: 4,
    totalQuestions: 5,
    submittedAt: '28/10/2026 20:32',
    timeSpentSeconds: 1960,
    answers: { 1: 0, 2: 2, 3: 0, 4: 0, 5: 1 }
  },
  {
    id: 910104,
    examId: 101,
    examTitle: 'vantien1304-SỬ',
    studentName: 'Phạm Hồ Thùy Dương',
    score: 6.0,
    correctCount: 3,
    totalQuestions: 5,
    submittedAt: '29/10/2026 08:15',
    timeSpentSeconds: 2450,
    answers: { 1: 0, 2: 2, 3: 1, 4: 1, 5: 0 }
  },
  {
    id: 910105,
    examId: 101,
    examTitle: 'vantien1304-SỬ',
    studentName: 'Hồ Việt Hoàng',
    score: 6.0,
    correctCount: 3,
    totalQuestions: 5,
    submittedAt: '29/10/2026 09:05',
    timeSpentSeconds: 2610,
    answers: { 1: 0, 2: 1, 3: 0, 4: 1, 5: 2 }
  },
  {
    id: 910106,
    examId: 101,
    examTitle: 'vantien1304-SỬ',
    studentName: 'Dương Tuấn Khôi',
    score: 4.0,
    correctCount: 2,
    totalQuestions: 5,
    submittedAt: '29/10/2026 14:22',
    timeSpentSeconds: 2890,
    answers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 3 }
  },
  {
    id: 910107,
    examId: 101,
    examTitle: 'vantien1304-SỬ',
    studentName: 'Nguyễn Thùy Linh',
    score: 8.0,
    correctCount: 4,
    totalQuestions: 5,
    submittedAt: '29/10/2026 16:40',
    timeSpentSeconds: 1750,
    answers: { 1: 0, 2: 2, 3: 0, 4: 1, 5: 2 }
  },

  // Exam 102: Đề thi thử THPT Quốc Gia - Môn Toán (Mã đề 102) (19 submissions, questions: 11, 12)
  ...[
    { name: 'Trần Thị Lệ Quyên', score: 9.6, correct: 2, time: 3920, at: '26/10/2026 09:10', ans: { 11: 1, 12: 0 } },
    { name: 'Nguyễn Hữu Khang', score: 9.2, correct: 2, time: 4100, at: '26/10/2026 09:24', ans: { 11: 1, 12: 0 } },
    { name: 'Nguyễn Hồng Phi Long', score: 8.8, correct: 2, time: 4250, at: '26/10/2026 09:38', ans: { 11: 1, 12: 0 } },
    { name: 'Hồ Phương Mỹ Ngọc', score: 8.6, correct: 2, time: 4310, at: '26/10/2026 10:02', ans: { 11: 1, 12: 0 } },
    { name: 'Trần Văn Tiến', score: 8.4, correct: 2, time: 3860, at: '26/10/2026 10:15', ans: { 11: 1, 12: 0 } },
    { name: 'Nguyễn Thùy Duyên', score: 8.2, correct: 2, time: 4480, at: '26/10/2026 10:33', ans: { 11: 1, 12: 0 } },
    { name: 'Trần Bảo Hân', score: 7.8, correct: 2, time: 4520, at: '26/10/2026 11:05', ans: { 11: 1, 12: 0 } },
    { name: 'Nguyễn Thị Hoàng Dung', score: 7.6, correct: 2, time: 4610, at: '26/10/2026 13:20', ans: { 11: 1, 12: 0 } },
    { name: 'Nguyễn Anh Duy', score: 7.4, correct: 1, time: 4690, at: '26/10/2026 14:12', ans: { 11: 1, 12: 2 } },
    { name: 'Nguyễn Quốc Hưng', score: 7.2, correct: 1, time: 4780, at: '26/10/2026 14:44', ans: { 11: 1, 12: 1 } },
    { name: 'Bùi Ngọc Gia Huy', score: 6.8, correct: 1, time: 4820, at: '26/10/2026 15:18', ans: { 11: 1, 12: 2 } },
    { name: 'Nguyễn Thị Kiều My', score: 6.6, correct: 1, time: 4910, at: '26/10/2026 16:04', ans: { 11: 1, 12: 3 } },
    { name: 'Phạm Ngọc Nam', score: 6.2, correct: 1, time: 4990, at: '26/10/2026 17:10', ans: { 11: 1, 12: 1 } },
    { name: 'Nguyễn Thiện Nhân', score: 5.8, correct: 1, time: 5050, at: '27/10/2026 08:11', ans: { 11: 0, 12: 0 } },
    { name: 'Lê Chí Tân', score: 5.6, correct: 1, time: 5120, at: '27/10/2026 09:00', ans: { 11: 1, 12: 2 } },
    { name: 'Nguyễn Vũ Phong', score: 5.2, correct: 1, time: 5190, at: '27/10/2026 10:25', ans: { 11: 0, 12: 0 } },
    { name: 'Huỳnh Văn Quốc Anh', score: 4.8, correct: 0, time: 5280, at: '27/10/2026 11:40', ans: { 11: 0, 12: 1 } },
    { name: 'Nguyễn Đức Bảo', score: 4.4, correct: 0, time: 5340, at: '27/10/2026 13:55', ans: { 11: 2, 12: 2 } },
    { name: 'Dương Tuấn Khôi', score: 3.8, correct: 0, time: 5390, at: '27/10/2026 15:12', ans: { 11: 0, 12: 3 } }
  ].map((item, idx) => ({
    id: 910201 + idx,
    examId: 102,
    examTitle: 'Đề thi thử THPT Quốc Gia - Môn Toán (Mã đề 102)',
    studentName: item.name,
    score: item.score,
    correctCount: item.correct,
    totalQuestions: 2,
    submittedAt: item.at,
    timeSpentSeconds: item.time,
    answers: item.ans
  })),

  // Exam 103: Đề kiểm tra Tiếng Anh THPT - Reading & Grammar (14 submissions, question: 21)
  ...[
    { name: 'Trần Văn Tiến', score: 9.5, correct: 1, time: 2210, at: '27/10/2026 09:15', ans: { 21: 1 } },
    { name: 'Nguyễn Thị Thanh Chúc', score: 9.2, correct: 1, time: 2340, at: '27/10/2026 09:30', ans: { 21: 1 } },
    { name: 'Nguyễn Thùy Linh', score: 8.8, correct: 1, time: 2410, at: '27/10/2026 10:05', ans: { 21: 1 } },
    { name: 'Đặng Phạm Cẩm Linh', score: 8.5, correct: 1, time: 2560, at: '27/10/2026 10:42', ans: { 21: 1 } },
    { name: 'Trần Bảo Hân', score: 8.1, correct: 1, time: 2630, at: '27/10/2026 11:20', ans: { 21: 1 } },
    { name: 'Nguyễn Ngọc Bảo Như', score: 7.7, correct: 1, time: 2780, at: '27/10/2026 14:15', ans: { 21: 1 } },
    { name: 'Bùi Thị Bảo Thi', score: 7.5, correct: 1, time: 2840, at: '27/10/2026 15:00', ans: { 21: 1 } },
    { name: 'Nguyễn Ánh Anh Thư', score: 7.2, correct: 1, time: 2910, at: '27/10/2026 15:48', ans: { 21: 1 } },
    { name: 'Đặng Nguyễn Thủy Tiên', score: 6.8, correct: 1, time: 3020, at: '27/10/2026 16:30', ans: { 21: 1 } },
    { name: 'Nguyễn Đình Anh', score: 6.4, correct: 0, time: 3180, at: '28/10/2026 08:20', ans: { 21: 0 } },
    { name: 'Nguyễn Minh Vĩnh Khang', score: 6.0, correct: 0, time: 3250, at: '28/10/2026 09:10', ans: { 21: 0 } },
    { name: 'Trần Trung Phúc', score: 5.5, correct: 0, time: 3390, at: '28/10/2026 10:40', ans: { 21: 2 } },
    { name: 'Nguyễn Sinh Thương', score: 5.1, correct: 0, time: 3440, at: '28/10/2026 11:15', ans: { 21: 3 } },
    { name: 'Hồ Việt Hoàng', score: 4.5, correct: 0, time: 3520, at: '28/10/2026 13:50', ans: { 21: 0 } }
  ].map((item, idx) => ({
    id: 910301 + idx,
    examId: 103,
    examTitle: 'Đề kiểm tra Tiếng Anh THPT - Reading & Grammar',
    studentName: item.name,
    score: item.score,
    correctCount: item.correct,
    totalQuestions: 1,
    submittedAt: item.at,
    timeSpentSeconds: item.time,
    answers: item.ans
  }))
];
