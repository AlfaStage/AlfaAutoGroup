import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    cpus: 2,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
