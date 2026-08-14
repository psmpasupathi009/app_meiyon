import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@meiyon/db", "@meiyon/auth", "@meiyon/config", "@meiyon/ui", "@meiyon/billing"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
