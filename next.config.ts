import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: '64mb',
    },
    middlewareClientMaxBodySize: '64mb',
    cpus: 1,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
