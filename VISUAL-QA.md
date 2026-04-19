# Visual QA Plan — Post-Polish Pass

Run `npm run dev` and check each item below across dark (default) and light themes.

## Viewports
| Label | Width | Notes |
|-------|-------|-------|
| Small phone | 390px | iPhone SE, small Android |
| Phone | 480px | Most phones |
| Tablet | 768px | iPad portrait |
| Desktop | 1280px | Laptop |
| Wide | 1536px | Full desktop |

---

## 1. Header / Nav (all pages)

- [ ] Logo + "GRINDCTRL" text vertically centered in header
- [ ] Nav links visible at 768px+, hidden below
- [ ] Active nav link has underline indicator matching current page
- [ ] Nav link hover: color shifts to `--gc-ink`
- [ ] Nav link focus (Tab key): visible outline ring
- [ ] Theme toggle button: 36px square, visible border, hover highlights
- [ ] Language toggle button: same sizing as theme toggle
- [ ] Hamburger button visible below 768px, hidden above
- [ ] Header doesn't overlap page content (body has correct top padding)

## 2. Mobile Drawer (below 768px)

- [ ] Hamburger opens Shoelace drawer from right
- [ ] Drawer has header with logo + "GRINDCTRL"
- [ ] All 4 nav links visible with icons
- [ ] Active link has left border accent + background highlight
- [ ] Non-active links have transparent left border
- [ ] Hover on links: background highlight
- [ ] "Start Free Trial" CTA at bottom, full-width
- [ ] Clicking a link navigates and closes drawer
- [ ] Clicking overlay closes drawer
- [ ] Escape key closes drawer
- [ ] RTL: drawer opens from left, border accent on right

## 3. Live Demo Page (home)

- [ ] Exception Desk workspace fills viewport height
- [ ] Header row: title + status badge + "New" button on one line (desktop)
- [ ] Header wraps cleanly on mobile
- [ ] Split view: stacked on mobile, side-by-side at 1024px+
- [ ] Drop zone: centered content, visible border
- [ ] "Try Demo" button works and populates source panel
- [ ] Resolution panel shows ghost skeleton, then real content after demo
- [ ] Approval bar: 4 buttons in a row on desktop, wraps on mobile
- [ ] Progression bar: horizontal steps, dots highlight active

## 4. How It Works Page (#solutions)

- [ ] Hero section: badge + h1 + description left-aligned
- [ ] 3-step cards: stacked on mobile, 3-col grid at 768px+
- [ ] Cards have hover: border changes, slight lift
- [ ] Card focus: visible outline on keyboard navigation
- [ ] "What It Catches" grid: 1-col mobile, 2-col tablet, 4-col desktop
- [ ] Integration pills: horizontal scroll on mobile, wrapping on desktop
- [ ] CTA section: centered card with two buttons
- [ ] Primary CTA has visible focus ring on Tab

## 5. Book a Call Page (#book)

- [ ] Hero: centered text with badge
- [ ] Scheduling grid: stacked on mobile, side-by-side at 1024px
- [ ] Preparation card: left column with social proof
- [ ] Calendar: 7-column grid, cells have hover highlight
- [ ] Calendar cells: 44px min on mobile (touch target)
- [ ] Selected date cell: filled with primary color, slight scale
- [ ] Weekend cells: dimmed (secondary/20)
- [ ] Time slot buttons: 3-col grid, selected slot highlighted
- [ ] "Schedule Diagnostic Call" CTA: full-width, prominent
- [ ] Reassurance row: stacked on mobile, 3-col at 640px+

## 6. Install Widget Page (#install)

- [ ] Hero: badge + h1 + description
- [ ] Code snippet card: header with copy button, monospace code
- [ ] Copy button: click shows "Copied!" feedback, reverts after 2s
- [ ] Phone mockup: centered, correct height (640px)
- [ ] Launcher button in mockup: hover scale, opens panel
- [ ] Mockup panel: smooth open animation, messages visible
- [ ] Feature bullets: icon + title + description, consistent spacing
- [ ] White-label section: 2-col layout, image left on desktop
- [ ] Plan tiers: 1-col mobile, 2-col tablet, 4-col desktop
- [ ] "Popular" badge on Growth tier: centered, pill shape
- [ ] Plan CTAs: consistent styling, focus ring on Tab

## 7. Footer (all pages)

- [ ] 4-col grid: 2-col mobile, 4-col at 768px+
- [ ] Logo + description in first column
- [ ] Footer links: dot indicator on hover
- [ ] Link touch targets: 44px min on mobile
- [ ] Newsletter input + button: stacked on mobile
- [ ] Status bar at bottom: centered pill
- [ ] Light theme: footer uses `--gc-canvas-deep` background

## 8. Theme Switching

- [ ] Toggle from dark → light: all colors update
- [ ] Toggle from light → dark: all colors update
- [ ] Logo swaps: dark logo on dark theme, light logo on light theme
- [ ] Nav border: light theme has subtle bottom border
- [ ] Footer background: different shade in light vs dark
- [ ] Input/textarea backgrounds: white in light theme
- [ ] State persists after page reload (localStorage)

## 9. RTL / Arabic

- [ ] Toggle language to Arabic: `dir="rtl"` on html
- [ ] Header layout mirrors correctly
- [ ] Nav links align right
- [ ] Drawer opens from left
- [ ] Drawer link accent on right side
- [ ] Body uses Arabic font (IBM Plex Sans Arabic)
- [ ] Text alignment flips
- [ ] Icons with `data-i18n-icon` flip horizontally

## 10. Focus & Keyboard Navigation

- [ ] Tab through header: visible focus ring on each element
- [ ] Tab through drawer links: focus visible
- [ ] Tab through CTA buttons: focus ring visible
- [ ] Tab through calendar cells: focus highlight
- [ ] Tab through plan tier CTAs: focus ring
- [ ] Tab through footer links: focus indicator
- [ ] Enter/Space activates buttons and links
- [ ] Escape closes drawer

## 11. Loading & Empty States

- [ ] Page loads without FOUC (flash of unstyled content)
- [ ] Scroll reveal: elements fade in on scroll
- [ ] Exception Desk: ghost skeleton visible before data loads
- [ ] Mockup: greeting message + intent buttons visible on open
- [ ] Mockup: typing indicator appears after sending message

## 12. Reduced Motion

- [ ] `prefers-reduced-motion: reduce` disables animations
- [ ] Scroll reveal elements appear instantly
- [ ] Page transitions are instant
- [ ] Drawer opens/closes instantly
