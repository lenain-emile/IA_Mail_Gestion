import type {
  RawEmail,
  EmailWithAnalysis,
  OrchestratorReport,
  SavedEmailData,
  EmailDraft,
  DraftActionResult,
} from "../types";

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

export async function analyzeSelectedEmail(email: RawEmail): Promise<EmailWithAnalysis> {
  return request("/mails/analyze", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function draftSelectedEmail(email: RawEmail): Promise<EmailWithAnalysis> {
  return request("/mails/draft", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function runOrchestrator(
  limit: number = 50,
): Promise<OrchestratorReport> {
  return request(`/run?limit=${limit}`, { method: "POST" });
}

export async function fetchSavedEmailData(emailId: string): Promise<SavedEmailData> {
  return request(`/mails/${encodeURIComponent(emailId)}/saved`);
}

export async function saveDraftForEmail(
  email: RawEmail,
  draft: EmailDraft,
): Promise<DraftActionResult> {
  return request(`/mails/${encodeURIComponent(email.id)}/draft`, {
    method: "PUT",
    body: JSON.stringify({ email, draft }),
  });
}

export async function sendDraftForEmail(
  email: RawEmail,
  draft: EmailDraft,
): Promise<DraftActionResult> {
  return request(`/mails/${encodeURIComponent(email.id)}/send`, {
    method: "POST",
    body: JSON.stringify({ email, draft }),
  });
}
