import React from 'react';
import { render } from '@react-email/render';
import {
  getTryonTouchCopy,
  TryonCampaignEmail,
  type TryonCampaignEmailProps,
} from '@/components/email/tryon-campaign-email';

export const TRYON_LOGO_CID = 'grindctrl-logo@grindctrl.cloud';
export const TRYON_PROOF_CID = 'tryon-proof@grindctrl.cloud';
export const TRYON_EMAIL_CONTENT_VERSION = 'tryon-email-v3-react-email-2026-07-17';

export async function renderTryonCampaignEmail(props: TryonCampaignEmailProps) {
  const element = React.createElement(TryonCampaignEmail, props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return {
    subject: getTryonTouchCopy(props.touch).subject,
    html,
    text,
  };
}
