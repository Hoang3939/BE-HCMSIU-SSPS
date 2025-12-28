# Script test API Admin Configs
# Usage: .\test-api.ps1

$baseUrl = "http://localhost:3001/api"
$username = "admin"  # Thay bằng username của bạn
$password = "admin123"  # Thay bằng password của bạn

Write-Host "=== Testing Admin Configs API ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login để lấy token
Write-Host "Step 1: Login..." -ForegroundColor Yellow
$loginBody = @{
    username = $username
    password = $password
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody
    
    $token = $loginResponse.token
    Write-Host "✓ Login thành công!" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Login thất bại: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Test GET /api/admin/configs
Write-Host "Step 2: Test GET /api/admin/configs..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $configResponse = Invoke-RestMethod -Uri "$baseUrl/admin/configs" `
        -Method GET `
        -Headers $headers
    
    Write-Host "✓ Lấy cấu hình thành công!" -ForegroundColor Green
    Write-Host ($configResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Lỗi: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Step 3: Test PUT /api/admin/configs
Write-Host "Step 3: Test PUT /api/admin/configs..." -ForegroundColor Yellow
try {
    $updateBody = @{
        default_page_balance = 150
        max_file_size_mb = 25
        price_per_page = 600
    } | ConvertTo-Json
    
    $updateResponse = Invoke-RestMethod -Uri "$baseUrl/admin/configs" `
        -Method PUT `
        -ContentType "application/json" `
        -Headers $headers `
        -Body $updateBody
    
    Write-Host "✓ Cập nhật cấu hình thành công!" -ForegroundColor Green
    Write-Host ($updateResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Lỗi: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Step 4: Test POST /api/admin/configs/reset-pages
Write-Host "Step 4: Test POST /api/admin/configs/reset-pages..." -ForegroundColor Yellow
Write-Host "⚠️  Lưu ý: Endpoint này sẽ reset số trang cho TẤT CẢ sinh viên!" -ForegroundColor Yellow
$confirm = Read-Host "Bạn có chắc chắn muốn test? (y/n)"
if ($confirm -eq "y") {
    try {
        $resetResponse = Invoke-RestMethod -Uri "$baseUrl/admin/configs/reset-pages" `
            -Method POST `
            -Headers $headers
        
        Write-Host "✓ Reset số trang thành công!" -ForegroundColor Green
        Write-Host ($resetResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
        Write-Host ""
    } catch {
        Write-Host "✗ Lỗi: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
    }
} else {
    Write-Host "Đã bỏ qua test reset pages" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "=== Test hoàn tất ===" -ForegroundColor Cyan

