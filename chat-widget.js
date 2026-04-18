/**
 * GRINDCTRL Trial Playground
 * Premium, theme-aware, RTL-ready landing-page widget.
 */
(function () {
  'use strict';

  var CONFIG = {
    SUPABASE_URL: 'https://qldgpkqpyfpqfdchozsp.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZGdwa3FweWZwcWZkY2hvenNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzYwMDEsImV4cCI6MjA4OTY1MjAwMX0.BGqBYcjmuGbA787NFm45ndeFuXyro9zYR8NZX3Tib30',
    N8N_WEBHOOK: 'https://n8n.srv1141109.hstgr.cloud/webhook/trial-agent',
    N8N_SESSION_UPGRADE_WEBHOOK: 'https://n8n.srv1141109.hstgr.cloud/webhook/trial-agent-session-upgrade',
    LIMITS: { SESSION_ANON: 3, DAILY_ANON: 5, DAILY_AUTH: 10 },
    IMAGE_GEN_MODEL: '@cf/black-forest-labs/flux-1-schnell',
    IMAGE_GEN_LIMIT: 2,
    AUTH_REDIRECT_PARAM: 'gc_auth',
    MAX_MSG_LEN: 500,
    MAX_AUDIO_SEC: 30,
    MAX_AUDIO_BYTES: 2 * 1024 * 1024,
    AUDIO_TYPES: ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/x-m4a'],
    PROMPTS: {
      en: [
        'Explain this anomaly to me',
        'What does this trust state mean?',
        'Help me draft a correction email',
        'Show me similar past exceptions'
      ],
      ar: [
        'اشرح لي هذا الشذوذ',
        'ماذا تعني حالة الثقة هذه؟',
        'ساعدني في كتابة بريد تصحيح',
        'أرني استثناءات مشابهة سابقة'
      ]
    }
  };

  var state = {
    phase: 'closed',
    sessionId: null,
    fingerprint: null,
    messages: [],
    turnsUsed: 0,
    maxTurns: CONFIG.LIMITS.SESSION_ANON,
    recorder: null,
    recordStart: 0,
    recordTimer: null,
    wantsVoiceReply: false,
    preferredReplyLanguage: null,
    quota: {
      remainingTurnsSession: null,
      remainingTurnsDay: null,
      remainingTtsSession: null,
      remainingTtsDay: null,
      ttsAvailable: true,
      limitState: 'ok',
      softWarningState: 'none',
      replyLanguage: 'en',
      remainingImageGen: null,
      imageGenAvailable: true
    },
    activeAudio: null,
    activeAudioUrl: null,
    activeAudioButton: null,
    activeAudioPlayer: null,
    dismissedWarnings: {},
    imageMode: false,
    notice: null,
    messageSeq: 0,
    lastFocusedElement: null,
    historyLoaded: false,
    historyLoading: false,
    historyRequested: false,
    renderedCount: 0,
    auth: {
      client: null,
      session: null,
      user: null,
      email: '',
      code: '',
      status: 'idle',
      helper: '',
      upgradePending: false,
      lastUpgradedUserId: null
    }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function currentLang() {
    return normalizeLang(document.documentElement.getAttribute('lang') || 'en');
  }

  function currentDir() {
    return (document.documentElement.getAttribute('dir') || (currentLang() === 'ar' ? 'rtl' : 'ltr')).toLowerCase() === 'rtl' ? 'rtl' : 'ltr';
  }

  function normalizeLang(value) {
    return String(value || '').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  function getPanelFocusableElements() {
    var panel = $('gc-chat-panel');
    if (!panel) return [];
    return Array.prototype.slice.call(panel.querySelectorAll(
      'button:not([disabled]), [href]:not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (element) {
      return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
    });
  }

  function trapPanelFocus(event) {
    if (event.key !== 'Tab') return;
    var panel = $('gc-chat-panel');
    if (!panel || !panel.classList.contains('open')) return;

    var focusable = getPanelFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      panel.focus();
      return;
    }

    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    var active = document.activeElement;

    if (!panel.contains(active)) {
      event.preventDefault();
      first.focus();
      return;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function t(key) {
    var lang = currentLang();
    var dict = window.__i18n || {};
    if (dict[key] && dict[key][lang] != null) return dict[key][lang];

    var fallback = {
      chat_empty_title: { en: 'Exception Support', ar: 'دعم الاستثناءات' },
      chat_empty_desc: { en: 'Get help with anomalies, trust states, and resolution actions.', ar: 'احصل على مساعدة في الشذوذات وحالات الثقة وإجراءات الحل.' },
      chat_placeholder: { en: 'Ask about this exception…', ar: 'اسأل عن هذا الاستثناء…' },
      chat_trial_agent: { en: 'Trial Agent', ar: 'الوكيل التجريبي' },
      chat_mode_chat: { en: 'Chat', ar: 'محادثة' },
      chat_turns_left: { en: 'left', ar: 'متبقي' },
      chat_today_left: { en: 'today', ar: 'اليوم' },
      chat_limit_title: { en: 'Great exploring! Here\'s what\'s next', ar: 'استكشاف رائع! إليك ما يمكنك فعله' },
      chat_limit_desc: { en: 'You\'ve used all free turns. See the real thing in action.', ar: 'لقد استخدمت جميع المحاولات المجانية. شاهد النظام يعمل فعلياً.' },
      chat_limit_cta1: { en: 'See the 2-Min Workflow Tour', ar: 'شاهد جولة سير العمل خلال دقيقتين' },
      chat_limit_cta2: { en: 'Book a Strategy Call', ar: 'احجز مكالمة استراتيجية' },
      chat_limit_cta3: { en: 'Tell Us About Your Business', ar: 'أخبرنا عن أعمالك' },
      chat_limit_fine: { en: 'Free 30-min session · No obligation · Confidential', ar: 'جلسة مجانية ٣٠ دقيقة · بدون التزام · سري' },
      chat_error_msg: { en: 'Something went wrong. Please try again.', ar: 'حدث خطأ. يرجى المحاولة مرة أخرى.' },
      chat_retry: { en: 'Retry', ar: 'إعادة المحاولة' },
      chat_cancel: { en: 'Cancel', ar: 'إلغاء' },
      chat_transcribing: { en: 'Transcribing...', ar: 'جارٍ النسخ...' },
      chat_drop_audio: { en: 'Drop audio file here', ar: 'أفلت ملف الصوت هنا' },
      chat_open_label: { en: 'Open Exception Support', ar: 'فتح دعم الاستثناءات' },
      chat_trigger_label: { en: 'Exception Support', ar: 'دعم الاستثناءات' },
      chat_close_label: { en: 'Close chat', ar: 'إغلاق المحادثة' },
      chat_send_label: { en: 'Send message', ar: 'إرسال الرسالة' },
      chat_mic_label: { en: 'Record voice message', ar: 'تسجيل رسالة صوتية' },
      chat_attach_label: { en: 'Upload audio', ar: 'رفع ملف صوتي' },
      chat_voice: { en: 'Voice message', ar: 'رسالة صوتية' },
      chat_voice_reply: { en: 'Voice reply', ar: 'رد صوتي' },
      chat_show_transcript: { en: 'Show text', ar: 'عرض النص' },
      chat_hide_transcript: { en: 'Hide text', ar: 'إخفاء النص' },
      chat_voice_preview_setting: { en: 'Reply with voice', ar: 'الرد بالصوت' },
      chat_hear_on: { en: 'On for next reply', ar: 'مفعّلة للرد التالي' },
      chat_hear_off: { en: 'Text only', ar: 'نص فقط' },
      chat_lang_en: { en: 'English', ar: 'English' },
      chat_lang_ar: { en: 'العربية', ar: 'العربية' },
      chat_transcript_label: { en: 'Transcript', ar: 'النص' },
      chat_transcript_pending: { en: 'Transcribing...', ar: 'جارٍ النسخ...' },
      chat_playground_subtitle: { en: 'Ask, speak, and hear how the system responds.', ar: 'اسأل وتحدث واستمع لكيفية استجابة النظام.' },
      chat_prompt_label: { en: 'Suggested prompts', ar: 'اقتراحات سريعة' },
      chat_cap_ask: { en: 'Ask', ar: 'اسأل' },
      chat_cap_speak: { en: 'Speak', ar: 'تحدث' },
      chat_cap_hear: { en: 'Hear', ar: 'استمع' },
      chat_hear_next: { en: 'Hear next reply', ar: 'استمع للرد التالي' },
      chat_hear_unavailable: { en: 'Voice preview unavailable', ar: 'المعاينة الصوتية غير متاحة' },
      chat_audio_hint: { en: 'Voice input up to 30s', ar: 'إدخال صوتي حتى ٣٠ ثانية' },
      chat_reply_language: { en: 'Reply language', ar: 'لغة الرد' },
      chat_play_reply: { en: 'Play reply', ar: 'تشغيل الرد' },
      chat_pause_reply: { en: 'Pause reply', ar: 'إيقاف الرد' },
      chat_warning_turn_title: { en: 'Almost there — 1 turn remaining', ar: 'أوشكت — تبقّت محاولة واحدة' },
      chat_warning_voice_title: { en: '1 voice preview remaining', ar: 'تبقّت معاينة صوتية واحدة' },
      chat_warning_desc: { en: 'Make it count, or explore more options below.', ar: 'استفد منها أو استكشف المزيد أدناه.' },
      chat_warning_voice_desc: { en: 'Text replies continue — one more voice preview available.', ar: 'الردود النصية مستمرة — معاينة صوتية واحدة إضافية.' },
      chat_warning_voice_unavailable_title: { en: 'Voice preview unavailable', ar: 'المعاينة الصوتية غير متاحة' },
      chat_warning_voice_session_desc: { en: 'This session has used its voice preview. Text replies continue.', ar: 'استخدمت هذه الجلسة المعاينة الصوتية الخاصة بها. الردود النصية مستمرة.' },
      chat_warning_voice_day_desc: { en: 'Today’s voice previews are used up. Text replies continue for now.', ar: 'تم استهلاك المعاينات الصوتية لليوم. الردود النصية مستمرة حالياً.' },
      chat_cta_continue: { en: 'Continue Trial', ar: 'تابع التجربة' },
      chat_cta_final_turn: { en: 'Got it', ar: 'فهمت' },
      chat_cta_tour: { en: 'See the 2-Min Workflow Tour', ar: 'شاهد جولة سير العمل خلال دقيقتين' },
      chat_cta_book: { en: 'Book a Strategy Call', ar: 'احجز مكالمة استراتيجية' },
      chat_cta_tell: { en: 'Tell Us About Your Business', ar: 'أخبرنا عن أعمالك' },
      chat_nudge_dismiss: { en: 'Got it', ar: 'فهمت' },
      chat_rate_limited: { en: 'Please wait a moment and try again.', ar: 'يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.' },
      chat_active_conflict: { en: 'Another conversation is already active for this browser.', ar: 'هناك محادثة أخرى نشطة بالفعل لهذا المتصفح.' },
      chat_mic_denied: { en: 'Microphone access was denied.', ar: 'تم رفض الوصول إلى الميكروفون.' },
      chat_audio_too_large: { en: 'Audio file is too large. Maximum is 2 MB.', ar: 'ملف الصوت كبير جداً. الحد الأقصى ٢ ميجابايت.' },
      chat_audio_invalid: { en: 'Please select an audio file.', ar: 'يرجى اختيار ملف صوتي.' },
      chat_recording: { en: 'Recording...', ar: 'جارٍ التسجيل...' },
      chat_recording_limit: { en: 'Maximum recording length reached.', ar: 'تم الوصول إلى الحد الأقصى لمدة التسجيل.' },
      chat_transcribing_status: { en: 'Transcribing voice note...', ar: 'جارٍ نسخ الملاحظة الصوتية...' },
      chat_generating_status: { en: 'Generating response...', ar: 'جارٍ توليد الرد...' },
      chat_try_voice_preview: { en: 'Turn on Hear to get a voice preview with the next reply.', ar: 'فعّل الاستماع للحصول على معاينة صوتية مع الرد التالي.' },
      chat_cap_create: { en: 'Create image', ar: 'إنشاء صورة' },
      chat_create_desc: { en: 'Your next prompt will generate an image', ar: 'سيتم استخدام الوصف التالي لإنشاء صورة' },
      chat_create_placeholder: { en: 'Describe the image you want to create...', ar: 'صِف الصورة التي تريد إنشاءها...' },
      chat_generating_image: { en: 'Creating your image…', ar: 'جارٍ إنشاء صورتك…' },
      chat_image_ready: { en: 'Image ready', ar: 'الصورة جاهزة' },
      chat_image_prompt_label: { en: 'Prompt', ar: 'الوصف' },
      chat_image_open: { en: 'Open', ar: 'فتح' },
      chat_image_save: { en: 'Save', ar: 'حفظ' },
      chat_image_retry: { en: 'Generate again', ar: 'إنشاء مرة أخرى' },
      chat_image_failed: { en: 'Image generation failed. Please try again.', ar: 'فشل إنشاء الصورة. يرجى المحاولة مرة أخرى.' },
      chat_image_quota_exhausted: { en: 'Image generation limit reached for this session.', ar: 'تم الوصول إلى حد إنشاء الصور لهذه الجلسة.' },
      chat_create_mode: { en: 'Create image', ar: 'إنشاء صورة' },
      chat_exit_create: { en: 'Back to chat', ar: 'العودة للمحادثة' }
    };

    if (fallback[key]) return fallback[key][lang] || fallback[key].en;
    return key;
  }

  function sbHeaders() {
    return {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    };
  }

  function sbFetch(table, method, body, query) {
    var url = CONFIG.SUPABASE_URL + '/rest/v1/' + table + (query || '');
    return fetch(url, {
      method: method,
      headers: sbHeaders(),
      body: body ? JSON.stringify(body) : undefined
    }).then(function (response) {
      return response.json().then(function (data) {
        if (data && !Array.isArray(data) && data.code) return null;
        return data;
      });
    }).catch(function () {
      return null;
    });
  }

  function initAuthClient() {
    if (state.auth.client || !window.supabase || typeof window.supabase.createClient !== 'function') return state.auth.client;

    state.auth.client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    state.auth.client.auth.getSession().then(function (result) {
      applyAuthSession(result && result.data ? result.data.session : null, 'restore');
    }).catch(function () {});

    state.auth.client.auth.onAuthStateChange(function (event, session) {
      applyAuthSession(session, event || 'auth_change');
    });

    return state.auth.client;
  }

  function getFingerprint() {
    var existing = null;
    try { existing = localStorage.getItem('gc_fp'); } catch (error) {}
    if (existing) return existing;
    existing = crypto.randomUUID ? crypto.randomUUID() : 'fp-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    try { localStorage.setItem('gc_fp', existing); } catch (error2) {}
    return existing;
  }

  function getSessionId() {
    try { return sessionStorage.getItem('gc_sid'); } catch (error) { return null; }
  }

  function storeSessionId(sessionId) {
    try { sessionStorage.setItem('gc_sid', sessionId); } catch (error) {}
  }

  async function ensureSession() {
    if (state.sessionId) return state.sessionId;

    var existing = getSessionId();
    if (existing) {
      state.sessionId = existing;
      state.fingerprint = getFingerprint();
      return existing;
    }

    state.fingerprint = getFingerprint();
    var identityKey = 'anon:' + state.fingerprint;
    var lang = currentLang();
    var nextSessionId = crypto.randomUUID ? crypto.randomUUID() : 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    var rows = await sbFetch('trial_sessions', 'POST', {
      session_id: nextSessionId,
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

  function mapStoredMessage(row) {
    if (!row || !row.role) return null;
    if (row.role === 'user') {
      return createMessage({
        role: 'user',
        content: row.transcript_text || row.raw_text || '',
        voice: row.modality === 'voice',
        transcriptPending: false
      });
    }
    if (row.role === 'assistant') {
      return createMessage({
        role: 'assistant',
        content: row.response_text || '',
        replyLanguage: row.reply_language || getReplyLanguage()
      });
    }
    return null;
  }

  async function hydrateMessagesFromSession(force) {
    if (state.historyLoading) return;
    if (state.historyLoaded && !force) return;

    await ensureSession();
    if (!state.sessionId) return;

    state.historyLoading = true;
    renderMessages();

    var rows = await sbFetch(
      'trial_messages',
      'GET',
      null,
      '?select=role,modality,raw_text,transcript_text,response_text,reply_language,created_at&session_id=eq.' + encodeURIComponent(state.sessionId) + '&order=created_at.asc&limit=60'
    );

    if (Array.isArray(rows)) {
      state.messages = rows.map(mapStoredMessage).filter(Boolean);
      state.historyLoaded = true;
      state.renderedCount = 0; // Reset to force full re-render
    }

    state.historyLoading = false;
    renderAll();
  }

  function applyAuthSession(session, source) {
    state.auth.session = session || null;
    state.auth.user = session && session.user ? session.user : null;
    if (state.auth.user && state.auth.user.email) state.auth.email = state.auth.user.email;

    if (state.auth.user && state.auth.user.id) {
      Promise.resolve().then(function () {
        return upgradeTrialSession(source || 'auth');
      }).catch(function () {});
    } else {
      renderAll();
    }
  }

  async function upgradeTrialSession(source) {
    if (!state.auth.user || !state.auth.user.id) return false;
    await ensureSession();
    if (!state.sessionId) return false;
    if (state.auth.upgradePending) return false;
    if (state.auth.lastUpgradedUserId === state.auth.user.id && state.historyLoaded) {
      if (shouldResumeAuthPlayground()) {
        openChat();
        clearAuthRedirectParam();
      }
      return true;
    }

    state.auth.upgradePending = true;
    setAuthHelper('loading', t('chat_loading_history'));
    renderAll();

    try {
      var fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          session_id: state.sessionId,
          user_id: state.auth.user.id,
          email: state.auth.user.email || null,
          provider: normalizeProviderName(state.auth.user),
          guest_identity_key: state.fingerprint ? 'anon:' + state.fingerprint : null,
          locale: currentLang(),
          direction: currentDir(),
          source_page: location.href || 'landing'
        })
      };

      var response = await fetch(CONFIG.N8N_SESSION_UPGRADE_WEBHOOK, fetchOptions).catch(function(err) {
        console.warn('CORS or Network error during session upgrade:', err);
        return { ok: false, status: 'cors_or_network_error' };
      });

      var data = {};
      if (response && response.ok) {
        try { data = await response.json(); } catch (error) {}
      }

      if (!response || !response.ok || !data.ok) {
        // Log technical details but show a standard message to user
        console.error('Session upgrade failed:', response ? response.status : 'no_response');
        setAuthHelper('error', t('chat_auth_upgrade_failed'));
        renderAll();
        return false;
      }

      state.auth.lastUpgradedUserId = state.auth.user.id;
      updateQuotaFromResponse(data);
      state.phase = 'open';
      clearNotice();
      setNotice('soft_warning', {
        title: t('chat_auth_success_title'),
        message: t('chat_auth_success_desc'),
        primary: { type: 'continue_trial', label: t('chat_cta_continue'), href: '' },
        secondary: { type: 'workflow_tour', label: t('chat_cta_tour'), href: '#solutions' },
        tertiary: { type: 'book_call', label: t('chat_cta_book'), href: '#book' }
      }, 'auth_success');
      setAuthHelper('success', t('chat_auth_success_desc'));
      await hydrateMessagesFromSession(true);
      if (shouldResumeAuthPlayground()) {
        openChat();
        clearAuthRedirectParam();
      }
      return true;
    } catch (error2) {
      setAuthHelper('error', t('chat_auth_upgrade_failed'));
      renderAll();
      return false;
    } finally {
      state.auth.upgradePending = false;
    }
  }

  function trackEvent(type, data) {
    if (!state.sessionId) return;
    sbFetch('trial_events', 'POST', {
      session_id: state.sessionId,
      event_type: type,
      severity: 'info',
      payload_json: data || {}
    }).catch(function () {});
  }

  function trackCTA(ctaType, action, ctaLocation) {
    if (!state.sessionId) return;
    sbFetch('trial_cta_events', 'POST', {
      session_id: state.sessionId,
      cta_type: ctaType,
      event_action: action,
      cta_location: ctaLocation || 'chat',
      source_page: location.href || null,
      locale: currentLang()
    }).catch(function () {});
  }

  function escapeHTML(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatMessageHTML(value) {
    return escapeHTML(String(value || '')).replace(/\n/g, '<br/>');
  }

  function escapeSelectorValue(value) {
    var stringValue = String(value || '');
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(stringValue);
    return stringValue.replace(/["\\]/g, '\\$&');
  }

  function getPromptList() {
    return CONFIG.PROMPTS[currentLang()] || CONFIG.PROMPTS.en;
  }

  function isAuthenticated() {
    return !!(state.auth && state.auth.user && state.auth.user.id);
  }

  function getAuthRedirectUrl() {
    var url = new URL(window.location.href);
    url.searchParams.set(CONFIG.AUTH_REDIRECT_PARAM, '1');
    url.hash = '';
    return url.toString();
  }

  function shouldResumeAuthPlayground() {
    try {
      return new URL(window.location.href).searchParams.get(CONFIG.AUTH_REDIRECT_PARAM) === '1';
    } catch (error) {
      return false;
    }
  }

  function clearAuthRedirectParam() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete(CONFIG.AUTH_REDIRECT_PARAM);
      window.history.replaceState({}, document.title, url.toString());
    } catch (error) {}
  }

  function normalizeProviderName(user) {
    var provider = user && user.app_metadata && user.app_metadata.provider;
    if (!provider && user && user.identities && user.identities[0] && user.identities[0].provider) {
      provider = user.identities[0].provider;
    }
    if (!provider) return 'email';
    return String(provider);
  }

  function setAuthHelper(status, message) {
    state.auth.status = status || 'idle';
    state.auth.helper = message || '';
  }

  function getHistory() {
    return state.messages
      .filter(function (entry) { return entry.role === 'user' || entry.role === 'assistant'; })
      .map(function (entry) { return { role: entry.role, content: entry.content }; })
      .slice(-6);
  }

  function getReplyLanguage() {
    return normalizeLang(state.preferredReplyLanguage || state.quota.replyLanguage || currentLang());
  }

  function shouldUseVoiceOnlyReply(data, ttsUrl) {
    if (!ttsUrl) return false;
    if (typeof data.voice_only_reply === 'boolean') return data.voice_only_reply;
    return !!(data.wants_voice_reply || state.wantsVoiceReply);
  }

  function resolveAssistantContent(data, voiceOnlyReply) {
    if (voiceOnlyReply) {
      return data.assistant_voice_message || data.assistant_message || data.message || data.output || data.text || 'Thank you for your message.';
    }
    return data.assistant_message || data.assistant_full_message || data.message || data.output || data.text || 'Thank you for your message.';
  }

  function nextMessageId() {
    state.messageSeq += 1;
    return 'gc-msg-' + state.messageSeq;
  }

  function createMessage(entry) {
    return Object.assign({
      id: nextMessageId(),
      transcriptExpanded: false,
      transcriptPending: false
    }, entry);
  }

  function pushMessage(entry) {
    var message = createMessage(entry);
    state.messages.push(message);
    return message;
  }

  function removeMessageById(messageId) {
    state.messages.forEach(function (entry) {
      if (entry.id === messageId && entry.audioUrl && entry.audioUrl.indexOf('blob:') === 0 && window.URL && typeof window.URL.revokeObjectURL === 'function') {
        window.URL.revokeObjectURL(entry.audioUrl);
      }
    });
    state.messages = state.messages.filter(function (entry) {
      return entry.id !== messageId;
    });
    state.renderedCount = 0; // Force re-render of the list
  }

  function remainingTurnsValue() {
    if (state.quota.remainingTurnsSession !== null && state.quota.remainingTurnsSession !== undefined) {
      return Math.max(Number(state.quota.remainingTurnsSession) || 0, 0);
    }
    if (state.quota.remainingTurnsDay !== null && state.quota.remainingTurnsDay !== undefined) {
      return Math.max(Number(state.quota.remainingTurnsDay) || 0, 0);
    }
    return Math.max(state.maxTurns - state.turnsUsed, 0);
  }

  function remainingTurnsLabel() {
    if (state.quota.remainingTurnsSession !== null && state.quota.remainingTurnsSession !== undefined) return t('chat_turns_left');
    if (state.quota.remainingTurnsDay !== null && state.quota.remainingTurnsDay !== undefined) return t('chat_today_left');
    return t('chat_turns_left');
  }

  function isNearTurnLimit() {
    return remainingTurnsValue() <= 1;
  }

  function noTurnsRemaining() {
    var remainingSession = state.quota.remainingTurnsSession;
    var remainingDay = state.quota.remainingTurnsDay;
    return (remainingSession !== null && remainingSession !== undefined && Number(remainingSession) <= 0) ||
      (remainingDay !== null && remainingDay !== undefined && Number(remainingDay) <= 0);
  }

  function updateQuotaFromResponse(data) {
    if (!data) return;

    if (data.remaining_turns_session !== undefined) {
      state.quota.remainingTurnsSession = data.remaining_turns_session;
      if (data.remaining_turns_session !== null) {
        state.turnsUsed = Math.max(state.maxTurns - Number(data.remaining_turns_session || 0), 0);
      }
    }
    if (data.remaining_turns_day !== undefined) state.quota.remainingTurnsDay = data.remaining_turns_day;
    if (data.remaining_tts_previews_session !== undefined) state.quota.remainingTtsSession = data.remaining_tts_previews_session;
    if (data.remaining_tts_previews_day !== undefined) state.quota.remainingTtsDay = data.remaining_tts_previews_day;
    if (data.tts_available !== undefined) {
      state.quota.ttsAvailable = !!data.tts_available;
      if (!state.quota.ttsAvailable) state.wantsVoiceReply = false;
    }
    if (data.limit_state) state.quota.limitState = data.limit_state;
    if (data.soft_warning_state) state.quota.softWarningState = data.soft_warning_state;
    if (data.reply_language) state.quota.replyLanguage = normalizeLang(data.reply_language);
    if (data.remaining_image_gen !== undefined) state.quota.remainingImageGen = data.remaining_image_gen;
    if (data.image_gen_available !== undefined) state.quota.imageGenAvailable = !!data.image_gen_available;
  }

  function localizeCtaPayload(kind, serverPayload, softWarningState) {
    var source = serverPayload || {};
    var fallbackByKind = {
      limit: {
        title: t('chat_limit_title'),
        message: t('chat_limit_desc'),
        primary: { type: 'auth_google', label: t('chat_limit_cta1'), href: '' },
        secondary: { type: 'auth_email', label: t('chat_limit_cta2'), href: '' },
        tertiary: { type: 'workflow_tour', label: t('chat_limit_cta3'), href: '#solutions' }
      },
      auth_soft: {
        title: t('chat_auth_title_soft'),
        message: t('chat_auth_desc_soft'),
        primary: { type: 'auth_google', label: t('chat_auth_google'), href: '' },
        secondary: { type: 'auth_email', label: t('chat_auth_email'), href: '' },
        tertiary: { type: 'continue_trial', label: t('chat_cta_final_turn'), href: '' }
      },
      auth_limit: {
        title: t('chat_auth_title_limit'),
        message: t('chat_auth_desc_limit'),
        primary: { type: 'auth_google', label: t('chat_auth_google'), href: '' },
        secondary: { type: 'auth_email', label: t('chat_auth_email'), href: '' },
        tertiary: { type: 'workflow_tour', label: t('chat_cta_tour'), href: '#solutions' }
      },
      turns_near_limit: {
        title: t('chat_warning_turn_title'),
        message: t('chat_warning_desc'),
        primary: { type: 'auth_google', label: t('chat_auth_google'), href: '' },
        secondary: { type: 'continue_trial', label: t('chat_cta_final_turn'), href: '' },
        tertiary: { type: 'workflow_tour', label: t('chat_cta_tour'), href: '#solutions' }
      },
      turns_and_tts_near_limit: {
        title: t('chat_warning_turn_title'),
        message: t('chat_warning_desc'),
        primary: { type: 'auth_google', label: t('chat_auth_google'), href: '' },
        secondary: { type: 'continue_trial', label: t('chat_cta_final_turn'), href: '' },
        tertiary: { type: 'workflow_tour', label: t('chat_cta_tour'), href: '#solutions' }
      },
      tts_near_limit: {
        title: t('chat_warning_voice_title'),
        message: t('chat_warning_voice_desc'),
        primary: { type: 'continue_trial', label: t('chat_cta_continue'), href: '' },
        secondary: { type: 'workflow_tour', label: t('chat_cta_tour'), href: '#solutions' },
        tertiary: { type: 'book_call', label: t('chat_cta_book'), href: '#book' }
      },
      tts_last_preview: {
        title: t('chat_warning_voice_title'),
        message: t('chat_warning_voice_desc'),
        primary: { type: 'continue_trial', label: t('chat_cta_continue'), href: '' },
        secondary: { type: 'workflow_tour', label: t('chat_cta_tour'), href: '#solutions' },
        tertiary: { type: 'book_call', label: t('chat_cta_book'), href: '#book' }
      },
      tts_session_exhausted: {
        title: t('chat_warning_voice_unavailable_title'),
        message: t('chat_warning_voice_session_desc'),
        primary: { type: 'continue_trial', label: t('chat_cta_continue'), href: '' },
        secondary: { type: 'workflow_tour', label: t('chat_cta_tour'), href: '#solutions' },
        tertiary: { type: 'book_call', label: t('chat_cta_book'), href: '#book' }
      },
      tts_day_exhausted: {
        title: t('chat_warning_voice_unavailable_title'),
        message: t('chat_warning_voice_day_desc'),
        primary: { type: 'continue_trial', label: t('chat_cta_continue'), href: '' },
        secondary: { type: 'workflow_tour', label: t('chat_cta_tour'), href: '#solutions' },
        tertiary: { type: 'book_call', label: t('chat_cta_book'), href: '#book' }
      },
      tts_limit_reached: {
        title: t('chat_warning_voice_unavailable_title'),
        message: t('chat_warning_voice_session_desc'),
        primary: { type: 'continue_trial', label: t('chat_cta_continue'), href: '' },
        secondary: { type: 'workflow_tour', label: t('chat_cta_tour'), href: '#solutions' },
        tertiary: { type: 'book_call', label: t('chat_cta_book'), href: '#book' }
      }
    };

    var resolvedKind = kind;
    if ((kind === 'limit' || kind === 'turns_near_limit' || kind === 'turns_and_tts_near_limit') && !isAuthenticated()) {
      resolvedKind = kind === 'limit' ? 'auth_limit' : 'auth_soft';
    }
    var base = fallbackByKind[resolvedKind] || fallbackByKind[softWarningState] || fallbackByKind.limit;
    return {
      title: base.title,
      subtitle: base.message,
      message: base.message,
      primary: {
        type: (source.primary && source.primary.type) || base.primary.type,
        label: base.primary.label,
        href: (source.primary && source.primary.href) || base.primary.href
      },
      secondary: {
        type: (source.secondary && source.secondary.type) || base.secondary.type,
        label: base.secondary.label,
        href: (source.secondary && source.secondary.href) || base.secondary.href
      },
      tertiary: {
        type: (source.tertiary && source.tertiary.type) || base.tertiary.type,
        label: base.tertiary.label,
        href: (source.tertiary && source.tertiary.href) || base.tertiary.href
      }
    };
  }

  function setNotice(kind, payload, warningState) {
    state.notice = {
      kind: kind,
      payload: payload,
      warningState: warningState || 'none'
    };
    if (payload && payload.primary) trackCTA(payload.primary.type || 'primary', 'impression', kind + '_card');
    if (payload && payload.secondary) trackCTA(payload.secondary.type || 'secondary', 'impression', kind + '_card');
    if (payload && payload.tertiary) trackCTA(payload.tertiary.type || 'tertiary', 'impression', kind + '_card');
  }

  function clearNotice() {
    state.notice = null;
  }

  function relocalizeNotice() {
    if (!state.notice) return;
    var cardKind = state.notice.kind === 'limit' || state.notice.kind === 'auth'
      ? 'limit'
      : (state.notice.warningState || 'turns_near_limit');
    state.notice = {
      kind: state.notice.kind,
      warningState: state.notice.warningState || 'none',
      payload: localizeCtaPayload(cardKind, state.notice.payload, state.notice.warningState)
    };
  }

  function stopActiveAudio() {
    if (state.activeAudio) {
      state.activeAudio.pause();
      state.activeAudio = null;
    }
    if (state.activeAudioButton) {
      var icon = state.activeAudioButton.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = 'play_arrow';
      state.activeAudioButton.setAttribute('aria-pressed', 'false');
      state.activeAudioButton = null;
    }
    var prevPlayer = state.activeAudioPlayer;
    if (prevPlayer) prevPlayer.classList.remove('playing');
    state.activeAudioPlayer = null;
    state.activeAudioUrl = null;
  }

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function toggleAudio(url, button, playerEl) {
    if (!url) return;
    if (state.activeAudio && state.activeAudioUrl === url) {
      if (state.activeAudio.paused) {
        state.activeAudio.play().catch(function () {});
        var icon = button.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'pause';
        button.setAttribute('aria-pressed', 'true');
        if (playerEl) playerEl.classList.add('playing');
      } else {
        stopActiveAudio();
      }
      return;
    }

    stopActiveAudio();
    state.activeAudio = new Audio(url);
    state.activeAudioUrl = url;
    state.activeAudioButton = button;
    state.activeAudioPlayer = playerEl || null;
    var icon2 = button.querySelector('.material-symbols-outlined');
    if (icon2) icon2.textContent = 'pause';
    button.setAttribute('aria-pressed', 'true');
    if (playerEl) playerEl.classList.add('playing');

    var durationEl = playerEl ? playerEl.querySelector('.gc-audio-duration') : null;
    state.activeAudio.addEventListener('loadedmetadata', function () {
      if (durationEl) durationEl.textContent = formatDuration(state.activeAudio.duration);
    });
    state.activeAudio.addEventListener('timeupdate', function () {
      if (durationEl && state.activeAudio) {
        durationEl.textContent = formatDuration(state.activeAudio.currentTime);
      }
    });

    state.activeAudio.addEventListener('ended', stopActiveAudio, { once: true });
    state.activeAudio.play().catch(function () {
      stopActiveAudio();
      showToast(t('chat_error_msg'));
    });
  }


  function buildWidget() {
    var trigger = document.createElement('button');
    trigger.id = 'gc-chat-trigger';
    trigger.className = 'gc-chat-trigger';
    trigger.setAttribute('aria-label', t('chat_open_label'));
    trigger.innerHTML = [
      '<span class="material-symbols-outlined">smart_toy</span>',
      '<span class="gc-chat-trigger-label" id="gc-chat-trigger-label">' + escapeHTML(t('chat_trigger_label')) + '</span>',
      '<span class="gc-chat-trigger-badge"></span>'
    ].join('');
    document.body.appendChild(trigger);
    // Hide on workspace page (navigateTo already ran before widget built)
    var activePage = document.querySelector('[data-page].active');
    if (activePage && activePage.dataset.page === 'home') trigger.style.display = 'none';

    var scrim = document.createElement('div');
    scrim.id = 'gc-chat-scrim';
    scrim.className = 'gc-chat-scrim';
    document.body.appendChild(scrim);

    var panel = document.createElement('div');
    panel.id = 'gc-chat-panel';
    panel.className = 'gc-chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'GRINDCTRL Trial Playground');
    panel.setAttribute('tabindex', '-1');
    panel.innerHTML = buildPanelShell();
    document.body.appendChild(panel);

    var toast = document.createElement('div');
    toast.id = 'gc-toast';
    toast.className = 'gc-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toast);

    bindEvents();
    initAuthClient();
    renderAll();
    if (shouldResumeAuthPlayground()) {
      openChat();
    }
  }

  function buildPanelShell() {
    var logoSrc = document.documentElement.classList.contains('dark') ? 'logo-dark.svg' : 'logo-light.svg';

    return [
      '<div class="gc-chat-header">',
      '  <div class="gc-chat-header-brand">',
      '    <div class="gc-chat-header-logo"><img id="gc-logo-img" src="' + logoSrc + '" alt="GRINDCTRL"/></div>',
      '    <div class="gc-chat-header-copy">',
      '      <div class="gc-chat-header-name-row">',
      '        <span class="gc-chat-header-name">GRINDCTRL</span>',
      '        <span class="gc-chat-header-badge" id="gc-header-badge">' + t('chat_trial_agent') + '</span>',
      '      </div>',
      '      <div class="gc-chat-header-subtitle" id="gc-header-subtitle"></div>',
      '    </div>',
      '  </div>',
      '  <div class="gc-chat-header-actions">',
      '    <div id="gc-turns-pill" class="gc-turns-pill"></div>',
      '    <button id="gc-close" class="gc-chat-close" aria-label="' + t('chat_close_label') + '"><span class="material-symbols-outlined">close</span><span class="gc-btn-label">' + escapeHTML(t('chat_close_label')) + '</span></button>',
      '  </div>',
      '</div>',
      '<div id="gc-chat-body" class="gc-chat-body">',
      '  <section id="gc-chat-intro" class="gc-chat-intro"></section>',
      '  <section class="gc-chat-stage">',
      '    <div id="gc-chat-list" class="gc-chat-list" aria-live="polite"></div>',
      '  </section>',
      '</div>',
      '<div class="gc-drop-zone" id="gc-drop-zone">',
      '  <span class="material-symbols-outlined gc-drop-zone-icon">audio_file</span>',
      '  <span class="gc-drop-zone-text">' + t('chat_drop_audio') + '</span>',
      '</div>',
      '<div id="gc-input-area" class="gc-chat-input-area">',
      '  <div class="gc-chat-input-shell">',
      '    <div id="gc-composer-utility" class="gc-composer-utility"></div>',
      '    <div id="gc-recording-bar" class="gc-recording-bar">',
      '      <span class="gc-recording-dot"></span>',
      '      <span class="gc-recording-label">' + t('chat_recording') + '</span>',
      '      <span id="gc-rec-timer" class="gc-recording-timer">0:00</span>',
      '      <button id="gc-rec-cancel" class="gc-recording-cancel" type="button">' + t('chat_cancel') + '</button>',
      '    </div>',
      '    <div class="gc-chat-input-row">',
      '      <textarea id="gc-textarea" class="gc-chat-textarea" rows="1" maxlength="' + CONFIG.MAX_MSG_LEN + '" dir="auto"></textarea>',
      '      <input type="file" id="gc-file-input" accept="audio/*" class="gc-hidden" aria-hidden="true"/>',
      '      <button id="gc-attach-btn" class="gc-input-btn" type="button" aria-label="' + t('chat_attach_label') + '" title="' + t('chat_attach_label') + '"><span class="material-symbols-outlined">attach_file</span><span class="gc-btn-label">' + escapeHTML(t('chat_attach_label')) + '</span></button>',
      '      <button id="gc-mic-btn" class="gc-input-btn gc-input-btn-mic" type="button" aria-label="' + t('chat_mic_label') + '" title="' + t('chat_mic_label') + '"><span class="material-symbols-outlined">mic</span><span class="gc-btn-label">' + escapeHTML(t('chat_mic_label')) + '</span></button>',
      '      <button id="gc-send-btn" class="gc-input-btn gc-input-btn-send" type="button" aria-label="' + t('chat_send_label') + '" title="' + t('chat_send_label') + '"><span class="material-symbols-outlined">arrow_upward</span><span class="gc-btn-label">' + escapeHTML(t('chat_send_label')) + '</span></button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderAll() {
    relocalizeNotice();
    renderChrome();
    renderHeader();
    renderIntro();
    renderMessages();
    renderNotice();
    renderComposer();
  }

  function renderChrome() {
    var trigger = $('gc-chat-trigger');
    var panel = $('gc-chat-panel');
    var closeButton = $('gc-close');
    var triggerLabel = $('gc-chat-trigger-label');
    var recordingLabel = document.querySelector('.gc-recording-label');
    var cancelButton = $('gc-rec-cancel');
    var dropZoneText = document.querySelector('.gc-drop-zone-text');
    var attachButton = $('gc-attach-btn');
    var micButton = $('gc-mic-btn');
    var sendButton = $('gc-send-btn');

    if (trigger) trigger.setAttribute('aria-label', t('chat_open_label'));
    if (triggerLabel) triggerLabel.textContent = t('chat_trigger_label');
    if (panel) panel.setAttribute('aria-label', t('chat_empty_title'));
    if (closeButton) {
      closeButton.setAttribute('aria-label', t('chat_close_label'));
      var closeBtnLabel = closeButton.querySelector('.gc-btn-label');
      if (closeBtnLabel) closeBtnLabel.textContent = t('chat_close_label');
    }
    if (recordingLabel) recordingLabel.textContent = t('chat_recording');
    if (cancelButton) cancelButton.textContent = t('chat_cancel');
    if (dropZoneText) dropZoneText.textContent = t('chat_drop_audio');

    if (attachButton) {
      attachButton.setAttribute('aria-label', t('chat_attach_label'));
      attachButton.setAttribute('title', t('chat_attach_label'));
      var attachLabel = attachButton.querySelector('.gc-btn-label');
      if (attachLabel) attachLabel.textContent = t('chat_attach_label');
    }
    if (micButton) {
      micButton.setAttribute('aria-label', t('chat_mic_label'));
      micButton.setAttribute('title', t('chat_mic_label'));
      var micLabel = micButton.querySelector('.gc-btn-label');
      if (micLabel) micLabel.textContent = t('chat_mic_label');
    }
    if (sendButton) {
      sendButton.setAttribute('aria-label', t('chat_send_label'));
      sendButton.setAttribute('title', t('chat_send_label'));
      var sendLabel = sendButton.querySelector('.gc-btn-label');
      if (sendLabel) sendLabel.textContent = t('chat_send_label');
    }
  }

  function renderHeader() {
    var subtitle = $('gc-header-subtitle');
    var turnsPill = $('gc-turns-pill');
    var logo = $('gc-logo-img');
    var badge = $('gc-header-badge');
    var authLabel = isAuthenticated() ? t('chat_auth_member_mode') : t('chat_auth_guest_mode');
    var replyLanguageLabel = getReplyLanguage() === 'ar' ? t('chat_lang_ar') : t('chat_lang_en');

    if (subtitle) {
      subtitle.textContent = authLabel + ' · ' + t('chat_reply_language') + ': ' + replyLanguageLabel;
    }
    if (logo) logo.src = document.documentElement.classList.contains('dark') ? 'logo-dark.svg' : 'logo-light.svg';
    if (badge) badge.textContent = state.imageMode ? t('chat_create_mode') : t('chat_mode_chat');
    if (!turnsPill) return;

    turnsPill.className = 'gc-turns-pill' + (isNearTurnLimit() ? ' warning' : '');
    turnsPill.innerHTML = [
      '<span class="gc-turns-pill-value">' + escapeHTML(String(remainingTurnsValue())) + '</span>',
      '<span class="gc-turns-pill-label">' + escapeHTML(remainingTurnsLabel()) + '</span>'
    ].join('');
  }

  function renderIntro() {
    var intro = $('gc-chat-intro');
    if (!intro) return;

    var compact = state.messages.length > 0;
    intro.className = 'gc-chat-intro' + (compact ? ' gc-hidden' : '');

    if (compact) {
      intro.innerHTML = '';
      return;
    }

    intro.innerHTML = [
      '<div class="gc-chat-intro-copy gc-chat-intro-copy-center">',
      '  <div class="gc-chat-intro-title">' + escapeHTML(t('chat_empty_title')) + '</div>',
      '  <div class="gc-chat-intro-desc">' + escapeHTML(t('chat_empty_desc')) + '</div>',
      '</div>'
    ].join('');
  }

  function renderComposerUtility(emptyMode, disabled) {
    var hearDisabled = !state.quota.ttsAvailable;
    var replyLang = getReplyLanguage();
    var prompts = getPromptList().slice(0, 4);
    var busyClass = disabled ? ' gc-utility-row-disabled' : '';
    var voiceReplyDisabled = hearDisabled || disabled;
    var createDisabled = !state.quota.imageGenAvailable || disabled;
    var disabledAttr = disabled ? ' disabled aria-disabled="true"' : '';
    var utilityRow = [
      '<div class="gc-utility-row' + busyClass + '">',
      '  <button type="button" class="gc-utility-chip gc-utility-chip-toggle' + (state.wantsVoiceReply ? ' active' : '') + (voiceReplyDisabled ? ' disabled' : '') + '" data-action="toggle-hear" aria-pressed="' + escapeHTML(String(!!state.wantsVoiceReply)) + '"' + (voiceReplyDisabled ? ' disabled aria-disabled="true"' : '') + '>',
      '    <span class="material-symbols-outlined">' + (state.wantsVoiceReply ? 'volume_up' : 'volume_off') + '</span>',
      '    <span>' + escapeHTML(t('chat_voice_preview_setting')) + ' · ' + (hearDisabled ? escapeHTML(t('chat_hear_unavailable')) : escapeHTML(state.wantsVoiceReply ? t('chat_hear_on') : t('chat_hear_off'))) + '</span>',
      '  </button>',
      '  <button type="button" class="gc-utility-chip' + (state.imageMode ? ' active' : '') + (createDisabled ? ' disabled' : '') + '" data-action="enter-create-mode" aria-pressed="' + escapeHTML(String(!!state.imageMode)) + '"' + (createDisabled ? ' disabled aria-disabled="true"' : '') + '>',
      '    <span class="material-symbols-outlined">auto_awesome</span>',
      '    <span>' + escapeHTML(t('chat_cap_create')) + '</span>',
      '  </button>',
      '  <div class="gc-segmented-control gc-composer-language" role="group" aria-label="' + escapeHTML(t('chat_reply_language')) + '">',
      '    <button type="button" class="gc-segmented-btn' + (replyLang === 'en' ? ' active' : '') + '" data-action="set-reply-language" data-language="en" aria-pressed="' + escapeHTML(String(replyLang === 'en')) + '"' + disabledAttr + '>' + escapeHTML(t('chat_lang_en')) + '</button>',
      '    <button type="button" class="gc-segmented-btn' + (replyLang === 'ar' ? ' active' : '') + '" data-action="set-reply-language" data-language="ar" aria-pressed="' + escapeHTML(String(replyLang === 'ar')) + '"' + disabledAttr + '>' + escapeHTML(t('chat_lang_ar')) + '</button>',
      '  </div>',
      '</div>'
    ].join('');

    if (!emptyMode) return utilityRow;

    return [
      '<div class="gc-prompt-row" role="list">',
      prompts.map(function (prompt, index) {
        return '<button class="gc-prompt-chip" type="button" role="listitem" data-action="prompt" data-prompt-index="' + index + '">' + escapeHTML(prompt) + '</button>';
      }).join(''),
      '</div>',
      utilityRow
    ].join('');
  }

  function renderAuthCard(entry) {
    var payload = entry.payload || {};
    var showCodeField = state.auth.status === 'email_sent' || state.auth.code;
    var helperText = state.auth.helper || t('chat_auth_secure_note');

    return [
      '<div class="gc-system-card limit gc-auth-card">',
      '  <div class="gc-system-card-icon"><span class="material-symbols-outlined">lock_open</span></div>',
      '  <div class="gc-system-card-body">',
      '    <div class="gc-system-card-title">' + escapeHTML(payload.title || t('chat_auth_title_limit')) + '</div>',
      '    <div class="gc-system-card-desc">' + escapeHTML(payload.message || t('chat_auth_desc_limit')) + '</div>',
      '    <div class="gc-system-card-actions gc-auth-actions">',
      '      <button type="button" class="gc-system-card-primary" data-action="auth-google">' + escapeHTML(t('chat_auth_google')) + '</button>',
      '      <button type="button" class="gc-system-card-secondary" data-action="auth-email">' + escapeHTML(t('chat_auth_email')) + '</button>',
      payload.tertiary ? '<button type="button" class="gc-system-card-secondary tertiary" data-action="cta" data-cta-type="' + escapeHTML(payload.tertiary.type || 'workflow_tour') + '" data-cta-href="' + escapeHTML(payload.tertiary.href || '#solutions') + '">' + escapeHTML(payload.tertiary.label || t('chat_cta_tour')) + '</button>' : '',
      '    </div>',
      '    <div class="gc-auth-form">',
      '      <label class="gc-auth-label" for="gc-auth-email">' + escapeHTML(t('chat_auth_email_label')) + '</label>',
      '      <div class="gc-auth-row">',
      '        <input id="gc-auth-email" class="gc-auth-input" type="email" inputmode="email" autocomplete="email" value="' + escapeHTML(state.auth.email || '') + '" placeholder="' + escapeHTML(t('chat_auth_email_placeholder')) + '"/>',
      '        <button type="button" class="gc-auth-inline-btn" data-action="auth-email-send">' + escapeHTML(t('chat_auth_send')) + '</button>',
      '      </div>',
      '      <div class="gc-auth-note">' + escapeHTML(t('chat_auth_magic_note')) + '</div>',
      showCodeField ? (
        '      <label class="gc-auth-label" for="gc-auth-code">' + escapeHTML(t('chat_auth_code_label')) + '</label>' +
        '      <div class="gc-auth-row">' +
        '        <input id="gc-auth-code" class="gc-auth-input gc-auth-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" value="' + escapeHTML(state.auth.code || '') + '" placeholder="' + escapeHTML(t('chat_auth_code_placeholder')) + '"/>' +
        '        <button type="button" class="gc-auth-inline-btn" data-action="auth-email-verify">' + escapeHTML(t('chat_auth_verify')) + '</button>' +
        '      </div>'
      ) : '',
      '    </div>',
      '    <div class="gc-system-card-fine">' + escapeHTML(helperText) + '</div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderSystemCard(entry) {
    var payload = entry.payload || {};
    var isAuthCard = !isAuthenticated() && (entry.kind === 'auth' || (payload.primary && payload.primary.type === 'auth_google'));
    if (isAuthCard) return renderAuthCard(entry);

    var cardKind = entry.kind === 'limit' ? ' limit' : ' soft';
    var icon = entry.kind === 'limit' ? 'auto_awesome' : 'lightbulb';

    var primaryAction = '';
    if (payload.primary) {
      if (entry.kind !== 'limit' && payload.primary.type === 'continue_trial') {
        primaryAction = '<button type="button" class="gc-system-card-primary" data-action="dismiss-warning">' + escapeHTML(t('chat_nudge_dismiss')) + '</button>';
      } else {
        primaryAction = '<button type="button" class="gc-system-card-primary" data-action="cta" data-cta-type="' + escapeHTML(payload.primary.type || 'primary') + '" data-cta-href="' + escapeHTML(payload.primary.href || '') + '">' + escapeHTML(payload.primary.label || '') + '</button>';
      }
    }

    return [
      '<div class="gc-system-card' + cardKind + '">',
      '  <div class="gc-system-card-icon"><span class="material-symbols-outlined">' + icon + '</span></div>',
      '  <div class="gc-system-card-body">',
      '    <div class="gc-system-card-title">' + escapeHTML(payload.title || '') + '</div>',
      '    <div class="gc-system-card-desc">' + escapeHTML(payload.message || payload.subtitle || '') + '</div>',
      '    <div class="gc-system-card-actions">',
      primaryAction,
      payload.secondary ? '<button type="button" class="gc-system-card-secondary" data-action="cta" data-cta-type="' + escapeHTML(payload.secondary.type || 'secondary') + '" data-cta-href="' + escapeHTML(payload.secondary.href || '') + '">' + escapeHTML(payload.secondary.label || '') + '</button>' : '',
      payload.tertiary ? '<button type="button" class="gc-system-card-secondary tertiary" data-action="cta" data-cta-type="' + escapeHTML(payload.tertiary.type || 'tertiary') + '" data-cta-href="' + escapeHTML(payload.tertiary.href || '') + '">' + escapeHTML(payload.tertiary.label || '') + '</button>' : '',
      '    </div>',
      '    <div class="gc-system-card-fine">' + escapeHTML(t('chat_limit_fine')) + '</div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function buildAudioPlayerHTML(audioUrl) {
    var bars = '';
    var heights = [14, 20, 10, 24, 16, 22, 12, 18, 26, 14, 20, 8, 22, 16, 24, 12, 18, 28, 14, 20, 10, 22, 16, 24];
    for (var i = 0; i < heights.length; i++) {
      var delay = (i * 0.07).toFixed(2);
      bars += '<span class="gc-audio-waveform-bar" style="height:' + heights[i] + 'px;animation-delay:' + delay + 's"></span>';
    }

    return [
      '<div class="gc-audio-player" data-audio-url="' + escapeHTML(audioUrl) + '">',
      '  <button type="button" class="gc-audio-player-btn" data-action="play-audio" data-audio-url="' + escapeHTML(audioUrl) + '" aria-label="' + escapeHTML(t('chat_play_reply')) + '" aria-pressed="false">',
      '    <span class="material-symbols-outlined">play_arrow</span>',
      '  </button>',
      '  <div class="gc-audio-waveform">' + bars + '</div>',
      '  <span class="gc-audio-duration">0:00</span>',
      '</div>'
    ].join('');
  }

  function renderNotice() {
    return;
  }

  function isAllowedAudioFile(file) {
    var fileType = String(file && file.type || '').toLowerCase();
    return !!fileType && CONFIG.AUDIO_TYPES.indexOf(fileType) !== -1;
  }

  function renderImageResultCard(entry) {
    var result = entry.imageResult;
    var dataUri = 'data:' + (result.mime || 'image/png') + ';base64,' + result.base64;
    var failed = result.status === 'failed';

    if (failed) {
      return [
        '<div class="gc-msg gc-msg-ai">',
        '  <div class="gc-msg-ai-label"><div class="gc-msg-ai-avatar">AI</div><span class="gc-msg-ai-name">GRINDCTRL</span></div>',
        '  <div class="gc-image-failed-card">',
        '    <span class="material-symbols-outlined">broken_image</span>',
        '    <div class="gc-image-failed-text">' + escapeHTML(t('chat_image_failed')) + '</div>',
        '    <div class="gc-image-result-actions">',
        '      <button type="button" class="gc-image-action-btn" data-action="image-retry" data-image-prompt="' + escapeHTML(result.prompt || '') + '"><span class="material-symbols-outlined">refresh</span>' + escapeHTML(t('chat_image_retry')) + '</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    return [
      '<div class="gc-msg gc-msg-ai">',
      '  <div class="gc-msg-ai-label"><div class="gc-msg-ai-avatar">AI</div><span class="gc-msg-ai-name">GRINDCTRL</span></div>',
      '  <div class="gc-image-result-card">',
      '    <div class="gc-image-result-header"><span class="material-symbols-outlined">auto_awesome</span><span class="gc-image-result-ready">' + escapeHTML(t('chat_image_ready')) + '</span></div>',
      '    <div class="gc-image-result-img-wrap"><img class="gc-image-result-img" src="' + dataUri + '" alt="' + escapeHTML(result.prompt || 'Generated image') + '" loading="lazy"/></div>',
      '    <div class="gc-image-result-prompt-echo"><span class="gc-image-result-prompt-label">' + escapeHTML(t('chat_image_prompt_label')) + '</span><span class="gc-image-result-prompt-text" dir="auto">' + escapeHTML(result.prompt || '') + '</span></div>',
      '    <div class="gc-image-result-actions">',
      '      <button type="button" class="gc-image-action-btn" data-action="image-open" data-image-uri="' + escapeHTML(dataUri) + '"><span class="material-symbols-outlined">open_in_new</span>' + escapeHTML(t('chat_image_open')) + '</button>',
      '      <a class="gc-image-action-btn" href="' + dataUri + '" download="grindctrl-image.png"><span class="material-symbols-outlined">download</span>' + escapeHTML(t('chat_image_save')) + '</a>',
      '      <button type="button" class="gc-image-action-btn" data-action="image-retry" data-image-prompt="' + escapeHTML(result.prompt || '') + '"><span class="material-symbols-outlined">refresh</span>' + escapeHTML(t('chat_image_retry')) + '</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderMessage(entry) {
    if (entry.role === 'system') return renderSystemCard(entry);
    if (entry.imageResult) return renderImageResultCard(entry);

    var isUser = entry.role === 'user';
    var actions = '';
    var meta = '';

    if (!isUser) {
      var replyLang = normalizeLang(entry.replyLanguage || getReplyLanguage());
      var replyLangLabel = replyLang === 'ar' ? t('chat_lang_ar') : t('chat_lang_en');
      meta = '<div class="gc-msg-ai-label"><div class="gc-msg-ai-avatar">AI</div><span class="gc-msg-ai-name">GRINDCTRL</span></div>';

      if (entry.voiceOnlyReply && entry.ttsAudioUrl) {
        return [
          '<div class="gc-msg gc-msg-ai">',
          meta,
          '  <div class="gc-msg-bubble gc-voice-only-bubble" dir="auto">',
          '    <div class="gc-voice-label"><span class="material-symbols-outlined">graphic_eq</span><span>' + escapeHTML(t('chat_voice_reply')) + '</span></div>',
          '    ' + buildAudioPlayerHTML(entry.ttsAudioUrl),
          '  </div>',
          '  <div class="gc-msg-actions"><span class="gc-msg-meta-chip">' + escapeHTML(t('chat_reply_language')) + ': ' + escapeHTML(replyLangLabel) + '</span></div>',
          '</div>'
        ].join('');
      }

      var actionBits = [
        '<span class="gc-msg-meta-chip">' + escapeHTML(t('chat_reply_language')) + ': ' + escapeHTML(replyLangLabel) + '</span>'
      ];
      if (entry.ttsAudioUrl) {
        actionBits.push(buildAudioPlayerHTML(entry.ttsAudioUrl));
      }
      actions = '<div class="gc-msg-actions">' + actionBits.join('') + '</div>';
    }

    if (isUser && entry.voice) {
      var transcriptBody = entry.transcriptPending ? escapeHTML(t('chat_transcript_pending')) : formatMessageHTML(entry.content || '');
      var transcriptClass = 'gc-transcript-text gc-transcript-text-inline gc-user-transcript' + (entry.transcriptPending ? ' pending' : '');
      var audioPlayer = entry.audioUrl ? buildAudioPlayerHTML(entry.audioUrl) : '';
      return [
        '<div class="gc-msg gc-msg-user">',
        '  <div class="gc-msg-bubble gc-voice-note-bubble" dir="auto">',
        '    <div class="gc-voice-note-header">',
        '      <div class="gc-voice-label"><span class="material-symbols-outlined">mic</span><span>' + escapeHTML(t('chat_voice')) + '</span></div>',
        '    </div>',
        audioPlayer ? '    ' + audioPlayer : '',
        (entry.transcriptPending || entry.content) ? '    <div class="' + transcriptClass + '" dir="auto"><span class="gc-transcript-label">' + escapeHTML(t('chat_transcript_label')) + '</span>' + transcriptBody + '</div>' : '',
        '  </div>',
        '</div>'
      ].join('');
    }

    return [
      '<div class="gc-msg gc-msg-' + (isUser ? 'user' : 'ai') + '">',
      meta,
      '  <div class="gc-msg-bubble" dir="auto">' + formatMessageHTML(entry.content) + '</div>',
      actions,
      '</div>'
    ].join('');
  }

  function renderMessages() {
    var list = $('gc-chat-list');
    if (!list) return;

    // Reset list if needed
    if (state.renderedCount === 0) {
      list.innerHTML = '';
    }

    // Incremental append
    if (state.messages.length > state.renderedCount) {
      var newMsgs = state.messages.slice(state.renderedCount);
      var tmp = document.createElement('div');
      tmp.innerHTML = newMsgs.map(renderMessage).join('');
      while (tmp.firstChild) {
        list.appendChild(tmp.firstChild);
      }
      state.renderedCount = state.messages.length;
      scrollToBottom();
    }

    updateStatusArea();

    // Sync audio button states
    if (state.activeAudio && state.activeAudioUrl) {
      var btn = list.querySelector('[data-action="play-audio"][data-audio-url="' + escapeSelectorValue(state.activeAudioUrl) + '"]');
      if (btn) {
        var icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = 'pause';
        btn.setAttribute('aria-pressed', 'true');
        state.activeAudioButton = btn;
        var player = btn.closest('.gc-audio-player');
        if (player) {
          player.classList.add('playing');
          state.activeAudioPlayer = player;
        }
      }
    }
  }

  function updateStatusArea() {
    var list = $('gc-chat-list');
    if (!list) return;
    
    var wrap = $('gc-status-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'gc-status-wrap';
      list.after(wrap);
    }

    var html = '';
    if (state.notice) {
      html += renderSystemCard({
        role: 'system',
        kind: state.notice.kind,
        payload: state.notice.payload,
        warningState: state.notice.warningState
      });
    }

    if (state.historyLoading) {
      html += '<div class="gc-status-row"><span class="material-symbols-outlined gc-spin">history</span><span>' + escapeHTML(t('chat_loading_history')) + '</span></div>';
    } else if (state.phase === 'generating_image') {
      html += '<div class="gc-status-row"><span class="material-symbols-outlined gc-anim-float">auto_awesome</span><span>' + escapeHTML(t('chat_generating_image')) + '</span></div>';
    } else if (state.phase === 'responding') {
      html += '<div class="gc-status-row"><span class="material-symbols-outlined gc-anim-pulse">auto_awesome</span><span>' + escapeHTML(t('chat_generating_status')) + '</span></div>';
    } else if (state.phase === 'transcribing') {
      html += '<div class="gc-status-row"><span class="material-symbols-outlined gc-anim-wave">graphic_eq</span><span>' + escapeHTML(t('chat_transcribing_status')) + '</span></div>';
    }

    wrap.innerHTML = html;
    if (html !== '') scrollToBottom();
  }

  function renderComposer() {
    var textarea = $('gc-textarea');
    var sendBtn = $('gc-send-btn');
    var micBtn = $('gc-mic-btn');
    var attachBtn = $('gc-attach-btn');
    var inputArea = $('gc-input-area');
    var panel = $('gc-chat-panel');
    var inputRow = document.querySelector('.gc-chat-input-row');
    var utility = $('gc-composer-utility');
    var recordingBar = $('gc-recording-bar');
    var disabled = state.phase === 'limit' || state.phase === 'sending' || state.phase === 'responding' || state.phase === 'transcribing' || state.phase === 'generating_image';
    var inLimitMode = state.phase === 'limit';
    var emptyMode = !state.messages.length && !state.historyLoading && !inLimitMode && !state.imageMode && state.phase !== 'responding' && state.phase !== 'transcribing' && state.phase !== 'generating_image';

    if (textarea) {
      textarea.placeholder = state.imageMode ? t('chat_create_placeholder') : t('chat_placeholder');
      textarea.disabled = inLimitMode;
      textarea.setAttribute('aria-label', state.imageMode ? t('chat_create_placeholder') : t('chat_placeholder'));
    }

    if (sendBtn && textarea) {
      sendBtn.disabled = disabled || textarea.value.trim() === '';
    }

    if (micBtn) {
      micBtn.disabled = disabled && state.phase !== 'recording';
      micBtn.classList.toggle('recording', state.phase === 'recording');
      micBtn.querySelector('.material-symbols-outlined').textContent = state.phase === 'recording' ? 'stop' : 'mic';
    }

    if (attachBtn) attachBtn.disabled = disabled;
    if (inputArea) inputArea.classList.toggle('disabled', false);
    if (inputArea) inputArea.classList.toggle('gc-hidden', inLimitMode);
    if (inputArea) inputArea.classList.toggle('gc-chat-input-area-empty', emptyMode);
    if (panel) panel.classList.toggle('gc-chat-panel-empty', emptyMode);
    if (inputRow) inputRow.classList.toggle('gc-hidden', inLimitMode);
    if (recordingBar) {
      recordingBar.classList.toggle('active', state.phase === 'recording' && !inLimitMode);
      recordingBar.classList.toggle('gc-hidden', inLimitMode);
    }

    if (utility) {
      if (inLimitMode) {
        utility.innerHTML = '';
      } else if (state.imageMode) {
        utility.innerHTML = [
          '<div class="gc-create-mode-bar">',
          '  <div class="gc-create-mode-info">',
          '    <span class="material-symbols-outlined">auto_awesome</span>',
          '    <span class="gc-create-mode-label">' + escapeHTML(t('chat_create_mode')) + '</span>',
          '    <span class="gc-create-mode-hint">' + escapeHTML(t('chat_create_desc')) + '</span>',
          '  </div>',
          '  <button type="button" class="gc-create-mode-exit" data-action="exit-create-mode">',
            '    <span class="material-symbols-outlined">arrow_back</span>',
          '    <span>' + escapeHTML(t('chat_exit_create')) + '</span>',
          '  </button>',
          '</div>'
        ].join('');
      } else {
        utility.innerHTML = renderComposerUtility(emptyMode, disabled);
      }
    }
  }

  function scrollToBottom() {
    var body = $('gc-chat-body');
    if (!body) return;
    requestAnimationFrame(function () {
      body.scrollTo({
        top: body.scrollHeight,
        behavior: 'smooth'
      });
    });
  }

  function showToast(message) {
    var toast = $('gc-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timerId);
    showToast.timerId = setTimeout(function () {
      toast.classList.remove('show');
    }, 3200);
  }

  function showError(message) {
    showToast(message || t('chat_error_msg'));
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  async function startGoogleAuth() {
    var client = initAuthClient();
    if (!client) {
      showError();
      return;
    }
    setAuthHelper('loading', t('chat_auth_connecting'));
    renderAll();
    var result = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl()
      }
    });
    if (result && result.error) {
      setAuthHelper('error', result.error.message || t('chat_error_msg'));
      renderAll();
    }
  }

  async function submitAuthEmail() {
    var client = initAuthClient();
    var email = String(state.auth.email || '').trim();
    if (!client) {
      showError();
      return;
    }
    if (!isValidEmail(email)) {
      setAuthHelper('error', t('chat_auth_email_invalid'));
      renderAll();
      return;
    }

    setAuthHelper('loading', t('chat_auth_sending'));
    renderAll();
    var result = await client.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: getAuthRedirectUrl()
      }
    });
    if (result && result.error) {
      setAuthHelper('error', t('chat_auth_send_failed'));
      renderAll();
      return;
    }

    setAuthHelper('email_sent', t('chat_auth_check_email'));
    renderAll();
  }

  async function verifyAuthEmailCode() {
    var client = initAuthClient();
    var email = String(state.auth.email || '').trim();
    var code = String(state.auth.code || '').trim();
    if (!client || !isValidEmail(email) || !code) {
      setAuthHelper('error', !isValidEmail(email) ? t('chat_auth_email_invalid') : t('chat_auth_verify_failed'));
      renderAll();
      return;
    }

    setAuthHelper('loading', t('chat_auth_verifying'));
    renderAll();
    var result = await client.auth.verifyOtp({
      email: email,
      token: code,
      type: 'email'
    });
    if (result && result.error) {
      setAuthHelper('error', t('chat_auth_verify_failed'));
      renderAll();
      return;
    }
  }

  function navigateCTA(type, href) {
    if (type === 'continue_trial') {
      clearNotice();
      state.phase = 'open';
      renderAll();
      if ($('gc-textarea')) $('gc-textarea').focus();
      return;
    }

    if (href && href.indexOf('mailto:') === 0) {
      window.open(href, '_blank');
      closeChat();
      return;
    }

    if (href && href.charAt(0) === '#') {
      var link = document.createElement('a');
      link.href = href;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      closeChat();
      return;
    }

    if (href) {
      window.location.href = href;
      return;
    }
  }

  async function sendImagePrompt(prompt) {
    if (state.phase === 'sending' || state.phase === 'responding' || state.phase === 'generating_image' || state.phase === 'limit') return;
    if (!state.quota.imageGenAvailable) {
      showToast(t('chat_image_quota_exhausted'));
      return;
    }

    await ensureSession();
    if (!state.sessionId) {
      showError('Could not create session.');
      return;
    }

    clearNotice();
    pushMessage({
      role: 'user',
      content: prompt,
      imagePrompt: true
    });
    state.phase = 'generating_image';
    state.imageMode = false;
    renderAll();

    var payload = {
      action: 'image_generate',
      session_id: state.sessionId,
      user_id: isAuthenticated() ? state.auth.user.id : null,
      prompt: prompt,
      model: CONFIG.IMAGE_GEN_MODEL,
      language: currentLang(),
      locale: currentLang(),
      direction: currentDir(),
      fingerprint_hash: state.fingerprint,
      source_page: location.href || 'landing'
    };

    try {
      var response = await fetch(CONFIG.N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = {};
      try { data = await response.json(); } catch (error) {}

      if (response.status === 429) {
        updateQuotaFromResponse(data);
        state.quota.imageGenAvailable = false;
        state.phase = 'open';
        state.messages.pop();
        renderAll();
        showToast(data.message || t('chat_image_quota_exhausted'));
        return;
      }

      if (!response.ok) {
        state.phase = 'open';
        state.messages.pop();
        renderAll();
        showError(data.message || t('chat_image_failed'));
        return;
      }

      updateQuotaFromResponse(data);
      pushMessage({
        role: 'assistant',
        imageResult: {
          base64: data.image_base64 || '',
          mime: data.image_mime || 'image/png',
          prompt: data.prompt || prompt,
          status: data.status === 'failed' ? 'failed' : 'completed'
        }
      });

      state.phase = 'open';
      trackEvent('image_gen_complete', { prompt: prompt });
      renderAll();
    } catch (networkError) {
      state.phase = 'open';
      state.messages.pop();
      renderAll();
      showError();
      trackEvent('error', { error: networkError.message || 'image_gen_network_error' });
    }
  }

  async function sendMessage(text, contentType) {
    if (state.phase === 'sending' || state.phase === 'responding' || state.phase === 'generating_image' || state.phase === 'limit') return;

    await ensureSession();
    if (!state.sessionId) {
      showError('Could not create session.');
      return;
    }

    clearNotice();
    pushMessage({
      role: 'user',
      content: text,
      voice: contentType === 'voice'
    });
    state.phase = 'responding';
    renderAll();

    var payload = {
      session_id: state.sessionId,
      user_id: isAuthenticated() ? state.auth.user.id : null,
      message: text,
      content_type: contentType || 'text',
      modality: contentType === 'voice' ? 'voice' : 'text',
      language: currentLang(),
      locale: currentLang(),
      direction: currentDir(),
      fingerprint_hash: state.fingerprint,
      source_page: location.href || 'landing',
      turn_number: state.turnsUsed + 1,
      history: getHistory().slice(0, -1),
      wants_voice_reply: state.wantsVoiceReply,
      reply_language: getReplyLanguage()
    };

    try {
      var response = await fetch(CONFIG.N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload)
      }).catch(function(err) {
        console.warn('CORS or Network error during sendMessage:', err);
        return { ok: false, status: 'cors_or_network_error' };
      });

      var data = {};
      if (response && response.status !== 'cors_or_network_error') {
        try { data = await response.json(); } catch (error) {}
      }

      if (!response || response.status === 'cors_or_network_error') {
        state.phase = 'open';
        renderAll();
        showError(t('chat_error_msg'));
        return;
      }

      if (response.status === 409) {
        state.phase = 'open';
        state.messages.pop();
        renderAll();
        showError(data.message || t('chat_active_conflict'));
        return;
      }

      if (response.status === 429) {
        updateQuotaFromResponse(data);
        if (data.status === 'limit_exceeded' || data.limit_state === 'session_limit' || data.limit_state === 'rolling_24h_limit') {
          state.phase = 'limit';
          setNotice('limit', localizeCtaPayload('limit', data.cta_payload, data.soft_warning_state), data.soft_warning_state);
          renderAll();
          return;
        }

        state.phase = 'open';
        state.messages.pop();
        renderAll();
        showToast(data.message || t('chat_rate_limited'));
        return;
      }

      if (!response.ok) {
        state.phase = 'open';
        state.messages.pop();
        renderAll();
        showError(data.message || t('chat_error_msg'));
        return;
      }

      updateQuotaFromResponse(data);
      var assistantTtsUrl = data.tts_audio_url || null;
      var voiceOnlyReply = shouldUseVoiceOnlyReply(data, assistantTtsUrl);
      pushMessage({
        role: 'assistant',
        content: resolveAssistantContent(data, voiceOnlyReply),
        replyLanguage: data.reply_language || getReplyLanguage(),
        ttsAudioUrl: assistantTtsUrl,
        voiceOnlyReply: voiceOnlyReply
      });

      if (noTurnsRemaining()) {
        state.phase = 'limit';
        setNotice('limit', localizeCtaPayload('limit', data.cta_payload, data.soft_warning_state), data.soft_warning_state);
      } else {
        state.phase = 'open';
        if (data.soft_warning_state && data.soft_warning_state !== 'none' && !state.dismissedWarnings[data.soft_warning_state]) {
          setNotice('soft_warning', localizeCtaPayload(data.soft_warning_state, data.cta_payload, data.soft_warning_state), data.soft_warning_state);
        }
      }

      renderAll();
    } catch (networkError) {
      state.phase = 'open';
      state.messages.pop();
      renderAll();
      showError();
      trackEvent('error', { error: networkError.message || 'network_error' });
    }
  }

  async function handleAudioBlob(blob) {
    if (blob.size > CONFIG.MAX_AUDIO_BYTES) {
      showToast(t('chat_audio_too_large'));
      state.phase = 'open';
      renderComposer();
      return;
    }

    await ensureSession();
    if (!state.sessionId) {
      state.phase = 'open';
      renderComposer();
      showError('Could not create session.');
      return;
    }

    clearNotice();
    var pendingVoiceMessage = pushMessage({
      role: 'user',
      content: '',
      voice: true,
      audioUrl: window.URL && typeof window.URL.createObjectURL === 'function' ? window.URL.createObjectURL(blob) : null,
      transcriptPending: true
    });

    state.phase = 'transcribing';
    renderAll();

    var formData = new FormData();
    formData.append('session_id', state.sessionId);
    if (isAuthenticated()) formData.append('user_id', state.auth.user.id);
    formData.append('message', '[voice_message]');
    formData.append('content_type', 'voice');
    formData.append('modality', 'voice');
    formData.append('language', currentLang());
    formData.append('locale', currentLang());
    formData.append('direction', currentDir());
    formData.append('fingerprint_hash', state.fingerprint || '');
    formData.append('source_page', location.href || 'landing');
    formData.append('turn_number', String(state.turnsUsed + 1));
    formData.append('audio_duration_seconds', String(Math.floor((Date.now() - state.recordStart) / 1000) || 0));
    formData.append('audio_size_bytes', String(blob.size));
    formData.append('mime_type', blob.type || 'audio/webm');
    formData.append('history', JSON.stringify(getHistory()));
    formData.append('wants_voice_reply', String(!!state.wantsVoiceReply));
    formData.append('reply_language', getReplyLanguage());
    formData.append('file', blob, 'voice-message.webm');

    try {
      var response = await fetch(CONFIG.N8N_WEBHOOK, {
        method: 'POST',
        body: formData
      });
      var data = {};
      try { data = await response.json(); } catch (error) {}

      if (response.status === 409) {
        removeMessageById(pendingVoiceMessage.id);
        state.phase = 'open';
        renderAll();
        showError(data.message || t('chat_active_conflict'));
        return;
      }

      if (response.status === 429) {
        updateQuotaFromResponse(data);
        if (data.status === 'limit_exceeded' || data.limit_state === 'session_limit' || data.limit_state === 'rolling_24h_limit') {
          removeMessageById(pendingVoiceMessage.id);
          state.phase = 'limit';
          setNotice('limit', localizeCtaPayload('limit', data.cta_payload, data.soft_warning_state), data.soft_warning_state);
          renderAll();
          return;
        }

        removeMessageById(pendingVoiceMessage.id);
        state.phase = 'open';
        renderAll();
        showToast(data.message || t('chat_rate_limited'));
        return;
      }

      if (!response.ok) {
        removeMessageById(pendingVoiceMessage.id);
        state.phase = 'open';
        renderAll();
        showError(data.message || t('chat_error_msg'));
        return;
      }

      updateQuotaFromResponse(data);

      pendingVoiceMessage.content = data.transcript || '';
      pendingVoiceMessage.transcriptPending = false;

      var blobTtsUrl = data.tts_audio_url || null;
      var blobVoiceOnlyReply = shouldUseVoiceOnlyReply(data, blobTtsUrl);
      pushMessage({
        role: 'assistant',
        content: resolveAssistantContent(data, blobVoiceOnlyReply),
        replyLanguage: data.reply_language || getReplyLanguage(),
        ttsAudioUrl: blobTtsUrl,
        voiceOnlyReply: blobVoiceOnlyReply
      });

      if (noTurnsRemaining()) {
        state.phase = 'limit';
        setNotice('limit', localizeCtaPayload('limit', data.cta_payload, data.soft_warning_state), data.soft_warning_state);
      } else {
        state.phase = 'open';
        if (data.soft_warning_state && data.soft_warning_state !== 'none' && !state.dismissedWarnings[data.soft_warning_state]) {
          setNotice('soft_warning', localizeCtaPayload(data.soft_warning_state, data.cta_payload, data.soft_warning_state), data.soft_warning_state);
        }
      }

      renderAll();
    } catch (networkError) {
      removeMessageById(pendingVoiceMessage.id);
      state.phase = 'open';
      renderAll();
      showError();
      trackEvent('error', { error: networkError.message || 'network_error' });
    }
  }

  async function startRecording() {
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      var chunks = [];

      state.recorder.ondataavailable = function (event) {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      state.recorder.onstop = function () {
        stream.getTracks().forEach(function (track) { track.stop(); });
        clearInterval(state.recordTimer);
        if (!chunks.length) {
          state.phase = 'open';
          renderComposer();
          return;
        }
        var blob = new Blob(chunks, { type: 'audio/webm' });
        handleAudioBlob(blob);
      };

      state.recorder.start();
      state.recordStart = Date.now();
      state.phase = 'recording';
      renderComposer();

      state.recordTimer = setInterval(function () {
        var elapsed = Math.floor((Date.now() - state.recordStart) / 1000);
        var timer = $('gc-rec-timer');
        if (timer) timer.textContent = Math.floor(elapsed / 60) + ':' + String(elapsed % 60).padStart(2, '0');
        if (elapsed >= CONFIG.MAX_AUDIO_SEC) {
          stopRecording();
          showToast(t('chat_recording_limit'));
        }
      }, 500);
    } catch (error) {
      state.phase = 'open';
      renderComposer();
      showToast(t('chat_mic_denied'));
    }
  }

  function stopRecording() {
    if (state.recorder && state.recorder.state === 'recording') state.recorder.stop();
  }

  function cancelRecording(nextPhase) {
    if (!state.recorder || state.recorder.state !== 'recording') return;
    state.recorder.ondataavailable = null;
    state.recorder.onstop = function () {
      clearInterval(state.recordTimer);
      state.recorder.stream.getTracks().forEach(function (track) { track.stop(); });
      state.phase = nextPhase || 'open';
      renderComposer();
    };
    state.recorder.stop();
  }

  function submitText() {
    var textarea = $('gc-textarea');
    if (!textarea) return;
    var text = textarea.value.trim();
    if (!text) return;
    textarea.value = '';
    textarea.style.height = 'auto';
    renderComposer();
    if (state.imageMode) {
      sendImagePrompt(text);
    } else {
      sendMessage(text, 'text');
    }
  }

  function openChat() {
    var panel = $('gc-chat-panel');
    var trigger = $('gc-chat-trigger');
    var scrim = $('gc-chat-scrim');
    var pill = document.getElementById('floating-pill');

    if (!panel || !trigger || !scrim) return;

    panel.classList.add('open');
    panel.classList.add('state-opening');
    trigger.classList.add('open');
    scrim.classList.add('open');
    
    setTimeout(function() {
      panel.classList.remove('state-opening');
    }, 600);

    state.lastFocusedElement = document.activeElement && typeof document.activeElement.focus === 'function'
      ? document.activeElement
      : trigger;
    state.phase = state.phase === 'limit' ? 'limit' : 'open';
    document.body.style.overflow = 'hidden';
    if (pill) pill.style.display = 'none';

    ensureSession().then(function () {
      renderHeader();
      hydrateMessagesFromSession();
    });

    trackCTA('open_chat', 'click', 'trigger');

    setTimeout(function () {
      var textarea = $('gc-textarea');
      if (textarea && state.phase !== 'limit') textarea.focus();
    }, 220);
  }

  function closeChat() {
    var panel = $('gc-chat-panel');
    var trigger = $('gc-chat-trigger');
    var scrim = $('gc-chat-scrim');
    var pill = document.getElementById('floating-pill');

    if (!panel || !trigger || !scrim) return;

    panel.classList.add('state-closing');
    panel.classList.remove('open');
    trigger.classList.remove('open');
    scrim.classList.remove('open');
    
    setTimeout(function() {
      panel.classList.remove('state-closing');
      if (pill) pill.style.display = '';
    }, 400);

    document.body.style.overflow = '';
    stopActiveAudio();

    var nextPhase = state.notice && state.notice.kind === 'limit' ? 'limit' : 'closed';
    if (state.recorder && state.recorder.state === 'recording') cancelRecording(nextPhase);
    state.phase = nextPhase;

    var restoreTarget = state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function'
      ? state.lastFocusedElement
      : trigger;
    state.lastFocusedElement = null;
    setTimeout(function () {
      if (restoreTarget && typeof restoreTarget.focus === 'function') restoreTarget.focus();
    }, 0);
  }

  function handlePanelClick(event) {
    var button = event.target.closest('[data-action]');
    if (!button) return;

    var action = button.getAttribute('data-action');
    if (action === 'prompt') {
      var prompts = getPromptList();
      var prompt = prompts[Number(button.getAttribute('data-prompt-index'))] || '';
      if (!prompt) return;
      if ($('gc-textarea')) {
        $('gc-textarea').value = prompt;
        $('gc-textarea').dispatchEvent(new Event('input'));
      }
      submitText();
      return;
    }

    if (action === 'focus-input') {
      if ($('gc-textarea')) $('gc-textarea').focus();
      return;
    }

    if (action === 'record') {
      if (state.phase === 'recording') stopRecording();
      else if (state.phase === 'open' || state.phase === 'closed') startRecording();
      return;
    }

    if (action === 'auth-google') {
      trackCTA('auth_google', 'click', 'auth_card');
      startGoogleAuth();
      return;
    }

    if (action === 'auth-email') {
      var emailInput = $('gc-auth-email');
      if (emailInput) emailInput.focus();
      return;
    }

    if (action === 'auth-email-send') {
      trackCTA('auth_email', 'click', 'auth_card');
      submitAuthEmail();
      return;
    }

    if (action === 'auth-email-verify') {
      trackCTA('auth_email_verify', 'click', 'auth_card');
      verifyAuthEmailCode();
      return;
    }

    if (action === 'toggle-hear') {
      if (!state.quota.ttsAvailable) {
        showToast(t('chat_hear_unavailable'));
        return;
      }
      state.wantsVoiceReply = !state.wantsVoiceReply;
      renderAll();
      return;
    }

    if (action === 'toggle-reply-language') {
      state.preferredReplyLanguage = getReplyLanguage() === 'en' ? 'ar' : 'en';
      renderAll();
      return;
    }

    if (action === 'set-reply-language') {
      state.preferredReplyLanguage = normalizeLang(button.getAttribute('data-language'));
      renderAll();
      return;
    }

    if (action === 'play-audio') {
      var playerEl = button.closest('.gc-audio-player');
      toggleAudio(button.getAttribute('data-audio-url'), button, playerEl);
      return;
    }

    if (action === 'dismiss-warning') {
      state.dismissedWarnings[(state.notice && state.notice.warningState) || state.quota.softWarningState || 'generic'] = true;
      clearNotice();
      state.phase = 'open';
      renderAll();
      if ($('gc-textarea')) $('gc-textarea').focus();
      return;
    }

    if (action === 'enter-create-mode') {
      if (!state.quota.imageGenAvailable) {
        showToast(t('chat_image_quota_exhausted'));
        return;
      }
      state.imageMode = true;
      renderAll();
      if ($('gc-textarea')) $('gc-textarea').focus();
      return;
    }

    if (action === 'exit-create-mode') {
      state.imageMode = false;
      renderAll();
      return;
    }

    if (action === 'image-open') {
      var imageUri = button.getAttribute('data-image-uri');
      if (imageUri) window.open(imageUri, '_blank');
      return;
    }

    if (action === 'image-retry') {
      var imagePrompt = button.getAttribute('data-image-prompt');
      if (imagePrompt) sendImagePrompt(imagePrompt);
      return;
    }

    if (action === 'cta') {
      var ctaType = button.getAttribute('data-cta-type') || 'cta';
      var href = button.getAttribute('data-cta-href') || '';
      trackCTA(ctaType, 'click', 'system_card');
      navigateCTA(ctaType, href);
    }
  }

  function handlePanelInput(event) {
    if (event.target && event.target.id === 'gc-auth-email') {
      state.auth.email = event.target.value;
      if (state.auth.status === 'error') setAuthHelper('idle', '');
      return;
    }
    if (event.target && event.target.id === 'gc-auth-code') {
      state.auth.code = event.target.value.replace(/\s+/g, '').slice(0, 6);
      event.target.value = state.auth.code;
      if (state.auth.status === 'error') setAuthHelper('idle', '');
    }
  }

  function handlePanelKeydown(event) {
    if (!event.target) return;

    if (event.key === 'Enter' && event.target.id === 'gc-auth-email') {
      event.preventDefault();
      submitAuthEmail();
      return;
    }

    if (event.key === 'Enter' && event.target.id === 'gc-auth-code') {
      event.preventDefault();
      verifyAuthEmailCode();
    }
  }

  function bindEvents() {
    $('gc-chat-trigger').addEventListener('click', function () {
      if ($('gc-chat-panel').classList.contains('open')) closeChat();
      else openChat();
    });

    $('gc-chat-scrim').addEventListener('click', closeChat);
    $('gc-close').addEventListener('click', closeChat);
    $('gc-chat-panel').addEventListener('click', handlePanelClick);
    $('gc-chat-panel').addEventListener('input', handlePanelInput);
    $('gc-chat-panel').addEventListener('keydown', handlePanelKeydown);

    document.addEventListener('keydown', function (event) {
      trapPanelFocus(event);
      if (event.key === 'Escape' && $('gc-chat-panel').classList.contains('open')) closeChat();
    });

    var textarea = $('gc-textarea');
    textarea.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 110) + 'px';
      renderComposer();
    });

    textarea.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey && window.innerWidth >= 640) {
        event.preventDefault();
        submitText();
      }
    });

    $('gc-send-btn').addEventListener('click', submitText);
    $('gc-mic-btn').addEventListener('click', function () {
      if (state.phase === 'recording') stopRecording();
      else if (state.phase === 'open' || state.phase === 'closed') startRecording();
    });
    $('gc-rec-cancel').addEventListener('click', cancelRecording);
    $('gc-attach-btn').addEventListener('click', function () { $('gc-file-input').click(); });

    $('gc-file-input').addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      if (!isAllowedAudioFile(file)) {
        showToast(t('chat_audio_invalid'));
        event.target.value = '';
        return;
      }
      state.recordStart = Date.now();
      handleAudioBlob(file);
      event.target.value = '';
    });

    var panel = $('gc-chat-panel');
    var dropZone = $('gc-drop-zone');
    var dragCounter = 0;

    panel.addEventListener('dragenter', function (event) {
      event.preventDefault();
      dragCounter += 1;
      dropZone.classList.add('active');
    });
    panel.addEventListener('dragleave', function (event) {
      event.preventDefault();
      dragCounter -= 1;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropZone.classList.remove('active');
      }
    });
    panel.addEventListener('dragover', function (event) {
      event.preventDefault();
    });
    panel.addEventListener('drop', function (event) {
      event.preventDefault();
      dragCounter = 0;
      dropZone.classList.remove('active');

      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file || !isAllowedAudioFile(file)) {
        showToast(t('chat_audio_invalid'));
        return;
      }

      state.recordStart = Date.now();
      handleAudioBlob(file);
    });

    var rootObserver = new MutationObserver(function (mutations) {
      var shouldRender = mutations.some(function (mutation) {
        return mutation.attributeName === 'class' || mutation.attributeName === 'lang' || mutation.attributeName === 'dir';
      });
      if (shouldRender) renderAll();
    });
    rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'lang', 'dir'] });
  }

  window.gcOpenChat = openChat;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }
})();
