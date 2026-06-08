import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ReceiptAnalysisResult, CategoryName, ApiError } from "@/types";
import { requireAuthUserId } from "@/lib/auth";

const CATEGORY_KEYWORDS: { keywords: string[]; category: CategoryName }[] = [
  { keywords: ["スーパー", "コンビニ", "食料", "食品", "飲食", "レストラン", "カフェ", "ファミレス", "弁当", "惣菜", "肉", "魚", "野菜", "米", "パン", "菓子", "飲料"], category: "食費" },
  { keywords: ["電車", "バス", "タクシー", "新幹線", "高速", "駐車", "ガソリン", "交通"], category: "交通" },
  { keywords: ["薬局", "ドラッグストア", "クリニック", "病院", "歯科", "医院", "薬", "医療"], category: "医療" },
  { keywords: ["ホームセンター", "100円", "雑貨", "日用品", "洗剤", "シャンプー", "ティッシュ", "トイレ"], category: "日用品" },
  { keywords: ["映画", "ゲーム", "カラオケ", "ボウリング", "遊園地", "娯楽", "アミューズ"], category: "娯楽" },
  { keywords: ["ドコモ", "ソフトバンク", "au", "楽天モバイル", "通信", "インターネット", "電話"], category: "通信" },
  { keywords: ["美容院", "ヘアサロン", "エステ", "ネイル", "コスメ", "化粧品", "美容"], category: "美容" },
  { keywords: ["書店", "本屋", "学習", "塾", "スクール", "教材", "文具", "教育"], category: "教育" },
  { keywords: ["家賃", "管理費", "電気", "ガス", "水道", "住居"], category: "住居" },
];

function inferCategory(storeName: string): CategoryName {
  const name = storeName.toLowerCase();
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => name.includes(k))) return category;
  }
  return "その他";
}

export async function POST(req: NextRequest) {
  try {
    await requireAuthUserId(req);
    const body = await req.json().catch(() => null);

    if (!body?.image || typeof body.image !== "string") {
      return NextResponse.json<ApiError>(
        { error: "画像データが必要です" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json<ApiError>(
        { error: "サーバーの設定エラーです" },
        { status: 500 }
      );
    }

    // base64 の先頭の data URL プレフィックスを除去
    const base64Match = body.image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    const mediaType = (base64Match?.[1] ?? "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";
    const base64Data = base64Match ? base64Match[2] : body.image;

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            {
              type: "text",
              text: `このレシート画像から以下の情報を抽出し、必ずJSONのみで返してください。

{
  "amount": <合計金額（数値、税込み合計・お支払い金額の数値のみ）>,
  "storeName": "<店名（わからなければ null）>",
  "confidence": "<high または low>"
}

ルール:
- amount は「合計」「お支払い」「TOTAL」の金額を数値で。見つからなければ null
- storeName はレシートに記載の店名。不明なら null
- confidence は金額が明確に読み取れた場合 high、不確かな場合 low
- JSON 以外のテキストは一切出力しない`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    let parsed: { amount: number | null; storeName: string | null; confidence: string } | null = null;

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // パース失敗時は null のまま
    }

    if (!parsed) {
      return NextResponse.json<ReceiptAnalysisResult>({
        amount: null,
        category: null,
        memo: null,
        confidence: "low",
      });
    }

    const storeName = parsed.storeName ?? null;
    const category: CategoryName | null = storeName ? inferCategory(storeName) : null;

    return NextResponse.json<ReceiptAnalysisResult>({
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      category,
      memo: storeName,
      confidence: parsed.confidence === "high" ? "high" : "low",
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    return NextResponse.json<ApiError>(
      { error: "レシートの解析に失敗しました" },
      { status: 500 }
    );
  }
}
