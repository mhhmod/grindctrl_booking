# GrindCTRL Reviewer Trial Script (Prompt 15)

## Goal

Validate full customer journey from landing preview to implementation request, while confirming preview-only safety boundaries.

## Test matrix

### Devices

- 390px mobile
- 768px tablet
- 1440px desktop

### Themes

- Dark
- Light

### Auth states

- Logged out landing
- Sign up
- Sign in
- Direct dashboard visit

### API/runtime conditions

- Mock sandbox mode
- Live sandbox mode (if env available)
- n8n down fallback

## End-to-end reviewer path

1. Open landing page.
2. Confirm positioning describes AI implementation and operations platform.
3. Run guided preview (workflow, voice, or file).
4. Verify structured result is shown and trial CTA appears.
5. Click "Start 14-day trial".
6. Complete sign-up or sign-in.
7. Confirm dashboard opens at `/dashboard/overview`.
8. Confirm saved preview handoff appears (or empty-state prompt if none).
9. Open `/dashboard/agents` and inspect agent cards/detail.
10. Open `/dashboard/conversations` and `/dashboard/messages`.
11. Open `/dashboard/leads` and `/dashboard/crm`.
12. Open `/dashboard/install` and verify snippet + copy action.
13. Open `/dashboard/integrations` and test category filter + connection CTA.
14. Open `/dashboard/analytics` and verify funnel/ops/channel sections.
15. Open `/dashboard/implementation` and submit valid form.

## Expected value per section

- Landing: clear business value and guided workflow entry.
- Preview: structured routing/action output, not generic chat text.
- Dashboard overview: trial status + saved preview continuity.
- Agents: channel-specific operational scope visibility.
- Conversations/messages: unified queue concept + handoff readiness.
- Leads/CRM: qualification and pipeline progression concept.
- Install: practical embed snippet and setup sequence.
- Integrations: ecosystem coverage and implementation-based activation.
- Analytics: funnel/operations/channel measurement model.
- Implementation request: clear next-step handoff path.

## Preview-only caveats (must remain true)

- No CRM/Sheets/email/social sends are executed from preview pages.
- Implementation form shows local success only (no send claim).
- Workflow history is local unless persistence is enabled.
- Integration CTAs route to request flow; no direct OAuth in this phase.

## Security checks

1. No n8n URL/token exposed in browser UI.
2. No Supabase service-role or private secrets in client bundle.
3. Widget snippet uses placeholder key in docs/UI.
4. No claim of real external action completion in preview mode.

## Known local caveats

- Clerk local env misconfiguration may block auth routes.
- Recharts in test environment can log width warnings (non-blocking).
- Live sandbox behavior depends on env + backend availability.

## Validation commands

From `apps/web-next`:

```bash
npm run lint
npm run test
npm run build
```

## Next roadmap after review

1. Implement Supabase persistence routes and RLS tables.
2. Wire implementation requests to API + n8n notifications.
3. Connect conversation/lead live read contracts and guarded write actions.
4. Add automated responsive + RTL QA run.
