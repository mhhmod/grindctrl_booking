/* ── Voice-to-Value Studio: Interaction Engine ── */

(function() {
    'use strict';

    const CONFIG = {
        V2V_ENDPOINT: 'https://n8n.srv1141109.hstgr.cloud/webhook/voice-to-value-lead',
        MAX_RECORD_SEC: 30,
        TIMEOUT_MS: 40000
    };

    const state = {
        recorder: null,
        chunks: [],
        recording: false,
        processing: false,
        timer: null,
        startMs: 0
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
        if (!micBtn) return;

        micBtn.addEventListener('click', toggleRecording);
        
        // Integration simulation
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.v2v-action-btn')) {
                const btn = e.target.closest('.v2v-action-btn');
                const originalContent = btn.innerHTML;
                
                // Get the base icon (Gmail/Sheets/CRM)
                const icon = btn.querySelector('.material-symbols-outlined').textContent;
                
                btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">sync</span> ${t('v2v_syncing')}`;
                btn.style.opacity = '0.7';
                
                setTimeout(() => {
                    btn.innerHTML = `<span class="material-symbols-outlined text-sm">check_circle</span> ${t('v2v_sent')}`;
                    btn.style.background = 'var(--gc-primary)';
                    btn.style.color = 'var(--gc-on-primary)';
                    btn.style.opacity = '1';
                    
                    setTimeout(() => {
                        btn.innerHTML = originalContent;
                        btn.style.background = '';
                        btn.style.color = '';
                    }, 3000);
                }, 1500);
            }
        });
    }

    async function toggleRecording() {
        if (state.processing) return;

        if (state.recording) {
            stopRecording();
        } else {
            await startRecording();
        }
    }

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            state.chunks = [];

            state.recorder.ondataavailable = (e) => {
                if (e.data.size > 0) state.chunks.push(e.data);
            };

            state.recorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                processAudio();
            };

            state.recorder.start();
            state.recording = true;
            state.startMs = Date.now();
            
            updateUIState('listening');

            state.timer = setInterval(() => {
                const elapsed = (Date.now() - state.startMs) / 1000;
                if (elapsed >= CONFIG.MAX_RECORD_SEC) stopRecording();
                updateTimerDisplay(elapsed);
            }, 100);

        } catch (err) {
            console.error('Mic access denied:', err);
            updateUIState('error', t('v2v_status_mic_denied') || 'Microphone access denied.');
        }
    }

    function stopRecording() {
        if (!state.recorder || state.recorder.state !== 'recording') return;
        state.recorder.stop();
        state.recording = false;
        if (state.timer) clearInterval(state.timer);
    }

    async function processAudio() {
        state.processing = true;
        updateUIState('uploading');

        const blob = new Blob(state.chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', blob, 'lead-note.webm');
        formData.append('locale', currentLang());

        try {
            const response = await fetch(CONFIG.V2V_ENDPOINT, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Network error');
            const result = await response.json();

            renderResult(result);
            updateUIState('ready');

        } catch (err) {
            console.error('Processing failed:', err);
            updateUIState('error', t('v2v_status_error') || 'Processing failed.');
        } finally {
            state.processing = false;
        }
    }

    function updateUIState(status, message) {
        const micBtn = $('v2v-mic-btn');
        const statusText = $('v2v-status-text');
        const statusDot = $('v2v-status-container');
        const micIcon = micBtn.querySelector('.material-symbols-outlined');

        if (status === 'listening') {
            micBtn.classList.add('is-recording');
            micIcon.textContent = 'stop';
            statusText.textContent = t('v2v_status_listening');
            statusDot.classList.add('is-active');
        } else if (status === 'uploading') {
            micBtn.classList.remove('is-recording');
            micIcon.textContent = 'cloud_upload';
            statusText.textContent = t('v2v_status_uploading');
        } else if (status === 'ready') {
            micIcon.textContent = 'check';
            statusText.textContent = t('v2v_status_ready');
            statusDot.classList.remove('is-active');
            
            // Interaction: Smooth swap
            $('v2v-result-area').classList.add('is-ready');
            $('v2v-empty-hint').style.display = 'none';
        } else if (status === 'error') {
            micIcon.textContent = 'mic';
            statusText.textContent = message || t('v2v_status_error');
            statusText.style.color = 'var(--gc-error)';
            statusDot.classList.remove('is-active');
        }
    }

    function updateTimerDisplay(elapsed) {
        const sec = Math.floor(elapsed);
        const ms = Math.floor((elapsed % 1) * 10);
        $('v2v-timer').textContent = `${sec}.${ms}s`;
    }

    async function renderResult(data) {
        const resultArea = $('v2v-result-area');
        
        // Product Logic: Quality Mapping
        const lead = data || {
            transcript: "...",
            summary: "...",
            details: { name: "..." },
            qualification: "High",
            urgency: "Immediate",
            follow_up: "...",
            next_action: "..."
        };

        const qualityTagClass = lead.qualification === 'High' ? 'v2v-tag-platinum' : 'v2v-tag-gold';
        const qualityLabel = lead.qualification === 'High' ? t('v2v_quality_high') : t('v2v_quality_mid');

        // Pre-build the card structure with invisible items for staggering
        resultArea.innerHTML = `
            <div class="v2v-card-premium reveal active overflow-hidden">
                <!-- Header Component -->
                <div class="v2v-stagger-item flex justify-between items-start mb-8">
                    <div class="text-start">
                        <span class="v2v-tag ${qualityTagClass} mb-4">${qualityLabel}</span>
                        <h4 class="text-3xl font-bold font-headline tracking-tight text-on-surface">${lead.details.name || t('v2v_extracted_label')}</h4>
                    </div>
                    <div class="text-end">
                        <div class="v2v-field-label opacity-60">${t('v2v_urgency_label')}</div>
                        <div class="text-[16px] font-black text-primary">${lead.urgency}</div>
                    </div>
                </div>

                <!-- Insights Layer -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                    <div class="v2v-stagger-item text-start">
                        <div class="v2v-field-label">${t('v2v_transcript_label')}</div>
                        <div class="text-[14px] text-secondary leading-relaxed italic border-s-2 border-primary/20 ps-5 py-1">"${lead.transcript}"</div>
                    </div>
                    <div class="v2v-stagger-item text-start">
                        <div class="v2v-field-label">${t('v2v_summary_label')}</div>
                        <div class="text-[15px] text-on-surface font-semibold leading-relaxed">${lead.summary}</div>
                    </div>
                </div>

                <div class="v2v-section-divider"></div>

                <!-- Proposal Layer -->
                <div class="v2v-stagger-item p-8 bg-surface-container/30 rounded-[1.5rem] border border-softer mb-8 text-start">
                    <div class="v2v-field-label opacity-50">${t('v2v_followup_label')}</div>
                    <div class="text-[15px] text-on-surface leading-relaxed font-medium">${lead.follow_up}</div>
                </div>

                <!-- Action Center -->
                <div class="v2v-stagger-item flex flex-wrap items-center justify-between gap-8 pt-8 border-t border-softer">
                    <div class="text-start">
                        <div class="v2v-field-label">${t('v2v_next_action_label')}</div>
                        <div class="text-[14px] font-black text-primary tracking-wide uppercase">${lead.next_action || '...'}</div>
                    </div>
                    <div class="flex gap-4">
                        <button class="v2v-action-btn h-12 px-6">
                            <span class="material-symbols-outlined text-sm">mail</span> 
                            ${t('v2v_btn_gmail')}
                        </button>
                        <button class="v2v-action-btn h-12 px-6">
                            <span class="material-symbols-outlined text-sm">hub</span> 
                            ${t('v2v_btn_crm')}
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Orchestrate Staggered Reveal
        const items = resultArea.querySelectorAll('.v2v-stagger-item');
        for (let i = 0; i < items.length; i++) {
            await new Promise(r => setTimeout(r, 150 * i)); // Premium delay
            items[i].classList.add('is-visible');
        }
    }

    // Export to global scope if needed
    window.v2vInit = init;

    // Auto-init 
    document.addEventListener('DOMContentLoaded', init);

})();
