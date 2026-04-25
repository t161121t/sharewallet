/**
 * API クライアント
 *
 * フロントエンドから API Route を呼び出すためのユーティリティ。
 * トークンの管理と共通のリクエスト処理を提供します。
 */

import type {
  LoginResponse,
  RegisterResponse,
  UserProfile,
  Group,
  GroupInvitation,
  InvitationInfo,
  ExpenseRecord,
  CategoryName,
  ExpenseShare,
  DashboardSummary,
  SettlementResult,
} from "@/types";

/* ========== トークン管理 ========== */

const TOKEN_KEY = "sharewallet_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/* ========== 選択中グループ ID の管理 ========== */

const GROUP_KEY = "sharewallet_selected_group_id";

export function getSelectedGroupId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(GROUP_KEY);
}

export function setSelectedGroupId(groupId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GROUP_KEY, groupId);
}

export function clearSelectedGroupId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GROUP_KEY);
}

/* ========== ユーザー情報のキャッシュ（localStorage） ========== */

const USER_KEY = "sharewallet_user";

export function getCachedUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function setCachedUser(user: UserProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearCachedUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_KEY);
}

/* ========== 共通 fetch ========== */

class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "不明なエラー" }));
    throw new ApiClientError(res.status, body.error ?? "不明なエラー");
  }

  return res.json() as Promise<T>;
}

/* ========== 認証 API ========== */

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  // トークンとユーザー情報を保存
  setToken(data.token);
  setCachedUser(data.user);

  return data;
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

/** ログアウト（ローカルストレージをクリア） */
export function logout() {
  clearToken();
  clearCachedUser();
  clearSelectedGroupId();
}

/* ========== ユーザー API ========== */

export async function getMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/users/me");
}

export async function updateMe(
  profile: Partial<UserProfile>
): Promise<UserProfile> {
  const updated = await apiFetch<UserProfile>("/api/users/me", {
    method: "PUT",
    body: JSON.stringify(profile),
  });

  // キャッシュを更新
  setCachedUser(updated);
  return updated;
}

/* ========== グループ API ========== */

export async function getGroups(): Promise<Group[]> {
  return apiFetch<Group[]>("/api/groups");
}

export async function getGroup(groupId: string): Promise<Group> {
  return apiFetch<Group>(`/api/groups/${groupId}`);
}

export async function createGroup(input: {
  name: string;
  color?: string;
  iconUrl?: string;
}): Promise<Group> {
  return apiFetch<Group>("/api/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateGroup(
  groupId: string,
  input: { name?: string; color?: string; iconUrl?: string | null }
): Promise<Group> {
  return apiFetch<Group>(`/api/groups/${groupId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteGroup(groupId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/groups/${groupId}`, {
    method: "DELETE",
  });
}

export async function addMember(
  groupId: string,
  email: string
): Promise<{ id: string; name: string; color: string; role: string }> {
  return apiFetch<{ id: string; name: string; color: string; role: string }>(
    `/api/groups/${groupId}/members`,
    {
      method: "POST",
      body: JSON.stringify({ email }),
    }
  );
}

export async function removeMember(
  groupId: string,
  userId: string
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/groups/${groupId}/members/${userId}`, {
    method: "DELETE",
  });
}

/* ========== 支出 API ========== */

export async function getExpenses(groupId: string): Promise<ExpenseRecord[]> {
  return apiFetch<ExpenseRecord[]>(`/api/groups/${groupId}/expenses`);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("/api/dashboard/summary");
}

export async function createExpense(
  groupId: string,
  expense: {
    category: CategoryName;
    amount: number;
    memberId?: string;
    memberName?: string;
    memo?: string;
    shares?: ExpenseShare[];
  }
): Promise<ExpenseRecord> {
  return apiFetch<ExpenseRecord>(`/api/groups/${groupId}/expenses`, {
    method: "POST",
    body: JSON.stringify(expense),
  });
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  expense: Partial<{
    category: CategoryName;
    amount: number;
    memberId: string;
    memo: string;
    shares: ExpenseShare[];
  }>
): Promise<ExpenseRecord> {
  return apiFetch<ExpenseRecord>(`/api/groups/${groupId}/expenses/${expenseId}`, {
    method: "PUT",
    body: JSON.stringify(expense),
  });
}

export async function deleteExpense(
  groupId: string,
  expenseId: string
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/groups/${groupId}/expenses/${expenseId}`, {
    method: "DELETE",
  });
}

export async function getSettlement(groupId: string): Promise<SettlementResult> {
  return apiFetch<SettlementResult>(`/api/groups/${groupId}/settlement`);
}

/* ========== 招待リンク API ========== */

export async function createInvitation(
  groupId: string,
  expiresInDays = 7
): Promise<GroupInvitation> {
  return apiFetch<GroupInvitation>(`/api/groups/${groupId}/invitations`, {
    method: "POST",
    body: JSON.stringify({ expiresInDays }),
  });
}

export async function getInvitations(groupId: string): Promise<GroupInvitation[]> {
  return apiFetch<GroupInvitation[]>(`/api/groups/${groupId}/invitations`);
}

export async function revokeInvitation(
  groupId: string,
  invitationId: string
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(
    `/api/groups/${groupId}/invitations/${invitationId}`,
    { method: "DELETE" }
  );
}

export async function getInvitationInfo(token: string): Promise<InvitationInfo> {
  return apiFetch<InvitationInfo>(`/api/invite/${token}`);
}

export async function acceptInvitation(
  token: string
): Promise<{ groupId: string; groupName: string }> {
  return apiFetch<{ groupId: string; groupName: string }>(
    `/api/invite/${token}/accept`,
    { method: "POST" }
  );
}

export { ApiClientError };
