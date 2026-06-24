import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build to a static site (out/) served by FastAPI; no Node server at runtime.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
