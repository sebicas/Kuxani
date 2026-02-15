import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    COMMIT_SHA: process.env.COMMIT_SHA || "unknown",
  },
};

export default nextConfig;
