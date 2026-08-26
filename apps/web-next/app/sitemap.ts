import type { MetadataRoute } from 'next';

/* Public marketing surfaces only. Auth, dashboard, embeds, and API routes
   stay out of the index. */
const PRIORITY_ROUTES: Array<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/pricing', priority: 0.9 },
  { path: '/try-on', priority: 0.8 },
];

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://grindctrl.cloud';
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();
  return PRIORITY_ROUTES.map(({ path, priority }) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: 'weekly',
    priority,
  }));
}
