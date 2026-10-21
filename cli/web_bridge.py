"""The web UI's way into the pipeline: one JSON line per event on stdout.

    python -m cli.web_bridge options        the choices the form offers
    python -m cli.web_bridge run < job.json run one analysis, streaming its progress

Anything else the libraries print goes to stderr, so stdout stays one JSON
object per line for the web server to forward.
"""

import json
import os
import sys
import threading
import traceback

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import AIMessageChunk
from langchain_core.outputs import LLMResult

from cli.display import ANALYST_ORDER
from cli.prompts import _llm_provider_table
from tradingagents.agents.rating import run_rating
from tradingagents.dataflows.symbols import crypto_base, normalize_symbol
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.llm_clients.api_key_env import get_api_key_env
from tradingagents.llm_clients.model_catalog import MODEL_OPTIONS
from tradingagents.llm_clients.openai_client import OPENAI_COMPATIBLE_PROVIDERS, SIGNED_IN_PROVIDERS

LANGUAGES = ["Vietnamese", "English", "Chinese", "Japanese", "Korean", "Hindi", "Spanish",
             "Portuguese", "French", "German", "Arabic", "Russian"]

# Region endpoints the CLI asks for in a second question; the form lists them outright.
REGIONS = [("Qwen (China)", "qwen-cn"), ("GLM (China, BigModel)", "glm-cn"), ("MiniMax (China)", "minimax-cn")]

# Where each section the page shows lives in the graph state.
SECTIONS = {
    "market_report": ("market_report",),
    "sentiment_report": ("sentiment_report",),
    "news_report": ("news_report",),
    "fundamentals_report": ("fundamentals_report",),
    "bull_history": ("investment_debate_state", "bull_history"),
    "bear_history": ("investment_debate_state", "bear_history"),
    "investment_plan": ("investment_plan",),
    "trader_investment_plan": ("trader_investment_plan",),
    "aggressive_history": ("risk_debate_state", "aggressive_history"),
    "conservative_history": ("risk_debate_state", "conservative_history"),
    "neutral_history": ("risk_debate_state", "neutral_history"),
    "final_trade_decision": ("final_trade_decision",),
}

_out = sys.stdout
# Model callbacks emit from worker threads; one line at a time.
_emit_lock = threading.Lock()


def emit(event: dict) -> None:
    line = json.dumps(event, ensure_ascii=False, default=str) + "\n"
    with _emit_lock:
        _out.write(line)
        _out.flush()


class UsageTracker(BaseCallbackHandler):
    """Tokens each model used in a run, totalled per model and overall.

    The model is taken when a call starts: a streamed reply's metadata repeats
    its model name once per chunk. After every call the running totals are
    emitted, so a run that is stopped or fails still has what it used.
    """

    def __init__(self, on_update=None) -> None:
        super().__init__()
        self._lock = threading.Lock()
        self._model_of: dict = {}
        self.models: dict[str, dict[str, int]] = {}
        self._on_update = on_update

    def on_chat_model_start(self, serialized, messages, *, run_id, **kwargs) -> None:
        params = kwargs.get("invocation_params") or {}
        model = params.get("model") or params.get("model_name") or params.get("model_id") or "unknown"
        with self._lock:
            self._model_of[run_id] = str(model)

    def on_llm_end(self, response: LLMResult, *, run_id, **kwargs) -> None:
        with self._lock:
            model = self._model_of.pop(run_id, "unknown")
        try:
            usage = getattr(response.generations[0][0].message, "usage_metadata", None) or {}
        except (IndexError, AttributeError, TypeError):
            usage = {}
        self.add(model, usage)

    def add(self, model: str, usage: dict) -> None:
        with self._lock:
            m = self.models.setdefault(model, {"calls": 0, "input": 0, "output": 0, "reasoning": 0, "cached": 0})
            m["calls"] += 1
            m["input"] += usage.get("input_tokens", 0) or 0
            m["output"] += usage.get("output_tokens", 0) or 0
            m["reasoning"] += (usage.get("output_token_details") or {}).get("reasoning", 0) or 0
            m["cached"] += (usage.get("input_token_details") or {}).get("cache_read", 0) or 0
        if self._on_update:
            self._on_update(self.summary())

    def summary(self) -> dict:
        with self._lock:
            models = {name: dict(m) for name, m in self.models.items()}
        keys = ("calls", "input", "output", "reasoning", "cached")
        return {"total": {k: sum(m[k] for m in models.values()) for k in keys}, "models": models}


def sections(state: dict) -> dict:
    """The page's sections that ``state`` holds, flattened."""
    found = {}
    for name, path in SECTIONS.items():
        value = state
        for key in path:
            value = value.get(key) if isinstance(value, dict) else None
        if isinstance(value, str) and value.strip():
            found[name] = value.strip()
    return found


# Config keys that shape a run's output beyond what run_settings() records.
EXTRA_SETTINGS = ("temperature", "max_tokens", "llm_max_retries", "max_tool_rounds", "google_thinking_level",
                  "openai_reasoning_effort", "anthropic_effort", "holding_period_days", "benchmark_ticker",
                  "news_article_limit", "global_news_article_limit", "global_news_lookback_days")


def run_settings(graph, job: dict, asset_type: str) -> dict:
    """Everything that produced this run, for the saved record and later reports.

    Built on ``graph.run_settings()``, an allowlist that leaves out keys and
    paths. An endpoint is kept as its origin only: a URL can carry a password
    or a token in its path or query.
    """
    from urllib.parse import urlsplit

    url = job.get("backendUrl") or ""
    parts = urlsplit(url)
    return {
        **graph.run_settings(),
        **{key: graph.config.get(key) for key in EXTRA_SETTINGS},
        "asset_type": asset_type,
        "category": job.get("category"),
        "requested_ticker": job.get("ticker"),
        "requested_analysts": list(job.get("analysts", [])),
        "backend": f"{parts.scheme}://{parts.hostname}{f':{parts.port}' if parts.port else ''}" if parts.hostname else None,
    }


def asset_type_of(ticker: str, category: str | None = None) -> str:
    """``crypto`` for the crypto pipeline, else ``stock``: the category the form
    chose, or the symbol itself (``BTC-USD``, ``BTCUSDT`` as a broker writes it)."""
    crypto = category == "crypto" or crypto_base(ticker) or ticker.endswith(("-USD", "-USDT", "-USDC", "-BTC", "-ETH"))
    return "crypto" if crypto else "stock"


def files_statements(ticker: str) -> bool:
    """Whether the instrument is a company with statements to read: futures (gold,
    oil: ``GC=F``), forex pairs (``EURUSD=X``) and indices (``^GSPC``) are not."""
    symbol = normalize_symbol(ticker)
    return not (symbol.endswith(("=F", "=X")) or symbol.startswith("^"))


def new_turns(previous: dict, found: dict) -> list[tuple[str, str]]:
    """What each section gained since ``previous``: a debate history grows by one
    argument per turn, so only its new tail is the turn; a report is new whole."""
    turns = []
    for name, text in found.items():
        old = previous.get(name, "")
        if text != old:
            turns.append((name, text[len(old):].strip() if old and text.startswith(old) else text))
    return turns


# The section each graph node writes, so the words a node is typing land on its card.
NODE_SECTIONS = {
    "Market Analyst": "market_report",
    "Sentiment Analyst": "sentiment_report",
    "News Analyst": "news_report",
    "Fundamentals Analyst": "fundamentals_report",
    "Bull Researcher": "bull_history",
    "Bear Researcher": "bear_history",
    "Research Manager": "investment_plan",
    "Trader": "trader_investment_plan",
    "Aggressive Analyst": "aggressive_history",
    "Conservative Analyst": "conservative_history",
    "Neutral Analyst": "neutral_history",
    "Portfolio Manager": "final_trade_decision",
}


def token_section(namespace: tuple, metadata: dict) -> str | None:
    """The section a streamed token belongs to: an analyst's subgraph names it in
    the namespace ("Market Analyst:<id>"), any other node in its metadata."""
    node = namespace[0].split(":")[0] if namespace else metadata.get("langgraph_node", "")
    return NODE_SECTIONS.get(node)


def _text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text")
    return ""


def _stream(graph, init_state):
    """``graph.stream_run`` plus the models' tokens as they are written.

    Yields ``("token", section, text)`` for each piece a model writes, and
    ``("step", messages, state)`` as ``stream_run`` does for each finished step.
    """
    from tradingagents.dataflows.config import run_config_context

    args = {**graph.propagator.get_graph_args(), "stream_mode": ["values", "tasks", "messages"]}
    # Each step runs with the run's config, as stream_run does, so the tools read its vendors.
    context = run_config_context(graph.config)
    stream = context.run(graph.graph.stream, init_state, subgraphs=True, **args)
    try:
        while (step := context.run(next, stream, None)) is not None:
            namespace, mode, chunk = step
            if mode == "messages":
                message, metadata = chunk
                # Only what a model writes; tool results also arrive here, whole.
                if not isinstance(message, AIMessageChunk):
                    continue
                section, text = token_section(namespace, metadata), _text(message.content)
                if section and text:
                    yield "token", section, text
            elif namespace:
                result = chunk.get("result") if mode == "tasks" else None
                if isinstance(result, dict):
                    report = {k: v for k, v in result.items() if k != "messages" and v}
                    if result.get("messages") or report:
                        yield "step", result.get("messages", []), report or None
            elif mode == "values":
                yield "step", chunk.get("messages", []), chunk
    finally:
        context.run(stream.close)


def _tool_owners() -> dict[str, str]:
    """Which analyst offers each data tool, to say who fetched what."""
    from tradingagents.agents.analysts import fundamentals_analyst, market_analyst, news_analyst

    return {tool.name: key for key, module in (("market", market_analyst), ("news", news_analyst),
                                               ("fundamentals", fundamentals_analyst))
            for tool in module.TOOLS}


def _has_credential(provider: str) -> bool:
    if provider in SIGNED_IN_PROVIDERS:
        from tradingagents.llm_clients import chatgpt_auth
        return chatgpt_auth.signed_in_as() is not None
    env = get_api_key_env(provider)
    spec = OPENAI_COMPATIBLE_PROVIDERS.get(provider)
    return env is None or bool(spec and spec.key_optional) or bool(os.environ.get(env))


def options() -> dict:
    table = [(label, key, url) for label, key, url in _llm_provider_table()]
    table += [(label, key, OPENAI_COMPATIBLE_PROVIDERS[key].base_url) for label, key in REGIONS]
    custom = {"quick": [["Custom model ID", "custom"]], "deep": [["Custom model ID", "custom"]]}
    return {
        "providers": [
            {"key": key, "label": label, "url": url, "keyEnv": get_api_key_env(key),
             "ready": _has_credential(key)}
            for label, key, url in table
        ],
        "models": {key: MODEL_OPTIONS.get(key, custom) for _, key, _ in table},
        "analysts": ANALYST_ORDER,
        "languages": LANGUAGES,
        "defaults": {
            "provider": DEFAULT_CONFIG["llm_provider"],
            "quick": DEFAULT_CONFIG["quick_think_llm"],
            "deep": DEFAULT_CONFIG["deep_think_llm"],
        },
    }


def run(job: dict) -> None:
    from tradingagents.graph.trading_graph import TradingAgentsGraph

    # "XAU/USD" as a broker writes it is the XAUUSD the symbol table knows.
    ticker, date = job["ticker"].strip().upper().replace("/", ""), job["date"]
    asset_type = asset_type_of(ticker, job.get("category"))
    # The order the pipeline expects, whatever order the boxes were ticked in.
    analysts = [a for a in ANALYST_ORDER if a in job["analysts"]]
    if asset_type == "crypto" or not files_statements(ticker):
        analysts = [a for a in analysts if a != "fundamentals"]
        if not analysts:
            raise ValueError(f"{ticker} has no financial statements; pick another analyst too.")

    config = DEFAULT_CONFIG.copy()
    config.update({
        "llm_provider": job["provider"],
        "quick_think_llm": job["quick"],
        "deep_think_llm": job["deep"],
        "backend_url": job.get("backendUrl") or None,
        "output_language": job.get("language") or "English",
        "max_debate_rounds": int(job.get("depth", 1)),
        "max_risk_discuss_rounds": int(job.get("depth", 1)),
    })

    usage = UsageTracker(on_update=lambda summary: emit({"type": "usage", **summary}))
    graph = TradingAgentsGraph(analysts, config=config, callbacks=[usage])
    emit({"type": "start", "ticker": ticker, "date": date, "assetType": asset_type, "analysts": analysts,
          "category": job.get("category"),
          "settings": run_settings(graph, job, asset_type)})

    init_state = graph.create_run_state(ticker, date, asset_type)
    owners = _tool_owners()
    final_state, seen, shown = {}, set(), {}
    for kind, messages, state in _stream(graph, init_state):
        if kind == "token":
            emit({"type": "token", "section": messages, "text": state})
            continue
        for message in messages:
            for call in getattr(message, "tool_calls", None) or []:
                if call.get("id") not in seen:
                    seen.add(call.get("id"))
                    emit({"type": "tool", "name": call["name"], "args": call.get("args", {}),
                          "analyst": owners.get(call["name"])})
        if state:
            final_state.update(state)
            found = sections(state)
            for name, text in new_turns(shown, found):
                emit({"type": "turn", "section": name, "text": text})
            shown.update(found)
            if found:
                emit({"type": "update", "sections": found})

    graph.record_decision(ticker, date, final_state)
    report = graph.save_reports(final_state, ticker)
    emit({"type": "done", "rating": run_rating(final_state), "sections": sections(final_state),
          "reportPath": str(report.parent.resolve())})


def main() -> None:
    global _out
    # Libraries that print would break the line protocol; their output goes to stderr.
    _out = sys.stdout
    _out.reconfigure(encoding="utf-8")
    sys.stdout = sys.stderr
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        if command == "options":
            emit(options())
        elif command == "run":
            run(json.loads(sys.stdin.buffer.read().decode("utf-8")))
        else:
            raise SystemExit("usage: python -m cli.web_bridge options|run")
    except Exception as exc:
        traceback.print_exc()
        emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
        sys.exit(1)


if __name__ == "__main__":
    main()
