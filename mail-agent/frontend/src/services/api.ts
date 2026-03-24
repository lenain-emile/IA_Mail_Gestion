import type { RawEmail, EmailWithAnalysis, OrchestratorReport } from "../types";

const BASE = "/api";

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, data.error || "Erreur serveur");
  }

  return data as T;
}

export async function checkHealth(): Promise<{ status: string }> {
  return request("/health");
}

export async function getLoginUrl(): Promise<void> {
  window.location.href = `${BASE}/auth/login`;
}

export async function fetchEmails(): Promise<{
  count: number;
  emails: RawEmail[];
}> {
  return request("/mails");
}

export async function analyzeEmail(): Promise<EmailWithAnalysis> {
  return request("/mails/analyze");
}

export async function draftEmail(): Promise<EmailWithAnalysis> {
  return request("/mails/draft");
}

export async function runOrchestrator(
  limit: number = 50,
): Promise<OrchestratorReport> {
  return request(`/run?limit=${limit}`, { method: "POST" });
}
