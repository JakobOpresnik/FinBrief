# FinBrief

FinBrief is a self-hosted desktop application that automates salary payslip processing. It connects to your Gmail via IMAP, downloads password-protected PDF payslips, decrypts and extracts structured salary data using a local LLM (no cloud APIs), and presents your full pay history in a dashboard with charts, analytics, and privacy controls.

## ✨ Features

- 📬 **Automatic email monitoring** — polls Gmail IMAP for payslip emails by sender and subject keyword
- 🔓 **PDF decryption & extraction** — unlocks password-protected PDFs and extracts text for analysis; unprotected PDFs are processed as-is (password is optional)
- 🤖 **Local AI extraction** — uses llama.cpp to parse salary fields (gross, net, deductions, bonuses) entirely on-device
- 📊 **Interactive dashboard** — salary table with sort, year filter, per-record deduction/bonus breakdowns, bulk delete, custom record labels, and raw JSON viewer
- 📈 **Analytics & charts** — salary trend, pay composition, net-to-gross ratio, and donut breakdowns
- 🔒 **Privacy mode** — hides all financial figures with one click or `Ctrl+Shift+H`
- 🌗 **Light & dark mode** — theme toggle persisted across sessions
- 🔔 **Push notifications** — optional ntfy.sh alerts with salary summary and anomaly detection
- 🗓 **Built-in scheduler** — configure automatic pipeline runs without leaving the app
- 📄 **PDF viewer** — unlock and view original payslip PDFs inside the app

## 🛠 Tech Stack

- 🐍 **Python 3.10+** — backend runtime
- ⚡ **FastAPI + Uvicorn** — REST API server (runs locally on startup)
- 🖥 **pywebview** — wraps the web UI in a native desktop window
- 📑 **pikepdf** — PDF decryption
- 📝 **pdfplumber** — PDF text extraction
- 🧠 **llama-cpp-python** — local LLM inference for structured salary extraction
- ⏰ **APScheduler** — in-process job scheduling
- ⚛️ **React 19 + TypeScript** — frontend UI
- ⚡ **Vite** — frontend build tool
- 🎨 **Mantine v9** — UI component library
- 📉 **Recharts** — charting library
- 📲 **ntfy.sh** — push notifications (optional)

## 📋 Prerequisites

- Python 3.10+
- Node.js 18+ and [Bun](https://bun.sh) (for frontend)
- A `.gguf` model file compatible with llama-cpp-python (e.g. Llama 3 8B Instruct)
- A Gmail account with IMAP enabled and a Gmail App Password generated (see below)

### Gmail: Enable IMAP & Generate an App Password

FinBrief connects to Gmail via IMAP using an **App Password** — a special one-time token that lets the app access your inbox without requiring your real Google password. App Passwords require 2-Step Verification to be active on your account.

**Step 1 — Enable 2-Step Verification** (skip if already enabled)

1. Go to [myaccount.google.com](https://myaccount.google.com) and sign in.
2. Open **Security** in the left sidebar.
3. Under *How you sign in to Google*, click **2-Step Verification** and follow the prompts to turn it on.

**Step 2 — Enable IMAP in Gmail**

1. Open [Gmail](https://mail.google.com) in your browser.
2. Click the gear icon (top-right) → **See all settings**.
3. Go to the **Forwarding and POP/IMAP** tab.
4. Under *IMAP Access*, select **Enable IMAP**.
5. Click **Save Changes**.

**Step 3 — Create an App Password**

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (you must be signed in and have 2-Step Verification active — if you are redirected away or don't see an input field, complete Step 1 first).
2. Type `FinBrief` into the name field and click **Create**.
3. Google will display a 16-character password like `xxxx xxxx xxxx xxxx`. **Copy it now** — it will not be shown again.
4. Paste this value into your `.env` file as `GMAIL_APP_PASSWORD` (spaces are fine to keep).

## ⚙️ Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/JakobOpresnik/FinBrief.git
   cd FinBrief
   ```

2. **Create and activate a Python virtual environment**

   ```bash
   python -m venv .venv

   # Windows
   .venv\Scripts\activate

   # macOS / Linux
   source .venv/bin/activate
   ```

3. **Install Python dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Install frontend dependencies**

   ```bash
   cd frontend
   bun install
   bun run build
   cd ..
   ```

5. **Configure environment variables**

   Create a `.env` file in the project root:

   ```env
   # Gmail IMAP
   GMAIL_ADDRESS=you@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   GMAIL_SENDER_FILTER=payroll@youremployer.com
   GMAIL_SUBJECT_KEYWORD=Salary

   # PDF (leave blank or omit if your payslips are not password-protected)
   PDF_PASSWORD=your_pdf_password

   # Local LLM
   LLM_MODEL_PATH=models/llama-3-8b-instruct.Q4_K_M.gguf
   LLM_GPU_LAYERS=-1

   # File storage
   SAVE_BASE_PATH=C:/Users/you/Documents/Payslips
   EMPLOYEE_NAME=John
   EMPLOYEE_SURNAME=Doe
   FILENAME_PATTERN={name}_{surname}_{month}_{year}   # available placeholders: {name}, {surname}, {month}, {month_num}, {year}

   # Notifications (optional)
   NTFY_TOPIC=finbrief-your-unique-topic
   ```

6. **Setting up push notifications (optional)**

   FinBrief uses [ntfy.sh](https://ntfy.sh) — a free, open-source push notification service — to send salary summaries and anomaly alerts straight to your phone.

   **On your phone:**
   1. Install the **ntfy** app — [Android (Play Store)](https://play.google.com/store/apps/details?id=io.heckel.ntfy) or [iOS (App Store)](https://apps.apple.com/app/ntfy/id1625396347). You can also open [ntfy.sh/#download](https://ntfy.sh/#download) in your browser and scan the QR code with your phone to go straight to the correct store.
   2. Open the app and tap the **+** button to subscribe to a new topic.
   3. Enter a topic name that is unique and hard to guess (e.g. `finbrief-john-doe-2024`). Anyone who knows your topic name can read your notifications, so avoid obvious names.
   4. Tap **Subscribe**.
   
   **In FinBrief:**
   
   5. Set `NTFY_TOPIC` in your `.env` to the exact same topic name you entered in step 3.
   
   6. Alternatively, open **Settings** inside the app and enter the topic name in the *Notifications* section — no restart needed.
   
   From that point on, every time the pipeline runs, FinBrief will POST a notification to `https://ntfy.sh/<your-topic>` and it will appear on your phone instantly. Each notification includes the take-home breakdown, gross pay, and saved file path. Anomaly alerts are triggered when net or gross pay deviates more than 10% from your recent average, when an individual deduction spikes more than 50% above its recent average, or when a new deduction category appears for the first time.

6. **Download the LLM model**

   The app uses [Qwen2.5 3B Instruct (Q4_K_M)](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF) — a fast, lightweight model that runs well on CPU. Download it directly into the `models/` directory:

   ```bash
   curl -L -o models/qwen2.5-3b-instruct-q4_k_m.gguf https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf
   ```

   Make sure your `.env` has:

   ```env
   LLM_MODEL_PATH=models/qwen2.5-3b-instruct-q4_k_m.gguf
   ```

7. **Run the app**

   ```bash
   python app.py
   ```

   The app opens in a native desktop window. To run in dev mode (API only, no window):

   ```bash
   python app.py --dev
   ```

## 🧪 Running Tests

Run all tests from the project root (with the virtual environment activated):

```bash
pytest tests/
```

For verbose output showing each individual test name and result:

```bash
pytest tests/ -v
```

## 🚀 Usage

- **Dashboard** — view, sort, and filter payslips by year; hover deductions/bonuses columns for a breakdown; select multiple records for bulk delete; rename any record with a custom label; open the raw JSON data for any record
- **Run Pipeline** — manually trigger email polling and processing; watch live step-by-step progress with elapsed time and a full scrollable log
- **Schedule** — configure automatic runs (day of month 1–28, hour, minute); the scheduler runs as long as the app is open
- **Statistics** — salary trends, pay composition charts, net-to-gross ratio over time
- **Settings** — configure Gmail, PDF password, storage paths, and LLM from within the app; changes take effect without restarting
- **Privacy mode** — click the 👁 icon in the sidebar or press `Ctrl+Shift+H` to mask all figures
- **Exit** — press `Ctrl+Q` to quit the app
