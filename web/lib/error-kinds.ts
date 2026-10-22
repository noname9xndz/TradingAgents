/** What kind of failure an error message is, and what to do about it. Shared by the server
 * (it stores the kind) and the error log page (it shows the hint). */
export const ERROR_KINDS = {
  model: ["Model không dùng được", "Model sai tên hoặc đã bị gỡ (ví dụ bản :free hết hạn). Đổi model ở Cài đặt hoặc trong job."],
  auth: ["Sai hoặc thiếu API key", "Kiểm tra key ở Cài đặt → Model & API key, hoặc trong .env."],
  quota: ["Hết hạn mức / hết tiền", "Nạp thêm credit hoặc chờ hạn mức được làm mới."],
  rate: ["Bị giới hạn tốc độ", "Gọi quá nhiều trong thời gian ngắn. Lần sau thường tự hết; với job, bật tự chạy lại."],
  network: ["Lỗi mạng", "Không kết nối được tới nhà cung cấp. Kiểm tra mạng hoặc địa chỉ server."],
  data: ["Lỗi dữ liệu thị trường", "Không lấy được dữ liệu cho mã này. Kiểm tra lại mã hoặc thử lại sau."],
  process: ["Tiến trình dừng đột ngột", "Python thoát giữa chừng, thường do server khởi động lại hoặc thiếu bộ nhớ."],
  other: ["Lỗi khác", "Xem chi tiết bên dưới."],
} as const;

export type ErrorKind = keyof typeof ERROR_KINDS;

const RULES: [ErrorKind, RegExp][] = [
  ["model", /model ?not ?found|not a valid model|model_not_found|does not exist|has been retired|no endpoints found|unknown model|cannot be used with the chat/i],
  ["auth", /\b401\b|unauthori[sz]ed|invalid.{0,20}(api.?key|token)|authentication|api key not|missing.{0,20}api.?key/i],
  ["quota", /\b402\b|insufficient|quota|credits?|billing|payment required/i],
  ["rate", /\b429\b|rate.?limit|too many requests/i],
  ["network", /ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|timed? ?out|connection (error|refused|reset)|fetch failed|network/i],
  ["data", /no data|yfinance|ticker.{0,30}(not found|invalid)|delisted|price data/i],
  ["process", /Tiến trình phân tích đã dừng|Không chạy được Python|killed|SIGKILL/i],
];

export const errorKind = (message: string): ErrorKind => RULES.find(([, re]) => re.test(message))?.[0] ?? "other";
