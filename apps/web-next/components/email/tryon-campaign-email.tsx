import React from 'react';
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

export type TryonEmailTouch = 1 | 2 | 3 | 4;

export type TryonCampaignEmailProps = {
  touch: TryonEmailTouch;
  businessName: string;
  recipientName?: string;
  replyToEmail?: string;
  liveDemoUrl?: string;
  logoSrc?: string;
  proofImageSrc?: string;
};

type TouchCopy = {
  subject: string;
  preview: string;
  eyebrow: string;
  headline: string;
  includeProofImage: boolean;
};

const BASE_SUBJECT = '◉ Let shoppers see it before they buy';

export function getTryonTouchCopy(touch: TryonEmailTouch): TouchCopy {
  const subject = touch === 1 ? BASE_SUBJECT : `Re: ${BASE_SUBJECT}`;

  switch (touch) {
    case 1:
      return {
        subject,
        preview: 'What if one product from your store could become a private AI try-on demo?',
        eyebrow: 'A question for your store',
        headline: 'Let shoppers see it before they buy.',
        includeProofImage: true,
      };
    case 2:
      return {
        subject,
        preview: 'One product is enough to see whether the experience fits your store.',
        eyebrow: 'One product is enough',
        headline: 'See the result before deciding anything.',
        includeProofImage: false,
      };
    case 3:
      return {
        subject,
        preview: 'Selected item. Shopper photo. A private try-on preview inside the store.',
        eyebrow: 'The shopper journey',
        headline: 'Three steps. No store redirect.',
        includeProofImage: true,
      };
    case 4:
      return {
        subject,
        preview: 'We can prepare one product from your collection as a private try-on example.',
        eyebrow: 'A quick follow-up',
        headline: 'Worth seeing on one of your products?',
        includeProofImage: false,
      };
  }
}

function LeadCopy({
  touch,
  greeting,
}: {
  touch: TryonEmailTouch;
  greeting: string;
}) {
  if (touch === 1) {
    return (
      <>
        <Text style={paragraphStyle}>Hi {greeting},</Text>
        <Text style={paragraphStyle}>
          You have already done the hard part: creating products shoppers want. GrindCTRL Try-On
          helps answer the question that can stop a purchase: <strong>&quot;Will this look right on me?&quot;</strong>
        </Text>
        <Text style={paragraphStyle}>
          We add a virtual try-on experience directly to your product and catalog pages. Shoppers
          can upload a photo and preview the item on themselves without leaving your store.
        </Text>
        <Text style={lastParagraphStyle}>
          We can prepare a private demo using <strong>one real product from your collection</strong>,
          so you can judge the experience and result yourself.
        </Text>
      </>
    );
  }

  if (touch === 2) {
    return (
      <>
        <Text style={paragraphStyle}>Hi {greeting},</Text>
        <Text style={paragraphStyle}>
          A quick thought: you do not need to change your theme or prepare your entire catalog to
          see how GrindCTRL Try-On would feel inside your store.
        </Text>
        <Text style={lastParagraphStyle}>
          Choose one dress, abaya, or fashion item you already sell. We will use it to prepare a
          private example that shows the shopper journey from product selection to the finished preview.
        </Text>
      </>
    );
  }

  if (touch === 3) {
    return (
      <>
        <Text style={paragraphStyle}>Hi {greeting},</Text>
        <Text style={paragraphStyle}>The image below shows the experience clearly:</Text>
        <Text style={stepStyle}><strong>1.</strong> The shopper selects an item.</Text>
        <Text style={stepStyle}><strong>2.</strong> She uploads her photo.</Text>
        <Text style={stepStyle}><strong>3.</strong> She sees the item on herself.</Text>
        <Text style={lastParagraphStyle}>
          We can create the same private demonstration using one real product from your collection.
        </Text>
      </>
    );
  }

  return (
    <>
      <Text style={paragraphStyle}>Hi {greeting},</Text>
      <Text style={paragraphStyle}>
        Following up about the virtual try-on demo. We would be happy to prepare one of your
        products inside the experience, so you can see the result from a shopper&apos;s point of view.
      </Text>
      <Text style={lastParagraphStyle}>
        If you would like us to prepare it, reply <strong>DEMO</strong> and send the product link you
        want us to use.
      </Text>
    </>
  );
}

export function TryonCampaignEmail({
  touch,
  businessName,
  recipientName,
  replyToEmail = 'grindctrlnow@gmail.com',
  liveDemoUrl = 'https://grindctrl.cloud/try-on',
  logoSrc = 'cid:grindctrl-logo@grindctrl.cloud',
  proofImageSrc = 'cid:tryon-proof@grindctrl.cloud',
}: TryonCampaignEmailProps) {
  const copy = getTryonTouchCopy(touch);
  const safeBusinessName = businessName.trim() || 'your store';
  const greeting = recipientName?.trim() || `${safeBusinessName} team`;
  const replySubject = encodeURIComponent(`DEMO | ${safeBusinessName} | GrindCTRL Try-On`);
  const replyHref = `mailto:${replyToEmail}?subject=${replySubject}`;

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
        <style>{`
          @media screen and (max-width: 620px) {
            .gc-shell { padding: 12px 8px !important; }
            .gc-content { padding-left: 24px !important; padding-right: 24px !important; }
            .gc-heading { font-size: 32px !important; line-height: 1.12 !important; }
            .gc-logo-wordmark { font-size: 17px !important; }
          }
        `}</style>
      </Head>
      <Preview>{copy.preview}</Preview>
      <Body style={bodyStyle}>
        <Section className="gc-shell" style={shellStyle}>
          <Container style={containerStyle}>
            <Section style={headerStyle}>
              <Row>
                <Column style={logoColumnStyle}>
                  <Img
                    src={logoSrc}
                    width="72"
                    height="48"
                    alt="GrindCTRL"
                    style={logoStyle}
                  />
                </Column>
                <Column>
                  <Text className="gc-logo-wordmark" style={wordmarkStyle}>GRINDCTRL</Text>
                  <Text style={productLabelStyle}>TRY-ON</Text>
                </Column>
              </Row>
            </Section>

            <Section className="gc-content" style={contentStyle}>
              <Text style={eyebrowStyle}>{copy.eyebrow}</Text>
              <Heading as="h1" className="gc-heading" style={headingStyle}>{copy.headline}</Heading>
              <LeadCopy touch={touch} greeting={greeting} />
            </Section>

            {copy.includeProofImage ? (
              <Section className="gc-content" style={proofSectionStyle}>
                <Img
                  src={proofImageSrc}
                  width="536"
                  height="670"
                  alt="GrindCTRL Try-On journey: choose an item, upload a shopper photo, and see the item on her"
                  style={proofImageStyle}
                />
              </Section>
            ) : null}

            <Section className="gc-content" style={actionSectionStyle}>
              <Button href={replyHref} style={primaryButtonStyle}>Reply DEMO</Button>
              <Text style={actionNoteStyle}>
                Reply DEMO and we will prepare it using one real product from your store.
              </Text>
              <Hr style={actionRuleStyle} />
              <Link href={liveDemoUrl} style={secondaryLinkStyle}>Open the live demo</Link>
              <Text style={secondaryNoteStyle}>See the shopper experience before choosing a product for us.</Text>
            </Section>

            <Section style={footerStyle}>
              <Text style={footerTitleStyle}>The GrindCTRL Try-On team</Text>
              <Text style={footerBodyStyle}>Built for fashion commerce.</Text>
              <Text style={footerOptOutStyle}>Not relevant? Reply STOP and we will not follow up.</Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  margin: 0,
  backgroundColor: '#f7f7f5',
  color: '#0d0c0b',
  fontFamily: 'Arial, Helvetica, sans-serif',
};

const shellStyle: React.CSSProperties = { padding: '28px 12px' };

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  border: '1px solid #0d0c0b',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: '#0d0c0b',
  padding: '18px 28px',
};

const logoColumnStyle: React.CSSProperties = { width: '84px' };
const logoStyle: React.CSSProperties = { display: 'block', width: '72px', height: '48px' };

const wordmarkStyle: React.CSSProperties = {
  margin: '0 0 2px',
  color: '#ffffff',
  fontSize: '19px',
  fontWeight: 800,
  lineHeight: '24px',
  letterSpacing: '1.8px',
};

const productLabelStyle: React.CSSProperties = {
  margin: 0,
  color: '#d8d8d4',
  fontSize: '11px',
  fontWeight: 700,
  lineHeight: '16px',
  letterSpacing: '2px',
};

const contentStyle: React.CSSProperties = { padding: '34px 32px 22px' };

const eyebrowStyle: React.CSSProperties = {
  margin: '0 0 12px',
  color: '#666663',
  fontSize: '12px',
  fontWeight: 700,
  lineHeight: '17px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
};

const headingStyle: React.CSSProperties = {
  margin: '0 0 22px',
  color: '#0d0c0b',
  fontSize: '38px',
  fontWeight: 700,
  lineHeight: '42px',
  letterSpacing: '-0.7px',
};

const paragraphStyle: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#151513',
  fontSize: '17px',
  fontWeight: 400,
  lineHeight: '28px',
};

const lastParagraphStyle: React.CSSProperties = { ...paragraphStyle, marginBottom: 0 };
const stepStyle: React.CSSProperties = { ...paragraphStyle, marginBottom: '6px' };

const proofSectionStyle: React.CSSProperties = { padding: '0 32px 28px' };
const proofImageStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: '536px',
  height: 'auto',
  border: '1px solid #d8d8d4',
  borderRadius: '12px',
};

const actionSectionStyle: React.CSSProperties = {
  padding: '4px 32px 36px',
  textAlign: 'center',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#0d0c0b',
  color: '#ffffff',
  borderRadius: '999px',
  padding: '16px 32px',
  fontSize: '16px',
  fontWeight: 700,
  lineHeight: '20px',
  textDecoration: 'none',
};

const actionNoteStyle: React.CSSProperties = {
  margin: '14px auto 0',
  maxWidth: '430px',
  color: '#555552',
  fontSize: '13px',
  lineHeight: '20px',
};

const actionRuleStyle: React.CSSProperties = {
  margin: '24px 0 20px',
  borderColor: '#d8d8d4',
  borderTop: '1px solid #d8d8d4',
};

const secondaryLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  color: '#0d0c0b',
  border: '1px solid #d8d8d4',
  borderRadius: '999px',
  padding: '11px 20px',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: '18px',
  textDecoration: 'none',
};

const secondaryNoteStyle: React.CSSProperties = {
  margin: '10px auto 0',
  color: '#666663',
  fontSize: '12px',
  lineHeight: '18px',
};

const footerStyle: React.CSSProperties = {
  backgroundColor: '#0d0c0b',
  padding: '24px 30px',
};

const footerTitleStyle: React.CSSProperties = {
  margin: '0 0 4px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700,
  lineHeight: '21px',
};

const footerBodyStyle: React.CSSProperties = {
  margin: 0,
  color: '#d8d8d4',
  fontSize: '13px',
  lineHeight: '20px',
};

const footerOptOutStyle: React.CSSProperties = {
  margin: '16px 0 0',
  color: '#a6a6a2',
  fontSize: '12px',
  lineHeight: '19px',
};

export default TryonCampaignEmail;
