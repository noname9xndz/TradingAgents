@echo off
rem Cài đặt và chạy TradingAgents Web bằng Docker. Chạy lại bao nhiêu lần cũng được:
rem lần đầu tạo .env và thư mục data, các lần sau chỉ build lại và khởi động.
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ==== TradingAgents Web: cài đặt và chạy ====
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [LỖI] Chưa cài Docker Desktop: https://www.docker.com/products/docker-desktop/
  goto fail
)
docker info >nul 2>nul
if errorlevel 1 (
  echo [LỖI] Docker Desktop chưa chạy. Mở Docker Desktop, chờ báo "running" rồi chạy lại file này.
  goto fail
)

rem 1. File .env: tạo từ .env.example nếu chưa có, hỏi key OpenRouter.
set "TA_KEY="
if exist ".env" goto env_ready
copy ".env.example" ".env" >nul
echo Đã tạo .env từ .env.example.
set /p "TA_KEY=Nhập OPENROUTER_API_KEY (Enter để bỏ qua, nhập sau ở trang Cài đặt cũng được): "
:env_ready

rem Ghi key (nếu vừa nhập) và bật TRADINGAGENTS_DATA_DIR=./data nếu .env chưa đặt thư mục dữ liệu.
set "TA_ENV=%~dp0.env"
powershell -NoProfile -Command "$f=$env:TA_ENV; $t=[IO.File]::ReadAllText($f); if ($env:TA_KEY) { $t = $t -replace '(?m)^#?\s*OPENROUTER_API_KEY=.*$', ('OPENROUTER_API_KEY=' + $env:TA_KEY.Replace('$','$$')) }; if ($t -notmatch '(?m)^TRADINGAGENTS_DATA_DIR=') { if ($t -match '(?m)^#\s*TRADINGAGENTS_DATA_DIR=') { $t = $t -replace '(?m)^#\s*TRADINGAGENTS_DATA_DIR=.*$', 'TRADINGAGENTS_DATA_DIR=./data' } else { $t += \"`nTRADINGAGENTS_DATA_DIR=./data`n\" } }; [IO.File]::WriteAllText($f, $t)"
if errorlevel 1 (
  echo [LỖI] Không sửa được .env.
  goto fail
)

rem 2. Thư mục dữ liệu: lịch sử, history.db (job, cài đặt, key), báo cáo.
if not exist "data" mkdir "data"

rem 3. Build và chạy container web (agent chạy bên trong nó).
echo.
echo Đang build và khởi động container (lần đầu mất 5-10 phút)...
docker compose --profile web up -d --build web
if errorlevel 1 (
  echo [LỖI] Docker build/khởi động thất bại. Xem thông báo ở trên.
  goto fail
)

rem 4. Chờ web trả lời rồi mở trình duyệt.
echo Đang chờ web sẵn sàng...
set /a TRIES=0
:wait
curl -s -o nul http://127.0.0.1:3210/api/queue
if not errorlevel 1 goto ready
set /a TRIES+=1
if %TRIES% geq 60 (
  echo [LỖI] Web không trả lời sau 3 phút. Xem log: docker compose --profile web logs web
  goto fail
)
ping -n 4 127.0.0.1 >nul
goto wait

:ready
echo.
echo Xong! Web đang chạy tại http://127.0.0.1:3210
echo   Xem log : docker compose --profile web logs -f web
echo   Dừng    : docker compose --profile web stop web
start "" http://127.0.0.1:3210
pause
exit /b 0

:fail
echo.
pause
exit /b 1
