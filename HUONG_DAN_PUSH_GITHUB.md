# 📤 Hướng dẫn đẩy code lên GitHub

## 🔍 Tình trạng hiện tại

### Backend (BE-HCMSIU-SSPS)
- **Remote:** https://github.com/Hoang3939/BE-HCMSIU-SSPS.git
- **Branch hiện tại:** `feature/user-management`
- **Trạng thái:** Có thay đổi đã staged và chưa staged

### Frontend (FE-HCMSIU-SSPS)
- **Remote:** https://github.com/Hoang3939/FE-HCMSIU-SSPS.git
- **Branch hiện tại:** `develop`
- **Trạng thái:** Có thay đổi chưa staged

---

## 🚀 PHẦN 1: ĐẨY BACKEND LÊN GITHUB

### Bước 1: Di chuyển vào thư mục Backend
```bash
cd /Users/janakim/Projects/BE-HCMSIU-SSPS
```

### Bước 2: Kiểm tra trạng thái Git
```bash
git status
```

Bạn sẽ thấy:
- Các file đã staged (sẵn sàng commit)
- Các file chưa staged (cần add)
- Các file untracked (chưa được theo dõi)

### Bước 3: Thêm tất cả các thay đổi vào staging
```bash
# Thêm tất cả các file đã thay đổi
git add .

# Hoặc thêm từng file cụ thể nếu muốn kiểm soát tốt hơn:
# git add src/models/User.model.ts
# git add src/routes/user.ts
# git add README.md
```

### Bước 4: Kiểm tra lại những gì sẽ được commit
```bash
git status
```

**⚠️ QUAN TRỌNG:** Đảm bảo KHÔNG có file `.env` hoặc file chứa thông tin nhạy cảm trong danh sách!

### Bước 5: Commit các thay đổi
```bash
git commit -m "feat: Hoàn thiện chức năng quản lý người dùng (CRUD)

- Thêm API CRUD đầy đủ cho user management
- Thêm method findByUserIDForAdmin để quản lý cả users inactive
- Cập nhật validation và error handling
- Cải thiện UX cho chức năng khóa tài khoản (soft delete)
- Thêm tài liệu API và hướng dẫn"
```

**Lưu ý:** Bạn có thể thay đổi message commit cho phù hợp với những gì bạn đã làm.

### Bước 6: Đẩy code lên GitHub
```bash
# Đẩy lên branch hiện tại (feature/user-management)
git push origin feature/user-management

# Hoặc nếu đây là lần đầu push branch này:
git push -u origin feature/user-management
```

### Bước 7: (Tùy chọn) Tạo Pull Request
1. Truy cập: https://github.com/Hoang3939/BE-HCMSIU-SSPS
2. Bạn sẽ thấy thông báo "Compare & pull request" cho branch mới
3. Click vào đó để tạo Pull Request
4. Điền thông tin PR và merge vào branch chính (main/master/develop)

---

## 🎨 PHẦN 2: ĐẨY FRONTEND LÊN GITHUB

### Bước 1: Di chuyển vào thư mục Frontend
```bash
cd /Users/janakim/Projects/FE-HCMSIU-SSPS
```

### Bước 2: Kiểm tra trạng thái Git
```bash
git status
```

### Bước 3: Thêm tất cả các thay đổi vào staging
```bash
git add .

# Hoặc thêm từng file cụ thể:
# git add app/admin/students/page.tsx
# git add lib/api/user-api.ts
# git add lib/types/api.types.ts
# git add lib/stores/auth-store.ts
# git add lib/api-config.ts
```

### Bước 4: Kiểm tra lại những gì sẽ được commit
```bash
git status
```

**⚠️ QUAN TRỌNG:** Đảm bảo KHÔNG có file `.env.local` hoặc file chứa thông tin nhạy cảm!

### Bước 5: Commit các thay đổi
```bash
git commit -m "feat: Tích hợp API quản lý người dùng và cải thiện UX

- Tích hợp đầy đủ API CRUD cho user management
- Cải thiện UX cho chức năng khóa tài khoản (thay icon, màu sắc, text)
- Thêm visual feedback cho users đã bị khóa (opacity, ẩn nút)
- Cập nhật types và API client
- Loại bỏ role STAFF theo yêu cầu"
```

### Bước 6: Đẩy code lên GitHub
```bash
# Đẩy lên branch develop
git push origin develop
```

### Bước 7: (Tùy chọn) Tạo Pull Request
1. Truy cập: https://github.com/Hoang3939/FE-HCMSIU-SSPS
2. Tạo Pull Request từ `develop` sang branch chính nếu cần

---

## ✅ Checklist trước khi push

### Backend
- [ ] Đã kiểm tra `.gitignore` loại trừ `.env`
- [ ] Không có file nhạy cảm (password, API keys) trong commit
- [ ] Đã test code hoạt động đúng
- [ ] Commit message rõ ràng, mô tả đúng thay đổi

### Frontend
- [ ] Đã kiểm tra `.gitignore` loại trừ `.env.local`
- [ ] Không có file nhạy cảm trong commit
- [ ] Đã test UI/UX hoạt động đúng
- [ ] Commit message rõ ràng

---

## 🛠️ Các lệnh Git hữu ích

### Xem lịch sử commit
```bash
git log --oneline
```

### Xem thay đổi trong file
```bash
git diff
```

### Xem thay đổi đã staged
```bash
git diff --staged
```

### Hủy thay đổi chưa staged
```bash
git restore <file>
```

### Hủy tất cả thay đổi chưa staged
```bash
git restore .
```

### Xem các branch
```bash
git branch -a
```

### Chuyển branch
```bash
git checkout <branch-name>
```

---

## 🐛 Xử lý lỗi thường gặp

### Lỗi: "Updates were rejected because the remote contains work"
**Nguyên nhân:** Remote có commit mới mà local chưa có
**Giải pháp:**
```bash
# Pull code mới nhất trước
git pull origin <branch-name>

# Nếu có conflict, giải quyết conflict rồi:
git add .
git commit -m "Merge remote changes"
git push origin <branch-name>
```

### Lỗi: "Permission denied"
**Nguyên nhân:** Chưa đăng nhập GitHub hoặc không có quyền
**Giải pháp:**
1. Kiểm tra đã đăng nhập GitHub CLI: `gh auth status`
2. Hoặc sử dụng Personal Access Token
3. Hoặc kiểm tra quyền truy cập repository

### Lỗi: "Large files detected"
**Nguyên nhân:** Có file quá lớn (>100MB)
**Giải pháp:**
1. Xóa file lớn khỏi commit: `git rm --cached <file>`
2. Thêm vào `.gitignore`
3. Commit lại

---

## 📝 Ghi chú

- **Luôn kiểm tra** `.gitignore` trước khi commit
- **Không commit** file `.env` hoặc file chứa secrets
- **Viết commit message** rõ ràng, mô tả đúng thay đổi
- **Test code** trước khi push
- **Tạo Pull Request** để review code trước khi merge vào branch chính

---

**Chúc bạn push code thành công! 🎉**

