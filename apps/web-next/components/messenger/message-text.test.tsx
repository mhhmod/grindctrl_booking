import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageText } from './message-text';

/* The reply that prompted this rendered as one unbroken paragraph of inert
   text: "Here are the direct links to our collections: - All Tees:
   https://... - Graphic Tees: https://...". A shopper who asked for links
   could not click one. */

describe('MessageText', () => {
  it('turns the links in an answer into links a shopper can click', () => {
    render(
      <MessageText text={'All Tees:\nhttps://grindctrl.myshopify.com/collections/tees'} />,
    );

    const link = screen.getByRole('link', {
      name: 'https://grindctrl.myshopify.com/collections/tees',
    });
    expect(link).toHaveAttribute('href', 'https://grindctrl.myshopify.com/collections/tees');
  });

  it('opens links away from the panel without handing over the opener', () => {
    render(<MessageText text="https://example.com/a" />);

    const link = screen.getByRole('link', { name: 'https://example.com/a' });
    expect(link).toHaveAttribute('target', '_blank');
    // The merchant's inbox renders shopper-written text through this same
    // component, so an outbound link must not carry window.opener or SEO
    // weight with it.
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    expect(link.getAttribute('rel')).toContain('nofollow');
  });

  /* Message text comes from a model and, in the merchant's inbox, from
     shoppers. Neither is allowed to produce a scheme that executes. */
  it('refuses to make a link out of anything that is not http or https', () => {
    render(
      <MessageText text="javascript:alert(1) data:text/html;base64,PHN2Zz4= file:///etc/passwd" />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders text content literally rather than as markup', () => {
    const { container } = render(
      <MessageText text={'<img src=x onerror="alert(1)"> <b>bold</b>'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('leaves sentence punctuation out of the address', () => {
    render(<MessageText text="Browse https://example.com/tees. Then tell me." />);

    const link = screen.getByRole('link', { name: 'https://example.com/tees' });
    expect(link).toHaveAttribute('href', 'https://example.com/tees');
    // The full stop belongs to the sentence and must survive as text.
    expect(screen.getByText(/\. Then tell me\./)).toBeInTheDocument();
  });

  it('keeps every link in a multi-link answer, and the prose between them', () => {
    render(
      <MessageText
        text={
          'Here are the links:\n' +
          '- All Tees: https://grindctrl.myshopify.com/collections/tees\n' +
          '- Graphic Tees: https://grindctrl.myshopify.com/collections/graphic-tees\n' +
          '- Kids Tees: https://grindctrl.myshopify.com/collections/kids-tees'
        }
      />,
    );

    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByText(/Here are the links:/)).toBeInTheDocument();
  });

  it('lets a long URL wrap instead of forcing the bubble wider than the panel', () => {
    render(<MessageText text="https://grindctrl.myshopify.com/collections/graphic-tees" />);
    expect(screen.getByRole('link').className).toContain('break-all');
  });

  it('passes ordinary text through untouched', () => {
    render(<MessageText text="We carry graphic tees, hoodies and caps." />);
    expect(screen.getByText('We carry graphic tees, hoodies and caps.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders **bold** as a strong element', () => {
    const { container } = render(<MessageText text="Our **Summer Sale** starts Friday." />);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong).toHaveTextContent('Summer Sale');
    // The markers themselves must not survive as text.
    expect(container.textContent).not.toContain('**');
  });

  it('leaves an unmatched ** marker as plain text', () => {
    const { container } = render(<MessageText text="Our **Summer Sale starts Friday." />);
    expect(container.querySelector('strong')).toBeNull();
    expect(container.textContent).toContain('Our **Summer Sale starts Friday.');
  });

  it('renders `inline code` as a code element', () => {
    const { container } = render(<MessageText text="Use `SUMMER10` at checkout." />);
    const code = container.querySelector('code');
    expect(code).not.toBeNull();
    expect(code).toHaveTextContent('SUMMER10');
    expect(container.textContent).not.toContain('`');
  });

  it('renders a "- " line with a bullet marker instead of the literal dash', () => {
    const { container } = render(<MessageText text="- Free shipping over $50" />);
    expect(container.querySelector('strong')).toBeNull();
    expect(container.textContent).toContain('Free shipping over $50');
    expect(container.textContent).not.toContain('- Free shipping');
    expect(container.textContent).toContain('•');
  });

  it('renders a "* " line as a bullet too', () => {
    const { container } = render(<MessageText text="* Easy returns" />);
    expect(container.textContent).toContain('Easy returns');
    expect(container.textContent).toContain('•');
  });

  /* A reply routinely mixes emphasis and links on one line ("**Note:** see
     https://..."), so the URL pass and the bold/code pass must compose
     instead of one swallowing the other. */
  it('keeps both the link and the bold text when one line has both', () => {
    const { container } = render(
      <MessageText text="**Note:** see https://example.com/collections for more" />,
    );

    const link = screen.getByRole('link', { name: 'https://example.com/collections' });
    expect(link).toHaveAttribute('href', 'https://example.com/collections');

    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong).toHaveTextContent('Note:');
  });

  it('renders a bullet line that also contains a link', () => {
    render(<MessageText text="- All Tees: https://example.com/collections/tees" />);
    expect(screen.getByRole('link', { name: 'https://example.com/collections/tees' })).toBeInTheDocument();
    expect(screen.getByText(/All Tees:/)).toBeInTheDocument();
  });

  it('still renders raw HTML strings as inert text when markdown is present', () => {
    const { container } = render(
      <MessageText text={'**Sale** <img src=x onerror="alert(1)">'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('strong')).not.toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});
