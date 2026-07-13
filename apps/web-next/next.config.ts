import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  async headers() {
    return [
      {
        /* Only /embed/* may be iframed, and only by Shopify storefronts.
           Client custom domains get appended here (DB-driven later). */
        source: '/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.myshopify.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
