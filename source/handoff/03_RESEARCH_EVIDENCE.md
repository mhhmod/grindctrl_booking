# Research and evidence boundaries — Concrete Calls / Segments

## Source-backed facts

1. Concrete Icons Club officially names its tiers `LIFESTYLE`, `PRESTIGE`, and `ELITE`, here: https://concrete.store/iconclubinfo/ . This validates the **names of the segments**, NOT the field location or API/permissions of Concrete's tenant.
2. Genesys Cloud supports per-interaction notes entered by agents during an interaction or after-call work (ACW): https://help.genesys.cloud/articles/enter-notes-for-an-interaction/ . This is different from contact-profile notes.
3. Genesys external contact interaction history can show linked phone interactions with their corresponding notes, subject to license, permissions, association, visibility and retention: https://help.genesys.cloud/articles/view-interaction-history-contact/ . Historical association and coverage must be verified.
4. Zoho Desk supports a `Calls` module with owner, direction, time, duration, contact, related ticket, and description, and a contacts area with activity history: https://help.zoho.com/portal/en/kb/desk/customization/modules/articles/standard-modules-and-fields-zoho-desk and https://help.zoho.com/portal/en/kb/desk/contacts-and-accounts/articles/customer-module-the-contacts-and-accounts-detail-page . This does NOT mean Genesys calls are synchronized into Zoho Desk at Concrete.
5. Zoho Desk supports custom contact and activity fields, with edition and permission constraints: https://help.zoho.com/portal/en/kb/desk/customization/layouts-and-fields/articles/working-with-custom-fields . This does NOT prove a populated `Segment` field.
6. Genesys external contact history limitations can apply; verify actual plan/retention and do not claim *all calls ever*: https://help.mypurecloud.com/articles/limit-interaction-history-for-external-contacts-and-organization-to-365-days/
7. Concrete retail website (real brand design reference): https://concrete.store/ . Use only appropriate, licensed assets, and retain product/UI truthfulness.

## Verify within Concrete's environment before production claims

- Current Genesys edition, agent desktop, screen-pop implementation, roles, External Contacts linking, interaction notes and accessible history.
- If notes are actually entered within Genesys Interactions panel, Zoho Desk Call Description, a custom agent app, or multiple places.
- Whether previously logged calls are linked to the same customer identity; handling of shared phones and unlinked/anonymous calls.
- Source-of-truth for Icons Club segment (Retail Pro / loyalty service / Zoho custom field / other); mapping, currency/freshness and permission. Do NOT pull membership from public tier thresholds alone.
- Source-of-truth for name/mobile/email, missing values, consent, access controls.
- Whether notes are saved automatically, when they become visible, to whom, and whether call/record associations survive transfer/after-call work.
- Whether caller history is visible only within a set date range, which may vary by product and interface.
- What exact screen layout employees see; prefer authorized redacted screenshots over conceptual approximations.

## Scope discipline

- Video 03 is about caller profile and **per-call interaction history + agent notes**, not ticket history (the focus of Parts 01/02).
- Keep loyalty segment contextual; do not assert Elite calls are auto-prioritized or routed differently.
- Do not invent automatic call recordings, transcripts, sentiment, AI-generated notes, purchase history, benefits eligibility or CRM upgrades.
- Present future data movement as **proposed and contingent**, not live.
- Redact PII; all sample names/emails/phone numbers must be synthetic and clearly marked.
