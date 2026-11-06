import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run 用に、動かすのに要るファイルだけを .next/standalone にまとめる
  output: "standalone",
};

export default nextConfig;
