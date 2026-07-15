import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["lightningcss", "@tailwindcss/postcss", "@tailwindcss/node"],
};

export default nextConfig;
