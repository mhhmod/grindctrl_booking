import React from 'react';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { ensureMessengerSite } from '@/lib/messenger/provisioning';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';
import { verifyClaimToken } from '@/lib/shopify/claim-token';
import { getShopOwnerEmail } from '@/lib/shopify/shop-owner';

/* Redeem side of the claim flow — see app/api/shopify/claim/start/route.ts
   for the mint side. Order matters:

     1. Verify the token BEFORE requiring sign-in. A dead link sent through
        a sign-up flow only to be told "that link was dead" is hostile —
        check the thing we can check for free first.
     2. Sign-in, carrying the token in redirect_url so it survives.
     3. Adopt the store.

   ensureMessengerSite's StoreOwnedByAnotherAccountError is the only outcome
   this page can turn into a friendly page instead of a 500 — see
   app/dashboard/messenger/page.tsx for the same pattern. Everything else
   must keep propagating, including next/navigation's redirect(), which
   signals a page change by throwing — that's also why redirect() sits
   OUTSIDE this try block instead of after ensureMessengerSite inside it: a
   catch here only tests for one class, but a raw try/catch around a
   redirect() would still swallow it if this file ever grows a catch-all. */

export const dynamic = 'force-dynamic';

const COPY = {
  en: {
    expiredTitle: 'This link has expired',
    expiredBody: 'Reopen GRINDCTRL from your Shopify admin and choose "Claim this store" again.',
    takenTitle: 'This store is already connected',
    // No disconnect/unclaim path exists anywhere in the app (shopProfileId
    // is only ever written, never reverted — see shop-tenancy.ts) —
    // "disconnect it there" would send a locked-out merchant looking for a
    // button that does not exist. Point at support instead.
    takenBody: "It's already connected to another GRINDCTRL account. Contact support if that doesn't sound right.",
    ownerTitle: "We couldn't verify you're the store owner",
    ownerBody: "This store's Shopify contact email doesn't match your GRINDCTRL account. Contact support if you believe this is your store.",
  },
  ar: {
    expiredTitle: 'انتهت صلاحية هذا الرابط',
    expiredBody: 'أعد فتح GRINDCTRL من لوحة تحكم Shopify واختر "المطالبة بهذا المتجر" مرة أخرى.',
    takenTitle: 'هذا المتجر متصل بالفعل',
    takenBody: 'هذا المتجر متصل بالفعل بحساب GRINDCTRL آخر. تواصل مع الدعم إذا لم يكن ذلك صحيحاً.',
    ownerTitle: 'لم نتمكن من التحقق من أنك مالك المتجر',
    ownerBody: 'البريد الإلكتروني للتواصل في Shopify لهذا المتجر لا يطابق حسابك في GRINDCTRL. تواصل مع الدعم إذا كنت تعتقد أن هذا متجرك.',
  },
} as const;

function MessagePage({
  locale,
  title,
  body,
}: {
  locale: 'en' | 'ar';
  title: string;
  body: string;
}) {
  return (
    <section dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale} className="grid min-w-0 place-items-center px-4 py-16">
      <div className="grid max-w-md gap-2 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </section>
  );
}

export default async function ClaimPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const token = params.token ?? '';
  const locale = await getRequestLocale();
  const copy = COPY[locale === 'ar' ? 'ar' : 'en'];

  const claim = verifyClaimToken(process.env.SHOPIFY_API_SECRET ?? '', token);
  if (!claim) {
    return <MessagePage locale={locale} title={copy.expiredTitle} body={copy.expiredBody} />;
  }

  const userId = await requireDashboardUser(`/claim?token=${encodeURIComponent(token)}`);
  const clerkUser = await currentUser();
  const merchantEmail =
    clerkUser?.primaryEmailAddress?.emailAddress ?? clerkUser?.emailAddresses[0]?.emailAddress ?? null;
  const ownerEmail = await getShopOwnerEmail(claim.shop);
  if (!ownerEmail || !merchantEmail || ownerEmail.toLowerCase() !== merchantEmail.toLowerCase()) {
    return <MessagePage locale={locale} title={copy.ownerTitle} body={copy.ownerBody} />;
  }

  try {
    await ensureMessengerSite(userId, claim.shop, claim.shop);
  } catch (error) {
    if (error instanceof StoreOwnedByAnotherAccountError) {
      return <MessagePage locale={locale} title={copy.takenTitle} body={copy.takenBody} />;
    }
    throw error;
  }

  redirect('/dashboard/messenger');
}
