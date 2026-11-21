export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorResponse {
  reply: string;
  sources?: Array<{ title: string; uri: string }>;
  searchQueries?: string[];
  source?: string;
}

/**
 * Chỉ bật Google Search khi câu hỏi thực sự cần tra cứu thông tin thời gian thực / bên ngoài.
 */
function checkIfNeedsExternalSearch(query: string): boolean {
  if (!query) return false;
  const q = query.toLowerCase();
  const realtimeKeywords = [
    'mới nhất', 'hiện nay', 'hôm nay', 'tin tức', 'tra cứu', 'cập nhật',
    'năm 2024', 'năm 2025', 'năm 2026', 'bộ giáo dục', 'lịch thi', 'điểm chuẩn'
  ];
  return realtimeKeywords.some((keyword) => q.includes(keyword));
}

/**
 * Hàm askTutor gọi API proxy bảo mật trên server (/api/ai/chatgpt).
 */
export async function askTutor(
  messages: TutorMessage[],
  subject: string = 'Toán học',
  grade: string = '12',
  systemInstruction?: string
): Promise<TutorResponse> {
  const lastMsg = messages[messages.length - 1]?.content || '';
  const needSearch = checkIfNeedsExternalSearch(lastMsg);

  const defaultSystemPrompt = `Môn: ${subject}. Học sinh lớp ${grade}.\n\nSYSTEM PROMPT: AI GIA SƯ & GIẢI ĐÁP HỌC TẬP STUDYFLOW (CHUYÊN GIA LÝ THUYẾT & BÀI TẬP THPT)

# VAI TRÒ & SỨ MỆNH
Bạn là Gia sư AI cao cấp của StudyFlow, giỏi xuất sắc ở **CẢ HAI MẢNG: LÝ THUYẾT VÀ BÀI TẬP** cho học sinh từ THCS đến THPT (bám sát chương trình GDPT 2018 của Bộ GD&ĐT). Bạn trả lời tường tận, sâu sắc, chính xác tuyệt đối mọi câu hỏi về lý thuyết (định nghĩa, bản chất, cơ chế, phân tích hiện tượng, so sánh...) cũng như hướng dẫn giải bài tập từng bước.

# NGUYÊN TẮC CỐT LÕI
1. **Trả lời trực tiếp và sâu sắc ngay câu đầu tiên**: Không dài dòng, không chào hỏi vô bổ. Đưa ra định nghĩa cốt lõi hoặc kết luận chính xác.
2. **Chính xác hơn tất cả**: Chỉ nêu công thức, định lý, số liệu chắc chắn đúng. Tự kiểm tra lại kết quả trước khi trả lời.
3. **Dạy để hiểu, không chỉ đưa đáp án**: Giải thích "vì sao" ở các bước then chốt.

# ĐỊNH DẠNG TRẢ LỜI
- Viết tiếng Việt chuẩn mực, sư phạm. Xưng "mình" - gọi "bạn".
- Công thức toán/lý/hóa viết bằng LaTeX: $...$ cho trong dòng, $$...$$ cho riêng dòng.
- Đáp số cuối cùng in đậm, luôn ghi đơn vị.`;

  const promptToUse = systemInstruction || defaultSystemPrompt;

  try {
    const res = await fetch('/api/ai/chatgpt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: lastMsg,
        messages: messages.slice(-20),
        persona: 'tutor',
        subject,
        grade,
        autonomousResearch: needSearch,
        systemInstruction: promptToUse
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Lỗi kết nối máy chủ AI.');
    }

    return {
      reply: data.reply || data.answer || 'Xin lỗi, AI chưa có phản hồi.',
      sources: data.sources || [],
      searchQueries: data.searchQueries || [],
      source: data.source || 'gemini-4-hydrogen'
    };
  } catch (error: any) {
    console.warn('askTutor error:', error);
    return {
      reply: `### Hướng dẫn giải đáp sư phạm:\n1. Hệ thống đã tiếp nhận câu hỏi về môn ${subject}.\n2. Vui lòng thử lại sau giây lát để nhận lời giải lý thuyết và bài tập chi tiết từ gia sư AI.`,
      source: 'local_fallback'
    };
  }
}
