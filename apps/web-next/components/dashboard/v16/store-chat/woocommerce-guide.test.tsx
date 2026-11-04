import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { getChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import { WOO_PLUGIN_ZIP, WoocommerceGuide } from './woocommerce-guide';

const KEY = 'emb_live_7f3a9c';

function draw(locale: 'en' | 'ar') {
  const copy = getChatStudioCopy(locale);
  renderWithMantine(<WoocommerceGuide embedKey={KEY} copy={copy.woocommerce} copyLabels={copy.domains} />);
  return copy;
}

describe('WoocommerceGuide', () => {
  it.each(['en', 'ar'] as const)('walks the merchant through the four steps in %s', (locale) => {
    const copy = draw(locale);
    const { steps } = copy.woocommerce;

    expect(screen.getByRole('heading', { level: 3, name: copy.woocommerce.title })).toBeInTheDocument();
    expect(screen.getByText(copy.woocommerce.body)).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    [steps.download, steps.upload, steps.key, steps.domain].forEach((text, index) => expect(items[index]).toHaveTextContent(text));

    const link = screen.getByRole('link', { name: copy.woocommerce.download });
    expect(link).toHaveAttribute('href', '/downloads/grindctrl-store-chat.zip');
    expect(link).toHaveAttribute('download', 'grindctrl-store-chat.zip');
    expect(items[0]).toContainElement(link);

    const key = screen.getByText(KEY);
    expect(key).toHaveAttribute('dir', 'ltr');
    expect(items[2]).toContainElement(key);
    expect(screen.getByRole('button', { name: `${copy.domains.copy}: ${copy.woocommerce.keyLabel}` })).toBeInTheDocument();
  });

  it('links to a file that ships with the app', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../../../public', `.${WOO_PLUGIN_ZIP}`))).toBe(true);
  });

  it('copies the embed key', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const copy = draw('en');

    fireEvent.click(screen.getByRole('button', { name: `${copy.domains.copy}: ${copy.woocommerce.keyLabel}` }));
    await waitFor(() => expect(screen.getByRole('button', { name: `${copy.domains.copy}: ${copy.woocommerce.keyLabel}` })).toHaveTextContent(copy.domains.copied));
    expect(writeText).toHaveBeenCalledWith(KEY);
  });

  it('presents a setup path, not a support claim, and says the domain gates the answers', () => {
    const { woocommerce } = getChatStudioCopy('en');
    const text = [woocommerce.title, woocommerce.body, ...Object.values(woocommerce.steps)].join(' ');
    expect(text).not.toMatch(/\b(supported|live)\b/i);
    expect(woocommerce.steps.domain).toMatch(/only after the domain is verified/);
  });
});
