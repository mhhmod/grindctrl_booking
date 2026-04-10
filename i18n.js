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
    hero_badge: { en: 'Systems for the Intelligent Enterprise', ar: 'أنظمة للمؤسسات الذكية' },
    hero_title: { en: 'Take Control of<br class="hidden sm:block"/> Business Operations<br class="hidden md:block"/> with AI', ar: 'تحكّم بعمليات<br class="hidden sm:block"/> أعمالك<br class="hidden md:block"/> بالذكاء الاصطناعي' },
    hero_subtitle: { en: 'We build AI automations, AI agents, and modern business systems that help you operate with more clarity, speed, and control.', ar: 'نبني أنظمة أتمتة بالذكاء الاصطناعي ووكلاء ذكيين وأنظمة أعمال حديثة تساعدك على العمل بوضوح وسرعة وتحكم أكبر.' },
    hero_cta_primary: { en: 'See the 2-Min Workflow Tour', ar: 'شاهد جولة سير العمل في دقيقتين' },
    hero_cta_secondary: { en: 'Book a Strategy Call', ar: 'احجز مكالمة استراتيجية' },
    hero_proof_1: { en: 'Trusted by 40+ operators', ar: 'موثوق من ٤٠+ شركة' },
    hero_proof_2: { en: 'Avg 22 hrs/week saved', ar: 'توفير ٢٢ ساعة/أسبوع' },
    hero_proof_3: { en: 'Go live in under 14 days', ar: 'انطلق خلال أقل من ١٤ يوم' },

    /* ────────── HOME: CORE SOLUTIONS ────────── */
    core_title: { en: 'Core Solutions', ar: 'الحلول الأساسية' },
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
    proof_title: { en: 'See It In Action', ar: 'شاهده يعمل' },
    proof_subtitle: { en: "Not mockups — real interfaces from production systems we've built for clients.", ar: 'ليست تصاميم — واجهات حقيقية من أنظمة بنيناها لعملائنا.' },
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
    roi_title: { en: 'What Changes After Week 1', ar: 'ما الذي يتغيّر بعد الأسبوع الأول' },
    roi_hrs_label: { en: 'Hours saved per week', ar: 'ساعات تُوفَّر أسبوعياً' },
    roi_hrs_desc: { en: 'Manual data entry, follow-ups, and reporting — automated.', ar: 'إدخال البيانات والمتابعات والتقارير — مؤتمتة بالكامل.' },
    roi_response_label: { en: 'Average response time', ar: 'متوسط وقت الاستجابة' },
    roi_response_desc: { en: 'Your AI agent handles leads 24/7 — even at 3 AM.', ar: 'وكيلك الذكي يتعامل مع العملاء ٢٤/٧ — حتى الساعة ٣ صباحاً.' },
    roi_live_label: { en: 'Time to first workflow live', ar: 'الوقت لإطلاق أول سير عمل' },
    roi_live_desc: { en: 'From kickoff call to production automation.', ar: 'من مكالمة الانطلاق إلى الأتمتة الفعلية.' },
    roi_callout: { en: 'Our average client reclaims the equivalent of <strong class="text-on-surface">a full-time hire within 90 days</strong>.', ar: 'عميلنا المتوسط يستعيد ما يعادل <strong class="text-on-surface">موظف بدوام كامل خلال ٩٠ يوماً</strong>.' },

    /* ────────── HOME: TRUST CENTER ────────── */
    trust_title: { en: 'Built for Business-Critical Operations', ar: 'مبنية للعمليات الحرجة' },
    trust_subtitle: { en: 'Enterprise-grade security and transparency. No black boxes.', ar: 'أمان وشفافية بمستوى المؤسسات. بدون صناديق سوداء.' },
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
    cta_title: { en: 'Ready to Reclaim 22+ Hours Every Week?', ar: 'مستعد لاستعادة ٢٢+ ساعة كل أسبوع؟' },
    cta_subtitle: { en: 'Schedule your free strategy call and discover how our AI systems can transform your operations.', ar: 'حدد موعد مكالمتك الاستراتيجية المجانية واكتشف كيف تحوّل أنظمتنا الذكية عملياتك.' },
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

    /* ────────── AI AGENT TRIAL: CHAT WIDGET ────────── */
    chat_empty_title: { en: 'GRINDCTRL Trial Playground', ar: 'ساحة تجربة GRINDCTRL' },
    chat_empty_desc: { en: 'Preview how AI can answer, listen, and speak back without leaving the page.', ar: 'جرّب كيف يمكن للذكاء الاصطناعي أن يجيب ويستمع ويرد صوتياً بدون مغادرة الصفحة.' },
    chat_placeholder: { en: 'Ask about your workflow, follow-up, support, or operations...', ar: 'اسأل عن سير العمل أو المتابعة أو الدعم أو العمليات...' },
    chat_prompt_1: { en: 'Where can AI save time in a service business?', ar: 'أين يمكن للذكاء الاصطناعي أن يوفّر الوقت في نشاط خدمي؟' },
    chat_prompt_2: { en: 'Show me a lead follow-up workflow', ar: 'اعرض لي سير عمل لمتابعة العملاء المحتملين' },
    chat_prompt_3: { en: 'What would an AI agent handle for a gym?', ar: 'ما الذي يمكن لوكيل ذكي أن يديره لصالة رياضية؟' },
    chat_prompt_4: { en: 'How would GRINDCTRL reduce admin work?', ar: 'كيف يمكن لـ GRINDCTRL تقليل الأعمال الإدارية؟' },
    chat_turns_remaining: { en: ' turns remaining', ar: ' محاولات متبقية' },
    chat_turns_left: { en: 'left', ar: 'متبقي' },
    chat_today_left: { en: 'today', ar: 'اليوم' },
    chat_trial_agent: { en: 'Trial Agent', ar: 'الوكيل التجريبي' },
    chat_limit_title: { en: "You've reached the free trial limit", ar: 'لقد وصلت إلى حد التجربة المجانية' },
    chat_limit_desc: { en: 'You can keep testing, or jump to the 2-Min Workflow Tour.', ar: 'يمكنك متابعة الاستكشاف أو الانتقال إلى جولة سير العمل خلال دقيقتين.' },
    chat_limit_cta1: { en: 'See the 2-Min Workflow Tour', ar: 'شاهد جولة سير العمل خلال دقيقتين' },
    chat_limit_cta2: { en: 'Book a Strategy Call', ar: 'احجز مكالمة استراتيجية' },
    chat_limit_cta3: { en: 'Tell Us About Your Business', ar: 'أخبرنا عن أعمالك' },
    chat_limit_fine: { en: 'Free 30-min session · No obligation · Confidential', ar: 'جلسة مجانية ٣٠ دقيقة · بدون التزام · سري' },
    chat_error_msg: { en: 'Something went wrong. Please try again.', ar: 'حدث خطأ. يرجى المحاولة مرة أخرى.' },
    chat_retry: { en: 'Retry', ar: 'إعادة المحاولة' },
    chat_recording: { en: 'Recording...', ar: 'جارٍ التسجيل...' },
    chat_cancel: { en: 'Cancel', ar: 'إلغاء' },
    chat_transcribing: { en: 'Transcribing...', ar: 'جارٍ النسخ...' },
    chat_drop_audio: { en: 'Drop audio file here', ar: 'أفلت ملف الصوت هنا' },
    chat_open_label: { en: 'Open AI Agent Trial', ar: 'فتح تجربة الوكيل الذكي' },
    chat_close_label: { en: 'Close chat', ar: 'إغلاق المحادثة' },
    chat_send_label: { en: 'Send message', ar: 'إرسال الرسالة' },
    chat_mic_label: { en: 'Record voice message', ar: 'تسجيل رسالة صوتية' },
    chat_attach_label: { en: 'Attach audio file', ar: 'إرفاق ملف صوتي' },
    chat_voice: { en: 'Voice message', ar: 'رسالة صوتية' },
    chat_voice_reply: { en: 'Voice reply', ar: 'رد صوتي' },
    chat_voice_preview_setting: { en: 'Voice preview', ar: 'المعاينة الصوتية' },
    chat_playground_subtitle: { en: 'Ask, speak, and hear how the system responds.', ar: 'اسأل وتحدث واستمع لكيفية استجابة النظام.' },
    chat_prompt_label: { en: 'Suggested prompts', ar: 'اقتراحات سريعة' },
    chat_cap_ask: { en: 'Ask', ar: 'اسأل' },
    chat_cap_speak: { en: 'Speak', ar: 'تحدث' },
    chat_cap_hear: { en: 'Hear', ar: 'استمع' },
    chat_hear_next: { en: 'Hear next reply', ar: 'استمع للرد التالي' },
    chat_hear_on: { en: 'On for next reply', ar: 'مفعّلة للرد التالي' },
    chat_hear_off: { en: 'Text only', ar: 'نص فقط' },
    chat_hear_unavailable: { en: 'Voice preview unavailable', ar: 'المعاينة الصوتية غير متاحة' },
    chat_audio_hint: { en: 'Voice input up to 30s', ar: 'إدخال صوتي حتى ٣٠ ثانية' },
    chat_reply_language: { en: 'Reply language', ar: 'لغة الرد' },
    chat_lang_en: { en: 'English', ar: 'English' },
    chat_lang_ar: { en: 'العربية', ar: 'العربية' },
    chat_play_reply: { en: 'Play reply', ar: 'تشغيل الرد' },
    chat_pause_reply: { en: 'Pause reply', ar: 'إيقاف الرد' },
    chat_transcript_label: { en: 'Transcript', ar: 'النص' },
    chat_transcript_pending: { en: 'Transcribing...', ar: 'جارٍ النسخ...' },
    chat_warning_turn_title: { en: '1 free turn left', ar: 'تبقّت محاولة مجانية واحدة' },
    chat_warning_voice_title: { en: '1 voice preview left', ar: 'تبقّت معاينة صوتية واحدة' },
    chat_warning_desc: { en: 'You can keep testing, or jump to the 2-Min Workflow Tour.', ar: 'يمكنك متابعة الاستكشاف أو الانتقال إلى جولة سير العمل خلال دقيقتين.' },
    chat_warning_voice_desc: { en: 'Text replies continue, and you can still preview one more spoken answer.', ar: 'الردود النصية مستمرة، ولا يزال بإمكانك معاينة رد صوتي واحد إضافي.' },
    chat_warning_voice_unavailable_title: { en: 'Voice preview unavailable', ar: 'المعاينة الصوتية غير متاحة' },
    chat_warning_voice_session_desc: { en: 'This session has already used its voice preview. Text replies continue.', ar: 'استخدمت هذه الجلسة المعاينة الصوتية بالفعل. الردود النصية مستمرة.' },
    chat_warning_voice_day_desc: { en: 'Today’s voice previews are used up. Text replies continue.', ar: 'تم استهلاك المعاينات الصوتية لليوم. الردود النصية مستمرة.' },
    chat_cta_continue: { en: 'Continue Trial', ar: 'تابع التجربة' },
    chat_cta_final_turn: { en: 'Use Final Free Turn', ar: 'استخدم المحاولة المجانية الأخيرة' },
    chat_cta_tour: { en: 'See the 2-Min Workflow Tour', ar: 'شاهد جولة سير العمل خلال دقيقتين' },
    chat_cta_book: { en: 'Book a Strategy Call', ar: 'احجز مكالمة استراتيجية' },
    chat_cta_tell: { en: 'Tell Us About Your Business', ar: 'أخبرنا عن أعمالك' },
    chat_rate_limited: { en: 'Please wait a moment and try again.', ar: 'يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.' },
    chat_active_conflict: { en: 'Another conversation is already active for this browser.', ar: 'هناك محادثة أخرى نشطة بالفعل لهذا المتصفح.' },
    chat_mic_denied: { en: 'Microphone access was denied.', ar: 'تم رفض الوصول إلى الميكروفون.' },
    chat_audio_too_large: { en: 'Audio file is too large. Maximum is 2 MB.', ar: 'ملف الصوت كبير جداً. الحد الأقصى ٢ ميجابايت.' },
    chat_audio_invalid: { en: 'Please select an audio file.', ar: 'يرجى اختيار ملف صوتي.' },
    chat_recording_limit: { en: 'Maximum recording length reached.', ar: 'تم الوصول إلى الحد الأقصى لمدة التسجيل.' },
    chat_transcribing_status: { en: 'Transcribing voice note...', ar: 'جارٍ نسخ الملاحظة الصوتية...' },
    chat_generating_status: { en: 'Generating response...', ar: 'جارٍ توليد الرد...' },
    chat_try_voice_preview: { en: 'Turn on Hear to get a voice preview with the next reply.', ar: 'فعّل الاستماع للحصول على معاينة صوتية مع الرد التالي.' },
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
