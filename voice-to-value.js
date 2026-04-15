/* ── Unified Input Hub: Production Interaction Engine ── */

(function() {
    'use strict';

    const CONFIG = {
        V2V_ENDPOINT: 'https://n8n.srv1141109.hstgr.cloud/webhook/voice-lead-capture',
        MAX_RECORD_SEC: 60,
        MAX_FILE_SIZE_MB: 10,
        PROCESSING_STEPS: [
            { id: 'reading', label: 'v2v_status_reading', progress: 20 },
            { id: 'extracting', label: 'v2v_status_extracting', progress: 45 },
            { id: 'analyzing', label: 'v2v_status_analyzing', progress: 70 },
            { id: 'structuring', label: 'v2v_status_structuring', progress: 85 },
            { id: 'ready', label: 'v2v_status_ready', progress: 100 }
        ],
        VOICE_STEPS: [
            { id: 'uploading', label: 'v2v_status_uploading', progress: 25 },
            { id: 'transcribing', label: 'v2v_status_transcribing', progress: 50 },
            { id: 'structuring', label: 'v2v_status_structuring', progress: 75 },
            { id: 'ready', label: 'v2v_status_ready', progress: 100 }
        ]
    };

    const state = {
        recorder: null,
        chunks: [],
        recording: false,
        processing: false,
        timer: null,
        startMs: 0,
        stream: null,
        mode: 'voice',
        outcome: 'lead'
    };

    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);

    function currentLang() {
        return document.documentElement.lang || 'en';
    }

    function t(key) {
        const dict = window.__i18n || {};
        const lang = currentLang();
        if (dict[key] && dict[key][lang] != null) return dict[key][lang];
        return key;
    }

    // Initial State Check
    function init() {
        // Mode Management
        $$('.v2v-mode-tab').forEach(btn => {
            btn.addEventListener('click', () => switchMode(btn.dataset.mode));
        });

        // Outcome Management
        $$('.v2v-outcome-chip').forEach(btn => {
            btn.addEventListener('click', () => switchOutcome(btn.dataset.outcome));
        });

        // Voice Controls
        const micBtn = $('v2v-mic-btn');
        const stopBtn = $('v2v-stop');
        const cancelBtn = $('v2v-cancel');
        if (micBtn) micBtn.addEventListener('click', startRecording);
        if (stopBtn) stopBtn.addEventListener('click', finishRecording);
        if (cancelBtn) cancelBtn.addEventListener('click', cancelRecording);

        // Text & Link Controls
        const sendTextBtn = $('v2v-send-text');
        const sendLinkBtn = $('v2v-send-link');
        if (sendTextBtn) sendTextBtn.addEventListener('click', handleTextSubmit);
        if (sendLinkBtn) sendLinkBtn.addEventListener('click', handleLinkSubmit);

        // File Controls
        const fileInput = $('v2v-file-input');
        if (fileInput) fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFileSubmit(e.target.files[0]);
        });
    }

    function switchMode(newMode) {
        if (state.processing || state.recording) return;
        state.mode = newMode;

        // Update Tabs
        $$('.v2v-mode-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === newMode);
        });

        // Update Views
        $$('.v2v-mode-view').forEach(view => {
            const modeId = view.id.replace('v2v-view-', '');
            view.classList.toggle('hidden', modeId !== newMode);
            view.classList.toggle('active', modeId === newMode);
        });

        console.log(`Input Hub: Mode switched to ${newMode}`);
    }

    function switchOutcome(newOutcome) {
        if (state.processing) return;
        state.outcome = newOutcome;

        // Update Chips
        $$('.v2v-outcome-chip').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.outcome === newOutcome);
        });

        console.log(`Input Hub: Outcome set to ${newOutcome}`);
    }

    /* ── Voice Engine ── */

    async function startRecording() {
        if (state.processing || state.recording) return;

        try {
            state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
            const supportedType = types.find(t => MediaRecorder.isTypeSupported(t));
            
            state.recorder = new MediaRecorder(state.stream, { 
                mimeType: supportedType || 'audio/webm' 
            });
            
            state.chunks = [];
            state.recorder.ondataavailable = (e) => {
                if (e.data.size > 0) state.chunks.push(e.data);
            };

            state.recorder.onstop = () => {
                const wasRecording = state.recording;
                state.recording = false;
                if (wasRecording) {
                    processInput('voice', new Blob(state.chunks, { type: state.recorder.mimeType }));
                }
            };

            state.recorder.start();
            state.recording = true;
            state.startMs = Date.now();
            
            updateUIState('listening');

            state.timer = setInterval(() => {
                const elapsed = (Date.now() - state.startMs) / 1000;
                if (elapsed >= CONFIG.MAX_RECORD_SEC) finishRecording();
                updateTimerDisplay(elapsed);
            }, 100);

        } catch (err) {
            console.error('Mic error:', err);
            updateUIState('error');
        }
    }

    function finishRecording() {
        if (!state.recorder || state.recorder.state !== 'recording') return;
        state.recorder.stop();
        if (state.timer) clearInterval(state.timer);
        if (state.stream) state.stream.getTracks().forEach(track => track.stop());
    }

    function cancelRecording() {
        state.recording = false; 
        if (state.recorder && state.recorder.state === 'recording') state.recorder.stop();
        if (state.timer) clearInterval(state.timer);
        if (state.stream) state.stream.getTracks().forEach(track => track.stop());
        state.chunks = [];
        updateUIState('idle');
    }

    /* ── Input Handlers ── */

    async function handleTextSubmit() {
        const input = $('v2v-text-input');
        if (!input || !input.value.trim() || state.processing) return;
        const text = input.value.trim();
        input.value = '';
        await processInput('text', text);
    }

    async function handleLinkSubmit() {
        const input = $('v2v-link-input');
        if (!input || !input.value.trim() || state.processing) return;
        const link = input.value.trim();
        if (!link.startsWith('http')) {
            alert('Please enter a valid URL');
            return;
        }
        input.value = '';
        await processInput('link', link);
    }

    async function handleFileSubmit(file) {
        if (state.processing) return;
        if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
            alert(`File too large. Max ${CONFIG.MAX_FILE_SIZE_MB}MB.`);
            return;
        }
        await processInput('file', file);
    }

    /* ── Processing Logic ── */

    async function processInput(type, data) {
        state.processing = true;
        const sessionId = 'hub-' + Math.random().toString(36).substr(2, 9);
        const submittedAt = new Date().toISOString();

        const formData = new FormData();
        formData.append('input_type', type);
        formData.append('outcome_type', state.outcome);
        formData.append('source', 'Grindctrl_Input_Hub');
        formData.append('session_id', sessionId);
        formData.append('submitted_at', submittedAt);

        if (type === 'voice') formData.append('audio', data, 'capture.webm');
        else if (type === 'file') formData.append('file', data, data.name);
        else if (type === 'link') formData.append('link_input', data);
        else formData.append('text_input', data);

        await runProcessingSequence(type, async () => {
            const response = await fetch(CONFIG.V2V_ENDPOINT, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Network error');
            return await response.json();
        });
    }

    async function runProcessingSequence(type, fetchJob) {
        try {
            const steps = (type === 'voice') ? CONFIG.VOICE_STEPS : CONFIG.PROCESSING_STEPS;
            
            for (const step of steps) {
                if (step.id === 'ready') break; 
                updateUIState(step.id);
                await new Promise(r => setTimeout(r, 700));
            }

            const result = await fetchJob();
            updateUIState('ready');
            renderResult(result);

        } catch (err) {
            console.error('Core Logic: Processing failed.', err);
            updateUIState('error');
        } finally {
            state.processing = false;
        }
    }

    /* ── UI Rendering ── */

    function updateUIState(status) {
        const micBtn = $('v2v-mic-btn');
        const controls = $('v2v-controls');
        const statusText = $('v2v-status-text');
        const dot = document.querySelector('.v2v-status-dot');
        const progressShell = $('v2v-progress-steps');
        const progressBar = $('v2v-progress-bar');

        if (micBtn) micBtn.classList.remove('animate-pulse');
        if (controls) controls.classList.add('hidden');
        if (progressShell) progressShell.classList.add('hidden');
        if (dot) dot.style.background = '';

        const steps = (state.mode === 'voice') ? CONFIG.VOICE_STEPS : CONFIG.PROCESSING_STEPS;

        switch(status) {
            case 'idle':
                if (statusText) statusText.innerText = t('v2v_status_idle');
                break;
            case 'listening':
                if (statusText) statusText.innerText = t('v2v_status_listening');
                if (micBtn) micBtn.classList.add('animate-pulse');
                if (controls) controls.classList.remove('hidden');
                if (dot) dot.style.background = '#ef4444';
                break;
            case 'error':
                if (statusText) statusText.innerText = t('v2v_status_error');
                if (dot) dot.style.background = '#ef4444';
                break;
            default:
                const step = steps.find(s => s.id === status);
                if (step) {
                    if (statusText) statusText.innerText = t(step.label);
                    if (progressShell) progressShell.classList.remove('hidden');
                    if (progressBar) progressBar.style.width = `${step.progress}%`;
                    if (dot) dot.style.background = 'var(--gc-primary)';
                }
        }
    }

    function updateTimerDisplay(sec) {
        const timer = $('v2v-timer');
        if (timer) timer.innerText = sec.toFixed(1) + 's';
    }

    function renderResult(response) {
        const resultArea = $('v2v-result-area');
        if (!resultArea) return;

        const isOk = response.ok !== false;
        const data = response.lead || response.data || {};
        const sheet = response.sheet || {};

        let warningHtml = '';
        if (!isOk) {
            warningHtml = `<div class="v2v-soft-warning active"><span class="material-symbols-outlined">warning</span><div>${response.message || 'Partial Success'}</div></div>`;
        }

        // Logic to determine if it's a Lead, Ticket, Task, or Brief based on outcome state
        const outcomeTag = t('v2v_outcome_' + state.outcome);

        resultArea.innerHTML = `
            <div class="v2v-result-card relative">
                ${warningHtml}

                <div class="v2v-result-header">
                    <div>
                        <div class="v2v-badge-premium mb-2">${outcomeTag}</div>
                        <h3 class="text-xl font-headline font-bold text-on-surface">${data.title || data.lead_name || 'Processed Logic'}</h3>
                    </div>
                    <div class="text-[10px] text-ink-muted font-bold uppercase tracking-widest">${new Date().toLocaleDateString()}</div>
                </div>

                <div class="v2v-detail-grid">
                    ${Object.entries(data).slice(0, 6).map(([key, val]) => {
                        if (['summary', 'followup_draft', 'transcript', 'title'].includes(key)) return '';
                        return `
                            <div class="v2v-detail-item">
                                <span class="v2v-detail-label">${key.replace(/_/g, ' ')}</span>
                                <span class="v2v-detail-value">${val || '—'}</span>
                            </div>
                        `;
                    }).join('')}
                </div>

                ${data.summary ? `
                <div class="v2v-section-box">
                    <div class="v2v-detail-label mb-3">${t('v2v_summary_label')}</div>
                    <div class="text-[14px] font-medium leading-relaxed">${data.summary}</div>
                </div>` : ''}

                ${data.followup_draft ? `
                <div class="v2v-section-box">
                    <div class="v2v-detail-label mb-3">${t('v2v_followup_label')}</div>
                    <div class="text-[13px] leading-relaxed italic text-secondary border-s-2 border-primary/20 ps-5">${data.followup_draft}</div>
                </div>` : ''}

                <!-- Action Layer -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 pt-8 border-t border-softer">
                    <button class="v2v-action-btn" onclick="alert('Syncing to Google Sheets...')">
                        <span class="material-symbols-outlined text-lg">table_chart</span>
                        ${t('v2v_action_sheets')}
                    </button>
                    <button class="v2v-action-btn" onclick="alert('Drafting in Gmail...')">
                        <span class="material-symbols-outlined text-lg">mail</span>
                        ${t('v2v_action_gmail')}
                    </button>
                    ${state.outcome === 'ticket' || state.outcome === 'task' ? `
                    <button class="v2v-action-btn" onclick="alert('Syncing to Slack...')">
                        <span class="material-symbols-outlined text-lg">message</span>
                        ${t('v2v_action_slack')}
                    </button>` : `
                    <button class="v2v-action-btn" onclick="alert('Pushing to CRM...')">
                        <span class="material-symbols-outlined text-lg">hub</span>
                        ${t('v2v_action_crm')}
                    </button>`}
                    <button class="v2v-action-btn" onclick="window.location.reload()">
                        <span class="material-symbols-outlined text-lg">refresh</span>
                        ${t('v2v_btn_try_again')}
                    </button>
                </div>
            </div>
        `;

        const card = resultArea.querySelector('.v2v-result-card');
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100);
    }

    window.v2vInit = init;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
