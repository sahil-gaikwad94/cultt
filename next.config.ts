import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // allow the Arena browser-preview origin to load /_next/* dev assets
  allowedDevOrigins: [
    "*",
    "https://3000-iijz7c1qq6pmv2n1mvimj.e2b.app",
    "3000-iijz7c1qq6pmv2n1mvimj.e2b.app",
  ],
};

export default nextConfig;
