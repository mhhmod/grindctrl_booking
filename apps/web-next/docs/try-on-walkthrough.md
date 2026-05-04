# Try-On Walkthrough

Date: 2026-05-04

Route: `/try-on`

## Local Run

1. From `apps/web-next`, run `npm run dev`.
2. Open `http://localhost:3000/try-on`.
3. Confirm the product panel renders with the Premium Ringer Tee.
4. Upload a customer photo.
5. Confirm the privacy/consent step appears.
6. Select `Generate Try-On Preview`.
7. Confirm the result state shows `Demo Preview` and the disclaimer says no real AI generation was performed.

## Screenshots

- Desktop upload state: `apps/web-next/docs/screenshots/try-on-desktop-upload.png`
- Desktop result state: `apps/web-next/docs/screenshots/try-on-desktop-result.png`
- Mobile upload state: `apps/web-next/docs/screenshots/try-on-mobile-upload.png`
- Mobile result state: `apps/web-next/docs/screenshots/try-on-mobile-result.png`

## Notes

- Mock mode returns `apps/web-next/public/try-on/mock-result.png`.
- The in-memory job store is MVP/mock-only and must be replaced with persistent storage before live provider use.
- `/api/try-on/generate` rejects `sessionId + productId` only; callers must send a customer photo reference or explicitly opt into the mock photo path.
