import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@meiyon/db", "@meiyon/auth", "@meiyon/config", "@meiyon/ui", "@meiyon/billing"],
};

export default nextConfig;
