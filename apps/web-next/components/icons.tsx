import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';

export type IconGlyph = Parameters<typeof HugeiconsIcon>[0]['icon'];

export function Icon({
  icon,
  className,
  size = 16,
  strokeWidth = 1.6,
}: {
  icon: IconGlyph;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} color="currentColor" className={className} />;
}
