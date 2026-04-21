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
    borderRadius: '16px',
    colorPrimary: '#f3efe8',
    colorPrimaryForeground: '#131110',
    colorBackground: 'transparent',
    colorInputBackground: '#161412',
    colorInputForeground: '#f3efe8',
    colorInputPlaceholder: '#918880',
    colorInputBorder: '#4a433d',
    colorInputBorderHover: '#5d5650',
    colorInputBorderFocus: '#f3efe8',
    colorInputShadow: '0 0 0 3px rgba(243, 239, 232, 0.1)',
    colorTextPrimary: '#f3efe8',
    colorTextSecondary: '#cbc3ba',
    colorTextTertiary: '#9a9188',
    colorDanger: '#e1736d',
    colorSuccess: '#66bb6a',
    colorWarning: '#ffb454',
    colorBackgroundAlpha: '#292521',
    spacingUnit: '1rem',
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
      borderRadius: '16px',
      border: '1px solid #453f39',
      backgroundColor: '#161412',
      color: '#f3efe8',
      fontWeight: '600',
      fontSize: '0.875rem',
      boxShadow: '0 8px 24px -14px rgba(0,0,0,0.34)',
      transition: 'all 180ms ease',
      '&:hover': {
        backgroundColor: '#1d1a18',
        border: '1px solid #625a53',
      },
    },
    socialButtonsProviderIcon: {
      color: '#ece7de',
    },
    dividerLine: {
      backgroundColor: '#3a342f',
    },
    dividerText: {
      color: '#9a9188',
      fontSize: '0.75rem',
      fontWeight: '500',
    },
    formFieldLabel: {
      color: '#d1c9c0',
      fontSize: '0.75rem',
      fontWeight: '600',
    },
    formFieldInput: {
      minHeight: '46px',
      borderRadius: '16px',
      border: '1px solid #4a433d',
      backgroundColor: '#161412',
      color: '#f3efe8',
      fontSize: '0.9375rem',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      '&:focus': {
        border: '1px solid #f3efe8',
        boxShadow: '0 0 0 3px rgba(243, 239, 232, 0.1)',
      },
    },
    formFieldInputShowPasswordButton: {
      color: '#a39991',
      '&:hover': {
        color: '#f3efe8',
      },
    },
    formFieldHintText: {
      color: '#9d948b',
      fontSize: '0.75rem',
      lineHeight: '1.45',
    },
    formFieldErrorText: {
      color: '#e1736d',
      fontSize: '0.75rem',
      fontWeight: '600',
    },
    formButtonPrimary: {
      minHeight: '46px',
      borderRadius: '16px',
      border: '1px solid transparent',
      backgroundColor: '#f3efe8',
      color: '#131110',
      fontSize: '0.9375rem',
      fontWeight: '700',
      boxShadow: '0 8px 24px -14px rgba(0, 0, 0, 0.34)',
      transition: 'all 180ms ease',
      '&:hover': {
        backgroundColor: '#e6dfd6',
      },
    },
    footer: {
      backgroundColor: 'transparent',
      padding: '0',
    },
    footerActionText: {
      color: '#9d948b',
      fontSize: '0.8125rem',
    },
    footerActionLink: {
      color: '#f3efe8',
      fontWeight: '700',
      '&:hover': {
        color: '#ffffff',
      },
    },
    alertText: {
      color: '#e1736d',
    },
    identityPreviewText: {
      color: '#f3efe8',
    },
    identityPreviewEditButton: {
      color: '#d5cdc4',
    },
    formResendCodeLink: {
      color: '#d5cdc4',
      fontWeight: '600',
      '&:hover': {
        color: '#f3efe8',
      },
    },
    otpCodeFieldInput: {
      borderRadius: '16px',
      backgroundColor: '#161412',
      border: '1px solid #4b443e',
      color: '#f3efe8',
      '&:focus': {
        border: '1px solid #f3efe8',
      },
    },
  },
};
