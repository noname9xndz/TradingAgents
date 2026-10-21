"""The CLI's own questions in the output language chosen for the run.

Only the steps after the language question are translated: before it, the
language is not known. Strings without a translation stay in English.
"""

_VI = {
    # Step boxes
    "Default": "Mặc định",
    "Step 4: Analysts Team": "Bước 4: Nhóm phân tích",
    "Select your LLM analyst agents for the analysis": "Chọn các agent phân tích LLM cho lần phân tích này",
    "Selected analysts:": "Đã chọn analyst:",
    "Step 5: Research Depth": "Bước 5: Độ sâu nghiên cứu",
    "Select your research depth level": "Chọn mức độ sâu của nghiên cứu",
    "Research depth from environment:": "Độ sâu nghiên cứu từ biến môi trường:",
    "Step 6: LLM Provider": "Bước 6: Nhà cung cấp LLM",
    "Select your LLM provider": "Chọn nhà cung cấp LLM",
    "LLM provider from environment:": "Nhà cung cấp LLM từ biến môi trường:",
    "Step 7: Thinking Agents": "Bước 7: Model suy luận",
    "Select your thinking agents for analysis": "Chọn model suy luận cho phân tích",
    "Thinking agents from environment:": "Model suy luận từ biến môi trường:",
    "Step 8: Thinking Mode": "Bước 8: Chế độ suy luận",
    "Configure Gemini thinking mode": "Cấu hình chế độ suy luận của Gemini",
    "Step 8: Reasoning Effort": "Bước 8: Mức độ suy luận",
    "Configure OpenAI reasoning effort level": "Cấu hình mức độ suy luận của OpenAI",
    "Step 8: Effort Level": "Bước 8: Mức nỗ lực",
    "Configure Claude effort level": "Cấu hình mức nỗ lực của Claude",
    # Menus
    "\n- Use arrow keys to navigate\n- Press Enter to select":
        "\n- Dùng phím mũi tên để di chuyển\n- Nhấn Enter để chọn",
    "Select Your [Analysts Team]:": "Chọn [Nhóm phân tích]:",
    "\n- Press Space to select/unselect analysts\n- Press 'a' to select/unselect all\n- Press Enter when done":
        "\n- Nhấn Space để chọn/bỏ chọn\n- Nhấn 'a' để chọn/bỏ chọn tất cả\n- Nhấn Enter khi xong",
    "You must select at least one analyst.": "Phải chọn ít nhất một analyst.",
    "Market Analyst": "Phân tích thị trường (Market Analyst)",
    "Sentiment Analyst": "Phân tích tâm lý (Sentiment Analyst)",
    "News Analyst": "Phân tích tin tức (News Analyst)",
    "Fundamentals Analyst": "Phân tích cơ bản (Fundamentals Analyst)",
    "Select Your [Research Depth]:": "Chọn [Độ sâu nghiên cứu]:",
    "Shallow - Quick research, few debate and strategy discussion rounds":
        "Nông - Nghiên cứu nhanh, ít vòng tranh luận và thảo luận chiến lược",
    "Medium - Middle ground, moderate debate rounds and strategy discussion":
        "Trung bình - Cân bằng, số vòng tranh luận và thảo luận vừa phải",
    "Deep - Comprehensive research, in depth debate and strategy discussion":
        "Sâu - Nghiên cứu toàn diện, tranh luận và thảo luận chiến lược kỹ lưỡng",
    "Select your LLM Provider:": "Chọn nhà cung cấp LLM:",
    "Subscription (use your ChatGPT plan)": "Gói đăng ký (dùng gói ChatGPT của bạn)",
    "Select your subscription:": "Chọn gói đăng ký:",
    "Select Your [{mode}-Thinking LLM Engine]:": "Chọn [Model suy luận {mode}]:",
    "Select Your [{mode}-Thinking] OpenRouter Model (latest available):":
        "Chọn model OpenRouter [suy luận {mode}] (mới nhất hiện có):",
    "Select Your [{mode}-Thinking] ChatGPT Plan Model:": "Chọn model của gói ChatGPT [suy luận {mode}]:",
    "Quick": "nhanh",
    "Deep": "sâu",
    "Custom model ID": "Nhập model ID khác",
    "Enter model ID:": "Nhập model ID:",
    "Please enter a model ID.": "Vui lòng nhập model ID.",
    "Enter Azure deployment name ({mode}-thinking):": "Nhập tên deployment Azure (suy luận {mode}):",
    "Please enter a deployment name.": "Vui lòng nhập tên deployment.",
    "Select Reasoning Effort:": "Chọn mức độ suy luận:",
    "Medium (Default)": "Trung bình (Mặc định)",
    "High (More thorough)": "Cao (Kỹ hơn)",
    "Low (Faster)": "Thấp (Nhanh hơn)",
    "Select Effort Level:": "Chọn mức nỗ lực:",
    "High (recommended)": "Cao (khuyến nghị)",
    "Medium (balanced)": "Trung bình (cân bằng)",
    "Low (faster, cheaper)": "Thấp (nhanh hơn, rẻ hơn)",
    "Select Thinking Mode:": "Chọn chế độ suy luận:",
    "Enable Thinking (recommended)": "Bật suy luận (khuyến nghị)",
    "Minimal/Disable Thinking": "Tối thiểu/Tắt suy luận",
    "Select GLM platform:": "Chọn nền tảng GLM:",
    "Select Qwen region:": "Chọn khu vực Qwen:",
    "Select MiniMax region:": "Chọn khu vực MiniMax:",
    "Cancelled. Exiting...": "Đã huỷ. Thoát...",
    "No analysts selected. Exiting...": "Chưa chọn analyst. Thoát...",
    "No research depth selected. Exiting...": "Chưa chọn độ sâu nghiên cứu. Thoát...",
    "No LLM provider selected. Exiting...": "Chưa chọn nhà cung cấp LLM. Thoát...",
    "No subscription selected. Exiting...": "Chưa chọn gói đăng ký. Thoát...",
    "No model selected. Exiting...": "Chưa chọn model. Thoát...",
    # End of run
    "Save report?": "Lưu báo cáo?",
    "Save path (press Enter for default)": "Đường dẫn lưu (nhấn Enter để dùng mặc định)",
    "Also save it as an HTML page?": "Lưu thêm thành trang HTML?",
    "Open it in your browser?": "Mở bằng trình duyệt?",
    "\nDisplay full report on screen?": "\nHiển thị toàn bộ báo cáo trên màn hình?",
    "Report saved to:": "Đã lưu báo cáo tại:",
}

_TABLES = {"vietnamese": _VI}
_table: dict = {}


def set_language(language: str | None) -> None:
    """Translate the questions that follow into ``language`` when it has a table."""
    global _table
    _table = _TABLES.get((language or "").strip().lower(), {})


def t(text: str) -> str:
    """``text`` in the chosen language, or as given."""
    return _table.get(text, text)
