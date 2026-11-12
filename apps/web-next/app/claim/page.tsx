import React from 'react';
import { currentUser } from '@clerk/nextjs/server';
import { CLAIM_COPY } from '@/components/claim/claim-copy';
import { ClaimMessage } from '@/components/claim/claim-message';
import { requireDashboardUser } from '@/lib/auth/dashboard';
import { getRequestLocale } from '@/lib/auth/locale';
import { ensureMessengerSite } from '@/lib/messenger/provisioning';
import { StoreOwnedByAnotherAccountError } from '@/lib/messenger/shop-tenancy';
import { verifyClaimToken } from '@/lib/shopify/claim-token';
import { getShopOwnerEmail } from '@/lib/shopify/shop-owner';
import { coreCapabilitySecret } from '@/lib/security/capability-key';

/* Redeem side of the claim flow — see app/api/shopify/claim/start/route.ts
   for the mint side. Order matters:

     1. Verify the token BEFORE requiring sign-in. A dead link sent through
        a sign-up flow only to be told "that link was dead" is hostile —
        check the thing we can check for free first.
     2. Sign-in, carrying the token in redirect_url so it survives.
     3. Adopt the store.

   ensureMessengerSite's StoreOwnedByAnotherAccountError is the only outcome
   this page can turn into a friendly page instead of a 500 — see
   app/dashboard/store-chat/page.tsx for the same pattern. Everything else
   must keep propagating. Successful adoption renders next steps below. */

export const dynamic = 'force-dynamic';

const COPY = CLAIM_COPY;

export default async function ClaimPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const token = params.token ?? '';
  const locale = await getRequestLocale();
  const copy = COPY[locale === 'ar' ? 'ar' : 'en'];

  // Claim redemption uses the independent GRINDCTRL key.
  const claim = verifyClaimToken(coreCapabilitySecret() ?? '', token);
  if (!claim) {
    return <ClaimMessage locale={locale} title={copy.expiredTitle} body={copy.expiredBody} />;
  }

  const claimPath = `/claim?token=${encodeURIComponent(token)}`;
  const userId = await requireDashboardUser(claimPath);
  const clerkUser = await currentUser();
  const merchantEmail =
    clerkUser?.primaryEmailAddress?.emailAddress ?? clerkUser?.emailAddresses[0]?.emailAddress ?? null;
  const ownerEmail = await (claim.appClientId ? getShopOwnerEmail(claim.shop, claim.appClientId) : getShopOwnerEmail(claim.shop));
  const manualConnectAction = { label: copy.connectManually, href: '/dashboard/try-on' };
  if (!ownerEmail) {
    /* getShopOwnerEmail needs the shop's Admin API token, which is fetched
       asynchronously right after install (see ensure-shop-token.tsx) and can
       plausibly still be in flight seconds after a fresh install -- this is
       not necessarily a real mismatch, so it gets its own retry-first
       messaging instead of being folded into the "not you" case below. */
    return (
      <ClaimMessage
        locale={locale}
        title={copy.notReadyTitle}
        body={copy.notReadyBody}
        actions={[{ label: copy.tryAgain, href: `/claim?token=${encodeURIComponent(token)}` }, manualConnectAction]}
      />
    );
  }
  if (!merchantEmail || ownerEmail.toLowerCase() !== merchantEmail.toLowerCase()) {
    /* The owner's address is never shown (it is the store's, not this
       person's); their own is, so they can tell which account they are in. */
    return (
      <ClaimMessage
        locale={locale}
        title={copy.ownerTitle}
        body={merchantEmail ? copy.ownerBodySignedInAs(merchantEmail) : copy.ownerBody}
        switchAccount={{ label: copy.switchAccount, returnTo: claimPath }}
        actions={[manualConnectAction]}
      />
    );
  }

  try {
    await ensureMessengerSite(userId, claim.shop, claim.shop);
  } catch (error) {
    if (error instanceof StoreOwnedByAnotherAccountError) {
      return <ClaimMessage locale={locale} title={copy.takenTitle} body={copy.takenBody} actions={[{ label: copy.contactSupport, href: 'mailto:grindctrlnow@gmail.com' }]} />;
    }
    throw error;
  }

  return (
    <ClaimMessage
      locale={locale}
      title={copy.successTitle}
      body={copy.successBody}
      actions={[{ label: copy.goToDashboard, href: '/dashboard/store' }]}
    />
  );
}
