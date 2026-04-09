# FinBrief

FinBrief is a self-hosted desktop application that automates salary payslip processing. It connects to your Gmail via IMAP, downloads password-protected PDF payslips, decrypts and extracts structured salary data using a local LLM (no cloud APIs), and presents your full pay history in a dashboard with charts, analytics, and privacy controls.

## ✨ Features

- 📬 **Automatic email monitoring** — polls Gmail IMAP for payslip emails by sender and subject keyword
- 🔓 **PDF decryption & extraction** — unlocks password-protected PDFs and extracts text for analysis
- 🤖 **Local AI extraction** — uses llama.cpp to parse salary fields (gross, net, deductions, bonuses) entirely on-device
- 📊 **Interactive dashboard** — sortable salary table with per-record deduction/bonus breakdowns
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
- A Gmail account with IMAP enabled and an [App Password](https://myaccount.google.com/apppasswords) generated

## ⚙️ Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/JakobOpresnik/finbrief.git
   cd finbrief
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

   # PDF
   PDF_PASSWORD=your_pdf_password

   # Local LLM
   LLM_MODEL_PATH=models/llama-3-8b-instruct.Q4_K_M.gguf
   LLM_GPU_LAYERS=-1

   # File storage
   SAVE_BASE_PATH=C:/Users/you/Documents/Payslips
   EMPLOYEE_NAME=John
   EMPLOYEE_SURNAME=Doe
   FILENAME_PATTERN={name}_{surname}_{month}_{year}

   # Notifications (optional)
   NTFY_TOPIC=finbrief-your-unique-topic
   ```

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

## 🚀 Usage

- **Dashboard** — view and sort all processed payslips; hover deductions/bonuses columns for a breakdown
- **Run Pipeline** — manually trigger email polling and processing with live log output
- **Schedule** — configure automatic runs (day of month, hour, minute)
- **Statistics** — salary trends, pay composition charts, net-to-gross ratio over time
- **Settings** — configure Gmail, PDF password, storage paths, and LLM from within the app
- **Privacy mode** — click the 👁 icon in the sidebar or press `Ctrl+Shift+H` to mask all figures
