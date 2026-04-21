import { initClerk } from './clerk.js';

function isArabic() {
  return (document.documentElement.getAttribute('lang') || 'en').toLowerCase().indexOf('ar') === 0;
}

function t(en, ar) {
  return isArabic() ? ar : en;
}

function chevronIcon() {
  var path = isArabic() ? '/icons/chevron-start.svg' : '/icons/chevron-end.svg';
  return '<span class="gc-svg-icon" aria-hidden="true"><img src="' + path + '" alt=""/></span>';
}

function renderSignedOut(navContainer, drawerContainer) {
  if (navContainer) {
    navContainer.innerHTML = [
      '<a href="/sign-in.html" class="gc-auth-link">',
      '  <span class="material-symbols-outlined gc-icon gc-icon--md">login</span>',
      '  <span>' + t('Sign in', 'تسجيل الدخول') + '</span>',
      '</a>',
      '<a href="/sign-up.html" class="gc-auth-cta">',
      '  ' + chevronIcon(),
      '  <span>' + t('Get started', 'ابدأ الآن') + '</span>',
      '</a>',
    ].join('');
  }

  if (drawerContainer) {
    drawerContainer.innerHTML = [
      '<a href="/sign-in.html" class="drawer-link">',
      '  <span class="material-symbols-outlined gc-icon gc-icon--xl">login</span>',
      '  <span>' + t('Sign in', 'تسجيل الدخول') + '</span>',
      '</a>',
      '<a href="/sign-up.html" class="gc-auth-cta gc-auth-drawer-cta">',
      '  ' + chevronIcon(),
      '  <span>' + t('Get started', 'ابدأ الآن') + '</span>',
      '</a>',
    ].join('');
  }
}

function renderSignedIn(clerk, navContainer, drawerContainer) {
  if (navContainer) {
    navContainer.innerHTML = [
      '<a href="/app.html" class="gc-auth-cta gc-auth-cta--dashboard">',
      '  <span class="material-symbols-outlined gc-icon gc-icon--md">dashboard</span>',
      '  <span>' + t('Dashboard', 'لوحة التحكم') + '</span>',
      '</a>',
      '<div id="gc-user-button"></div>',
    ].join('');

    var userBtnContainer = document.getElementById('gc-user-button');
    if (userBtnContainer) clerk.mountUserButton(userBtnContainer);
  }

  if (drawerContainer) {
    drawerContainer.innerHTML = [
      '<a href="/app.html" class="drawer-link">',
      '  <span class="material-symbols-outlined gc-icon gc-icon--xl">dashboard</span>',
      '  <span>' + t('Dashboard', 'لوحة التحكم') + '</span>',
      '</a>',
      '<a href="/app.html" class="drawer-link">',
      '  <span class="material-symbols-outlined gc-icon gc-icon--xl">manage_accounts</span>',
      '  <span>' + t('Account settings', 'إعدادات الحساب') + '</span>',
      '</a>',
    ].join('');
  }
}

async function renderAuthHeader() {
  var navContainer = document.getElementById('gc-auth-nav');
  var drawerContainer = document.getElementById('gc-auth-drawer');
  if (!navContainer && !drawerContainer) return;

  var clerk = await initClerk();
  if (!clerk || !clerk.isSignedIn) {
    renderSignedOut(navContainer, drawerContainer);
    return;
  }

  renderSignedIn(clerk, navContainer, drawerContainer);
}

await renderAuthHeader();

var htmlObserver = new MutationObserver(function (changes) {
  for (var i = 0; i < changes.length; i += 1) {
    if (changes[i].attributeName === 'lang') {
      renderAuthHeader();
      break;
    }
  }
});

htmlObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['lang'],
});
