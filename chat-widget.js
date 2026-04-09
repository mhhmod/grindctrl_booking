/**
 * GRINDCTRL AI Agent Trial — Chat Widget Engine
 * Supabase-backed, RTL-ready, voice-enabled
 */
(function () {
  'use strict';

  // ── Config ──
  var CONFIG = {
    SUPABASE_URL: 'https://qldgpkqpyfpqfdchozsp.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZGdwa3FweWZwcWZkY2hvenNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzYwMDEsImV4cCI6MjA4OTY1MjAwMX0.BGqBYcjmuGbA787NFm45ndeFuXyro9zYR8NZX3Tib30',
    N8N_WEBHOOK: 'https://n8n.srv1141109.hstgr.cloud/webhook/trial-agent', // placeholder
    LIMITS: { SESSION_ANON: 3, DAILY_ANON: 5, DAILY_AUTH: 10 },
    MAX_MSG_LEN: 500,
    MAX_AUDIO_SEC: 60,
    MAX_AUDIO_BYTES: 10 * 1024 * 1024,
    AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/x-m4a']
  };

  // ── State ──
  var state = {
    phase: 'closed', // closed|open|sending|responding|recording|uploading|transcribing|limit|error|rate_limited
    sessionId: null,
    fingerprint: null,
    messages: [],
    turnsUsed: 0,
    maxTurns: CONFIG.LIMITS.SESSION_ANON,
    limitType: 'session',
    recorder: null,
    recordStart: 0,
    recordTimer: null,
    retryAfter: 0,
    pendingMsg: null
  };

  // ── Supabase REST helpers ──
  function sbHeaders() {
    return {
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  function sbFetch(table, method, body, query) {
    var url = CONFIG.SUPABASE_URL + '/rest/v1/' + table + (query || '');
    return fetch(url, {
      method: method,
      headers: sbHeaders(),
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (data) {
        // Supabase returns {code, message, details} on error — treat as null
        if (data && !Array.isArray(data) && data.code) return null;
        return data;
      });
    }).catch(function () { return null; });
  }

  function sbUpload(path, blob) {
    return fetch(CONFIG.SUPABASE_URL + '/storage/v1/object/trial-audio/' + path, {
      method: 'PUT',
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY,
        'Content-Type': blob.type || 'audio/webm'
      },
      body: blob
    });
  }

  // ── Fingerprint ──
  function getFingerprint() {
    var fp = null;
    try { fp = localStorage.getItem('gc_fp'); } catch (e) { }
    if (!fp) {
      fp = crypto.randomUUID ? crypto.randomUUID() : 'fp-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      try { localStorage.setItem('gc_fp', fp); } catch (e) { }
    }
    return fp;
  }

  // ── Session ──
  function getSessionId() {
    var sid = null;
    try { sid = sessionStorage.getItem('gc_sid'); } catch (e) { }
    return sid;
  }
  function storeSessionId(sid) {
    try { sessionStorage.setItem('gc_sid', sid); } catch (e) { }
  }

  async function ensureSession() {
    if (state.sessionId) return state.sessionId;
    var sid = getSessionId();
    if (sid) { state.sessionId = sid; state.fingerprint = getFingerprint(); return sid; }
    state.fingerprint = getFingerprint();
    var identityKey = 'anon:' + state.fingerprint;
    var lang = document.documentElement.getAttribute('lang') || 'en';
    var newSid = crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,function(c){return(c^(crypto.getRandomValues(new Uint8Array(1))[0]&(15>>c/4))).toString(16)});
    var rows = await sbFetch('trial_sessions', 'POST', {
      session_id: newSid,
      identity_key: identityKey,
      locale: lang,
      user_agent_hash: navigator.userAgent.slice(0, 128),
      source_page: location.href || null,
      status: 'active'
    });
    if (rows && rows[0]) {
      state.sessionId = rows[0].session_id;
      storeSessionId(state.sessionId);
      trackEvent('session_start', {});
    }
    return state.sessionId;
  }

  // ── Usage counters ──
  async function checkUsage() {
    // Ensure we have a valid session before querying counters
    if (!state.sessionId) await ensureSession();
    if (!state.sessionId) return true; // Session creation failed — allow gracefully

    state.fingerprint = state.fingerprint || getFingerprint();
    var identityKey = 'anon:' + state.fingerprint;
    var scopeSession = 'session:' + state.sessionId;
    var today = new Date().toISOString().slice(0, 10);
    var scopeDaily = 'daily:' + today + ':' + identityKey;

    // IMPORTANT: Supabase in.() requires raw commas inside the parens, not %2C
    var q = '?identity_key=eq.' + encodeURIComponent(identityKey) +
      '&counter_scope_key=in.(' + encodeURIComponent(scopeSession) + ',' + encodeURIComponent(scopeDaily) + ')';
    // Fix: decode the comma between the two values so Supabase parses them correctly
    q = q.replace('%2C' + encodeURIComponent(scopeDaily), ',' + encodeURIComponent(scopeDaily));
    var counters = await sbFetch('trial_usage_counters', 'GET', null, q + '&select=*');
    if (!Array.isArray(counters)) counters = [];

    var sessionCounter = counters.find(function (c) { return c.counter_scope_key === scopeSession; });
    var dailyCounter = counters.find(function (c) { return c.counter_scope_key === scopeDaily; });

    // Create session counter if missing
    if (!sessionCounter) {
      var res = await sbFetch('trial_usage_counters', 'POST', {
        counter_scope_key: scopeSession,
        session_id: state.sessionId,
        identity_key: identityKey,
        window_type: 'session',
        turns_used: 0
      });
      sessionCounter = (res && Array.isArray(res) && res[0]) ? res[0] : { turns_used: 0 };
    }

    // Create daily counter if missing
    if (!dailyCounter) {
      var res2 = await sbFetch('trial_usage_counters', 'POST', {
        counter_scope_key: scopeDaily,
        session_id: state.sessionId,
        identity_key: identityKey,
        window_type: 'rolling_24h',
        turns_used: 0
      });
      dailyCounter = (res2 && Array.isArray(res2) && res2[0]) ? res2[0] : { turns_used: 0 };
    }

    var sessionMax = CONFIG.LIMITS.SESSION_ANON;
    var dailyMax = CONFIG.LIMITS.DAILY_ANON;

    // Use the more restrictive counter
    if (sessionCounter.turns_used >= sessionMax ||
      dailyCounter.turns_used >= dailyMax) {
      state.turnsUsed = Math.max(sessionCounter.turns_used, dailyCounter.turns_used);
      state.maxTurns = sessionCounter.turns_used >= sessionMax ? sessionMax : dailyMax;
      state.limitType = sessionCounter.turns_used >= sessionMax ? 'session' : 'daily';
      return false;
    }

    state.turnsUsed = sessionCounter.turns_used;
    state.maxTurns = sessionMax;
    return true;
  }

  async function incrementUsage() {
    if (!state.sessionId) return;
    var identityKey = 'anon:' + state.fingerprint;
    var scopeSession = 'session:' + state.sessionId;
    var today = new Date().toISOString().slice(0, 10);
    var scopeDaily = 'daily:' + today + ':' + identityKey;

    // Read-modify-write for both counters
    // Fix: raw comma inside in.() — Supabase requires it unencoded between values
    var q = '?identity_key=eq.' + encodeURIComponent(identityKey) +
      '&counter_scope_key=in.(' + encodeURIComponent(scopeSession) + ',' + encodeURIComponent(scopeDaily) + ')&select=*';
    q = q.replace('%2C' + encodeURIComponent(scopeDaily), ',' + encodeURIComponent(scopeDaily));
    var counters = await sbFetch('trial_usage_counters', 'GET', null, q);
    if (!Array.isArray(counters)) return;

    for (var i = 0; i < counters.length; i++) {
      var c = counters[i];
      await fetch(CONFIG.SUPABASE_URL + '/rest/v1/trial_usage_counters?id=eq.' + c.id, {
        method: 'PATCH',
        headers: sbHeaders(),
        body: JSON.stringify({ turns_used: c.turns_used + 1, last_turn_at: new Date().toISOString() })
      });
    }
    state.turnsUsed++;
  }

  // ── Analytics ──
  function trackEvent(type, data) {
    if (!state.sessionId) return;
    sbFetch('trial_events', 'POST', {
      session_id: state.sessionId,
      event_type: type,
      severity: 'info',
      payload_json: data || {}
    }).catch(function () { });
  }

  function trackCTA(ctaType, action, ctaLocation) {
    if (!state.sessionId) return;
    sbFetch('trial_cta_events', 'POST', {
      session_id: state.sessionId,
      cta_type: ctaType,
      event_action: action,
      cta_location: ctaLocation || '',
      source_page: location.href || null,
      locale: document.documentElement.getAttribute('lang') || 'en'
    }).catch(function () { });
  }

  // ── i18n ──
  function t(key) {
    var lang = document.documentElement.getAttribute('lang') || 'en';
    var T = window.__i18n;
    if (T && T[key] && T[key][lang] != null) return T[key][lang];
    // Fallback inline translations
    var fallback = {
      chat_empty_title: { en: 'Talk to the GrindCTRL Agent', ar: 'تحدث مع وكيل GrindCTRL' },
      chat_empty_desc: { en: 'Ask about AI automation, workflows, or how we can help your business.', ar: 'اسأل عن الأتمتة الذكية أو سير العمل أو كيف يمكننا مساعدة أعمالك.' },
      chat_placeholder: { en: 'Ask anything...', ar: 'اسأل أي شيء...' },
      chat_prompt_1: { en: 'What can AI automate in my business?', ar: 'ما الذي يمكن للذكاء الاصطناعي أتمتته؟' },
      chat_prompt_2: { en: 'How does GrindCTRL work?', ar: 'كيف يعمل GrindCTRL؟' },
      chat_prompt_3: { en: 'What results do clients see?', ar: 'ما النتائج التي يحققها العملاء؟' },
      chat_prompt_4: { en: 'Can you help with e-commerce?', ar: 'هل تساعدون في التجارة الإلكترونية؟' },
      chat_turns_remaining: { en: ' turns remaining', ar: ' محاولات متبقية' },
      chat_trial_agent: { en: 'Trial Agent', ar: 'الوكيل التجريبي' },
      chat_limit_title: { en: "You've experienced the GrindCTRL Agent", ar: 'لقد جرّبت وكيل GrindCTRL' },
      chat_limit_desc: { en: 'Ready to see what it can do for your business?', ar: 'مستعد لترى ما يمكنه فعله لأعمالك؟' },
      chat_limit_cta1: { en: 'Book a Strategy Call', ar: 'احجز مكالمة استراتيجية' },
      chat_limit_cta2: { en: 'See the 2-Min Workflow Tour', ar: 'شاهد جولة سير العمل' },
      chat_limit_cta3: { en: 'Tell Us About Your Business', ar: 'أخبرنا عن أعمالك' },
      chat_limit_fine: { en: 'Free 30-min session · No obligation · Confidential', ar: 'جلسة مجانية ٣٠ دقيقة · بدون التزام · سري' },
      chat_error_msg: { en: 'Something went wrong. Please try again.', ar: 'حدث خطأ. يرجى المحاولة مرة أخرى.' },
      chat_retry: { en: 'Retry', ar: 'إعادة المحاولة' },
      chat_recording: { en: 'Recording...', ar: 'جارٍ التسجيل...' },
      chat_cancel: { en: 'Cancel', ar: 'إلغاء' },
      chat_transcribing: { en: 'Transcribing...', ar: 'جارٍ النسخ...' },
      chat_drop_audio: { en: 'Drop audio file here', ar: 'أفلت ملف الصوت هنا' },
      nav_try_agent: { en: 'Try the Agent', ar: 'جرّب الوكيل' },
      hero_cta_try: { en: 'Try the Agent', ar: 'جرّب الوكيل' },
      chat_open_label: { en: 'Open AI Agent Trial', ar: 'فتح تجربة الوكيل الذكي' },
      chat_close_label: { en: 'Close chat', ar: 'إغلاق المحادثة' },
      chat_send_label: { en: 'Send message', ar: 'إرسال الرسالة' },
      chat_mic_label: { en: 'Record voice message', ar: 'تسجيل رسالة صوتية' },
      chat_attach_label: { en: 'Attach audio file', ar: 'إرفاق ملف صوتي' },
      chat_voice: { en: 'Voice message', ar: 'رسالة صوتية' }
    };
    if (fallback[key]) return fallback[key][lang] || fallback[key].en;
    return key;
  }

  // ── DOM Builder ──
  function buildWidget() {
    // Trigger button
    var trigger = document.createElement('button');
    trigger.id = 'gc-chat-trigger';
    trigger.className = 'gc-chat-trigger';
    trigger.setAttribute('aria-label', t('chat_open_label'));
    trigger.innerHTML = '<span class="material-symbols-outlined">smart_toy</span><span class="gc-chat-trigger-badge"></span>';
    document.body.appendChild(trigger);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'gc-chat-panel';
    panel.className = 'gc-chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'AI Agent Trial Chat');
    panel.innerHTML = buildPanelHTML();
    document.body.appendChild(panel);

    // Toast
    var toast = document.createElement('div');
    toast.id = 'gc-toast';
    toast.className = 'gc-toast';
    document.body.appendChild(toast);

    bindEvents();
  }

  function buildPanelHTML() {
    var remaining = state.maxTurns - state.turnsUsed;
    var isDark = document.documentElement.classList.contains('dark');
    var logoSrc = isDark ? 'logo-dark.svg' : 'logo-light.svg';

    return '' +
      '<div class="gc-chat-header">' +
      '  <div class="gc-chat-header-brand">' +
      '    <div class="gc-chat-header-logo"><img id="gc-logo-img" src="' + logoSrc + '" alt="GRINDCTRL"/></div>' +
      '    <span class="gc-chat-header-name">GRINDCTRL</span>' +
      '  </div>' +
      '  <span class="gc-chat-header-badge">' + t('chat_trial_agent') + '</span>' +
      '  <span id="gc-turns" class="gc-chat-header-turns">' + remaining + t('chat_turns_remaining') + '</span>' +
      '  <button id="gc-close" class="gc-chat-close" aria-label="' + t('chat_close_label') + '">' +
      '    <span class="material-symbols-outlined" style="font-size:20px">close</span>' +
      '  </button>' +
      '</div>' +
      '<div id="gc-chat-body" class="gc-chat-body">' +
      '  <div id="gc-empty" class="gc-chat-empty">' +
      '    <div class="gc-chat-empty-icon"><span class="material-symbols-outlined" style="font-size:24px">smart_toy</span></div>' +
      '    <div class="gc-chat-empty-title">' + t('chat_empty_title') + '</div>' +
      '    <div class="gc-chat-empty-desc">' + t('chat_empty_desc') + '</div>' +
      '    <div class="gc-chat-prompts">' +
      '      <button class="gc-chat-prompt-btn" data-prompt="1">' + t('chat_prompt_1') + '</button>' +
      '      <button class="gc-chat-prompt-btn" data-prompt="2">' + t('chat_prompt_2') + '</button>' +
      '      <button class="gc-chat-prompt-btn" data-prompt="3">' + t('chat_prompt_3') + '</button>' +
      '      <button class="gc-chat-prompt-btn" data-prompt="4">' + t('chat_prompt_4') + '</button>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="gc-drop-zone" id="gc-drop-zone">' +
      '  <span class="material-symbols-outlined gc-drop-zone-icon">upload_file</span>' +
      '  <span class="gc-drop-zone-text">' + t('chat_drop_audio') + '</span>' +
      '</div>' +
      '<div id="gc-input-area" class="gc-chat-input-area">' +
      '  <div id="gc-recording-bar" class="gc-recording-bar">' +
      '    <span class="gc-recording-dot"></span>' +
      '    <span id="gc-rec-timer" class="gc-recording-timer">0:00</span>' +
      '    <button id="gc-rec-cancel" class="gc-recording-cancel">' + t('chat_cancel') + '</button>' +
      '  </div>' +
      '  <div class="gc-chat-input-row">' +
      '    <textarea id="gc-textarea" class="gc-chat-textarea" placeholder="' + t('chat_placeholder') + '" rows="1" maxlength="' + CONFIG.MAX_MSG_LEN + '" dir="auto"></textarea>' +
      '    <input type="file" id="gc-file-input" accept="audio/*" class="gc-hidden" aria-hidden="true"/>' +
      '    <button id="gc-attach-btn" class="gc-input-btn" aria-label="' + t('chat_attach_label') + '" title="' + t('chat_attach_label') + '">' +
      '      <span class="material-symbols-outlined" style="font-size:20px">attach_file</span>' +
      '    </button>' +
      '    <button id="gc-mic-btn" class="gc-input-btn gc-input-btn-mic" aria-label="' + t('chat_mic_label') + '" title="' + t('chat_mic_label') + '">' +
      '      <span class="material-symbols-outlined" style="font-size:20px">mic</span>' +
      '    </button>' +
      '    <button id="gc-send-btn" class="gc-input-btn gc-input-btn-send gc-hidden" aria-label="' + t('chat_send_label') + '" title="' + t('chat_send_label') + '">' +
      '      <span class="material-symbols-outlined" style="font-size:20px">send</span>' +
      '    </button>' +
      '  </div>' +
      '</div>';
  }

  // ── Render Helpers ──
  function $(id) { return document.getElementById(id); }

  function scrollToBottom() {
    var body = $('gc-chat-body');
    if (body) requestAnimationFrame(function () { body.scrollTop = body.scrollHeight; });
  }

  function updateTurns() {
    var el = $('gc-turns');
    if (!el) return;
    var r = state.maxTurns - state.turnsUsed;
    el.textContent = r + t('chat_turns_remaining');
    el.className = 'gc-chat-header-turns' + (r <= 1 ? ' warning' : '');
  }

  function hideEmpty() {
    var el = $('gc-empty');
    if (el) el.style.display = 'none';
  }

  function addMessageToDOM(role, content, extra) {
    hideEmpty();
    var body = $('gc-chat-body');
    var wrapper = document.createElement('div');
    wrapper.className = 'gc-msg gc-msg-' + (role === 'user' ? 'user' : 'ai');

    var html = '';
    if (role !== 'user') {
      html += '<div class="gc-msg-ai-label">' +
        '<div class="gc-msg-ai-avatar">AI</div>' +
        '<span class="gc-msg-ai-name">GrindCTRL</span></div>';
    }
    html += '<div class="gc-msg-bubble">' + escapeHTML(content) + '</div>';
    if (extra && extra.voice) {
      html += '<div class="gc-msg-voice-badge"><span class="material-symbols-outlined">mic</span> ' + t('chat_voice') + '</div>';
    }

    wrapper.innerHTML = html;
    body.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  function showTyping() {
    hideEmpty();
    var body = $('gc-chat-body');
    var d = document.createElement('div');
    d.id = 'gc-typing';
    d.className = 'gc-typing';
    d.innerHTML = '<div class="gc-typing-dot"></div><div class="gc-typing-dot"></div><div class="gc-typing-dot"></div>';
    body.appendChild(d);
    scrollToBottom();
  }

  function hideTyping() {
    var el = $('gc-typing');
    if (el) el.remove();
  }

  function showError(msg) {
    hideTyping();
    var body = $('gc-chat-body');
    var d = document.createElement('div');
    d.className = 'gc-chat-error';
    d.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">error</span>' +
      '<span>' + (msg || t('chat_error_msg')) + '</span>' +
      '<button onclick="this.parentElement.remove()">' + t('chat_retry') + '</button>';
    body.appendChild(d);
    scrollToBottom();
  }

  function showLimitCard() {
    hideTyping();
    state.phase = 'limit';
    var inputArea = $('gc-input-area');
    if (inputArea) inputArea.classList.add('disabled');

    var body = $('gc-chat-body');
    var card = document.createElement('div');
    card.className = 'gc-limit-card';
    card.innerHTML =
      '<div class="gc-limit-card-icon">✦</div>' +
      '<h3>' + t('chat_limit_title') + '</h3>' +
      '<p>' + t('chat_limit_desc') + '</p>' +
      '<button class="gc-limit-cta-primary" data-cta="book_call">' + t('chat_limit_cta1') + '</button>' +
      '<button class="gc-limit-cta-secondary" data-cta="workflow_tour">' + t('chat_limit_cta2') + '</button>' +
      '<button class="gc-limit-cta-secondary" data-cta="tell_us">' + t('chat_limit_cta3') + '</button>' +
      '<div class="gc-limit-fine">' + t('chat_limit_fine') + '</div>';
    body.appendChild(card);
    scrollToBottom();

    trackCTA('book_call', 'impression', 'limit_card');
    trackCTA('workflow_tour', 'impression', 'limit_card');
    trackCTA('tell_us', 'impression', 'limit_card');

    // Bind CTA clicks
    card.querySelectorAll('[data-cta]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cta = btn.getAttribute('data-cta');
        trackCTA(cta, 'click', 'limit_card');
        if (cta === 'book_call') navigateHash('#book');
        else if (cta === 'workflow_tour') navigateHash('#solutions');
        else if (cta === 'tell_us') window.open('mailto:hello@grindctrl.com?subject=Tell%20Us%20About%20Our%20Business', '_blank');
        closeChat();
      });
    });
  }

  function navigateHash(hash) {
    var link = document.createElement('a');
    link.href = hash;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function showToast(msg) {
    var el = $('gc-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3000);
  }

  function escapeHTML(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Send Message ──
  async function sendMessage(text, contentType, audioAssetId) {
    if (state.phase === 'sending' || state.phase === 'responding' || state.phase === 'limit') return;

    await ensureSession();
    var canSend = await checkUsage();
    if (!canSend) { showLimitCard(); return; }

    state.phase = 'sending';
    addMessageToDOM('user', text, { voice: contentType === 'voice_transcript' });

    // Save to Supabase
    sbFetch('trial_messages', 'POST', {
      session_id: state.sessionId,
      identity_key: 'anon:' + state.fingerprint,
      role: 'user',
      raw_text: text,
      modality: (contentType === 'voice_transcript') ? 'voice' : 'text',
      locale: document.documentElement.getAttribute('lang') || 'en',
      source_page: location.href || null
    }).catch(function () { });

    showTyping();
    state.phase = 'responding';

    // Build history from last messages
    var history = state.messages.slice(-6).map(function (m) { return { role: m.role, content: m.content }; });

    try {
      var res = await fetch(CONFIG.N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: state.sessionId,
          message: text,
          content_type: contentType || 'text',
          language: document.documentElement.getAttribute('lang') || 'en',
          identity_key: 'anon:' + state.fingerprint,
          turn_number: state.turnsUsed + 1,
          history: history
        })
      });

      if (res.status === 429) {
        hideTyping();
        state.phase = 'rate_limited';
        var retryAfter = parseInt(res.headers.get('Retry-After') || '120');
        showToast('Rate limited. Try again in ' + retryAfter + 's');
        setTimeout(function () { state.phase = 'open'; }, retryAfter * 1000);
        return;
      }

      var data = await res.json();

      if (data.status === 'limit_exceeded') {
        hideTyping();
        state.turnsUsed = data.usage ? data.usage.turns_used : state.maxTurns;
        updateTurns();
        showLimitCard();
        return;
      }

      if (data.status === 'error') {
        hideTyping();
        state.phase = 'open';
        showError(data.message);
        return;
      }

      // Success
      hideTyping();
      var reply = data.message || data.output || data.text || 'Thank you for your message.';
      addMessageToDOM('assistant', reply);
      state.messages.push({ role: 'user', content: text }, { role: 'assistant', content: reply });

      // Save assistant message
      sbFetch('trial_messages', 'POST', {
        session_id: state.sessionId,
        identity_key: 'anon:' + state.fingerprint,
        role: 'assistant',
        response_text: reply,
        raw_text: text,
        modality: 'text',
        latency_ms: data.latency_ms || null,
        locale: document.documentElement.getAttribute('lang') || 'en'
      }).catch(function () { });

      await incrementUsage();
      updateTurns();

      // Check if this was the last turn
      if (state.turnsUsed >= state.maxTurns) {
        setTimeout(showLimitCard, 800);
      }

      state.phase = 'open';

    } catch (err) {
      hideTyping();
      state.phase = 'open';
      showError();
      trackEvent('error', { error: err.message || 'network_error' });
    }
  }

  // ── Voice Recording ──
  async function startRecording() {
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      var chunks = [];
      state.recorder.ondataavailable = function (e) { if (e.data.size > 0) chunks.push(e.data); };
      state.recorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        clearInterval(state.recordTimer);
        $('gc-recording-bar').classList.remove('active');
        $('gc-mic-btn').classList.remove('recording');
        $('gc-mic-btn').querySelector('.material-symbols-outlined').textContent = 'mic';
        if (chunks.length === 0) { state.phase = 'open'; return; }
        var blob = new Blob(chunks, { type: 'audio/webm' });
        handleAudioBlob(blob);
      };
      state.recorder.start();
      state.recordStart = Date.now();
      state.phase = 'recording';
      $('gc-recording-bar').classList.add('active');
      $('gc-mic-btn').classList.add('recording');
      $('gc-mic-btn').querySelector('.material-symbols-outlined').textContent = 'stop';

      // Timer
      state.recordTimer = setInterval(function () {
        var elapsed = Math.floor((Date.now() - state.recordStart) / 1000);
        $('gc-rec-timer').textContent = Math.floor(elapsed / 60) + ':' + String(elapsed % 60).padStart(2, '0');
        if (elapsed >= CONFIG.MAX_AUDIO_SEC) {
          state.recorder.stop();
          showToast('Max recording time reached');
        }
      }, 500);

    } catch (err) {
      showToast('Microphone access denied');
      state.phase = 'open';
    }
  }

  function stopRecording() {
    if (state.recorder && state.recorder.state === 'recording') {
      state.recorder.stop();
    }
  }

  function cancelRecording() {
    if (state.recorder && state.recorder.state === 'recording') {
      state.recorder.ondataavailable = null;
      state.recorder.onstop = function () {
        state.recorder.stream.getTracks().forEach(function (t) { t.stop(); });
        clearInterval(state.recordTimer);
        $('gc-recording-bar').classList.remove('active');
        $('gc-mic-btn').classList.remove('recording');
        $('gc-mic-btn').querySelector('.material-symbols-outlined').textContent = 'mic';
        state.phase = 'open';
      };
      state.recorder.stop();
    }
  }

  async function handleAudioBlob(blob) {
    if (blob.size > CONFIG.MAX_AUDIO_BYTES) {
      showToast('Audio file too large (max 10MB)');
      state.phase = 'open';
      return;
    }

    state.phase = 'uploading';
    await ensureSession();

    // Create audio asset record
    var assetRows = await sbFetch('trial_audio_assets', 'POST', {
      session_id: state.sessionId,
      identity_key: 'anon:' + state.fingerprint,
      mime_type: blob.type,
      size_bytes: blob.size,
      duration_seconds: Math.floor((Date.now() - state.recordStart) / 1000),
      status: 'pending'
    });

    if (!assetRows || !assetRows[0]) {
      state.phase = 'open';
      showError('Failed to save audio');
      return;
    }

    var asset = assetRows[0];
    var storagePath = state.sessionId + '/' + asset.id + '.webm';

    // Upload to storage
    try {
      await sbUpload(storagePath, blob);
      await fetch(CONFIG.SUPABASE_URL + '/rest/v1/trial_audio_assets?id=eq.' + asset.id, {
        method: 'PATCH',
        headers: sbHeaders(),
        body: JSON.stringify({ storage_path: storagePath, status: 'processing' })
      });
    } catch (err) {
      showError('Upload failed');
      state.phase = 'open';
      return;
    }

    // For now, use a placeholder transcription message
    // In production, n8n would handle transcription via Whisper
    state.phase = 'transcribing';
    addMessageToDOM('user', '🎤 ' + t('chat_transcribing'), { voice: true });

    // Send to n8n with audio reference for transcription + response
    try {
      var res = await fetch(CONFIG.N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: state.sessionId,
          message: '[voice_message]',
          content_type: 'audio',
          audio_asset_id: asset.id,
          audio_storage_path: storagePath,
          language: document.documentElement.getAttribute('lang') || 'en',
          identity_key: 'anon:' + state.fingerprint,
          turn_number: state.turnsUsed + 1,
          history: state.messages.slice(-6).map(function (m) { return { role: m.role, content: m.content }; })
        })
      });

      var data = await res.json();
      // Remove the "transcribing" placeholder
      var body = $('gc-chat-body');
      var lastMsg = body.querySelector('.gc-msg:last-child');
      if (lastMsg) lastMsg.remove();

      if (data.transcript) {
        addMessageToDOM('user', data.transcript, { voice: true });
        state.messages.push({ role: 'user', content: data.transcript });
      }
      if (data.message || data.output) {
        var reply = data.message || data.output;
        addMessageToDOM('assistant', reply);
        state.messages.push({ role: 'assistant', content: reply });
      }

      await incrementUsage();
      updateTurns();
      state.phase = 'open';

      if (state.turnsUsed >= state.maxTurns) {
        setTimeout(showLimitCard, 800);
      }
    } catch (err) {
      showError();
      state.phase = 'open';
    }
  }

  // ── Open / Close ──
  function openChat() {
    var panel = $('gc-chat-panel');
    var trigger = $('gc-chat-trigger');
    if (!panel) return;
    panel.classList.add('open');
    trigger.classList.add('open');
    state.phase = 'open';
    document.body.style.overflow = window.innerWidth < 640 ? 'hidden' : '';

    // Hide floating pill when chat is open
    var pill = document.getElementById('floating-pill');
    if (pill) pill.style.display = 'none';

    ensureSession().then(function () {
      checkUsage().then(function (canUse) {
        updateTurns();
        if (!canUse) showLimitCard();
      });
    });

    trackCTA('open_chat', 'click', 'trigger');

    // Focus textarea
    setTimeout(function () {
      var ta = $('gc-textarea');
      if (ta && window.innerWidth >= 640) ta.focus();
    }, 350);
  }

  function closeChat() {
    var panel = $('gc-chat-panel');
    var trigger = $('gc-chat-trigger');
    if (!panel) return;
    panel.classList.remove('open');
    trigger.classList.remove('open');
    state.phase = 'closed';
    document.body.style.overflow = '';

    // Restore floating pill
    var pill = document.getElementById('floating-pill');
    if (pill) pill.style.display = '';

    if (state.recorder && state.recorder.state === 'recording') cancelRecording();
  }

  // ── Event Binding ──
  function bindEvents() {
    // Trigger
    $('gc-chat-trigger').addEventListener('click', function () {
      if (state.phase === 'closed') openChat();
      else closeChat();
    });

    // Close
    $('gc-close').addEventListener('click', closeChat);

    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.phase !== 'closed') closeChat();
    });

    // Textarea auto-resize + send
    var textarea = $('gc-textarea');
    var sendBtn = $('gc-send-btn');

    textarea.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 96) + 'px';
      sendBtn.classList.toggle('gc-hidden', this.value.trim() === '');
    });

    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 640) {
        e.preventDefault();
        submitText();
      }
    });

    // Send button
    sendBtn.addEventListener('click', submitText);

    // Mic
    $('gc-mic-btn').addEventListener('click', function () {
      if (state.phase === 'recording') stopRecording();
      else if (state.phase === 'open' || state.phase === 'closed') startRecording();
    });

    // Cancel recording
    $('gc-rec-cancel').addEventListener('click', cancelRecording);

    // File attach
    $('gc-attach-btn').addEventListener('click', function () { $('gc-file-input').click(); });
    $('gc-file-input').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!CONFIG.AUDIO_TYPES.some(function (t) { return file.type.startsWith(t.split('/')[0]); })) {
        showToast('Please select an audio file');
        return;
      }
      state.recordStart = Date.now();
      handleAudioBlob(file);
      e.target.value = '';
    });

    // Suggested prompts
    $('gc-chat-body').addEventListener('click', function (e) {
      var btn = e.target.closest('.gc-chat-prompt-btn');
      if (!btn) return;
      var text = btn.textContent.trim();
      $('gc-textarea').value = text;
      submitText();
    });

    // Drag and drop
    var panel = $('gc-chat-panel');
    var dropZone = $('gc-drop-zone');
    var dragCounter = 0;

    panel.addEventListener('dragenter', function (e) {
      e.preventDefault();
      dragCounter++;
      dropZone.classList.add('active');
    });
    panel.addEventListener('dragleave', function (e) {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) { dropZone.classList.remove('active'); dragCounter = 0; }
    });
    panel.addEventListener('dragover', function (e) { e.preventDefault(); });
    panel.addEventListener('drop', function (e) {
      e.preventDefault();
      dragCounter = 0;
      dropZone.classList.remove('active');
      var file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('audio/')) {
        showToast('Please drop an audio file');
        return;
      }
      state.recordStart = Date.now();
      handleAudioBlob(file);
    });

    // Theme observer — swap logo SVG on dark/light toggle
    var observer = new MutationObserver(function () {
      var logo = document.getElementById('gc-logo-img');
      if (logo) {
        logo.src = document.documentElement.classList.contains('dark') ? 'logo-dark.svg' : 'logo-light.svg';
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  function submitText() {
    var textarea = $('gc-textarea');
    var text = textarea.value.trim();
    if (!text) return;
    textarea.value = '';
    textarea.style.height = 'auto';
    $('gc-send-btn').classList.add('gc-hidden');
    sendMessage(text, 'text');
  }

  // ── Expose for CTA buttons ──
  window.gcOpenChat = openChat;

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }
})();
