/** カテゴリ名 */
export type CategoryName = "貯金" | "住居" | "交通" | "食費" | "娯楽" | "その他";
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

export type DashboardSummaryResponse = {
  totalAmount: number;
  byGroup: {
    groupId: string;
    groupName: string;
    groupColor: string;
    amount: number;
  }[];
  byCategory: {
    category: CategoryName;
    amount: number;
  }[];
};

export type CategoryBudget = {
  category: CategoryName;
  amount: number;
};

export type BudgetProgressItem = {
  category: CategoryName;
  budget: number;
  spent: number;
  remaining: number;
  percent: number;
  overBudget: boolean;
};

export type BudgetProgressResponse = {
  month: string;
  totalBudget: number;
  totalSpent: number;
  items: BudgetProgressItem[];
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
