/* ═══════════════════════════════════════════════════════════
   EXCEPTION DESK — Autonomous Triage Workspace Engine
   ═══════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* ── Demo Exception: Garbled Purchase Order ── */
    const DEMO = {
        type: 'email',
        meta: {
            from: 'sarah.mitchell@acmecorp.com',
            to: 'orders@supplierco.com',
            date: 'Apr 15, 2026 · 09:47 AM',
            subject: 'RE: PO-2024-4821 URGENT — need confirmation on 500 units'
        },
        body:
            'Hi team,\n\n' +
            'Following up on our order PO-2024-4821. We originally discussed 500 units of ' +
            'SKU-AR2040 at $12.50/unit but I see the invoice shows 5,000 units at $125.00/unit ' +
            '— that\'s clearly wrong.\n\n' +
            'Also the shipping address on the invoice still shows our OLD warehouse:\n' +
            '  1247 Industrial Blvd, Suite 4B, Houston TX 77001\n\n' +
            'It should be going to our new facility:\n' +
            '  8901 Commerce Park Dr, Building C, Austin TX 78744\n\n' +
            'We need delivery before March 15th without fail. This order is for a client launch.\n\n' +
            'Can someone confirm the corrected quantities and pricing ASAP? ' +
            'I\'ve CC\'d our finance team.\n\n' +
            'Best,\n' +
            'Sarah Mitchell\n' +
            'Procurement Manager, Acme Corp\n' +
            'Direct: +1 (555) 014-2387\n' +
            'sarah.mitchell@acmecorp.com',

        fields: [
            { id: 'po', label: 'PO Number', value: 'PO-2024-4821', trust: 'safe', match: 'PO-2024-4821', mono: true },
            { id: 'sku', label: 'SKU', value: 'SKU-AR2040', trust: 'safe', match: 'SKU-AR2040', mono: true },
            { id: 'qty_intended', label: 'Intended Qty', value: '500 units', trust: 'review', match: '500 units', mono: true },
            { id: 'qty_invoiced', label: 'Invoiced Qty', value: '5,000 units', trust: 'override', match: '5,000 units', mono: true },
            { id: 'price_intended', label: 'Agreed Price', value: '$12.50/unit', trust: 'review', match: '$12.50/unit', mono: true },
            { id: 'price_invoiced', label: 'Invoiced Price', value: '$125.00/unit', trust: 'override', match: '$125.00/unit', mono: true },
            { id: 'ship_to', label: 'Ship To (Correct)', value: '8901 Commerce Park Dr, Bldg C, Austin TX 78744', trust: 'safe', match: '8901 Commerce Park Dr, Building C, Austin TX 78744' },
            { id: 'deadline', label: 'Delivery Deadline', value: 'Before March 15th', trust: 'safe', match: 'before March 15th' },
            { id: 'contact', label: 'Contact', value: 'Sarah Mitchell', trust: 'safe', match: 'Sarah Mitchell' },
            { id: 'phone', label: 'Phone', value: '+1 (555) 014-2387', trust: 'safe', match: '+1 (555) 014-2387', mono: true }
        ],

        anomalies: [
            { severity: 'override', title: 'Quantity Mismatch — 10× Discrepancy', desc: 'PO states 500 units but invoice shows 5,000. Likely data entry error at supplier.' },
            { severity: 'override', title: 'Unit Price Mismatch — 10× Discrepancy', desc: 'Agreed $12.50/unit vs invoiced $125.00/unit. Total discrepancy: $562,500.' },
            { severity: 'review', title: 'Shipping Address Needs Update', desc: 'Invoice references old Houston warehouse. Correct Austin address provided.' }
        ],

        action: {
            title: 'Send Correction Request',
            desc: 'Generate purchase order amendment with corrected quantities (500), pricing ($12.50/unit), and updated shipping address. Route for manager sign-off before sending.',
            trust: 'review'
        }
    };

    /* ── State ── */
    const state = { hasContent: false, isProcessing: false, isEditing: false, data: null };

    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);

    /* ── Helpers ── */
    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function findMatchRange(body, match) {
        const idx = body.indexOf(match);
        return idx >= 0 ? [idx, idx + match.length] : null;
    }

    function resolveFieldRanges(body, fields) {
        return fields.map(f => {
            const range = f.match ? findMatchRange(body, f.match) : null;
            return { ...f, range };
        });
    }

    function buildMarkedBody(text, fields) {
        const ranges = fields
            .filter(f => f.range)
            .map(f => ({ id: f.id, start: f.range[0], end: f.range[1], trust: f.trust }))
            .sort((a, b) => a.start - b.start);

        let html = '', cursor = 0;
        for (const r of ranges) {
            if (r.start < cursor) continue; // skip overlaps
            html += esc(text.substring(cursor, r.start));
            html += '<mark data-field-id="' + r.id + '" data-trust="' + r.trust + '">' + esc(text.substring(r.start, r.end)) + '</mark>';
            cursor = r.end;
        }
        html += esc(text.substring(cursor));
        return html;
    }

    /* ── Init ── */
    function init() {
        const dropZone = $('ed-drop-zone');
        if (!dropZone) return;

        // Drag-and-drop
        ['dragenter', 'dragover'].forEach(evt =>
            dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('ed-drag-over'); })
        );
        ['dragleave', 'drop'].forEach(evt =>
            dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.remove('ed-drag-over'); })
        );
        dropZone.addEventListener('drop', handleDrop);

        // Paste button
        const pasteBtn = $('ed-paste-btn');
        if (pasteBtn) pasteBtn.addEventListener('click', async () => {
            try {
                const t = await navigator.clipboard.readText();
                if (t && t.trim()) processText(t.trim());
            } catch {
                const t = prompt('Paste your messy exception here:');
                if (t && t.trim()) processText(t.trim());
            }
        });

        // Upload button
        const uploadBtn = $('ed-upload-btn');
        const fileInput = $('ed-file-input');
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', e => { if (e.target.files.length) handleFile(e.target.files[0]); });
        }

        // Demo button
        const demoBtn = $('ed-demo-btn');
        if (demoBtn) demoBtn.addEventListener('click', loadDemo);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);

        // Global paste listener
        document.addEventListener('paste', e => {
            if (state.hasContent || state.isProcessing) return;
            const el = document.activeElement;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
            const t = e.clipboardData.getData('text/plain');
            if (t && t.trim().length > 10) { e.preventDefault(); processText(t.trim()); }
        });

        // No auto-demo — user triggers Demo explicitly via button
    }

    /* ── Drop & File Handlers ── */
    function handleDrop(e) {
        const files = e.dataTransfer.files;
        const text = e.dataTransfer.getData('text/plain');
        if (files.length > 0) handleFile(files[0]);
        else if (text) processText(text);
    }

    function handleFile(file) {
        if (file.type.startsWith('text/') || /\.(txt|csv|eml|json|xml|md)$/i.test(file.name)) {
            const reader = new FileReader();
            reader.onload = e => processText(e.target.result, file.name);
            reader.readAsText(file);
        } else {
            processText('[Uploaded: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)]' +
                '\n\nBinary file content would be extracted by AI backend.', file.name);
        }
    }

    /* ── Load Demo ── */
    function loadDemo() {
        if (state.isProcessing || state.hasContent) return;
        state.isProcessing = true;
        state.hasContent = true;

        // Resolve ranges from match strings
        const demoData = {
            ...DEMO,
            fields: resolveFieldRanges(DEMO.body, DEMO.fields)
        };

        showSource(demoData);
        showProcessing();

        const steps = [
            { label: 'Reading source…', ms: 500 },
            { label: 'Extracting fields…', ms: 700 },
            { label: 'Detecting anomalies…', ms: 600 },
            { label: 'Generating resolution…', ms: 400 }
        ];

        let t = 0;
        steps.forEach(s => {
            t += s.ms;
            setTimeout(() => {
                const lbl = document.querySelector('#ed-processing-overlay .ed-processing-label');
                if (lbl) lbl.textContent = s.label;
            }, t);
        });

        t += 300;
        setTimeout(() => {
            renderResolution(demoData);
            state.isProcessing = false;
            updateStatus('review', 'Needs review');
        }, t);
    }

    /* ── Process Arbitrary Text ── */
    function processText(text, filename) {
        if (state.isProcessing) return;
        state.isProcessing = true;
        state.hasContent = true;

        const sourceData = {
            type: filename ? 'file' : 'paste',
            meta: {
                from: filename || 'Pasted content',
                date: new Date().toLocaleString(),
                subject: text.substring(0, 60) + (text.length > 60 ? '…' : '')
            },
            body: text,
            fields: [],
            anomalies: [],
            action: { title: 'Manual Review Required', desc: 'Connect your AI backend for automatic extraction. In sandbox mode, basic regex extraction is applied.', trust: 'review' }
        };

        showSource(sourceData);
        showProcessing();

        setTimeout(() => {
            sourceData.fields = extractBasicFields(text);
            sourceData.fields = resolveFieldRanges(text, sourceData.fields);
            // Re-render source with marks
            showSource(sourceData);
            renderResolution(sourceData);
            state.isProcessing = false;
            updateStatus('review', 'Extracted');
        }, 1600);
    }

    function extractBasicFields(text) {
        const fields = [];
        const email = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
        if (email) fields.push({ id: 'email', label: 'Email', value: email[0], trust: 'safe', match: email[0], mono: true });

        const phone = text.match(/\+?[\d\s()-]{10,}/);
        if (phone) fields.push({ id: 'phone', label: 'Phone', value: phone[0].trim(), trust: 'safe', match: phone[0].trim(), mono: true });

        const ref = text.match(/(?:PO|order|#|ref|invoice|ticket)\s*[-:#]?\s*([\w-]{4,})/i);
        if (ref) fields.push({ id: 'ref', label: 'Reference', value: ref[1], trust: 'review', match: ref[1], mono: true });

        const date = text.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4}/i);
        if (date) fields.push({ id: 'date', label: 'Date Found', value: date[0], trust: 'review', match: date[0] });

        const money = text.match(/\$[\d,]+(?:\.\d{2})?/);
        if (money) fields.push({ id: 'amount', label: 'Amount', value: money[0], trust: 'review', match: money[0], mono: true });

        return fields;
    }

    /* ── Show Source Panel ── */
    function showSource(data) {
        const dropZone = $('ed-drop-zone');
        const srcContent = $('ed-source-content');
        const srcMeta = $('ed-source-meta');
        const srcBody = $('ed-source-body');
        const panelMeta = document.querySelector('.ed-source-panel .ed-panel-meta');

        if (dropZone) dropZone.style.display = 'none';
        if (srcContent) {
            srcContent.style.display = 'flex';
            srcContent.style.flexDirection = 'column';
            srcContent.style.flex = '1';
        }

        if (srcMeta && data.meta) {
            let h = '';
            if (data.meta.from) h += '<div class="ed-source-meta-row"><span class="ed-source-meta-label">From</span><span class="ed-source-meta-value">' + esc(data.meta.from) + '</span></div>';
            if (data.meta.to) h += '<div class="ed-source-meta-row"><span class="ed-source-meta-label">To</span><span class="ed-source-meta-value">' + esc(data.meta.to) + '</span></div>';
            if (data.meta.date) h += '<div class="ed-source-meta-row"><span class="ed-source-meta-label">Date</span><span class="ed-source-meta-value">' + esc(data.meta.date) + '</span></div>';
            if (data.meta.subject) h += '<div class="ed-source-meta-row"><span class="ed-source-meta-label">Subj</span><span class="ed-source-meta-value">' + esc(data.meta.subject) + '</span></div>';
            srcMeta.innerHTML = h;
        }

        if (srcBody) {
            if (data.fields && data.fields.length && data.fields.some(f => f.range)) {
                srcBody.innerHTML = buildMarkedBody(data.body, data.fields);
            } else {
                srcBody.textContent = data.body;
            }
        }

        const types = { email: 'Email', file: 'File', paste: 'Pasted Text' };
        if (panelMeta) panelMeta.textContent = types[data.type] || 'Input';
    }

    /* ── Show Processing State ── */
    function showProcessing() {
        const empty = $('ed-resolution-empty');
        const content = $('ed-resolution-content');
        const approvalBar = $('ed-approval-bar');

        if (empty) empty.style.display = 'none';
        if (approvalBar) approvalBar.style.display = 'none';
        if (content) {
            content.style.display = 'flex';
            content.style.flexDirection = 'column';
            content.style.flex = '1';
            content.innerHTML =
                '<div class="ed-processing-overlay" id="ed-processing-overlay">' +
                '  <div class="ed-processing-spinner"></div>' +
                '  <div class="ed-processing-label">Initializing…</div>' +
                '</div>';
        }
        updateStatus('review', 'Processing');
    }

    /* ── Render Resolution Panel ── */
    function renderResolution(data) {
        const content = $('ed-resolution-content');
        const approvalBar = $('ed-approval-bar');
        if (!content) return;
        state.data = data;

        let html = '';

        // Anomalies
        if (data.anomalies && data.anomalies.length) {
            html += '<div class="ed-anomaly-section">';
            html += '<div class="ed-section-label">' + data.anomalies.length + ' Anomal' + (data.anomalies.length > 1 ? 'ies' : 'y') + ' Detected</div>';
            for (const a of data.anomalies) {
                html += '<div class="ed-anomaly-alert" data-severity="' + a.severity + '">' +
                    '<div class="ed-anomaly-dot" data-severity="' + a.severity + '"></div>' +
                    '<div><div class="ed-anomaly-title">' + esc(a.title) + '</div>' +
                    '<div class="ed-anomaly-desc">' + esc(a.desc) + '</div></div></div>';
            }
            html += '</div>';
        }

        // Fields
        if (data.fields && data.fields.length) {
            html += '<div class="ed-fields-section">';
            html += '<div class="ed-section-label">Extracted Fields</div>';
            html += '<div class="ed-fields-grid">';
            for (const f of data.fields) {
                html += '<div class="ed-field-item" data-field-id="' + f.id + '" tabindex="0">' +
                    '<div class="ed-field-label"><span class="ed-trust-dot" data-trust="' + f.trust + '"></span>' + esc(f.label) + '</div>' +
                    '<div class="ed-field-value' + (f.mono ? ' ed-mono' : '') + '">' + esc(f.value) + '</div></div>';
            }
            html += '</div></div>';
        }

        // Action
        if (data.action) {
            html += '<div class="ed-action-section">' +
                '<div class="ed-action-card">' +
                '<div class="ed-action-card-header"><span class="ed-trust-dot" data-trust="' + data.action.trust + '"></span>' +
                '<span class="ed-action-card-label">Recommended Action</span></div>' +
                '<div class="ed-action-card-title">' + esc(data.action.title) + '</div>' +
                '<div class="ed-action-card-desc">' + esc(data.action.desc) + '</div>' +
                '</div></div>';
        }

        content.innerHTML = html;
        if (approvalBar) approvalBar.style.display = '';

        // Animate
        content.style.opacity = '0';
        content.style.transform = 'translateY(6px)';
        requestAnimationFrame(() => {
            content.style.transition = 'all 0.45s cubic-bezier(0.16,1,0.3,1)';
            content.style.opacity = '1';
            content.style.transform = 'translateY(0)';
        });

        wireHighlighting();
    }

    /* ── Field ↔ Source Highlighting ── */
    function wireHighlighting() {
        $$('.ed-field-item').forEach(field => {
            const fid = field.dataset.fieldId;
            const activate = () => {
                $$('mark[data-field-id="' + fid + '"]').forEach(m => m.classList.add('ed-hl-active'));
                field.classList.add('ed-field-focused');
                const mk = document.querySelector('mark[data-field-id="' + fid + '"]');
                if (mk) mk.scrollIntoView({ behavior: 'smooth', block: 'center' });
            };
            const deactivate = () => {
                $$('mark.ed-hl-active').forEach(m => m.classList.remove('ed-hl-active'));
                field.classList.remove('ed-field-focused');
            };
            field.addEventListener('mouseenter', activate);
            field.addEventListener('mouseleave', deactivate);
            field.addEventListener('focus', activate);
            field.addEventListener('blur', deactivate);
        });
    }

    /* ── Status Helper ── */
    function updateStatus(trust, label) {
        const el = $('ed-resolution-status');
        if (!el) return;
        const colors = { safe: 'var(--ed-trust-safe)', review: 'var(--ed-trust-review)', override: 'var(--ed-trust-override)' };
        el.innerHTML = '<span class="ed-status-dot" style="color:' + (colors[trust] || colors.review) + '"></span> ' + esc(label);
    }

    /* ── Action Handlers ── */
    function handleApprove() {
        if (!state.data || state.isProcessing) return;
        const panel = $('ed-resolution-panel');
        if (panel) panel.classList.add('ed-success-flash');
        updateStatus('safe', 'Approved & Routed');
        // Disable approval buttons
        $$('.ed-approval-bar .ed-btn').forEach(b => { b.style.opacity = '0.4'; b.style.pointerEvents = 'none'; });
        // Show confirmation in action section
        const actionSection = document.querySelector('.ed-action-section');
        if (actionSection) {
            actionSection.innerHTML =
                '<div class="ed-action-confirmed" style="color: var(--ed-trust-safe)">' +
                '  <span class="material-symbols-outlined ed-action-confirmed-icon">check_circle</span>' +
                '  <div class="ed-action-confirmed-label">Approved & Routed for Execution</div>' +
                '</div>';
        }
        setTimeout(() => { if (panel) panel.classList.remove('ed-success-flash'); }, 800);
    }

    function handleEdit() {
        if (!state.data) return;
        state.isEditing = !state.isEditing;
        $$('.ed-field-value').forEach(el => { el.contentEditable = state.isEditing; });
        const btn = document.querySelector('.ed-btn-edit');
        if (btn) btn.innerHTML = state.isEditing
            ? '<span class="material-symbols-outlined">check</span> Done'
            : '<span class="material-symbols-outlined">edit</span> Edit';
        if (state.isEditing) updateStatus('review', 'Editing');
        else updateStatus('review', 'Edited');
    }

    function handleEscalate() {
        if (!state.data || state.isProcessing) return;
        updateStatus('override', 'Escalated to Manager');
        $$('.ed-approval-bar .ed-btn').forEach(b => { b.style.opacity = '0.4'; b.style.pointerEvents = 'none'; });
        // Show escalation confirmation
        const actionSection = document.querySelector('.ed-action-section');
        if (actionSection) {
            actionSection.innerHTML =
                '<div class="ed-action-confirmed" style="color: var(--ed-trust-override)">' +
                '  <span class="material-symbols-outlined ed-action-confirmed-icon">priority_high</span>' +
                '  <div class="ed-action-confirmed-label">Escalated — Awaiting Manager Review</div>' +
                '</div>';
        }
    }

    function handleReset() {
        state.hasContent = false;
        state.isProcessing = false;
        state.isEditing = false;
        state.data = null;

        const dropZone = $('ed-drop-zone');
        const srcContent = $('ed-source-content');
        const empty = $('ed-resolution-empty');
        const content = $('ed-resolution-content');
        const approvalBar = $('ed-approval-bar');

        if (dropZone) dropZone.style.display = '';
        if (srcContent) srcContent.style.display = 'none';
        if (empty) empty.style.display = '';
        if (content) { content.style.display = 'none'; content.innerHTML = ''; }
        if (approvalBar) approvalBar.style.display = 'none';
        updateStatus('review', 'Awaiting input');

        const srcMeta = document.querySelector('.ed-source-panel .ed-panel-meta');
        if (srcMeta) srcMeta.textContent = 'Awaiting input';

        // Re-enable buttons
        $$('.ed-approval-bar .ed-btn').forEach(b => { b.style.opacity = ''; b.style.pointerEvents = ''; });
    }

    /* ── Keyboard Shortcuts ── */
    function handleKeyboard(e) {
        const inInput = () => {
            const el = document.activeElement;
            return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        };
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleApprove(); }
        if (e.key === 'e' && !e.metaKey && !e.ctrlKey && !inInput()) handleEdit();
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) { e.preventDefault(); handleEscalate(); }
        if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !inInput()) handleReset();
    }

    /* ── Public API ── */
    window.edApprove = handleApprove;
    window.edEdit = handleEdit;
    window.edEscalate = handleEscalate;
    window.edReset = handleReset;
    window.edLoadDemo = loadDemo;

    /* ── Boot ── */
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
