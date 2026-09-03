'use client';

import React, { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from './textarea';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
import type {
  MessengerAttachments,
  MessengerContactCapture,
  MessengerNotifications,
  MessengerOrderLookup,
} from '@/lib/messenger/types';

/* The four support-desk switches, in one card inside the Behaviour tab.
   Each is a separate settings section server-side, so saving here writes
   four drafts in one click and Publish moves them together. */

const COPY = {
  en: {
    title: 'Support desk',
    subtitle: 'What happens when the assistant cannot finish the job.',
    notifications: 'Email alerts',
    emailOnHandoff: 'Email us when a shopper needs a person',
    recipientsLabel: 'Send to these addresses instead (one per line)',
    recipientsHelp:
      'Leave empty to alert workspace owners and admins. At most 5 addresses, at most 10 emails per hour.',
    contact: 'Ask for a reply address',
    contactEnabled: 'Ask a shopper where to reply when nobody can answer now',
    contactOutside: 'Also ask outside business hours',
    contactHelp: 'Asked once per conversation, and never when we already know their address.',
    attachments: 'Photo attachments',
    attachmentsEnabled: 'Let shoppers attach a photo (JPEG, PNG or WebP, up to 5 MB)',
    triageEnabled: 'Have the assistant describe what the photo shows',
    attachmentsHelp:
      'Location data is stripped from photos before they are stored. Photos are kept for 90 days.',
    orders: 'Order lookup',
    ordersEnabled: 'Let the assistant look up order status and tracking',
    ordersHelp:
      'Shoppers must be signed in, or give an order number and the matching email. Read-only — the assistant can never change an order.',
    ordersConnect: 'Grant order access',
    ordersAuthorized: 'Approved for this store',
    ordersNotAuthorized: 'Not approved yet — order lookup stays off until you approve it',
    ordersReconnect: 'Re-approve order access',
    ordersGranted: 'Order access granted — Store Chat can now look up orders for this store.',
    ordersRefused: 'Order access was not granted. Nothing changed — you can try again.',
    ordersConnectHelp:
      'Opens Shopify to approve order access for this store. Existing installs must approve again, because reading orders is a new permission.',
    ordersNoStore: 'Connect a Shopify store first — order lookup needs one to read from.',
    save: 'Save draft',
    saving: 'Saving…',
    saved: 'Draft saved',
    failed: 'Could not save. Try again.',
  },
  ar: {
    title: 'مكتب الدعم',
    subtitle: 'ماذا يحدث عندما لا يستطيع المساعد إنهاء المهمة.',
    notifications: 'تنبيهات البريد',
    emailOnHandoff: 'أرسل لنا بريداً عندما يحتاج العميل إلى شخص حقيقي',
    recipientsLabel: 'أرسل إلى هذه العناوين بدلاً من ذلك (عنوان لكل سطر)',
    recipientsHelp:
      'اتركه فارغاً لتنبيه مالكي ومشرفي مساحة العمل. ٥ عناوين كحد أقصى، و١٠ رسائل في الساعة كحد أقصى.',
    contact: 'طلب عنوان للرد',
    contactEnabled: 'اسأل العميل أين نرد عليه عندما لا يستطيع أحد الرد الآن',
    contactOutside: 'اسأل أيضاً خارج ساعات العمل',
    contactHelp: 'يُسأل مرة واحدة لكل محادثة، ولا يُسأل إذا كنا نعرف عنوانه.',
    attachments: 'إرفاق الصور',
    attachmentsEnabled: 'السماح للعملاء بإرفاق صورة (JPEG أو PNG أو WebP، حتى ٥ ميجابايت)',
    triageEnabled: 'اجعل المساعد يصف ما تُظهره الصورة',
    attachmentsHelp: 'تُزال بيانات الموقع من الصور قبل تخزينها. تُحفظ الصور ٩٠ يوماً.',
    orders: 'الاستعلام عن الطلبات',
    ordersEnabled: 'السماح للمساعد بالاطلاع على حالة الطلب والشحن',
    ordersHelp:
      'يجب أن يكون العميل مسجّل الدخول، أو يعطي رقم الطلب والبريد المطابق. للقراءة فقط — لا يمكن للمساعد تعديل أي طلب.',
    ordersConnect: 'منح صلاحية الطلبات',
    ordersAuthorized: 'تمت الموافقة لهذا المتجر',
    ordersNotAuthorized: 'لم تتم الموافقة بعد — البحث عن الطلبات معطّل حتى توافق',
    ordersReconnect: 'إعادة منح صلاحية الطلبات',
    ordersGranted: 'تم منح صلاحية الطلبات — يمكن لدردشة المتجر الآن الاطلاع على الطلبات.',
    ordersRefused: 'لم تُمنح صلاحية الطلبات. لم يتغير شيء — يمكنك المحاولة مرة أخرى.',
    ordersConnectHelp:
      'يفتح Shopify للموافقة على صلاحية الطلبات لهذا المتجر. يجب على المتاجر المثبّتة مسبقاً الموافقة مجدداً، لأن قراءة الطلبات صلاحية جديدة.',
    ordersNoStore: 'اربط متجر Shopify أولاً — الاستعلام عن الطلبات يحتاج متجراً ليقرأ منه.',
    save: 'حفظ المسودة',
    saving: 'جارٍ الحفظ…',
    saved: 'تم حفظ المسودة',
    failed: 'تعذّر الحفظ. حاول مجدداً.',
  },
};

function Check({
  checked,
  onChange,
  children,
  help,
  nested,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  /** Sits directly under the control it explains. Section-level help stranded
   *  at the bottom of a group made the reader match sentences to checkboxes. */
  help?: string;
  /** Depends on the option above it. Indent plus a rule says so; the old
   *  50% opacity at the same indent just looked broken. */
  nested?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={nested ? 'ms-1.5 border-s border-border ps-3' : ''}>
    <label className={`flex items-start gap-2 text-sm ${disabled ? 'opacity-60' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">{children}</span>
    </label>
    {help && (
      <p className={`ms-6 mt-0.5 text-xs text-muted-foreground ${disabled ? 'opacity-60' : ''}`}>
        {help}
      </p>
    )}
    </div>
  );
}

export function SupportDeskSettings({
  locale,
  siteId,
  shopDomain,
  ordersAuthorized = false,
  notifications,
  contactCapture,
  attachments,
  orderLookup,
  actions,
}: {
  locale: 'en' | 'ar';
  siteId: string;
  /** The connected myshopify domain, when there is one. Order lookup has
   *  nothing to read from without it. */
  shopDomain: string | null;
  /** Whether this store has actually approved order access. The panel used to
   *  offer the grant with no way of knowing whether it had ever been given,
   *  so a merchant could only find out by pressing it again. */
  ordersAuthorized?: boolean;
  notifications: MessengerNotifications;
  contactCapture: MessengerContactCapture;
  attachments: MessengerAttachments;
  orderLookup: MessengerOrderLookup;
  actions: Pick<MessengerHostActions, 'saveDraftSection'>;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  /* Shopify sends the merchant back here after the consent screen. Saying
     nothing was the old behaviour, and it left the one question they had —
     did that work? — unanswered on a page that looked untouched. */
  const grantOutcome = useSearchParams()?.get('orders') ?? null;
  const [notify, setNotify] = useState(notifications);
  const [contact, setContact] = useState(contactCapture);
  const [attach, setAttach] = useState(attachments);
  const [orders, setOrders] = useState(orderLookup);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  /* Recipients are edited as text and normalised server-side; keeping the
     raw string in state means a half-typed address doesn't vanish under the
     cursor while the merchant is still typing it. */
  const [recipientsText, setRecipientsText] = useState(notifications.recipients.join('\n'));

  function save(event: React.FormEvent) {
    event.preventDefault();
    setNote(null);
    startTransition(async () => {
      const results = await Promise.all([
        actions.saveDraftSection(siteId, 'notifications', {
          ...notify,
          recipients: recipientsText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        }),
        actions.saveDraftSection(siteId, 'contactCapture', contact),
        actions.saveDraftSection(siteId, 'attachments', attach),
        actions.saveDraftSection(siteId, 'orderLookup', orders),
      ]);
      const failed = results.find((result) => !result.ok);
      setNote(failed ? { ok: false, text: t.failed } : { ok: true, text: t.saved });
    });
  }

  return (
    <form onSubmit={save} className="grid min-w-0 gap-5 rounded-2xl border border-border p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold">{t.title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.subtitle}</p>
      </div>

      <section className="grid gap-2 rounded-xl border border-border p-4">
        <h4 className="text-sm font-semibold">{t.notifications}</h4>
        <Check checked={notify.emailOnHandoff} onChange={(v) => setNotify({ ...notify, emailOnHandoff: v })}>
          {t.emailOnHandoff}
        </Check>
        {notify.emailOnHandoff && (
          <div className="grid gap-1">
            <Label htmlFor="notify-recipients">{t.recipientsLabel}</Label>
            <Textarea
              id="notify-recipients"
              rows={3}
              dir="ltr"
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t.recipientsHelp}</p>
          </div>
        )}
      </section>

      <section className="grid gap-2 rounded-xl border border-border p-4">
        <h4 className="text-sm font-semibold">{t.contact}</h4>
        <Check checked={contact.enabled} onChange={(v) => setContact({ ...contact, enabled: v })}>
          {t.contactEnabled}
        </Check>
        <Check
          checked={contact.askOutsideHours}
          disabled={!contact.enabled}
          nested
          onChange={(v) => setContact({ ...contact, askOutsideHours: v })}
        >
          {t.contactOutside}
        </Check>
        <p className="text-xs text-muted-foreground">{t.contactHelp}</p>
      </section>

      <section className="grid gap-2 rounded-xl border border-border p-4">
        <h4 className="text-sm font-semibold">{t.attachments}</h4>
        <Check
          checked={attach.enabled}
          help={t.attachmentsHelp}
          onChange={(v) => setAttach({ ...attach, enabled: v })}
        >
          {t.attachmentsEnabled}
        </Check>
        <Check
          checked={attach.triageEnabled}
          disabled={!attach.enabled}
          nested
          onChange={(v) => setAttach({ ...attach, triageEnabled: v })}
        >
          {t.triageEnabled}
        </Check>
      </section>

      <section className="grid gap-2 rounded-xl border border-border p-4">
        <h4 className="text-sm font-semibold">{t.orders}</h4>
        <Check
          checked={orders.enabled}
          disabled={!shopDomain}
          help={shopDomain ? t.ordersHelp : t.ordersNoStore}
          onChange={(v) => setOrders({ enabled: v })}
        >
          {t.ordersEnabled}
        </Check>
        {shopDomain && (
          <p
            className={`flex items-center gap-1.5 text-xs font-medium ${
              ordersAuthorized
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block size-1.5 shrink-0 rounded-full ${
                ordersAuthorized ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {ordersAuthorized ? t.ordersAuthorized : t.ordersNotAuthorized}
          </p>
        )}
        {shopDomain && (
          <div className="grid gap-1">
            {/* A plain link, not a fetch: this is a top-level navigation to
                Shopify's consent screen, and the state cookie the route sets
                only comes back on one.

                And it has to be top-level in the literal sense. This panel
                also renders inside the embedded Shopify app, which is an
                iframe on admin.shopify.com, and following this href in-frame
                lands on accounts.shopify.com — which refuses to be framed.
                The merchant clicked "Grant order access" and got
                "accounts.shopify.com refused to connect", with the whole app
                replaced by an error page.

                Escaping to the top window rather than target="_blank" keeps
                the merchant in the one tab they started in: consent finishes
                and Shopify returns them to the app. A new tab would leave
                them stranded on our dashboard with the admin still open
                behind it. Same escape the claim flow already uses, and a
                click gives it the user gesture that lets a cross-origin
                frame navigate its top. The href stays real so the standalone
                dashboard — where there is no frame to escape — and a
                middle-click both still work. */}
            <a
              href={`/api/shopify/oauth/start?shop=${encodeURIComponent(shopDomain)}`}
              onClick={(event) => {
                if (typeof window === 'undefined' || window.top === window.self) return;
                event.preventDefault();
                window.top!.location.href = new URL(
                  event.currentTarget.getAttribute('href') ?? '',
                  window.location.origin,
                ).toString();
              }}
              className="w-fit rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2"
            >
              {ordersAuthorized ? t.ordersReconnect : t.ordersConnect}
            </a>
            <p className="text-xs text-muted-foreground">{t.ordersConnectHelp}</p>
            {grantOutcome === 'connected' && (
              <p
                role="status"
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400"
              >
                {t.ordersGranted}
              </p>
            )}
            {grantOutcome === 'failed' && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {t.ordersRefused}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t.saving : t.save}
        </Button>
        {note && (
          <span
            role={note.ok ? 'status' : 'alert'}
            className={`text-sm ${note.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
          >
            {note.text}
          </span>
        )}
      </div>
    </form>
  );
}
