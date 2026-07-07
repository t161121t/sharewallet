/** カテゴリ名 */
export type CategoryName =
  | "貯金"
  | "住居"
  | "交通"
  | "食費"
  | "娯楽"
  | "医療"
  | "日用品"
  | "通信"
  | "美容"
  | "教育"
  | "その他";
export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

/** グループメンバーの型 */
export type GroupMember = {
  id: string;
  name: string;
  /** アバターの色（背景色として使用） */
  color: string;
  /** アバター画像（Data URL） */
  avatarUrl?: string;
  role?: GroupRole;
};

/** グループの型 */
export type Group = {
  id: string;
  name: string;
  members: GroupMember[];
  /** グループのテーマカラー */
  color: string;
  /** グループアイコン画像（Data URL） */
  iconUrl?: string;
};

/** ユーザープロフィールの型 */
export type UserProfile = {
  id: string;
  name: string;
  email: string;
  color: string;
  /** アバター画像（Data URL） */
  avatarUrl?: string;
};

/** 支出レコードの型 */
export type ExpenseRecord = {
  id: string;
  /** カテゴリ */
  category: CategoryName;
  /** 金額（円） */
  amount: number;
  /** 登録したメンバーの ID */
  memberId: string;
  /** 登録したメンバーの名前 */
  memberName: string;
  /** 登録したメンバーのアバター画像（Data URL） */
  memberAvatarUrl?: string;
  /** メモ（任意） */
  memo?: string;
  /** 登録日時 ISO 文字列 */
  date: string;
  shares?: ExpenseShare[];
};

export type ExpenseShare = {
  userId: string;
  percent: number;
  userName?: string;
};

export type ExpenseWithShares = {
  amount: number;
  memberId: string;
  shares: ExpenseShare[];
};

/** ログインレスポンス */
export type LoginResponse = {
  token: string;
  user: UserProfile;
};

/** 登録レスポンス */
export type RegisterResponse = {
  user: UserProfile;
};

/** API エラーレスポンス */
export type ApiError = {
  error: string;
};

export type DashboardGroupSummary = {
  groupId: string;
  groupName: string;
  groupColor: string;
  groupIconUrl?: string;
  amount: number;
};

export type DashboardCategorySummary = {
  category: CategoryName;
  amount: number;
};

export type MemberBalance = {
  userId: string;
  userName: string;
  userColor: string;
  userAvatarUrl?: string;
  /** 正: 受け取るべき金額、負: 支払うべき金額 */
  balance: number;
};

export type SettlementTransaction = {
  fromUserId: string;
  fromUserName: string;
  fromUserColor: string;
  fromUserAvatarUrl?: string;
  toUserId: string;
  toUserName: string;
  toUserColor: string;
  toUserAvatarUrl?: string;
  amount: number;
};

export type SettlementResult = {
  transactions: SettlementTransaction[];
  memberBalances: MemberBalance[];
  totalExpenseAmount: number;
  expenseCount: number;
};

export type GroupInvitation = {
  id: string;
  token: string;
  url: string;
  expiresAt: string | null;
  createdAt: string;
  status: "ACTIVE" | "REVOKED";
};

export type InvitationInfo = {
  groupId: string;
  groupName: string;
  groupColor: string;
  groupIconUrl?: string;
  memberCount: number;
  createdByName: string;
  expiresAt: string | null;
};

export type ReceiptAnalysisResult = {
  amount: number | null;
  category: CategoryName | null;
  memo: string | null;
  confidence: "high" | "low";
};

export type DashboardSummary = {
  totalPersonalAmount: number;
  previousMonthTotalPersonalAmount: number;
  byGroup: DashboardGroupSummary[];
  byCategory: DashboardCategorySummary[];
  period: {
    from: string;
    to: string;
    label: string;
  };
};
