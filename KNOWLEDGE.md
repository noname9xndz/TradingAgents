# TradingAgents — Knowledge Base

> Tài liệu nội bộ tóm tắt kiến trúc, luồng chạy, cấu hình và các quy ước của repo `TradingAgents` (v0.7.0, Tauric Research).
> Mục tiêu: đọc xong là hiểu repo chạy thế nào, sửa ở đâu, và các "luật ngầm" cần giữ.

---

## 1. Tổng quan

**TradingAgents** là framework giao dịch đa tác tử (multi-agent) dùng LLM, mô phỏng một công ty trading thật:
Analyst → Researcher (debate Bull/Bear) → Research Manager → Trader → Risk team (debate 3 phía) → Portfolio Manager.

- Paper: arXiv 2412.20138.
- Xây trên **LangGraph** (`StateGraph`) + **LangChain** chat models.
- Python ≥ 3.11. Package: `tradingagents` (thư viện) + `cli` (giao diện dòng lệnh, Typer + Rich + questionary).
- Mục đích **nghiên cứu**, không phải lời khuyên đầu tư.
- Output cuối: rating 5 bậc `Buy / Overweight / Hold / Underweight / Sell`, hoặc `REVIEW` khi không đọc được rating.

---

## 2. Cấu trúc thư mục

```
TradingAgents/
├── main.py                       # ví dụ chạy bằng Python
├── pyproject.toml                # deps, entry point `tradingagents = cli.main:app`, ruff, pytest
├── Dockerfile, docker-compose.yml
├── .env.example, .env.enterprise.example (Azure)
├── cli/                          # CLI (Typer)
│   ├── main.py                   # lệnh: analyze (mặc định), backtest, login, logout
│   ├── run.py                    # vòng chạy phân tích + live display + lưu report
│   ├── prompts.py                # các câu hỏi tương tác (ticker, date, provider, model, ...)
│   ├── selections.py             # gom lựa chọn (flags / env / prompt)
│   ├── prefs.py                  # nhớ lựa chọn lần trước (~/.tradingagents/cli_prefs.json)
│   ├── display.py                # giao diện Rich live
│   ├── stats_handler.py          # callback đếm LLM call / tool call / token
│   ├── updates.py                # check bản mới (1 lần/ngày, nền)
│   └── models.py                 # enum AnalystType, AssetType
├── tradingagents/
│   ├── default_config.py         # DEFAULT_CONFIG + map env TRADINGAGENTS_*
│   ├── graph/                    # dựng & chạy LangGraph
│   │   ├── trading_graph.py      # class TradingAgentsGraph (entry chính)
│   │   ├── setup.py              # GraphSetup: nối các node/edge
│   │   ├── analyst_execution.py  # spec cho từng analyst (node name, report key, tools)
│   │   ├── conditional_logic.py  # router cho 2 vòng debate
│   │   ├── propagation.py        # initial state + graph args (recursion limit)
│   │   └── checkpointer.py       # SQLite checkpoint per ticker
│   ├── agents/
│   │   ├── analysts/             # market, sentiment, news, fundamentals, turn.py
│   │   ├── researchers/          # bull, bear
│   │   ├── managers/             # research_manager, portfolio_manager
│   │   ├── trader/               # trader
│   │   ├── risk_mgmt/            # aggressive, conservative, neutral
│   │   ├── state.py              # AgentState, InvestDebateState, RiskDebateState
│   │   ├── schemas.py            # Pydantic: ResearchPlan, TraderProposal, PortfolioDecision, SentimentReport
│   │   ├── structured.py         # helper structured-output + fallback free-text
│   │   ├── rating.py             # parse rating 5 bậc / REVIEW
│   │   ├── context.py            # instrument identity, language instruction, portfolio context
│   │   ├── tools.py              # @tool LangChain cho analyst
│   │   └── post_screen.py        # lọc post social bằng TypeSafe Jev (tuỳ chọn)
│   ├── dataflows/                # TẦNG DỮ LIỆU (chỉ nơi này được import yfinance)
│   │   ├── router.py             # route_to_vendor: chọn vendor + fallback
│   │   ├── config.py             # config toàn cục + ContextVar per-run
│   │   ├── date_window.py        # luật point-in-time (as_of, in_window, withhold_*)
│   │   ├── symbols.py            # chuẩn hoá ticker (XAUUSD→GC=F, BTCUSD→BTC-USD, ...)
│   │   ├── errors.py             # NoMarketDataError, VendorUnavailableError, VendorNotConfiguredError
│   │   ├── files.py              # file lock, ghi file atomic
│   │   ├── net.py                # HTTP có scrub secret
│   │   └── vendors/              # yahoo/, alpha_vantage/, sec_edgar, fred, polymarket, reddit, stocktwits
│   ├── llm_clients/              # factory + client cho từng provider
│   ├── memory/                   # log.py, settlement.py, reflection.py
│   ├── backtest.py               # run_backtest / summarize / iter_grid
│   ├── portfolio.py              # PortfolioContext (holdings + cash)
│   ├── reporting.py              # ghi cây report markdown
│   └── report_html.py            # complete_report.html
└── tests/                        # ~90 file pytest (unit; integration chỉ chạy khi -m integration)
```

---

## 3. Luồng chạy (Graph)

### 3.1 Sơ đồ

```
            ┌─────────────── START ───────────────┐
            │        (chạy song song)             │
   Market   Sentiment   News   Fundamentals   Memory Log
   Analyst  Analyst     Analyst Analyst       (settle quyết định cũ)
            └──────────────┬──────────────────────┘
                           ▼   (đợi tất cả xong)
               Bull Researcher ⇄ Bear Researcher      (max_debate_rounds × 2 lượt)
                           ▼
                   Research Manager  (deep LLM, structured ResearchPlan)
                           ▼
                        Trader       (quick LLM, structured TraderProposal)
                           ▼
       Aggressive → Conservative → Neutral → Aggressive ...   (max_risk_discuss_rounds × 3 lượt)
                           ▼
                  Portfolio Manager  (deep LLM, structured PortfolioDecision)
                           ▼
                          END
```

### 3.2 Chi tiết ([tradingagents/graph/setup.py](tradingagents/graph/setup.py))

- **Mỗi analyst là một subgraph riêng** (`_analyst_graph`): `agent → tools → agent ...` với message history riêng, chỉ trả về đúng `report_key` (vd `market_report`). Nhờ vậy các analyst chạy song song không ghi đè key của nhau.
- **Giới hạn tool round**: sau `max_tool_rounds` (mặc định 20) vòng gọi tool, node `wrap_up` gửi `WRAP_UP` buộc analyst viết report (không bind tool nữa, lịch sử tool call được chuyển thành text — xem [turn.py](tradingagents/agents/analysts/turn.py)).
- Ràng buộc: `2 * max_tool_rounds + 2 < max_recur_limit` (mặc định 100), nếu không `TradingAgentsGraph.__init__` raise `ValueError`.
- **Sentiment Analyst không có tool**: nó tự fetch tin Yahoo + StockTwits + Reddit trước, nhét vào prompt, rồi gọi model (structured `SentimentReport`).
- **Memory Log node** chạy song song với analyst: settle các quyết định cũ đã hết holding period, rồi trả `past_context` (chỉ Portfolio Manager đọc). Lỗi ở đây không làm hỏng run, chỉ ghi `memory_note` vào report.
- **Router debate** ([conditional_logic.py](tradingagents/graph/conditional_logic.py)):
  - Research: `count >= 2*max_debate_rounds` → Research Manager; nếu `current_response` bắt đầu bằng "Bull" → Bear, ngược lại → Bull.
  - Risk: `count >= 3*max_risk_discuss_rounds` → Portfolio Manager; xoay vòng Aggressive → Conservative → Neutral theo `latest_speaker`.
  - `DEBATE_PATH_MAP` / `RISK_ANALYSIS_PATH_MAP` luôn map **đầy đủ mọi target** để không crash khi label lệch (#1088).

### 3.3 Hai tầng LLM

| Tier | Config | Dùng cho |
|---|---|---|
| quick | `quick_think_llm` (mặc định `gpt-6-luna`) | 4 analyst, Bull/Bear, Trader, 3 risk debator, Reflector |
| deep | `deep_think_llm` (mặc định `gpt-6-sol`) | Research Manager, Portfolio Manager |

Mỗi tier có thể dùng provider riêng: `quick_think_provider`, `deep_think_provider`, `*_backend_url` (#1440). Logic ở `create_tier_client` trong [factory.py](tradingagents/llm_clients/factory.py).

---

## 4. State ([tradingagents/agents/state.py](tradingagents/agents/state.py))

`AgentState(MessagesState)` gồm:

| Key | Ý nghĩa |
|---|---|
| `company_of_interest`, `asset_type` (`stock`/`crypto`), `trade_date` | input run |
| `instrument_context` | danh tính công ty resolve deterministic từ ticker lúc bắt đầu (#814) — chống LLM "bịa" công ty |
| `market_report`, `sentiment_report`, `news_report`, `fundamentals_report` | report của analyst |
| `investment_debate_state` | `bull_history`, `bear_history`, `history`, `current_response`, `count` |
| `investment_plan` | output Research Manager |
| `trader_investment_plan` | output Trader |
| `risk_debate_state` | history của 3 debator, `latest_speaker`, `current_*_response`, `count` |
| `final_trade_decision`, `final_rating` | output Portfolio Manager |
| `past_context`, `memory_note` | từ Memory Log node |
| `portfolio_context` | holdings người dùng (rỗng nếu không truyền) |

---

## 5. Các Agent

| Agent | File | LLM | Input chính | Output |
|---|---|---|---|---|
| Market Analyst | `analysts/market_analyst.py` | quick | tools: `get_stock_data`, `get_indicators`, `get_verified_market_snapshot` | `market_report` (chọn ≤8 indicator, bắt buộc dùng snapshot làm "source of truth" cho con số) |
| Sentiment Analyst | `analysts/sentiment_analyst.py` | quick | tin Yahoo + StockTwits + Reddit (fetch sẵn), lọc Jev nếu có `TYPESAFE_API_KEY` | `sentiment_report` (`SentimentReport`: band 6 bậc, score, confidence) |
| News Analyst | `analysts/news_analyst.py` | quick | `get_news`, `get_global_news`, `get_macro_indicators` (FRED), `get_prediction_markets` (Polymarket) | `news_report` |
| Fundamentals Analyst | `analysts/fundamentals_analyst.py` | quick | `get_fundamentals`, `get_balance_sheet`, `get_cashflow`, `get_income_statement`, `get_insider_transactions` | `fundamentals_report` |
| Bull / Bear Researcher | `researchers/*.py` | quick | 4 report + lịch sử debate + lập luận đối thủ | cập nhật `investment_debate_state` (prefix "Bull Analyst:" / "Bear Analyst:") |
| Research Manager | `managers/research_manager.py` | deep | debate history | `investment_plan` (`ResearchPlan`: recommendation 5 bậc, rationale, strategic_actions) |
| Trader | `trader/trader.py` | quick | investment plan + portfolio | `trader_investment_plan` (`TraderProposal`: Buy/Hold/Sell, entry, stop_loss, sizing) |
| Aggressive / Conservative / Neutral | `risk_mgmt/*.py` | quick | trader plan + report + đối thủ | cập nhật `risk_debate_state` |
| Portfolio Manager | `managers/portfolio_manager.py` | deep | risk debate + plan + trader + `past_context` + portfolio | `final_trade_decision` + `final_rating` (`PortfolioDecision`) |

### Structured output ([structured.py](tradingagents/agents/structured.py))
- `bind_structured(llm, Schema)` → `llm.with_structured_output(Schema)`; nếu provider không hỗ trợ → `None` → dùng free-text.
- `invoke_structured_or_freetext`: gọi structured, lỗi/None → gọi lại 1 lần bằng free-text. **Pipeline không bao giờ bị chặn vì JSON hỏng.**
- `NO_EXTERNAL_TOOLS`: câu dặn model không gọi tool ngoài (tránh structured call bị huỷ, #1130).

### Rating ([rating.py](tradingagents/agents/rating.py))
- Thang chuẩn `RATINGS_5_TIER`. Parser regex đọc dòng `Rating: X` (chịu được markdown bold, dấu fullwidth sau NFKC).
- Không tìm thấy → `REVIEW` (KHÔNG mặc định Hold, #1170). Kiểm tra bằng `is_review()` trước khi map sang enum.

---

## 6. Tầng dữ liệu (dataflows)

### 6.1 Router ([router.py](tradingagents/dataflows/router.py))
- `TOOLS_CATEGORIES`: nhóm tool → category (`core_stock_apis`, `technical_indicators`, `fundamental_data`, `news_data`, `macro_data`, `prediction_markets`).
- `VENDOR_METHODS`: method → {vendor → hàm}.
- Chọn vendor: `tool_vendors[method]` > `data_vendors[category]` > `"default"` (tất cả vendor).
- **Chuỗi vendor cấu hình = chuỗi fallback chính xác**; KHÔNG âm thầm fallback sang vendor người dùng không chọn (#988). Muốn fallback: `"yfinance,alpha_vantage"`.
- Xử lý lỗi:
  - `VendorUnavailableError` (throttle/mất mạng) → thử vendor sau; hết thì trả sentinel `DATA_UNAVAILABLE: ...`.
  - `NoMarketDataError` → thử vendor sau; hết thì trả `NO_DATA_AVAILABLE: ...` kèm lý do.
  - Lỗi khác → log warning, thử tiếp; category optional (`macro_data`, `prediction_markets`) trả sentinel, category core thì raise.
  - Sentinel luôn dặn agent "**không ước lượng/bịa số**".

### 6.2 Vendor mặc định

| Category | Mặc định | Lựa chọn |
|---|---|---|
| core_stock_apis | yfinance | alpha_vantage |
| technical_indicators | yfinance (stockstats) | alpha_vantage |
| fundamental_data | `sec_edgar,yfinance` | alpha_vantage |
| news_data | yfinance | alpha_vantage |
| macro_data | fred (cần `FRED_API_KEY`) | — |
| prediction_markets | polymarket (không cần key) | — |

Sentiment: StockTwits, Reddit (r/wallstreetbets, r/stocks, r/investing hoặc sub crypto), Yahoo news.

### 6.3 Point-in-time / chống look-ahead ([date_window.py](tradingagents/dataflows/date_window.py))
Đây là nguyên tắc cốt lõi của repo — **mọi dữ liệu phải phục vụ "as of" `trade_date`**:
- Tool lấy `trade_date` từ state qua `InjectedState`, và `as_of` / `as_of_window` **kẹp** ngày model yêu cầu về ≤ trade_date.
- `in_window`: lọc item theo cửa sổ `[start, end+1 ngày)` UTC; item không có ngày chỉ giữ khi cửa sổ chạm hiện tại.
- `withhold_live_profile`, `withhold_undisclosed_trades`, `withhold_undated_statements`: run lịch sử không được xem snapshot hiện tại / insider trades / báo cáo Yahoo (vì Yahoo không biết ngày công bố).
- **SEC EDGAR** phục vụ số liệu "as filed": run ngày quá khứ đọc đúng con số đã nộp lúc đó (vd tổng tài sản Apple 2008: $39.6B trước khi restate thành $36.2B năm 2010). Cần `SEC_EDGAR_USER_AGENT`.
- Lưu ý: feed social/news (StockTwits, Reddit) không lưu trữ lịch sử → sentiment của run lịch sử **không** point-in-time.

### 6.4 Symbols ([symbols.py](tradingagents/dataflows/symbols.py))
`normalize_symbol`: `XAUUSD→GC=F`, `EURUSD→EURUSD=X`, `BTCUSD→BTC-USD`, `SPX500→^GSPC`, `700.HK→0700.HK`, `600519.SH→600519.SS`... Thêm instrument = thêm 1 dòng `_ALIASES`.
`safe_ticker_component`: chống path traversal khi dùng ticker làm tên thư mục.

### 6.5 Config per-run ([dataflows/config.py](tradingagents/dataflows/config.py))
Config toàn cục (`set_config`, merge 1 cấp cho dict) + `ContextVar` `_run_config` để nhiều graph trong cùng process không lẫn vendor của nhau.

---

## 7. LLM clients ([tradingagents/llm_clients/](tradingagents/llm_clients/))

- `create_llm_client(provider, model, base_url, **kwargs)` — import lazy.
  - Native: `anthropic`, `google`, `azure`, `bedrock` (cần extra `.[bedrock]`).
  - Còn lại qua registry `OPENAI_COMPATIBLE_PROVIDERS` trong [openai_client.py](tradingagents/llm_clients/openai_client.py): `openai` (Responses API), `xai`, `deepseek`, `qwen`/`qwen-cn`, `glm`/`glm-cn`, `minimax`/`minimax-cn`, `openrouter`, `mistral`, `kimi`, `groq`, `nvidia`, `ollama` (`OLLAMA_BASE_URL`), `chatgpt` (gói Plus/Pro qua OAuth), `openai_compatible` (vLLM, LM Studio, llama.cpp...).
- `build_llm_kwargs`: map `google_thinking_level`, `openai_reasoning_effort` (openai/chatgpt), `anthropic_effort`, và các tham số chung `temperature`, `llm_max_retries`, `max_tokens` (Gemini đổi thành `max_output_tokens`).
- `capabilities.py`: model nào hỗ trợ tool_choice / json_schema / phương thức structured nào; DeepSeek thinking cần round-trip `reasoning_content`; MiniMax cần `reasoning_split`.
- `model_catalog.py`: danh sách model gợi ý cho CLI (CLI vẫn cho nhập "Custom model ID").
- `api_key_env.py`: provider → tên env var của API key.
- `chatgpt_auth.py`: OAuth PKCE với auth.openai.com, lưu token ở `~/.tradingagents/chatgpt-auth.json`, tự refresh. Lệnh `tradingagents login chatgpt` / `logout chatgpt`. Gói ChatGPT không nhận `temperature`/`max_tokens`.

---

## 8. Memory & Reflection ([tradingagents/memory/](tradingagents/memory/))

- **Memory log** (luôn bật): `~/.tradingagents/memory/trading_memory.md` (override `TRADINGAGENTS_MEMORY_LOG_PATH`).
  - Format mỗi entry: `[YYYY-MM-DD | TICKER | Rating | pending]` + `DECISION:` (+ `REFLECTION:` khi đã settle), phân tách bằng `<!-- ENTRY_END -->`.
  - Idempotent: 1 ticker + 1 ngày chỉ có 1 entry.
  - File lock (`dataflows/files.py`) cho cả ghi và settle (an toàn đa tiến trình).
  - `memory_log_max_entries`: giới hạn số entry đã settle (pending không bao giờ bị xoá).
- **Settlement** ([settlement.py](tradingagents/memory/settlement.py)): khi đã qua `holding_period_days` (mặc định 5) phiên tính từ **close đầu tiên sau trade_date** (#1518), tính return thô và alpha so với benchmark theo hậu tố sàn (`benchmark_map`: `.T→^N225`, `.HK→^HSI`, US→SPY, ...).
- **Reflector** ([reflection.py](tradingagents/memory/reflection.py)): quick LLM viết 2–4 câu bài học, lưu nguyên văn.
- **Past context**: Portfolio Manager đọc các quyết định gần nhất của cùng ticker + bài học từ ticker khác. Run lịch sử chỉ thấy bài học đã settle trước trade_date (#1251).
- API: `ta.settle_pending(ticker)`, `ta.settle_all_pending()` (dùng cho cron).

---

## 9. Checkpoint resume ([checkpointer.py](tradingagents/graph/checkpointer.py))

- Opt-in: `--checkpoint` hoặc `checkpoint_enabled=True`.
- SQLite per ticker: `~/.tradingagents/cache/checkpoints/<TICKER>.db`.
- `thread_id` = ticker + date + **run signature** (analyst, debate/risk rounds, asset type, fingerprint portfolio, hash toàn bộ config trừ path/retry). Đổi bất kỳ cái gì → bắt đầu mới (#1089).
- Resume: invoke với `None` thay vì initial state (tránh nhân đôi messages, #1249).
- Xoá checkpoint tự động khi run thành công; `--clear-checkpoints` xoá hết.

---

## 10. Backtest ([backtest.py](tradingagents/backtest.py))

```python
from tradingagents.backtest import iter_grid, run_backtest, summarize
dates = iter_grid("2026-06-01", "2026-08-01", every_n_days=7)
result = run_backtest(["NVDA", "AAPL"], dates, config, selected_analysts=["market", "news"])
print(summarize(result).render())
```
CLI: `tradingagents backtest NVDA,AAPL --start 2026-06-01 --end 2026-08-01 --every 7 [--run-id ...]`

- Chạy pipeline trên lưới ticker × ngày, **memory log riêng** (không đụng log của bạn).
- Chấm điểm theo alpha so với benchmark khu vực, nhóm theo rating.
- `run_id` để tiếp tục sweep bị gián đoạn (bỏ qua cell đã chạy).

---

## 11. Portfolio ([portfolio.py](tradingagents/portfolio.py))

```python
from tradingagents.portfolio import PortfolioContext
portfolio = PortfolioContext.model_validate({
    "cash": 25000.0, "currency": "USD",
    "positions": [{"ticker": "NVDA", "quantity": 120, "average_price": 150.0}],
})
ta.propagate("NVDA", "2026-09-01", portfolio=portfolio)
```
- Trader, risk debator và PM sẽ sizing theo book thật. CLI: `--portfolio my_book.json`.
- `positions: []` = book phẳng; **không truyền** ≠ book phẳng.

---

## 12. Báo cáo đầu ra

- `ta.save_reports(state, ticker, save_path=None, html=True)` → `results_dir/reports/<TICKER>_<timestamp>/`:
  ```
  1_analysts/{market,sentiment,news,fundamentals}.md
  2_research/{bull,bear,manager}.md
  3_trading/trader.md
  4_risk/{aggressive,conservative,neutral}.md
  5_portfolio/decision.md
  complete_report.md
  complete_report.html       # 1 trang, có mục lục bên cạnh
  ```
- State log JSON: `results_dir/<TICKER>/TradingAgentsStrategy_logs/full_states_log_<date>.json`.
- `run_settings()` ghi phiên bản, provider/model mỗi tier, analyst, rounds, ngôn ngữ, vendor — **không** ghi key, endpoint, path.
- `output_language`: report & quyết định cuối theo ngôn ngữ chọn; debate nội bộ vẫn tiếng Anh.

---

## 13. Cấu hình ([default_config.py](tradingagents/default_config.py))

### Key quan trọng

| Key | Mặc định | Ghi chú |
|---|---|---|
| `results_dir` | `~/.tradingagents/logs` | env `TRADINGAGENTS_RESULTS_DIR` |
| `data_cache_dir` | `~/.tradingagents/cache` | env `TRADINGAGENTS_CACHE_DIR` |
| `memory_log_path` | `~/.tradingagents/memory/trading_memory.md` | |
| `llm_provider` | `openai` | |
| `deep_think_llm` / `quick_think_llm` | `gpt-6-sol` / `gpt-6-luna` | |
| `backend_url` | `None` | None = endpoint mặc định của provider |
| `temperature`, `llm_max_retries`, `max_tokens` | `None` | |
| `max_debate_rounds` / `max_risk_discuss_rounds` | 1 / 1 | |
| `max_recur_limit` / `max_tool_rounds` | 100 / 20 | |
| `news_article_limit`, `global_news_article_limit`, `global_news_lookback_days` | 20, 10, 7 | |
| `global_news_queries` | 5 query macro | |
| `holding_period_days` | 5 | |
| `benchmark_ticker` / `benchmark_map` | None / theo hậu tố | |
| `checkpoint_enabled` | False | |

### Env override (`_ENV_OVERRIDES`)
`TRADINGAGENTS_LLM_PROVIDER`, `_DEEP_THINK_LLM`, `_QUICK_THINK_LLM`, `_DEEP/QUICK_THINK_PROVIDER`, `_DEEP/QUICK_THINK_BACKEND_URL`, `_LLM_BACKEND_URL`, `_OUTPUT_LANGUAGE`, `_MAX_DEBATE_ROUNDS`, `_MAX_RISK_ROUNDS`, `_MAX_TOOL_ROUNDS`, `_CHECKPOINT_ENABLED`, `_BENCHMARK_TICKER`, `_TEMPERATURE`, `_LLM_MAX_RETRIES`, `_MAX_TOKENS`, `_GOOGLE_THINKING_LEVEL`, `_OPENAI_REASONING_EFFORT`, `_ANTHROPIC_EFFORT`.
- Kiểu được ép theo kiểu của giá trị mặc định; giá trị sai (vd `treu`) → **raise lỗi**, không im lặng.
- Thêm key mới có thể override: chỉ cần thêm 1 dòng vào `_ENV_OVERRIDES`.

### API key
`OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY`(+`_CN`), `ZHIPU_API_KEY`(+`_CN`), `MINIMAX_API_KEY`(+`_CN`), `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `MOONSHOT_API_KEY`, `GROQ_API_KEY`, `NVIDIA_API_KEY`, `FRED_API_KEY`, `ALPHA_VANTAGE_API_KEY`, `TYPESAFE_API_KEY`, `OPENAI_COMPATIBLE_API_KEY`, `SEC_EDGAR_USER_AGENT`. Khác: `OLLAMA_BASE_URL`, `TRADINGAGENTS_NO_UPDATE_CHECK=1`, `TYPESAFE_DEFAULT_MODEL`, `TYPESAFE_BASE_URL`.

---

## 14. Cách sử dụng

### Cài đặt
```bash
pip install .            # hoặc: uv pip install .
pip install ".[dev]"     # + ruff, pytest
pip install ".[bedrock]" # AWS Bedrock
cp .env.example .env
```

### CLI
```bash
tradingagents                      # tương tác (nhớ lựa chọn lần trước)
python -m cli.main                 # chạy từ source
tradingagents --ticker NVDA --date 2026-09-23 --analysts market,news,fundamentals --save --no-show
tradingagents --checkpoint | --clear-checkpoints | --portfolio book.json | --no-html
tradingagents backtest NVDA,AAPL --start ... --end ... --every 7
tradingagents login chatgpt / logout chatgpt
```
Không có terminal mà thiếu câu trả lời → dừng trước khi chạy và nói rõ flag/env cần đặt.

### Python
```python
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

config = DEFAULT_CONFIG.copy()
config["llm_provider"] = "openai"
config["deep_think_provider"] = "anthropic"
config["deep_think_llm"] = "claude-opus-5-5"
ta = TradingAgentsGraph(selected_analysts=("market", "social", "news", "fundamentals"),
                        debug=True, config=config)
state, decision = ta.propagate("NVDA", "2026-09-01", asset_type="stock")
ta.save_reports(state, "NVDA")
```
- `trade_date` phải đúng `YYYY-MM-DD` và **không ở tương lai**.
- Analyst key: `market`, `social` (= Sentiment), `news`, `fundamentals`.
- Crypto: `asset_type="crypto"` (CLI tự nhận theo hậu tố `-USD`, `-USDT`, ...).

### Docker
```bash
docker compose run --rm tradingagents
docker compose --profile ollama run --rm tradingagents-ollama
```
Dữ liệu ở volume `tradingagents_data` hoặc `TRADINGAGENTS_DATA_DIR`.

### Thị trường hỗ trợ
Mọi sàn Yahoo Finance có: US (`AAPL`), HK (`0700.HK`), Tokyo (`7203.T`), London (`AZN.L`), India (`.NS`, `.BO`), Canada (`.TO`), Úc (`.AX`), A-share (`.SS`, `.SZ`), crypto (`BTC-USD`).

---

## 15. Luồng trong `propagate()` ([trading_graph.py](tradingagents/graph/trading_graph.py))

1. `_validate_trade_date`.
2. `run_config(self.config)` (ContextVar) + `checkpoint_scope` (nếu bật, recompile graph với SqliteSaver).
3. `create_run_state`: resolve instrument identity (yfinance, cache, fail-open), render portfolio.
4. `graph.invoke(...)` (hoặc `stream_run` khi `debug=True`, in message không trùng lặp).
5. `record_decision`: ghi JSON state log + thêm entry `pending` vào memory log.
6. `clear_checkpoint_on_success`.
7. Trả `(final_state, run_rating(final_state))`.

CLI dùng cùng các bước nhưng qua `stream_run` để hiển thị live.

---

## 16. Test, lint, CI

- `pytest` (mặc định bỏ `integration`; chạy `pytest -m integration` khi cần dịch vụ thật). Markers: `unit`, `integration`, `smoke`.
- `ruff check .` (rules E, W, F, I, B, UP, C4, SIM; line-length 100; bỏ E501).
- CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)): Python 3.11–3.14 + 1 job ở `TZ=America/New_York` (bắt test chỉ pass ở UTC), smoke clean-install (`import tradingagents, cli.main`), ruff full repo.
- Test kiến trúc đáng chú ý:
  - [test_layering.py](tests/test_layering.py): **chỉ `tradingagents/dataflows/` được import `yfinance`**.
  - `test_*_lookahead.py`, `test_memory_pointintime.py`, `test_statement_knowledge_time.py`, `test_tool_date_enforcement.py`: chống rò dữ liệu tương lai.
  - `test_risk_router_path_map.py`: path map đầy đủ.
  - `test_rating_integrity.py`: REVIEW thay vì Hold.
  - `test_i18n_coverage.py`, `test_prompt_integrity.py`: prompt & ngôn ngữ.

---

## 17. Quy ước / "luật ngầm" khi sửa code

1. **Point-in-time là bất khả xâm phạm**: tool mới có ngày phải nhận `trade_date: Annotated[str, InjectedState("trade_date")]` và đi qua `as_of`/`as_of_window`.
2. **Gọi vendor chỉ trong `dataflows/`**; lỗi vendor phải raise `VendorError` subclass để router xử lý, không để LLM hiểu nhầm outage là thông tin thị trường.
3. **Không để exception thoát ra khỏi tool** (sẽ kết thúc run) — trả sentinel `DATA_UNAVAILABLE`/`NO_DATA_AVAILABLE`.
4. **Không bịa số**: mọi sentinel dặn agent báo "unavailable".
5. **Thêm vendor**: viết hàm trong `dataflows/vendors/`, đăng ký vào `VENDOR_METHODS` (và `TOOLS_CATEGORIES` nếu method mới), cấu hình qua `data_vendors`/`tool_vendors`.
6. **Thêm provider OpenAI-compatible**: thêm 1 dòng `ProviderSpec` vào `OPENAI_COMPATIBLE_PROVIDERS` + env key trong `api_key_env.py` + model trong `model_catalog.py`.
7. **Thêm analyst**: tạo node trong `agents/analysts/`, thêm `AnalystNodeSpec` trong `analyst_execution.py`, factory trong `setup.py`, key report trong `AgentState`, section trong `reporting.py`, enum trong `cli/models.py`.
8. **Agent quyết định dùng structured output + fallback free-text** (`structured.py`).
9. **Rating không đọc được = REVIEW**, không phải Hold.
10. Ghi file người dùng đọc: `encoding="utf-8"`, `ensure_ascii=False` (fix Windows UTF-8).
11. Comment trong code thường dẫn số issue `(#1234)` — giữ thói quen này khi fix bug.

---

## 18. Lịch sử phiên bản (tóm tắt)

| Version | Điểm chính |
|---|---|
| 0.7.0 (2026-10) | Chạy bằng gói ChatGPT Plus/Pro, backtest tính từ close đầu tiên sau ngày quyết định, thông báo bản mới, wheel trên release |
| 0.6.0 | Report HTML 1 trang, provider riêng mỗi tier, settle mọi ticker song song với analyst, Yahoo search news |
| 0.5.2 | Analyst song song, CLI headless qua flags, run settings trong report |
| 0.5.1 | Tổ chức lại package, Jev screening, GPT-6 Sol/Luna mặc định |
| 0.5.0 | Point-in-time toàn bộ, SEC EDGAR as-filed, backtest grid, portfolio-aware |
| 0.4.0 | Fix look-ahead FRED/social/memory, checkpoint resume CLI, trader price grounding |
| 0.3.x | Data-access contract, registry provider mở rộng, FRED, Polymarket, CI |
| 0.2.x | Structured-output agents, checkpoint, decision log, đa provider, Docker, đa ngôn ngữ |

Chi tiết: [CHANGELOG.md](CHANGELOG.md).

---

## 19. Đường dẫn trên máy người dùng

| Đường dẫn | Nội dung |
|---|---|
| `~/.tradingagents/logs/` | results_dir (report, state log) |
| `~/.tradingagents/cache/` | cache dữ liệu, `checkpoints/<TICKER>.db` |
| `~/.tradingagents/memory/trading_memory.md` | memory log |
| `~/.tradingagents/cli_prefs.json` | lựa chọn CLI lần trước |
| `~/.tradingagents/chatgpt-auth.json` | token ChatGPT plan |
