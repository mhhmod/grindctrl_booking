import type {NextConfig} from 'next';
import {withSentryConfig} from '@sentry/nextjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: '*.myshopify.com', pathname: '/cdn/**' },
    ],
  },
  async headers() {
    /* Baseline hardening applied to every route. Deliberately NOT included
       here: any Content-Security-Policy frame-ancestors value — the embed
       must stay framable by Shopify storefronts and the /shopify/* admin
       pages by Shopify's own domains, and Next would emit BOTH this header
       and the path-specific ones (browsers then apply every directive, so a
       global 'self' would break embedding). Framing stays governed by the
       path-specific CSP rules below. */
    const baseline = [
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      /* The assistant voice recorder uses the microphone on our own origin;
         camera and geolocation have no known first-party use today. */
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(self), geolocation=()',
      },
    ];
    return [
      {
        source: '/:path*',
        headers: baseline,
      },
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
            /* Any HTTPS parent may frame the embed: Shopify's editor chain
               and client custom-domain storefronts aren't enumerable, and
               the widget exposes no framing-sensitive actions. */
            value: 'frame-ancestors https:',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {treeshake: {removeDebugLogging: true}},
});
