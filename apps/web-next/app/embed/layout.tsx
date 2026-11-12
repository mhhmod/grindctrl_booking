import type { ReactNode } from 'react';
import '@/components/embed/scroll-shell.css';

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return <div className="gc-embed-document">{children}</div>;
}
