# MAGASIN CUP POS V7 — T015 QA via GitHub Actions + clasp

**Trạng thái:** Pipeline trên GitHub, chưa kết nối token Google, chưa đẩy mã Apps Script, chưa deploy QA @4. Không liên quan production V6.4.

## Tại sao chọn phương án này?

Chạy trên GitHub-hosted Ubuntu, không cần H4 hoặc Remote Desktop Commander. Repository `magasincoffee/cup` công khai chỉ chứa **bản vá logic QA**, workflow và kiểm thử; source Apps Script gốc chỉ được kéo về thư mục tạm của runner và **không được commit hay upload artifact**.

## Thiết lập một lần bởi tài khoản Google Owner

1. Bật Apps Script API tại https://script.google.com/home/usersettings .
2. Trong GitHub, vào https://github.com/magasincoffee/cup/settings/environments rồi tạo Environment **`cup-t015-qa`**. Chỉ cho phép triển khai từ nhánh `main`; chọn yêu cầu Owner phê duyệt khi có thể.
3. Tạo **Environment Secret** tên **`CLASPRC_JSON`**, giá trị là toàn bộ nội dung file `~/.clasprc.json` từ phiên `clasp login` đã được Google Owner xác thực (ví dụ trên chính máy của bạn). **Không gửi nội dung file này vào cuộc trò chuyện, commit, Issue, PR hoặc email.** Token có quyền cao và cần giữ kín.
4. Khi workflow đã có trên `main`, vào https://github.com/magasincoffee/cup/actions chọn **MAGASIN CUP T015 isolated QA clasp → Run workflow → preflight**. Pipeline sẽ đọc source QA @3 và HEAD, kiểm tra tất cả điều kiện. Preflight tuyệt đối không gọi `clasp push`.
5. Chỉ khi preflight PASS, mới chọn `deploy` và nhập chính xác `T015_QA_APPROVED`. Xác nhận bước duyệt Environment để pipeline đẩy lên **project T015 QA riêng**, đối chiếu source sau đẩy, rồi tạo một deployment QA mới.
6. Nghiệm thu giao diện Tồn kho V7 và Trạng thái đơn hàng trên tài khoản Google Owner. **Không chạy lại E2E kho một lần**.

## Hàng rào an toàn

- Public PR chỉ chạy Node.js unit tests, không truy cập `CLASPRC_JSON`.
- Job Google chỉ chạy khi người có quyền kích hoạt `workflow_dispatch` trên `main`, với GitHub Environment `cup-t015-qa`.
- `clasp@3.4.1` được cố định phiên bản.
- Script ID bị khóa vào dự án T015 QA; workbook được kiểm tra là bản sao QA; webapp phải ở chế độ `MYSELF` / `USER_DEPLOYING`.
- HEAD Apps Script hiện tại phải **trùng mã bất biến @3**; khác dù một tệp thì từ chối ghi đè.
- Gate Owner, quyền ghi và write-lease phải tồn tại; bài E2E một lần không được gọi lại.
- Chỉ có 2 thay đổi dự kiến: thêm `T015_OrderTriage.js`, sửa màn `T015_ReadOnly.html` để tách chỉ số cảnh báo.
- Không sửa `V7_ORDERS`, kho, công nợ hoặc `TON_KHO` ở bước này.
- Không tự động triển khai production.

## Test không cần Google

```bash
node ci/t015/test_t015_order_triage.cjs
node ci/t015/test-qa-patch.mjs
```

Dữ liệu dự kiến: 1 đơn có chênh lệch trạng thái cần hiển thị; 2 đơn chưa kiểm kê; 1 đơn nháp; không có yêu cầu kho chưa đối soát. Bằng chứng Google signed-in cho @4 vẫn là bước nghiệm thu riêng.