import Image from 'next/image';
import type * as React from 'react';

/** A story image at its designed size. The source files are already sized
 *  webp, so next/image only has to pick the right width for the screen. */
export function StoryImg({
  src,
  w,
  h,
  alt,
  sizes,
  style,
  eager = false,
}: {
  src: string;
  w: number;
  h: number;
  alt: string;
  sizes?: string;
  style?: React.CSSProperties;
  /** The hero's first look: the largest paint on the first screen. */
  eager?: boolean;
}) {
  return (
    <Image
      src={src}
      width={w}
      height={h}
      alt={alt}
      sizes={sizes}
      style={style}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      draggable={false}
    />
  );
}
