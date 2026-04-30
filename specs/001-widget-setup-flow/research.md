# Research: Widget Setup Flow

**Feature**: Widget Setup Flow  
**Date**: 2026-04-21  
**Source**: `/speckit.clarify` session + codebase analysis

## Decision: Domain Verification Mechanism

**Decision**: Manual administrative approval in the dashboard (workspace owner/admin clicks "Verify" or "Reject").

**Rationale**:
- Simplest MVP implementation — no DNS polling infrastructure, no edge functions, no cron jobs
- Matches the existing assumption in the spec
- Aligns with the small-business target audience who may not have DNS access
- Can be upgraded to automated DNS verification in a future iteration

**Alternatives considered**:
- Automated DNS TXT record validation: Requires edge function + polling logic; overkill for MVP
- Self-verification via meta tag: More complex UX; requires user to edit HTML before domain is approved

## Decision: Configuration Storage Model

**Decision**: JSONB columns on `widget_sites` for config/branding/lead capture; separate tables for intents and leads.

**Rationale**:
- JSONB aligns with Supabase's strengths and keeps schema migrations simple
- Configuration data is read as a bundle (no need to query individual columns)
- Separate tables justified for intents (many per site, needs ordering) and leads (many per site, needs filtering/reporting)
- Avoids wide table with 15+ columns that are rarely queried independently

**Alternatives considered**:
- Separate columns on `widget_sites`: Creates very wide table; harder to extend
- Separate tables for everything: Over-normalized; adds unnecessary JOIN complexity for simple config reads

## Decision: Workspace Limits

**Decision**: No hard limits in MVP.

**Rationale**:
- Prevents premature optimization
- Allows product-market-fit testing without artificial barriers
- Hard limits will be introduced with pricing tiers once usage patterns are understood
- UI should gracefully handle large lists (basic scrollable containers)

**Alternatives considered**:
- 10 sites / 20 domains / 20 intents / 10K leads: Reasonable but arbitrary; may block legitimate use cases

## Decision: Lead Capture Timing Modes

**Decision**: 5 configurable modes per widget site.

**Rationale**:
- Gives business owners full control over visitor experience
- Covers all common patterns: pre-chat gate (required/skippable), inline during chat, post-chat, or disabled
- "Before skippable" is the industry standard and recommended default

**Alternatives considered**:
- Single hardcoded mode: Too restrictive; different businesses have different needs
- Only 2 modes (before/after): Doesn't cover the "during conversation" use case

## Decision: Lead Form Deduplication

**Decision**: Remember per browser session only (sessionStorage).

**Rationale**:
- Balances UX (no repeated forms in same session) with business needs (re-prompt on return visits)
- Simple implementation; no server-side tracking needed
- Per-session is the standard for lead capture widgets

**Alternatives considered**:
- Never remember: Annoying for visitors who navigate away and return
- Remember permanently (localStorage): May miss legitimate re-engagement opportunities
- Remember for 30 days: More complex; no clear business need in MVP
