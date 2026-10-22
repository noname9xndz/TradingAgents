# Kế hoạch: phân tích thị trường chứng khoán Việt Nam

*Ngày lập: 23/10/2026 · Chốt: 23/10/2026 · Nhánh: `dev-local`*

## 0. Tóm tắt đã chốt

| Phần | Quyết định | Mục |
|---|---|---|
| Ký hiệu mã | Đuôi `.VN` cho mọi sàn Việt Nam (`.HN` là bí danh). Danh mục "Chứng khoán VN" tự thêm đuôi | 3.1 |
| **Giá** | Lưu trong bảng `price_bars`:<br>- nạp lịch sử **1,5 năm một lần** (vnstock, hoặc yfinance cho HOSE)<br>- **cập nhật hằng ngày từ TradingView** qua extension (tách từ bản Wyckoff, nến 1D)<br>- lấy bù phiên thiếu<br>- **nạp lại khi phát hiện giá điều chỉnh thay đổi** (sự kiện doanh nghiệp) | 3.2 |
| **Báo cáo tài chính** | vnstock là nguồn chính (sau khi qua kiểm tra chất lượng), dự phòng yfinance. Lưu bảng `fin_statements`. Ngày công bố ước lượng theo hạn nộp | 3.2b, 3.3 |
| **Luật giao dịch** | Thêm bối cảnh Việt Nam vào prompt mọi agent khi mã là `.VN` | 3.5 |
| **Tin tức** | RSS tiếng Việt + tin công ty từ vnstock | 3.4 |
| Chỉ số tham chiếu | `^VNINDEX.VN` | 3.6 |
| Vĩ mô, tâm lý | Tuỳ chọn, làm sau cùng. Tâm lý thay bằng dòng tiền khối ngoại / tự doanh | 3.8 |
| Thứ tự | **0 → 1 → 2a → 2b → 4 → 3 → 5** | 4 |

## 1. Mục tiêu

Phân tích được cổ phiếu niêm yết ở Việt Nam (HOSE, HNX, UPCoM) với chất lượng gần bằng cổ phiếu Mỹ:
- đủ dữ liệu giá cho cả 3 sàn;
- có báo cáo tài chính theo quý;
- có tin tức tiếng Việt;
- so sánh kết quả với VN-Index;
- agent hiểu luật giao dịch Việt Nam.

**Không làm trong kế hoạch này:**
- giao dịch thật hoặc kết nối tài khoản công ty chứng khoán;
- dữ liệu realtime trong phiên;
- phái sinh (VN30F) và chứng quyền.

## 2. Hiện trạng (đã kiểm tra ngày 23/10/2026)

| Phần | Hiện trạng | Nguồn |
|---|---|---|
| Giá HOSE (`FPT.VN`, `VNM.VN`) | ✅ Có OHLCV ngày. Phiên gần nhất đôi khi trống giá đóng cửa | yfinance |
| Giá HNX (`SHS.HN`), UPCoM | ❌ Không có dữ liệu | yfinance |
| VN-Index | ✅ `^VNINDEX.VN` có dữ liệu, nhưng `benchmark_map` chưa có `.VN`, nên phần chấm điểm so với **SPY** | `default_config.py` |
| Báo cáo tài chính | ⚠️ Chỉ có báo cáo năm (2022–2025), ít dòng, không rõ ngày công bố | yfinance |
| SEC EDGAR | Không áp dụng | — |
| Tin tức | ⚠️ Chủ yếu tin tiếng Anh, rất ít tin về mã Việt Nam | yfinance |
| Tâm lý (StockTwits, Reddit) | ❌ Gần như không có bài | — |
| Vĩ mô | FRED là số liệu Mỹ, không phải Việt Nam | fred |
| Web UI | Không có danh mục hay mã mặc định cho Việt Nam; phải gõ `FPT.VN` ở ô "Mã khác…" | `web/lib/shared.ts` |

Kiến trúc hiện có thuận lợi cho việc mở rộng:
- [router.py](../tradingagents/dataflows/router.py) định tuyến mỗi tool qua một chuỗi nguồn dữ liệu (`VENDOR_METHODS`).
- Chuỗi nguồn cấu hình được theo nhóm (`data_vendors`) và theo từng tool (`tool_vendors`).
- Muốn thêm nguồn Việt Nam, chỉ cần thêm một thư mục vendor và đăng ký vào router.

## 3. Thiết kế

### 3.1 Ký hiệu mã

| Người dùng nhập | Mã chuẩn trong hệ thống | Gửi cho yfinance | Gửi cho nguồn Việt Nam |
|---|---|---|---|
| `FPT.VN` | `FPT.VN` | `FPT.VN` | `FPT` |
| `SHS.HN` | `SHS.HN` | (không có) | `SHS` |
| `FPT`, khi đang ở danh mục *Chứng khoán VN* | `FPT.VN` | `FPT.VN` | `FPT` |

- Tạm dùng đuôi **`.VN` cho mọi sàn Việt Nam**. Sàn thực tế (HOSE, HNX hay UPCoM) tra từ danh sách mã của nguồn Việt Nam.
- Giữ `.HN` làm bí danh của `.VN`.
- Gõ `FPT` trần, không có đuôi, ở danh mục khác vẫn hiểu là mã Mỹ. Tránh nhầm với mã Mỹ trùng tên.
- Sửa trong: [symbols.py](../tradingagents/dataflows/symbols.py) (thêm luật `.VN`/`.HN`) và [web_bridge.py](../cli/web_bridge.py) (category `vn_stock` thì tự thêm `.VN`).

### 3.2 Nguồn dữ liệu Việt Nam (vendor mới `vn`)

- Thư mục mới: `tradingagents/dataflows/vendors/vn/`, gồm `ohlcv.py`, `fundamentals.py`, `news.py` và `common.py` (chuẩn hoá mã, cache).
- Dùng thư viện **vnstock**: lấy dữ liệu miễn phí từ các công ty chứng khoán trong nước (VCI, TCBS…).
- **Đã kiểm tra trên GitHub ngày 23/10/2026** (thinh-vu/vnstock):
  - **Giấy phép:** riêng (`license-2026.09`), không phải mã nguồn mở. Bản Community **miễn phí cho dùng cá nhân, học tập, nghiên cứu**.
  - **Không được** phân phối lại, hoặc làm sản phẩm cho người khác truy cập dữ liệu, nếu không có thoả thuận riêng.
  - **Cần API key** (miễn phí) lấy ở vnstocks.com, chạy `vnstock register` một lần cho mỗi máy. Hạn mức phụ thuộc số người dùng, số thiết bị và gói Sponsor.
  - **Bản hiện hành là thế hệ 5**, cài từ kho riêng (`--extra-index-url https://vnstocks.com/api/packages`). Repo GitHub chỉ giữ code 4.x cũ.
  - **Nguồn:** KBS, VCI, MSN, FMarket.
  - **Dữ liệu:** giá lịch sử, chỉ số VNINDEX/HNX/UPCOM, BCTC, chỉ số tài chính, cổ đông, giao dịch nội bộ, tin công ty.
  - Tin tức đầy đủ (`vnstock_news`) nằm trong gói Sponsor trả phí.
- **Còn phải thử khi code:**
  - có BCTC theo quý không;
  - có dữ liệu khối ngoại không;
  - có đủ giá HNX/UPCoM không;
  - **build lại image Docker có bị tính là "thiết bị mới" không.** Nếu có, cần lưu thư mục cấu hình đăng ký của vnstock trong `./data`.
- Ghim phiên bản cụ thể trong `pyproject.toml`, đặt là *optional extra* `[vn]` để người không dùng thì không phải cài.
- Đăng ký vào `VENDOR_METHODS`:

| Tool | Chuỗi nguồn cho mã `.VN` |
|---|---|
| `get_stock_data` | `tv, yfinance, vn`. `tv` đọc bảng `price_bars`, xem phần TradingView bên dưới |
| `get_indicators` | Tính từ OHLCV của cùng chuỗi nguồn. Tái dùng `stockstats` như vendor yfinance đang làm |
| `get_fundamentals` / `get_balance_sheet` / `get_cashflow` / `get_income_statement` | `vn, yfinance` |
| `get_news` | `vn` (tin tiếng Việt, mục 3.4), rồi `yfinance` |
| `get_insider_transactions` | `vn` (giao dịch cổ đông nội bộ / lớn, nếu nguồn có), không có thì báo "không có dữ liệu" |

- **Chuỗi nguồn theo thị trường:** hiện `data_vendors` áp dụng chung cho mọi mã. Cần một cơ chế cho mã `.VN` tự dùng chuỗi `vn,…` mà không đổi cấu hình của mã Mỹ.
  - Đề xuất: thêm `market_vendors: {".VN": {...}}` vào `default_config.py`.
  - `route_to_vendor` xem đuôi mã của tham số đầu tiên rồi chọn chuỗi nguồn.
  - Giữ nguyên nguyên tắc hiện có: không âm thầm chuyển sang nguồn không được cấu hình.

#### Dữ liệu giá mà vendor `vn` phải cung cấp

| Hàm hiện có | Đầu vào | Cần trả về |
|---|---|---|
| `get_stock_data` (tool, qua router) | `symbol`, `start_date`, `end_date` (`YYYY-MM-DD`). `end_date` đã bị kẹp ≤ `trade_date` | Bảng CSV có dòng tiêu đề `# Stock data for …`, mỗi phiên một dòng: `Date, Open, High, Low, Close, Volume` |
| `get_indicators` (tool, qua router) | `symbol`, `indicator`, `curr_date`, `look_back_days` | Giá trị chỉ báo mỗi ngày. Tính bằng `stockstats` trên OHLCV, như vendor Yahoo |
| `load_ohlcv` (gọi thẳng, **không qua router**) | `symbol`, `as_of_date` | DataFrame OHLCV đủ ≥ 250 phiên trước `as_of_date` (Yahoo đang tải 5 năm), cắt đến `as_of_date`, cache theo mã. Dùng cho bảng số liệu đã xác minh (`snapshot.py`) |
| `get_closes` (gọi thẳng, **không qua router**) | `symbol`, `start_date`, `end_date` | Chuỗi giá đóng cửa. Dùng để chấm điểm quyết định so với chỉ số (`memory/settlement.py`), gồm cả giá **VN-Index** |

- Hai hàm `load_ohlcv` và `get_closes` đang gọi thẳng yfinance. Phải cho chúng đi qua cùng cơ chế chọn nguồn theo thị trường, nếu không mã HNX/UPCoM vẫn hỏng ở bảng số liệu và ở phần chấm điểm.
- **Lịch sử tối thiểu:** khoảng 230–250 phiên trước `trade_date` (SMA 200 + `look_back_days` 30), tức khoảng 1 năm. Nên lấy **1,5 năm** để dự phòng ngày nghỉ và phiên thiếu. Chỉ cần nhiều hơn khi phân tích lại ngày trong quá khứ: khi đó cần 1,5 năm tính ngược từ ngày đó. Con số 5 năm của vendor Yahoo chỉ là thói quen cache, không phải yêu cầu.
- **Giá điều chỉnh:** cổ phiếu Việt Nam thường chia cổ tức bằng cổ phiếu và phát hành thêm. Giá chưa điều chỉnh sẽ tạo "cú rơi" giả ở ngày giao dịch không hưởng quyền, làm sai chỉ báo.
  - Dùng **giá đã điều chỉnh** cho OHLCV và chỉ báo, giống Yahoo đang làm.
  - Ghi rõ "giá đã điều chỉnh" trong tiêu đề dữ liệu trả về.
- **Đơn vị:** chuẩn hoá về **VND đầy đủ** (57400, không phải 57.4) và ghi `Đơn vị: VND` trong tiêu đề. *Cần kiểm tra vnstock trả theo đồng hay theo nghìn đồng ở từng nguồn.*
- **Ngày:** `Date` không múi giờ, chỉ các phiên có giao dịch. Bỏ dòng không có giá đóng cửa, ví dụ phiên đang diễn ra.
- **Lỗi:** mã không tồn tại hoặc không có dữ liệu thì raise `NoMarketDataError`. Nguồn lỗi tạm thời thì raise `VendorUnavailableError`. Router đã biết xử lý hai lỗi này.

#### Phương án nguồn giá: TradingView qua extension (người dùng chọn, 23/10/2026)

Tái dùng cách làm của extension `C:\gamestudio\wyckoff\src\extension`:
- `page.js` bọc `window.WebSocket` của tab TradingView đã đăng nhập;
- `relay.js` chuyển khung dữ liệu sang service worker;
- service worker gửi về backend.

Phần cần đổi cho TradingAgents:

| | Extension Wyckoff hiện tại | Bản cho TradingAgents |
|---|---|---|
| Khung nến | Chỉ 1 phút (bỏ qua khung khác) | **1 ngày (1D)**. Thêm 1 phút về sau nếu cần |
| Nơi nhận | BE Wyckoff `POST /v1/feed/bars` | Web TradingAgents `POST /api/feed/bars`, chỉ nhận từ `127.0.0.1`, có khoá Bearer lưu trong bảng `settings` |
| Nơi lưu | Postgres/Timescale | Bảng mới `price_bars` trong `history.db`: `symbol, date, open, high, low, close, volume, source, received_at`, khoá chính `(symbol, date)` |
| Tick realtime | Có | Không cần. Phân tích dùng nến ngày đã đóng |

- **Vendor `tv` trong Python** đọc thẳng bảng `price_bars`. File DB nằm cùng thư mục dữ liệu, container đã mount sẵn.
  - Vendor này phục vụ cả 4 chỗ dùng giá ở bảng trên.
  - Không có nến hoặc nến quá cũ so với `trade_date`: raise `NoMarketDataError`, router chuyển sang nguồn kế tiếp (`yfinance` / `vn`).
- **Chuỗi nguồn giá đề xuất cho mã `.VN`:** `tv, yfinance, vn`.
- **Nạp lịch sử:** mở biểu đồ 1D từng mã trên TradingView một lần. Lượt tải đầu thường đã có vài trăm nến; nếu chưa đủ ~1,5 năm thì cuộn thêm. Vendor `tv` kiểm tra: không đủ ~230 phiên trước `trade_date` thì báo thiếu để router chuyển nguồn. Sau đó chỉ cần tab TradingView có mã đó trong watchlist để nhận nến mới mỗi ngày.
- **Chỉ số:** thêm `HOSE:VNINDEX` (và `HNX:HNXINDEX`, `UPCOM:UPINDEX` nếu cần) vào watchlist để có giá chỉ số cho phần chấm điểm.
- **Trang web:** trạng thái từng mã (số nến, ngày nến cuối, lần nhận cuối). Cảnh báo khi mã thuộc job mà nến cuối cũ hơn 1 phiên.
- **Giới hạn chấp nhận:** cần Chrome mở và tab TradingView sống. Job chạy lúc tab tắt thì dùng nguồn dự phòng (`yfinance` cho HOSE). Lỗi ghi vào Nhật ký lỗi.
- **Điều khoản:** chỉ dùng cá nhân, trên tài khoản của chính người dùng, không phân phối lại. Đây là lựa chọn của người dùng, đã ghi rõ trong README của extension.
- **Giá điều chỉnh:** bật "Adjust data for dividends" trên biểu đồ TradingView để giá đã điều chỉnh. Ghi vào tiêu đề dữ liệu trả về.
- **vnstock** vẫn cần cho **báo cáo tài chính** (giai đoạn 2), vì TradingView không thay được phần này.

#### Lưu trữ giá: nạp một lần, cập nhật hằng ngày, nạp lại khi có sự kiện doanh nghiệp

Mọi nguồn giá cùng ghi vào bảng `price_bars`. Bốn chỗ dùng giá (bảng ở trên) chỉ đọc từ bảng này, không cần biết nến đến từ đâu.

| Bước | Khi nào | Nguồn | Số request |
|---|---|---|---|
| **1. Nạp lịch sử** (backfill) | Lần đầu một mã được phân tích, hoặc bước 4 phát hiện lệch | `vn` (vnstock) cho mọi sàn; `yfinance` cho HOSE nếu không có vnstock | 1 request lấy 1,5 năm cho mỗi mã |
| **2. Cập nhật hằng ngày** | Mỗi phiên, khi tab TradingView mở | Extension TradingView (`source = 'tv'`) | 0 (extension đẩy về) |
| **3. Lấy bù phiên thiếu** | Lúc phân tích mà nến cuối trong DB cũ hơn phiên giao dịch gần nhất trước `trade_date` | `vn` / `yfinance`, chỉ khoảng ngày còn thiếu | 1 |
| **4. Kiểm tra sự kiện doanh nghiệp** | Mỗi lần phân tích một mã | Lấy ~5 nến gần nhất từ nguồn, so với DB | 1 |

**Vì sao cần bước 4:** giá điều chỉnh trong quá khứ bị tính lại mỗi khi mã có sự kiện doanh nghiệp: cổ tức bằng cổ phiếu, thưởng cổ phiếu, phát hành thêm, chia/gộp cổ phiếu.
- Ví dụ thưởng 20%: mọi giá trước ngày không hưởng quyền chia cho 1,2.
- Nếu giữ nguyên giá cũ trong DB thì xuất hiện cú rơi giả ở ngày không hưởng quyền, làm sai SMA/RSI/MACD.
- Ở Việt Nam việc này xảy ra thường xuyên, nhiều mã 1–2 lần mỗi năm.

**Cách kiểm tra ở bước 4:**
- So giá đóng cửa của các ngày trùng nhau giữa nguồn và DB.
- Lệch quá **0,5%** ở bất kỳ ngày nào: xoá toàn bộ nến của mã đó, chạy lại bước 1.
- Ghi một dòng vào log server: `[FPT.VN] giá điều chỉnh đã thay đổi, nạp lại lịch sử`.
- Mỗi mã chỉ nạp lại vài lần mỗi năm. Các lần phân tích còn lại đều đọc từ DB.
- Bước này cũng bắt được trường hợp TradingView tự tính lại giá cũ trên biểu đồ sau sự kiện, làm nến mới từ extension lệch với giá cũ trong DB.

**Quy tắc khi nhiều nguồn trùng ngày:**
- Trong một lần nạp, mọi nến lấy từ cùng một nguồn để chuỗi giá nhất quán.
- Nến mới từ extension (`tv`) ghi đè nến cùng ngày của nguồn khác, vì đó là nến người dùng thấy trên biểu đồ.
- Cột `source` và `received_at` cho biết mỗi nến đến từ đâu, lúc nào.

**Lưu ý point-in-time:** giá điều chỉnh của một ngày quá khứ đã tính cả các sự kiện xảy ra **sau** ngày đó. Khi phân tích lại ngày cũ, mức giá tuyệt đối có thể khác bảng giá lúc đó, nhưng xu hướng và chỉ báo vẫn đúng. Chấp nhận, và ghi chú "giá đã điều chỉnh" trong tiêu đề dữ liệu.

**Bảng `price_bars`:**
```sql
CREATE TABLE price_bars (
  symbol TEXT NOT NULL,        -- mã chuẩn, ví dụ FPT.VN, ^VNINDEX.VN
  date TEXT NOT NULL,          -- YYYY-MM-DD, phiên giao dịch
  open REAL, high REAL, low REAL, close REAL NOT NULL,
  volume REAL,
  source TEXT NOT NULL,        -- tv / vn / yfinance
  received_at INTEGER NOT NULL,
  PRIMARY KEY (symbol, date)
);
```
- Dữ liệu này dựng lại được bất cứ lúc nào bằng bước 1, nên mất bảng thì chỉ cần nạp lại. Không cần đưa vào bản sao lưu bắt buộc.
- Cập nhật `DB_DESIGN.md` khi làm.

### 3.2b Báo cáo tài chính

#### Repo cần gì

| Tool | Đầu vào | Cần trả về |
|---|---|---|
| `get_fundamentals` | `ticker`, `curr_date` | Tổng quan: tên, ngành, vốn hoá, P/E, P/B, EPS, ROE, ROA, nợ/vốn chủ, tỷ suất cổ tức, biên lợi nhuận |
| `get_balance_sheet` | `ticker`, `freq` (`quarterly`/`annual`), `curr_date` | Bảng cân đối kế toán theo kỳ |
| `get_income_statement` | như trên | Kết quả kinh doanh theo kỳ |
| `get_cashflow` | như trên | Lưu chuyển tiền tệ theo kỳ |
| `get_insider_transactions` | `ticker`, `curr_date` | Giao dịch nội bộ / cổ đông lớn |

Lượng dữ liệu: khoảng **8 quý gần nhất** và **4 năm**.

#### Nguồn dữ liệu

| Nguồn | Loại | Theo quý | Ngày công bố | Chi phí | Đánh giá |
|---|---|---|---|---|---|
| **vnstock** (lấy từ VCI/KBS) | API Python | Có thể (cần thử) | Không có | Miễn phí cá nhân, cần key | **Nguồn chính.** Có số liệu dạng bảng, gọi bằng code |
| **yfinance** | API Python (đã có trong repo) | ❌ Chỉ báo cáo năm | Không có | Miễn phí | Dự phòng: ít dòng, chỉ sàn HOSE |
| **Cổng công bố thông tin UBCKNN** (congbothongtin.ssc.gov.vn), trang công bố của HOSE/HNX | Nguồn gốc chính thức | ✅ | ✅ **Thời điểm công bố chính xác** | Miễn phí | Báo cáo là file PDF. Dùng để **lấy ngày công bố**, không dùng lấy số liệu |
| **Trang quan hệ nhà đầu tư** của từng công ty | Nguồn gốc | ✅ | ✅ | Miễn phí | Mỗi công ty một kiểu, không tự động hoá được |
| **CafeF, Vietstock** (trang tài chính) | Web | ✅ | Một phần | Miễn phí xem | Không cào tự động (điều khoản). Dùng để **đối chiếu tay** khi kiểm tra chất lượng |
| **FiinGroup** (FiinPro / FiinTrade), dịch vụ dữ liệu Vietstock | Dịch vụ trả phí | ✅ | ✅ | Trả phí, giá cho tổ chức | Chất lượng cao, chuẩn hoá theo ngành. Cân nhắc nếu dùng lâu dài (*giá, điều khoản cần hỏi trực tiếp*) |
| **SSI FastConnect Data** | API chính thức | *Cần xác minh*: chủ yếu dữ liệu giá | — | Miễn phí với tài khoản SSI | Chưa chắc dùng được cho phần này |

**Chọn:**
- **Số liệu:** vnstock, dự phòng yfinance cho mã HOSE.
- **Ngày công bố:** trước mắt ước lượng theo hạn nộp (mục 3.3). Sau này có thể lấy ngày đăng thật từ cổng công bố thông tin UBCKNN.

#### Điểm riêng của Việt Nam

1. **Mẫu báo cáo theo ngành** (chuẩn kế toán Việt Nam, VAS): ngân hàng, chứng khoán, bảo hiểm có mẫu riêng. Ví dụ ngân hàng có "thu nhập lãi thuần" thay cho "doanh thu".
   - Giữ nguyên tên dòng của nguồn.
   - Ghi loại doanh nghiệp vào tiêu đề dữ liệu.
2. **Đơn vị:** thường là tỷ hoặc triệu đồng. Chuẩn hoá về một đơn vị và ghi rõ trong tiêu đề.
3. **Tổng quan là số hiện tại:** phân tích ngày quá khứ thì ẩn đi (`withhold_live_profile`). Về sau có thể tự tính P/E, P/B từ `price_bars` và báo cáo của kỳ phù hợp.
4. **Lưu trong DB:** bảng `fin_statements`, khoá `(symbol, statement, period)`.
   - Chỉ hỏi lại nguồn khi đã qua hạn công bố của quý mới.
   - Mỗi mã chỉ tốn vài request mỗi quý.

#### Kiểm tra chất lượng (làm trước khi code vendor)

Thử vnstock với 6 mã đại diện:

| Loại | Mã |
|---|---|
| Doanh nghiệp thường (HOSE) | FPT, HPG, VNM |
| Ngân hàng | VCB |
| Chứng khoán | SSI |
| HNX | SHS |

| Kiểm tra | Đạt khi |
|---|---|
| Có báo cáo **theo quý** cho cả 3 báo cáo | ≥ 8 quý gần nhất, không thiếu quý giữa chừng |
| Có báo cáo **năm** | ≥ 4 năm |
| Số liệu khớp CafeF hoặc Vietstock | Doanh thu (hoặc thu nhập lãi thuần), lợi nhuận sau thuế, tổng tài sản, vốn chủ sở hữu của 2 quý gần nhất: lệch ≤ 0,1% |
| Đơn vị | Xác định được đồng, triệu hay tỷ |
| Mẫu ngân hàng / chứng khoán | Có đủ dòng chính, tên dòng đọc hiểu được |
| Hợp nhất hay riêng lẻ | Biết nguồn trả loại nào. Ưu tiên **hợp nhất** |
| Tổng quan | Có ngành, vốn hoá, P/E, P/B, ROE |
| Giao dịch nội bộ | Có hay không |
| Báo cáo quý mới nhất | Có trong vòng vài ngày sau khi công ty công bố |

Ghi kết quả vào phụ lục của plan này. Nếu vnstock không đạt ở phần theo quý hoặc độ khớp số liệu thì cân nhắc FiinGroup trước khi làm giai đoạn 2.

### 3.3 Đúng thời điểm (point-in-time)

Repo đang đảm bảo phân tích một ngày trong quá khứ chỉ thấy dữ liệu có tại ngày đó (`as_of`, `withhold_undated_statements`). Nguồn Việt Nam phải giữ nguyên tắc này:
- **Giá:** cắt dữ liệu đến `trade_date`.
- **Báo cáo tài chính:** nguồn Việt Nam thường chỉ ghi kỳ báo cáo, không ghi ngày công bố.
  - Ước lượng ngày công bố = cuối kỳ + hạn nộp theo quy định công bố thông tin (Thông tư 96/2020/TT-BTC, *cần xác minh số ngày cho báo cáo quý riêng lẻ, hợp nhất và báo cáo năm kiểm toán*).
  - Kỳ nào chưa tới ngày ước lượng thì không đưa vào.
- **Tin tức:** lọc theo ngày đăng, như `in_window` hiện có.

### 3.4 Tin tức tiếng Việt

- Đọc RSS chính thức: CafeF, Vietstock, VnExpress Kinh doanh, Người Quan Sát… *Cần kiểm tra điều khoản và robots.txt của từng trang, chỉ dùng RSS công khai, không cào trang.*
- Bổ sung **tin của từng công ty từ vnstock** (bản Community có). Bộ tin đầy đủ `vnstock_news` thuộc gói Sponsor, không dùng.
- Lọc tin theo mã và tên công ty. Tên công ty lấy từ danh sách mã của nguồn Việt Nam.
- Tin chung về thị trường (`get_global_news` cho mã `.VN`): VN-Index, NHNN, tỷ giá, khối ngoại.
- Không dịch tin. Model đọc thẳng tiếng Việt, và báo cáo vẫn theo ngôn ngữ người dùng chọn.

### 3.5 Bối cảnh thị trường cho agent (luật giao dịch Việt Nam)

**Vì sao:** các agent là model AI, kiến thức chủ yếu từ thị trường Mỹ. Không được nhắc thì chúng có thể đưa khuyến nghị không làm được ở Việt Nam:

| Agent có thể nói (theo thói quen thị trường Mỹ) | Ở Việt Nam |
|---|---|
| "Bán khống HPG khi giá giảm" | Không được bán khống cổ phiếu |
| "Mua sáng, chốt lời chiều nếu tăng 3%" | T+2: mua hôm nay thì 2 phiên sau mới bán được |
| "Cắt lỗ -12% trong phiên" | HOSE chỉ dao động ±7%/phiên; giá có thể giảm sàn nhiều phiên liền |
| "Mua 50 cổ phiếu" | Lô chẵn 100 cổ phiếu |
| "Giá mục tiêu 62.5" | Giá tính bằng VND (62.500), có bước giá theo vùng giá |
| Bỏ qua yếu tố nước ngoài | Room ngoại và dòng tiền khối ngoại ảnh hưởng mạnh tới nhiều mã lớn |

**Cách làm:** `build_instrument_context` ([context.py](../tradingagents/agents/context.py)) đã được chèn vào prompt của **mọi agent**, và đã có nhánh riêng cho crypto. Thêm một nhánh cho mã `.VN`, theo sàn của mã. Nội dung (viết bằng tiếng Anh như phần còn lại của prompt):
- **Biên độ giá** trong phiên: HOSE ±7%, HNX ±10%, UPCoM ±15%.
- **Thanh toán T+2**: mua hôm nay, 2 ngày sau mới bán được.
- **Không bán khống** cổ phiếu.
- **Lô giao dịch**: 100 cổ phiếu.
- **Đơn vị giá**: VND. Bảng giá hiển thị theo nghìn đồng.
- **Giờ giao dịch** 9:00–15:00 (ICT), nghỉ trưa, nghỉ dài dịp Tết.
- **Room ngoại** và **dòng tiền khối ngoại** là yếu tố quan trọng.
- **Phiên ATO / ATC** (khớp lệnh định kỳ mở cửa, đóng cửa) và **bước giá** theo vùng giá.
- **Ý nghĩa đánh giá:** Underweight / Sell nghĩa là **bán bớt cổ phiếu đang có hoặc đứng ngoài**, không phải bán khống. Kế hoạch giao dịch phải có khung thời gian ≥ T+2.

Đoạn này chỉ thêm cho mã `.VN`. Mã Mỹ, crypto, forex giữ nguyên bối cảnh cũ (có test hồi quy).

*Toàn bộ số liệu luật ở trên cần đối chiếu quy định hiện hành của UBCKNN/HOSE/HNX trước khi đưa vào prompt.*

### 3.6 Chỉ số tham chiếu

Trong `benchmark_map` ([default_config.py](../tradingagents/default_config.py)):
```python
".VN": "^VNINDEX.VN",   # Việt Nam (VN-Index), đã kiểm tra có dữ liệu trên Yahoo
```
- Mã HNX, UPCoM tạm dùng VN-Index.
- Nếu nguồn `vn` có chỉ số HNX-Index / UPCoM-Index thì phần chấm điểm (reflection) cần lấy giá chỉ số qua chuỗi nguồn, không gọi thẳng yfinance.

### 3.7 Web UI

- Thêm danh mục **"Chứng khoán VN"** (`vn_stock`) vào `CATEGORIES` trong [shared.ts](../web/lib/shared.ts). Mã mặc định là VN30, ví dụ `FPT VCB HPG VNM MWG TCB SSI`; danh sách lấy theo rổ VN30 hiện hành.
- Placeholder cho "Mã khác…": `VD: FPT, SHS, BSR`.
- Bỏ chọn analyst **Tâm lý** mặc định cho danh mục này, vì không có dữ liệu.
- Hướng dẫn ([guide.ts](../web/lib/guide.ts)): thêm một mục về chứng khoán Việt Nam, gồm nguồn dữ liệu, giới hạn và luật giao dịch.
- Thêm bản dịch vào `en.ts`. `check-i18n` phải qua.

### 3.8 Vĩ mô và tâm lý (giai đoạn sau, tuỳ chọn)

- **Vĩ mô Việt Nam:** lãi suất điều hành NHNN, CPI (Tổng cục Thống kê), tỷ giá USD/VND. Đưa vào nhóm `macro_data` như một vendor tuỳ chọn. Lỗi thì bỏ qua, như FRED đang làm.
- **Tâm lý:** dữ liệu mạng xã hội Việt Nam (diễn đàn, nhóm Facebook) khó lấy hợp lệ và nhiều nhiễu. Đề xuất thay bằng **dòng tiền khối ngoại và tự doanh** làm chỉ báo tâm lý. Cần xác minh nguồn có cung cấp không.

## 4. Các giai đoạn

| GĐ | Nội dung | Kết quả kiểm chứng | Ước lượng |
|---|---|---|---|
| **0** | `benchmark_map` thêm `.VN`; danh mục "Chứng khoán VN" trên web, mã VN30 mặc định, tự thêm `.VN`; bỏ Tâm lý mặc định; mục Hướng dẫn | Chạy được `FPT.VN` từ web; phần chấm điểm ghi *Alpha vs ^VNINDEX.VN* | 0,5 ngày |
| **1** | Nguồn giá TradingView:<br>- extension (tách từ bản Wyckoff, nến 1D)<br>- `POST /api/feed/bars` + bảng `price_bars`<br>- vendor `tv`<br>- nạp lịch sử 1,5 năm, lấy bù phiên thiếu, nạp lại khi có sự kiện doanh nghiệp<br>- luật mã `.VN`/`.HN`<br>- `market_vendors` trong router<br>- `load_ohlcv`/`get_closes` đi qua router | `SHS.HN` (HNX), một mã UPCoM và VN-Index có giá từ TradingView; tắt tab thì tự dùng yfinance; mã Mỹ không đổi hành vi | 2–3 ngày |
| **2a** | **Kiểm tra chất lượng vnstock** với 6 mã: FPT, HPG, VNM, VCB, SSI, SHS (bảng kiểm ở 3.2b). Ghi kết quả vào phụ lục A | Đạt các tiêu chí 3.2b; không đạt thì quyết định lại nguồn trước khi làm 2b | 0,5 ngày |
| **2b** | Báo cáo tài chính theo quý và năm từ `vn`:<br>- bảng `fin_statements`<br>- lọc point-in-time theo ngày công bố ước lượng<br>- ghi đơn vị và loại doanh nghiệp (ngân hàng / chứng khoán / thường) | Phân tích FPT ngày 15/02 (quá khứ) không thấy BCTC Q4 năm trước nếu chưa tới hạn công bố; số liệu VCB đọc đúng mẫu ngân hàng | 1–2 ngày |
| **3** | Tin tức tiếng Việt: RSS + tin công ty từ vnstock, lọc theo mã | Analyst Tin tức có ≥ 5 tin tiếng Việt liên quan cho mã VN30 | 1–2 ngày |
| **4** | Bối cảnh luật giao dịch Việt Nam trong prompt (mục 3.5), theo sàn | Trader không đề xuất bán khống hay mua bán trong ngày với mã `.VN`; mã Mỹ/crypto/forex không đổi | 0,5 ngày |
| **5** (tuỳ chọn) | Vĩ mô Việt Nam; khối ngoại thay cho tâm lý | — | 2–3 ngày |

Thứ tự **0 → 1 → 2a → 2b → 4 → 3 → 5**.
- Giai đoạn 0 làm ngay được, không cần thư viện mới.
- 2a có thể làm song song với 1, khi đã có key vnstock.
- Tổng ước lượng (không tính 5): **khoảng 6–9 ngày**.

## 5. Kiểm thử

- **Unit test, không gọi mạng:** lưu sẵn phản hồi mẫu của vnstock và RSS trong `tests/fixtures/vn/`. Test các phần:
  - chuẩn hoá mã;
  - cắt theo ngày;
  - ước lượng ngày công bố BCTC;
  - lọc tin theo mã;
  - phát hiện giá điều chỉnh thay đổi (lệch > 0,5%) thì nạp lại lịch sử; khớp thì không gọi nạp lại;
  - lấy bù đúng khoảng phiên còn thiếu;
  - chọn chuỗi nguồn theo thị trường.
- **Test hồi quy:** mã Mỹ (`NVDA`), crypto (`BTCUSDT`) và forex (`XAUUSD`) vẫn qua đúng chuỗi nguồn cũ.
- **Chạy thật** (tay, ngoài CI): một mã HOSE, một mã HNX, một mã UPCoM, cả ngày hiện tại và một ngày quá khứ. So số liệu chính (giá đóng cửa, doanh thu quý) với CafeF.
- `pytest`, `ruff`, `npx tsc --noEmit` và `node scripts/check-i18n.mjs` đều phải qua.

## 6. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| vnstock đổi API hoặc giấy phép | Ghim phiên bản. Bọc toàn bộ lời gọi trong `vendors/vn/` để chỉ phải sửa một chỗ. Có yfinance làm nguồn dự phòng cho HOSE |
| Nguồn miễn phí giới hạn số lượt gọi hoặc chặn IP | Cache theo ngày, tái dùng `data_cache_dir`. Mỗi lần phân tích chỉ gọi vài lần |
| Thiếu ngày công bố BCTC → lộ dữ liệu tương lai khi phân tích quá khứ | Ước lượng bảo thủ (hạn nộp muộn nhất). Ghi rõ trong báo cáo là ngày ước lượng |
| Trùng mã Việt Nam với mã Mỹ (`FPT`, `MWG`…) | Chỉ hiểu là mã Việt Nam khi có đuôi `.VN`/`.HN` hoặc đang ở danh mục Chứng khoán VN |
| Model hiểu sai đơn vị giá (VND, nghìn đồng) | Ghi đơn vị trong dữ liệu trả về và trong phần bối cảnh thị trường |
| Tab TradingView tắt hoặc máy ngủ → thiếu nến mới | Bước 3 lấy bù từ vnstock/yfinance. Trang web cảnh báo mã có dữ liệu cũ |
| TradingView đổi giao thức WebSocket → extension hỏng | Vendor `tv` báo thiếu, router dùng nguồn dự phòng. Lỗi hiện ở Nhật ký lỗi |
| Điều khoản TradingView | Chỉ dùng cá nhân trên tài khoản của người dùng, không phân phối lại (lựa chọn của người dùng) |
| Giá điều chỉnh thay đổi sau sự kiện doanh nghiệp | Bước 4: so nến gần nhất, lệch > 0,5% thì nạp lại lịch sử |

## 7. Việc còn mở

**Đã quyết:**
- Giá: TradingView (extension) + nạp lịch sử 1,5 năm.
- Báo cáo tài chính: vnstock, chờ kết quả kiểm tra chất lượng (2a).
- Thêm luật giao dịch Việt Nam vào bối cảnh cho agent.

**Còn cần người dùng:**
1. **Key vnstock:** đăng ký miễn phí ở vnstocks.com, rồi tự chạy `vnstock register`. Cần cho 2a và nạp lịch sử giá HNX/UPCoM.
2. **Đồng ý cài vnstock** từ kho riêng (`--extra-index-url https://vnstocks.com/api/packages`) vào một môi trường tạm để làm 2a.
3. **Mã mặc định:** VN30, hay danh sách bạn hay theo dõi?
4. **Trang tin** cho Tin tức tiếng Việt (giai đoạn 3).
5. Đối chiếu tay với CafeF/Vietstock trong 2a (vài con số mỗi mã).

**Cần xác minh khi làm:**
- Hạn công bố BCTC theo Thông tư 96/2020 (mục 3.3).
- Các số liệu luật giao dịch hiện hành: biên độ, bước giá, giờ, lô (mục 3.5).
- Điều khoản RSS của từng trang tin (mục 3.4).
- vnstock: báo cáo theo quý, khối ngoại, HNX/UPCoM, việc đăng ký thiết bị trong Docker (mục 3.2).

## Phụ lục A. Kết quả kiểm tra chất lượng vnstock (giai đoạn 2a)

*Chưa thực hiện.*
