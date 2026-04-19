# GRINDCTRL Support Widget

**Universal embeddable support widget for any website.**

Add a professional support layer to any website in minutes. Works on plain HTML, WordPress, Shopify, React, Next.js, Vue, Laravel, and any other platform.

---

## Quick Install

### 1. Get Your Embed Key

Sign up at [grindctrl.com](https://grindctrl.com) and create your first widget site. Copy your **Embed Key** from the dashboard.

### 2. Add to Your Site (Recommended Queue Pattern)

Paste this before `</body>` on every page:

```html
<script>
  window.GrindctrlSupport = window.GrindctrlSupport || [];
  window.GrindctrlSupport.push({
    embedKey: 'YOUR_EMBED_KEY',
    domain: window.location.hostname
  });
</script>
<script async src="https://cdn.grindctrl.com/grindctrl-support.js"></script>
```

**Why the queue pattern?** Your config can be declared immediately, even before the script loads. This prevents race conditions and works reliably with async script loading.

**That's it.** The widget loads asynchronously, never blocks your page, and works on any website.

### Alternative: Direct Init Pattern

If you prefer synchronous initialization:

```html
<script src="https://cdn.grindctrl.com/grindctrl-support.js"></script>
<script>
  GrindctrlSupport.init({
    embedKey: 'YOUR_EMBED_KEY',
    domain: window.location.hostname
  });
</script>
```

---

## Features

### Launcher
- Floating icon with optional label pill
- Customizable position (bottom-right, bottom-left, top-right, top-left)
- Custom icons or your own SVG
- Opens/closes with click
- Badge indicator for new messages

### Support Panel
- Clean, premium dark panel
- Quick intent buttons (customizable)
- Full conversation thread
- Text input with voice-ready layout
- Smooth open/close animations
- RTL-aware (works in Arabic, Hebrew, etc.)

### Quick Intents
- Configurable action buttons shown before first message
- Per-page intent sets (different intents on different pages)
- Actions: send message, escalate to human, open URL

### Contextual Behavior
- Page-aware greeting messages
- Per-page launcher label overrides
- Page-specific intent routing
- UTM and referral tracking

### Style Isolation
- Shadow DOM rendering — host site CSS cannot break the widget
- Widget CSS cannot break the host site
- Works correctly inside iframes, Webflow, etc.

### Branding
- Custom primary/accent colors during trial
- Custom brand name and logo during trial
- Custom launcher icon (your own SVG)
- Server-enforced branding — cannot be bypassed

### Analytics & Events
- Built-in session tracking
- `onEvent` callback for custom analytics
- All events available for n8n routing

### Security
- Domain whitelist — widget only works on verified domains
- Anonymous visitor IDs (no cookies required)
- User email/name capture option
- Tenant isolation via Supabase RLS

---

## Configuration

### Basic

```js
GrindctrlSupport.init({
  embedKey: 'YOUR_EMBED_KEY',     // Required
  domain: window.location.hostname, // Auto-detected
});
```

### Full Options

```js
GrindctrlSupport.init({
  // Required
  embedKey: 'YOUR_EMBED_KEY',
  domain: window.location.hostname,

  // Launcher
  launcherLabel: 'Support',           // Default: "Support"
  launcherIcon: 'chat',              // chat | help | support_agent | headset | pulse
  launcherPosition: 'bottom-right', // bottom-right | bottom-left | top-right | top-left
  launcherPillMode: true,           // Show label next to icon

  // Behavior
  supportMode: 'mixed',             // support | sales | operations | mixed
  greetingMessage: 'How can we help today?',
  showIntentButtons: true,
  persistentSessions: true,         // Remember returning visitors

  // Lead capture (new in v1.1)
  leadCaptureMode: 'off',           // off | before_first_message | after_intent | after_2_messages | after_3_messages
  leadCaptureFields: ['name', 'email'], // Fields to collect: name, email, phone, company
  leadCaptureTitle: null,           // Custom form title (null = default)
  leadCaptureSubtitle: null,        // Custom form subtitle
  leadCaptureSkippable: false,      // Allow user to skip the form

  // Identity (pass logged-in user data)
  userEmail: 'user@example.com',   // Pass from your auth system
  userName: 'Jane Smith',

  // Colors (override defaults)
  primaryColor: '#4F46E5',
  accentColor: '#6366F1',
  backgroundColor: '#0F0F0F',
  textColor: '#FAFAFA',

  // Custom branding (trial only)
  customBrandName: 'Acme Support',
  customLogoUrl: 'https://your-logo.png',
  customIconUrl: 'https://your-icon.svg',

  // Page labels (JSON — different labels per path)
  pageLabels: {
    '/': 'Support',
    '/pricing': 'Pricing Help',
    '/contact': 'Contact Us',
  },

  // Callbacks
  onReady: function(config) {
    console.log('Widget loaded', config);
  },
  onEvent: function(eventName, data) {
    analytics.track(eventName, data);
  },
  onConversationStart: function(data) {
    console.log('New conversation', data.conversation_id);
  },
  onMessageSent: function(data) {
    console.log('Message sent', data.content);
  },
  onError: function(error) {
    console.error('Widget error', error);
  }
});
```

---

## JavaScript API

After calling `init()`, access the widget instance:

```js
// Open the widget
GrindctrlSupport.open();

// Close the widget
GrindctrlSupport.close();

// Toggle open/close
GrindctrlSupport.toggle();

// Update config at runtime
GrindctrlSupport.updateConfig({
  greetingMessage: 'New greeting',
});

// Update visitor context (e.g., after login)
GrindctrlSupport.setContext({
  userEmail: 'new@example.com',
  userName: 'John Doe',
  pageUrl: '/new-page',
});

// Identify a logged-in user
GrindctrlSupport.identifyUser('john@example.com', 'John Doe');

// Track custom events
GrindctrlSupport.trackEvent('cta_clicked', {
  button: 'book_demo',
  page: '/homepage'
});

// Destroy the widget
GrindctrlSupport.destroy();

// Get version
GrindctrlSupport.getVersion(); // '1.0.0'
```

---

## Events

The `onEvent` callback receives these events:

| Event | When |
|-------|------|
| `widget_open` | Launcher clicked |
| `widget_close` | Panel closed |
| `conversation_start` | New visitor starts a session |
| `intent_click` | Quick intent button clicked |
| `message_sent` | User sends a message |
| `escalation_trigger` | User requests human escalation |
| `lead_captured` | Lead form submitted with valid data |
| `lead_capture_skipped` | User skipped the lead form |

---

## Lead Capture

Turn visitor conversations into structured leads with configurable intake forms.

### When to Show the Form

Configure when the lead capture form appears:

```js
leadCaptureMode: 'before_first_message'  // Gate chat until form is completed
leadCaptureMode: 'after_intent'          // Show after user clicks an intent
leadCaptureMode: 'after_2_messages'      // Show after 2 messages
leadCaptureMode: 'after_3_messages'      // Show after 3 messages
leadCaptureMode: 'off'                   // Disable lead capture
```

### Which Fields to Collect

Choose which fields appear on the form (in order):

```js
leadCaptureFields: ['name', 'email']                    // Minimal
leadCaptureFields: ['name', 'email', 'phone']           // Standard
leadCaptureFields: ['name', 'email', 'phone', 'company'] // Full business intake
```

### Customizing the Form

```js
GrindctrlSupport.init({
  embedKey: 'YOUR_EMBED_KEY',
  domain: window.location.hostname,
  leadCaptureMode: 'before_first_message',
  leadCaptureFields: ['name', 'email', 'company'],
  leadCaptureTitle: 'Get a personalized demo',
  leadCaptureSubtitle: 'Tell us about your business and we\'ll connect you with the right team.',
  leadCaptureSkippable: false,  // Set to true to allow skipping
});
```

### How Lead Data Flows

1. Visitor submits the form
2. Data is stored in the widget config (`userEmail`, `userName`, `userPhone`, `userCompany`)
3. Data is sent to the server with `startConversation()`
4. `lead_captured` event fires with `{ fields: ['name', 'email'] }`
5. Conversation continues normally

---

## Platform Examples

See [`integration-examples.html`](./integration-examples.html) for copy-paste ready snippets for:

- Plain HTML
- React / Next.js
- WordPress
- Vue
- Shopify
- Laravel / PHP
- Per-page configuration

---

## Domain Verification

Before going live, verify your domain in the dashboard:

1. Go to **Domains** in the GRINDCTRL dashboard
2. Add your domain (e.g., `yourdomain.com`)
3. Add the DNS TXT record shown
4. Wait for auto-verification (up to 24 hours)

The widget only loads on verified domains (plus `localhost` for development).

---

## White-Label & Branding

| Feature | Trial | Paid Plans |
|---------|-------|-------------|
| Custom brand name | ✅ | ✅ (Growth+) |
| Custom logo | ✅ | ✅ (Growth+) |
| Custom launcher icon | ✅ | ✅ (Growth+) |
| Custom colors | ✅ | ✅ (Growth+) |
| Hide attribution | ✅ | ❌ |
| White-label domain | Trial only | ✅ (Premium) |

When trial ends, "Powered by GRINDCTRL" attribution appears automatically. You cannot disable it without a paid plan.

---

## Support Modes

Configure per-site behavior:

- **Support** — Customer support focus (default)
- **Sales** — Lead capture and inquiry routing
- **Operations** — Exception/processing desk
- **Mixed** — Both support and sales intents

---

## Architecture

```
Your Website
  └── grindctrl-support.js (loaded from CDN)
        └── Shadow DOM
              ├── Launcher (fixed, floating)
              └── Support Panel (opens/closes)

GRINDCTRL Cloud
  ├── Edge Functions (config API, message API)
  ├── Supabase (multi-tenant data, RLS)
  └── n8n (future: AI routing, escalation, analytics)
```

---

## File Structure

```
grindctrl-support.js    — The embeddable widget (upload to CDN)
widget-admin.html       — Admin dashboard (host separately or embed)
integration-examples.html — Platform integration snippets
widget-n8n-contracts.md — n8n webhook payload specs
```

---

## CDN Deployment

Upload `grindctrl-support.js` to any CDN:

```bash
# Example: Upload to your own CDN
aws s3 cp grindctrl-support.js s3://your-cdn/grindctrl-support.js
# → https://your-cdn.com/grindctrl-support.js

# Or use Supabase Storage
```

Update the script src to match your CDN URL.

---

## Next Steps

1. Sign up at [grindctrl.com](https://grindctrl.com)
2. Create your first widget site
3. Copy the embed snippet
4. Paste into your website
5. Configure intents and branding in the dashboard
6. Connect n8n for AI routing (see [`widget-n8n-contracts.md`](./widget-n8n-contracts.md))
