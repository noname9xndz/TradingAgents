import pytest

from cli.web_bridge import (
    UsageTracker,
    asset_type_of,
    files_statements,
    new_turns,
    ping,
    run_settings,
    sections,
    token_section,
)


@pytest.mark.unit
def test_usage_tracker_totals_tokens_per_model_and_reports_each_call():
    seen = []
    tracker = UsageTracker(on_update=seen.append)
    tracker.add("quick-model", {"input_tokens": 100, "output_tokens": 20, "output_token_details": {"reasoning": 15}})
    tracker.add("quick-model", {"input_tokens": 50, "output_tokens": 5, "input_token_details": {"cache_read": 40}})
    tracker.add("deep-model", {})
    summary = tracker.summary()
    assert summary["models"]["quick-model"] == {"calls": 2, "input": 150, "output": 25, "reasoning": 15, "cached": 40}
    assert summary["total"] == {"calls": 3, "input": 150, "output": 25, "reasoning": 15, "cached": 40}
    assert len(seen) == 3 and seen[-1] == summary


@pytest.mark.unit
def test_broker_crypto_symbols_and_the_crypto_category_run_the_crypto_pipeline():
    assert asset_type_of("BTCUSDT") == asset_type_of("ETH-USD") == "crypto"
    assert asset_type_of("SOMECOIN", "crypto") == "crypto"
    assert asset_type_of("NVDA") == asset_type_of("XAUUSD", "forex") == "stock"


@pytest.mark.unit
def test_run_settings_record_the_run_but_not_credentials_in_its_endpoint():
    class Graph:
        config = {"temperature": 0.2, "max_tool_rounds": 20}

        def run_settings(self):
            return {"llm_provider": "ollama", "quick_think_llm": "qwen3:8b"}

    job = {"analysts": ["fundamentals", "market"], "backendUrl": "http://user:secret@ollama:11434/v1?key=k"}
    settings = run_settings(Graph(), job, "stock")
    assert settings["llm_provider"] == "ollama" and settings["temperature"] == 0.2
    assert settings["requested_analysts"] == ["fundamentals", "market"]
    assert settings["backend"] == "http://ollama:11434"
    assert "secret" not in str(settings) and "key=k" not in str(settings)


@pytest.mark.unit
def test_only_companies_have_statements_for_the_fundamentals_analyst():
    assert files_statements("NVDA") and files_statements("0700.HK")
    for symbol in ("XAUUSD", "XAU/USD".replace("/", ""), "USOIL", "EURUSD", "SPX500", "GC=F"):
        assert not files_statements(symbol), symbol


@pytest.mark.unit
def test_token_section_reads_the_analyst_subgraph_before_the_inner_node():
    assert token_section(("Market Analyst:abc",), {"langgraph_node": "agent"}) == "market_report"
    assert token_section((), {"langgraph_node": "Bear Researcher"}) == "bear_history"
    assert token_section((), {"langgraph_node": "Memory Log"}) is None


@pytest.mark.unit
def test_new_turns_gives_a_growing_history_only_its_new_argument():
    shown = {"bull_history": "\nBull Analyst: one", "market_report": "r"}
    found = {"bull_history": "\nBull Analyst: one\nBull Analyst: two", "market_report": "r", "bear_history": "B"}
    assert new_turns(shown, found) == [("bull_history", "Bull Analyst: two"), ("bear_history", "B")]


@pytest.mark.unit
def test_sections_flattens_nested_debate_state_and_drops_empty_ones():
    state = {
        "market_report": "  up  ",
        "news_report": "",
        "investment_debate_state": {"bull_history": "Bull Analyst: buy", "bear_history": ""},
        "risk_debate_state": None,
    }
    assert sections(state) == {"market_report": "up", "bull_history": "Bull Analyst: buy"}


@pytest.mark.unit
def test_ping_calls_each_distinct_model_once_and_reports_failures(monkeypatch):
    calls = []

    class Reply:
        content = "OK"

    class Client:
        def __init__(self, model):
            self.model = model

        def get_llm(self):
            return self

        def invoke(self, prompt):
            calls.append(self.model)
            if self.model == "bad":
                raise ValueError("bad is not a valid model ID")
            return Reply()

    monkeypatch.setattr("tradingagents.llm_clients.create_tier_client", lambda config, tier: Client(config[f"{tier}_think_llm"]))
    same = ping({"provider": "openrouter", "quick": "m", "deep": "m"})["results"]
    assert calls == ["m"] and [r["ok"] for r in same] == [True, True] and [r["tier"] for r in same] == ["quick", "deep"]
    mixed = ping({"provider": "openrouter", "quick": "m", "deep": "bad"})["results"]
    assert mixed[0]["ok"] and not mixed[1]["ok"] and "not a valid model" in mixed[1]["error"]
