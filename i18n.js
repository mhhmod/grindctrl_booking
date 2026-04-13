/**
 * GrindCTRL – Internationalization (EN / AR)
 * Usage: add data-i18n="key" to any element whose textContent should be swapped.
 *        add data-i18n-placeholder="key" for input placeholders.
 *        add data-i18n-html="key" for elements whose innerHTML should be swapped.
 */
(function () {
  'use strict';

  var T = {
    /* ────────── NAV ────────── */
    nav_home: { en: 'Home', ar: 'الرئيسية' },
    nav_solutions: { en: 'Solutions', ar: 'الحلول' },
    nav_ai_trainer: { en: 'AI Trainer', ar: 'المدرب الذكي' },
    nav_packages: { en: 'Packages', ar: 'الباقات' },
    nav_book_cta: { en: 'Book a Call', ar: 'احجز مكالمة' },

    /* ────────── DRAWER ────────── */
    drawer_home: { en: ' Home', ar: ' الرئيسية' },
    drawer_solutions: { en: ' Solutions', ar: ' الحلول' },
    drawer_ai_trainer: { en: ' AI Trainer', ar: ' المدرب الذكي' },
    drawer_packages: { en: ' Packages', ar: ' الباقات' },
    drawer_book_cta: { en: 'Book a Strategy Call', ar: 'احجز مكالمة استراتيجية' },

    /* ────────── FLOATING PILL ────────── */
    pill_book: { en: ' Book a Call', ar: ' احجز مكالمة' },

    /* ────────── HOME: HERO ────────── */
    hero_badge: { en: 'AI systems for modern operators', ar: 'أنظمة ذكاء اصطناعي للمشغّلين الحديثين' },
    hero_title: { en: 'Run Your Operations<br class="hidden sm:block"/> with More Clarity,<br class="hidden md:block"/> Speed, and Control', ar: 'شغّل عملياتك<br class="hidden sm:block"/> بوضوح أكبر<br class="hidden md:block"/> وسرعة وتحكّم' },
    hero_subtitle: { en: 'We build AI automations, AI agents, and business systems that remove admin drag and help your team move faster.', ar: 'نبني أتمتة ذكية ووكلاء ذكيين وأنظمة أعمال تقلّل العبء الإداري وتساعد فريقك على العمل بسرعة أكبر.' },
    hero_cta_primary: { en: 'See the 2-Min Workflow Tour', ar: 'شاهد جولة العمل خلال دقيقتين' },
    hero_cta_secondary: { en: 'Book a Strategy Call', ar: 'احجز مكالمة استراتيجية' },
    hero_proof_1: { en: 'Trusted by 40+ operators', ar: 'موثوق من ٤٠+ شركة' },
    hero_proof_2: { en: 'Avg 22 hrs/week saved', ar: 'توفير ٢٢ ساعة/أسبوع' },
    hero_proof_3: { en: 'Go live in under 14 days', ar: 'انطلق خلال أقل من ١٤ يوم' },

    /* ────────── HOME: CORE SOLUTIONS ────────── */
    core_title: { en: 'What We Build', ar: 'ماذا نبني' },
    core_auto_title: { en: 'AI Automation', ar: 'الأتمتة الذكية' },
    core_auto_desc: { en: 'Replace repetitive workflows with autonomous systems that work 24/7 without fatigue or error.', ar: 'استبدل سير العمل المتكرر بأنظمة ذاتية تعمل على مدار الساعة بلا أخطاء.' },
    core_auto_workflow_label: { en: 'Live Workflow · Order Processing', ar: 'سير عمل مباشر · معالجة الطلبات' },
    core_auto_runs: { en: ' 2,847 runs today', ar: ' ٢٬٨٤٧ عملية اليوم' },
    core_auto_success: { en: '99.7% success', ar: '٩٩٫٧٪ نجاح' },
    core_auto_avg: { en: 'Avg 1.2s', ar: 'متوسط ١٫٢ ثانية' },
    core_auto_link: { en: 'View Frameworks ', ar: 'عرض الأُطر ' },
    core_agent_title: { en: 'AI Agents', ar: 'الوكلاء الأذكياء' },
    core_agent_desc: { en: 'Custom-trained digital employees focused on specific roles from sales to support.', ar: 'موظفون رقميون مدرّبون لأدوار محددة من المبيعات إلى الدعم.' },
    core_agent_name: { en: 'Sales Agent', ar: 'وكيل المبيعات' },
    core_agent_active: { en: 'Active', ar: 'نشط' },
    core_agent_leads: { en: 'Leads handled today', ar: 'العملاء المحتملون اليوم' },
    core_agent_response: { en: 'Response time', ar: 'وقت الاستجابة' },
    core_agent_conversion: { en: 'Conversion rate', ar: 'معدل التحويل' },
    core_agent_link: { en: 'Configure Agent →', ar: 'إعداد الوكيل ←' },
    core_biz_title: { en: 'Business Systems', ar: 'أنظمة الأعمال' },
    core_biz_desc: { en: 'Foundational architectures that scale with your growth, designed for clarity.', ar: 'بنى تحتية أساسية تتوسع مع نموك، مصممة للوضوح.' },
    core_biz_pipeline: { en: 'Pipeline · Q2', ar: 'خط الأنابيب · الربع الثاني' },
    core_biz_new: { en: 'New', ar: 'جديد' },
    core_biz_qualified: { en: 'Qualified', ar: 'مؤهل' },
    core_biz_proposal: { en: 'Proposal', ar: 'عرض' },
    core_biz_won: { en: 'Won', ar: 'مكسوب' },
    core_biz_link: { en: 'System Audit →', ar: 'تدقيق الأنظمة ←' },
    core_trainer_title: { en: 'AI Trainer', ar: 'المدرب الذكي' },
    core_trainer_desc: { en: 'Vertical-specific AI tools designed for gym owners and performance coaches to automate member retention.', ar: 'أدوات ذكاء اصطناعي متخصصة لمالكي الصالات الرياضية والمدربين لأتمتة الاحتفاظ بالأعضاء.' },
    core_trainer_clients: { en: 'Active Clients · This Week', ar: 'العملاء النشطون · هذا الأسبوع' },
    core_trainer_link: { en: 'Explore Coaching AI ', ar: 'استكشف الذكاء التدريبي ' },

    /* ────────── HOME: INTEGRATION STRIP ────────── */
    integ_label: { en: 'Connects with your stack', ar: 'يتصل بأدواتك الحالية' },

    /* ────────── HOME: PRODUCT PROOF ────────── */
    proof_title: { en: 'See the Product Layer', ar: 'شاهد طبقة المنتج' },
    proof_subtitle: { en: "Real interfaces from working systems. Not concept screens.", ar: 'واجهات حقيقية من أنظمة تعمل فعلاً. وليست شاشات تجريبية.' },
    proof_slack_label: { en: 'AI Agent · Slack Integration', ar: 'وكيل ذكي · تكامل Slack' },
    proof_slack_user: { en: 'Khalid H. · 2:14 PM', ar: 'خالد ح. · ٢:١٤ م' },
    proof_slack_q: { en: "Where's my order #4821? It was supposed to arrive yesterday.", ar: 'أين طلبي #٤٨٢١؟ كان المفترض يوصل أمس.' },
    proof_slack_agent: { en: 'GrindCTRL Agent · 2:14 PM', ar: 'وكيل GrindCTRL · ٢:١٤ م' },
    proof_slack_a: { en: 'Order #4821 shipped via Aramex — tracking: ARX-7829341. Current status: <strong>Out for Delivery</strong>. Expected by 5 PM today. Want me to request priority?', ar: 'الطلب #٤٨٢١ شُحن عبر أرامكس — رقم التتبع: ARX-7829341. الحالة: <strong>في الطريق للتسليم</strong>. متوقع الوصول الساعة ٥ مساءً. هل تريد طلب أولوية؟' },
    proof_slack_approval: { en: 'Human approval: Send priority request?', ar: 'موافقة بشرية: إرسال طلب أولوية؟' },
    proof_slack_approved: { en: 'Approved ✓', ar: 'تمت الموافقة ✓' },
    proof_wf_label: { en: 'Workflow Builder · Lead Processing', ar: 'منشئ سير العمل · معالجة العملاء' },
    proof_wf_trigger: { en: 'Trigger: New Lead', ar: 'مُحفّز: عميل جديد' },
    proof_wf_trigger_sub: { en: 'Shopify Webhook · Real-time', ar: 'Shopify Webhook · لحظي' },
    proof_wf_ai: { en: 'AI: Score & Qualify', ar: 'ذكاء: تقييم وتأهيل' },
    proof_wf_ai_sub: { en: 'GPT-4o · Confidence 94%', ar: 'GPT-4o · ثقة ٩٤٪' },
    proof_wf_route: { en: 'Route: Priority / Standard / Nurture', ar: 'توجيه: أولوية / عادي / رعاية' },
    proof_wf_route_sub: { en: '3 conditional branches', ar: '٣ فروع شرطية' },
    proof_wf_notify: { en: 'Notify: Sales Rep via Slack + CRM', ar: 'إبلاغ: مندوب المبيعات عبر Slack + CRM' },
    proof_wf_notify_sub: { en: 'HubSpot deal created', ar: 'تم إنشاء صفقة HubSpot' },
    proof_kpi_label: { en: 'Impact Dashboard · Monthly Summary', ar: 'لوحة الأثر · ملخص شهري' },
    proof_kpi_hrs: { en: 'hrs/week saved', ar: 'ساعة/أسبوع وُفّرت' },
    proof_kpi_hrs_sub: { en: '↑ vs 6 hrs manual', ar: '↑ مقابل ٦ ساعات يدوية' },
    proof_kpi_resolved: { en: 'auto-resolved', ar: 'حُلّت تلقائياً' },
    proof_kpi_resolved_sub: { en: 'tickets & inquiries', ar: 'تذاكر واستفسارات' },
    proof_kpi_labor: { en: 'labor saved/mo', ar: 'وفر عمالة/شهر' },
    proof_kpi_labor_sub: { en: 'equivalent headcount', ar: 'ما يعادل موظف' },
    proof_log_label: { en: 'Automation Log · Today', ar: 'سجل الأتمتة · اليوم' },
    proof_log_1: { en: 'Invoice #4821 auto-generated', ar: 'فاتورة #٤٨٢١ أُنشئت تلقائياً' },
    proof_log_1t: { en: '8m ago', ar: 'منذ ٨ دقائق' },
    proof_log_2: { en: 'Lead scored & routed to sales', ar: 'تم تقييم وتحويل العميل للمبيعات' },
    proof_log_2t: { en: '14m ago', ar: 'منذ ١٤ دقيقة' },
    proof_log_3: { en: 'CRM sync: 23 contacts updated', ar: 'مزامنة CRM: تحديث ٢٣ جهة اتصال' },
    proof_log_3t: { en: '21m ago', ar: 'منذ ٢١ دقيقة' },
    proof_hitl_label: { en: 'Human-in-the-Loop · Pending Actions', ar: 'الإنسان في الحلقة · إجراءات معلّقة' },
    proof_hitl_awaiting: { en: 'Awaiting Approval', ar: 'بانتظار الموافقة' },
    proof_hitl_time: { en: '2 min ago', ar: 'منذ ٢ دقيقة' },
    proof_hitl_action: { en: 'AI wants to send discount offer', ar: 'الذكاء الاصطناعي يريد إرسال عرض خصم' },
    proof_hitl_desc: { en: "Customer hasn't purchased in 45 days. AI recommends 15% re-engagement offer via WhatsApp. Estimated recovery value: $320.", ar: 'العميل لم يشترِ منذ ٤٥ يوماً. الذكاء الاصطناعي يقترح عرض إعادة تفاعل ١٥٪ عبر واتساب. القيمة المتوقعة: $٣٢٠.' },
    proof_hitl_confidence: { en: 'Confidence:', ar: 'الثقة:' },
    proof_hitl_hist1: { en: 'Refund $45 for order #4799', ar: 'استرداد $٤٥ للطلب #٤٧٩٩' },
    proof_hitl_hist1t: { en: 'Approved 14m ago', ar: 'تمت الموافقة منذ ١٤ دقيقة' },
    proof_hitl_hist2: { en: 'Escalate support ticket #392 to Tier 2', ar: 'تصعيد تذكرة الدعم #٣٩٢ للمستوى ٢' },
    proof_hitl_hist2t: { en: 'Approved 28m ago', ar: 'تمت الموافقة منذ ٢٨ دقيقة' },

    /* ────────── HOME: QUANTIFIED ROI ────────── */
    roi_title: { en: 'What Changes in Week 1', ar: 'ما الذي يتغيّر في الأسبوع الأول' },
    roi_hrs_label: { en: 'Hours saved per week', ar: 'ساعات تُوفَّر أسبوعياً' },
    roi_hrs_desc: { en: 'Manual data entry, follow-ups, and reporting — automated.', ar: 'إدخال البيانات والمتابعات والتقارير — مؤتمتة بالكامل.' },
    roi_response_label: { en: 'Average response time', ar: 'متوسط وقت الاستجابة' },
    roi_response_desc: { en: 'Your AI agent handles leads 24/7 — even at 3 AM.', ar: 'وكيلك الذكي يتعامل مع العملاء ٢٤/٧ — حتى الساعة ٣ صباحاً.' },
    roi_live_label: { en: 'Time to first workflow live', ar: 'الوقت لإطلاق أول سير عمل' },
    roi_live_desc: { en: 'From kickoff call to production automation.', ar: 'من مكالمة الانطلاق إلى الأتمتة الفعلية.' },
    roi_callout: { en: 'Our average client reclaims the equivalent of <strong class="text-on-surface">a full-time hire within 90 days</strong>.', ar: 'عميلنا المتوسط يستعيد ما يعادل <strong class="text-on-surface">موظف بدوام كامل خلال ٩٠ يوماً</strong>.' },

    /* ────────── HOME: TRUST CENTER ────────── */
    trust_title: { en: 'Built for Real Operations', ar: 'مبنية للعمليات الحقيقية' },
    trust_subtitle: { en: 'Clear systems, human approval, and business-grade safeguards.', ar: 'أنظمة واضحة، وموافقة بشرية، وضمانات تناسب الأعمال.' },
    trust_iso_title: { en: 'Data Isolation', ar: 'عزل البيانات' },
    trust_iso_desc: { en: 'Each client runs on isolated infrastructure. Your data never touches another account.', ar: 'كل عميل يعمل على بنية منفصلة. بياناتك لا تمس حساباً آخر.' },
    trust_hitl_title: { en: 'Human-in-the-Loop', ar: 'الإنسان في الحلقة' },
    trust_hitl_desc: { en: 'Every AI action can require human approval before execution. You stay in control.', ar: 'كل إجراء ذكي يمكن أن يحتاج موافقة بشرية قبل التنفيذ. أنت تبقى مسيطراً.' },
    trust_sec_title: { en: 'Enterprise Security', ar: 'أمان المؤسسات' },
    trust_sec_desc: { en: 'AES-256 encryption at rest, TLS 1.3 in transit. SOC 2 readiness roadmap in progress.', ar: 'تشفير AES-256 في السكون، TLS 1.3 أثناء النقل. خارطة طريق SOC 2 قيد التنفيذ.' },
    trust_price_title: { en: 'Transparent Pricing', ar: 'تسعير شفاف' },
    trust_price_desc: { en: 'No per-seat fees. No surprise overages. Flat monthly retainer with clear scope.', ar: 'بدون رسوم لكل مستخدم. بدون مفاجآت. اشتراك شهري ثابت بنطاق واضح.' },

    /* ────────── HOME: WALL OF LOVE ────────── */
    wol_title: { en: 'From Our Clients', ar: 'من عملائنا' },
    wol_q1: { en: '"We cut our order processing time from 4 hours to 12 minutes. The ROI was visible in week one."', ar: '"قلّصنا وقت معالجة الطلبات من ٤ ساعات إلى ١٢ دقيقة. العائد ظهر من الأسبوع الأول."' },
    wol_a1_role: { en: 'Operations Lead', ar: 'مدير العمليات' },
    wol_a1_co: { en: 'E-Commerce Company · UAE', ar: 'شركة تجارة إلكترونية · الإمارات' },
    wol_a1_ind: { en: 'Retail', ar: 'تجزئة' },
    wol_q2: { en: '"GrindCTRL built us an AI agent that handles 80% of our WhatsApp inquiries without human intervention."', ar: '"GrindCTRL بنى لنا وكيل ذكي يتعامل مع ٨٠٪ من استفسارات واتساب بدون تدخل بشري."' },
    wol_a2_role: { en: 'Founder', ar: 'المؤسس' },
    wol_a2_co: { en: 'Fitness Studio · KSA', ar: 'استوديو رياضي · السعودية' },
    wol_a2_ind: { en: 'Health & Wellness', ar: 'صحة ولياقة' },
    wol_q3: { en: '"What sold us was the human approval layer. We see exactly what the AI wants to do before it does it."', ar: '"ما أقنعنا هو طبقة الموافقة البشرية. نرى بالضبط ما يريد الذكاء الاصطناعي فعله قبل أن يفعله."' },
    wol_a3_role: { en: 'CTO', ar: 'المدير التقني' },
    wol_a3_co: { en: 'Logistics Company · UAE', ar: 'شركة لوجستيات · الإمارات' },
    wol_a3_ind: { en: 'Supply Chain', ar: 'سلسلة الإمداد' },

    /* ────────── HOME: PACKAGES ────────── */
    pkg_title: { en: 'Structured for Scale', ar: 'مُهيكل للتوسع' },
    pkg_subtitle: { en: 'Choose the level of control your business requires. No hidden fees, just precision engineering.', ar: 'اختر مستوى التحكم الذي يحتاجه عملك. بدون رسوم خفية، فقط هندسة دقيقة.' },
    pkg_phase1: { en: 'Phase 01', ar: 'المرحلة ٠١' },
    pkg_starter: { en: 'Starter', ar: 'البداية' },
    pkg_s1: { en: ' Core CRM Automation', ar: ' أتمتة CRM أساسية' },
    pkg_s2: { en: ' System Health Audit', ar: ' تدقيق صحة الأنظمة' },
    pkg_s3: { en: ' 1x Custom AI Agent', ar: ' وكيل ذكي مخصص واحد' },
    pkg_s_cta: { en: 'Start Building', ar: 'ابدأ البناء' },
    pkg_phase2: { en: 'Phase 02', ar: 'المرحلة ٠٢' },
    pkg_popular: { en: 'Popular', ar: 'الأكثر طلباً' },
    pkg_growth: { en: 'Growth', ar: 'النمو' },
    pkg_g1: { en: ' Full Workflow Automation', ar: ' أتمتة كاملة لسير العمل' },
    pkg_g2: { en: ' 3x Specialized AI Agents', ar: ' ٣ وكلاء ذكيين متخصصين' },
    pkg_g3: { en: ' Custom Client Dashboard', ar: ' لوحة تحكم مخصصة للعملاء' },
    pkg_g4: { en: ' Bi-Weekly Syncs', ar: ' مزامنة كل أسبوعين' },
    pkg_g_cta: { en: 'Select Growth', ar: 'اختر النمو' },
    pkg_phase3: { en: 'Phase 03', ar: 'المرحلة ٠٣' },
    pkg_control: { en: 'Control', ar: 'التحكم' },
    pkg_c1: { en: ' Enterprise OS Build', ar: ' بناء نظام تشغيل المؤسسة' },
    pkg_c2: { en: ' Unlimited AI Agents', ar: ' وكلاء ذكيون غير محدودين' },
    pkg_c3: { en: ' Dedicated Systems Lead', ar: ' مسؤول أنظمة مخصص' },
    pkg_c4: { en: ' Priority 24/7 Support', ar: ' دعم على مدار الساعة بأولوية' },
    pkg_c_cta: { en: 'Inquire for Enterprise', ar: 'استفسر عن المؤسسات' },

    /* ────────── HOME: PACKAGES – TRUST STRIP ────────── */
    pkg_trust_1: { en: 'No lock-in contracts', ar: 'بدون عقود ملزمة' },
    pkg_trust_2: { en: 'Data isolation included', ar: 'عزل البيانات مُضمّن' },
    pkg_trust_3: { en: 'Human approval on every AI action', ar: 'موافقة بشرية على كل إجراء ذكي' },
    pkg_trust_4: { en: 'Cancel anytime', ar: 'إلغاء في أي وقت' },

    /* ────────── HOME: FINAL CTA ────────── */
    cta_testimonial: { en: '"The strategy call alone gave us a 3-month automation roadmap. We started saving 18 hours/week within 2 weeks."', ar: '"المكالمة الاستراتيجية وحدها أعطتنا خارطة أتمتة لـ ٣ أشهر. بدأنا بتوفير ١٨ ساعة/أسبوع خلال أسبوعين."' },
    cta_testimonial_author: { en: '— CEO, Nexus Logistics', ar: '— الرئيس التنفيذي، Nexus Logistics' },
    cta_title: { en: 'Ready to Remove the Busywork?', ar: 'جاهز لتخفيف العمل المرهق؟' },
    cta_subtitle: { en: 'Book a free strategy call and leave with a clearer path for automation, agents, and system design.', ar: 'احجز مكالمة استراتيجية مجانية واخرج بمسار أوضح للأتمتة والوكلاء وتصميم الأنظمة.' },
    cta_book: { en: 'Book a Strategy Call', ar: 'احجز مكالمة استراتيجية' },
    cta_fine_print: { en: 'Free 30-minute session · No obligation · Confidential', ar: 'جلسة مجانية ٣٠ دقيقة · بدون التزام · سري' },
    cta_live_proof: { en: 'Average client goes live in under 14 days', ar: 'العميل المتوسط ينطلق خلال أقل من ١٤ يوم' },

    /* ────────── SOLUTIONS PAGE ────────── */
    sol_hero_title: { en: 'Architecture for the <span class="text-ink-dim italic font-bold">Automated</span> Enterprise.', ar: 'بنية المؤسسة <span class="text-ink-dim italic font-bold">المُؤتمتة</span>.' },
    sol_hero_desc: { en: 'We design and implement autonomous systems that eliminate operational friction. Our core pillars represent the modular building blocks of a self-sustaining business.', ar: 'نصمم وننفذ أنظمة ذاتية تقضي على الاحتكاك التشغيلي. ركائزنا الأساسية تمثل اللبنات المعيارية لأعمال مستدامة ذاتياً.' },
    sol_core_engine: { en: ' Core Engine', ar: ' المحرك الأساسي' },
    sol_auto_title: { en: 'AI Automation', ar: 'الأتمتة الذكية' },
    sol_auto_desc: { en: 'Seamless integration of LLMs into your existing workflows to handle data processing, classification, and report generation without human intervention.', ar: 'دمج سلس لنماذج اللغة الكبيرة في سير عملك الحالي للتعامل مع معالجة البيانات والتصنيف وإنشاء التقارير بدون تدخل بشري.' },
    sol_auto_stat: { en: 'Reduce manual work by up to 85%', ar: 'خفض العمل اليدوي بنسبة تصل إلى ٨٥٪' },
    sol_workflow_builder: { en: 'Workflow Builder', ar: 'منشئ سير العمل' },
    sol_trigger_lead: { en: 'Trigger: New Lead', ar: 'مُشغّل: عميل جديد' },
    sol_trigger_via: { en: 'via Website Form', ar: 'عبر نموذج الموقع' },
    sol_ai_score: { en: 'AI: Score & Qualify', ar: 'ذكاء: تقييم وتأهيل' },
    sol_ai_confidence: { en: 'GPT-4o · Confidence 94%', ar: 'GPT-4o · ثقة ٩٤٪' },
    sol_route: { en: 'Route: High / Med / Low', ar: 'توجيه: عالي / متوسط / منخفض' },
    sol_route_branches: { en: '3 conditional branches', ar: '٣ فروع شرطية' },
    sol_action_notify: { en: 'Action: Notify Sales', ar: 'إجراء: إبلاغ المبيعات' },
    sol_action_channels: { en: 'Slack + Email + CRM', ar: 'Slack + بريد + CRM' },
    sol_frontline: { en: ' Frontline', ar: ' خط المواجهة' },
    sol_agents_title: { en: 'AI Agents', ar: 'الوكلاء الأذكياء' },
    sol_agents_desc: { en: 'Intelligent entities designed for specific roles—from 24/7 lead handling to autonomous customer support.', ar: 'كيانات ذكية مصممة لأدوار محددة — من التعامل مع العملاء على مدار الساعة إلى دعم العملاء الذاتي.' },
    sol_support_live: { en: 'Support Agent · Live', ar: 'وكيل الدعم · مباشر' },
    sol_chat_q: { en: 'Can I change my subscription plan?', ar: 'هل يمكنني تغيير خطة اشتراكي؟' },
    sol_chat_a: { en: "Of course! I've pulled up your account. You're on Growth — would you like to upgrade to Control?", ar: 'بالتأكيد! لقد فتحت حسابك. أنت على خطة النمو — هل ترغب بالترقية إلى التحكم؟' },
    sol_chat_stats: { en: 'Resolved 94% autonomously · Avg 18s first reply', ar: 'تم حل ٩٤٪ ذاتياً · متوسط أول رد ١٨ ثانية' },
    sol_infra: { en: ' Infrastructure', ar: ' البنية التحتية' },
    sol_biz_title: { en: 'Business Systems', ar: 'أنظمة الأعمال' },
    sol_biz_desc: { en: 'Hard-coded logic meets fluid intelligence. We rebuild your CRM and ERP into an AI-first ecosystem.', ar: 'منطق ثابت يلتقي بذكاء مرن. نعيد بناء نظام CRM و ERP الخاص بك في منظومة قائمة على الذكاء الاصطناعي.' },
    sol_lead_pipeline: { en: 'Lead Pipeline', ar: 'خط أنابيب العملاء' },
    sol_proposal: { en: 'Proposal', ar: 'عرض' },
    sol_qualified: { en: 'Qualified', ar: 'مؤهل' },
    sol_followup: { en: 'Follow-up', ar: 'متابعة' },
    sol_human_alpha: { en: ' Human Alpha', ar: ' الإنسان ألفا' },
    sol_trainer_title: { en: 'AI Trainer', ar: 'المدرب الذكي' },
    sol_trainer_desc: { en: 'Upskilling your leadership and staff to co-pilot with AI. We transform your team into highly efficient system architects.', ar: 'تطوير مهارات قيادتك وموظفيك للعمل جنباً إلى جنب مع الذكاء الاصطناعي. نحوّل فريقك إلى مهندسي أنظمة عالية الكفاءة.' },
    sol_trainer_stat: { en: 'Future-proofed human capital', ar: 'رأس مال بشري مُستعد للمستقبل' },
    sol_client_mobile: { en: 'Client Mobile View', ar: 'عرض الهاتف للعميل' },
    sol_todays_plan: { en: "Today's Plan", ar: 'خطة اليوم' },
    sol_weekly_progress: { en: 'Weekly Progress', ar: 'التقدم الأسبوعي' },
    sol_coach_message: { en: 'Coach Message', ar: 'رسالة المدرب' },
    sol_cta_title: { en: 'Ready to automate the grind?', ar: 'مستعد لأتمتة المهام المتكررة؟' },
    sol_cta_desc: { en: "Let's audit your current systems and find where AI can deliver 10x ROI within 30 days.", ar: 'لنراجع أنظمتك الحالية ونكتشف أين يمكن للذكاء الاصطناعي تحقيق عائد ١٠ أضعاف خلال ٣٠ يوماً.' },
    sol_cta_book: { en: 'Book a Strategy Call ', ar: 'احجز مكالمة استراتيجية ' },
    sol_cta_fine: { en: 'Free · 30 minutes · No obligation', ar: 'مجاني · ٣٠ دقيقة · بدون التزام' },

    /* ────────── AI TRAINER PAGE ────────── */
    ait_badge: { en: 'Precision Intelligence', ar: 'الذكاء الدقيق' },
    ait_hero_title: { en: 'AI Precision for<br/>Elite Trainers.', ar: 'ذكاء اصطناعي دقيق<br/>للمدربين المحترفين.' },
    ait_hero_desc: { en: 'Automate the administrative friction of coaching. Scale your methodology with high-fidelity tracking and AI-driven insights designed for serious practitioners.', ar: 'أزل الاحتكاك الإداري في التدريب. وسّع منهجيتك بتتبع عالي الدقة ورؤى مدعومة بالذكاء الاصطناعي مصممة للممارسين الجادين.' },
    ait_get_started: { en: 'Get Started ', ar: 'ابدأ الآن ' },
    ait_view_plans: { en: 'View Plans', ar: 'عرض الباقات' },
    ait_cmd_title: { en: 'The Command Center', ar: 'مركز القيادة' },
    ait_cmd_desc: { en: 'A high-density overview of your client roster, active protocols, and automated progress loops.', ar: 'نظرة عامة شاملة على قائمة عملائك والبروتوكولات النشطة ودورات التقدم المؤتمتة.' },
    ait_dashboard: { en: ' Dashboard', ar: ' لوحة التحكم' },
    ait_athletes: { en: ' Athletes', ar: ' الرياضيون' },
    ait_performance: { en: ' Performance', ar: ' الأداء' },
    ait_schedule: { en: ' Schedule', ar: ' الجدول' },
    ait_active_protocols: { en: 'Active Protocols', ar: 'البروتوكولات النشطة' },
    ait_clients_phase: { en: '12 clients · Hypertrophy Phase', ar: '١٢ عميل · مرحلة التضخيم' },
    ait_export: { en: 'Export', ar: 'تصدير' },
    ait_new_plan: { en: '+ New Plan', ar: '+ خطة جديدة' },
    ait_kpi_clients: { en: 'Clients', ar: 'العملاء' },
    ait_kpi_checkins: { en: 'Check-ins Due', ar: 'المتابعات المستحقة' },
    ait_kpi_adherence: { en: 'Avg Adherence', ar: 'متوسط الالتزام' },
    ait_kpi_revenue: { en: 'Revenue MTD', ar: 'الإيرادات هذا الشهر' },
    ait_on_track: { en: 'On track', ar: 'على المسار' },
    ait_checkin_due: { en: 'Check-in due', ar: 'متابعة مستحقة' },
    ait_auto_plan: { en: 'Autonomous Plan Generation', ar: 'إنشاء خطط ذاتية' },
    ait_auto_plan_desc: { en: 'Our AI engine analyzes historical performance and physiological markers to draft optimal training blocks.', ar: 'يحلل محرك الذكاء الاصطناعي الأداء والمؤشرات الفسيولوجية لصياغة كتل تدريبية مثالية.' },
    ait_adaptive: { en: 'Adaptive Loads', ar: 'أحمال تكيفية' },
    ait_periodization: { en: 'Periodization Engine', ar: 'محرك التدوير' },
    ait_checkins_title: { en: 'Automated Check-ins', ar: 'متابعات مؤتمتة' },
    ait_checkins_desc: { en: 'No more chasing messages. GrindCTRL handles status updates and data collection on a schedule.', ar: 'لا مزيد من ملاحقة الرسائل. GrindCTRL يتولى التحديثات وجمع البيانات وفق جدول زمني.' },
    ait_tracking_title: { en: 'Granular Tracking', ar: 'تتبع دقيق' },
    ait_tracking_desc: { en: "From RPE to resting heart rate, visualize every metric that matters for your client's success.", ar: 'من RPE إلى معدل نبض الراحة، تصوّر كل مقياس مهم لنجاح عميلك.' },
    ait_comm_title: { en: 'Seamless Communication', ar: 'تواصل سلس' },
    ait_comm_desc: { en: 'Centralized feedback loops. Annotate workouts, record video critiques, and keep your business conversations separate.', ar: 'حلقات تغذية راجعة مركزية. أضف ملاحظات على التمارين، سجّل نقداً مصوراً، وافصل محادثات العمل.' },
    ait_client_chat: { en: 'Client Chat', ar: 'محادثة العميل' },
    ait_chat_q: { en: 'Feeling tight on squats today', ar: 'أشعر بتيبس في السكوات اليوم' },
    ait_chat_a: { en: 'Try pause squats at 70% — send me a video of your warm-up set.', ar: 'جرّب سكوات مع توقف عند ٧٠٪ — أرسل لي فيديو لمجموعة الإحماء.' },

    /* ────────── AI TRAINER CTA ────────── */
    ait_cta_title: { en: 'Ready to Scale Your Methodology?', ar: 'مستعد لتوسيع منهجيتك؟' },
    ait_cta_desc: { en: 'Join the elite network of trainers using GrindCTRL to deliver professional results without the administrative burnout.', ar: 'انضم إلى شبكة المدربين المحترفين الذين يستخدمون GrindCTRL لتحقيق نتائج احترافية بدون الإرهاق الإداري.' },
    ait_cta_book: { en: 'Book a Strategy Call ', ar: 'احجز مكالمة استراتيجية ' },
    ait_cta_plans: { en: 'View Pricing Plans', ar: 'عرض خطط التسعير' },

    /* ────────── BOOK A CALL PAGE ────────── */
    book_badge: { en: 'Strategic Access', ar: 'وصول استراتيجي' },
    book_title: { en: 'Book Your AI<br/><span class="text-primary-dim">Strategy Call</span>', ar: 'احجز مكالمة<br/><span class="text-primary-dim">الاستراتيجية الذكية</span>' },
    book_desc: { en: "Transform your operational friction into automated precision. We'll audit your current systems and design a clear path to business clarity.", ar: 'حوّل الاحتكاك التشغيلي إلى دقة مؤتمتة. سنراجع أنظمتك الحالية ونصمم مساراً واضحاً لوضوح الأعمال.' },
    book_prepare: { en: 'What to prepare', ar: 'ماذا تُحضّر' },
    book_audit_title: { en: 'Process Audit', ar: 'تدقيق العمليات' },
    book_audit_desc: { en: "List 2-3 manual tasks that consume more than 5 hours of your team's week.", ar: 'اذكر ٢-٣ مهام يدوية تستهلك أكثر من ٥ ساعات من وقت فريقك أسبوعياً.' },
    book_data_title: { en: 'Data Map', ar: 'خريطة البيانات' },
    book_data_desc: { en: 'Identify where your customer information and operational data currently live.', ar: 'حدد أين تتواجد بيانات العملاء والبيانات التشغيلية حالياً.' },
    book_goal_title: { en: 'Primary Goal', ar: 'الهدف الرئيسي' },
    book_goal_desc: { en: 'Define whether your priority is cost reduction, scale velocity, or error elimination.', ar: 'حدد ما إذا كانت أولويتك خفض التكاليف أو سرعة التوسع أو القضاء على الأخطاء.' },
    book_testimonial: { en: '"The call was the single most productive 30 minutes for our operations this year."', ar: '"كانت المكالمة أكثر ٣٠ دقيقة إنتاجية لعملياتنا هذا العام."' },
    book_testimonial_author: { en: '— CTO, Nexus Logistics', ar: '— المدير التقني، Nexus Logistics' },
    book_who_booked: { en: 'Who has booked', ar: 'من حجز مسبقاً' },
    book_leaders: { en: 'Leaders who automated their growth trajectory', ar: 'قادة أتمتوا مسار نموهم' },
    book_schedule: { en: 'Schedule Call', ar: 'جدولة المكالمة' },
    book_schedule_desc: { en: 'Select a time for your 30-minute deep-dive session.', ar: 'اختر وقتاً لجلستك المعمقة مدة ٣٠ دقيقة.' },
    book_confirm: { en: 'Confirm Appointment', ar: 'تأكيد الموعد' },
    book_no_obligation: { en: 'No Obligation', ar: 'بدون التزام' },
    book_no_obligation_desc: { en: 'Value-first session. We focus on your roadmap, not a sales pitch.', ar: 'جلسة قيمة أولاً. نركز على خارطة طريقك وليس عروض البيع.' },
    book_instant_audit: { en: 'Instant Audit', ar: 'تدقيق فوري' },
    book_instant_audit_desc: { en: 'Walk away with at least 3 concrete automation steps you can apply tomorrow.', ar: 'اخرج بما لا يقل عن ٣ خطوات أتمتة عملية يمكنك تطبيقها غداً.' },
    book_private: { en: 'Strictly Private', ar: 'سري تماماً' },
    book_private_desc: { en: 'All discussed operational data is protected by our standard confidentiality protocol.', ar: 'كافة البيانات التشغيلية المناقشة محمية ببروتوكول السرية المعتمد لدينا.' },

    /* ────────── FOOTER ────────── */
    footer_tagline: { en: 'Architecting the next generation of business intelligence through precision automation and elite AI infrastructure.', ar: 'نبني الجيل القادم من ذكاء الأعمال من خلال الأتمتة الدقيقة والبنية التحتية المتقدمة للذكاء الاصطناعي.' },
    footer_solutions: { en: 'Solutions', ar: 'الحلول' },
    footer_sol_auto: { en: 'AI Automation', ar: 'الأتمتة الذكية' },
    footer_sol_agents: { en: 'AI Agents', ar: 'الوكلاء الأذكياء' },
    footer_sol_biz: { en: 'Business OS', ar: 'نظام تشغيل الأعمال' },
    footer_sol_trainer: { en: 'AI Trainer', ar: 'المدرب الذكي' },
    footer_company: { en: 'Company', ar: 'الشركة' },
    footer_privacy: { en: 'Privacy', ar: 'الخصوصية' },
    footer_terms: { en: 'Terms', ar: 'الشروط' },
    footer_newsletter: { en: 'Newsletter', ar: 'النشرة البريدية' },
    footer_newsletter_desc: { en: 'Get automation insights weekly.', ar: 'احصل على رؤى الأتمتة أسبوعياً.' },
    footer_join: { en: 'Join', ar: 'اشترك' },
    footer_copyright: { en: '© 2026 GRINDCTRL. Precision in Automation.', ar: '© ٢٠٢٦ GRINDCTRL. دقة في الأتمتة.' },
    footer_status: { en: 'System Status: Optimal', ar: 'حالة النظام: مثالية' },
    footer_email_placeholder: { en: 'Email address', ar: 'البريد الإلكتروني' },
    footer_available_apr: { en: 'Available · Apr 14', ar: 'متاح · ١٤ أبريل' },

    /* ────────── AI AGENT TRIAL: CTAs ────────── */
    nav_try_agent: { en: 'Try the Agent', ar: 'جرّب الوكيل' },
    hero_cta_try: { en: 'Try the Agent', ar: 'جرّب الوكيل' },

    /* ────────── BLUEPRINT STUDIO ────────── */
    bp_studio_kicker: { en: 'Blueprint Studio', ar: 'Blueprint Studio' },
    bp_studio_title: { en: 'Turn one use case into a ready-to-show AI agent blueprint.', ar: 'حوّل حالة استخدام واحدة إلى مخطط وكيل ذكي جاهز للعرض.' },
    bp_studio_subtitle: { en: 'Pick a preset, answer one focused follow-up, or speak your request. The section stays light, bilingual, and built for quick demos.', ar: 'اختر قالباً جاهزاً أو أجب عن سؤال متابعة واحد أو تحدث بطلبك. هذا القسم خفيف وثنائي اللغة ومصمم للعروض السريعة.' },
    bp_studio_presets_label: { en: 'Choose a use case', ar: 'اختر حالة الاستخدام' },
    bp_studio_presets_note: { en: 'One click sets the flow direction.', ar: 'نقرة واحدة تضبط اتجاه التدفق.' },
    bp_studio_preset_qualify: { en: 'Qualify leads', ar: 'تأهيل العملاء المحتملين' },
    bp_studio_preset_support: { en: 'Customer support', ar: 'دعم العملاء' },
    bp_studio_preset_reports: { en: 'Generate reports', ar: 'إنشاء التقارير' },
    bp_studio_preset_meetings: { en: 'Book meetings', ar: 'حجز الاجتماعات' },
    bp_studio_preset_follow_up: { en: 'Follow up with leads', ar: 'متابعة العملاء المحتملين' },
    bp_studio_preset_custom: { en: 'Custom', ar: 'مخصص' },
    bp_studio_chat_title: { en: 'Prompt builder', ar: 'منشئ الطلب' },
    bp_studio_chat_subtitle: { en: 'Short chat-style flow. No page reload.', ar: 'تدفق قصير بأسلوب المحادثة. بدون إعادة تحميل الصفحة.' },
    bp_studio_reset: { en: 'Reset', ar: 'إعادة ضبط' },
    bp_studio_default_followup: { en: 'Pick one preset or type your use case. I will turn it into a concise AI agent blueprint.', ar: 'اختر قالباً أو اكتب حالة الاستخدام الخاصة بك، وسأحوّلها إلى مخطط وكيل ذكي مختصر.' },
    bp_studio_input_label: { en: 'Describe your workflow need', ar: 'صف احتياج سير العمل' },
    bp_studio_input_placeholder: { en: 'Describe business goal, tool stack, and what should happen next.', ar: 'صف هدف العمل والأدوات المستخدمة وما الذي يجب أن يحدث بعد ذلك.' },
    bp_studio_mic_aria: { en: 'Record voice blueprint request', ar: 'سجّل طلب المخطط بالصوت' },
    bp_studio_mic: { en: 'Voice', ar: 'صوت' },
    bp_studio_send_aria: { en: 'Generate blueprint', ar: 'إنشاء المخطط' },
    bp_studio_send: { en: 'Generate Blueprint', ar: 'إنشاء المخطط' },
    bp_studio_status_idle: { en: 'Ready for text or voice input.', ar: 'جاهز للإدخال النصي أو الصوتي.' },
    bp_studio_status_note: { en: 'Mic flow: Listening, Uploading, Transcribing.', ar: 'مسار الميكروفون: استماع ثم رفع ثم نسخ.' },
    bp_studio_preview_kicker: { en: 'Live blueprint preview', ar: 'معاينة المخطط المباشرة' },
    bp_studio_preview_title: { en: 'Result stays inside this section.', ar: 'النتيجة تبقى داخل هذا القسم.' },
    bp_studio_download_html: { en: 'Download HTML', ar: 'تنزيل HTML' },
    bp_studio_download_pdf: { en: 'Download PDF', ar: 'تنزيل PDF' },
    bp_studio_empty_title: { en: 'Blueprint appears here after first request.', ar: 'سيظهر المخطط هنا بعد أول طلب.' },
    bp_studio_empty_desc: { en: 'You will see agent name, business goal, workflow steps, output example, ROI, stack, and export preview.', ar: 'سترى اسم الوكيل وهدف العمل وخطوات سير العمل ومثال المخرجات والعائد والمكدس ومعاينة التصدير.' },
    bp_studio_assistant_label: { en: 'Blueprint Studio', ar: 'Blueprint Studio' },
    bp_studio_user_label: { en: 'You', ar: 'أنت' },
    bp_studio_chat_empty: { en: 'Start with one clear use case and I will shape the output into a compact blueprint card.', ar: 'ابدأ بحالة استخدام واضحة وسأحوّلها إلى بطاقة مخطط مختصرة.' },
    bp_studio_followup_qualify: { en: 'What signals define a qualified lead for you: source, budget, urgency, service, or location?', ar: 'ما الإشارات التي تعني أن العميل المحتمل مؤهل لديك: المصدر أم الميزانية أم السرعة أم الخدمة أم الموقع؟' },
    bp_studio_followup_support: { en: 'Which support issues should be answered automatically, and which ones must escalate to a human?', ar: 'ما مشكلات الدعم التي يجب الرد عليها تلقائياً، وما الحالات التي يجب تصعيدها إلى إنسان؟' },
    bp_studio_followup_reports: { en: 'Which KPIs, tools, and reporting cadence matter most for this reporting flow?', ar: 'ما مؤشرات الأداء والأدوات ودورية التقارير الأهم لهذا التدفق؟' },
    bp_studio_followup_meetings: { en: 'What qualification rules should happen before a meeting gets booked on the calendar?', ar: 'ما قواعد التأهيل التي يجب أن تحدث قبل حجز الاجتماع على التقويم؟' },
    bp_studio_followup_follow_up: { en: 'What should trigger the follow-up: inactivity, missed booking, no reply, or pricing interest?', ar: 'ما الذي يجب أن يطلق المتابعة: عدم النشاط أم فوات الحجز أم عدم الرد أم الاهتمام بالسعر؟' },
    bp_studio_followup_custom: { en: 'What repetitive process do you want this AI agent to own from trigger to outcome?', ar: 'ما العملية المتكررة التي تريد أن يتولاها هذا الوكيل الذكي من المحفز إلى النتيجة؟' },
    bp_studio_typing: { en: 'Generating blueprint', ar: 'جارٍ إنشاء المخطط' },
    bp_studio_result_eyebrow: { en: 'Suggested AI agent', ar: 'وكيل ذكي مقترح' },
    bp_studio_workflow_title: { en: 'Workflow', ar: 'سير العمل' },
    bp_studio_example_title: { en: 'Example output', ar: 'مثال المخرجات' },
    bp_studio_roi_title: { en: 'ROI', ar: 'العائد' },
    bp_studio_stack_title: { en: 'Suggested stack', ar: 'المكدس المقترح' },
    bp_studio_next_step_title: { en: 'Next step', ar: 'الخطوة التالية' },
    bp_studio_fallback_badge: { en: 'Starter fallback', ar: 'نسخة احتياطية أولية' },
    bp_studio_live_badge: { en: 'Live model output', ar: 'مخرجات النموذج المباشرة' },
    bp_studio_result_ready: { en: 'Blueprint ready.', ar: 'المخطط جاهز.' },
    bp_studio_export_label: { en: 'Downloadable AI agent blueprint', ar: 'مخطط وكيل ذكي قابل للتنزيل' },
    bp_studio_export_date: { en: 'Created', ar: 'تاريخ الإنشاء' },
    bp_studio_export_source: { en: 'Source', ar: 'المصدر' },
    bp_studio_status_generating: { en: 'Generating blueprint…', ar: 'جارٍ إنشاء المخطط…' },
    bp_studio_status_fallback: { en: 'Provider slowed down, so a starter blueprint was shown instead.', ar: 'المزوّد تباطأ، لذلك تم عرض مخطط أولي بدلاً من ذلك.' },
    bp_studio_status_ready: { en: 'Blueprint ready for review and download.', ar: 'المخطط جاهز للمراجعة والتنزيل.' },
    bp_studio_status_need_input: { en: 'Add one short description before generating.', ar: 'أضف وصفاً قصيراً قبل الإنشاء.' },
    bp_studio_status_listening: { en: 'Listening…', ar: 'جارٍ الاستماع…' },
    bp_studio_status_uploading: { en: 'Uploading…', ar: 'جارٍ الرفع…' },
    bp_studio_status_transcribing: { en: 'Transcribing…', ar: 'جارٍ النسخ…' },
    bp_studio_status_voice_fallback: { en: 'Voice capture did not finish cleanly. You can still type and continue.', ar: 'لم يكتمل التقاط الصوت بشكل سليم. لا يزال بإمكانك الكتابة والمتابعة.' },
    bp_studio_status_mic_denied: { en: 'Microphone access was denied. Type your request instead.', ar: 'تم رفض الوصول إلى الميكروفون. اكتب طلبك بدلاً من ذلك.' },
    bp_studio_status_backoff: { en: 'Provider asked for brief backoff.', ar: 'طلب المزوّد مهلة قصيرة.' },
    bp_studio_status_export_html: { en: 'HTML blueprint downloaded.', ar: 'تم تنزيل مخطط HTML.' },
    bp_studio_status_export_pdf: { en: 'Preparing PDF export…', ar: 'جارٍ تجهيز تصدير PDF…' },
    bp_studio_status_export_done: { en: 'PDF blueprint downloaded.', ar: 'تم تنزيل مخطط PDF.' },
    bp_studio_status_export_fallback: { en: 'PDF export could not finish right now. HTML export still works.', ar: 'تعذّر إكمال تصدير PDF حالياً. ما زال تصدير HTML يعمل.' },
    bp_studio_assistant_done: { en: 'Blueprint ready. Review the right-side card and export when needed.', ar: 'المخطط جاهز. راجع البطاقة في الجهة اليمنى وقم بالتصدير عند الحاجة.' },
    bp_studio_assistant_fallback: { en: 'Provider was busy, so I showed a starter blueprint you can still present and refine.', ar: 'كان المزوّد مشغولاً، لذلك عرضت مخططاً أولياً يمكنك تقديمه وتنقيحه.' },
    bp_studio_voice_soft_fail: { en: 'Voice path hit friction. You can still type the request and keep going.', ar: 'واجه المسار الصوتي بعض التعثر. يمكنك كتابة الطلب ومتابعة العمل.' },
    bp_studio_fallback_message: { en: 'Starter blueprint shown.', ar: 'تم عرض مخطط أولي.' },

    /* ────────── AI AGENT TRIAL: CHAT WIDGET ────────── */
    chat_empty_title: { en: 'Ask about your operations', ar: 'اسأل عن عملياتك' },
    chat_empty_desc: { en: 'Type, record, or upload audio. Switch to image creation when you need a visual.', ar: 'اكتب أو سجّل أو ارفع ملفاً صوتياً. ويمكنك التبديل إلى إنشاء صورة عند الحاجة.' },
    chat_placeholder: { en: 'Ask about leads, follow-up, support, or operations…', ar: 'اسأل عن العملاء أو المتابعة أو الدعم أو العمليات…' },
    chat_prompt_1: { en: 'Where can AI save the most time in my business?', ar: 'أين يمكن للذكاء الاصطناعي أن يوفر أكبر وقت في عملي؟' },
    chat_prompt_2: { en: 'Show me a better lead follow-up flow', ar: 'اعرض لي أسلوباً أفضل لمتابعة العملاء المحتملين' },
    chat_prompt_3: { en: 'What can an AI agent handle for a gym?', ar: 'ما الذي يمكن لوكيل ذكي أن يديره لصالة رياضية؟' },
    chat_prompt_4: { en: 'How would GRINDCTRL reduce admin work here?', ar: 'كيف يمكن لـ GRINDCTRL تقليل العمل الإداري هنا؟' },
    chat_turns_remaining: { en: ' turns remaining', ar: ' محاولات متبقية' },
    chat_turns_left: { en: 'left', ar: 'متبقي' },
    chat_today_left: { en: 'today', ar: 'اليوم' },
    chat_trial_agent: { en: 'Trial Playground', ar: 'ساحة التجربة' },
    chat_mode_chat: { en: 'Chat', ar: 'محادثة' },
    chat_limit_title: { en: 'Keep going with a free account', ar: 'تابع مع حساب مجاني' },
    chat_limit_desc: { en: 'Your guest turns are used up. Sign in to keep this same chat going with a bigger free quota.', ar: 'انتهت محاولات الضيف. سجّل الدخول لتكمل نفس المحادثة مع رصيد مجاني أكبر.' },
    chat_limit_cta1: { en: 'Continue with Google', ar: 'المتابعة عبر Google' },
    chat_limit_cta2: { en: 'Continue with Email', ar: 'المتابعة عبر البريد الإلكتروني' },
    chat_limit_cta3: { en: 'See the 2-Min Tour', ar: 'شاهد الجولة خلال دقيقتين' },
    chat_limit_fine: { en: 'Same chat · More free turns · No reset ✨', ar: 'نفس المحادثة · محاولات مجانية أكثر · بدون إعادة ✨' },
    chat_error_msg: { en: 'Something went wrong. Please try again.', ar: 'حدث خطأ. حاول مرة أخرى.' },
    chat_retry: { en: 'Retry', ar: 'إعادة المحاولة' },
    chat_recording: { en: 'Recording...', ar: 'جارٍ التسجيل...' },
    chat_cancel: { en: 'Cancel', ar: 'إلغاء' },
    chat_transcribing: { en: 'Transcribing...', ar: 'جارٍ النسخ...' },
    chat_drop_audio: { en: 'Drop audio file here', ar: 'أفلت ملف الصوت هنا' },
    chat_open_label: { en: 'Open GRINDCTRL assistant', ar: 'فتح مساعد GRINDCTRL' },
    chat_trigger_label: { en: 'Ask GRINDCTRL', ar: 'اسأل GRINDCTRL' },
    chat_close_label: { en: 'Close chat', ar: 'إغلاق المحادثة' },
    chat_send_label: { en: 'Send message', ar: 'إرسال الرسالة' },
    chat_mic_label: { en: 'Record voice message', ar: 'تسجيل رسالة صوتية' },
    chat_attach_label: { en: 'Upload audio', ar: 'رفع ملف صوتي' },
    chat_voice: { en: 'Voice message', ar: 'رسالة صوتية' },
    chat_voice_reply: { en: 'Voice reply', ar: 'رد صوتي' },
    chat_voice_preview_setting: { en: 'Reply with voice', ar: 'الرد بالصوت' },
    chat_playground_subtitle: { en: 'Ask a workflow question. Type, speak, or hear the reply.', ar: 'اسأل عن سير عملك. اكتب أو تحدّث أو استمع للرد.' },
    chat_prompt_label: { en: 'Try one of these', ar: 'جرّب أحد هذه الأسئلة' },
    chat_stage_label: { en: 'Live Playground', ar: 'ساحة التجربة المباشرة' },
    chat_stage_hint_idle: { en: 'Your replies appear here as you explore.', ar: 'ستظهر الردود هنا أثناء الاستكشاف.' },
    chat_stage_hint_active: { en: 'Same session. Same context. Keep going.', ar: 'نفس الجلسة. نفس السياق. واصل المتابعة.' },
    chat_stage_empty_title: { en: 'Start with one focused operations question', ar: 'ابدأ بسؤال واحد واضح عن عملياتك' },
    chat_stage_empty_desc: { en: 'Ask about lead handling, follow-up, support, or admin bottlenecks and get a concise reply here.', ar: 'اسأل عن إدارة العملاء أو المتابعة أو الدعم أو الاختناقات الإدارية واحصل على رد مختصر هنا.' },
    chat_cap_ask: { en: 'Ask', ar: 'اسأل' },
    chat_cap_speak: { en: 'Speak', ar: 'تحدث' },
    chat_cap_hear: { en: 'Hear', ar: 'استمع' },
    chat_hear_next: { en: 'Hear next reply', ar: 'استمع للرد التالي' },
    chat_hear_on: { en: 'On for next reply', ar: 'مفعّلة للرد التالي' },
    chat_hear_off: { en: 'Text only', ar: 'نص فقط' },
    chat_hear_unavailable: { en: 'Voice preview unavailable', ar: 'المعاينة الصوتية غير متاحة' },
    chat_audio_hint: { en: 'Voice note up to 30 seconds', ar: 'ملاحظة صوتية حتى ٣٠ ثانية' },
    chat_reply_language: { en: 'Reply language', ar: 'لغة الرد' },
    chat_lang_en: { en: 'English', ar: 'English' },
    chat_lang_ar: { en: 'العربية', ar: 'العربية' },
    chat_play_reply: { en: 'Play reply', ar: 'تشغيل الرد' },
    chat_pause_reply: { en: 'Pause reply', ar: 'إيقاف الرد' },
    chat_transcript_label: { en: 'Transcript', ar: 'النص' },
    chat_transcript_pending: { en: 'Transcribing...', ar: 'جارٍ النسخ...' },
    chat_warning_turn_title: { en: '1 guest turn left', ar: 'تبقّت محاولة ضيف واحدة' },
    chat_warning_voice_title: { en: '1 voice preview left', ar: 'تبقّت معاينة صوتية واحدة' },
    chat_warning_desc: { en: 'Use your last guest turn now, or sign in to unlock more free turns in this same chat.', ar: 'استخدم آخر محاولة ضيف الآن، أو سجّل الدخول لتحصل على محاولات مجانية أكثر في نفس المحادثة.' },
    chat_warning_voice_desc: { en: 'Text replies stay on. You still have one spoken preview left.', ar: 'الردود النصية مستمرة. وما زالت لديك معاينة صوتية واحدة.' },
    chat_warning_voice_unavailable_title: { en: 'Voice preview unavailable', ar: 'المعاينة الصوتية غير متاحة' },
    chat_warning_voice_session_desc: { en: 'This session has used its voice preview. Text replies are still available.', ar: 'استخدمت هذه الجلسة معاينتها الصوتية. الردود النصية ما زالت متاحة.' },
    chat_warning_voice_day_desc: { en: 'Today’s voice previews are used up. Text replies are still available.', ar: 'انتهت المعاينات الصوتية لليوم. الردود النصية ما زالت متاحة.' },
    chat_cta_continue: { en: 'Keep Exploring', ar: 'تابع الاستكشاف' },
    chat_cta_final_turn: { en: 'Use Last Guest Turn', ar: 'استخدم آخر محاولة ضيف' },
    chat_cta_tour: { en: 'See the 2-Min Tour', ar: 'شاهد الجولة خلال دقيقتين' },
    chat_cta_book: { en: 'Book a Call', ar: 'احجز مكالمة' },
    chat_cta_tell: { en: 'Tell Us About Your Business', ar: 'أخبرنا عن أعمالك' },
    chat_rate_limited: { en: 'Please wait a moment, then try again.', ar: 'انتظر قليلاً ثم حاول مرة أخرى.' },
    chat_active_conflict: { en: 'This browser already has another active guest chat.', ar: 'يوجد بالفعل دردشة ضيف أخرى نشطة في هذا المتصفح.' },
    chat_mic_denied: { en: 'Microphone access was denied.', ar: 'تم رفض الوصول إلى الميكروفون.' },
    chat_audio_too_large: { en: 'Audio file is too large. Maximum size is 2 MB.', ar: 'ملف الصوت كبير جداً. الحد الأقصى ٢ ميجابايت.' },
    chat_audio_invalid: { en: 'Please choose a supported audio file.', ar: 'يرجى اختيار ملف صوتي مدعوم.' },
    chat_recording_limit: { en: 'Maximum recording length reached.', ar: 'تم الوصول إلى الحد الأقصى لمدة التسجيل.' },
    chat_transcribing_status: { en: 'Turning your voice note into text…', ar: 'جارٍ تحويل الملاحظة الصوتية إلى نص…' },
    chat_generating_status: { en: 'Writing the reply…', ar: 'جارٍ كتابة الرد…' },
    chat_try_voice_preview: { en: 'Turn on Hear to get a spoken preview with the next reply.', ar: 'فعّل الاستماع لتحصل على معاينة صوتية مع الرد التالي.' },
    chat_loading_history: { en: 'Loading this conversation…', ar: 'جارٍ تحميل هذه المحادثة…' },
    chat_auth_title_soft: { en: 'Want more free turns?', ar: 'هل تريد محاولات مجانية أكثر؟' },
    chat_auth_desc_soft: { en: 'Sign in without leaving this chat. Your conversation stays here and your free quota gets bigger.', ar: 'سجّل الدخول من داخل هذه المحادثة. محادثتك تبقى كما هي ورصيدك المجاني يصبح أكبر.' },
    chat_auth_title_limit: { en: 'Guest limit reached. Keep this chat going.', ar: 'انتهى حد الضيف. تابع نفس المحادثة.' },
    chat_auth_desc_limit: { en: 'Sign in to unlock a larger free quota. Your current session and chat history stay with you.', ar: 'سجّل الدخول للحصول على رصيد مجاني أكبر. جلستك الحالية وسجل المحادثة سيبقيان معك.' },
    chat_auth_google: { en: 'Continue with Google', ar: 'المتابعة عبر Google' },
    chat_auth_email: { en: 'Continue with Email', ar: 'المتابعة عبر البريد الإلكتروني' },
    chat_auth_connecting: { en: 'Signing you in...', ar: 'جارٍ تسجيل دخولك...' },
    chat_auth_sending: { en: 'Sending your sign-in email...', ar: 'جارٍ إرسال بريد تسجيل الدخول...' },
    chat_auth_verifying: { en: 'Verifying your code...', ar: 'جارٍ التحقق من الرمز...' },
    chat_auth_email_label: { en: 'Work email', ar: 'البريد الإلكتروني للعمل' },
    chat_auth_email_placeholder: { en: 'name@company.com', ar: 'name@company.com' },
    chat_auth_code_label: { en: 'Email code', ar: 'رمز البريد' },
    chat_auth_code_placeholder: { en: '6-digit code', ar: 'رمز من 6 أرقام' },
    chat_auth_send: { en: 'Send link', ar: 'إرسال الرابط' },
    chat_auth_verify: { en: 'Verify code', ar: 'تأكيد الرمز' },
    chat_auth_magic_note: { en: 'We’ll send a secure sign-in link. If your email shows a code, you can enter it here too.', ar: 'سنرسل رابط تسجيل دخول آمن. وإذا ظهر رمز في البريد، يمكنك إدخاله هنا أيضاً.' },
    chat_auth_check_email: { en: 'Check your email. Once you sign in, this same playground will unlock more free turns.', ar: 'افتح بريدك الإلكتروني. بمجرد تسجيل الدخول ستفتح هذه الساحة نفسها محاولات مجانية أكثر.' },
    chat_auth_success_title: { en: 'You’re in. Your chat is still here.', ar: 'تم تسجيل الدخول. محادثتك ما زالت هنا.' },
    chat_auth_success_desc: { en: 'You can keep going in this same playground with your larger free quota.', ar: 'يمكنك المتابعة في نفس الساحة مع رصيدك المجاني الأكبر.' },
    chat_auth_secure_note: { en: 'No reset. No extra steps. Same conversation.', ar: 'بدون إعادة. بدون خطوات إضافية. نفس المحادثة.' },
    chat_auth_guest_mode: { en: 'Guest mode', ar: 'وضع الضيف' },
    chat_auth_member_mode: { en: 'Signed in', ar: 'تم تسجيل الدخول' },
    chat_auth_upgrade_failed: { en: 'We signed you in, but could not refresh the trial session yet. Try again once.', ar: 'تم تسجيل الدخول، لكن تعذّر تحديث جلسة التجربة حالياً. حاول مرة أخرى.' },
    chat_auth_send_failed: { en: 'Could not send the email right now. Please try again.', ar: 'تعذّر إرسال البريد الآن. حاول مرة أخرى.' },
    chat_auth_verify_failed: { en: 'That code did not work. Please try again.', ar: 'هذا الرمز غير صحيح. حاول مرة أخرى.' },
    chat_auth_email_invalid: { en: 'Enter a valid email address.', ar: 'أدخل بريداً إلكترونياً صالحاً.' },

    /* ────────── IMAGE GENERATION ────────── */
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
    chat_exit_create: { en: 'Back to chat', ar: 'العودة للمحادثة' },
  };

  // ── Expose globally for optional external use ──
  window.__i18n = T;

  var currentLang = 'en';

  function setLanguage(lang) {
    currentLang = lang;
    var dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);

    // textContent
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (T[key] && T[key][lang] != null) el.textContent = T[key][lang];
    });

    // innerHTML (for strings containing <br/>, <span>, etc.)
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (T[key] && T[key][lang] != null) el.innerHTML = T[key][lang];
    });

    // placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (T[key] && T[key][lang] != null) el.placeholder = T[key][lang];
    });

    // aria-label
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      if (T[key] && T[key][lang] != null) el.setAttribute('aria-label', T[key][lang]);
    });

    // Update the language toggle button
    var langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      var span = langBtn.querySelector('span');
      if (span) span.textContent = lang === 'ar' ? 'EN' : 'عر';
    }

    // Persist
    try { localStorage.setItem('grindctrl-lang', lang); } catch (e) { }
  }

  // ── Toggle ──
  var langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    langBtn.addEventListener('click', function () {
      setLanguage(currentLang === 'en' ? 'ar' : 'en');
    });
  }

  // ── Restore saved preference ──
  try {
    var saved = localStorage.getItem('grindctrl-lang');
    if (saved === 'ar') setLanguage('ar');
  } catch (e) { }

  window.setLanguage = setLanguage;
})();
