(function () {
  'use strict';

  var CONFIG = {
    WEBHOOK_BASE: 'https://n8n.srv1141109.hstgr.cloud/webhook',
    TEXT_ENDPOINT: 'https://n8n.srv1141109.hstgr.cloud/webhook/ai-blueprint-text',
    VOICE_ENDPOINT: 'https://n8n.srv1141109.hstgr.cloud/webhook/ai-blueprint-voice',
    SESSION_KEY: 'bp_studio_session_id',
    HISTORY_LIMIT: 4,
    REQUEST_TIMEOUT_MS: 30000,
    PDF_SCRIPT_URL: 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.11.2/html2pdf.bundle.min.js',
    MAX_AUDIO_SEC: 30
  };

  var PRESETS = {
    qualify_leads: {
      promptKey: 'bp_studio_followup_qualify',
      labelKey: 'bp_studio_preset_qualify'
    },
    customer_support: {
      promptKey: 'bp_studio_followup_support',
      labelKey: 'bp_studio_preset_support'
    },
    generate_reports: {
      promptKey: 'bp_studio_followup_reports',
      labelKey: 'bp_studio_preset_reports'
    },
    book_meetings: {
      promptKey: 'bp_studio_followup_meetings',
      labelKey: 'bp_studio_preset_meetings'
    },
    follow_up: {
      promptKey: 'bp_studio_followup_follow_up',
      labelKey: 'bp_studio_preset_follow_up'
    },
    custom: {
      promptKey: 'bp_studio_followup_custom',
      labelKey: 'bp_studio_preset_custom'
    }
  };

  var state = {
    activePreset: 'custom',
    busy: false,
    messages: [],
    result: null,
    statusKey: 'bp_studio_status_idle',
    statusTone: 'soft',
    recorder: null,
    recordStart: 0,
    recordTimer: null,
    recording: false,
    transcribingTimer: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function currentLang() {
    return String(document.documentElement.getAttribute('lang') || 'en').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  function currentDir() {
    return String(document.documentElement.getAttribute('dir') || (currentLang() === 'ar' ? 'rtl' : 'ltr')).toLowerCase() === 'rtl' ? 'rtl' : 'ltr';
  }

  function t(key) {
    var dict = window.__i18n || {};
    var lang = currentLang();
    if (dict[key] && dict[key][lang] != null) return dict[key][lang];
    return key;
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function nl2br(value) {
    return escapeHTML(value).replace(/\n/g, '<br/>');
  }

  function getSessionId() {
    try {
      var existing = sessionStorage.getItem(CONFIG.SESSION_KEY);
      if (existing) return existing;
      var next = crypto.randomUUID ? crypto.randomUUID() : 'bp-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      sessionStorage.setItem(CONFIG.SESSION_KEY, next);
      return next;
    } catch (error) {
      return crypto.randomUUID ? crypto.randomUUID() : 'bp-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }
  }

  function slugify(value) {
    return String(value || 'blueprint')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'blueprint';
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function pushMessage(role, content, variant) {
    state.messages.push({
      role: role,
      content: String(content || '').trim(),
      variant: variant || 'text',
      createdAt: Date.now()
    });
    renderChat();
  }

  function getPresetLabel(key) {
    var preset = PRESETS[key] || PRESETS.custom;
    return t(preset.labelKey);
  }

  function getFollowupText() {
    var preset = PRESETS[state.activePreset] || PRESETS.custom;
    return t(preset.promptKey);
  }

  function setStatus(keyOrText, tone) {
    state.statusKey = keyOrText;
    state.statusTone = tone || 'soft';
    renderStatus();
  }

  function statusText() {
    if (state.statusKey && state.statusKey.indexOf('bp_studio_') === 0) return t(state.statusKey);
    return state.statusKey || '';
  }

  function updatePresetButtons() {
    var buttons = document.querySelectorAll('.bp-studio-chip');
    buttons.forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-preset') === state.activePreset);
    });
  }

  function renderChat() {
    var chat = $('bp-studio-chat');
    if (!chat) return;

    var html = '';
    if (!state.messages.length) {
      html = [
        '<div class="bp-studio-bubble bp-studio-bubble-assistant">',
        '  <span class="bp-studio-bubble-meta">' + escapeHTML(t('bp_studio_assistant_label')) + '</span>',
        '  <p class="bp-studio-bubble-text">' + escapeHTML(t('bp_studio_chat_empty')) + '</p>',
        '</div>'
      ].join('');
    } else {
      html = state.messages.map(function (entry) {
        return [
          '<div class="bp-studio-bubble ' + (entry.role === 'user' ? 'bp-studio-bubble-user' : 'bp-studio-bubble-assistant') + '">',
          '  <span class="bp-studio-bubble-meta">' + escapeHTML(entry.role === 'user' ? t('bp_studio_user_label') : t('bp_studio_assistant_label')) + '</span>',
          '  <p class="bp-studio-bubble-text">' + nl2br(entry.content) + '</p>',
          '</div>'
        ].join('');
      }).join('');
    }

    if (state.busy) {
      html += [
        '<div class="bp-studio-bubble bp-studio-bubble-assistant">',
        '  <span class="bp-studio-bubble-meta">' + escapeHTML(t('bp_studio_assistant_label')) + '</span>',
        '  <div class="bp-studio-typing" aria-label="' + escapeHTML(t('bp_studio_typing')) + '"><span></span><span></span><span></span></div>',
        '</div>'
      ].join('');
    }

    chat.innerHTML = html;
    chat.scrollTop = chat.scrollHeight;
  }

  function renderFollowup() {
    var text = $('bp-studio-followup-text');
    if (!text) return;
    text.textContent = getFollowupText();
  }

  function renderStatus() {
    var el = $('bp-studio-status');
    if (!el) return;
    el.textContent = statusText();
    el.classList.remove('is-soft', 'is-warning', 'is-danger');
    el.classList.add(state.statusTone === 'danger' ? 'is-danger' : state.statusTone === 'warning' ? 'is-warning' : 'is-soft');
  }

  function renderResult() {
    var resultEl = $('bp-studio-result');
    var previewEl = $('bp-studio-export-preview');
    var emptyEl = $('bp-studio-empty');
    var htmlButton = $('bp-studio-download-html');
    var pdfButton = $('bp-studio-download-pdf');

    if (!resultEl || !previewEl || !emptyEl || !htmlButton || !pdfButton) return;

    if (!state.result) {
      resultEl.hidden = true;
      previewEl.hidden = true;
      emptyEl.hidden = false;
      htmlButton.disabled = true;
      pdfButton.disabled = true;
      resultEl.innerHTML = '';
      previewEl.innerHTML = '';
      return;
    }

    emptyEl.hidden = true;
    resultEl.hidden = false;
    previewEl.hidden = false;
    htmlButton.disabled = false;
    pdfButton.disabled = false;

    var workflowItems = (state.result.workflow || []).map(function (item) {
      return '<li>' + escapeHTML(item) + '</li>';
    }).join('');

    var stackItems = (state.result.suggested_stack || []).map(function (item) {
      return '<span>' + escapeHTML(item) + '</span>';
    }).join('');

    resultEl.innerHTML = [
      '<div class="bp-studio-result-card">',
      '  <p class="bp-studio-result-eyebrow">' + escapeHTML(t('bp_studio_result_eyebrow')) + '</p>',
      '  <h4 class="bp-studio-result-name">' + escapeHTML(state.result.agent_name) + '</h4>',
      '  <p class="bp-studio-result-goal">' + escapeHTML(state.result.business_goal) + '</p>',
      '</div>',
      '<div class="bp-studio-result-grid">',
      '  <section class="bp-studio-result-section">',
      '    <h4>' + escapeHTML(t('bp_studio_workflow_title')) + '</h4>',
      '    <ol class="bp-studio-result-list">' + workflowItems + '</ol>',
      '  </section>',
      '  <section class="bp-studio-result-section">',
      '    <h4>' + escapeHTML(t('bp_studio_example_title')) + '</h4>',
      '    <p>' + escapeHTML(state.result.example_output) + '</p>',
      '  </section>',
      '  <section class="bp-studio-result-section">',
      '    <h4>' + escapeHTML(t('bp_studio_roi_title')) + '</h4>',
      '    <p>' + escapeHTML(state.result.roi) + '</p>',
      '  </section>',
      '  <section class="bp-studio-result-section">',
      '    <h4>' + escapeHTML(t('bp_studio_stack_title')) + '</h4>',
      '    <div class="bp-studio-stack">' + stackItems + '</div>',
      '  </section>',
      '  <section class="bp-studio-result-section">',
      '    <h4>' + escapeHTML(t('bp_studio_next_step_title')) + '</h4>',
      '    <p>' + escapeHTML(state.result.next_step) + '</p>',
      '  </section>',
      '</div>',
      '<div class="bp-studio-result-foot">',
      '  <div class="bp-studio-badge ' + (state.result.fallback ? 'is-fallback' : '') + '">',
      '    <span class="material-symbols-outlined">' + (state.result.fallback ? 'bolt' : 'verified') + '</span>',
      '    <span>' + escapeHTML(state.result.fallback ? t('bp_studio_fallback_badge') : t('bp_studio_live_badge')) + '</span>',
      '  </div>',
      '  <div>' + escapeHTML(state.result.message || t('bp_studio_result_ready')) + '</div>',
      '</div>'
    ].join('');

    previewEl.innerHTML = buildPreviewHTML(state.result);
  }

  function renderAll() {
    updatePresetButtons();
    renderFollowup();
    renderChat();
    renderStatus();
    renderResult();
    syncBusyState();
  }

  function syncBusyState() {
    var input = $('bp-studio-input');
    var send = $('bp-studio-send');
    var mic = $('bp-studio-mic');
    var reset = $('bp-studio-reset');
    var locked = state.busy || state.recording;
    if (input) input.disabled = locked;
    if (send) send.disabled = locked;
    if (mic) {
      mic.disabled = state.busy && !state.recording;
      mic.classList.toggle('is-recording', !!state.recording);
    }
    if (reset) reset.disabled = locked;
    document.querySelectorAll('.bp-studio-chip').forEach(function (button) {
      button.disabled = locked;
    });
  }

  function buildPrompt(details) {
    return [
      'Use case: ' + getPresetLabel(state.activePreset),
      'Requested outcome: ' + String(details || '').trim(),
      'Need one production-minded AI agent blueprint for this landing page demo.'
    ].join('\n');
  }

  function getHistoryPayload() {
    return state.messages.slice(-CONFIG.HISTORY_LIMIT).map(function (entry) {
      return {
        role: entry.role === 'user' ? 'user' : 'assistant',
        content: entry.content
      };
    });
  }

  function normalizeBlueprint(data, fallbackReason) {
    var fallback = buildLocalFallback(state.activePreset, fallbackReason);
    if (!data || !data.agent_name || !Array.isArray(data.workflow) || !Array.isArray(data.suggested_stack)) return fallback;
    return {
      ok: data.ok !== false,
      fallback: !!data.fallback,
      message: data.message || t('bp_studio_result_ready'),
      agent_name: String(data.agent_name || fallback.agent_name).trim(),
      business_goal: String(data.business_goal || fallback.business_goal).trim(),
      workflow: Array.isArray(data.workflow) ? data.workflow.slice(0, 6).map(function (item) { return String(item).trim(); }).filter(Boolean) : fallback.workflow,
      example_output: String(data.example_output || fallback.example_output).trim(),
      roi: String(data.roi || fallback.roi).trim(),
      suggested_stack: Array.isArray(data.suggested_stack) ? data.suggested_stack.slice(0, 6).map(function (item) { return String(item).trim(); }).filter(Boolean) : fallback.suggested_stack,
      next_step: String(data.next_step || fallback.next_step).trim(),
      meta: data.meta || null
    };
  }

  function buildLocalFallback(presetKey, reason) {
    var fallbackReason = reason || 'local_fallback';
    var templates = {
      qualify_leads: {
        agent_name: 'Lead Capture Blueprint',
        business_goal: 'Qualify inbound leads fast and route high-fit prospects before response time slips.',
        workflow: ['Capture website lead.', 'Score lead against budget, offer, and urgency.', 'Push qualified record into CRM.', 'Send instant follow-up with booking link.', 'Escalate weak-confidence cases to sales.'],
        example_output: 'Inbound lead scored 84/100, added to CRM, and sent booking link within one minute.',
        roi: 'Cuts manual triage time and improves lead response speed.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'CRM', 'Calendly', 'Email or WhatsApp'],
        next_step: 'Lock scoring rules and test against recent inbound leads.'
      },
      customer_support: {
        agent_name: 'Support Triage Blueprint',
        business_goal: 'Resolve repetitive support questions automatically while escalating risky cases cleanly.',
        workflow: ['Receive ticket or message.', 'Classify intent and urgency.', 'Fetch order or customer context.', 'Draft answer or escalate with summary.', 'Log resolution and next action.'],
        example_output: 'Customer asked about delayed order and got instant tracking answer with escalation path.',
        roi: 'Lowers repetitive support load and improves consistency during spikes.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'Helpdesk', 'CRM or Shopify', 'Slack'],
        next_step: 'List top support intents and human escalation rules.'
      },
      generate_reports: {
        agent_name: 'Ops Reporting Blueprint',
        business_goal: 'Assemble recurring reports from multiple systems without manual spreadsheet work.',
        workflow: ['Pull KPIs from source apps.', 'Normalize fields and compare time windows.', 'Generate concise insight summary.', 'Deliver report to team channel.', 'Archive output for later review.'],
        example_output: 'Weekly performance report sent with KPI summary and highlighted anomalies.',
        roi: 'Shortens reporting cycle and keeps leadership updates consistent.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'Google Sheets or warehouse', 'Slack', 'Email'],
        next_step: 'Define fixed KPI list and reporting cadence.'
      },
      book_meetings: {
        agent_name: 'Meeting Qualification Blueprint',
        business_goal: 'Protect calendar quality by qualifying prospects before booking.',
        workflow: ['Collect request.', 'Ask fit questions.', 'Validate timezone and qualification rules.', 'Offer approved slots.', 'Send reminders and reactivation flow.'],
        example_output: 'Qualified prospect booked meeting with CRM record and reminder sequence generated automatically.',
        roi: 'Reduces poor-fit meetings and improves calendar utilization.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'Google Calendar', 'CRM', 'WhatsApp or Email'],
        next_step: 'Define qualification gates and scheduling windows.'
      },
      follow_up: {
        agent_name: 'Lead Reactivation Blueprint',
        business_goal: 'Restart stale lead conversations with timed, context-aware follow-up.',
        workflow: ['Detect inactive lead.', 'Load conversation context.', 'Generate short follow-up.', 'Send sequence with stop rules.', 'Route replies to sales.'],
        example_output: 'Warm lead re-engaged with contextual reminder and direct booking link.',
        roi: 'Recovers pipeline without ongoing manual chasing.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'CRM', 'Email or WhatsApp', 'Slack'],
        next_step: 'Set inactivity trigger and approved follow-up sequence.'
      },
      custom: {
        agent_name: 'Custom Workflow Blueprint',
        business_goal: 'Turn repetitive operational work into one clear automation path.',
        workflow: ['Capture trigger event.', 'Normalize context.', 'Generate structured action plan.', 'Handle exceptions with human review.', 'Track result for iteration.'],
        example_output: 'Request transformed into structured automation blueprint with next action and tooling list.',
        roi: 'Creates repeatable execution path for recurring tasks.',
        suggested_stack: ['n8n', 'Groq gpt-oss-20b', 'Primary business app', 'Slack or Email'],
        next_step: 'Define happy path and one exception path before production build.'
      }
    };

    var selected = templates[presetKey] || templates.custom;
    return {
      ok: true,
      fallback: true,
      message: t('bp_studio_fallback_message') + ' ' + fallbackReason.replace(/_/g, ' ') + '.',
      agent_name: selected.agent_name,
      business_goal: selected.business_goal,
      workflow: selected.workflow,
      example_output: selected.example_output,
      roi: selected.roi,
      suggested_stack: selected.suggested_stack,
      next_step: selected.next_step,
      meta: { provider: 'client', mode: 'fallback' }
    };
  }

  async function fetchJsonWithRetry(url, options) {
    var attempt = 0;
    while (attempt < 2) {
      var controller = new AbortController();
      var timer = setTimeout(function () {
        controller.abort();
      }, CONFIG.REQUEST_TIMEOUT_MS);

      try {
        var requestOptions = Object.assign({}, options, { signal: controller.signal });
        var response = await fetch(url, requestOptions);
        clearTimeout(timer);

        var data = {};
        try {
          data = await response.json();
        } catch (parseError) {
          data = {};
        }

        if (response.status === 429 && attempt === 0) {
          var retryAfter = Number((data && data.retry_after_seconds) || response.headers.get('retry-after') || 0);
          if (retryAfter > 0 && retryAfter <= 4) {
            setStatus(t('bp_studio_status_backoff') + ' ' + retryAfter + 's', 'warning');
            await sleep(retryAfter * 1000);
            attempt += 1;
            continue;
          }
        }

        if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt === 0) {
          await sleep(900);
          attempt += 1;
          continue;
        }

        return { response: response, data: data };
      } catch (error) {
        clearTimeout(timer);
        if (attempt === 0) {
          await sleep(900);
          attempt += 1;
          continue;
        }
        throw error;
      }
    }

    throw new Error('request_failed');
  }

  async function requestBlueprint(details, sourceLabel) {
    var payload = {
      session_id: getSessionId(),
      locale: currentLang(),
      use_case: state.activePreset,
      preset: state.activePreset,
      source: sourceLabel,
      details: details,
      prompt: buildPrompt(details),
      history: getHistoryPayload().slice(0, -1)
    };

    state.busy = true;
    setStatus('bp_studio_status_generating', 'soft');
    renderAll();

    try {
      var result = await fetchJsonWithRetry(CONFIG.TEXT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!result.response.ok) {
        state.result = buildLocalFallback(state.activePreset, result.response.status === 429 ? 'rate_limited' : 'provider_error');
        pushMessage('assistant', t('bp_studio_assistant_fallback'));
        setStatus('bp_studio_status_fallback', 'warning');
      } else {
        state.result = normalizeBlueprint(result.data, result.data && result.data.fallback ? 'provider_busy' : '');
        pushMessage('assistant', result.data && result.data.fallback ? t('bp_studio_assistant_fallback') : t('bp_studio_assistant_done'));
        setStatus(state.result.fallback ? 'bp_studio_status_fallback' : 'bp_studio_status_ready', state.result.fallback ? 'warning' : 'soft');
      }
    } catch (error) {
      state.result = buildLocalFallback(state.activePreset, error && error.name === 'AbortError' ? 'timeout' : 'network_retry_exhausted');
      pushMessage('assistant', t('bp_studio_assistant_fallback'));
      setStatus('bp_studio_status_fallback', 'warning');
    } finally {
      state.busy = false;
      renderAll();
    }
  }

  async function handleSubmit() {
    if (state.busy) return;
    var input = $('bp-studio-input');
    if (!input) return;
    var details = String(input.value || '').trim();
    if (!details) {
      setStatus('bp_studio_status_need_input', 'danger');
      return;
    }
    input.value = '';
    pushMessage('user', details);
    await requestBlueprint(details, 'blueprint_studio_text');
  }

  function clearRecordingArtifacts() {
    if (state.recordTimer) clearInterval(state.recordTimer);
    if (state.transcribingTimer) clearTimeout(state.transcribingTimer);
    state.recordTimer = null;
    state.transcribingTimer = null;
  }

  async function handleVoiceBlob(blob) {
    clearRecordingArtifacts();
    state.busy = true;
    state.recording = false;
    setStatus('bp_studio_status_uploading', 'soft');
    renderAll();

    state.transcribingTimer = setTimeout(function () {
      setStatus('bp_studio_status_transcribing', 'soft');
    }, 750);

    var formData = new FormData();
    formData.append('session_id', getSessionId());
    formData.append('locale', currentLang());
    formData.append('preset', state.activePreset);
    formData.append('use_case', state.activePreset);
    formData.append('source', 'blueprint_studio_voice');
    formData.append('continue_generation', 'false');
    formData.append('audio_field', 'file');
    formData.append('file', blob, 'blueprint-studio.webm');

    try {
      var result = await fetchJsonWithRetry(CONFIG.VOICE_ENDPOINT, {
        method: 'POST',
        body: formData
      });

      clearRecordingArtifacts();
      if (!result.response.ok || !result.data || !result.data.transcript) {
        state.busy = false;
        setStatus('bp_studio_status_voice_fallback', 'warning');
        pushMessage('assistant', t('bp_studio_voice_soft_fail'));
        renderAll();
        return;
      }

      var transcript = String(result.data.transcript || '').trim();
      pushMessage('user', transcript);
      await requestBlueprint(transcript, 'blueprint_studio_voice');
    } catch (error) {
      clearRecordingArtifacts();
      state.busy = false;
      setStatus('bp_studio_status_voice_fallback', 'warning');
      pushMessage('assistant', t('bp_studio_voice_soft_fail'));
      renderAll();
    }
  }

  async function startRecording() {
    if (state.busy || state.recording) return;
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      var recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      var chunks = [];

      recorder.ondataavailable = function (event) {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = function () {
        stream.getTracks().forEach(function (track) { track.stop(); });
        if (!chunks.length) {
          state.recording = false;
          state.busy = false;
          setStatus('bp_studio_status_idle', 'soft');
          renderAll();
          return;
        }
        handleVoiceBlob(new Blob(chunks, { type: 'audio/webm' }));
      };

      recorder.start();
      state.recorder = recorder;
      state.recordStart = Date.now();
      state.recording = true;
      state.busy = false;
      setStatus('bp_studio_status_listening', 'soft');
      renderAll();

      state.recordTimer = setInterval(function () {
        var elapsed = Math.floor((Date.now() - state.recordStart) / 1000);
        if (elapsed >= CONFIG.MAX_AUDIO_SEC) stopRecording();
      }, 250);
    } catch (error) {
      state.recording = false;
      setStatus('bp_studio_status_mic_denied', 'warning');
      renderAll();
    }
  }

  function stopRecording() {
    if (!state.recorder || state.recorder.state !== 'recording') return;
    state.busy = true;
    state.recording = false;
    setStatus('bp_studio_status_uploading', 'soft');
    renderAll();
    state.recorder.stop();
  }

  function resetStudio() {
    if (state.busy) return;
    state.activePreset = 'custom';
    state.messages = [];
    state.result = null;
    state.statusKey = 'bp_studio_status_idle';
    state.statusTone = 'soft';
    var input = $('bp-studio-input');
    if (input) input.value = '';
    renderAll();
  }

  function buildPreviewHTML(result) {
    var workflowItems = (result.workflow || []).map(function (item) {
      return '<li>' + escapeHTML(item) + '</li>';
    }).join('');
    var stackItems = (result.suggested_stack || []).map(function (item) {
      return '<li>' + escapeHTML(item) + '</li>';
    }).join('');
    var createdLabel = new Date().toLocaleString(currentLang() === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    return [
      '<div class="bp-studio-preview-head">',
      '  <div>',
      '    <div class="bp-studio-kicker">' + escapeHTML(t('bp_studio_export_label')) + '</div>',
      '    <h3>' + escapeHTML(result.agent_name) + '</h3>',
      '    <p>' + escapeHTML(result.business_goal) + '</p>',
      '  </div>',
      '  <div class="bp-studio-preview-meta">',
      '    <div>' + escapeHTML(t('bp_studio_export_date')) + ': ' + escapeHTML(createdLabel) + '</div>',
      '    <div>' + escapeHTML(t('bp_studio_export_source')) + ': Blueprint Studio</div>',
      '  </div>',
      '</div>',
      '<div class="bp-studio-preview-grid">',
      '  <section class="bp-studio-preview-card">',
      '    <h4>' + escapeHTML(t('bp_studio_workflow_title')) + '</h4>',
      '    <ol class="bp-studio-preview-list">' + workflowItems + '</ol>',
      '  </section>',
      '  <section class="bp-studio-preview-card">',
      '    <h4>' + escapeHTML(t('bp_studio_example_title')) + '</h4>',
      '    <p>' + escapeHTML(result.example_output) + '</p>',
      '  </section>',
      '  <section class="bp-studio-preview-card">',
      '    <h4>' + escapeHTML(t('bp_studio_roi_title')) + '</h4>',
      '    <p>' + escapeHTML(result.roi) + '</p>',
      '  </section>',
      '  <section class="bp-studio-preview-card">',
      '    <h4>' + escapeHTML(t('bp_studio_stack_title')) + '</h4>',
      '    <ul class="bp-studio-preview-list">' + stackItems + '</ul>',
      '  </section>',
      '  <section class="bp-studio-preview-card">',
      '    <h4>' + escapeHTML(t('bp_studio_next_step_title')) + '</h4>',
      '    <p>' + escapeHTML(result.next_step) + '</p>',
      '  </section>',
      '</div>'
    ].join('');
  }

  function buildStandaloneHTML() {
    if (!state.result) return '';
    var isAr = currentLang() === 'ar';
    var fontDisplay = isAr ? "'Noto Sans Arabic', 'Manrope', system-ui, sans-serif" : "'Manrope', system-ui, sans-serif";
    var fontBody = isAr ? "'Noto Sans Arabic', 'Inter', system-ui, sans-serif" : "'Inter', system-ui, sans-serif";

    return [
      '<!DOCTYPE html>',
      '<html lang="' + escapeHTML(currentLang()) + '" dir="' + escapeHTML(currentDir()) + '">',
      '<head>',
      '<meta charset="utf-8"/>',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>',
      '<title>' + escapeHTML(state.result.agent_name) + ' | Blueprint Export</title>',
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@800&family=Noto+Sans+Arabic:wght@400;600;700;800&display=swap" rel="stylesheet">',
      '<style>',
      ':root {',
      '  --bg: #fbfaf8;',
      '  --surface: #ffffff;',
      '  --surface-muted: #f4efea;',
      '  --ink: #1a1917;',
      '  --ink-dim: #6b6763;',
      '  --accent: #1a1917;',
      '  --border: rgba(26, 25, 23, 0.08);',
      '  --radius: 20px;',
      '}',
      'body {',
      '  font-family: ' + fontBody + ';',
      '  background-color: var(--bg);',
      '  color: var(--ink);',
      '  margin: 0;',
      '  padding: 40px 20px;',
      '  line-height: 1.6;',
      '  -webkit-font-smoothing: antialiased;',
      '}',
      '.sheet {',
      '  max-width: 840px;',
      '  margin: 0 auto;',
      '  background: var(--surface);',
      '  border: 1px solid var(--border);',
      '  border-radius: var(--radius);',
      '  padding: 50px;',
      '  box-shadow: 0 30px 60px -20px rgba(26, 25, 23, 0.12), 0 0 1px 0 rgba(26, 25, 23, 0.1);',
      '}',
      '.bp-studio-preview-head {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: flex-start;',
      '  gap: 30px;',
      '  padding-bottom: 30px;',
      '  border-bottom: 1.5px solid var(--border);',
      '  margin-bottom: 30px;',
      '}',
      '.bp-studio-preview-head h3 {',
      '  font-family: ' + fontDisplay + ';',
      '  font-size: 38px;',
      '  line-height: 1.1;',
      '  margin: 16px 0 12px;',
      '  font-weight: 800;',
      '  letter-spacing: -0.04em;',
      '  color: var(--ink);',
      '}',
      '.bp-studio-preview-head p {',
      '  margin: 0;',
      '  color: var(--ink-dim);',
      '  font-size: 18px;',
      '  font-weight: 500;',
      '  max-width: 520px;',
      '}',
      '.bp-studio-kicker {',
      '  display: inline-flex;',
      '  padding: 6px 12px;',
      '  border-radius: 999px;',
      '  background: var(--surface-muted);',
      '  color: var(--ink-dim);',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '  letter-spacing: 0.14em;',
      '  text-transform: uppercase;',
      '}',
      '.bp-studio-preview-meta {',
      '  text-align: right;',
      '  color: var(--ink-dim);',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  padding-top: 8px;',
      '}',
      '[dir="rtl"] .bp-studio-preview-meta { text-align: left; }',
      '.bp-studio-preview-grid {',
      '  display: grid;',
      '  grid-template-columns: repeat(2, 1fr);',
      '  gap: 20px;',
      '}',
      '.bp-studio-preview-card {',
      '  padding: 24px;',
      '  border-radius: 16px;',
      '  background: var(--surface-muted);',
      '  border: 1px solid var(--border);',
      '  transition: transform 0.2s ease;',
      '}',
      '.bp-studio-preview-card:nth-child(1) { grid-column: span 2; }',
      '.bp-studio-preview-card h4 {',
      '  margin: 0 0 14px;',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '  letter-spacing: 0.12em;',
      '  text-transform: uppercase;',
      '  color: var(--ink-dim);',
      '}',
      '.bp-studio-preview-card p, .bp-studio-preview-list li {',
      '  margin: 0;',
      '  font-size: 15px;',
      '  color: var(--ink);',
      '  line-height: 1.7;',
      '}',
      '.bp-studio-preview-list {',
      '  display: grid;',
      '  gap: 8px;',
      '  padding-inline-start: 18px;',
      '  margin: 0;',
      '}',
      '@media (max-width: 760px) {',
      '  body { padding: 15px; }',
      '  .sheet { padding: 30px; border-radius: 16px; }',
      '  .bp-studio-preview-head { flex-direction: column; gap: 20px; }',
      '  .bp-studio-preview-meta { text-align: left; }',
      '  [dir="rtl"] .bp-studio-preview-meta { text-align: right; }',
      '  .bp-studio-preview-grid { grid-template-columns: 1fr; }',
      '  .bp-studio-preview-card { grid-column: span 1 !important; }',
      '  .bp-studio-preview-head h3 { font-size: 28px; }',
      '}',
      '</style>',
      '</head>',
      '<body>',
      '  <div class="sheet">',
      '    ' + buildPreviewHTML(state.result),
      '  </div>',
      '</body>',
      '</html>'
    ].join('');
  }

  function downloadBlob(content, type, filename) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  async function ensurePdfLibrary() {
    if (window.html2pdf) return window.html2pdf;
    await new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-bp-studio-pdf]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(); }, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = CONFIG.PDF_SCRIPT_URL;
      script.async = true;
      script.setAttribute('data-bp-studio-pdf', 'true');
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return window.html2pdf;
  }

  function exportHtml() {
    if (!state.result) return;
    downloadBlob(buildStandaloneHTML(), 'text/html;charset=utf-8', slugify(state.result.agent_name) + '.html');
    setStatus('bp_studio_status_export_html', 'soft');
  }

  async function exportPdf() {
    if (!state.result) return;
    var html2pdf;
    var preview = $('bp-studio-export-preview');
    var clone = null;
    if (!preview) return;

    try {
      setStatus('bp_studio_status_export_pdf', 'soft');
      html2pdf = await ensurePdfLibrary();
      clone = preview.cloneNode(true);
      clone.hidden = false;
      clone.classList.add('is-offscreen');
      document.body.appendChild(clone);
      await html2pdf().set({
        margin: 10,
        filename: slugify(state.result.agent_name) + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#f4efe9' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(clone).save();
      setStatus('bp_studio_status_export_done', 'soft');
    } catch (error) {
      setStatus('bp_studio_status_export_fallback', 'warning');
    } finally {
      if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
    }
  }

  function bindEvents() {
    var send = $('bp-studio-send');
    var mic = $('bp-studio-mic');
    var reset = $('bp-studio-reset');
    var input = $('bp-studio-input');
    var htmlButton = $('bp-studio-download-html');
    var pdfButton = $('bp-studio-download-pdf');

    document.querySelectorAll('.bp-studio-chip').forEach(function (button) {
      button.addEventListener('click', function () {
        state.activePreset = button.getAttribute('data-preset') || 'custom';
        pushMessage('assistant', getFollowupText());
        setStatus('bp_studio_status_idle', 'soft');
        renderAll();
        if (input) input.focus();
      });
    });

    if (send) send.addEventListener('click', handleSubmit);
    if (mic) {
      mic.addEventListener('click', function () {
        if (state.recording) stopRecording();
        else startRecording();
      });
    }
    if (reset) reset.addEventListener('click', resetStudio);
    if (htmlButton) htmlButton.addEventListener('click', exportHtml);
    if (pdfButton) pdfButton.addEventListener('click', exportPdf);
    if (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          handleSubmit();
        }
      });
    }

    var observer = new MutationObserver(function () {
      renderAll();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir', 'class'] });
  }

  function init() {
    if (!$('blueprint-studio')) return;
    bindEvents();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
