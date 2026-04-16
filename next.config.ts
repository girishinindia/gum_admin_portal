import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.bunnycdn.com' },
      { protocol: 'https', hostname: 'cdn.growupmore.com' },
    ],
  },
};

export default nextConfig;
