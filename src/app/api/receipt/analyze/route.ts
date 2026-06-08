import { NextRequest, NextResponse } from "next/server";
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

function inferCategory(text: string): CategoryName {
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => text.includes(k))) return category;
  }
  return "その他";
}

/** OCR テキストから合計金額を抽出する */
function extractAmount(text: string): { amount: number | null; confidence: "high" | "low" } {
  // 明示的な合計行を優先（confidence: high）
  const explicitPatterns = [
    /(?:合計|お支払い|お会計|御合計|お支払金額|合\s*計)[^\d]*([0-9,，]+)/,
    /TOTAL[^\d]*\(?税込\)?[^\d]*([0-9,，]+)/i,
    /小計[^\d]*([0-9,，]+)/,
  ];
  for (const pattern of explicitPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseInt(match[1].replace(/[,，]/g, ""), 10);
      if (!isNaN(amount) && amount > 0) return { amount, confidence: "high" };
    }
  }

  // フォールバック: ¥ 付きの最大金額（confidence: low）
  const yenPattern = /[¥￥]\s*([0-9,，]+)/g;
  const amounts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = yenPattern.exec(text)) !== null) {
    const v = parseInt(m[1].replace(/[,，]/g, ""), 10);
    if (!isNaN(v) && v > 0) amounts.push(v);
  }
  if (amounts.length > 0) {
    return { amount: Math.max(...amounts), confidence: "low" };
  }

  return { amount: null, confidence: "low" };
}

/** OCR テキストの先頭行から店名を推定する */
function extractStoreName(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 1);
  return lines[0] ?? null;
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

    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      return NextResponse.json<ApiError>(
        { error: "サーバーの設定エラーです" },
        { status: 500 }
      );
    }

    // data URL プレフィックスを除去して raw base64 を取得
    const base64Data = body.image.replace(/^data:image\/[a-z]+;base64,/, "");

    if (base64Data.length > 2_000_000) {
      return NextResponse.json<ApiError>(
        { error: "画像が大きすぎます（上限 1.5MB）" },
        { status: 413 }
      );
    }

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Data },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
        signal: AbortSignal.timeout(9000),
      }
    );

    if (!visionRes.ok) {
      return NextResponse.json<ApiError>(
        { error: "レシートの解析に失敗しました" },
        { status: 500 }
      );
    }

    const visionData = await visionRes.json();
    const fullText: string =
      visionData?.responses?.[0]?.fullTextAnnotation?.text ?? "";

    if (!fullText) {
      return NextResponse.json<ReceiptAnalysisResult>({
        amount: null,
        category: null,
        memo: null,
        confidence: "low",
      });
    }

    const { amount, confidence } = extractAmount(fullText);
    const storeName = extractStoreName(fullText);
    const category: CategoryName | null = storeName ? inferCategory(fullText) : null;

    return NextResponse.json<ReceiptAnalysisResult>({
      amount,
      category,
      memo: storeName,
      confidence,
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
