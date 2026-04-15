/* ═══════════════════════════════════════════════════════════
   INPUT HUB: Production Interaction Engine
   ═══════════════════════════════════════════════════════════ */

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

    /* ── Init ── */
    function init() {
        // Mode tabs
        $$('.v2v-mode-tab').forEach(btn => {
            btn.addEventListener('click', () => switchMode(btn.dataset.mode));
        });

        // Outcome chips
        $$('.v2v-outcome-chip').forEach(btn => {
            btn.addEventListener('click', () => switchOutcome(btn.dataset.outcome));
        });

        // Voice
        const micBtn = $('v2v-mic-btn');
        const stopBtn = $('v2v-stop');
        const cancelBtn = $('v2v-cancel');
        if (micBtn) micBtn.addEventListener('click', startRecording);
        if (stopBtn) stopBtn.addEventListener('click', finishRecording);
        if (cancelBtn) cancelBtn.addEventListener('click', cancelRecording);

        // Text & Link
        const sendTextBtn = $('v2v-send-text');
        const sendLinkBtn = $('v2v-send-link');
        if (sendTextBtn) sendTextBtn.addEventListener('click', handleTextSubmit);
        if (sendLinkBtn) sendLinkBtn.addEventListener('click', handleLinkSubmit);

        // File
        const fileInput = $('v2v-file-input');
        if (fileInput) fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFileSubmit(e.target.files[0]);
        });

        // Enter key for text/link
        const linkInput = $('v2v-link-input');
        const textInput = $('v2v-text-input');
        if (linkInput) linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLinkSubmit(); });
        if (textInput) textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); } });

        // Update preview when outcome changes
        updatePreviewOutcome();
    }

    function switchMode(newMode) {
        if (state.processing || state.recording) return;
        state.mode = newMode;

        $$('.v2v-mode-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === newMode);
        });

        $$('.v2v-mode-view').forEach(view => {
            const modeId = view.id.replace('v2v-view-', '');
            if (modeId === newMode) {
                view.classList.remove('hidden');
                view.classList.add('active');
                // Re-trigger animation
                view.style.animation = 'none';
                view.offsetHeight;
                view.style.animation = '';
            } else {
                view.classList.add('hidden');
                view.classList.remove('active');
            }
        });
    }

    function switchOutcome(newOutcome) {
        if (state.processing) return;
        state.outcome = newOutcome;

        $$('.v2v-outcome-chip').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.outcome === newOutcome);
        });

        updatePreviewOutcome();
    }

    function updatePreviewOutcome() {
        const badge = document.querySelector('#v2v-empty-hint .v2v-badge-premium');
        if (badge) {
            badge.textContent = t('v2v_outcome_' + state.outcome);
            badge.style.transition = 'transform 0.3s ease';
            badge.style.transform = 'scale(1.1)';
            setTimeout(() => { badge.style.transform = 'scale(1)'; }, 200);
        }
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
            const statusText = $('v2v-status-text');
            if (statusText) statusText.innerText = 'Microphone blocked';
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
            input.style.borderColor = 'var(--gc-error)';
            setTimeout(() => { input.style.borderColor = ''; }, 1500);
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

    /* ── Processing ── */

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

        // Hide the preview card
        const emptyHint = $('v2v-empty-hint');
        if (emptyHint) {
            emptyHint.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            emptyHint.style.opacity = '0';
            emptyHint.style.transform = 'scale(0.97)';
        }

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
            console.error('Processing failed:', err);
            updateUIState('error');
            // Restore preview
            const emptyHint = $('v2v-empty-hint');
            if (emptyHint) {
                emptyHint.style.opacity = '1';
                emptyHint.style.transform = 'scale(1)';
            }
        } finally {
            state.processing = false;
        }
    }

    /* ── UI State ── */

    function updateUIState(status) {
        const micBtn = $('v2v-mic-btn');
        const controls = $('v2v-controls');
        const statusText = $('v2v-status-text');
        const dot = document.querySelector('.v2v-status-dot');
        const progressShell = $('v2v-progress-steps');
        const progressBar = $('v2v-progress-bar');

        if (micBtn) micBtn.classList.remove('is-recording');
        if (controls) controls.classList.add('hidden');
        if (progressShell) progressShell.classList.add('hidden');
        if (dot) dot.style.background = '';

        const steps = (state.mode === 'voice') ? CONFIG.VOICE_STEPS : CONFIG.PROCESSING_STEPS;

        switch(status) {
            case 'idle':
                if (statusText) statusText.innerText = t('v2v_status_idle');
                if (micBtn) micBtn.style.display = '';
                break;
            case 'listening':
                if (statusText) statusText.innerText = t('v2v_status_listening');
                if (micBtn) micBtn.classList.add('is-recording');
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

    /* ── Result Rendering ── */

    function renderResult(response) {
        const resultArea = $('v2v-result-area');
        if (!resultArea) return;

        const isOk = response.ok !== false;
        const data = response.lead || response.data || {};
        const sheet = response.sheet || {};

        let warningHtml = '';
        if (!isOk) {
            warningHtml = `<div class="v2v-soft-warning"><span class="material-symbols-outlined">warning</span><div>${response.message || 'Partial extraction—some fields may need review.'}</div></div>`;
        }

        const outcomeTag = t('v2v_outcome_' + state.outcome);
        const title = data.title || data.lead_name || data.company_name || 'Structured Record';

        // Build field grid — skip narrative fields
        const skipKeys = ['summary', 'followup_draft', 'transcript', 'title', 'lead_name'];
        const fields = Object.entries(data).filter(([key]) => !skipKeys.includes(key)).slice(0, 6);

        resultArea.innerHTML = `
            <div class="v2v-result-card" style="opacity:0;transform:translateY(16px)">
                ${warningHtml}

                <div class="v2v-result-header">
                    <div class="min-w-0">
                        <div class="v2v-badge-premium mb-3">${outcomeTag}</div>
                        <h3 class="text-[clamp(1.1rem,1rem+0.5vw,1.5rem)] font-headline font-extrabold text-on-surface tracking-tight leading-tight truncate">${title}</h3>
                    </div>
                    <div class="text-[9px] text-ink-muted font-bold uppercase tracking-widest shrink-0">${new Date().toLocaleDateString()}</div>
                </div>

                ${fields.length ? `
                <div class="v2v-detail-grid">
                    ${fields.map(([key, val]) => `
                        <div class="v2v-detail-item">
                            <span class="v2v-detail-label">${key.replace(/_/g, ' ')}</span>
                            <span class="v2v-detail-value">${val || '—'}</span>
                        </div>
                    `).join('')}
                </div>` : ''}

                ${data.summary ? `
                <div class="v2v-section-box">
                    <div class="v2v-detail-label mb-2">${t('v2v_summary_label')}</div>
                    <div class="text-[13px] font-medium leading-relaxed text-on-surface">${data.summary}</div>
                </div>` : ''}

                ${data.followup_draft ? `
                <div class="v2v-section-box">
                    <div class="v2v-detail-label mb-2">${t('v2v_followup_label')}</div>
                    <div class="v2v-transcript-text">${data.followup_draft}</div>
                </div>` : ''}

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-8 pt-6 border-t border-softer">
                    <button class="v2v-action-btn" onclick="alert('Syncing...')">
                        <span class="material-symbols-outlined text-base">table_chart</span>
                        ${t('v2v_action_sheets')}
                    </button>
                    <button class="v2v-action-btn" onclick="alert('Drafting...')">
                        <span class="material-symbols-outlined text-base">mail</span>
                        ${t('v2v_action_gmail')}
                    </button>
                    ${state.outcome === 'ticket' || state.outcome === 'task' ? `
                    <button class="v2v-action-btn" onclick="alert('Notifying...')">
                        <span class="material-symbols-outlined text-base">chat</span>
                        ${t('v2v_action_slack')}
                    </button>` : `
                    <button class="v2v-action-btn" onclick="alert('Pushing...')">
                        <span class="material-symbols-outlined text-base">hub</span>
                        ${t('v2v_action_crm')}
                    </button>`}
                    <button class="v2v-action-btn" onclick="window.location.reload()">
                        <span class="material-symbols-outlined text-base">refresh</span>
                        ${t('v2v_btn_try_again')}
                    </button>
                </div>
            </div>
        `;

        // Animate in
        const card = resultArea.querySelector('.v2v-result-card');
        requestAnimationFrame(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });
    }

    window.v2vInit = init;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
