(function () {
  'use strict';

  var CONFIG = Object.assign({
    textWebhookUrl: '',
    voiceWebhookUrl: '',
    requestTimeoutMs: 30000,
    maxRetries: 2,
    maxQueueDelayMs: 12000,
    autoGenerateFromVoice: true,
    recordingLimitMs: 45000
  }, window.GRINDCTRL_CONFIG || {});

  var COPY = {
    en: {
      ready: 'Ready',
      readyStatus: 'Ready for first task.',
      welcome: 'Tell me one business task. I will turn it into AI agent blueprint you can use, review, and download.',
      welcomeNote: 'Use preset for low-friction start, or type custom business task below.',
      thinking: ['Thinking', 'Generating your blueprint', 'Designing workflow steps'],
      queued: 'Current request running. Next prompt queued for this session.',
      cooldown: 'System pacing requests. Waiting %s seconds before next attempt.',
      rateLimited: 'Model busy. Retrying with backoff instead of failing hard.',
      timeout: 'Request timed out. Building fallback blueprint so UX stays smooth.',
      unavailable: 'Service still busy. Returning lightweight fallback blueprint.',
      error: 'Request failed. Showing fallback blueprint instead of error wall.',
      demoFallback: 'Webhook not configured yet. Showing local demo blueprint.',
      voiceReady: 'Voice ready',
      voiceListening: 'Listening…',
      voiceUploading: 'Uploading audio…',
      voiceTranscribing: 'Transcribing…',
      voiceDone: 'Transcript ready',
      voiceUnsupported: 'Voice capture not supported in this browser.',
      voiceNotConfigured: 'Voice webhook not configured yet. Set `voiceWebhookUrl` to enable Groq transcription.',
      noBlueprint: 'Generate blueprint first.',
      presetPrefix: 'Preset selected',
      you: 'You',
      assistant: 'AI Blueprint',
      transcriptMeta: 'Voice transcript',
      fallback: 'Fallback blueprint',
      download: 'Download AI Agent Blueprint',
      refine: 'Refine blueprint',
      businessGoal: 'Business goal',
      workflow: 'Workflow steps',
      exampleOutput: 'Example output',
      roi: 'ROI',
      stack: 'Suggested stack',
      nextStep: 'Next step',
      busyPill: 'Generating',
      voicePill: 'Transcribing',
      fallbackPill: 'Fallback',
      followUps: {
        qualify_leads: 'What makes lead worth pursuing right now: source, budget, location, or service interest?',
        customer_support: 'What support volume and channels matter most: WhatsApp, email, chat, or calls?',
        generate_reports: 'What report should appear automatically each day or week, and from which tools?',
        book_meetings: 'What type of meeting should agent book, and what qualification rules should it enforce?',
        follow_up: 'When should follow-up trigger, and what action should count as success?',
        custom: 'What business task should this agent own first?'
      },
      placeholders: {
        qualify_leads: 'Example: We get Meta ads and website leads. Need instant scoring and CRM routing.',
        customer_support: 'Example: Handle shipping questions from Shopify and WhatsApp before human handoff.',
        generate_reports: 'Example: Build weekly ops report from HubSpot, Stripe, and support inbox.',
        book_meetings: 'Example: Book discovery calls only for qualified B2B leads in UAE timezone.',
        follow_up: 'Example: Follow up with leads who asked for pricing but never booked.',
        custom: 'Describe custom business task.'
      },
      starterExample: 'Example blueprint ready in one response, no long setup.',
      retryQueued: 'Queued prompt started.',
      downloaded: 'Blueprint HTML downloaded.',
      refinePrompt: 'Tighten this blueprint for implementation with clearer steps, dependencies, and launch risks.'
    },
    ar: {
      ready: 'جاهز',
      readyStatus: 'جاهز لأول مهمة.',
      welcome: 'اكتب مهمة عمل واحدة. سأحوّلها إلى مخطط وكيل ذكي يمكنك مراجعته وتنزيله.',
      welcomeNote: 'اختر قالباً سريعاً أو اكتب طلباً مخصصاً في الأسفل.',
      thinking: ['يفكر', 'ينشئ المخطط', 'يرتب خطوات سير العمل'],
      queued: 'هناك طلب جارٍ الآن. تم وضع الطلب التالي في الانتظار.',
      cooldown: 'النظام يهدئ الإرسال. الانتظار %s ثانية قبل المحاولة التالية.',
      rateLimited: 'النموذج مشغول. تتم إعادة المحاولة تدريجياً بدلاً من الفشل المباشر.',
      timeout: 'انتهت مهلة الطلب. سيتم إنشاء مخطط بديل حتى تبقى التجربة سلسة.',
      unavailable: 'الخدمة ما زالت مشغولة. سيتم إرجاع مخطط بديل خفيف.',
      error: 'فشل الطلب. سيتم عرض مخطط بديل بدلاً من شاشة خطأ.',
      demoFallback: 'رابط Webhook غير مضبوط بعد. يتم عرض مخطط تجريبي محلي.',
      voiceReady: 'الصوت جاهز',
      voiceListening: 'جارٍ الاستماع…',
      voiceUploading: 'جارٍ رفع الصوت…',
      voiceTranscribing: 'جارٍ التفريغ…',
      voiceDone: 'النص جاهز',
      voiceUnsupported: 'تسجيل الصوت غير مدعوم في هذا المتصفح.',
      voiceNotConfigured: 'رابط Webhook للصوت غير مضبوط بعد. اضبط `voiceWebhookUrl` لتفعيل التفريغ عبر Groq.',
      noBlueprint: 'أنشئ مخططاً أولاً.',
      presetPrefix: 'تم اختيار القالب',
      you: 'أنت',
      assistant: 'مخطط الذكاء',
      transcriptMeta: 'تفريغ صوتي',
      fallback: 'مخطط بديل',
      download: 'تنزيل مخطط الوكيل الذكي',
      refine: 'تحسين المخطط',
      businessGoal: 'هدف العمل',
      workflow: 'خطوات سير العمل',
      exampleOutput: 'مثال على المخرجات',
      roi: 'العائد',
      stack: 'المنظومة المقترحة',
      nextStep: 'الخطوة التالية',
      busyPill: 'جارٍ الإنشاء',
      voicePill: 'جارٍ التفريغ',
      fallbackPill: 'بديل',
      followUps: {
        qualify_leads: 'ما الذي يجعل العميل المحتمل مهماً الآن: المصدر، الميزانية، الموقع، أم نوع الخدمة؟',
        customer_support: 'ما حجم الدعم والقنوات الأهم لديك: واتساب، بريد، دردشة، أم مكالمات؟',
        generate_reports: 'ما التقرير الذي يجب أن يصل تلقائياً يومياً أو أسبوعياً، ومن أي أدوات؟',
        book_meetings: 'ما نوع الاجتماع المطلوب، وما شروط التأهيل قبل الحجز؟',
        follow_up: 'متى يجب أن تبدأ المتابعة، وما الإجراء الذي يُعتبر نجاحاً؟',
        custom: 'ما مهمة العمل التي يجب أن يمتلكها هذا الوكيل أولاً؟'
      },
      placeholders: {
        qualify_leads: 'مثال: لدينا عملاء من الإعلانات والموقع ونحتاج تقييمهم وتحويلهم فوراً إلى CRM.',
        customer_support: 'مثال: نريد الرد على أسئلة الشحن من Shopify وواتساب قبل التحويل للبشر.',
        generate_reports: 'مثال: أنشئ تقرير عمليات أسبوعي من HubSpot وStripe والدعم.',
        book_meetings: 'مثال: احجز مكالمات اكتشاف فقط للعملاء B2B المؤهلين في توقيت الخليج.',
        follow_up: 'مثال: تابع تلقائياً مع من طلب التسعير ولم يحجز.',
        custom: 'اكتب مهمة العمل المخصصة.'
      },
      starterExample: 'مثال جاهز في رد واحد بدون إعداد طويل.',
      retryQueued: 'تم بدء الطلب المؤجل.',
      downloaded: 'تم تنزيل ملف المخطط.',
      refinePrompt: 'حسّن هذا المخطط للتنفيذ مع خطوات أوضح واعتماديات ومخاطر الإطلاق.'
    }
  };

  var PRESETS = {
    qualify_leads: { keyword: 'Lead qualification', icon: 'LQ' },
    customer_support: { keyword: 'Customer support', icon: 'CS' },
    generate_reports: { keyword: 'Reporting', icon: 'RP' },
    book_meetings: { keyword: 'Meeting booking', icon: 'BM' },
    follow_up: { keyword: 'Lead follow-up', icon: 'FU' },
    custom: { keyword: 'Custom workflow', icon: 'AI' }
  };

  var state = {
    locale: detectLocale(),
    sessionId: loadSessionId(),
    activePreset: null,
    busy: false,
    voiceBusy: false,
    currentBlueprint: null,
    typingNode: null,
    queuedPrompt: null,
    nextAllowedAt: 0,
    mediaRecorder: null,
    recordingStream: null,
    recordingChunks: [],
    recordingTimer: null,
    conversation: [],
    thinkingIndex: 0,
    thinkingTimer: null
  };

  var dom = {
    feed: document.getElementById('chat-feed'),
    taskInput: document.getElementById('task-input'),
    form: document.getElementById('composer-form'),
    sendButton: document.getElementById('send-button'),
    micButton: document.getElementById('mic-button'),
    presetButtons: Array.prototype.slice.call(document.querySelectorAll('.preset-chip')),
    requestStatus: document.getElementById('request-status'),
    voiceStatus: document.getElementById('voice-status'),
    statePill: document.getElementById('chat-state-pill'),
    statusDot: document.getElementById('status-dot'),
    liveRegion: document.getElementById('live-region'),
    downloadHeader: document.getElementById('download-header'),
    messageTemplate: document.getElementById('message-template'),
    typingTemplate: document.getElementById('typing-template')
  };

  init();

  function init() {
    document.documentElement.lang = state.locale;
    document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr';
    dom.taskInput.placeholder = t('placeholders.custom');
    dom.downloadHeader.textContent = t('download');

    bindEvents();
    autoResize();
    appendTextMessage('assistant', t('welcome'), t('assistant'));
    appendSystemNote(t('welcomeNote'));
    updateStatus(t('readyStatus'), 'ready');
    updateVoiceStatus(t('voiceReady'));
    renderStarterHint();
  }

  function bindEvents() {
    dom.form.addEventListener('submit', handleSubmit);
    dom.taskInput.addEventListener('input', autoResize);
    dom.taskInput.addEventListener('keydown', handleInputKeydown);
    dom.micButton.addEventListener('click', handleMicClick);
    dom.downloadHeader.addEventListener('click', downloadBlueprint);

    dom.presetButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        activatePreset(button.getAttribute('data-preset'));
      });
    });

    dom.feed.addEventListener('click', function (event) {
      var action = event.target.closest('[data-action]');
      if (!action) return;
      var type = action.getAttribute('data-action');
      if (type === 'download-blueprint') {
        downloadBlueprint();
      }
      if (type === 'refine-blueprint') {
        queueOrSubmit(t('refinePrompt'));
      }
      if (type === 'reselect-preset') {
        activatePreset(action.getAttribute('data-preset'));
      }
    });
  }

  function detectLocale() {
    var rootLang = String(document.documentElement.lang || '').toLowerCase();
    var browserLang = String(navigator.language || navigator.userLanguage || 'en').toLowerCase();
    var lang = rootLang || browserLang;
    return lang.indexOf('ar') === 0 ? 'ar' : 'en';
  }

  function loadSessionId() {
    var key = 'grindctrl-ai-blueprint-session';
    try {
      var existing = window.localStorage.getItem(key);
      if (existing) return existing;
      var created = 'gc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      window.localStorage.setItem(key, created);
      return created;
    } catch (error) {
      return 'gc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    }
  }

  function t(key) {
    var parts = key.split('.');
    var value = COPY[state.locale];
    for (var i = 0; i < parts.length; i += 1) {
      value = value && value[parts[i]];
    }
    return value || COPY.en[key] || key;
  }

  function bindPresetState() {
    dom.presetButtons.forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-preset') === state.activePreset);
    });
  }

  function activatePreset(presetKey) {
    if (!PRESETS[presetKey]) return;
    state.activePreset = presetKey;
    bindPresetState();
    dom.taskInput.placeholder = t('placeholders.' + presetKey);
    appendTextMessage('assistant', t('followUps.' + presetKey), t('assistant'));
    updateStatus(t('presetPrefix') + ': ' + buttonLabel(presetKey), 'ready');
    dom.taskInput.focus();
  }

  function buttonLabel(presetKey) {
    var button = dom.presetButtons.find(function (item) {
      return item.getAttribute('data-preset') === presetKey;
    });
    return button ? button.textContent.trim() : presetKey;
  }

  function renderStarterHint() {
    var wrapper = document.createElement('article');
    wrapper.className = 'message message-assistant';
    wrapper.innerHTML = [
      '<div class="message-avatar">AI</div>',
      '<div class="message-body">',
      '<div class="message-meta">Preset shortcuts</div>',
      '<div class="message-card">',
      '<p>' + escapeHtml(t('starterExample')) + '</p>',
      '<div class="quick-actions">',
      dom.presetButtons.map(function (button) {
        return '<button class="quick-action" type="button" data-action="reselect-preset" data-preset="' + escapeHtml(button.getAttribute('data-preset')) + '">' + escapeHtml(button.textContent.trim()) + '</button>';
      }).join(''),
      '</div>',
      '</div>',
      '</div>'
    ].join('');
    dom.feed.appendChild(wrapper);
    scrollFeed();
  }

  function handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (dom.taskInput.value.trim()) {
        handleSubmit(event);
      }
    }
  }

  function handleSubmit(event) {
    if (event) event.preventDefault();
    var raw = dom.taskInput.value.trim();
    if (!raw) return;
    queueOrSubmit(raw);
  }

  function queueOrSubmit(raw) {
    if (Date.now() < state.nextAllowedAt) {
      updateStatus(format(t('cooldown'), secondsUntil(state.nextAllowedAt)), 'busy');
      return;
    }

    if (state.busy || state.voiceBusy) {
      state.queuedPrompt = {
        text: raw,
        preset: state.activePreset,
        queuedAt: Date.now()
      };
      dom.taskInput.value = '';
      autoResize();
      updateStatus(t('queued'), 'busy');
      announce(t('queued'));
      return;
    }

    dom.taskInput.value = '';
    autoResize();
    requestBlueprint({
      userText: raw,
      prompt: buildPrompt(raw),
      source: 'text',
      preset: state.activePreset
    });
    state.activePreset = null;
    bindPresetState();
    dom.taskInput.placeholder = t('placeholders.custom');
  }

  async function requestBlueprint(payload) {
    state.busy = true;
    setInteractiveState();
    if (!payload.skipUserEcho) {
      appendTextMessage('user', payload.userText, t('you'));
    }
    startThinking();
    updateStatus(t('thinking')[0], 'busy');

    try {
      var result;
      if (isWebhookConfigured(CONFIG.textWebhookUrl)) {
        result = await postJsonWithRetry(CONFIG.textWebhookUrl, {
          session_id: state.sessionId,
          locale: state.locale,
          source: payload.source,
          preset: payload.preset,
          prompt: payload.prompt,
          history: compactHistory()
        });
      } else {
        await sleep(850);
        result = {
          fallback: true,
          localDemo: true,
          blueprint: buildFallbackBlueprint(payload.prompt, payload.preset, 'unconfigured_webhook')
        };
      }

      var blueprint = normalizeBlueprint(result, payload.prompt, payload.preset);
      renderBlueprint(blueprint, result.fallback || blueprint.fallback);
      if (result.localDemo) {
        updateStatus(t('demoFallback'), 'fallback');
      } else {
        updateStatus(result.fallback || blueprint.fallback ? t('unavailable') : t('readyStatus'), result.fallback || blueprint.fallback ? 'fallback' : 'ready');
      }
    } catch (error) {
      var fallbackBlueprint = buildFallbackBlueprint(payload.prompt, payload.preset, error && error.code ? error.code : 'request_failure');
      renderBlueprint(fallbackBlueprint, true, error);
      if (error && error.code === 'timeout') {
        updateStatus(t('timeout'), 'fallback');
      } else if (error && error.code === 'temporary_unavailable') {
        updateStatus(t('unavailable'), 'fallback');
      } else {
        updateStatus(t('error'), 'fallback');
      }
    } finally {
      stopThinking();
      state.busy = false;
      setInteractiveState();
      flushQueuedPrompt();
    }
  }

  async function postJsonWithRetry(url, body) {
    return requestWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }, 'generation');
  }

  async function postAudioWithRetry(url, formData) {
    return requestWithRetry(url, {
      method: 'POST',
      body: formData
    }, 'voice');
  }

  async function requestWithRetry(url, init, mode) {
    var attempts = Number(CONFIG.maxRetries) + 1;
    var lastError = null;

    for (var attempt = 0; attempt < attempts; attempt += 1) {
      var controller = new AbortController();
      var timeoutId = window.setTimeout(function () {
        controller.abort();
      }, Number(CONFIG.requestTimeoutMs) || 30000);

      try {
        var response = await fetch(url, Object.assign({}, init, { signal: controller.signal }));
        clearTimeout(timeoutId);
        var contentType = response.headers.get('content-type') || '';
        var parsed = contentType.indexOf('application/json') >= 0 ? await response.json() : { message: await response.text() };

        if (response.ok) {
          applyRetryAfter(parsed.retry_after_seconds || parseRetryAfter(response.headers.get('retry-after')));
          return parsed;
        }

        if (isTemporaryStatus(response.status)) {
          var retryAfterSeconds = parsed.retry_after_seconds || parseRetryAfter(response.headers.get('retry-after')) || Math.min(2 + attempt * 2, 8);
          applyRetryAfter(retryAfterSeconds);
          lastError = createError('temporary_unavailable', parsed.message || 'Temporary failure', response.status);
          if (attempt < attempts - 1) {
            updateStatus(t('rateLimited'), 'busy');
            await sleep(retryAfterSeconds * 1000);
            continue;
          }
        } else {
          throw createError('request_failed', parsed.message || 'Request failed', response.status);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error && error.name === 'AbortError') {
          lastError = createError('timeout', 'Request timed out', 408);
          if (attempt < attempts - 1) {
            updateStatus(t('rateLimited'), 'busy');
            await sleep(1200 * (attempt + 1));
            continue;
          }
        } else if (error && error.code) {
          throw error;
        } else {
          lastError = createError('network_failure', error && error.message ? error.message : 'Network error', 0);
          if (attempt < attempts - 1) {
            await sleep(1000 * (attempt + 1));
            continue;
          }
        }
      }
    }

    throw lastError || createError('temporary_unavailable', 'Service unavailable', 503);
  }

  function applyRetryAfter(retryAfterSeconds) {
    if (!retryAfterSeconds) return;
    state.nextAllowedAt = Date.now() + Number(retryAfterSeconds) * 1000;
  }

  function parseRetryAfter(value) {
    if (!value) return 0;
    var numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    var dateValue = Date.parse(value);
    if (Number.isFinite(dateValue)) {
      return Math.max(0, Math.ceil((dateValue - Date.now()) / 1000));
    }
    return 0;
  }

  function isTemporaryStatus(status) {
    return [408, 409, 425, 429, 498, 500, 502, 503, 504].indexOf(status) >= 0;
  }

  function createError(code, message, status) {
    var error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
  }

  function buildPrompt(raw) {
    if (!state.activePreset || state.activePreset === 'custom') {
      return raw;
    }

    return [
      'Preset: ' + buttonLabel(state.activePreset),
      'Context: ' + raw,
      'Need one concise AI agent blueprint with business goal, workflow, example output, ROI, suggested stack, next step.'
    ].join('\n');
  }

  function compactHistory() {
    return state.conversation.slice(-6).map(function (entry) {
      return {
        role: entry.role,
        content: entry.content
      };
    });
  }

  function normalizeBlueprint(result, prompt, preset) {
    var candidate = result && (result.blueprint || result.result || result.data || result);
    if (!candidate || typeof candidate !== 'object' || !hasBlueprintShape(candidate)) {
      return buildFallbackBlueprint(prompt, preset, 'shape_mismatch');
    }

    return {
      agent_name: safeText(candidate.agent_name, 'Revenue Workflow Agent'),
      business_goal: safeText(candidate.business_goal, prompt),
      workflow: normalizeWorkflow(candidate.workflow),
      example_output: safeText(candidate.example_output, 'Lead scored, enriched, routed, and booked without manual triage.'),
      roi: safeText(candidate.roi, 'Save team hours and shorten response time with one automated flow.'),
      suggested_stack: normalizeStack(candidate.suggested_stack),
      next_step: safeText(candidate.next_step, 'Deploy webhook, test with 10 real requests, then refine routing rules.'),
      fallback: Boolean(result && result.fallback)
    };
  }

  function hasBlueprintShape(candidate) {
    return candidate && typeof candidate.agent_name === 'string' && typeof candidate.business_goal === 'string' && Array.isArray(candidate.workflow);
  }

  function normalizeWorkflow(value) {
    if (!Array.isArray(value) || !value.length) {
      return [
        'Capture input from user or source system.',
        'Classify request and enrich with business context.',
        'Take next action or route to human when needed.'
      ];
    }

    return value.slice(0, 6).map(function (item) {
      return safeText(item, 'Workflow step');
    });
  }

  function normalizeStack(value) {
    if (!Array.isArray(value) || !value.length) {
      return ['n8n', 'Groq', 'CRM', 'Slack or Email'];
    }

    return value.slice(0, 6).map(function (item) {
      return safeText(item, 'Tool');
    });
  }

  function safeText(value, fallback) {
    var text = typeof value === 'string' ? value.trim() : '';
    return text || fallback;
  }

  function renderBlueprint(blueprint, isFallback, error) {
    state.currentBlueprint = blueprint;
    dom.downloadHeader.disabled = false;

    var wrapper = document.createElement('article');
    wrapper.className = 'message message-assistant';

    var workflowHtml = blueprint.workflow.map(function (step, index) {
      return [
        '<li>',
        '<span class="workflow-index">' + (index + 1) + '</span>',
        '<span dir="auto">' + escapeHtml(step) + '</span>',
        '</li>'
      ].join('');
    }).join('');

    var stackHtml = blueprint.suggested_stack.map(function (item) {
      return '<li dir="auto">' + escapeHtml(item) + '</li>';
    }).join('');

    wrapper.innerHTML = [
      '<div class="message-avatar">AI</div>',
      '<div class="message-body">',
      '<div class="message-meta">' + escapeHtml(isFallback ? t('fallback') : t('assistant')) + '</div>',
      '<section class="blueprint-card">',
      '<div class="blueprint-head">',
      '<div>',
      '<p class="blueprint-label">Agent</p>',
      '<h3 dir="auto">' + escapeHtml(blueprint.agent_name) + '</h3>',
      '</div>',
      isFallback ? '<span class="fallback-badge">' + escapeHtml(t('fallbackPill')) + '</span>' : '',
      '</div>',
      '<div class="blueprint-section">',
      '<p class="blueprint-label">' + escapeHtml(t('businessGoal')) + '</p>',
      '<p class="blueprint-value" dir="auto">' + escapeHtml(blueprint.business_goal) + '</p>',
      '</div>',
      '<div class="blueprint-section">',
      '<p class="blueprint-label">' + escapeHtml(t('workflow')) + '</p>',
      '<ol class="blueprint-workflow">' + workflowHtml + '</ol>',
      '</div>',
      '<div class="blueprint-section">',
      '<p class="blueprint-label">' + escapeHtml(t('exampleOutput')) + '</p>',
      '<p class="blueprint-example" dir="auto">' + escapeHtml(blueprint.example_output) + '</p>',
      '</div>',
      '<div class="blueprint-section">',
      '<p class="blueprint-label">' + escapeHtml(t('roi')) + '</p>',
      '<p class="blueprint-value" dir="auto">' + escapeHtml(blueprint.roi) + '</p>',
      '</div>',
      '<div class="blueprint-section">',
      '<p class="blueprint-label">' + escapeHtml(t('stack')) + '</p>',
      '<ul class="blueprint-stack">' + stackHtml + '</ul>',
      '</div>',
      '<div class="blueprint-section">',
      '<p class="blueprint-label">' + escapeHtml(t('nextStep')) + '</p>',
      '<p class="blueprint-next-step" dir="auto">' + escapeHtml(blueprint.next_step) + '</p>',
      '</div>',
      '<div class="blueprint-actions">',
      '<button class="download-action" type="button" data-action="download-blueprint">' + escapeHtml(t('download')) + '</button>',
      '<button type="button" data-action="refine-blueprint">' + escapeHtml(t('refine')) + '</button>',
      '</div>',
      error ? '<p class="message-note" dir="auto">' + escapeHtml(error.message || '') + '</p>' : '',
      '</section>',
      '</div>'
    ].join('');

    stopThinking();
    dom.feed.appendChild(wrapper);
    scrollFeed();
    state.conversation.push({ role: 'assistant', content: blueprint.agent_name + ': ' + blueprint.business_goal });
  }

  function appendTextMessage(role, text, meta) {
    var clone = dom.messageTemplate.content.firstElementChild.cloneNode(true);
    clone.classList.add(role === 'user' ? 'message-user' : 'message-assistant');
    clone.querySelector('.message-avatar').textContent = role === 'user' ? 'YOU' : 'AI';
    clone.querySelector('.message-meta').textContent = meta || (role === 'user' ? t('you') : t('assistant'));
    clone.querySelector('.message-card').textContent = text;
    dom.feed.appendChild(clone);
    scrollFeed();
    state.conversation.push({ role: role === 'user' ? 'user' : 'assistant', content: text });
  }

  function appendSystemNote(text) {
    var note = document.createElement('div');
    note.className = 'message-note';
    note.textContent = text;
    dom.feed.appendChild(note);
    scrollFeed();
  }

  function startThinking() {
    stopThinking();
    state.thinkingIndex = 0;
    state.typingNode = dom.typingTemplate.content.firstElementChild.cloneNode(true);
    dom.feed.appendChild(state.typingNode);
    scrollFeed();
    dom.statePill.textContent = t('busyPill');
    state.thinkingTimer = window.setInterval(function () {
      state.thinkingIndex = (state.thinkingIndex + 1) % t('thinking').length;
      updateStatus(t('thinking')[state.thinkingIndex], 'busy');
    }, 1500);
  }

  function stopThinking() {
    if (state.typingNode && state.typingNode.parentNode) {
      state.typingNode.parentNode.removeChild(state.typingNode);
    }
    state.typingNode = null;
    if (state.thinkingTimer) {
      window.clearInterval(state.thinkingTimer);
      state.thinkingTimer = null;
    }
    if (!state.voiceBusy) {
      dom.statePill.textContent = t('ready');
    }
  }

  function updateStatus(message, tone) {
    dom.requestStatus.textContent = message;
    dom.statePill.textContent = tone === 'busy' ? t('busyPill') : tone === 'fallback' ? t('fallbackPill') : t('ready');
    dom.statusDot.classList.toggle('is-busy', tone === 'busy');
    dom.statusDot.classList.toggle('is-error', tone === 'fallback');
    announce(message);
  }

  function updateVoiceStatus(message) {
    dom.voiceStatus.textContent = message;
    if (state.voiceBusy) {
      dom.statePill.textContent = t('voicePill');
    }
    announce(message);
  }

  function announce(message) {
    dom.liveRegion.textContent = message;
  }

  function setInteractiveState() {
    var disabled = state.busy || state.voiceBusy;
    dom.sendButton.disabled = disabled;
    dom.micButton.disabled = state.busy;
    dom.downloadHeader.disabled = !state.currentBlueprint;
    dom.presetButtons.forEach(function (button) {
      button.disabled = disabled;
    });
  }

  function flushQueuedPrompt() {
    if (!state.queuedPrompt) return;
    if (Date.now() - state.queuedPrompt.queuedAt > Number(CONFIG.maxQueueDelayMs || 12000)) {
      state.queuedPrompt = null;
      return;
    }

    var queued = state.queuedPrompt;
    state.queuedPrompt = null;
    var launchQueuedRequest = function () {
      updateStatus(t('retryQueued'), 'busy');
      requestBlueprint({
        userText: queued.text,
        prompt: queued.preset ? [
          'Preset: ' + buttonLabel(queued.preset),
          'Context: ' + queued.text,
          'Need one concise AI agent blueprint with business goal, workflow, example output, ROI, suggested stack, next step.'
        ].join('\n') : queued.text,
        source: 'queued',
        preset: queued.preset
      });
    };

    if (Date.now() < state.nextAllowedAt) {
      updateStatus(format(t('cooldown'), secondsUntil(state.nextAllowedAt)), 'busy');
      window.setTimeout(launchQueuedRequest, Math.max(250, state.nextAllowedAt - Date.now()));
      return;
    }

    launchQueuedRequest();
  }

  function handleMicClick() {
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
      stopRecording();
      return;
    }

    startRecording();
  }

  async function startRecording() {
    if (!navigator.mediaDevices || typeof window.MediaRecorder === 'undefined') {
      updateVoiceStatus(t('voiceUnsupported'));
      updateStatus(t('voiceUnsupported'), 'fallback');
      return;
    }

    try {
      state.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.recordingChunks = [];
      var options = {};
      if (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      }
      state.mediaRecorder = new MediaRecorder(state.recordingStream, options);
      state.mediaRecorder.addEventListener('dataavailable', function (event) {
        if (event.data && event.data.size) {
          state.recordingChunks.push(event.data);
        }
      });
      state.mediaRecorder.addEventListener('stop', handleRecordingStop);
      state.mediaRecorder.start();
      dom.micButton.classList.add('is-recording');
      updateVoiceStatus(t('voiceListening'));
      updateStatus(t('voiceListening'), 'busy');
      state.recordingTimer = window.setTimeout(function () {
        stopRecording();
      }, Number(CONFIG.recordingLimitMs) || 45000);
    } catch (error) {
      updateVoiceStatus(error && error.message ? error.message : t('voiceUnsupported'));
      updateStatus(t('voiceUnsupported'), 'fallback');
    }
  }

  function stopRecording() {
    if (!state.mediaRecorder) return;
    if (state.recordingTimer) {
      window.clearTimeout(state.recordingTimer);
      state.recordingTimer = null;
    }
    if (state.mediaRecorder.state === 'recording') {
      state.mediaRecorder.stop();
    }
    dom.micButton.classList.remove('is-recording');
  }

  async function handleRecordingStop() {
    cleanupRecordingStream();
    if (!state.recordingChunks.length) {
      state.mediaRecorder = null;
      updateVoiceStatus(t('voiceReady'));
      updateStatus(t('readyStatus'), 'ready');
      return;
    }

    var blob = new Blob(state.recordingChunks, { type: state.recordingChunks[0].type || 'audio/webm' });
    state.mediaRecorder = null;
    state.voiceBusy = true;
    setInteractiveState();

    try {
      if (!isWebhookConfigured(CONFIG.voiceWebhookUrl)) {
        throw createError('voice_not_configured', t('voiceNotConfigured'), 0);
      }

      updateVoiceStatus(t('voiceUploading'));
      updateStatus(t('voiceUploading'), 'busy');

      var formData = new FormData();
      formData.append('session_id', state.sessionId);
      formData.append('locale', state.locale);
      formData.append('continue_generation', CONFIG.autoGenerateFromVoice ? 'true' : 'false');
      formData.append('file', blob, 'voice-input.webm');

      window.setTimeout(function () {
        if (state.voiceBusy) {
          updateVoiceStatus(t('voiceTranscribing'));
          updateStatus(t('voiceTranscribing'), 'busy');
        }
      }, 500);

      var response = await postAudioWithRetry(CONFIG.voiceWebhookUrl, formData);
      var transcript = safeText(response.transcript, '');

      if (transcript) {
        appendTextMessage('user', transcript, t('transcriptMeta'));
        updateVoiceStatus(t('voiceDone'));
      }

      if (hasBlueprintShape(response) || hasBlueprintShape(response.blueprint || {})) {
        var blueprint = normalizeBlueprint(response, transcript || 'Voice request', state.activePreset);
        renderBlueprint(blueprint, Boolean(response.fallback || blueprint.fallback));
        updateStatus(t('readyStatus'), 'ready');
      } else if (transcript && CONFIG.autoGenerateFromVoice) {
        updateVoiceStatus(t('voiceDone'));
        requestBlueprint({
          userText: transcript,
          prompt: transcript,
          source: 'voice',
          preset: state.activePreset,
          skipUserEcho: true
        });
        state.activePreset = null;
        bindPresetState();
        dom.taskInput.placeholder = t('placeholders.custom');
      } else if (transcript) {
        dom.taskInput.value = transcript;
        autoResize();
        updateStatus(t('voiceDone'), 'ready');
      } else {
        throw createError('voice_transcript_missing', 'Transcript missing in response', 502);
      }
    } catch (error) {
      updateVoiceStatus(error.message || t('voiceNotConfigured'));
      updateStatus(error.message || t('voiceNotConfigured'), 'fallback');
    } finally {
      state.voiceBusy = false;
      setInteractiveState();
      if (!state.busy) {
        dom.statePill.textContent = t('ready');
      }
      if (!state.mediaRecorder) {
        dom.micButton.classList.remove('is-recording');
      }
    }
  }

  function cleanupRecordingStream() {
    if (state.recordingStream) {
      state.recordingStream.getTracks().forEach(function (track) {
        track.stop();
      });
    }
    state.recordingStream = null;
  }

  function buildFallbackBlueprint(prompt, preset, reason) {
    var input = String(prompt || '').trim();
    var lowered = input.toLowerCase();
    var mode = preset || detectPresetFromText(lowered);
    var templates = {
      qualify_leads: {
        agent_name: 'Lead Qualification Agent',
        business_goal: 'Score inbound leads fast, route high-intent prospects, and stop manual triage delay.',
        workflow: [
          'Capture new lead from form, ads, or inbound chat into n8n webhook.',
          'Enrich lead with source, service interest, location, and budget signals.',
          'Score lead against business rules and push qualified records into CRM.',
          'Trigger instant follow-up by email or WhatsApp and offer booking link.',
          'Escalate edge cases to sales with summary and confidence note.'
        ],
        example_output: 'Lead: Ahmed from Meta ads. Score: 87/100. Intent: high. Next action: send booking link and create CRM task.',
        roi: 'Cuts first-response time from hours to minutes and reduces wasted sales follow-up on low-fit leads.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'HubSpot or Pipedrive', 'Calendly', 'WhatsApp or email'],
        next_step: 'Define scoring criteria, connect CRM fields, and test with last 20 inbound leads.'
      },
      customer_support: {
        agent_name: 'Support Resolution Agent',
        business_goal: 'Resolve repetitive support tickets automatically while routing risky or sensitive cases to humans.',
        workflow: [
          'Receive message from chat, email, or WhatsApp into n8n.',
          'Classify issue type, urgency, order context, and account status.',
          'Fetch order or account data from commerce or CRM systems.',
          'Draft precise reply, send self-serve answer, or escalate with human-ready summary.',
          'Log resolution, reason code, and unresolved patterns for ops review.'
        ],
        example_output: 'Ticket #2041: delayed shipment. Agent fetched tracking, answered customer, and flagged refund risk for human review.',
        roi: 'Handles high-volume repetitive tickets and improves customer response consistency without growing support headcount.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'Shopify or CRM', 'Helpdesk', 'Slack escalation'],
        next_step: 'List top 10 repetitive support intents and define escalation boundaries.'
      },
      generate_reports: {
        agent_name: 'Operations Reporting Agent',
        business_goal: 'Assemble cross-tool business updates automatically and deliver clean reports to decision-makers.',
        workflow: [
          'Pull metrics from source systems on schedule or manual trigger.',
          'Normalize KPIs across sales, support, finance, and ops datasets.',
          'Generate concise narrative summary with wins, risks, and anomalies.',
          'Deliver report to Slack, email, or dashboard with links to raw data.',
          'Archive report and compare against previous period for trend tracking.'
        ],
        example_output: 'Weekly report: pipeline up 14%, ticket backlog down 9%, revenue risk from overdue invoices equals $18k.',
        roi: 'Removes manual report assembly and gives leadership faster decisions with consistent KPI definitions.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'Google Sheets or warehouse', 'Slack', 'Email'],
        next_step: 'Lock KPI list, data owners, and report cadence before production rollout.'
      },
      book_meetings: {
        agent_name: 'Meeting Booking Agent',
        business_goal: 'Qualify prospects before calendar access and fill sales calendar with better-fit calls.',
        workflow: [
          'Collect inbound request from landing page, chat, or form.',
          'Ask short qualification questions and validate fit rules.',
          'Check rep availability and timezone constraints.',
          'Offer best available slot and push booking into calendar + CRM.',
          'Send reminder, prep summary, and no-show recovery follow-up.'
        ],
        example_output: 'Prospect passed ICP check, booked 3:30 PM GST slot, CRM deal created, reminder sequence armed.',
        roi: 'Improves booking conversion and protects team time by blocking poor-fit calls before scheduling.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'Calendly or Google Calendar', 'CRM', 'Email or WhatsApp'],
        next_step: 'Set qualification gates and connect calendar + CRM webhook actions.'
      },
      follow_up: {
        agent_name: 'Lead Follow-up Agent',
        business_goal: 'Revive warm leads automatically with timely, context-aware follow-up across channels.',
        workflow: [
          'Detect stalled lead based on inactivity, unanswered quote, or missed booking.',
          'Pull prior conversation context, source, and offer details.',
          'Generate short follow-up message matched to stage and channel.',
          'Send sequence with delay rules, stop conditions, and reply detection.',
          'Escalate engaged replies to sales with summary and recommended next move.'
        ],
        example_output: 'Lead asked for pricing 5 days ago. Agent sent reminder with case study and booking link. Reply received in 12 minutes.',
        roi: 'Recovers pipeline value from forgotten leads and keeps follow-up consistent without manual chasing.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'CRM', 'Email/WhatsApp', 'Slack alerts'],
        next_step: 'Define inactivity triggers, approved sequences, and opt-out handling.'
      },
      custom: {
        agent_name: 'Custom Workflow Agent',
        business_goal: trimToSentence(input) || 'Automate repetitive business task with one clear input-to-output workflow.',
        workflow: [
          'Capture task request and normalize business context.',
          'Apply routing, enrichment, and guardrails inside n8n workflow.',
          'Generate output or take action using Groq for reasoning and formatting.',
          'Return polished result to user and escalate exceptions when confidence is low.',
          'Track outcomes, bottlenecks, and next iteration opportunities.'
        ],
        example_output: 'Agent receives request, enriches context, produces structured result, and logs next action for team.',
        roi: 'Saves repetitive operator time and creates consistent execution path for high-frequency work.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'Primary business app', 'Slack or email'],
        next_step: 'Document one happy path, one exception path, and target KPI before launch.'
      }
    };

    var blueprint = templates[mode] || templates.custom;
    return Object.assign({}, blueprint, {
      business_goal: mode === 'custom' ? blueprint.business_goal : injectContext(blueprint.business_goal, input),
      next_step: blueprint.next_step + (reason ? ' Fallback reason: ' + reason.replace(/_/g, ' ') + '.' : ''),
      fallback: true
    });
  }

  function detectPresetFromText(lowered) {
    if (/lead|crm|qualif|sales/.test(lowered)) return 'qualify_leads';
    if (/support|ticket|order|refund|shipping/.test(lowered)) return 'customer_support';
    if (/report|dashboard|summary|kpi/.test(lowered)) return 'generate_reports';
    if (/meeting|book|calendar|schedule/.test(lowered)) return 'book_meetings';
    if (/follow.?up|nurture|remind/.test(lowered)) return 'follow_up';
    return 'custom';
  }

  function injectContext(base, input) {
    if (!input) return base;
    return base + ' Context: ' + trimToSentence(input);
  }

  function trimToSentence(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  function downloadBlueprint() {
    if (!state.currentBlueprint) {
      updateStatus(t('noBlueprint'), 'fallback');
      return;
    }

    var html = buildBlueprintDocument(state.currentBlueprint);
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = slugify(state.currentBlueprint.agent_name || 'ai-agent-blueprint') + '.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    updateStatus(t('downloaded'), 'ready');
  }

  function buildBlueprintDocument(blueprint) {
    var workflow = blueprint.workflow.map(function (step) {
      return '<li>' + escapeHtml(step) + '</li>';
    }).join('');

    var stack = blueprint.suggested_stack.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');

    return [
      '<!DOCTYPE html>',
      '<html lang="' + state.locale + '" dir="' + (state.locale === 'ar' ? 'rtl' : 'ltr') + '">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + escapeHtml(blueprint.agent_name) + '</title>',
      '<style>',
      'body{font-family:Manrope,Arial,sans-serif;background:#f5f7fb;color:#111827;margin:0;padding:40px;}main{max-width:860px;margin:0 auto;background:#fff;border:1px solid #dbe4f0;border-radius:24px;padding:36px;box-shadow:0 20px 50px rgba(15,23,42,.08);}h1{margin:0 0 10px;font-size:34px;}h2{margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;}section{padding:18px 0;border-top:1px solid #e2e8f0;}section:first-of-type{border-top:0;padding-top:8px;}p,li{line-height:1.75;}ul,ol{margin:0;padding-inline-start:20px;}ul.tags{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:10px;}ul.tags li{background:#eef2ff;border-radius:999px;padding:8px 14px;}@media print{body{background:#fff;padding:0;}main{box-shadow:none;border:0;border-radius:0;max-width:none;padding:24px;}}',
      '</style>',
      '</head>',
      '<body>',
      '<main>',
      '<h2>AI Agent Blueprint</h2>',
      '<h1>' + escapeHtml(blueprint.agent_name) + '</h1>',
      '<section><h2>' + escapeHtml(t('businessGoal')) + '</h2><p>' + escapeHtml(blueprint.business_goal) + '</p></section>',
      '<section><h2>' + escapeHtml(t('workflow')) + '</h2><ol>' + workflow + '</ol></section>',
      '<section><h2>' + escapeHtml(t('exampleOutput')) + '</h2><p>' + escapeHtml(blueprint.example_output) + '</p></section>',
      '<section><h2>' + escapeHtml(t('roi')) + '</h2><p>' + escapeHtml(blueprint.roi) + '</p></section>',
      '<section><h2>' + escapeHtml(t('stack')) + '</h2><ul class="tags">' + stack + '</ul></section>',
      '<section><h2>' + escapeHtml(t('nextStep')) + '</h2><p>' + escapeHtml(blueprint.next_step) + '</p></section>',
      '</main>',
      '</body>',
      '</html>'
    ].join('');
  }

  function slugify(value) {
    return String(value || 'ai-agent-blueprint')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ai-agent-blueprint';
  }

  function autoResize() {
    dom.taskInput.style.blockSize = 'auto';
    dom.taskInput.style.blockSize = Math.min(dom.taskInput.scrollHeight, 180) + 'px';
  }

  function scrollFeed() {
    dom.feed.scrollTop = dom.feed.scrollHeight;
  }

  function format(template, value) {
    return template.replace('%s', value);
  }

  function secondsUntil(timestamp) {
    return Math.max(1, Math.ceil((timestamp - Date.now()) / 1000));
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isWebhookConfigured(url) {
    return /^https?:\/\//.test(String(url || '')) && String(url).indexOf('your-n8n-domain') === -1;
  }
})();
