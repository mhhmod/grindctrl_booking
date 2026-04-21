// Clerk appearance contract for GRINDCTRL auth surfaces.
// Uses Clerk's supported `appearance.variables` + `appearance.elements`.

export const GRINDCTRL_APPEARANCE = {
  layout: {
    logoPlacement: 'none',
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',
    showOptionalFields: false,
  },
  variables: {
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '14px',
    colorPrimary: '#f0ede9',
    colorPrimaryForeground: '#11100f',
    colorBackground: 'transparent',
    colorInputBackground: '#0b0b0a',
    colorInputForeground: '#f8f7f4',
    colorInputPlaceholder: '#938f8a',
    colorInputBorder: '#33302d',
    colorInputBorderHover: '#4f4a45',
    colorInputBorderFocus: '#f0ede9',
    colorInputShadow: '0 0 0 3px rgba(240, 237, 233, 0.12)',
    colorTextPrimary: '#f8f7f4',
    colorTextSecondary: '#c8c4bf',
    colorTextTertiary: '#96918c',
    colorDanger: '#e1736d',
    colorSuccess: '#66bb6a',
    colorWarning: '#ffb454',
    colorBackgroundAlpha: '#302d2a',
    spacingUnit: '0.9rem',
    fontSize: '15px',
  },
  elements: {
    rootBox: {
      width: '100%',
    },
    cardBox: {
      width: '100%',
      boxShadow: 'none',
      border: '0',
      backgroundColor: 'transparent',
      padding: '0',
      margin: '0',
    },
    card: {
      backgroundColor: 'transparent',
      border: '0',
      boxShadow: 'none',
      padding: '0',
      margin: '0',
    },
    headerTitle: {
      display: 'none',
    },
    headerSubtitle: {
      display: 'none',
    },
    socialButtonsBlockButton: {
      minHeight: '46px',
      borderRadius: '14px',
      border: '1px solid #302d2a',
      backgroundColor: '#131211',
      color: '#f8f7f4',
      fontWeight: '600',
      fontSize: '0.875rem',
      boxShadow: 'none',
      transition: 'all 180ms ease',
      '&:hover': {
        backgroundColor: '#1d1b19',
        border: '1px solid #595550',
      },
    },
    socialButtonsProviderIcon: {
      color: '#f0ede9',
    },
    dividerLine: {
      backgroundColor: '#2f2c29',
    },
    dividerText: {
      color: '#908b86',
      fontSize: '0.75rem',
      fontWeight: '600',
      letterSpacing: '0.02em',
    },
    formFieldLabel: {
      color: '#c8c4bf',
      fontSize: '0.75rem',
      fontWeight: '700',
      letterSpacing: '0.045em',
      textTransform: 'uppercase',
    },
    formFieldInput: {
      minHeight: '48px',
      borderRadius: '14px',
      border: '1px solid #33302d',
      backgroundColor: '#0b0b0a',
      color: '#f8f7f4',
      fontSize: '0.9375rem',
      boxShadow: 'none',
      '&:focus': {
        border: '1px solid #f0ede9',
        boxShadow: '0 0 0 3px rgba(240, 237, 233, 0.12)',
      },
    },
    formFieldInputShowPasswordButton: {
      color: '#97928d',
      '&:hover': {
        color: '#f0ede9',
      },
    },
    formFieldHintText: {
      color: '#918d88',
      fontSize: '0.75rem',
      lineHeight: '1.45',
    },
    formFieldErrorText: {
      color: '#e1736d',
      fontSize: '0.75rem',
      fontWeight: '600',
    },
    formButtonPrimary: {
      minHeight: '48px',
      borderRadius: '14px',
      border: '1px solid transparent',
      backgroundColor: '#f0ede9',
      color: '#11100f',
      fontSize: '0.9375rem',
      fontWeight: '700',
      letterSpacing: '0.02em',
      boxShadow: '0 10px 30px -12px rgba(0, 0, 0, 0.55)',
      transition: 'all 180ms ease',
      '&:hover': {
        backgroundColor: '#d8d4cf',
      },
    },
    footer: {
      backgroundColor: 'transparent',
      padding: '0',
    },
    footerActionText: {
      color: '#918d88',
      fontSize: '0.8125rem',
    },
    footerActionLink: {
      color: '#f8f7f4',
      fontWeight: '700',
      '&:hover': {
        color: '#f0ede9',
      },
    },
    alertText: {
      color: '#e1736d',
    },
    identityPreviewText: {
      color: '#f8f7f4',
    },
    identityPreviewEditButton: {
      color: '#d5d1cc',
    },
    formResendCodeLink: {
      color: '#d5d1cc',
      fontWeight: '600',
      '&:hover': {
        color: '#f8f7f4',
      },
    },
    otpCodeFieldInput: {
      borderRadius: '10px',
      backgroundColor: '#11100f',
      border: '1px solid #3a3734',
      color: '#f8f7f4',
      '&:focus': {
        border: '1px solid #f0ede9',
      },
    },
  },
};
