/**
 * GRINDCTRL Embeddable Support Widget
 * Version: 1.0.0
 *
 * Universal embeddable support widget using Shadow DOM for style isolation.
 * Works on any website: plain HTML, WordPress, Shopify, React, Vue, Laravel, etc.
 *
 * Install:
 *   <script src="https://cdn.grindctrl.com/grindctrl-support.js"></script>
 *   <script>
 *     GrindctrlSupport.init({
 *       embedKey: 'YOUR_EMBED_KEY',
 *       domain: window.location.hostname,
 *       // optional config overrides
 *     });
 *   </script>
 */
(function (window) {
  'use strict';

  var VERSION = '1.0.0';

  // ─────────────────────────────────────────────────────────────
  // CONFIG DEFAULTS
  // ─────────────────────────────────────────────────────────────
  var DEFAULT_CONFIG = {
    embedKey: null,         // Required: your public embed key
    domain: null,           // Required: hostname to bind to
    apiBase: 'https://egvdxshlbcqndrcnzcdn.supabase.co', // Supabase project
    apiKey: '', // Supabase anon key (public)

    // Optional overrides (from widget config, not user-overridable)
    launcherPosition: 'bottom-right',
    launcherLabel: 'Support',
    launcherIcon: 'chat',
    launcherPillMode: true,
    defaultOpen: false,
    supportMode: 'mixed',
    greetingMessage: null,
    showIntentButtons: true,
    persistentSessions: true,
    captureEmailOnFirst: true,
    captureNameOnFirst: false,

    // Lead capture settings
    leadCaptureMode: 'off',           // 'off' | 'before_first_message' | 'after_intent' | 'after_2_messages' | 'after_3_messages'
    leadCaptureFields: ['name', 'email'], // ['name', 'email', 'phone', 'company'] — order matters
    leadCaptureTitle: null,           // custom heading (null = i18n default)
    leadCaptureSubtitle: null,        // custom subtitle (null = i18n default)
    leadCaptureSkippable: false,      // allow skipping the form

    // Visual (can be overridden by client if white-label allows)
    primaryColor: '#4F46E5',
    accentColor: '#6366F1',
    backgroundColor: '#0F0F0F',
    textColor: '#FAFAFA',
    customBrandName: null,
    customLogoUrl: null,
    customIconUrl: null,

    // Branding enforcement (from server, read-only)
    attributionMode: 'white_label',
    showPoweredBy: false,
    whiteLabelAllowed: true,
    trialDaysRemaining: 15,
    trialExpired: false,

    // Intents (from server)
    intents: [],

    // Page context
    pageLabels: {},

    // User identification (set via identifyUser())
    userEmail: null,
    userName: null,

    // Callbacks
    onEvent: null,          // function(eventName, data)
    onReady: null,           // function()
    onError: null,           // function(error)
    onConversationStart: null,
    onMessageSent: null,

    // Internal
    _loaded: false,
    _config: null,
  };

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────
  var state = {
    phase: 'idle',           // idle | loading | ready | open | minimized | error
    config: null,
    conversationId: null,
    visitorId: null,
    anonymousId: null,
    messages: [],
    currentPage: window.location.pathname,
    typingTimeout: null,
    sessionStorageId: 'gc_ws',
    localStorageId: 'gc_visitor',
    // Initialization tracking
    _initialized: false,
    // Lead capture tracking
    _leadCaptured: false,
    _messageCount: 0,
    _leadCaptureActive: false,
  };

  // ─────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────
  function uid() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, function () {
      return Math.floor(Math.random() * 16).toString(16);
    });
  }

  function getVisitorId() {
    try {
      var stored = localStorage.getItem(state.localStorageId);
      if (stored) return stored;
      var id = uid();
      localStorage.setItem(state.localStorageId, id);
      return id;
    } catch (e) {
      return uid();
    }
  }

  function getSessionId() {
    try {
      return sessionStorage.getItem(state.sessionStorageId);
    } catch (e) {
      return null;
    }
  }

  function setSessionId(id) {
    try { sessionStorage.setItem(state.sessionStorageId, id); } catch (e) {}
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function currentLang() {
    var lang = document.documentElement.getAttribute('lang');
    return lang && lang.toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  function t(key) {
    var dict = {
      en: {
        greeting_default: 'How can we help you today?',
        placeholder: 'Type your message…',
        send: 'Send',
        close: 'Close',
        minimize: 'Minimize',
        powered_by: 'Powered by GRINDCTRL',
        trial_ended: 'Trial ended. Some features may be limited.',
        email_placeholder: 'Your email',
        name_placeholder: 'Your name',
        email_required: 'Email is required',
        sending: 'Sending…',
        error: 'Something went wrong. Please try again.',
        rate_limit: 'Please wait a moment.',
        book_meeting: 'Book a Meeting',
        request_white_label: 'Request White-Label',
        talk_to_sales: 'Talk to Sales',
        welcome_back: 'Welcome back',
        // Lead capture
        lead_capture_title: 'Before we start',
        lead_capture_subtitle: 'Tell us a bit about yourself',
        lead_capture_name: 'Full name',
        lead_capture_email: 'Work email',
        lead_capture_phone: 'Phone number',
        lead_capture_company: 'Company name',
        lead_capture_submit: 'Start chatting',
        lead_capture_skip: 'Skip for now',
        lead_capture_name_error: 'Please enter your name',
        lead_capture_email_error: 'Please enter a valid email',
        lead_capture_phone_error: 'Please enter a valid phone number',
        lead_capture_company_error: 'Please enter your company name',
      },
      ar: {
        greeting_default: 'كيف يمكننا مساعدتك اليوم؟',
        placeholder: 'اكتب رسالتك…',
        send: 'إرسال',
        close: 'إغلاق',
        minimize: 'تصغير',
        powered_by: 'مدعوم من GRINDCTRL',
        trial_ended: 'انتهت الفترة التجريبية. قد تكون بعض الميزات محدودة.',
        email_placeholder: 'بريدك الإلكتروني',
        name_placeholder: 'اسمك',
        email_required: 'البريد الإلكتروني مطلوب',
        sending: 'جارٍ الإرسال…',
        error: 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
        rate_limit: 'يرجى الانتظار قليلاً.',
        book_meeting: 'احجز اجتماعاً',
        request_white_label: 'طلب علامة بيضاء',
        talk_to_sales: 'تحدث مع المبيعات',
        welcome_back: 'مرحباً بعودتك',
        // Lead capture
        lead_capture_title: 'قبل البدء',
        lead_capture_subtitle: 'عرّفنا بنفسك قليلاً',
        lead_capture_name: 'الاسم الكامل',
        lead_capture_email: 'البريد الإلكتروني',
        lead_capture_phone: 'رقم الهاتف',
        lead_capture_company: 'اسم الشركة',
        lead_capture_submit: 'ابدأ المحادثة',
        lead_capture_skip: 'تخطي الآن',
        lead_capture_name_error: 'يرجى إدخال اسمك',
        lead_capture_email_error: 'يرجى إدخال بريد إلكتروني صحيح',
        lead_capture_phone_error: 'يرجى إدخال رقم هاتف صحيح',
        lead_capture_company_error: 'يرجى إدخال اسم الشركة',
      }
    };
    var lang = currentLang();
    return (dict[lang] && dict[lang][key]) || dict.en[key] || key;
  }

  // ─────────────────────────────────────────────────────────────
  // API LAYER
  // ─────────────────────────────────────────────────────────────
  function apiFetch(path, options) {
    var base = state.config.apiBase || DEFAULT_CONFIG.apiBase;
    return fetch(base + '/rest/v1/' + path, options);
  }

  function edgeFetch(fn, payload) {
    var base = state.config.apiBase || DEFAULT_CONFIG.apiBase;
    return fetch(base + '/functions/v1/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async function loadConfig() {
    var cfg = state.config;
    // Query widget_sites directly with related data
    var res = await fetch(
      cfg.apiBase + '/rest/v1/widget_sites?embed_key=eq.' + encodeURIComponent(cfg.embedKey) +
      '&select=*,widget_domains(domain,verification_status),widget_intents(label,icon,action_type,message_text,external_url,sort_order)',
      { headers: { 'Content-Type': 'application/json', 'apikey': cfg.apiKey || '' } }
    );

    if (!res.ok) {
      throw new Error('Invalid embed key or domain not verified.');
    }

    var rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Embed key not found.');
    }

    var data = rows[0];

    // Domain validation
    var hostname = window.location.hostname;
    var isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isLocalhost && data.widget_domains) {
      var verifiedDomains = data.widget_domains.filter(function (d) {
        return d.verification_status === 'verified';
      });
      var isAllowed = verifiedDomains.some(function (d) {
        return d.domain === hostname || hostname.endsWith('.' + d.domain);
      });
      if (!isAllowed) {
        console.warn('[GrindctrlSupport] Domain not verified: ' + hostname);
        throw new Error('Domain not verified for this embed key.');
      }
    }

    var configJson = data.config_json || {};
    var brandingJson = data.branding_json || {};
    var leadCaptureJson = data.lead_capture_json || {};

    return Object.assign({}, cfg, {
      _config: data,
      launcherPosition: configJson.launcher_position || cfg.launcherPosition,
      launcherLabel: configJson.launcher_label || cfg.launcherLabel,
      launcherIcon: configJson.launcher_icon || cfg.launcherIcon,
      launcherPillMode: configJson.launcher_pill_mode !== undefined ? configJson.launcher_pill_mode : cfg.launcherPillMode,
      defaultOpen: configJson.default_open || false,
      supportMode: configJson.support_mode || 'mixed',
      greetingMessage: configJson.greeting_message || null,
      showIntentButtons: configJson.show_intent_buttons !== undefined ? configJson.show_intent_buttons : true,
      persistentSessions: configJson.persistent_sessions !== undefined ? configJson.persistent_sessions : true,
      activeState: configJson.active_state !== undefined ? configJson.active_state : true,
      primaryColor: brandingJson.primary_color || cfg.primaryColor,
      accentColor: brandingJson.accent_color || cfg.accentColor,
      backgroundColor: brandingJson.background_color || cfg.backgroundColor,
      textColor: brandingJson.text_color || cfg.textColor,
      customBrandName: brandingJson.brand_name || null,
      customLogoUrl: brandingJson.logo_url || null,
      customIconUrl: brandingJson.icon_url || null,
      attributionMode: configJson.attribution_mode || 'grindctrl_powered',
      showPoweredBy: configJson.show_powered_by || false,
      whiteLabelAllowed: configJson.white_label_allowed || false,
      trialDaysRemaining: configJson.trial_days_remaining || 0,
      trialExpired: configJson.trial_expired || false,
      intents: data.widget_intents || [],
      pageLabels: configJson.page_labels || {},
      // Lead capture from new JSONB
      leadCaptureMode: leadCaptureJson.timing_mode || 'disabled',
      leadCaptureFields: leadCaptureJson.fields_enabled || ['name', 'email'],
      leadCaptureTitle: leadCaptureJson.prompt_text ? null : null,
      leadCaptureSubtitle: leadCaptureJson.prompt_text || null,
      leadCaptureSkippable: leadCaptureJson.timing_mode === 'before_skippable',
      leadCaptureEnabled: leadCaptureJson.enabled === true,
      // Store IDs for lead submission
      widgetSiteId: data.id,
      workspaceId: data.workspace_id,
    });
  }

  async function startConversation() {
    var cfg = state.config;
    var visitorId = getVisitorId();
    var res = await edgeFetch('widget-conversation', {
      embed_key: cfg.embedKey,
      domain: cfg.domain,
      anonymous_id: visitorId,
      email: cfg.userEmail || null,
      name: cfg.userName || null,
      page_url: window.location.href,
      page_title: document.title || '',
      support_mode: cfg.supportMode || 'support',
    });

    if (!res.ok) {
      var err = await res.json();
      if (err.error === 'usage_limit_exceeded') {
        throw new Error('rate_limit');
      }
      throw new Error(err.error || 'conversation_error');
    }

    var data = await res.json();
    state.conversationId = data.conversation_id;
    state.visitorId = data.visitor_id;
    setSessionId(data.conversation_id);
    return data;
  }

  async function sendMessage(content, intentLabel) {
    var cfg = state.config;
    var convId = state.conversationId || getSessionId();
    if (!convId) {
      await startConversation();
      convId = state.conversationId;
    }

    var res = await edgeFetch('widget-message', {
      embed_key: cfg.embedKey,
      domain: cfg.domain,
      conversation_id: convId,
      role: 'user',
      content: content,
      intent_label: intentLabel || null,
    });

    if (!res.ok) {
      var err = await res.json();
      if (err.error === 'usage_limit_exceeded') {
        throw new Error('rate_limit');
      }
      throw new Error(err.error || 'send_error');
    }

    return await res.json();
  }

  // ─────────────────────────────────────────────────────────────
  // SHADOW DOM STYLES
  // ─────────────────────────────────────────────────────────────
  function buildStyles(cfg) {
    var primary = cfg.primaryColor || '#4F46E5';
    var accent = cfg.accentColor || '#6366F1';
    var bg = cfg.backgroundColor || '#0F0F0F';
    var text = cfg.textColor || '#FAFAFA';
    var isRtl = currentLang() === 'ar';

    return [
      ':host {',
      '  all: initial;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  --gc-primary: ' + primary + ';',
      '  --gc-accent: ' + accent + ';',
      '  --gc-bg: ' + bg + ';',
      '  --gc-text: ' + text + ';',
      '  --gc-radius: 16px;',
      '  --gc-shadow: 0 24px 64px -12px rgba(0,0,0,0.5);',
      '  position: fixed;',
      '  z-index: 2147483647;',
      isRtl ? '  left: 20px;' : '  right: 20px;',
      '  bottom: 20px;',
      '  display: block;',
      '  box-sizing: border-box;',
      '}',
      '.gc-launcher {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  cursor: pointer;',
      '  border: none;',
      '  background: var(--gc-primary);',
      '  color: #fff;',
      '  border-radius: 28px;',
      '  padding: 12px 20px;',
      '  box-shadow: var(--gc-shadow);',
      '  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);',
      '  font-size: 14px;',
      '  font-weight: 600;',
      '  letter-spacing: -0.01em;',
      '  white-space: nowrap;',
      '  position: relative;',
      '}',
      '.gc-launcher:hover {',
      '  transform: translateY(-2px) scale(1.02);',
      '  box-shadow: 0 32px 80px -12px rgba(0,0,0,0.6);',
      '}',
      '.gc-launcher.open {',
      '  border-radius: 20px;',
      '  padding: 12px;',
      '}',
      '.gc-launcher-icon {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 32px;',
      '  height: 32px;',
      '  flex-shrink: 0;',
      '}',
      '.gc-launcher-icon span {',
      '  font-family: "Material Symbols Outlined", sans-serif;',
      '  font-size: 22px;',
      '  font-variation-settings: "FILL" 1;',
      '}',
      '.gc-launcher-label {',
      '  max-width: 120px;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      '.gc-launcher-badge {',
      '  position: absolute;',
      '  top: -4px;',
      isRtl ? '  left: -4px;' : '  right: -4px;',
      '  width: 12px;',
      '  height: 12px;',
      '  background: #ef4444;',
      '  border-radius: 50%;',
      '  border: 2px solid white;',
      '}',
      '/* Panel */',
      '.gc-panel {',
      '  position: absolute;',
      '  bottom: 70px;',
      isRtl ? '  left: 0;' : '  right: 0;',
      '  width: min(380px, calc(100vw - 24px));',
      '  max-height: min(600px, calc(100dvh - 96px - env(safe-area-inset-bottom)));',
      '  background: var(--gc-bg);',
      '  border: 1px solid rgba(255,255,255,0.08);',
      '  border-radius: var(--gc-radius);',
      '  box-shadow: var(--gc-shadow);',
      '  display: flex;',
      '  flex-direction: column;',
      '  overflow: hidden;',
      '  opacity: 0;',
      '  transform: translateY(20px) scale(0.96);',
      '  pointer-events: none;',
      '  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);',
      '  transform-origin: ' + (isRtl ? 'left bottom' : 'right bottom') + ';',
      '}',
      '.gc-panel.open {',
      '  opacity: 1;',
      '  transform: translateY(0) scale(1);',
      '  pointer-events: all;',
      '}',
      '/* Header */',
      '.gc-header {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 12px;',
      '  padding: 16px 20px;',
      '  border-bottom: 1px solid rgba(255,255,255,0.06);',
      '  background: rgba(255,255,255,0.02);',
      '}',
      '.gc-header-brand {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  flex: 1;',
      '  min-width: 0;',
      '}',
      '.gc-header-logo {',
      '  width: 32px;',
      '  height: 32px;',
      '  border-radius: 8px;',
      '  background: var(--gc-primary);',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  flex-shrink: 0;',
      '  overflow: hidden;',
      '}',
      '.gc-header-logo img { width: 100%; height: 100%; object-fit: contain; }',
      '.gc-header-logo span { font-size: 18px; }',
      '.gc-header-name {',
      '  font-size: 13px;',
      '  font-weight: 700;',
      '  color: var(--gc-text);',
      '  letter-spacing: -0.02em;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.gc-header-subtitle {',
      '  font-size: 11px;',
      '  color: rgba(250,250,250,0.4);',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.gc-header-actions {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '}',
      '.gc-header-btn {',
      '  width: 32px;',
      '  height: 32px;',
      '  border: none;',
      '  background: transparent;',
      '  color: rgba(250,250,250,0.5);',
      '  border-radius: 8px;',
      '  cursor: pointer;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  transition: all 0.2s;',
      '}',
      '.gc-header-btn:hover {',
      '  background: rgba(255,255,255,0.06);',
      '  color: var(--gc-text);',
      '}',
      '.gc-header-btn span { font-size: 18px; }',
      '/* Intents */',
      '.gc-intents {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 8px;',
      '  padding: 14px 16px;',
      '  border-bottom: 1px solid rgba(255,255,255,0.05);',
      '  min-inline-size: 0;',
      '}',
      '.gc-intent {',
      '  appearance: none;',
      '  border: 1px solid rgba(255,255,255,0.1);',
      '  border-radius: 12px;',
      '  padding: 8px 14px;',
      '  background: rgba(255,255,255,0.04);',
      '  color: rgba(250,250,250,0.7);',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 5px;',
      '  white-space: normal;',
      '  text-wrap: balance;',
      '  max-inline-size: 100%;',
      '}',
      '.gc-intent:hover {',
      '  background: rgba(255,255,255,0.08);',
      '  color: var(--gc-text);',
      '  border-color: rgba(255,255,255,0.15);',
      '  transform: translateY(-1px);',
      '}',
      '.gc-intent span { font-size: 14px; }',
      '/* Messages */',
      '.gc-messages {',
      '  flex: 1;',
      '  overflow-y: auto;',
      '  padding: 16px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 12px;',
      '  min-height: 0;',
      '  scroll-behavior: smooth;',
      '}',
      '.gc-messages::-webkit-scrollbar { width: 4px; }',
      '.gc-messages::-webkit-scrollbar-track { background: transparent; }',
      '.gc-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }',
      '.gc-msg {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 4px;',
      '  animation: gc-fadeIn 0.3s ease;',
      '}',
      '.gc-msg-ai { align-items: flex-start; }',
      '.gc-msg-user { align-items: flex-end; }',
      '.gc-msg-bubble {',
      '  max-width: 85%;',
      '  padding: 10px 14px;',
      '  border-radius: 14px;',
      '  font-size: 13px;',
      '  line-height: 1.5;',
      '  word-break: break-word;',
      '}',
      '.gc-msg-ai .gc-msg-bubble {',
      '  background: rgba(255,255,255,0.06);',
      '  color: var(--gc-text);',
      '  border-bottom-' + (isRtl ? 'right' : 'left') + 'radius: 4px;',
      '}',
      '.gc-msg-user .gc-msg-bubble {',
      '  background: var(--gc-primary);',
      '  color: #fff;',
      '  border-bottom-' + (isRtl ? 'left' : 'right') + 'radius: 4px;',
      '}',
      '.gc-msg-time {',
      '  font-size: 10px;',
      '  color: rgba(250,250,250,0.25);',
      '  padding: 0 4px;',
      '}',
      '/* Typing indicator */',
      '.gc-typing {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '  padding: 8px 0;',
      '}',
      '.gc-typing-dot {',
      '  width: 6px;',
      '  height: 6px;',
      '  border-radius: 50%;',
      '  background: rgba(250,250,250,0.3);',
      '  animation: gc-typing 1.4s infinite;',
      '}',
      '.gc-typing-dot:nth-child(2) { animation-delay: 0.2s; }',
      '.gc-typing-dot:nth-child(3) { animation-delay: 0.4s; }',
      '@keyframes gc-typing {',
      '  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }',
      '  30% { transform: translateY(-4px); opacity: 1; }',
      '}',
      '@keyframes gc-fadeIn {',
      '  from { opacity: 0; transform: translateY(8px); }',
      '  to { opacity: 1; transform: translateY(0); }',
      '}',
      '/* Greeting */',
      '.gc-greeting {',
      '  text-align: center;',
      '  padding: 20px 16px;',
      '  border-bottom: 1px solid rgba(255,255,255,0.05);',
      '}',
      '.gc-greeting-title {',
      '  font-size: 15px;',
      '  font-weight: 700;',
      '  color: var(--gc-text);',
      '  margin-bottom: 4px;',
      '  letter-spacing: -0.02em;',
      '}',
      '.gc-greeting-desc {',
      '  font-size: 12px;',
      '  color: rgba(250,250,250,0.45);',
      '  line-height: 1.5;',
      '}',
      '/* Input */',
      '.gc-input-area {',
      '  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));',
      '  border-top: 1px solid rgba(255,255,255,0.06);',
      '  background: rgba(255,255,255,0.02);',
      '}',
      '.gc-input-row {',
      '  display: grid;',
      '  grid-template-columns: minmax(0, 1fr) 42px;',
      '  align-items: end;',
      '  gap: 8px;',
      '  min-inline-size: 0;',
      '  overflow: clip;',
      '  isolation: isolate;',
      '}',
      '.gc-input {',
      '  inline-size: 100%;',
      '  min-inline-size: 0;',
      '  background: rgba(255,255,255,0.06);',
      '  border: 1px solid rgba(255,255,255,0.1);',
      '  border-radius: 12px;',
      '  padding: 10px 14px;',
      '  color: var(--gc-text);',
      '  font-size: 13px;',
      '  resize: none;',
      '  max-height: 120px;',
      '  outline: none;',
      '  box-sizing: border-box;',
      '  text-align: start;',
      '  transition: border-color 0.2s;',
      '  line-height: 1.4;',
      '}',
      '.gc-input::placeholder { color: rgba(250,250,250,0.3); }',
      '[dir="rtl"] .gc-input { text-align: right; }',
      '.gc-input:focus { border-color: var(--gc-primary); }',
      '.gc-send-btn {',
      '  width: 42px;',
      '  height: 42px;',
      '  min-width: 42px;',
      '  min-height: 42px;',
      '  border: none;',
      '  background: var(--gc-primary);',
      '  color: #fff;',
      '  border-radius: 10px;',
      '  cursor: pointer;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  flex-shrink: 0;',
      '  box-sizing: border-box;',
      '  transition: all 0.2s;',
      '}',
      '.gc-send-btn:hover:not(:disabled) { background: var(--gc-accent); }',
      '.gc-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.gc-send-btn span { font-size: 18px; }',
      '/* Powered by */',
      '.gc-powered-by {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 4px;',
      '  padding: 6px 12px;',
      '  font-size: 10px;',
      '  color: rgba(250,250,250,0.25);',
      '  border-top: 1px solid rgba(255,255,255,0.04);',
      '}',
      '.gc-powered-by a {',
      '  color: rgba(250,250,250,0.35);',
      '  text-decoration: none;',
      '  font-weight: 500;',
      '}',
      '.gc-powered-by a:hover { color: rgba(250,250,250,0.6); }',
      '/* Trial banner */',
      '.gc-trial-banner {',
      '  background: rgba(245,158,11,0.12);',
      '  border-bottom: 1px solid rgba(245,158,11,0.2);',
      '  padding: 8px 16px;',
      '  font-size: 11px;',
      '  color: #f59e0b;',
      '  text-align: center;',
      '}',
      '.gc-trial-banner a {',
      '  color: #f59e0b;',
      '  font-weight: 600;',
      '  text-decoration: underline;',
      '  cursor: pointer;',
      '}',
      '/* Limit / upgrade CTA */',
      '.gc-limit-msg {',
      '  background: rgba(239,68,68,0.08);',
      '  border: 1px solid rgba(239,68,68,0.15);',
      '  border-radius: 10px;',
      '  padding: 10px 14px;',
      '  font-size: 12px;',
      '  color: rgba(250,250,250,0.7);',
      '  text-align: center;',
      '}',
      '.gc-limit-msg strong { color: #ef4444; }',
      '/* Lead capture form */',
      '.gc-lead-capture { padding: 20px 16px; display: none; }',
      '.gc-lead-capture.active { display: block; }',
      '.gc-lead-header { text-align: center; margin-bottom: 16px; }',
      '.gc-lead-title { font-size: 15px; font-weight: 700; color: var(--gc-text); margin-bottom: 4px; }',
      '.gc-lead-subtitle { font-size: 12px; color: rgba(250,250,250,0.45); }',
      '.gc-lead-form { display: flex; flex-direction: column; gap: 12px; }',
      '.gc-lead-field { display: flex; flex-direction: column; gap: 4px; }',
      '.gc-lead-label { font-size: 11px; font-weight: 600; color: rgba(250,250,250,0.5); text-transform: uppercase; letter-spacing: 0.04em; }',
      '.gc-lead-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; color: var(--gc-text); font-size: 13px; outline: none; transition: border-color 0.2s; }',
      '.gc-lead-input:focus { border-color: var(--gc-primary); }',
      '.gc-lead-input::placeholder { color: rgba(250,250,250,0.3); }',
      '.gc-lead-input.error { border-color: #ef4444; }',
      '.gc-lead-error { font-size: 11px; color: #ef4444; min-height: 16px; }',
      '.gc-lead-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }',
      '.gc-lead-skip { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: rgba(250,250,250,0.5); padding: 8px 16px; border-radius: 10px; font-size: 12px; cursor: pointer; transition: all 0.2s; }',
      '.gc-lead-skip:hover { border-color: rgba(255,255,255,0.2); color: var(--gc-text); }',
      '.gc-lead-submit { min-width: 120px; width: auto; height: auto; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; }',
      '/* Responsive */',
      '@media (max-width: 480px) {',
      '  :host {',
      isRtl ? '    left: 12px;' : '    right: 12px;',
      '    bottom: 12px;',
      '  }',
      '  .gc-panel {',
      '    width: calc(100vw - 24px);',
      '    max-height: 70vh;',
      '  }',
      '  .gc-launcher-label { display: none; }',
      '  .gc-launcher.open { border-radius: 50%; }',
  '  .gc-intents { flex-wrap: wrap; overflow: visible; padding-bottom: 8px; }',
  '  .gc-intent { flex: 1 1 auto; }',
  '  .gc-messages { padding: 12px; }',
  '  .gc-lead-capture { padding: 16px 12px; }',
  '}'
    ].join('\n');
  }

  // ─────────────────────────────────────────────────────────────
  // ICON MAP (Material Symbols inline SVG paths)
  // ─────────────────────────────────────────────────────────────
  var ICONS = {
    chat: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z',
    help: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
    support_agent: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z',
    headset: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2h-1v2a9 9 0 0 0 8 8.94c.92-.54 2.5-1.44 3.47-2.51l.79-.8-.26-.79c-.43-.85-.57-1.8-.39-2.72l.08-.42.35-.27c.45-.34.73-.86.79-1.43h.02c.09-.58.35-1.11.76-1.52l.35-.35.09-.45.08-.41c.05-.27-.04-.54-.24-.75l-.29-.31-.26-.79.79-.8c.97-1.07 2.55-1.97 3.47-2.51A9 9 0 0 0 19 10z',
    pulse: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm1-8h2v4h-2zm0-6h2v4h-2z',
    arrow_forward: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    send: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
    expand_less: 'M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z',
    arrow_back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
    explaining: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
    upload: 'M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z',
    api: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  };

  function getIcon(name) {
    var path = ICONS[name] || ICONS.chat;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="' + path + '"/></svg>';
  }

  // ─────────────────────────────────────────────────────────────
  // HTML BUILDERS
  // ─────────────────────────────────────────────────────────────
  function buildLauncherHTML(cfg, isOpen) {
    var label = getPageLauncherLabel(cfg);
    var icon = getIcon(cfg.launcherIcon || 'chat');
    return [
      '<button class="gc-launcher' + (isOpen ? ' open' : '') + '" id="gc-launcher" aria-label="' + escapeHtml(label) + '">',
      '  <div class="gc-launcher-icon">' + icon + '</div>',
      '  <span class="gc-launcher-label">' + escapeHtml(label) + '</span>',
      '  <div class="gc-launcher-badge" id="gc-launcher-badge" style="display:none"></div>',
      '  <div class="gc-launcher-close" id="gc-launcher-close" style="display:none">',
      '    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="' + ICONS.close + '"/></svg>',
      '  </div>',
      '</button>'
    ].join('');
  }

  function getPageLauncherLabel(cfg) {
    var pageKey = window.location.pathname;
    if (cfg.pageLabels && cfg.pageLabels[pageKey]) {
      return cfg.pageLabels[pageKey];
    }
    return cfg.launcherLabel || 'Support';
  }

  function buildPanelHTML(cfg) {
    var greeting = cfg.greetingMessage || t('greeting_default');
    var brandName = cfg.customBrandName || 'Exception Support';
    var intents = cfg.intents || [];

    var intentsHTML = '';
    if (cfg.showIntentButtons && intents.length > 0) {
      var pageIntents = getPageIntents(intents, window.location.pathname);
      if (pageIntents.length > 0) {
        intentsHTML = '<div class="gc-intents">' +
          pageIntents.map(function (intent) {
            var label = intent.label || '';
            var icon = intent.icon || 'chat';
            return '<button class="gc-intent" data-intent-id="' + (intent.id || '') + '" data-intent-label="' + escapeHtml(label) + '" data-action-type="' + (intent.action_type || 'send_message') + '" data-message-text="' + escapeHtml(intent.message_text || label) + '" data-external-url="' + escapeHtml(intent.external_url || '') + '">' +
              '<span class="material-symbols-outlined" style="font-size:14px">' + escapeHtml(icon) + '</span>' +
              '<span>' + escapeHtml(label) + '</span>' +
              '</button>';
          }).join('') +
          '</div>';
      }
    }

    var trialBanner = '';
    if (cfg.trialExpired) {
      trialBanner = '<div class="gc-trial-banner">' +
        t('trial_ended') + ' <a id="gc-trial-cta">' + t('book_meeting') + '</a></div>';
    }

    var poweredBy = '';
    if (cfg.showPoweredBy || cfg.attributionMode === 'forced_grindctrl') {
      poweredBy = '<div class="gc-powered-by">' +
        '<span>' + t('powered_by') + '</span>' +
        '</div>';
    }

    return [
      '<div class="gc-panel" id="gc-panel" role="dialog" aria-modal="false" aria-label="' + brandName + '" dir="' + (currentLang() === 'ar' ? 'rtl' : 'ltr') + '">',
      trialBanner,
      '<div class="gc-header">',
      '  <div class="gc-header-brand">',
      '    <div class="gc-header-logo">',
      (cfg.customLogoUrl ? '<img src="' + cfg.customLogoUrl + '" alt="logo"/>' : '<span>' + getIcon(cfg.launcherIcon || 'support_agent') + '</span>'),
      '    </div>',
      '    <div>',
      '      <div class="gc-header-name">' + escapeHtml(brandName) + '</div>',
      '      <div class="gc-header-subtitle">' + escapeHtml(t('powered_by')) + '</div>',
      '    </div>',
      '  </div>',
      '  <div class="gc-header-actions">',
      '    <button class="gc-header-btn" id="gc-minimize-btn" title="' + t('minimize') + '" aria-label="' + t('minimize') + '">' +
      '      <span>' + getIcon('expand_less') + '</span></button>',
      '    <button class="gc-header-btn" id="gc-close-btn" title="' + t('close') + '" aria-label="' + t('close') + '">' +
      '      <span>' + getIcon('close') + '</span></button>',
      '  </div>',
      '</div>',
      intentsHTML,
      '<div class="gc-messages" id="gc-messages"></div>',
      '<div class="gc-greeting" id="gc-greeting">',
      '  <div class="gc-greeting-title">' + escapeHtml(brandName) + '</div>',
      '  <div class="gc-greeting-desc">' + escapeHtml(greeting) + '</div>',
      '</div>',
      buildLeadCaptureHTML(cfg),
      '<div class="gc-input-area" id="gc-input-area">',
      '  <div class="gc-input-row" dir="' + (currentLang() === 'ar' ? 'rtl' : 'ltr') + '">',
      '    <textarea class="gc-input" id="gc-input" rows="1" placeholder="' + t('placeholder') + '" dir="auto" aria-label="' + t('placeholder') + '"></textarea>',
      '    <button class="gc-send-btn" id="gc-send-btn" disabled aria-label="' + t('send') + '">' +
      '      <span>' + getIcon('send') + '</span></button>',
      '  </div>',
      '</div>',
      poweredBy,
      '</div>'
    ].join('');
  }

  function getPageIntents(intents, pathname) {
    var pageIntents = intents.filter(function (i) {
      if (!i.page_pattern) return true;
      try {
        var re = new RegExp(i.page_pattern);
        return re.test(pathname);
      } catch (e) {
        return i.page_pattern === pathname;
      }
    });
    return pageIntents.slice(0, 6);
  }

  function buildMessageHTML(msg) {
    var isUser = msg.role === 'user';
    var time = formatTime(msg.created_at || new Date());
    return [
      '<div class="gc-msg gc-msg-' + (isUser ? 'user' : 'ai') + '">',
      '  <div class="gc-msg-bubble">' + escapeHtml(msg.content).replace(/\n/g, '<br/>') + '</div>',
      '  <div class="gc-msg-time">' + time + '</div>',
      '</div>'
    ].join('');
  }

  function buildTypingHTML() {
    return [
      '<div class="gc-msg gc-msg-ai" id="gc-typing">',
      '  <div class="gc-msg-bubble">',
      '    <div class="gc-typing">',
      '      <div class="gc-typing-dot"></div>',
      '      <div class="gc-typing-dot"></div>',
      '      <div class="gc-typing-dot"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  // ─────────────────────────────────────────────────────────────
  // LEAD CAPTURE HTML BUILDER
  // ─────────────────────────────────────────────────────────────
  function buildLeadCaptureHTML(cfg) {
    var fields = cfg.leadCaptureFields || ['name', 'email'];
    var title = cfg.leadCaptureTitle || t('lead_capture_title');
    var subtitle = cfg.leadCaptureSubtitle || t('lead_capture_subtitle');
    var fieldHTML = fields.map(function(field) {
      var type = field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text';
      return '<div class="gc-lead-field">' +
        '<label class="gc-lead-label" for="gc-lead-' + field + '">' + t('lead_capture_' + field) + '</label>' +
        '<input class="gc-lead-input" id="gc-lead-' + field + '" type="' + type + '" placeholder="' + t('lead_capture_' + field) + '" dir="auto" />' +
        '<div class="gc-lead-error" id="gc-lead-error-' + field + '"></div>' +
        '</div>';
    }).join('');
    var skipBtn = cfg.leadCaptureSkippable ? '<button class="gc-lead-skip" id="gc-lead-skip" type="button">' + t('lead_capture_skip') + '</button>' : '';
    return '<div class="gc-lead-capture" id="gc-lead-capture">' +
      '<div class="gc-lead-header">' +
      '<div class="gc-lead-title">' + escapeHtml(title) + '</div>' +
      '<div class="gc-lead-subtitle">' + escapeHtml(subtitle) + '</div>' +
      '</div>' +
      '<form class="gc-lead-form" id="gc-lead-form">' +
      fieldHTML +
      '<div class="gc-lead-actions">' +
      skipBtn +
      '<button class="gc-lead-submit gc-send-btn" id="gc-lead-submit" type="submit">' + t('lead_capture_submit') + '</button>' +
      '</div>' +
      '</form>' +
      '</div>';
  }

  // ─────────────────────────────────────────────────────────────
  // CORE WIDGET CLASS
  // ─────────────────────────────────────────────────────────────
  function GrindctrlSupport() {
    this._version = VERSION;
  }

  GrindctrlSupport.prototype.init = function (userConfig) {
    var self = this;

    // Prevent double-init
    if (state._initialized) {
      console.warn('[GrindctrlSupport] Already initialized. Use updateConfig() to change settings.');
      return this;
    }

    // Merge config
    var cfg = {};
    Object.keys(DEFAULT_CONFIG).forEach(function (key) {
      cfg[key] = DEFAULT_CONFIG[key];
    });
    Object.keys(userConfig || {}).forEach(function (key) {
      if (DEFAULT_CONFIG[key] !== undefined || userConfig[key] !== null) {
        cfg[key] = userConfig[key];
      }
    });

    // Validate required
    if (!cfg.embedKey) {
      console.error('[GrindctrlSupport] embedKey is required.');
      return this;
    }
    if (!cfg.domain) {
      cfg.domain = window.location.hostname;
    }

    state.config = cfg;
    state.anonymousId = getVisitorId();

    // Create Shadow DOM host
    var host = document.createElement('div');
    host.id = 'gc-widget-host';
    host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;inset:0;';
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: 'closed' });

    // Inject base styles
    var style = document.createElement('style');
    style.textContent = buildStyles(cfg);
    shadow.appendChild(style);

    // Build container
    var container = document.createElement('div');
    container.id = 'gc-container';
    container.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;inset:0;display:flex;align-items:flex-end;justify-content:flex-end;padding:0;';
    shadow.appendChild(container);

    // Store references
    state._shadow = shadow;
    state._container = container;

    // Wire up DOM
    this._wireDOM();

    // Load config from server
    this._loadConfig();

    // Track session start
    this._trackEvent('widget_open', { page: window.location.href });

    // Listen for resize / lang change
    window.addEventListener('resize', function () {
      self._updatePosition();
    });

    return this;
  };

  GrindctrlSupport.prototype._wireDOM = function () {
    var self = this;
    var container = state._container;

    // Render launcher
    container.innerHTML = buildLauncherHTML(state.config || DEFAULT_CONFIG, false);

    // Event: launcher click
    container.addEventListener('click', function (e) {
      var target = e.target.closest('[id]');
      if (!target) return;
      var id = target.id;

      if (id === 'gc-launcher' || id === 'gc-launcher-badge') {
        self.toggle();
        return;
      }
      if (id === 'gc-launcher-close') {
        self.close();
        return;
      }
      if (id === 'gc-close-btn' || id === 'gc-minimize-btn') {
        self.close();
        return;
      }
      if (target.classList.contains('gc-intent')) {
        var label = target.getAttribute('data-intent-label');
        var intentId = target.getAttribute('data-intent-id');
        var actionType = target.getAttribute('data-action-type');
        var messageText = target.getAttribute('data-message-text');
        var externalUrl = target.getAttribute('data-external-url');
        self._handleIntent(intentId, label, actionType, messageText, externalUrl);
        return;
      }
      if (id === 'gc-send-btn') {
        self._handleSend();
        return;
      }
      if (id === 'gc-trial-cta') {
        self._handleTrialCTA();
        return;
      }
    });

    // Keyboard: Escape closes
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.phase === 'open') {
        self.close();
      }
    });

    // Textarea auto-resize
    this._resizeObserver = function () {
      var ta = state._shadow.getElementById('gc-input');
      if (ta) {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
      }
    };
  };

  GrindctrlSupport.prototype._loadConfig = function () {
    var self = this;
    state.phase = 'loading';

    loadConfig().then(function (serverCfg) {
      // Check if widget is active
      if (!serverCfg.activeState || serverCfg._config.status !== 'active') {
        console.warn('[GrindctrlSupport] Widget is not active for this site.');
        state.phase = 'disabled';
        return;
      }

      state.config = Object.assign({}, state.config, serverCfg);
      state.phase = 'ready';
      state._initialized = true;

      // Rebuild styles with server config
      var style = state._shadow.querySelector('style');
      style.textContent = buildStyles(state.config);

      // Rebuild launcher + panel
      state._container.innerHTML =
        buildLauncherHTML(state.config, false) +
        buildPanelHTML(state.config);

      // Wire textarea
      var ta = state._shadow.getElementById('gc-input');
      if (ta) {
        ta.addEventListener('input', function () {
          self._resizeObserver();
          var sendBtn = state._shadow.getElementById('gc-send-btn');
          if (sendBtn) sendBtn.disabled = !ta.value.trim();
        });
        ta.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            self._handleSend();
          }
        });
      }

      // Check for existing session
      var existingConvId = getSessionId();
      if (existingConvId && state.config.persistentSessions) {
        state.conversationId = existingConvId;
      }

      // Show lead capture form if configured for before_first_message
      if (self._shouldShowLeadCapture('init')) {
        self._showLeadCapture();
      }

      if (state.config && state.config.onReady) {
        state.config.onReady(state.config);
      }
    }).catch(function (err) {
      state.phase = 'error';
      if (state.config && state.config.onError) {
        state.config.onError(err);
      }
      console.error('[GrindctrlSupport] Failed to load config:', err.message);
    });
  };

  GrindctrlSupport.prototype._handleIntent = function (intentId, label, actionType, messageText, externalUrl) {
    var self = this;
    var intent = (state.config.intents || []).find(function (i) { return i.id === intentId; });

    // Check if we should show lead capture before proceeding
    if (self._shouldShowLeadCapture('intent')) {
      self._showLeadCapture();
      return;
    }

    this._trackEvent('intent_click', { intent_id: intentId, label: label, action_type: actionType });

    if (actionType === 'external_link' && externalUrl) {
      window.open(externalUrl, '_blank');
      return;
    }

    // Add user intent message
    var displayText = messageText || label;
    self._addMessage({ role: 'user', content: displayText, created_at: new Date().toISOString() });
    state._messageCount++;

    // Hide greeting
    var greeting = state._shadow.getElementById('gc-greeting');
    if (greeting) greeting.style.display = 'none';

    if (actionType === 'escalate' || (intent && intent.action_type === 'escalate')) {
      // Show escalation message
      self._addMessage({
        role: 'assistant',
        content: 'I\'ll connect you with our support team. Please give us a moment.',
        created_at: new Date().toISOString()
      });
      this._trackEvent('escalation_trigger', { intent: intent });
    } else {
      // Start conversation with intent as first message
      self._startConvIfNeeded().then(function () {
        sendMessage(displayText, label).then(function () {
          // Show demo reply for now (until real transport is implemented)
          self._showDemoReply(displayText);
        }).catch(function (err) {
          self._handleError(err);
        });
      }).catch(function (err) {
        self._handleError(err);
      });
    }
  };

  GrindctrlSupport.prototype._handleSend = function () {
    var self = this;
    var ta = state._shadow.getElementById('gc-input');
    if (!ta || !ta.value.trim()) return;

    var text = ta.value.trim();
    ta.value = '';
    ta.style.height = 'auto';
    var sendBtn = state._shadow.getElementById('gc-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    self._hideGreeting();
    self._addMessage({ role: 'user', content: text, created_at: new Date().toISOString() });
    state._messageCount++;

    // Check if lead capture should be shown after this message
    if (self._shouldShowLeadCapture('message')) {
      self._showLeadCapture();
      return;
    }

    this._startConvIfNeeded().then(function () {
      sendMessage(text).then(function (msg) {
        if (self._config && self._config.onMessageSent) {
          self._config.onMessageSent({ content: text });
        }
        // Show demo reply for now (until real transport is implemented)
        self._showDemoReply(text);
      }).catch(function (err) {
        self._handleError(err);
      });
    }).catch(function (err) {
      self._handleError(err);
    });
  };

  GrindctrlSupport.prototype._handleError = function (err) {
    var msg = err.message === 'rate_limit' ? t('rate_limit') : t('error');
    var limitClass = err.message === 'rate_limit' ? 'gc-limit-msg' : 'gc-msg gc-msg-ai';
    this._addMessage({
      role: 'assistant',
      content: msg,
      created_at: new Date().toISOString()
    });
  };

  GrindctrlSupport.prototype._startConvIfNeeded = function () {
    var self = this;
    if (state.conversationId) return Promise.resolve();

    return startConversation().then(function (data) {
      state.conversationId = data.conversation_id;
      state.visitorId = data.visitor_id;
      if (self._config && self._config.onConversationStart) {
        self._config.onConversationStart(data);
      }
      self._trackEvent('conversation_start', { conversation_id: data.conversation_id });
    });
  };

  GrindctrlSupport.prototype._addMessage = function (msg) {
    var list = state._shadow && state._shadow.getElementById('gc-messages');
    if (!list) return;

    var div = document.createElement('div');
    div.innerHTML = buildMessageHTML(msg);
    list.appendChild(div.firstElementChild);
    list.scrollTop = list.scrollHeight;
  };

  GrindctrlSupport.prototype._showTyping = function () {
    var list = state._shadow && state._shadow.getElementById('gc-messages');
    if (!list) return;
    var div = document.createElement('div');
    div.id = 'gc-typing-el';
    div.innerHTML = buildTypingHTML();
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  };

  GrindctrlSupport.prototype._hideTyping = function () {
    var el = state._shadow && state._shadow.getElementById('gc-typing-el');
    if (el) el.remove();
  };

  GrindctrlSupport.prototype._hideGreeting = function () {
    var g = state._shadow && state._shadow.getElementById('gc-greeting');
    if (g) g.style.display = 'none';
  };

  GrindctrlSupport.prototype._handleTrialCTA = function () {
    var email = prompt(t('email_placeholder'));
    if (email) {
      window.open('https://grindctrl.com/book?source=widget-trial&email=' + encodeURIComponent(email), '_blank');
    }
  };

  GrindctrlSupport.prototype._updatePosition = function () {
    // Shadow DOM handles positioning via CSS
  };

  GrindctrlSupport.prototype._trackEvent = function (eventName, data) {
    if (this._config && this._config.onEvent) {
      this._config.onEvent(eventName, data);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // LEAD CAPTURE METHODS
  // ─────────────────────────────────────────────────────────────

  GrindctrlSupport.prototype._shouldShowLeadCapture = function (trigger) {
    var cfg = state.config;
    if (!cfg || !cfg.leadCaptureEnabled) return false;
    if (state._leadCaptured) return false;

    // Session-based deduplication
    try {
      var sessionKey = 'gc_lead_' + cfg.widgetSiteId;
      if (sessionStorage.getItem(sessionKey)) return false;
    } catch (e) {}

    var mode = cfg.leadCaptureMode;
    if (mode === 'disabled') return false;
    if (mode === 'before_required' && trigger === 'init') return true;
    if (mode === 'before_skippable' && trigger === 'init') return true;
    if (mode === 'during' && trigger === 'message' && state._messageCount >= 1) return true;
    if (mode === 'after' && trigger === 'message' && state._messageCount >= 2) return true;
    return false;
  };

  GrindctrlSupport.prototype._showLeadCapture = function () {
    var self = this;
    state._leadCaptureActive = true;

    var form = state._shadow.getElementById('gc-lead-capture');
    var inputArea = state._shadow.getElementById('gc-input-area');
    var greeting = state._shadow.getElementById('gc-greeting');

    if (form) form.classList.add('active');
    if (inputArea) inputArea.style.display = 'none';
    if (greeting) greeting.style.display = 'none';

    // Wire up form events
    var formEl = state._shadow.getElementById('gc-lead-form');
    if (formEl) {
      formEl.addEventListener('submit', function (e) {
        e.preventDefault();
        self._handleLeadCaptureSubmit();
      });
    }

    // Wire skip button if present
    var skipBtn = state._shadow.getElementById('gc-lead-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        state._leadCaptured = true;
        self._hideLeadCapture();
        self._trackEvent('lead_capture_skipped', {});
      });
    }

    // Focus first input
    setTimeout(function () {
      var firstInput = state._shadow.querySelector('.gc-lead-input');
      if (firstInput) firstInput.focus();
    }, 100);
  };

  GrindctrlSupport.prototype._hideLeadCapture = function () {
    state._leadCaptureActive = false;

    var form = state._shadow.getElementById('gc-lead-capture');
    var inputArea = state._shadow.getElementById('gc-input-area');
    var greeting = state._shadow.getElementById('gc-greeting');

    if (form) form.classList.remove('active');
    if (inputArea) inputArea.style.display = '';
    if (greeting && state._messageCount === 0) greeting.style.display = '';
  };

  GrindctrlSupport.prototype._handleLeadCaptureSubmit = function () {
    var self = this;
    var cfg = state.config;
    var fields = cfg.leadCaptureFields || ['name', 'email'];
    var leadData = {};
    var hasError = false;

    // Clear previous errors
    fields.forEach(function (field) {
      var input = state._shadow.getElementById('gc-lead-' + field);
      var error = state._shadow.getElementById('gc-lead-error-' + field);
      if (input) input.classList.remove('error');
      if (error) error.textContent = '';
    });

    // Validate and collect
    fields.forEach(function (field) {
      var input = state._shadow.getElementById('gc-lead-' + field);
      if (!input) return;
      var value = input.value.trim();
      leadData[field] = value;

      var error = self._validateLeadField(field, value);
      if (error) {
        hasError = true;
        input.classList.add('error');
        var errorEl = state._shadow.getElementById('gc-lead-error-' + field);
        if (errorEl) errorEl.textContent = error;
      }
    });

    if (hasError) return;

    // Success — store lead data
    state._leadCaptured = true;
    this.identifyUser(leadData.email, leadData.name);
    state.config.userPhone = leadData.phone;
    state.config.userCompany = leadData.company;

    // Session deduplication
    try {
      var sessionKey = 'gc_lead_' + state.config.widgetSiteId;
      sessionStorage.setItem(sessionKey, '1');
    } catch (e) {}

    // Submit to Supabase
    self._submitLead(leadData);

    this._trackEvent('lead_captured', { fields: fields });
    this._hideLeadCapture();

    // Start conversation with lead data
    this._startConvIfNeeded().then(function () {
      // Send a welcome message to acknowledge
      self._addMessage({
        role: 'assistant',
        content: t('welcome_back') + (leadData.name ? ', ' + leadData.name : '') + '!',
        created_at: new Date().toISOString()
      });
    });

    // Focus textarea
    setTimeout(function () {
      var ta = state._shadow.getElementById('gc-input');
      if (ta) ta.focus();
    }, 100);
  };

  GrindctrlSupport.prototype._submitLead = function (leadData) {
    var cfg = state.config;
    if (!cfg.widgetSiteId || !cfg.workspaceId) return;

    var payload = {
      widget_site_id: cfg.widgetSiteId,
      workspace_id: cfg.workspaceId,
      name: leadData.name || null,
      email: leadData.email || null,
      phone: leadData.phone || null,
      company: leadData.company || null,
      source_domain: window.location.hostname,
    };

    fetch(cfg.apiBase + '/rest/v1/widget_leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cfg.apiKey || '',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) console.error('[GrindctrlSupport] Lead submit failed:', res.status);
    }).catch(function (err) {
      console.error('[GrindctrlSupport] Lead submit error:', err);
    });
  };

  GrindctrlSupport.prototype._validateLeadField = function (field, value) {
    if (field === 'name' && !value) return t('lead_capture_name_error');
    if (field === 'email') {
      if (!value) return t('lead_capture_email_error');
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return t('lead_capture_email_error');
    }
    if (field === 'phone' && value) {
      var phoneRegex = /^[+]?[\d\s()-]{7,20}$/;
      if (!phoneRegex.test(value)) return t('lead_capture_phone_error');
    }
    if (field === 'company' && !value) return t('lead_capture_company_error');
    return null;
  };

  // ─────────────────────────────────────────────────────────────
  // REPLY TRANSPORT BOUNDARY (stub for future polling/WebSocket)
  // ─────────────────────────────────────────────────────────────

  // ─── REPLY TRANSPORT BOUNDARY ───
  // Future: Replace this stub with polling (GET /widget-message?conversation_id=...)
  // or WebSocket/SSE subscription. The onReply callback receives:
  //   { conversation_id, role: 'assistant', content: string, created_at: string }
  // The transport should call widget._addMessage(replyData) and widget._hideTyping().

  var replyTransport = {
    init: function(conversationId, config) {
      // TODO: Initialize real transport here
    },
    onReply: null,  // callback: function(replyData) { ... }
    destroy: function() {
      // TODO: Clean up transport here
    }
  };

  GrindctrlSupport.prototype._showDemoReply = function(userText) {
    var self = this;
    self._showTyping();
    setTimeout(function() {
      self._hideTyping();
      var reply = 'Thanks for your message. Our team will get back to you shortly.';
      self._addMessage({ role: 'assistant', content: reply, created_at: new Date().toISOString() });
    }, 1500);
  };

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────
  GrindctrlSupport.prototype.open = function () {
    if (state.phase === 'error') {
      this._loadConfig();
      return;
    }
    var container = state._container;
    var panel = container && container.querySelector('.gc-panel');
    var launcher = container && container.querySelector('.gc-launcher');
    var badge = container && container.querySelector('#gc-launcher-badge');
    var closeBtn = container && container.querySelector('#gc-launcher-close');
    var label = container && container.querySelector('.gc-launcher-label');

    if (panel) panel.classList.add('open');
    if (launcher) launcher.classList.add('open');
    if (badge) badge.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'flex';
    if (label) label.style.display = 'none';

    state.phase = 'open';
    this._trackEvent('widget_open', { page: window.location.href });

    var ta = state._shadow && state._shadow.getElementById('gc-input');
    if (ta) setTimeout(function () { ta.focus(); }, 100);
  };

  GrindctrlSupport.prototype.close = function () {
    var container = state._container;
    var panel = container && container.querySelector('.gc-panel');
    var launcher = container && container.querySelector('.gc-launcher');
    var badge = container && container.querySelector('#gc-launcher-badge');
    var closeBtn = container && container.querySelector('#gc-launcher-close');
    var label = container && container.querySelector('.gc-launcher-label');

    if (panel) panel.classList.remove('open');
    if (launcher) launcher.classList.remove('open');
    if (badge) badge.style.display = 'block';
    if (closeBtn) closeBtn.style.display = 'none';
    if (label) label.style.display = 'inline';

    state.phase = 'minimized';
    this._trackEvent('widget_close', {});
  };

  GrindctrlSupport.prototype.toggle = function () {
    if (state.phase === 'open') this.close();
    else this.open();
  };

  GrindctrlSupport.prototype.destroy = function () {
    var host = document.getElementById('gc-widget-host');
    if (host) host.remove();
    state.phase = 'idle';
    state.conversationId = null;
  };

  GrindctrlSupport.prototype.updateConfig = function (updates) {
    if (!state.config) return;
    state.config = Object.assign({}, state.config, updates);
  };

  GrindctrlSupport.prototype.setContext = function (context) {
    if (!state.config) return;
    if (context.pageUrl) state.currentPage = context.pageUrl;
    if (context.userEmail) state.config.userEmail = context.userEmail;
    if (context.userName) state.config.userName = context.userName;
  };

  GrindctrlSupport.prototype.identifyUser = function (email, name) {
    if (!state.config) return;
    state.config.userEmail = email;
    state.config.userName = name;
  };

  GrindctrlSupport.prototype.trackEvent = function (eventName, data) {
    this._trackEvent(eventName, data);
  };

  GrindctrlSupport.prototype.getVersion = function () {
    return VERSION;
  };

  // ─────────────────────────────────────────────────────────────
  // FACTORY INIT + QUEUE SYSTEM
  // ─────────────────────────────────────────────────────────────
  var instance = null;

  function GrindctrlSupportFactory() {
    if (!instance) {
      instance = new GrindctrlSupport();
    }
    return instance;
  }

  // Auto-init from window.GrindctrlSupport global
  GrindctrlSupportFactory.init = function (config) {
    var widget = GrindctrlSupportFactory();
    return widget.init(config);
  };

  // Proxy all public instance methods to the factory for convenient API
  var publicMethods = ['open', 'close', 'toggle', 'destroy', 'updateConfig',
                       'setContext', 'identifyUser', 'trackEvent', 'getVersion'];
  publicMethods.forEach(function(method) {
    GrindctrlSupportFactory[method] = function() {
      if (!instance) {
        console.warn('[GrindctrlSupport] Widget not initialized. Call init() first.');
        return;
      }
      return instance[method].apply(instance, arguments);
    };
  });

  // Queue processing: handle both config-objects and callback functions
  GrindctrlSupportFactory.push = function(item) {
    if (typeof item === 'function') {
      // Compatibility: callback receives the factory API
      item(GrindctrlSupportFactory);
    } else if (item && typeof item === 'object') {
      // Canonical: config object with embedKey
      GrindctrlSupportFactory.init(item);
    }
  };

  // Process any queued items that were declared before script loaded
  var queue = (typeof window !== 'undefined' &&
               Array.isArray(window.GrindctrlSupport)) ? window.GrindctrlSupport : [];

  // Replace the global with the factory
  window.GrindctrlSupport = GrindctrlSupportFactory;

  // Process the queue
  for (var i = 0; i < queue.length; i++) {
    try {
      GrindctrlSupportFactory.push(queue[i]);
    } catch (e) {
      console.error('[GrindctrlSupport] Failed to process queue item:', e);
    }
  }

  // AMD / CommonJS export
  if (typeof define === 'function' && define.amd) {
    define([], function () { return GrindctrlSupportFactory; });
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = GrindctrlSupportFactory;
  }

})(window);
