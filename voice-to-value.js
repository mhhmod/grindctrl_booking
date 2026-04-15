/* ── Voice-to-Value Studio: Production Interaction Engine ── */

(function() {
    'use strict';

    const CONFIG = {
        V2V_ENDPOINT: 'https://n8n.srv1141109.hstgr.cloud/webhook/voice-to-value-lead',
        MAX_RECORD_SEC: 60,
        PROCESSING_STEPS: [
            { id: 'uploading', label: 'v2v_status_uploading', progress: 25 },
            { id: 'transcribing', label: 'v2v_status_transcribing', progress: 50 },
            { id: 'structuring', label: 'v2v_status_structuring', progress: 75 },
            { id: 'saving', label: 'v2v_status_saving', progress: 90 },
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
        stream: null
    };

    const $ = (id) => document.getElementById(id);

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
        const micBtn = $('v2v-mic-btn');
        const stopBtn = $('v2v-stop');
        const cancelBtn = $('v2v-cancel');
        const sendTextBtn = $('v2v-send-text');

        if (micBtn) micBtn.addEventListener('click', startRecording);
        if (stopBtn) stopBtn.addEventListener('click', finishRecording);
        if (cancelBtn) cancelBtn.addEventListener('click', cancelRecording);
        if (sendTextBtn) sendTextBtn.addEventListener('click', handleTextSubmit);
    }

    async function startRecording() {
        if (state.processing || state.recording) return;

        try {
            state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Cross-browser mimeType sensing
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
                if (state.recording) processAudio(); 
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
            console.error('Mic access denied or error:', err);
            const statusText = $('v2v-status-text');
            if (statusText) statusText.innerText = 'Microphone blocked or not found.';
            updateUIState('error');
        }
    }

    function finishRecording() {
        if (!state.recorder || state.recorder.state !== 'recording') return;
        state.recorder.stop();
        state.recording = false;
        if (state.timer) clearInterval(state.timer);
        if (state.stream) state.stream.getTracks().forEach(track => track.stop());
    }

    function cancelRecording() {
        state.recording = false; 
        if (state.recorder && state.recorder.state === 'recording') {
            state.recorder.stop();
        }
        if (state.timer) clearInterval(state.timer);
        if (state.stream) state.stream.getTracks().forEach(track => track.stop());
        
        state.chunks = [];
        updateUIState('idle');
    }

    async function processAudio() {
        state.processing = true;

        const blob = new Blob(state.chunks, { type: 'audio/webm' });
        const sessionId = 'v2v-' + Math.random().toString(36).substr(2, 9);
        const submittedAt = new Date().toISOString();

        const formData = new FormData();
        formData.append('audio', blob, 'lead-note.webm'); // Spec binary field: audio
        formData.append('source', 'Grindctrl_V2V_Studio');
        formData.append('session_id', sessionId);
        formData.append('submitted_at', submittedAt);

        // UI sequence
        await runProcessingSequence(async () => {
            const response = await fetch(CONFIG.V2V_ENDPOINT, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Network error');
            return await response.json();
        });
    }

    async function handleTextSubmit() {
        const input = $('v2v-text-input');
        if (!input || !input.value.trim() || state.processing) return;

        state.processing = true;
        const text = input.value.trim();
        input.value = '';

        const formData = new FormData();
        formData.append('text_input', text);
        formData.append('source', 'V2V_Manual_Entry');
        formData.append('submitted_at', new Date().toISOString());

        await runProcessingSequence(async () => {
            const response = await fetch(CONFIG.V2V_ENDPOINT, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Network error');
            return await response.json();
        });
    }

    async function runProcessingSequence(fetchJob) {
        try {
            // Show steps sequence for premium feel
            for (const step of CONFIG.PROCESSING_STEPS) {
                if (step.id === 'ready') break; 
                updateUIState(step.id);
                await new Promise(r => setTimeout(r, 600)); // Visible transitions
            }

            const result = await fetchJob();

            updateUIState('ready');
            renderResult(result);

        } catch (err) {
            console.error('Processing failed:', err);
            updateUIState('error');
        } finally {
            state.processing = false;
        }
    }

    function updateUIState(status) {
        const micBtn = $('v2v-mic-btn');
        const controls = $('v2v-controls');
        const statusText = $('v2v-status-text');
        const dot = document.querySelector('.v2v-status-dot');
        const progressShell = $('v2v-progress-steps');
        const progressBar = $('v2v-progress-bar');

        // Reset
        micBtn.classList.remove('animate-pulse', 'opacity-20');
        controls.classList.add('hidden');
        progressShell.classList.add('hidden');
        if (dot) dot.style.background = '';

        switch(status) {
            case 'idle':
                statusText.innerText = t('v2v_status_idle');
                micBtn.style.display = 'flex';
                break;
            case 'listening':
                statusText.innerText = t('v2v_status_listening');
                micBtn.classList.add('animate-pulse');
                controls.classList.remove('hidden');
                micBtn.style.display = 'none';
                if (dot) dot.style.background = '#ef4444';
                break;
            case 'error':
                statusText.innerText = t('v2v_status_error');
                micBtn.style.display = 'flex';
                if (dot) dot.style.background = '#ef4444';
                break;
            default:
                // Step-based statuses (uploading, transcribing, etc)
                const step = CONFIG.PROCESSING_STEPS.find(s => s.id === status);
                if (step) {
                    statusText.innerText = t(step.label);
                    progressShell.classList.remove('hidden');
                    progressBar.style.width = `${step.progress}%`;
                    micBtn.style.display = 'none';
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

        // Base result fallback for error handling
        const isOk = response.ok !== false;
        const lead = response.lead || {};
        const sheet = response.sheet || {};

        let warningHtml = '';
        if (!isOk) {
            warningHtml = `
                <div class="v2v-soft-warning reveal active">
                    <span class="material-symbols-outlined">warning</span>
                    <div>Partial Success: ${response.message || 'System encountered an issue, but some data was recovered.'}</div>
                </div>
            `;
        }

        resultArea.innerHTML = `
            <div class="v2v-result-card reveal active">
                ${warningHtml}

                <!-- Lead Details Grid -->
                <div class="v2v-detail-grid">
                    <div class="v2v-detail-item">
                        <span class="v2v-detail-label">${t('v2v_field_name')}</span>
                        <span class="v2v-detail-value">${lead.lead_name || '—'}</span>
                    </div>
                    <div class="v2v-detail-item">
                        <span class="v2v-detail-label">${t('v2v_field_company')}</span>
                        <span class="v2v-detail-value">${lead.company_name || '—'}</span>
                    </div>
                    <div class="v2v-detail-item">
                        <span class="v2v-detail-label">${t('v2v_field_contact')}</span>
                        <span class="v2v-detail-value">${lead.phone_or_contact || '—'}</span>
                    </div>
                    <div class="v2v-detail-item">
                        <span class="v2v-detail-label">${t('v2v_field_need')}</span>
                        <span class="v2v-detail-value">${lead.need_or_request || '—'}</span>
                    </div>
                    <div class="v2v-detail-item">
                        <span class="v2v-detail-label">${t('v2v_field_urgency')}</span>
                        <span class="v2v-detail-value">${lead.urgency || '—'}</span>
                    </div>
                    <div class="v2v-detail-item">
                        <span class="v2v-detail-label">${t('v2v_field_next')}</span>
                        <span class="v2v-detail-value">${lead.next_step || '—'}</span>
                    </div>
                </div>

                <!-- Summary Section -->
                <div class="v2v-section-box">
                    <div class="v2v-detail-label mb-3">${t('v2v_summary_label')}</div>
                    <div class="text-[15px] font-medium leading-relaxed">${lead.summary || '—'}</div>
                </div>

                <!-- Follow-up Draft -->
                <div class="v2v-section-box">
                    <div class="v2v-detail-label mb-3">${t('v2v_followup_label')}</div>
                    <div class="text-[14px] leading-relaxed italic text-secondary border-s-2 border-primary/20 ps-5">${lead.followup_draft || '—'}</div>
                </div>

                <!-- Transcript Section -->
                <div class="mt-8">
                     <div class="v2v-detail-label mb-3">${t('v2v_transcript_label')}</div>
                     <p class="v2v-transcript-text">"${response.transcript || '—'}"</p>
                </div>

                <!-- Sheet Actions -->
                <div class="v2v-sheet-actions">
                    ${sheet.saved ? `
                        <a href="${sheet.sheet_view_url}" target="_blank" class="v2v-btn-primary">
                            <span class="material-symbols-outlined">table_chart</span>
                            ${t('v2v_btn_open_sheet')}
                        </a>
                    ` : `
                        <div class="text-error font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                             <span class="material-symbols-outlined text-sm">error</span>
                             Sheet Sync Failed
                        </div>
                    `}

                    ${sheet.sheet_download_url ? `
                        <a href="${sheet.sheet_download_url}" download class="v2v-btn-secondary">
                            <span class="material-symbols-outlined">download</span>
                            ${t('v2v_btn_download_csv')}
                        </a>
                    ` : ''}

                    <button onclick="window.location.reload()" class="v2v-btn-secondary ms-auto">
                        <span class="material-symbols-outlined">refresh</span>
                        ${t('v2v_btn_try_again')}
                    </button>
                </div>
            </div>
        `;

        // Smooth reveal of card
        const card = resultArea.querySelector('.v2v-result-card');
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100);
    }

    // Export to global scope
    window.v2vInit = init;

    // Auto-init 
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
