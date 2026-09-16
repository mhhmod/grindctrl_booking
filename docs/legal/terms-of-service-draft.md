# Terms of Service (Draft)

> **DRAFT. Not legal advice. Not published.**
> This document has not been reviewed by a lawyer and is not live on the site. Review with a qualified lawyer (Egypt, and EU/US counsel if we knowingly serve merchants or shoppers there) before publishing anything based on it. Every factual statement below was checked against the current codebase and production configuration on 2026-09-17; re-verify before publishing if the product has changed since.

## Open questions for the owner

1. **Refund terms.** No refund policy exists in code or product copy today, other than the automatic credit refund when a generation fails (see section 5). Decide whether paid plans/packs get refunds under any other circumstances (for example, cancellation shortly after payment), and how a merchant requests one.
2. **Liability cap.** Section 10 is a placeholder. Decide a cap (for example, fees paid in the prior 12 months) with your lawyer.
3. **Governing law and venue.** This draft proposes Egypt. Confirm, or add carve-outs for merchants in the EU/US.
4. **Account/business eligibility.** Is there a minimum age or business-registration requirement to sign up? Not currently enforced in the product.
5. **International/children's use**, mirrored from the Privacy Policy draft: no age gate exists today.
6. **Data retention for Store Chat**, mirrored from the Privacy Policy draft: affects what we can promise about "your data" after termination.
7. **What "Done-for-you" service scope includes.** The dfy-v1 plan's implementation scope and brand options are described in pricing copy as "confirmed during booking," not fixed in the product. Decide if the Terms should describe this as a separately scoped statement of work, or leave it general as drafted.
8. **Formal SLA or uptime commitment.** Today there is none, and no public status page exists. Confirm this stays true before publishing, since it directly affects section 8.
9. **Commercial terms not yet approved for publication.** The product-truth register marks three statements as needing your approval, and the live pricing page hides them until then: same-day activation after manual payment (and which payment methods), a fixed 365-day validity for top-up credits (the real value is configured per pack), and month-to-month terms with no contract. Approve or change each before these Terms state them.

---

## 1. Agreement

These Terms of Service ("Terms") are an agreement between Grind CTRL, an Egypt-based business ("GrindCTRL," "we," "us"), and the merchant business using our service ("you," "merchant"). By creating an account, installing our Shopify app, or using our dashboard, you agree to these Terms.

If you are entering into these Terms on behalf of a business, you confirm you have authority to bind that business.

## 2. The service

GrindCTRL is a managed AI product for Shopify merchants, providing:

- **AI virtual try-on**: shoppers on your storefront upload a photo and receive an AI-generated preview of a garment on them, consumed against your plan's monthly try-on credits or purchased top-up credit packs.
- **Store Chat**: an AI-assisted chat widget for your storefront that answers shopper questions using store knowledge you provide, and can look up a shopper's own orders when their identity is verified.
- **A merchant dashboard**: to manage your connected store, chat conversations, knowledge base, and plan.

We offer a **Free plan** (no card required, a starting point for one store) and paid plans (**Launch** and **Done-for-you**) with different amounts of monthly try-on credits and image quality. Paid plan and top-up pack activation is handled manually today: there is no self-serve card checkout in the product. You arrange payment with us and we activate your plan manually. Accepted payment methods and activation timing are confirmed during booking (Open Question 9). Implementation scope for the Done-for-you plan is confirmed with you before activation (Open Question 7).

## 3. Accounts

You sign in to the dashboard through our authentication provider (Clerk). You are responsible for keeping your account credentials secure and for all activity under your account. Every member of a workspace currently has the same dashboard permissions as the workspace owner; there is no per-role permission system yet.

## 4. Acceptable use

You agree not to:

- Use the service for any unlawful purpose, or in a way that infringes another party's rights.
- Attempt to bypass rate limits, security controls, or access restrictions.
- Upload content you do not have the right to use, or that is abusive, deceptive, or harmful.
- Use the try-on or chat features to collect shopper data beyond what you disclose to your own shoppers.
- Reverse-engineer, resell, or white-label the service without our written agreement.

We may suspend access for use that violates this section (see section 9).

## 5. Merchant responsibilities

- **Your storefront content.** You are responsible for the product images, descriptions, and any content you supply to Store Chat's knowledge base, including that you have the rights to use it.
- **Shopper notices.** You are responsible for telling your own shoppers what the try-on and Store Chat features do and for meeting any disclosure or consent requirements that apply to your business and your shoppers' location. We provide the mechanism; you own the relationship with your shoppers (see the Privacy Policy draft, section 2).
- **Lawful use of shopper data.** You must have a lawful basis to collect and share any shopper data (including photos, chat messages, and order lookups) through the service.

## 6. AI-generated content

Try-on previews and Store Chat replies are generated by AI models. They are **illustrative only**: a try-on preview does not guarantee an exact match to fit, color, fabric, or how a garment will look in person, and a chat reply is not guaranteed to be complete or error-free. Do not present AI-generated try-on images or chat answers as a guarantee to your shoppers.

## 7. Credits and billing

- **Plan credits** reset at the end of each billing period.
- **Top-up credits** can be used across billing periods on an active plan. Their validity period is set per pack and confirmed at purchase (Open Question 9).
- **Failed generations** automatically refund the reserved credit; you are only charged (in credits) for images that are successfully delivered. Underlying provider cost may still be incurred by us even when a generation fails; this does not affect your credit balance.
- **When credits run out**, the try-on widget stops appearing to shoppers rather than showing a broken experience. Add credits or upgrade your plan to restore it.
- **Plan changes**: upgrades take effect immediately. Downgrades take effect at the start of your next billing period.
- **Contract term**: to be confirmed before publishing (Open Question 9).
- **Refunds**: not otherwise defined today; see Open Question 1. Do not rely on this draft for a refund commitment beyond the automatic failed-generation credit refund described above.

## 8. Availability

We do not currently offer a service level agreement (SLA) or uptime guarantee, and there is no public status page. We take reasonable steps to keep the service available and verify each deployment before it goes live, but the service is provided without an uptime commitment at this time.

## 9. Suspension and termination

We may suspend or terminate your access if you violate section 4, if required by law, or if your account becomes a security risk to the service or other merchants. You may stop using the service at any time. Termination does not entitle you to a refund of unused credits or fees unless required by law or separately agreed (see Open Question 1).

## 10. Disconnecting a store

You can disconnect a store from your dashboard at any time. Disconnecting removes your dashboard access to that store, but **does not delete anything**: Store Chat keeps running in your Shopify admin exactly as before, and all conversations, knowledge, saved replies, and settings stay with the store. You, or anyone with access to that store's Shopify admin, can reconnect it later through the normal claim process and regain full access.

## 11. Intellectual property

We own the GrindCTRL product, including its software, design, and trademarks. You retain ownership of your store content and data. You grant us a license to process your content solely to provide the service to you.

## 12. Disclaimers

*[Placeholder for lawyer review.]* The service is provided "as is" and "as available." To the extent permitted by law, we disclaim implied warranties of merchantability, fitness for a particular purpose, and non-infringement. Nothing in this section is intended to override protections that cannot be disclaimed under applicable law.

## 13. Limitation of liability

*[Placeholder for lawyer review. Liability cap not yet set; see Open Question 2.]* To the extent permitted by law, our aggregate liability arising out of or relating to these Terms or the service will not exceed [amount/formula to be set], and we will not be liable for indirect, incidental, or consequential damages.

## 14. Governing law

*[Placeholder. Proposed: the laws of Egypt, subject to lawyer confirmation and any required carve-outs for merchants in other jurisdictions; see Open Question 3.]*

## 15. Changes to these Terms

We may update these Terms as the product changes. We will update the "last updated" date below when we do, and will make reasonable efforts to notify merchants of material changes.

## 16. Contact

Grind CTRL, Egypt
Email: grindctrlnow@gmail.com

---

**Last updated:** [DATE, to be set on publish]
