import type {
  GroupMember,
  ExpenseRecord,
  MemberBalance,
  SettlementTransaction,
  SettlementResult,
} from "@/types";

export function calculateSettlement(
  members: GroupMember[],
  expenses: ExpenseRecord[]
): SettlementResult {
  const balanceMap = new Map<string, number>();
  for (const member of members) balanceMap.set(member.id, 0);

  for (const { amount, memberId, shares } of expenses) {
    balanceMap.set(memberId, (balanceMap.get(memberId) ?? 0) + amount);

    if (shares && shares.length > 0) {
      for (const share of shares) {
        const owed = amount * (share.percent / 100);
        balanceMap.set(share.userId, (balanceMap.get(share.userId) ?? 0) - owed);
      }
    } else {
      const equal = amount / members.length;
      for (const m of members) {
        balanceMap.set(m.id, (balanceMap.get(m.id) ?? 0) - equal);
      }
    }
  }

  const memberBalances: MemberBalance[] = members.map((m) => ({
    userId: m.id,
    userName: m.name,
    userColor: m.color,
    userAvatarUrl: m.avatarUrl,
    balance: Math.round(balanceMap.get(m.id) ?? 0),
  }));

  return {
    transactions: minimumCashFlow(memberBalances),
    memberBalances,
    totalExpenseAmount: expenses.reduce((s, e) => s + e.amount, 0),
    expenseCount: expenses.length,
  };
}

function minimumCashFlow(balances: MemberBalance[]): SettlementTransaction[] {
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance - a.balance);

  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ ...b, balance: -b.balance }))
    .sort((a, b) => b.balance - a.balance);

  const transactions: SettlementTransaction[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].balance, debtors[j].balance);
    if (amount > 0) {
      transactions.push({
        fromUserId: debtors[j].userId,
        fromUserName: debtors[j].userName,
        fromUserColor: debtors[j].userColor,
        fromUserAvatarUrl: debtors[j].userAvatarUrl,
        toUserId: creditors[i].userId,
        toUserName: creditors[i].userName,
        toUserColor: creditors[i].userColor,
        toUserAvatarUrl: creditors[i].userAvatarUrl,
        amount,
      });
    }
    creditors[i].balance -= amount;
    debtors[j].balance -= amount;
    if (creditors[i].balance <= 0) i++;
    if (debtors[j].balance <= 0) j++;
  }

  return transactions;
}
