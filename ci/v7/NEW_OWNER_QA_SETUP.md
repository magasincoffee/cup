# MAGASIN CUP V7 QA — dự án Apps Script mới

**Trạng thái:** Chỉ chuẩn bị trình cài an toàn. **Chưa chạy workflow Owner; chưa cài mã; chưa triển khai Web App.**

Đã xác minh qua Drive metadata: có dự án mới tên `MAGASIN CUP V7 QA` ngày 25/10/2026.
Vì mã dự án không phải credential nhưng không cần công khai thêm, trình cài chỉ lưu SHA-256 đối chiếu ID trong nguồn công khai. Người dùng nhập ID dự án tại GitHub Actions khi chạy.

## Quy trình cài đặt

1. Mở [MAGASIN CUP V7 new Owner QA script bootstrap](https://github.com/magasincoffee/cup/actions/workflows/v7-owner-qa-bootstrap.yml).
2. Chọn **Run workflow**, nhánh **main**, chế độ **preflight**, nhập ID script mới (phần sau `/projects/` và trước `/edit`), để `confirm` trống.
3. Xem job `owner-script` dưới workflow, kiểm tra có dòng `V7_QA_PREFLIGHT_PASS_NO_WRITES`. Bước này chỉ `clasp pull` và phân tích nguồn, tuyệt đối không push.
4. Khi preflight PASS, chạy lại đúng workflow nhánh main: chế độ `install`, cùng script ID, `confirm=INSTALL_V7_QA_READ_ONLY`. Trong chế độ install **vẫn kiểm tra lại** ID và nguồn remote phải còn trống trước khi push; fail thì dừng.
5. Khi thấy `V7_QA_PRIVATE_READ_SOURCE_INSTALL_PASS`, mã gồm `V7_QA_ReadBridge.js` và `V7_QA_SelfCheck.js` đã được đẩy và đọc lại đúng hash, nhưng **chưa chạy** bất kỳ hàm nào và chưa có deployment.

## Chỉ cấu hình quyền đọc sau khi cài mã

Trong **Project Settings → Script Properties** của chính dự án V7 QA mới:
- `V7_QA_READ_MODE` = `OWNER_ONLY_READ`
- `V7_QA_READ_OWNER_EMAIL` = địa chỉ Google Owner đã xác minh (**không dán email vào GitHub/ChatGPT**)
- `V7_QA_READ_BOOK_ID` = ID workbook QA dùng một lần được dự án hỗ trợ (**không phải production**).

Không đặt các giá trị này trong repo public và **không** chỉnh `T015_WRITES_ENABLED` hoặc `T015_WRITE_LEASE_UNTIL` của dự án T015 cũ.

Trong Apps Script editor của dự án V7 QA, người có quyền Owner có thể chọn hàm `v7OwnerQaSelfCheck` và bấm Run **sau khi cấu hình**, xem log chỉ chứa `V7_OWNER_QA_READ_STATUS` hoặc `V7_OWNER_QA_READ_COUNTS` gồm số đếm. Có thể phải cho phép Google quyền đọc spreadsheet khi được hỏi; không cấp quyền triển khai công khai. Không chia sẻ email/mã/token/chi tiết dòng đơn từ log.

**Mọi trạng thái an toàn chỉ PASS khi được xác thực thực tế.** CI/mock chỉ chứng minh logic offline. `v7OwnerReadSnapshot` là mã chỉ đọc được bảo vệ phía server; trang public GitHub Pages vẫn dùng DEMO.

## Cổng an toàn

- Chỉ đúng Script ID có SHA-256 đã định; không thể dùng nhầm T015 hoặc V6.4.
- Chỉ `workflow_dispatch` trên main mới được tiếp xúc secret `CLASPRC_JSON` của môi trường GitHub `cup-t015-qa`.
- `preflight` mặc định; `install` đòi câu xác nhận chính xác và protected environment.
- Remote chỉ có `appsscript.json` và tùy chọn `Code.js` mặc định mới được thay.
- Không ghi Google Sheet, không execute Apps Script, không deploy web app, không tự bật quyền ghi.
- Nếu OAuth không truy cập được dự án, workflow sẽ FAILED mà không ghi; lúc đó cần Owner trực tiếp nhập mã trong Apps Script editor hoặc kết nối một phiên trình duyệt được ủy quyền.

## Tiếp theo

1. Bằng chứng preflight → install → readback.
2. Owner cấu hình 3 Script Properties read-only và thực hiện `v7OwnerQaSelfCheck`.
3. Kiểm tra negative account/blank ActiveUser và response đúng contract.
4. Giao diện QA PRIVATE tích hợp adapter; public Pages tuyệt đối không gọi API chứa khách thật.
5. Các workflow ghi đơn/kho/thu tiền chỉ được mở khi RBAC, idempotency, giao dịch kho T015 và lỗi phục hồi đã nghiệm thu. V6.4 giữ nguyên.