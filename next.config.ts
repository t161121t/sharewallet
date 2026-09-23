import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // 親ディレクトリの pnpm-lock.yaml を誤検出しないよう、プロジェクトルートを明示する
    root: path.join(__dirname),
  },
};

export default nextConfig;
