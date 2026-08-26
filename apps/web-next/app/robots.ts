import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/onboarding', '/embed/', '/shopify/', '/dev/', '/assistant'],
      },
    ],
    sitemap: 'https://grindctrl.cloud/sitemap.xml',
  };
}
