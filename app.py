from __future__ import annotations

import sys
import threading

import uvicorn
import webview

from api.server import app

PORT: int = 18099


def start_server() -> None:
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")


def main() -> None:
    dev_mode: bool = "--dev" in sys.argv

    server_thread: threading.Thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    if dev_mode:
        print(f"API running at http://127.0.0.1:{PORT}")
        print("Press Ctrl+C to stop")
        try:
            server_thread.join()
        except KeyboardInterrupt:
            pass
    else:
        webview.create_window(
            "FinBrief",
            f"http://127.0.0.1:{PORT}",
            width=1100,
            height=750,
        )
        webview.start()


if __name__ == "__main__":
    main()
