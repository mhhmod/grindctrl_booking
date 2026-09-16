# Product-truth publication governance

`public-register.ts` is the source-level claim register. `case-study-governance.ts`
adds the stricter evidence contract for public metrics and customer case studies.

Publication is fail-closed. A metric needs a verified source reference, explicit
period and timezone, documented scope and exclusions, calculation definition,
positive sample, current publication approval, required customer permission, and
an independently publishable `metric` or `outcome` truth record. A case study
also needs every narrative section, at least one publishable measured outcome,
customer approval, and a publishable `case-study` truth record.

The checked-in `PUBLIC_CASE_STUDIES` collection is intentionally empty. Do not add
placeholder merchants, quotes, logos, or outcomes. Evidence records belong in an
approved private location; this repository stores only safe references and
publication decisions. Rendering code should consume `getPublishableCaseStudies`
so incomplete or revoked records produce no case-study card.
