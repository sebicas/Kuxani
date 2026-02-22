import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // standalone is for Docker/production deploys only;
  // enabling it in dev breaks Turbopack's persistent cache (SST writes).
  ...(isDev ? {} : { output: "standalone" }),
};

export default nextConfig;
