'use client';
import Link from 'next/link';
import { Alert, Anchor } from '@mantine/core';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

export function DisconnectNotice({ locale, shop }: { locale: SiteLocale; shop?: string }) {
  const reconnect = `/dashboard/try-on/setup${shop ? `?shop=${encodeURIComponent(shop)}` : ''}#shopify-app`;
  return <Alert role="status" mb="md" title={locale === 'ar' ? 'تم فصل محادثة المتجر' : 'Store Chat disconnected'}>
    {locale === 'ar' ? 'تبقى المحادثة في Shopify والقياس الافتراضي والباقة والبيانات كما هي. ' : 'Store Chat in Shopify, Try-On, your plan and data stay in place. '}
    <Anchor component={Link} href={reconnect}>{locale === 'ar' ? 'أعد الربط برمز، أو افتح GRINDCTRL في Shopify واختر المطالبة بهذا المتجر.' : 'Reconnect with a code, or open GRINDCTRL in Shopify and choose Claim this store.'}</Anchor>
  </Alert>;
}
