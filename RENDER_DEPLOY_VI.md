# Triển khai website tripleT trên Render

## Cấu hình dịch vụ
- Tên dịch vụ: `tripleT` (Render có thể chuẩn hóa thành `triplet` hoặc slug chữ thường)
- Runtime: Node
- Region: Singapore
- Build: `npm install --legacy-peer-deps && npm run build`
- Start: `npm start`
- Node.js: `>=22.12.0`

## Biến môi trường bắt buộc
Trong Render → dịch vụ → Environment, thêm `GEMINI_API_KEY` với API key Gemini của bạn. Không điền chuỗi mẫu trong `.env.example` làm API key thật.

## Dữ liệu người dùng
Ứng dụng hiện ghi dữ liệu hồ sơ vào `profiles_db.json` và tệp tải lên vào thư mục `uploads`. Render Free không bảo đảm lưu các tệp này qua redeploy/restart. Nếu cần dữ liệu bền vững, gắn persistent disk hoặc chuyển dữ liệu sang database/object storage.
