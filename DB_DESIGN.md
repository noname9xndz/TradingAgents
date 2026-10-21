# Thiết kế cơ sở dữ liệu – TradingAgents Web

Web lưu dữ liệu trong một file SQLite là **`history.db`**, đặt trong thư mục dữ liệu:

| Chạy bằng | Vị trí `history.db` |
|---|---|
| Docker với `TRADINGAGENTS_DATA_DIR=./data` | `./data/history.db` |
| Docker không đặt biến trên | volume `tradingagents_data` |
| Local | `~/.tradingagents/history.db` |
| Bất kỳ | biến `TRADINGAGENTS_HISTORY_DB` (đường dẫn đầy đủ) được ưu tiên hơn |

- Web dùng `node:sqlite` có sẵn trong Node 22, nên không cần thư viện ngoài.
- Toàn bộ code truy cập DB nằm trong [web/lib/db.ts](web/lib/db.ts).
- Không có ORM. Lúc khởi động, web tự tạo bảng và tự thêm cột còn thiếu.

## Tổng quan

```
                ┌──────────────┐  1 ─── n  ┌──────────────┐  1 ─── n  ┌──────────────┐
                │    jobs      │──────────▶│  job_fires   │──────────▶│    runs      │
                │ lịch chạy    │  job_id   │ mỗi lần job  │  source.  │ mỗi lần phân │
                └──────────────┘           │ được kích    │  fireId   │ tích 1 mã    │
                                           └──────────────┘           └──────▲───────┘
                ┌──────────────┐                                             │ index từ
                │    queue     │── chạy xong thì xoá dòng, lưu thành ──────▶│ thư mục
                │ hàng chờ     │                                     web_history/<id>/
                └──────────────┘
                ┌──────────────┐
                │   settings   │  API key + cấu hình mặc định
                └──────────────┘
```

| Bảng | Vai trò | Có phải bản gốc không? |
|---|---|---|
| `runs` | Chỉ mục các lần phân tích, để lọc và phân trang nhanh | **Không.** Bản gốc là thư mục `web_history/<id>/`, bảng này dựng lại được |
| `jobs` | Lịch chạy tự động | Có |
| `job_fires` | Nhật ký mỗi lần một job được kích hoạt | Có |
| `queue` | Hàng chờ chạy, mỗi lúc một mã | Có (dữ liệu tạm: chạy xong thì xoá) |
| `settings` | API key và cấu hình mặc định của trang Cài đặt | Có |

Ghi chú chung:
- Mọi thời điểm là **epoch milliseconds** (`INTEGER`), theo kiểu `Date.now()` của JS.
- Các cột kiểu `TEXT` ghi chú "JSON" lưu chuỗi JSON. Có thể truy vấn bằng `json_extract()` và `json_each()`.
- Không khai báo khoá ngoại (FK). Các bảng chỉ liên kết với nhau qua giá trị id, do code tự giữ.

---

## `runs` – các lần phân tích

Mỗi dòng là một lần phân tích một mã.

**Bản gốc là file.** Khi một lần chạy kết thúc, [web/lib/history.ts](web/lib/history.ts) ghi:

```
web_history/<id>/meta.json     – thông tin tóm tắt (RunMeta)
web_history/<id>/events.jsonl  – toàn bộ sự kiện stream, mỗi dòng một JSON
```

Sau đó `indexRun(id)` đọc hai file này và `INSERT OR REPLACE` dòng tương ứng vào bảng. Lúc khởi động, những thư mục nào chưa có trong bảng sẽ được index thêm. Nhờ vậy:
- xoá `history.db` thì lịch sử phân tích tự dựng lại từ thư mục. Lưu ý: các bảng khác như jobs và settings không dựng lại được;
- chép thư mục `web_history/` từ máy khác sang thì lịch sử tự hiện ra.

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | TEXT PK | `YYYYMMDD-HHMMSS-<TICKER>`, đồng thời là tên thư mục |
| `ticker` | TEXT NOT NULL | Mã đã chuẩn hoá (in hoa, bỏ `/`), ví dụ `XAUUSD` |
| `trade_date` | TEXT | Ngày phân tích `YYYY-MM-DD` |
| `provider` | TEXT | Nhà cung cấp LLM (`openrouter`, `openai`, `ollama`…) |
| `quick_model` | TEXT | Model nhanh (analyst, trader, tranh luận) |
| `deep_model` | TEXT | Model sâu (các manager) |
| `analysts` | TEXT (JSON) | Mảng analyst đã chạy thật, ví dụ `["market","news"]` |
| `language` | TEXT | Ngôn ngữ báo cáo |
| `depth` | INTEGER | Số vòng tranh luận (1 / 3 / 5) |
| `status` | TEXT NOT NULL | `done` (xong), `error` (lỗi), `stopped` (bị dừng) |
| `rating` | TEXT | Khi `done`: `Buy`, `Overweight`, `Hold`, `Underweight`, `Sell` hoặc `REVIEW` |
| `started_at` | INTEGER NOT NULL | Lúc bắt đầu |
| `ended_at` | INTEGER | Lúc kết thúc |
| `report_path` | TEXT | Thư mục báo cáo Markdown/HTML do pipeline ghi ra |
| `error` | TEXT | Thông báo lỗi khi `status = error` |
| `decision` | TEXT | Quyết định cuối của Portfolio Manager (`final_trade_decision`) |
| `settings` | TEXT (JSON) | Toàn bộ cấu hình của lần chạy (provider, model, nhiệt độ, số vòng, `asset_type`, mã gốc người dùng nhập…). Không có thông tin đăng nhập |
| `category` | TEXT | Danh mục: `stock`, `crypto` hoặc `forex` |
| `source` | TEXT (JSON) | Nguồn chạy, xem bên dưới |
| `request` | TEXT (JSON) | Yêu cầu ban đầu, dùng cho nút "Chạy lại". `backendUrl` chỉ giữ origin và path |
| `job_id` | TEXT | Lấy từ `source.jobId`, để lọc theo job |
| `job_name` | TEXT | Lấy từ `source.jobName` |
| `usage` | TEXT (JSON) | Token theo từng model, xem bên dưới |
| `tokens_in` | INTEGER | Tổng token vào |
| `tokens_out` | INTEGER | Tổng token ra |
| `llm_calls` | INTEGER | Tổng số lượt gọi LLM |

Index: `(ticker, started_at)`, `(rating, started_at)`, `(started_at)`.

**`source`**: lần chạy đến từ đâu.

```jsonc
{ "type": "manual" }                       // người dùng bấm chạy
{ "type": "job",
  "jobId": "…", "jobName": "Vàng buổi sáng",
  "fireId": "…",                           // lần kích hoạt nào (job_fires.id)
  "attempt": 0,                            // 0 = lần đầu, 1..3 = lần chạy lại do lỗi
  "retries": 2 }                           // số lần chạy lại tối đa của job
```

**`usage`**: lấy từ sự kiện `usage` cuối cùng mà bridge Python gửi ra (`UsageTracker` trong [cli/web_bridge.py](cli/web_bridge.py)).

```jsonc
{ "total":  { "calls": 42, "input": 2186200, "output": 485000, "reasoning": 120000, "cached": 0 },
  "models": { "minimax/minimax-m3.1-flash:free": { "calls": 42, "input": …, "output": …, "reasoning": …, "cached": … } } }
```

**Migration:** khi phiên bản mới thêm cột, nó được khai báo trong `ADDED_COLUMNS`. Lúc khởi động, web `ALTER TABLE` để thêm cột còn thiếu, xoá các dòng của `runs` rồi index lại từ thư mục, nên cột mới được điền cho cả các lần chạy cũ, miễn là file có dữ liệu đó.

---

## `jobs` – lịch chạy

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | Tên job |
| `enabled` | INTEGER NOT NULL | 1 = bật, 0 = tắt |
| `next_run_at` | INTEGER | Lần chạy kế tiếp. NULL khi job tắt hoặc đã hết lịch |
| `last_run_at` | INTEGER | Lần kích hoạt gần nhất |
| `created_at` | INTEGER NOT NULL | Lúc tạo |
| `data` | TEXT (JSON) NOT NULL | Toàn bộ job, xem bên dưới |

Các cột riêng chỉ để scheduler và danh sách đọc nhanh. **`data` là bản đầy đủ**, mỗi lần lưu đều ghi lại cả hai.

```jsonc
{
  "id": "…", "name": "Vàng và crypto buổi sáng", "enabled": true,
  "symbols": [ { "category": "forex", "ticker": "XAUUSD" }, { "category": "crypto", "ticker": "BTCUSDT" } ],
  "request": { "analysts": ["market","news"], "language": "Vietnamese", "depth": 1,
               "provider": "openrouter", "quick": "…", "deep": "…", "backendUrl": "…" },
  "schedule": { "type": "daily", "time": "08:00" },
  //  hoặc { "type": "once", "at": "2026-10-22T08:00" }
  //       { "type": "weekly", "time": "08:00", "days": [1,2,3,4,5] }   (0 = Chủ nhật)
  //       { "type": "interval", "everyHours": 6 }
  "retries": 2,              // 0..3
  "createdAt": 0, "lastRunAt": 0, "nextRunAt": 0
}
```

Cách scheduler ([web/lib/jobs.ts](web/lib/jobs.ts)) dùng bảng này:
- Cứ 30 giây nó chạy những job có `enabled = 1 AND next_run_at <= now`.
- Sau mỗi lần chạy, nó cập nhật `last_run_at` và tính lại `next_run_at`.
- Job kiểu `once` tự tắt sau khi chạy.
- Lúc khởi động, các lần chạy bị lỡ trong thời gian server tắt được bỏ qua, `next_run_at` tính lại từ thời điểm hiện tại.

---

## `job_fires` – nhật ký kích hoạt job

Mỗi lần job được kích hoạt, theo lịch hay bấm "Chạy ngay", là một dòng. Bảng này cho trang **Lịch chạy → Lịch sử chạy job** biết job đã chạy lúc nào và từng mã ra sao.

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | TEXT PK | UUID, được ghi vào `runs.source.fireId` của mọi lần chạy sinh ra từ lần kích hoạt này |
| `job_id` | TEXT NOT NULL | Job nào (`jobs.id`) |
| `job_name` | TEXT NOT NULL | Tên job lúc kích hoạt, vẫn còn khi job bị xoá hoặc đổi tên |
| `fired_at` | INTEGER NOT NULL | Lúc kích hoạt |
| `trigger` | TEXT NOT NULL | `schedule` (theo lịch) hoặc `manual` (bấm tay) |
| `symbols` | TEXT (JSON) NOT NULL | Danh sách mã lúc kích hoạt, ví dụ `["XAUUSD","BTCUSDT"]` |

Index: `(fired_at)`.

Trạng thái từng mã trong một lần kích hoạt được tính lúc đọc, theo thứ tự ưu tiên:
1. Mã đang chạy: `running`.
2. Mã đang trong `queue`: `queued`.
3. Mã có dòng trong `runs` với cùng `fireId`: lấy `status` và `rating` của lần thử cuối.
4. Không thuộc trường hợp nào ở trên: `dropped` (không chạy).

---

## `queue` – hàng chờ

Mỗi lúc chỉ chạy một mã, các mã còn lại xếp hàng ([web/lib/queue.ts](web/lib/queue.ts)).

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | TEXT PK | UUID |
| `enqueued_at` | INTEGER NOT NULL | Lúc vào hàng chờ, dùng để xếp thứ tự (cùng `rowid`) |
| `state` | TEXT NOT NULL | `waiting` (chờ) hoặc `running` (đang chạy, tối đa một dòng) |
| `ticker` | TEXT NOT NULL | Mã, để hiển thị nhanh |
| `job` | TEXT (JSON) NOT NULL | Yêu cầu chạy (ticker, ngày, analyst, model…) |
| `source` | TEXT (JSON) NOT NULL | Cùng dạng với `runs.source` |

Vòng đời một dòng:

```
thêm (waiting) ──▶ đến lượt (running) ──▶ chạy xong: XOÁ dòng, kết quả nằm ở runs + web_history
                                         └▶ lỗi và còn lượt retry của job: thêm dòng mới (waiting, attempt + 1) ở cuối hàng
```

- Bộ xử lý hàng chờ khởi động cùng server. Nó lấy mã kế tiếp ngay khi có mã mới hoặc khi một mã vừa xong, và kiểm tra lại mỗi 10 giây.
- **Khởi động lại server:** dòng `running` bị bỏ dở được trả về `waiting` và chạy lại từ đầu. Các mã đang chờ vẫn giữ nguyên.

---

## `settings` – cài đặt

Dạng key–value, mỗi dòng lưu một giá trị JSON.

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `name` | TEXT PK | Tên cài đặt |
| `value` | TEXT (JSON) NOT NULL | Giá trị |

| `name` | `value` |
|---|---|
| `keys` | `{ "OPENROUTER_API_KEY": "sk-or-…", … }`: API key nhập trên trang Cài đặt. Chỉ nhận tên biến dạng `*_API_KEY` hoặc `*_USER_AGENT` |
| `defaults` | `{ "provider", "quick", "deep", "backendUrl", "language", "depth", "analysts" }`: cấu hình mặc định cho form phân tích và job mới |

- Khi chạy phân tích, key ở đây được đưa vào biến môi trường của tiến trình Python và **được ưu tiên hơn `.env`**.
- API `/api/settings` không bao giờ trả giá trị key, chỉ trả dạng `••••` kèm 4 ký tự cuối.
- Trên Linux/Docker, file DB được đặt quyền `0600`. Trên Windows hoặc khi mount thư mục từ Windows thì quyền này không có tác dụng.
- **Vì DB chứa key, giữ bản sao lưu `history.db` ở nơi an toàn.**

---

## Dữ liệu cũ được tự nhập

| File cũ | Nhập vào | Sau khi nhập |
|---|---|---|
| `web_jobs.json` | `jobs` | Đổi tên thành `web_jobs.json.imported` |
| `web_settings.json` | `settings` | Đổi tên thành `web_settings.json.imported` |

Việc nhập chỉ chạy một lần, lúc web truy cập bảng tương ứng lần đầu sau khi khởi động.

---

## Sao lưu và khôi phục

Cần sao lưu: **`history.db`** và **thư mục `web_history/`**. Nên tắt web trước khi chép để file DB không đang được ghi dở.

```bash
docker compose --profile web stop web
tar czf backup-$(date +%F).tgz -C data history.db web_history
docker compose --profile web start web
```

Khôi phục: giải nén vào thư mục dữ liệu rồi khởi động lại web.

## Truy vấn mẫu

```sql
-- Các lần phân tích trong 7 ngày qua, mới nhất trước
SELECT id, ticker, status, rating, tokens_in, tokens_out
FROM runs WHERE started_at >= (strftime('%s','now','-7 days') * 1000)
ORDER BY started_at DESC;

-- Tổng token theo model
SELECT m.key AS model, SUM(json_extract(m.value,'$.input')) AS input, SUM(json_extract(m.value,'$.output')) AS output
FROM runs, json_each(runs.usage, '$.models') AS m
GROUP BY m.key;

-- Những lần chạy có analyst Tin tức
SELECT id, ticker FROM runs, json_each(runs.analysts) a WHERE a.value = 'news';

-- Lịch sử kích hoạt của một job và kết quả từng mã
SELECT f.fired_at, f.trigger, r.ticker, r.status, r.rating, json_extract(r.source,'$.attempt') AS attempt
FROM job_fires f LEFT JOIN runs r ON json_extract(r.source,'$.fireId') = f.id
WHERE f.job_id = ? ORDER BY f.fired_at DESC, r.started_at;

-- Hàng chờ hiện tại
SELECT ticker, state, datetime(enqueued_at/1000,'unixepoch','localtime') FROM queue ORDER BY enqueued_at, rowid;
```
