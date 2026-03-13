import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/sharewallet?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // テーブルを空にする（再実行対応）
  await prisma.expense.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash("password123", 10);

  // 1. ユーザー作成
  const tanaka = await prisma.user.create({
    data: {
      name: "田中 太郎",
      email: "tanaka@example.com",
      passwordHash: hash,
      color: "#F59E0B",
    },
  });
  const suzuki = await prisma.user.create({
    data: {
      name: "鈴木",
      email: "suzuki@example.com",
      passwordHash: hash,
      color: "#3B82F6",
    },
  });
  const sato = await prisma.user.create({
    data: {
      name: "佐藤",
      email: "sato@example.com",
      passwordHash: hash,
      color: "#EC4899",
    },
  });
  const takahashi = await prisma.user.create({
    data: {
      name: "高橋",
      email: "takahashi@example.com",
      passwordHash: hash,
      color: "#10B981",
    },
  });
  const yamada = await prisma.user.create({
    data: {
      name: "山田",
      email: "yamada@example.com",
      passwordHash: hash,
      color: "#6366F1",
    },
  });
  const ito = await prisma.user.create({
    data: {
      name: "伊藤",
      email: "ito@example.com",
      passwordHash: hash,
      color: "#F43F5E",
    },
  });

  // 2. グループ作成 + メンバー紐付け
  const group1 = await prisma.group.create({
    data: {
      name: "東京シェアハウス",
      color: "#c9a227",
      members: {
        create: [
          { userId: tanaka.id },
          { userId: suzuki.id },
          { userId: sato.id },
          { userId: takahashi.id },
        ],
      },
    },
  });

  await prisma.group.create({
    data: {
      name: "大学サークル会計",
      color: "#3B82F6",
      members: {
        create: [
          { userId: tanaka.id },
          { userId: yamada.id },
          { userId: ito.id },
        ],
      },
    },
  });

  await prisma.group.create({
    data: {
      name: "旅行（沖縄）",
      color: "#10B981",
      members: {
        create: [{ userId: suzuki.id }, { userId: sato.id }],
      },
    },
  });

  // 3. 支出データ作成（東京シェアハウス）
  await prisma.expense.createMany({
    data: [
      { groupId: group1.id, memberId: tanaka.id, category: "食費", amount: 3200, memo: "スーパーで買い物", date: new Date("2026-01-31T18:30:00") },
      { groupId: group1.id, memberId: suzuki.id, category: "住居", amount: 12000, memo: "電気代 1月分", date: new Date("2026-01-30T10:00:00") },
      { groupId: group1.id, memberId: sato.id, category: "交通", amount: 1580, memo: "タクシー代", date: new Date("2026-01-29T22:15:00") },
      { groupId: group1.id, memberId: takahashi.id, category: "娯楽", amount: 4500, memo: "映画＋ポップコーン", date: new Date("2026-01-28T14:00:00") },
      { groupId: group1.id, memberId: tanaka.id, category: "食費", amount: 8900, memo: "みんなで外食", date: new Date("2026-01-27T19:30:00") },
      { groupId: group1.id, memberId: suzuki.id, category: "貯金", amount: 30000, memo: "共有貯金", date: new Date("2026-01-25T09:00:00") },
      { groupId: group1.id, memberId: sato.id, category: "住居", amount: 5400, memo: "水道代 1月分", date: new Date("2026-01-24T11:00:00") },
      { groupId: group1.id, memberId: takahashi.id, category: "その他", amount: 2100, memo: "日用品", date: new Date("2026-01-23T16:45:00") },
      { groupId: group1.id, memberId: tanaka.id, category: "交通", amount: 520, memo: "バス代", date: new Date("2026-01-22T08:20:00") },
      { groupId: group1.id, memberId: sato.id, category: "食費", amount: 1800, memo: "コンビニ", date: new Date("2026-01-21T12:30:00") },
    ],
  });

  console.log("Seed complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
