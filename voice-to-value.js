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

    // Initial State Check
    function init() {
        const micBtn = $('v2v-mic-btn');
        if (!micBtn) return;

        micBtn.addEventListener('click', toggleRecording);
        
        // Integration simulation
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.v2v-action-btn')) {
                const btn = e.target.closest('.v2v-action-btn');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Syncing...';
                btn.style.opacity = '0.7';
                
                setTimeout(() => {
                    btn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span> Sent';
                    btn.style.background = 'var(--gc-primary)';
                    btn.style.color = 'var(--gc-on-primary)';
                    btn.style.opacity = '1';
                    
                    setTimeout(() => {
                        btn.innerHTML = originalText;
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
            updateUIState('error', 'Microphone access denied.');
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
        formData.append('locale', document.documentElement.lang || 'en');

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
            updateUIState('error', 'Processing failed. Please try again.');
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
            statusText.textContent = 'Listening...';
            statusDot.classList.add('is-active');
        } else if (status === 'uploading') {
            micBtn.classList.remove('is-recording');
            micIcon.textContent = 'cloud_upload';
            statusText.textContent = 'Uploading...';
        } else if (status === 'ready') {
            micIcon.textContent = 'mic';
            statusText.textContent = 'Ready for next note';
            statusDot.classList.remove('is-active');
            
            // Show result card
            $('v2v-result-area').classList.add('is-ready');
            $('v2v-empty-hint').style.display = 'none';
        } else if (status === 'error') {
            micIcon.textContent = 'mic';
            statusText.textContent = message || 'Error';
            statusText.style.color = 'var(--gc-error)';
            statusDot.classList.remove('is-active');
        }
    }

    function updateTimerDisplay(elapsed) {
        const sec = Math.floor(elapsed);
        const ms = Math.floor((elapsed % 1) * 10);
        $('v2v-timer').textContent = `${sec}.${ms}s`;
    }

    function renderResult(data) {
        const resultArea = $('v2v-result-area');
        
        // Fallback mock data if results are empty
        const lead = data || {
            transcript: "I need a lead capture system for my real estate agency in Dubai. We have 5 agents and need to follow up within 5 mins.",
            summary: "Dubai Real Estate Agency seeking high-velocity lead response system.",
            details: {
                name: "Real Estate Operator",
                location: "Dubai",
                scale: "5 Agents",
                pain_point: "Slow follow-up"
            },
            qualification: "High",
            urgency: "Immediate",
            follow_up: "Drafting a bespoke 5-minute response protocol using AI Agents.",
            next_action: "Schedule architecture audit for Dubai CRM sync."
        };

        resultArea.innerHTML = `
            <div class="v2v-card-premium reveal active">
                <div class="flex justify-between items-start mb-8">
                    <div>
                        <span class="v2v-tag v2v-tag-high mb-3">Qualified · ${lead.qualification}</span>
                        <h4 class="text-2xl font-bold font-headline tracking-tight text-on-surface">${lead.details.name || 'Extracted Lead'}</h4>
                    </div>
                    <div class="text-right">
                        <div class="v2v-field-label">Urgency</div>
                        <div class="text-[14px] font-bold text-primary">${lead.urgency}</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <div class="v2v-field-label">Transcript</div>
                        <div class="text-[13px] text-secondary leading-relaxed italic border-l-2 border-primary/20 pl-4">"${lead.transcript}"</div>
                    </div>
                    <div>
                        <div class="v2v-field-label">Executive Summary</div>
                        <div class="text-[14px] text-on-surface font-medium leading-relaxed">${lead.summary}</div>
                    </div>
                </div>

                <div class="p-6 bg-surface-container/50 rounded-2xl border border-softer mb-8">
                    <div class="v2v-field-label">Proposed Follow-up Draft</div>
                    <div class="text-[14px] text-on-surface leading-relaxed">${lead.follow_up}</div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-6 pt-6 border-t border-softer">
                    <div>
                        <div class="v2v-field-label">Recommended Next Action</div>
                        <div class="text-[13px] font-bold text-primary">${lead.next_action}</div>
                    </div>
                    <div class="flex gap-3">
                        <button class="v2v-action-btn"><span class="material-symbols-outlined text-sm">mail</span> Gmail</button>
                        <button class="v2v-action-btn"><span class="material-symbols-outlined text-sm">table_chart</span> Sheets</button>
                        <button class="v2v-action-btn"><span class="material-symbols-outlined text-sm">hub</span> CRM</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Export to global scope if needed
    window.v2vInit = init;

    // Auto-init 
    document.addEventListener('DOMContentLoaded', init);

})();
