import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack's saved dev cache kept serving old CSS after globals.css changed, even across restarts.
    turbopackFileSystemCacheForDev: false,
  },
  // Writing became Blog: old links (shared on LinkedIn and elsewhere) keep working.
  async redirects() {
    return [
      { source: "/writing", destination: "/blog", permanent: true },
      { source: "/writing/:slug", destination: "/blog/:slug", permanent: true },
    ];
  },
  images: {
    // Credly badge images, shown on Certificates.
    remotePatterns: [{ protocol: "https", hostname: "images.credly.com" }],
  },
};

export default nextConfig;
