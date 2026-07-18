import path from 'node:path';
import nodemailer from 'nodemailer';
import type { TryonCampaignEmailProps, TryonEmailTouch } from '@/components/email/tryon-campaign-email';
import {
  renderTryonCampaignEmail,
  TRYON_EMAIL_CONTENT_VERSION,
  TRYON_LOGO_CID,
  TRYON_PROOF_CID,
} from '@/lib/email/tryon-campaign';

export type SendTryonCampaignTouchInput = {
  to: string;
  touch: TryonEmailTouch;
  businessName: string;
  recipientName?: string;
  threadMessageId?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export async function sendTryonCampaignTouch(input: SendTryonCampaignTouchInput) {
  const smtpUser = requiredEnv('TRYON_EMAIL_SMTP_USER');
  const smtpPassword = requiredEnv('TRYON_EMAIL_SMTP_APP_PASSWORD');
  const replyToEmail = process.env.TRYON_EMAIL_REPLY_TO?.trim() || smtpUser;
  const liveDemoUrl = process.env.TRYON_EMAIL_LIVE_DEMO_URL?.trim() || 'https://grindctrl.cloud/try-on';
  const smtpHost = process.env.TRYON_EMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com';
  const smtpPort = Number(process.env.TRYON_EMAIL_SMTP_PORT || 587);
  const fromName = process.env.TRYON_EMAIL_FROM_NAME?.trim() || 'GrindCTRL Try-On';

  const templateProps: TryonCampaignEmailProps = {
    touch: input.touch,
    businessName: input.businessName,
    recipientName: input.recipientName,
    replyToEmail,
    liveDemoUrl,
    logoSrc: `cid:${TRYON_LOGO_CID}`,
    proofImageSrc: `cid:${TRYON_PROOF_CID}`,
  };
  const rendered = await renderTryonCampaignEmail(templateProps);
  const includeProof = input.touch === 1 || input.touch === 3;

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPassword },
  });

  const info = await transport.sendMail({
    from: { name: fromName, address: smtpUser },
    to: input.to,
    replyTo: replyToEmail,
    subject: rendered.subject,
    ...(input.threadMessageId && input.touch > 1
      ? { inReplyTo: input.threadMessageId, references: [input.threadMessageId] }
      : {}),
    html: rendered.html,
    text: rendered.text,
    textEncoding: 'base64',
    headers: {
      'X-GrindCTRL-Touch': String(input.touch),
      'X-Campaign-Content-Version': TRYON_EMAIL_CONTENT_VERSION,
      'List-Unsubscribe': `<mailto:${replyToEmail}?subject=STOP>`,
    },
    attachments: [
      {
        filename: 'grindctrl-logo.png',
        path: path.join(process.cwd(), 'public', 'campaigns', 'grindctrl-logo-white.png'),
        cid: TRYON_LOGO_CID,
        contentType: 'image/png',
        contentDisposition: 'inline',
      },
      ...(includeProof
        ? [{
            filename: 'grindctrl-tryon-proof.png',
            path: path.join(process.cwd(), 'public', 'campaigns', 'grindctrl-tryon-proof.png'),
            cid: TRYON_PROOF_CID,
            contentType: 'image/png',
            contentDisposition: 'inline' as const,
          }]
        : []),
    ],
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
    touch: input.touch,
    subject: rendered.subject,
    contentVersion: TRYON_EMAIL_CONTENT_VERSION,
  };
}
