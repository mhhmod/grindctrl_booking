import { initClerk } from './clerk.js';

const clerk = await initClerk();

const GRINDCTRL_APPEARANCE = {
  layout: {
    logoPlacement: 'none',
    socialButtonsPlacement: 'bottom',
    socialButtonsVariant: 'blockButton',
    showOptionalFields: false,
  },
  variables: {
    colorPrimary: '#f8f7f4',
    colorPrimaryForeground: '#0a0a09',
    colorBackground: '#161514',
    colorBackgroundHover: '#1c1b1a',
    colorInputBackground: '#0a0a09',
    colorInputForeground: '#f8f7f4',
    colorInputPlaceholder: '#9b9793',
    colorInputBorder: '#3b3835',
    colorInputBorderHover: '#d1cec9',
    colorInputBorderFocus: '#f8f7f4',
    colorInputBorderRadius: '0.75rem',
    colorInputShadow: '0 0 0 3px rgba(248,247,244,0.1)',
    colorTextPrimary: '#f8f7f4',
    colorTextSecondary: '#9b9793',
    colorTextTertiary: '#6b6763',
    colorDanger: '#d4736e',
    colorSuccess: '#66bb6a',
    colorWarning: '#ffa726',
    colorBackgroundAlpha: '#3b3835',
    borderRadius: '0.75rem',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSize: '15px',
    spacing: '0.75rem',
  },
  elements: {
    rootBox: {
      boxShadow: 'none',
      border: 'none',
    },
    cardBox: {
      boxShadow: 'none',
      border: 'none',
      backgroundColor: 'transparent',
      padding: '0',
    },
    card: {
      boxShadow: 'none',
      border: 'none',
      backgroundColor: 'transparent',
    },
    main: {
      backgroundColor: 'transparent',
    },
    formButtonPrimary: {
      backgroundColor: '#f8f7f4',
      color: '#0a0a09',
      borderRadius: '0.75rem',
      fontWeight: 600,
      fontSize: '15px',
      letterSpacing: '0.02em',
      boxShadow: '0 8px 24px -8px rgba(0,0,0,0.3)',
      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      '&:hover': {
        backgroundColor: '#d1cec9',
      },
      '&:active': {
        transform: 'scale(0.98)',
      },
    },
    formFieldInput: {
      borderRadius: '0.75rem',
      border: '1px solid #3b3835',
      backgroundColor: '#0a0a09',
      color: '#f8f7f4',
      fontSize: '15px',
      '&:focus': {
        border: '1px solid #f8f7f4',
        boxShadow: '0 0 0 3px rgba(248,247,244,0.1)',
      },
    },
    formFieldLabel: {
      color: '#9b9793',
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
    formFieldHint: {
      color: '#6b6763',
      fontSize: '12px',
    },
    formFieldErrorText: {
      color: '#d4736e',
      fontSize: '12px',
    },
    dividerLine: {
      backgroundColor: '#3b3835',
    },
    dividerText: {
      color: '#6b6763',
    },
    socialButtonsBlockButton: {
      borderRadius: '0.75rem',
      border: '1px solid #3b3835',
      backgroundColor: '#161514',
      color: '#f8f7f4',
      '&:hover': {
        backgroundColor: '#1c1b1a',
        border: '1px solid #d1cec9',
      },
    },
    footerActionLink: {
      color: '#d1cec9',
      '&:hover': {
        color: '#f8f7f4',
      },
    },
    footer: {
      backgroundColor: 'transparent',
    },
    formFieldShowPasswordButton: {
      color: '#9b9793',
    },
    alternateMethods: {
      border: 'none',
    },
    alertText: {
      color: '#d4736e',
    },
  },
};

if (!clerk) {
  const mount = document.getElementById('clerk-sign-in-mount') || document.getElementById('clerk-sign-up-mount');
  if (mount) {
    mount.innerHTML = `
      <div class="gc-auth-fallback">
        <span class="material-symbols-outlined" style="font-size:48px;color:var(--gc-warning);display:block;margin-bottom:var(--gc-space-4)">warning</span>
        <p style="color:var(--gc-secondary);margin-bottom:var(--gc-space-4)">Authentication is not configured.</p>
        <a href="/" class="gc-btn gc-btn--secondary">Return to home</a>
      </div>
    `;
  }
} else if (clerk.isSignedIn) {
  window.location.href = '/app.html';
} else {
  const mountEl = document.getElementById('clerk-sign-in-mount') || document.getElementById('clerk-sign-up-mount');
  if (mountEl) {
    const method = mountEl.id === 'clerk-sign-in-mount' ? 'mountSignIn' : 'mountSignUp';
    clerk[method](mountEl, { appearance: GRINDCTRL_APPEARANCE });
  }
}