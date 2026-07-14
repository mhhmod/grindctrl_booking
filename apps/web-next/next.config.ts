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
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.shopify.com' }],
  },
  async headers() {
    return [
      {
        /* Embedded Shopify admin pages render inside the Shopify admin iframe. */
        source: '/shopify/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
          },
        ],
      },
      {
        /* Only /embed/* may be iframed, and only by Shopify storefronts.
           Client custom domains get appended here (DB-driven later). */
        source: '/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com https://*.shopifypreview.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
