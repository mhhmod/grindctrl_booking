# GRINDCTRL Website - MISSING Arabic Translations

## Executive Summary

While the main `i18n.js` file has complete translations for most UI elements, there are **hardcoded English strings** in the Exception Desk (Live Demo) section and other parts of the HTML that are NOT connected to the translation system. These need to be added to `i18n.js` and connected with `data-i18n` attributes.

---

## 🔴 MISSING TRANSLATIONS - Exception Desk Section

### 1. Workspace Header

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| GRINDCTRL Embedded Widget | Line 633 | أداة GrindCTRL المُدمجة | `ed_title` |
| Live Demo | Line 636 | العرض المباشر | `ed_live_demo` |
| New | Line 639 | جديد | `ed_new` |

### 2. Trust Legend

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| Safe to automate | Line 643 | آمن للأتمتة | `ed_trust_safe` |
| Needs review | Line 644 | يحتاج مراجعة | `ed_trust_review` |
| Human override required | Line 645 | يتطلب تدخل بشري | `ed_trust_override` |

### 3. Keyboard Hints

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| Approve | Line 651 | موافقة | `ed_kbd_approve` |
| Edit | Line 652 | تعديل | `ed_kbd_edit` |
| Escalate | Line 653 | تصعيد | `ed_kbd_escalate` |
| Reset | Line 654 | إعادة | `ed_kbd_reset` |

### 4. Source Evidence Panel

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| Source Evidence | Line 664 | الدليل المصدري | `ed_source_label` |
| Awaiting input | Line 665 | بانتظار الإدخال | `ed_awaiting_input` |

### 5. Drop Zone

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| Drag and drop your mess | Line 672 | اسحب وأفلت ملفاتك هنا | `ed_drop_title` |
| Email · PDF · Screenshot · Copied text · Messy order note | Line 673 | بريد · PDF · لقطة شاشة · نص منسوخ · ملاحظة طلب | `ed_drop_subtitle` |
| or | Line 674 | أو | `ed_drop_or` |
| Paste | Line 677 | لصق | `ed_paste` |
| Upload | Line 680 | رفع | `ed_upload` |
| Try Demo | Line 683 | جرّب العرض | `ed_try_demo` |

### 6. Structured Resolution Panel

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| Structured Resolution | Line 700 | الحل المُنظم | `ed_resolution_label` |
| Awaiting input | Line 703 | بانتظار الإدخال | `ed_awaiting_input` |

### 7. Ghost/Empty State Labels

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| Anomalies | Line 712 | الشذوذات | `ed_label_anomalies` |
| Extracted Fields | Line 718 | الحقول المستخرجة | `ed_label_extracted` |
| PO Number | Line 720 | رقم أمر الشراء | `ed_field_po` |
| SKU | Line 721 | رمز المنتج | `ed_field_sku` |
| Quantity | Line 722 | الكمية | `ed_field_quantity` |
| Price | Line 723 | السعر | `ed_field_price` |
| Ship To | Line 724 | عنوان الشحن | `ed_field_ship_to` |
| Deadline | Line 725 | الموعد النهائي | `ed_field_deadline` |
| Recommended Action | Line 730 | الإجراء المُوصى به | `ed_label_action` |
| Drop any messy exception. AI extracts fields, detects anomalies, and prepares an approval-ready action. | Line 736 | أفلت أي استثناء غير منظم. يستخرج الذكاء الاصطناعي الحقول، ويكتشف الشذوذات، ويُحضّر إجراءً جاهزاً للموافقة. | `ed_empty_desc` |

### 8. Approval Bar

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| Approve | Line 747 | موافقة | `ed_btn_approve` |
| Edit | Line 750 | تعديل | `ed_btn_edit` |
| Escalate | Line 753 | تصعيد | `ed_btn_escalate` |
| Support | Line 757 | الدعم | `ed_btn_support` |

### 9. Progression Bar

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| Live Demo | Line 766 | العرض المباشر | `ed_step_demo` |
| Shadow Mode | Line 767 | وضع الظل | `ed_step_shadow` |
| Connect Systems | Line 768 | ربط الأنظمة | `ed_step_connect` |
| Automate | Line 769 | الأتمتة | `ed_step_automate` |

---

## 🔴 MISSING TRANSLATIONS - Mockup Widget Section

### Phone Mockup (Widget Demo)

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| Demo Support | Line 1228 | دعم تجريبي | `mockup_title` |
| Online now | Line 1230 | متصل الآن | `mockup_online` |

---

## 🔴 MISSING TRANSLATIONS - JavaScript Dynamic Text

### Copy Snippet Button

| Hardcoded English | Location | Proposed Arabic Translation | Translation Key |
|-------------------|----------|----------------------------|-----------------|
| Copied! | Line 1682 | تم النسخ! | `txt_copied` |

---

## 📋 COMPLETE TRANSLATION CODE TO ADD TO i18n.js

```javascript
    /* ────────── EXCEPTION DESK (Live Demo) ────────── */
    ed_title: { en: 'GRINDCTRL Embedded Widget', ar: 'أداة GrindCTRL المُدمجة' },
    ed_live_demo: { en: 'Live Demo', ar: 'العرض المباشر' },
    ed_new: { en: 'New', ar: 'جديد' },
    
    /* Trust Legend */
    ed_trust_safe: { en: 'Safe to automate', ar: 'آمن للأتمتة' },
    ed_trust_review: { en: 'Needs review', ar: 'يحتاج مراجعة' },
    ed_trust_override: { en: 'Human override required', ar: 'يتطلب تدخل بشري' },
    
    /* Keyboard Hints */
    ed_kbd_approve: { en: 'Approve', ar: 'موافقة' },
    ed_kbd_edit: { en: 'Edit', ar: 'تعديل' },
    ed_kbd_escalate: { en: 'Escalate', ar: 'تصعيد' },
    ed_kbd_reset: { en: 'Reset', ar: 'إعادة' },
    
    /* Panels */
    ed_source_label: { en: 'Source Evidence', ar: 'الدليل المصدري' },
    ed_resolution_label: { en: 'Structured Resolution', ar: 'الحل المُنظم' },
    ed_awaiting_input: { en: 'Awaiting input', ar: 'بانتظار الإدخال' },
    
    /* Drop Zone */
    ed_drop_title: { en: 'Drag and drop your mess', ar: 'اسحب وأفلت ملفاتك هنا' },
    ed_drop_subtitle: { en: 'Email · PDF · Screenshot · Copied text · Messy order note', ar: 'بريد · PDF · لقطة شاشة · نص منسوخ · ملاحظة طلب' },
    ed_drop_or: { en: 'or', ar: 'أو' },
    ed_paste: { en: 'Paste', ar: 'لصق' },
    ed_upload: { en: 'Upload', ar: 'رفع' },
    ed_try_demo: { en: 'Try Demo', ar: 'جرّب العرض' },
    
    /* Ghost Labels */
    ed_label_anomalies: { en: 'Anomalies', ar: 'الشذوذات' },
    ed_label_extracted: { en: 'Extracted Fields', ar: 'الحقول المستخرجة' },
    ed_field_po: { en: 'PO Number', ar: 'رقم أمر الشراء' },
    ed_field_sku: { en: 'SKU', ar: 'رمز المنتج' },
    ed_field_quantity: { en: 'Quantity', ar: 'الكمية' },
    ed_field_price: { en: 'Price', ar: 'السعر' },
    ed_field_ship_to: { en: 'Ship To', ar: 'عنوان الشحن' },
    ed_field_deadline: { en: 'Deadline', ar: 'الموعد النهائي' },
    ed_label_action: { en: 'Recommended Action', ar: 'الإجراء المُوصى به' },
    ed_empty_desc: { en: 'Drop any messy exception. AI extracts fields, detects anomalies, and prepares an approval-ready action.', ar: 'أفلت أي استثناء غير منظم. يستخرج الذكاء الاصطناعي الحقول، ويكتشف الشذوذات، ويُحضّر إجراءً جاهزاً للموافقة.' },
    
    /* Approval Bar */
    ed_btn_approve: { en: 'Approve', ar: 'موافقة' },
    ed_btn_edit: { en: 'Edit', ar: 'تعديل' },
    ed_btn_escalate: { en: 'Escalate', ar: 'تصعيد' },
    ed_btn_support: { en: 'Support', ar: 'الدعم' },
    
    /* Progression Steps */
    ed_step_demo: { en: 'Live Demo', ar: 'العرض المباشر' },
    ed_step_shadow: { en: 'Shadow Mode', ar: 'وضع الظل' },
    ed_step_connect: { en: 'Connect Systems', ar: 'ربط الأنظمة' },
    ed_step_automate: { en: 'Automate', ar: 'الأتمتة' },
    
    /* ────────── MOCKUP WIDGET ────────── */
    mockup_title: { en: 'Demo Support', ar: 'دعم تجريبي' },
    mockup_online: { en: 'Online now', ar: 'متصل الآن' },
    
    /* ────────── DYNAMIC TEXT ────────── */
    txt_copied: { en: 'Copied!', ar: 'تم النسخ!' },
```

---

## 📝 HTML ATTRIBUTES TO ADD

The following HTML elements need `data-i18n` attributes added:

### Exception Desk Header (lines 633-655)
```html
<h1 class="ed-workspace-title" data-i18n="ed_title">GRINDCTRL Embedded Widget</h1>
<div class="ed-status-badge">
  <span class="ed-status-dot"></span>
  <span data-i18n="ed_live_demo">Live Demo</span>
</div>
<button class="ed-new-exception-btn" id="ed-new-btn" onclick="edReset()" title="Clear and start a new exception">
  <span class="material-symbols-outlined" style="font-size:14px">add</span> <span data-i18n="ed_new">New</span>
</button>
```

### Trust Legend (lines 643-645)
```html
<span class="ed-trust-legend-item" data-trust="safe">
  <span class="ed-trust-legend-dot" style="background:var(--ed-trust-safe)"></span>
  <span data-i18n="ed_trust_safe">Safe to automate</span>
</span>
<span class="ed-trust-legend-item" data-trust="review">
  <span class="ed-trust-legend-dot" style="background:var(--ed-trust-review)"></span>
  <span data-i18n="ed_trust_review">Needs review</span>
</span>
<span class="ed-trust-legend-item" data-trust="override">
  <span class="ed-trust-legend-dot" style="background:var(--ed-trust-override)"></span>
  <span data-i18n="ed_trust_override">Human override required</span>
</span>
```

### Keyboard Hints (lines 651-654)
```html
<div class="ed-kbd-hints">
  <span><span class="ed-kbd">⌘↵</span> <span data-i18n="ed_kbd_approve">Approve</span></span>
  <span><span class="ed-kbd">E</span> <span data-i18n="ed_kbd_edit">Edit</span></span>
  <span><span class="ed-kbd">⇧⌘E</span> <span data-i18n="ed_kbd_escalate">Escalate</span></span>
  <span><span class="ed-kbd">R</span> <span data-i18n="ed_kbd_reset">Reset</span></span>
</div>
```

---

## 📊 SUMMARY

| Category | Missing Keys | Priority |
|----------|--------------|----------|
| Exception Desk - Header | 3 | High |
| Exception Desk - Trust Legend | 3 | High |
| Exception Desk - Keyboard Hints | 4 | Medium |
| Exception Desk - Panels | 3 | High |
| Exception Desk - Drop Zone | 7 | High |
| Exception Desk - Ghost Labels | 10 | Medium |
| Exception Desk - Approval Bar | 4 | High |
| Exception Desk - Progression | 4 | Medium |
| Mockup Widget | 2 | Low |
| Dynamic Text | 1 | Medium |
| **TOTAL** | **41 keys** | - |

---

## ✅ RECOMMENDED ACTION PLAN

1. **High Priority**: Add translations for the main Exception Desk UI elements that users interact with most
2. **Medium Priority**: Add keyboard hints and ghost state labels
3. **Low Priority**: Add mockup widget translations (only visible in demo mode)

---

*Document generated: April 2026*
*Analysis of: i18n.js + index.html*
*Total Missing Keys: 41*
