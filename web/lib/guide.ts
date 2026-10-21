import type { Lang } from "./lang";

/** A guide section: markdown paragraphs, plain tables, and the coloured rating table. */
export type Block =
  | { md: string }
  | { table: { head: string[]; rows: string[][] } }
  | { ratings: [string, string][] };
export type GuideSection = { id: string; nav: string; title: string; blocks: Block[] };
export type Guide = { title: string; home: string; disclaimer: string; sections: GuideSection[] };

const vi: Guide = {
  title: "Hướng dẫn",
  home: "Trang chủ",
  disclaimer:
    "TradingAgents là công cụ nghiên cứu, không phải lời khuyên đầu tư. Kết quả phụ thuộc model, dữ liệu và yếu tố ngẫu nhiên của model ngôn ngữ.",
  sections: [
    {
      id: "rating",
      nav: "Đọc kết quả",
      title: "Đọc kết quả: thang rating 5 mức",
      blocks: [
        { md: "Kết quả mỗi lần phân tích là rating của Portfolio Manager, từ tích cực nhất đến tiêu cực nhất:" },
        {
          ratings: [
            ["Buy", "Rất tin tưởng: mở hoặc tăng vị thế mua."],
            ["Overweight", "Triển vọng tốt: tăng dần tỷ trọng."],
            ["Hold", "Giữ nguyên, chưa cần hành động."],
            ["Underweight", "Nghiêng tiêu cực: giảm tỷ trọng, chốt bớt, không mua thêm. Không có nghĩa là bán hết."],
            ["Sell", "Thoát vị thế hoặc không vào lệnh."],
            ["REVIEW", "Không đọc được rating từ quyết định: hãy tự đọc tab “Quyết định cuối” hoặc chạy lại."],
          ],
        },
        {
          md: "Lý do và hành động cụ thể (vùng giá vào, cắt lỗ, tỷ trọng) nằm trong tab **Quyết định cuối**. Các tab khác là báo cáo của từng agent, đọc để hiểu vì sao có kết luận đó.",
        },
      ],
    },
    {
      id: "agents",
      nav: "12 agent",
      title: "12 agent và việc của từng agent",
      blocks: [
        {
          md: "Model **nhanh** và **sâu** là hai ô chọn model khi phân tích; agent nào dùng model nào ghi ở cột “Model”. Thường chọn model mạnh hơn cho tầng sâu vì đó là nơi ra quyết định.",
        },
        {
          table: {
            head: ["Agent", "Model", "Làm gì", "Dữ liệu dùng"],
            rows: [
              ["Analyst Thị trường", "nhanh", "Phân tích kỹ thuật: chọn tối đa 8 chỉ báo bổ trợ nhau (SMA/EMA, MACD, RSI, Bollinger, ATR, VWMA), đối chiếu với ảnh chụp giá đã kiểm chứng, viết báo cáo xu hướng.", "Giá OHLCV, chỉ báo kỹ thuật"],
              ["Analyst Tâm lý", "nhanh", "Đọc tin và bài đăng mạng xã hội, chấm tâm lý thị trường (từ Bearish đến Bullish) kèm điểm và độ tin cậy.", "Tin Yahoo, StockTwits, Reddit"],
              ["Analyst Tin tức", "nhanh", "Tổng hợp tin công ty và tin vĩ mô thế giới trong tuần, dẫn chứng bằng số liệu kinh tế và xác suất sự kiện.", "Tin công ty và toàn cầu, FRED, Polymarket"],
              ["Analyst Cơ bản", "nhanh", "Phân tích sức khoẻ tài chính: doanh thu, lợi nhuận, dòng tiền, bảng cân đối, định giá, giao dịch của người nội bộ. Chỉ chạy cho chứng khoán.", "SEC EDGAR (công ty Mỹ), Yahoo Finance"],
              ["Bull Researcher", "nhanh", "Bênh vực việc mua: nhấn mạnh tăng trưởng, lợi thế cạnh tranh, tín hiệu tích cực, phản bác phe Bear.", "Báo cáo analyst, lịch sử tranh luận"],
              ["Bear Researcher", "nhanh", "Phản biện việc mua: chỉ ra rủi ro, điểm yếu, tín hiệu tiêu cực, phản bác phe Bull.", "Báo cáo analyst, lịch sử tranh luận"],
              ["Research Manager", "sâu", "Làm trọng tài tranh luận Bull/Bear, chọn phe có lập luận mạnh hơn, ra kế hoạch đầu tư kèm rating sơ bộ.", "Toàn bộ tranh luận Bull/Bear"],
              ["Trader", "nhanh", "Biến kế hoạch đầu tư thành đề xuất giao dịch: Mua / Giữ / Bán, giá vào, cắt lỗ, khối lượng.", "Kế hoạch của Research Manager, báo cáo analyst"],
              ["Rủi ro: Mạo hiểm", "nhanh", "Bảo vệ cơ hội lợi nhuận cao, cho rằng đề xuất có thể mạnh tay hơn.", "Đề xuất của Trader, ý kiến hai phe rủi ro còn lại"],
              ["Rủi ro: Thận trọng", "nhanh", "Ưu tiên bảo toàn vốn, chỉ ra rủi ro giảm giá, đề nghị giảm quy mô hoặc thêm phòng thủ.", "Như trên"],
              ["Rủi ro: Trung lập", "nhanh", "Cân bằng hai phía, tìm phương án vừa phải giữa lợi nhuận và rủi ro.", "Như trên"],
              ["Portfolio Manager", "sâu", "Cân nhắc tranh luận rủi ro, kế hoạch, đề xuất của Trader và bài học từ các quyết định trước, chốt rating cuối cùng.", "Toàn bộ kết quả trước đó, nhật ký quyết định cũ"],
            ],
          },
        },
        {
          md: "Ngoài 12 agent còn có bước **Nhật ký** chạy song song với các analyst: chấm điểm các quyết định cũ đã đủ thời gian và đưa bài học cho Portfolio Manager. Với crypto, forex, hàng hoá thì Analyst Cơ bản không chạy, nên còn 11 agent.",
        },
      ],
    },
    {
      id: "steps",
      nav: "Các bước",
      title: "Các bước của một lần phân tích",
      blocks: [
        {
          md: `1. **Analyst:** các analyst được chọn chạy song song, mỗi agent có công cụ dữ liệu riêng. Cùng lúc, bước Nhật ký chấm điểm các quyết định cũ.
2. **Tranh luận Bull/Bear:** Bull và Bear lần lượt nói, mỗi bên số lượt bằng độ sâu; Research Manager tổng hợp thành kế hoạch đầu tư.
3. **Trader:** biến kế hoạch thành đề xuất giao dịch cụ thể.
4. **Tranh luận rủi ro:** Mạo hiểm → Thận trọng → Trung lập, xoay vòng, mỗi bên số lượt bằng độ sâu.
5. **Quyết định cuối:** Portfolio Manager chốt rating và hành động.

Cột **Diễn biến** bên phải chia theo các bước trên. Thẻ viền nét đứt là chữ model đang viết; khi model đang suy nghĩ, thẻ hiện bộ đếm giây.`,
        },
      ],
    },
    {
      id: "scales",
      nav: "Các thang đo khác",
      title: "Các thang đo khác trong báo cáo",
      blocks: [
        { md: "**Tâm lý thị trường** (Analyst Tâm lý): 6 mức, điểm 0–10 (5 là trung tính) và độ tin cậy thấp / trung bình / cao theo lượng dữ liệu thu được." },
        {
          table: {
            head: ["Mức", "Ý nghĩa"],
            rows: [
              ["Bullish", "Tích cực rõ, khoảng 6,5–10 điểm"],
              ["Mildly Bullish", "Hơi tích cực, khoảng 5,5–6,4"],
              ["Neutral", "Trung tính: các nguồn im lặng hoặc không nghiêng bên nào, khoảng 4,5–5,5"],
              ["Mixed", "Trái chiều: các nguồn nói ngược nhau, khoảng 4,5–5,5"],
              ["Mildly Bearish", "Hơi tiêu cực, khoảng 3,5–4,4"],
              ["Bearish", "Tiêu cực rõ, khoảng 0–3,4"],
            ],
          },
        },
        {
          md: `**Đề xuất của Trader:** chỉ 3 hành động **Buy / Hold / Sell**, kèm giá vào, cắt lỗ và khối lượng. Mức Overweight / Underweight chỉ do Portfolio Manager quyết ở bước cuối.

**Kế hoạch của Research Manager:** dùng cùng thang 5 mức như kết quả cuối, nhưng chỉ là đánh giá sơ bộ trước khi qua Trader và tranh luận rủi ro.`,
        },
      ],
    },
    {
      id: "depth",
      nav: "Độ sâu",
      title: "Độ sâu nghiên cứu",
      blocks: [
        {
          table: {
            head: ["Độ sâu", "Ý nghĩa"],
            rows: [
              ["Nông (1)", "Bull và Bear mỗi bên nói 1 lượt; 3 phe rủi ro mỗi bên 1 lượt. Nhanh nhất, ít token nhất."],
              ["Trung bình (3)", "Mỗi bên 3 lượt: tranh luận phản bác qua lại nhiều hơn."],
              ["Sâu (5)", "Mỗi bên 5 lượt: kỹ nhất, lâu và tốn token nhất (khoảng gấp 4–5 lần Nông ở phần tranh luận)."],
            ],
          },
        },
      ],
    },
    {
      id: "symbols",
      nav: "Danh mục và mã",
      title: "Danh mục và mã",
      blocks: [
        {
          md: `- **Chứng khoán:** mã theo Yahoo Finance, kèm đuôi sàn khi không phải Mỹ: \`0700.HK\`, \`7203.T\`, \`AZN.L\`, \`600519.SS\`, \`RELIANCE.NS\`.
- **Crypto:** \`BTCUSDT\`, \`ETHUSDT\` hoặc dạng \`BTC-USD\`.
- **Forex & hàng hoá:** \`XAUUSD\`, \`XAGUSD\`, \`USOIL\`, \`EURUSD\`…
- Không có trong danh sách: chọn “Mã khác…” rồi nhập.
- Crypto, forex và hàng hoá không có báo cáo tài chính, nên analyst Cơ bản được bỏ qua tự động.

Mã kiểu sàn môi giới được đổi sang mã Yahoo trước khi lấy dữ liệu:`,
        },
        {
          table: {
            head: ["Bạn nhập", "Mã Yahoo", "Ghi chú"],
            rows: [
              ["XAUUSD, XAU/USD, GOLD", "GC=F", "Vàng: hợp đồng tương lai COMEX (Yahoo không có vàng giao ngay)"],
              ["XAGUSD", "SI=F", "Bạc COMEX"],
              ["USOIL, WTI", "CL=F", "Dầu WTI"],
              ["UKOIL, BRENT", "BZ=F", "Dầu Brent"],
              ["EURUSD, GBPUSD, USDJPY…", "EURUSD=X…", "Cặp forex giao ngay"],
              ["BTCUSDT, BTCUSD", "BTC-USD", "Crypto (tương tự ETH, SOL, XRP, ADA, DOGE, LTC, BCH, DOT, AVAX, LINK)"],
              ["SPX500, US500", "^GSPC", "Chỉ số S&P 500 (tương tự NAS100 → ^NDX, US30 → ^DJI, GER40 → ^GDAXI…)"],
              ["700.HK", "0700.HK", "Mã Hồng Kông được thêm số 0 cho đủ 4 chữ số"],
              ["600519.SH", "600519.SS", "Yahoo viết sàn Thượng Hải là .SS"],
            ],
          },
        },
      ],
    },
    {
      id: "terms",
      nav: "Thuật ngữ",
      title: "Thuật ngữ thường gặp trong báo cáo",
      blocks: [
        {
          table: {
            head: ["Thuật ngữ", "Nghĩa"],
            rows: [
              ["SMA 50 / SMA 200", "Trung bình giá 50 / 200 phiên: xu hướng trung hạn / dài hạn. Giá trên đường là tích cực, dưới là tiêu cực."],
              ["EMA 10", "Trung bình 10 phiên có trọng số cho giá gần đây: phản ứng nhanh với biến động ngắn hạn."],
              ["Golden cross / Death cross", "SMA 50 cắt lên / xuống SMA 200: tín hiệu xu hướng tăng / giảm dài hạn."],
              ["MACD, Signal, Histogram", "Đo động lượng. MACD cắt lên Signal là tích cực; Histogram co lại là động lượng yếu đi."],
              ["RSI", "Thang 0–100. Trên 70 là quá mua, dưới 30 là quá bán; trong xu hướng mạnh RSI có thể ở vùng cực lâu."],
              ["Bollinger Bands", "Dải quanh trung bình 20 phiên ± 2 độ lệch chuẩn. Chạm dải trên/dưới gợi ý quá mua/quá bán; dải hẹp là biến động thấp."],
              ["ATR", "Biên độ dao động trung bình mỗi phiên: dùng đặt cắt lỗ và quyết định khối lượng."],
              ["VWMA", "Trung bình giá có trọng số theo khối lượng: xác nhận xu hướng bằng dòng tiền."],
              ["Hỗ trợ / Kháng cự", "Vùng giá thường bật lên / bị chặn lại."],
              ["Cắt lỗ (stop loss)", "Mức giá thoát lệnh để giới hạn thua lỗ."],
              ["Bán khống", "Bán trước mua sau, có lời khi giá giảm."],
              ["Alpha", "Lợi nhuận vượt trội so với chỉ số tham chiếu trong cùng thời gian."],
            ],
          },
        },
      ],
    },
    {
      id: "data",
      nav: "Nguồn dữ liệu",
      title: "Nguồn dữ liệu và key",
      blocks: [
        {
          table: {
            head: ["Nguồn", "Key", "Dùng cho"],
            rows: [
              ["Yahoo Finance", "Không cần", "Giá, chỉ báo, tin tức, thông tin công ty; báo cáo tài chính cho công ty ngoài Mỹ. Nguồn mặc định."],
              ["SEC EDGAR", "Không cần (nên điền liên hệ SEC_EDGAR_USER_AGENT)", "Báo cáo tài chính công ty Mỹ đúng như đã nộp tại từng thời điểm."],
              ["FRED", "FRED_API_KEY (miễn phí)", "Lãi suất, lạm phát, việc làm, GDP, lợi suất trái phiếu. Thiếu key thì phần vĩ mô báo không có dữ liệu."],
              ["Polymarket", "Không cần", "Xác suất thị trường dự đoán cho các sự kiện (Fed, suy thoái, bầu cử…)."],
              ["StockTwits, Reddit", "Không cần", "Bài đăng cho Analyst Tâm lý."],
              ["TypeSafe Jev", "TYPESAFE_API_KEY (tuỳ chọn)", "Lọc bài đăng không liên quan và gắn lập trường trước khi Analyst Tâm lý đọc."],
              ["Alpha Vantage", "ALPHA_VANTAGE_API_KEY (tuỳ chọn)", "Nguồn thay thế cho giá, chỉ báo, tin tức, báo cáo tài chính."],
            ],
          },
        },
        {
          md: "Khi chạy cho một ngày trong quá khứ, giá và báo cáo tài chính được lấy đúng như tại ngày đó (không nhìn trước tương lai). Báo cáo tài chính ngoài Mỹ và giao dịch nội bộ bị giữ lại vì không xác định được ngày công bố. Tin mạng xã hội luôn là tin hiện tại.",
        },
      ],
    },
    {
      id: "llm",
      nav: "Nhà cung cấp LLM",
      title: "Nhà cung cấp LLM",
      blocks: [
        {
          md: `- **Có key:** OpenAI, Anthropic (Claude), Google (Gemini), xAI (Grok), DeepSeek, Qwen, GLM, MiniMax, Mistral, Kimi, Groq, NVIDIA NIM, Azure OpenAI, Amazon Bedrock. Nhập key ở [⚙ Cài đặt](/settings).
- **OpenRouter:** một key dùng được rất nhiều model của nhiều hãng, có cả model miễn phí (đuôi \`:free\`, chậm và giới hạn lượt).
- **Ollama / OpenAI-compatible:** model chạy trên máy bạn hoặc server riêng, không cần key, cần điền địa chỉ server.
- **ChatGPT (gói Plus/Pro):** dùng gói ChatGPT thay cho API key; đăng nhập một lần bằng \`tradingagents login chatgpt\`.
- Model không có trong danh sách: chọn “Nhập model ID khác…”.`,
        },
      ],
    },
    {
      id: "scoring",
      nav: "Chấm điểm",
      title: "Chấm điểm quyết định và bài học",
      blocks: [
        {
          md: "Mỗi quyết định được ghi vào nhật ký. Sau **5 phiên giao dịch** tính từ phiên đóng cửa đầu tiên sau ngày phân tích, hệ thống tính lợi nhuận và **alpha** so với chỉ số tham chiếu của thị trường đó, rồi viết 2–4 câu bài học. Portfolio Manager đọc các bài học này (cùng mã và các mã khác) ở những lần phân tích sau.",
        },
        {
          table: {
            head: ["Thị trường", "Chỉ số tham chiếu"],
            rows: [
              ["Mỹ (không đuôi), crypto, forex, hàng hoá", "SPY"],
              [".HK Hồng Kông", "^HSI (Hang Seng)"],
              [".T Tokyo", "^N225 (Nikkei 225)"],
              [".SS / .SZ Thượng Hải / Thâm Quyến", "000001.SS / 399001.SZ"],
              [".L London", "^FTSE"],
              [".NS / .BO Ấn Độ", "^NSEI / ^BSESN"],
              [".KS Hàn Quốc", "^KS11 (KOSPI)"],
              [".DE / .PA Đức / Pháp", "^GDAXI / ^FCHI"],
              [".TO Canada / .AX Úc", "^GSPTSE / ^AXJO"],
            ],
          },
        },
      ],
    },
    {
      id: "tips",
      nav: "Kết luận đáng tin hơn",
      title: "Để kết luận đáng tin hơn",
      blocks: [
        {
          md: `- Bật nhiều analyst. Chỉ dùng **Thị trường** thì kết luận chỉ dựa vào biểu đồ, thiếu tin tức, vĩ mô và tâm lý.
- Độ sâu **Trung bình** hoặc **Sâu** cho nhiều vòng tranh luận hơn, đổi lại chạy lâu và tốn token hơn.
- Dùng model mạnh cho tầng sâu (các manager). Model miễn phí chậm và kém ổn định hơn.
- So sánh nhiều lần chạy trong trang chủ thay vì tin một lần duy nhất.
- Có FRED_API_KEY để Analyst Tin tức có số liệu vĩ mô thật.`,
        },
      ],
    },
    {
      id: "history",
      nav: "Lịch sử và cài đặt",
      title: "Lịch sử, cài đặt và dữ liệu",
      blocks: [
        {
          md: `- Mọi lần chạy (xong, lỗi hoặc bị dừng) được lưu kèm toàn bộ cấu hình: danh mục, mã, analyst, nhà cung cấp, model nhanh và sâu, số vòng tranh luận, nguồn dữ liệu. Trang chủ lọc và phân trang các lần chạy; bấm một dòng để xem lại như lúc đang chạy.
- Trang [⚙ Cài đặt](/settings) để nhập API key và chọn model mặc định. Key không bao giờ hiện lại trên trang.
- Giao diện có tiếng Việt và tiếng Anh (nút VI / EN trên thanh đầu trang). Ngôn ngữ của report do ô “Ngôn ngữ báo cáo” quyết định riêng.
- Dữ liệu nằm trong \`~/.tradingagents/\` (trong Docker là volume được mount ra ngoài): \`web_history/\` là bản gốc từng lần chạy, \`history.db\` là chỉ mục để tìm nhanh (xoá đi sẽ tự dựng lại), \`logs/reports/\` là report Markdown/HTML, \`memory/\` là nhật ký quyết định.`,
        },
      ],
    },
    {
      id: "jobs",
      nav: "Lịch chạy",
      title: "Lịch chạy tự động và hàng đợi",
      blocks: [
        {
          md: `- Trang **⏰ Lịch chạy** tạo job: một danh sách mã, cấu hình phân tích (analyst, model, độ sâu, ngôn ngữ) và lịch: **một lần** vào ngày giờ cố định, **hằng ngày**, **các ngày trong tuần** đã chọn, hoặc **mỗi N giờ**. Ngày phân tích là ngày job chạy.
- Mỗi lúc chỉ chạy **một mã**. Đến giờ, các mã của job vào **hàng đợi** và chạy lần lượt; bấm “Phân tích mới” khi đang có lượt chạy cũng vào hàng đợi. Trên trang Lịch chạy có thể xem và bỏ mã khỏi hàng đợi.
- **Tự chạy lại mã lỗi:** mã chạy lỗi được xếp lại cuối hàng, tối đa số lần đã chọn cho job. Mã bị dừng bằng tay không tự chạy lại.
- **Chạy lại bằng tay:** mở một lần phân tích trong lịch sử, bấm “↻ Chạy lại với cấu hình này”.
- Lịch sử ghi **nguồn** của mỗi lần chạy (Thủ công hoặc tên job, kèm lần thử) và lọc được theo nguồn và trạng thái, để tìm mã lỗi.
- Lịch chỉ chạy khi server web đang bật, theo giờ của máy chạy server (Docker mặc định giờ Việt Nam). Lần nào trùng lúc server tắt thì bỏ qua, không chạy bù. Hàng chờ lưu trong DB (tab Hàng chờ): khởi động lại server thì các mã đang chờ vẫn còn, mã đang chạy dở được chạy lại từ đầu.`,
        },
      ],
    },
    {
      id: "faq",
      nav: "Câu hỏi thường gặp",
      title: "Câu hỏi thường gặp",
      blocks: [
        {
          md: `**Vì sao một lần phân tích chạy lâu?**
Mỗi agent là một lượt gọi model; model miễn phí thường “suy nghĩ” 1–2 phút trước khi viết. Một lần đầy đủ có thể mất 10–30 phút. Model trả phí nhanh hơn nhiều.

**Đóng hoặc tải lại trang thì sao?**
Phân tích vẫn chạy trên server; mở lại trang là thấy lại toàn bộ diễn biến. Chỉ nút Dừng mới dừng. Tắt server thì phân tích đang chạy bị mất.

**“Đang suy nghĩ… 45s” có phải bị treo?**
Không: model đang suy luận trước khi viết. Bộ đếm cho biết đã chờ bao lâu từ hoạt động gần nhất.

**Báo cáo ghi DATA_UNAVAILABLE hoặc NO_DATA_AVAILABLE?**
DATA_UNAVAILABLE: nguồn dữ liệu tạm không phục vụ được (giới hạn truy cập, mất mạng). NO_DATA_AVAILABLE: mã không có dữ liệu ở nguồn đó (sai mã, không được hỗ trợ). Agent được dặn báo là thiếu dữ liệu thay vì tự bịa số.

**Vì sao hai lần chạy cùng mã, cùng ngày lại khác nhau?**
Model ngôn ngữ có yếu tố ngẫu nhiên, và tin tức, mạng xã hội thay đổi theo thời gian. Hãy so sánh nhiều lần chạy.

**Lần chạy báo Lỗi?**
Xem dòng thông báo đỏ. Thường do thiếu API key, hết hạn mức, tên model sai, hoặc server model (Ollama) không kết nối được.

**Chọn ngày trong tương lai được không?**
Không. Ngày phân tích phải là hôm nay hoặc trước đó.

**“3/11” trên CLI nghĩa là gì?**
Bộ đếm tiến độ: số agent đã xong trên tổng số agent của lần chạy, không phải số agent được bật.`,
        },
      ],
    },
  ],
};

const en: Guide = {
  title: "Guide",
  home: "Home",
  disclaimer:
    "TradingAgents is a research tool, not investment advice. Results depend on the model, the data and the randomness of language models.",
  sections: [
    {
      id: "rating",
      nav: "Reading results",
      title: "Reading results: the 5-level rating",
      blocks: [
        { md: "Each analysis ends with the Portfolio Manager's rating, from most positive to most negative:" },
        {
          ratings: [
            ["Buy", "Strong conviction: open or add to a long position."],
            ["Overweight", "Favourable outlook: gradually increase exposure."],
            ["Hold", "Keep the position as it is; no action needed."],
            ["Underweight", "Leaning negative: reduce exposure, take partial profits, don't add. It does not mean sell everything."],
            ["Sell", "Exit the position or stay out."],
            ["REVIEW", "No rating could be read from the decision: read the “Final decision” tab yourself or run again."],
          ],
        },
        {
          md: "The reasons and concrete actions (entry zone, stop loss, sizing) are in the **Final decision** tab. The other tabs are each agent's report; read them to see how the conclusion was reached.",
        },
      ],
    },
    {
      id: "agents",
      nav: "12 agents",
      title: "The 12 agents and what each does",
      blocks: [
        {
          md: "The **quick** and **deep** models are the two model choices when you run an analysis; the “Model” column shows which one each agent uses. Pick the stronger model for the deep tier, since that is where decisions are made.",
        },
        {
          table: {
            head: ["Agent", "Model", "What it does", "Data it reads"],
            rows: [
              ["Market Analyst", "quick", "Technical analysis: picks up to 8 complementary indicators (SMA/EMA, MACD, RSI, Bollinger, ATR, VWMA), checks them against a verified price snapshot, writes a trend report.", "OHLCV prices, technical indicators"],
              ["Sentiment Analyst", "quick", "Reads news and social posts and scores market mood (Bearish to Bullish) with a score and confidence.", "Yahoo news, StockTwits, Reddit"],
              ["News Analyst", "quick", "Summarises the week's company and global macro news, backed by economic data and event probabilities.", "Company and global news, FRED, Polymarket"],
              ["Fundamentals Analyst", "quick", "Financial health: revenue, earnings, cash flow, balance sheet, valuation, insider trades. Stocks only.", "SEC EDGAR (US companies), Yahoo Finance"],
              ["Bull Researcher", "quick", "Argues for buying: growth, competitive edge, positive signals; rebuts the Bear.", "Analyst reports, debate history"],
              ["Bear Researcher", "quick", "Argues against: risks, weaknesses, negative signals; rebuts the Bull.", "Analyst reports, debate history"],
              ["Research Manager", "deep", "Judges the Bull/Bear debate, sides with the stronger case and writes the investment plan with a preliminary rating.", "The whole Bull/Bear debate"],
              ["Trader", "quick", "Turns the plan into a trade proposal: Buy / Hold / Sell, entry, stop loss, size.", "Research Manager's plan, analyst reports"],
              ["Risk: Aggressive", "quick", "Defends the upside and argues the proposal could go further.", "Trader's proposal, the other two risk views"],
              ["Risk: Conservative", "quick", "Puts capital preservation first, points out downside and suggests smaller size or more protection.", "Same"],
              ["Risk: Neutral", "quick", "Balances both sides and looks for a measured middle path.", "Same"],
              ["Portfolio Manager", "deep", "Weighs the risk debate, the plan, the Trader's proposal and lessons from past decisions, and sets the final rating.", "Everything before it, the past-decision log"],
            ],
          },
        },
        {
          md: "Besides the 12 agents, a **Memory log** step runs alongside the analysts: it scores past decisions whose holding period has passed and hands the lessons to the Portfolio Manager. For crypto, forex and commodities the Fundamentals Analyst does not run, leaving 11 agents.",
        },
      ],
    },
    {
      id: "steps",
      nav: "Steps",
      title: "The steps of an analysis",
      blocks: [
        {
          md: `1. **Analysts:** the selected analysts run in parallel, each with its own data tools. Meanwhile the Memory log scores past decisions.
2. **Bull/Bear debate:** Bull and Bear take turns, each speaking as many times as the depth; the Research Manager turns it into an investment plan.
3. **Trader:** turns the plan into a concrete trade proposal.
4. **Risk debate:** Aggressive → Conservative → Neutral, in turn, each speaking as many times as the depth.
5. **Final decision:** the Portfolio Manager sets the rating and the action.

The **Activity** column on the right follows these steps. A dashed card is text the model is writing right now; while the model is thinking, the card shows a seconds counter.`,
        },
      ],
    },
    {
      id: "scales",
      nav: "Other scales",
      title: "Other scales in the reports",
      blocks: [
        { md: "**Market sentiment** (Sentiment Analyst): 6 levels, a 0–10 score (5 is neutral) and a low / medium / high confidence depending on how much data was found." },
        {
          table: {
            head: ["Level", "Meaning"],
            rows: [
              ["Bullish", "Clearly positive, about 6.5–10"],
              ["Mildly Bullish", "Somewhat positive, about 5.5–6.4"],
              ["Neutral", "Sources are quiet or non-committal, about 4.5–5.5"],
              ["Mixed", "Sources point in different directions, about 4.5–5.5"],
              ["Mildly Bearish", "Somewhat negative, about 3.5–4.4"],
              ["Bearish", "Clearly negative, about 0–3.4"],
            ],
          },
        },
        {
          md: `**Trader's proposal:** only 3 actions, **Buy / Hold / Sell**, with entry, stop loss and size. Overweight / Underweight are decided only by the Portfolio Manager at the end.

**Research Manager's plan:** uses the same 5-level scale as the final result, but it is a preliminary view before the Trader and the risk debate.`,
        },
      ],
    },
    {
      id: "depth",
      nav: "Depth",
      title: "Research depth",
      blocks: [
        {
          table: {
            head: ["Depth", "Meaning"],
            rows: [
              ["Shallow (1)", "Bull and Bear speak once each; each risk view speaks once. Fastest, fewest tokens."],
              ["Medium (3)", "Three turns each: more back-and-forth rebuttal."],
              ["Deep (5)", "Five turns each: most thorough, slowest and most expensive (about 4–5× Shallow for the debates)."],
            ],
          },
        },
      ],
    },
    {
      id: "symbols",
      nav: "Categories & symbols",
      title: "Categories and symbols",
      blocks: [
        {
          md: `- **Stocks:** Yahoo Finance symbols, with the exchange suffix outside the US: \`0700.HK\`, \`7203.T\`, \`AZN.L\`, \`600519.SS\`, \`RELIANCE.NS\`.
- **Crypto:** \`BTCUSDT\`, \`ETHUSDT\` or the \`BTC-USD\` form.
- **Forex & commodities:** \`XAUUSD\`, \`XAGUSD\`, \`USOIL\`, \`EURUSD\`…
- Not in the list: choose “Other symbol…” and type it.
- Crypto, forex and commodities have no financial statements, so the Fundamentals Analyst is skipped automatically.

Broker-style symbols are converted to Yahoo symbols before data is fetched:`,
        },
        {
          table: {
            head: ["You type", "Yahoo symbol", "Note"],
            rows: [
              ["XAUUSD, XAU/USD, GOLD", "GC=F", "Gold: COMEX futures (Yahoo has no spot gold)"],
              ["XAGUSD", "SI=F", "COMEX silver"],
              ["USOIL, WTI", "CL=F", "WTI crude"],
              ["UKOIL, BRENT", "BZ=F", "Brent crude"],
              ["EURUSD, GBPUSD, USDJPY…", "EURUSD=X…", "Spot forex pairs"],
              ["BTCUSDT, BTCUSD", "BTC-USD", "Crypto (also ETH, SOL, XRP, ADA, DOGE, LTC, BCH, DOT, AVAX, LINK)"],
              ["SPX500, US500", "^GSPC", "S&P 500 index (also NAS100 → ^NDX, US30 → ^DJI, GER40 → ^GDAXI…)"],
              ["700.HK", "0700.HK", "Hong Kong codes are padded to 4 digits"],
              ["600519.SH", "600519.SS", "Yahoo writes the Shanghai exchange as .SS"],
            ],
          },
        },
      ],
    },
    {
      id: "terms",
      nav: "Terms",
      title: "Common terms in the reports",
      blocks: [
        {
          table: {
            head: ["Term", "Meaning"],
            rows: [
              ["SMA 50 / SMA 200", "50 / 200-session average price: medium / long-term trend. Price above the line is positive, below is negative."],
              ["EMA 10", "10-session average weighted to recent prices: reacts quickly to short-term moves."],
              ["Golden cross / Death cross", "SMA 50 crossing above / below SMA 200: long-term up / down trend signal."],
              ["MACD, Signal, Histogram", "Momentum. MACD crossing above Signal is positive; a shrinking Histogram means fading momentum."],
              ["RSI", "0–100 scale. Above 70 is overbought, below 30 oversold; in strong trends RSI can stay extreme for long."],
              ["Bollinger Bands", "Bands around the 20-session average ± 2 standard deviations. Touching the upper/lower band hints overbought/oversold; narrow bands mean low volatility."],
              ["ATR", "Average true range per session: used for stop losses and position size."],
              ["VWMA", "Volume-weighted average price: confirms a trend with money flow."],
              ["Support / Resistance", "Price zones where price tends to bounce / stall."],
              ["Stop loss", "The price at which to exit to limit a loss."],
              ["Short selling", "Selling first and buying back later, profiting when the price falls."],
              ["Alpha", "Return above the benchmark index over the same period."],
            ],
          },
        },
      ],
    },
    {
      id: "data",
      nav: "Data sources",
      title: "Data sources and keys",
      blocks: [
        {
          table: {
            head: ["Source", "Key", "Used for"],
            rows: [
              ["Yahoo Finance", "None", "Prices, indicators, news, company info; statements for non-US companies. The default source."],
              ["SEC EDGAR", "None (set a contact in SEC_EDGAR_USER_AGENT)", "US company statements exactly as filed at each date."],
              ["FRED", "FRED_API_KEY (free)", "Rates, inflation, jobs, GDP, bond yields. Without the key, macro data is reported as unavailable."],
              ["Polymarket", "None", "Prediction-market probabilities for events (Fed, recession, elections…)."],
              ["StockTwits, Reddit", "None", "Posts for the Sentiment Analyst."],
              ["TypeSafe Jev", "TYPESAFE_API_KEY (optional)", "Drops unrelated posts and tags stance before the Sentiment Analyst reads them."],
              ["Alpha Vantage", "ALPHA_VANTAGE_API_KEY (optional)", "Alternative source for prices, indicators, news and statements."],
            ],
          },
        },
        {
          md: "For an analysis dated in the past, prices and statements are read as they stood on that date (no look-ahead). Non-US statements and insider trades are withheld because their publication date is unknown. Social media is always current.",
        },
      ],
    },
    {
      id: "llm",
      nav: "LLM providers",
      title: "LLM providers",
      blocks: [
        {
          md: `- **With a key:** OpenAI, Anthropic (Claude), Google (Gemini), xAI (Grok), DeepSeek, Qwen, GLM, MiniMax, Mistral, Kimi, Groq, NVIDIA NIM, Azure OpenAI, Amazon Bedrock. Enter keys in [⚙ Settings](/settings).
- **OpenRouter:** one key for many models from many vendors, including free ones (the \`:free\` suffix: slow and rate-limited).
- **Ollama / OpenAI-compatible:** models on your machine or your own server; no key, but set the server address.
- **ChatGPT (Plus/Pro plan):** use your ChatGPT plan instead of an API key; sign in once with \`tradingagents login chatgpt\`.
- A model not in the list: choose “Other model ID…”.`,
        },
      ],
    },
    {
      id: "scoring",
      nav: "Scoring",
      title: "Scoring decisions and lessons",
      blocks: [
        {
          md: "Every decision goes into a log. After **5 trading sessions**, counted from the first close after the analysis date, the system computes the return and the **alpha** against that market's benchmark, then writes a 2–4 sentence lesson. The Portfolio Manager reads these lessons (same symbol and others) in later analyses.",
        },
        {
          table: {
            head: ["Market", "Benchmark"],
            rows: [
              ["US (no suffix), crypto, forex, commodities", "SPY"],
              [".HK Hong Kong", "^HSI (Hang Seng)"],
              [".T Tokyo", "^N225 (Nikkei 225)"],
              [".SS / .SZ Shanghai / Shenzhen", "000001.SS / 399001.SZ"],
              [".L London", "^FTSE"],
              [".NS / .BO India", "^NSEI / ^BSESN"],
              [".KS Korea", "^KS11 (KOSPI)"],
              [".DE / .PA Germany / France", "^GDAXI / ^FCHI"],
              [".TO Canada / .AX Australia", "^GSPTSE / ^AXJO"],
            ],
          },
        },
      ],
    },
    {
      id: "tips",
      nav: "More reliable results",
      title: "For more reliable conclusions",
      blocks: [
        {
          md: `- Turn on several analysts. With only **Market**, the conclusion rests on the chart alone, without news, macro or sentiment.
- **Medium** or **Deep** depth gives more debate rounds, at the cost of time and tokens.
- Use a strong model for the deep tier (the managers). Free models are slower and less consistent.
- Compare several runs on the home page rather than trusting a single one.
- Set FRED_API_KEY so the News Analyst has real macro data.`,
        },
      ],
    },
    {
      id: "history",
      nav: "History & settings",
      title: "History, settings and data",
      blocks: [
        {
          md: `- Every run (finished, failed or stopped) is saved with its full configuration: category, symbol, analysts, provider, quick and deep models, debate rounds, data sources. The home page filters and pages through runs; click a row to replay it as it ran.
- [⚙ Settings](/settings) holds API keys and default models. Keys are never shown again on the page.
- The interface is in Vietnamese and English (VI / EN in the top bar). The report language is chosen separately in “Report language”.
- Data lives in \`~/.tradingagents/\` (a mounted volume in Docker): \`web_history/\` holds each run as recorded, \`history.db\` is an index for fast search (rebuilt if deleted), \`logs/reports/\` holds Markdown/HTML reports, \`memory/\` the decision log.`,
        },
      ],
    },
    {
      id: "jobs",
      nav: "Schedules",
      title: "Scheduled runs and the queue",
      blocks: [
        {
          md: `- The **⏰ Schedules** page creates jobs: a list of symbols, analysis settings (analysts, models, depth, language) and a schedule: **once** at a set date and time, **daily**, on chosen **days of the week**, or **every N hours**. The analysis date is the day the job runs.
- Only **one symbol** runs at a time. When a job is due its symbols join the **queue** and run one after another; “New analysis” while something is running also joins the queue. The Schedules page shows the queue and lets you remove waiting symbols.
- **Retry failed symbols:** a symbol that fails goes back to the end of the queue, up to the number of times set on the job. A symbol stopped by hand is not retried.
- **Run again by hand:** open an analysis in the history and click “↻ Run again with these settings”.
- The history records each run's **source** (Manual, or the job name with the attempt) and filters by source and status, to find failed symbols.
- Schedules run only while the web server is up, in the server machine's time (Docker defaults to Vietnam time). A run that falls while the server is off is skipped, not made up. The queue is kept in the database (Queue tab): after a server restart waiting symbols are still there, and the one cut off runs again from the start.`,
        },
      ],
    },
    {
      id: "faq",
      nav: "FAQ",
      title: "Frequently asked questions",
      blocks: [
        {
          md: `**Why does an analysis take so long?**
Each agent is a model call; free models often “think” for 1–2 minutes before writing. A full run can take 10–30 minutes. Paid models are much faster.

**What if I close or reload the page?**
The analysis keeps running on the server; reopen the page to see everything again. Only the Stop button stops it. Shutting the server down loses a run in progress.

**Is “Thinking… 45s” stuck?**
No: the model is reasoning before it writes. The counter shows how long since the last activity.

**The report says DATA_UNAVAILABLE or NO_DATA_AVAILABLE?**
DATA_UNAVAILABLE: a data source could not serve the request right now (rate limit, network). NO_DATA_AVAILABLE: the symbol has no data at that source (wrong or unsupported symbol). Agents are told to report missing data rather than invent numbers.

**Why do two runs of the same symbol and date differ?**
Language models have randomness, and news and social media change over time. Compare several runs.

**A run shows Error?**
Read the red message. Usually a missing API key, an exhausted quota, a wrong model name, or an unreachable model server (Ollama).

**Can I pick a future date?**
No. The analysis date must be today or earlier.

**What does “3/11” mean in the CLI?**
A progress counter: agents finished out of the run's total, not the number of agents enabled.`,
        },
      ],
    },
  ],
};

export const GUIDES: Record<Lang, Guide> = { vi, en };
