import { NextRequest } from "next/server";

type JsonRequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
};

/** API ルートテスト用の NextRequest を生成する */
export function createJsonRequest(
  url: string,
  options: JsonRequestOptions = {}
): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  return new NextRequest(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/** route handler の params 引数を生成する */
export function routeParams<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) };
}
