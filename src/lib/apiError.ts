import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth";

type RouteHandler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<NextResponse>;

type ApiErrorHandlingOptions = {
  /** 未処理エラー(500)発生時に返すメッセージ。ルートの操作内容に合わせて必ず指定する */
  defaultErrorMessage: string;
  /**
   * ForbiddenError発生時(403)に返すメッセージ。ルートごとに権限の対象が異なるため、
   * そのルートで ForbiddenError が投げられうる場合は必ず指定する。
   * 指定を省略した場合は汎用メッセージにフォールバックする。
   */
  forbiddenMessage?: string;
};

/**
 * 認証(UnauthorizedError→401)・認可(ForbiddenError→403)・その他の未処理エラー(→500)を
 * 一箇所で処理する共通ラッパー。各APIルートハンドラはこれで包むだけでよく、
 * try/catchの定型文(UNAUTHORIZED/FORBIDDENの文字列比較)を書く必要がなくなる。
 */
export function withApiErrorHandling<Ctx = unknown>(
  handler: RouteHandler<Ctx>,
  options: ApiErrorHandlingOptions
): RouteHandler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return NextResponse.json<ApiError>(
          { error: "認証が必要です" },
          { status: 401 }
        );
      }
      if (e instanceof ForbiddenError) {
        return NextResponse.json<ApiError>(
          { error: options.forbiddenMessage ?? "この操作を行う権限がありません" },
          { status: 403 }
        );
      }
      return NextResponse.json<ApiError>(
        { error: options.defaultErrorMessage },
        { status: 500 }
      );
    }
  };
}
