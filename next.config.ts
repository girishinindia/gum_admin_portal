import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  sassOptions: {
    includePaths: [path.join(__dirname, "node_modules")],
    silenceDeprecations: [
      "legacy-js-api",
      "import",
      "global-builtin",
      "color-functions",
      "mixed-decls",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.growupmore.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
