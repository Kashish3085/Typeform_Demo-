// Thin typed wrapper around fetch. One place for base URL + error handling.
import type {
  AnswerMap, BuilderQuestion, Form, FormStats, FormSummary, PublicForm,
  QuestionType, ResponseDetail, ResponseListItem, SubmitResult, Usage, User, Workspace,
} from "./types";
import { getToken, notifyUnauthorized } from "./session";

// Keep browser requests same-origin: Next.js proxies API calls to the backend,
// avoiding localhost/127.0.0.1 and CORS mismatches in the user's browser.
export const API_URL = "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** per-question validation errors from POST /responses (question_id -> message) */
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const token = getToken();
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  // A 401 on anything except the login/signup calls means the session died: send the user to /login.
  if (res.status === 401 && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/signup")) {
    notifyUnauthorized();
  }
  if (!res.ok) {
    // FastAPI: {detail: string} or {detail: [{msg, loc}...]} for 422s
    const detail = body?.detail;
    const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail[0]?.msg ?? "Invalid input" : "Something went wrong";
    throw new ApiError(res.status, msg, body?.errors);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export const api = {
  // auth
  signup: (email: string, password: string, name?: string) =>
    request<{ token: string; user: User }>("/api/auth/signup", json("POST", { email, password, name })),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", json("POST", { email, password })),
  logout: () => request<void>("/api/auth/logout", json("POST")),
  me: () => request<User>("/api/auth/me"),

  // forms
  listForms: (workspaceId?: number) =>
    request<FormSummary[]>(`/api/forms${workspaceId != null ? `?workspace_id=${workspaceId}` : ""}`),
  createForm: (opts: { title?: string; workspaceId?: number; template?: string } = {}) =>
    request<Form>("/api/forms", json("POST", { title: opts.title, workspace_id: opts.workspaceId, template: opts.template })),
  moveForm: (id: number, workspaceId: number) => request<Form>(`/api/forms/${id}/move`, json("POST", { workspace_id: workspaceId })),

  // workspaces + usage
  listWorkspaces: () => request<Workspace[]>("/api/workspaces"),
  createWorkspace: (name: string) => request<Workspace>("/api/workspaces", json("POST", { name })),
  renameWorkspace: (id: number, name: string) => request<Workspace>(`/api/workspaces/${id}`, json("PATCH", { name })),
  deleteWorkspace: (id: number) => request<void>(`/api/workspaces/${id}`, json("DELETE")),
  getUsage: () => request<Usage>("/api/usage"),
  getForm: (id: number) => request<Form>(`/api/forms/${id}`),
  updateForm: (id: number, patch: Partial<Form>) => request<Form>(`/api/forms/${id}`, json("PATCH", patch)),
  deleteForm: (id: number) => request<void>(`/api/forms/${id}`, json("DELETE")),
  duplicateForm: (id: number) => request<Form>(`/api/forms/${id}/duplicate`, json("POST")),
  publish: (id: number) => request<Form>(`/api/forms/${id}/publish`, json("POST")),
  unpublish: (id: number) => request<Form>(`/api/forms/${id}/unpublish`, json("POST")),

  // questions
  addQuestion: (formId: number, type: QuestionType, position?: number) =>
    request<BuilderQuestion>(`/api/forms/${formId}/questions`, json("POST", { type, position })),
  updateQuestion: (id: number, patch: Partial<BuilderQuestion>) =>
    request<BuilderQuestion>(`/api/questions/${id}`, json("PATCH", patch)),
  deleteQuestion: (id: number) => request<void>(`/api/questions/${id}`, json("DELETE")),
  reorderQuestions: (formId: number, orderedIds: number[]) =>
    request<BuilderQuestion[]>(`/api/forms/${formId}/questions/order`, json("PUT", { ordered_ids: orderedIds })),

  // public
  getPublicForm: (slug: string) => request<PublicForm>(`/api/public/forms/${slug}`),
  submitResponse: (slug: string, answers: AnswerMap) =>
    request<SubmitResult>(
      `/api/public/forms/${slug}/responses`,
      json("POST", { answers: Object.entries(answers).map(([id, value]) => ({ question_id: Number(id), value })) }),
    ),

  // results
  listResponses: (formId: number) => request<ResponseListItem[]>(`/api/forms/${formId}/responses`),
  getResponse: (formId: number, id: number) => request<ResponseDetail>(`/api/forms/${formId}/responses/${id}`),
  deleteResponse: (formId: number, id: number) => request<void>(`/api/forms/${formId}/responses/${id}`, json("DELETE")),
  getStats: (formId: number) => request<FormStats>(`/api/forms/${formId}/summary`),
  // The CSV endpoint needs the Authorization header, so a plain <a href> can't download it: fetch it as a blob.
  exportCsv: async (formId: number): Promise<Blob> => {
    const token = getToken();
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/forms/${formId}/export.csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      throw new ApiError(0, "Can't reach the server. Is the backend running?");
    }
    if (res.status === 401) notifyUnauthorized();
    if (!res.ok) throw new ApiError(res.status, "Could not export responses");
    return res.blob();
  },
};

export const publicLink = (slug: string) =>
  `${typeof window !== "undefined" ? window.location.origin : ""}/f/${slug}`;
