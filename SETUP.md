# Cài đặt TradingAgents Web trên máy mới

Hướng dẫn cài giao diện web (Next.js) của TradingAgents bằng Docker, từ máy trắng đến lúc chạy được phân tích đầu tiên.

## 1. Cần cài trước

| Phần mềm | Ghi chú |
|---|---|
| [Git](https://git-scm.com/downloads) | Để tải mã nguồn |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Windows: bật WSL 2 khi cài. Mở Docker Desktop và chờ nó báo *running* |

Chỉ cần hai thứ này. Python và Node.js đã có sẵn trong image Docker.

## 2. Tải mã nguồn

```bash
git clone https://github.com/noname9xndz/TradingAgents.git
cd TradingAgents
git checkout dev-local
```

## 3. Tạo file `.env`

```bash
cp .env.example .env
```

Mở `.env` và điền:

```ini
# Key của nhà cung cấp LLM bạn dùng, ví dụ OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Lưu dữ liệu vào thư mục ./data cạnh mã nguồn (dễ sao lưu, dễ chuyển máy)
TRADINGAGENTS_DATA_DIR=./data
```

- Key cũng nhập được sau trên trang **⚙ Cài đặt** của web.
- `.env` và `data/` đã nằm trong `.gitignore`, nên không bị commit lên git.
- Nếu không đặt `TRADINGAGENTS_DATA_DIR`, dữ liệu sẽ nằm trong Docker volume `tradingagents_data`. Volume vẫn còn khi xoá container, nhưng khó mở ra xem và sao lưu hơn.

## 4. Build và chạy

```bash
docker compose --profile web up -d --build web
```

- Lần đầu mất khoảng 5–10 phút để build image.
- Mở trình duyệt vào **http://127.0.0.1:3210**.
- Container tự chạy lại khi khởi động lại máy hoặc Docker (`restart: unless-stopped`). Nhờ vậy lịch chạy job vẫn hoạt động.
- Web chỉ mở trên `127.0.0.1`, nên máy khác trong mạng không truy cập được.

## 5. Lần chạy đầu tiên

1. Vào **⚙ Cài đặt**:
   - nhập API key, nếu chưa có trong `.env`;
   - chọn nhà cung cấp, model mặc định, analyst và ngôn ngữ báo cáo.
2. Vào **+ Phân tích mới**:
   - chọn danh mục (Chứng khoán / Crypto / Forex & hàng hoá) và mã;
   - bấm **Chạy phân tích**.
3. Xem diễn biến trực tiếp ở cột bên phải. Kết quả được lưu vào **Lịch sử phân tích**.

Trang **Hướng dẫn** trên web giải thích các mức đánh giá, 12 agent, lịch chạy và hàng chờ.

## 6. Dữ liệu được lưu ở đâu

Tất cả nằm trong thư mục dữ liệu: `./data` nếu đã đặt như bước 3, hoặc volume `tradingagents_data`.

| Đường dẫn | Nội dung |
|---|---|
| `history.db` | SQLite gồm: chỉ mục lịch sử phân tích, lịch chạy (jobs), log các lần job chạy, hàng chờ, **cài đặt và API key** |
| `web_history/<id>/` | Toàn bộ sự kiện của từng lần phân tích (`meta.json`, `events.jsonl`) |
| `logs/`, `memory/`, `cache/` | Báo cáo, memory log, cache dữ liệu thị trường |

- `web_history/` là bản gốc của lịch sử phân tích. Nếu mất hoặc xoá `history.db`, phần lịch sử sẽ tự dựng lại từ các thư mục này khi web khởi động.
- Lịch chạy, hàng chờ và cài đặt chỉ nằm trong `history.db`, nên nhớ sao lưu file này.
- `history.db` có chứa API key, nên giữ bản sao lưu ở nơi an toàn, đừng gửi file này cho người khác.

## 7. Chuyển dữ liệu từ máy cũ sang

Tắt web ở cả hai máy trước khi chép.

**Máy cũ chạy local** (dữ liệu ở `~/.tradingagents`, trên Windows là `C:\Users\<tên>\.tradingagents`): chép cả thư mục đó vào `./data` của máy mới.

**Máy cũ chạy Docker với volume:** xuất volume ra file nén:

```bash
docker run --rm -v tradingagents_tradingagents_data:/src -v "$PWD":/out alpine tar czf /out/tradingagents-data.tgz -C /src .
```

Trên máy mới, giải nén file đó vào `./data`:

```bash
mkdir -p data && tar xzf tradingagents-data.tgz -C data
```

Sau đó chạy lại bước 4.

## 8. Các lệnh hằng ngày

| Việc | Lệnh |
|---|---|
| Xem log | `docker compose --profile web logs -f web` |
| Dừng | `docker compose --profile web stop web` |
| Chạy lại | `docker compose --profile web start web` |
| Cập nhật code mới | `git pull` rồi `docker compose --profile web up -d --build web` |
| Xoá container (giữ dữ liệu) | `docker compose --profile web down` |

## 9. Đổi múi giờ của lịch chạy

Mặc định lịch chạy theo giờ Việt Nam (`Asia/Ho_Chi_Minh`). Muốn đổi, thêm vào `.env`:

```ini
TZ=Asia/Tokyo
```

Sau đó chạy lại bước 4.

## 10. Chạy không dùng Docker (để phát triển)

Cần **Python ≥ 3.11** và **Node.js 22** (web dùng `node:sqlite`, nên phải từ Node 22 trở lên).

```bash
python -m venv .venv
.venv/Scripts/pip install -e .      # macOS/Linux: .venv/bin/pip install -e .
cd web
npm ci
npm run dev                         # http://127.0.0.1:3210
```

- Khi chạy local, dữ liệu nằm ở `~/.tradingagents`.
- Đừng chạy local cùng lúc với container web: cả hai cùng dùng cổng 3210.

## 11. Gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| `port is already allocated` / cổng 3210 bận | Có server local hoặc container cũ đang chạy. Tắt nó, hoặc đổi cổng trong `docker-compose.yml` (`127.0.0.1:3211:3210`) |
| Nhà cung cấp hiện *(chưa có key)* | Nhập key ở ⚙ Cài đặt hoặc trong `.env`, rồi khởi động lại container |
| Lỗi `... is not a valid model ID` | Sai tên model. Chọn lại model trong form hoặc ở Cài đặt |
| Job không chạy đúng giờ | Kiểm tra `TZ` (bước 9) và chắc chắn container đang chạy. Lần nào trùng lúc máy tắt thì bị bỏ qua, không chạy bù |
| Lịch sử trống sau khi chuyển máy | Kiểm tra đã chép `web_history/` vào đúng thư mục dữ liệu, rồi khởi động lại container |
