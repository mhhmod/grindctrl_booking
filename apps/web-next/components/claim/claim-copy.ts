/* Copy for the /claim outcome page (app/claim/page.tsx), EN and AR. */
export const CLAIM_COPY = {
  en: {
    successTitle: "You're connected",
    successBody: 'Open Store setup to turn on Store Chat and Try-On and check what shoppers will see. Then open a product page on your store to check the chat and Try-On button.',
    goToDashboard: 'Go to dashboard',
    expiredTitle: 'This link has expired',
    expiredBody: 'Reopen GRINDCTRL from your Shopify admin and choose "Claim this store" again.',
    takenTitle: 'This store is already connected',
    // No disconnect/unclaim path exists anywhere in the app (shopProfileId
    // is only ever written, never reverted — see shop-tenancy.ts) —
    // "disconnect it there" would send a locked-out merchant looking for a
    // button that does not exist. Point at support instead.
    takenBody: "It's already connected to another GRINDCTRL account. Contact support if that doesn't sound right.",
    ownerTitle: "We couldn't verify you're the store owner",
    ownerBody: "This store's Shopify contact email doesn't match your GRINDCTRL account. Contact support if you believe this is your store, or connect it yourself with a one-time code.",
    // The account that is signed in, so "doesn't match" names what it compared.
    ownerBodySignedInAs: (email: string) =>
      `You're signed in as ${email}, which doesn't match this store's Shopify contact email. Sign in with the account that uses that email, or connect the store yourself with a one-time code. Contact support if you believe this is your store.`,
    switchAccount: 'Use a different account',
    // Distinct from ownerBody: this is what a freshly-installed store looks
    // like for the first ~10-20 seconds, before the store's Shopify token
    // finishes being stored — not necessarily a real mismatch.
    notReadyTitle: "Still connecting your store",
    notReadyBody: "This can take a few seconds right after installing the app. Try the link again, or connect your store yourself with a one-time code.",
    tryAgain: 'Try again',
    connectManually: 'Connect with a code instead',
    contactSupport: 'Contact support',
  },
  ar: {
    successTitle: 'متجرك متصل الآن',
    successBody: 'افتح إعداد المتجر لتشغيل محادثة المتجر والقياس الافتراضي ومعرفة ما سيظهر للمتسوقين. ثم افتح صفحة منتج في متجرك للتحقق من المحادثة وزر القياس.',
    goToDashboard: 'الانتقال إلى لوحة التحكم',
    expiredTitle: 'انتهت صلاحية هذا الرابط',
    expiredBody: 'أعد فتح GRINDCTRL من لوحة تحكم Shopify واختر "المطالبة بهذا المتجر" مرة أخرى.',
    takenTitle: 'هذا المتجر متصل بالفعل',
    takenBody: 'هذا المتجر متصل بالفعل بحساب GRINDCTRL آخر. تواصل مع الدعم إذا لم يكن ذلك صحيحاً.',
    ownerTitle: 'لم نتمكن من التحقق من أنك مالك المتجر',
    ownerBody: 'البريد الإلكتروني للتواصل في Shopify لهذا المتجر لا يطابق حسابك في GRINDCTRL. تواصل مع الدعم إذا كنت تعتقد أن هذا متجرك، أو اربطه بنفسك برمز لمرة واحدة.',
    // The address is Latin: isolate it so it keeps its own direction.
    ownerBodySignedInAs: (email: string) =>
      `أنت مسجّل الدخول بالبريد ⁨${email}⁩، وهو لا يطابق البريد الإلكتروني للتواصل في Shopify لهذا المتجر. سجّل الدخول بالحساب الذي يستخدم ذلك البريد، أو اربط المتجر بنفسك برمز لمرة واحدة. تواصل مع الدعم إذا كنت تعتقد أن هذا متجرك.`,
    switchAccount: 'استخدم حسابًا آخر',
    notReadyTitle: 'جارٍ ربط متجرك',
    notReadyBody: 'قد يستغرق هذا بضع ثوانٍ بعد تثبيت التطبيق مباشرة. أعد المحاولة، أو اربط متجرك بنفسك برمز لمرة واحدة.',
    tryAgain: 'أعد المحاولة',
    connectManually: 'الربط برمز بدلاً من ذلك',
    contactSupport: 'تواصل مع الدعم',
  },
} as const;
