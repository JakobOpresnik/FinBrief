const BASE = "/api";

export interface SalaryRecord {
  index: number;
  net_pay: number;
  gross_pay: number;
  take_home: number;
  month: number;
  year: number;
  month_name_slovenian: string;
  deductions: Record<string, number>;
  bonuses: Record<string, number>;
  total_deductions: number;
  total_bonuses: number;
  has_pdf: boolean;
  custom_name: string | null;
}

export interface PipelineStatus {
  running: boolean;
  last_run: string | null;
  last_result: string | null;
  started_at: string | null;
}

export interface ScheduleConfig {
  enabled: boolean;
  day_of_month: number;
  hour: number;
  minute: number;
}

export interface SettingsResponse {
  values: Record<string, string>;
  masked_keys: string[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init);
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

export const api = {
  getSalaryHistory: () => fetchJson<SalaryRecord[]>("/salary-history"),

  getSalaryRaw: (index: number) =>
    fetchJson<{ index: number; email_id: string | null; salary_data: Record<string, unknown> }>(`/salary/${index}/raw`),

  runPipeline: () =>
    fetchJson<{ status: string }>("/run-pipeline", { method: "POST" }),

  getPipelineStatus: () => fetchJson<PipelineStatus>("/pipeline-status"),

  cancelPipeline: () =>
    fetchJson<{ status: string }>("/cancel-pipeline", { method: "POST" }),

  clearLogs: () =>
    fetchJson<{ status: string }>("/logs", { method: "DELETE" }),

  getSettings: () => fetchJson<SettingsResponse>("/settings"),

  updateSettings: (values: Record<string, string>) =>
    fetchJson<{ status: string }>("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }),

  getSchedule: () => fetchJson<ScheduleConfig>("/schedule"),

  updateSchedule: (config: ScheduleConfig) =>
    fetchJson<{ status: string }>("/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }),

  getLogs: (lines = 100) => fetchJson<{ logs: string }>(`/logs?lines=${lines}`),

  deleteRecord: (index: number) =>
    fetchJson<{ status: string }>(`/salary/${index}`, { method: "DELETE" }),

  bulkDelete: (indices: number[], deleteFiles = true) =>
    fetchJson<{ status: string }>("/salary/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indices, delete_files: deleteFiles }),
    }),

  fetchPdf: async (index: number, password: string): Promise<string> => {
    const res = await fetch(`${BASE}/salary/${index}/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.status === 403) throw new Error("Wrong password");
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  saveAs: (index: number, password: string) =>
    fetchJson<{ status: string; path: string | null }>(`/salary/${index}/save-as`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }),

  openFile: (path: string) =>
    fetchJson<{ status: string }>("/open-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }),

  quit: () => fetchJson<{ status: string }>("/quit", { method: "POST" }),

  renameSalary: (index: number, name: string) =>
    fetchJson<{ status: string }>(`/salary/${index}/name`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
};
