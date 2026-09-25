import Image, { getImageProps } from 'next/image';
import type * as React from 'react';
import { preload } from 'react-dom';

const HERO_MEDIA = { desk: '(min-width: 1000px)', phone: '(max-width: 999.98px)' } as const;

/** A story image at its designed size. The source files are already small,
 *  sized webp (the whole set is about 1.2 MB), so they are served as they
 *  are: through the image optimizer the server had to resize each one on
 *  first request, and pages sat on empty placeholders while it did. */
export function StoryImg({
  src,
  w,
  h,
  alt,
  sizes,
  style,
  hero,
}: {
  src: string;
  w: number;
  h: number;
  alt: string;
  sizes?: string;
  style?: React.CSSProperties;
  /** The hero's first look, the largest paint on the first screen. Both
   *  layouts have one and CSS hides one of them, so the image itself stays
   *  lazy (a hidden copy never downloads) and a preload scoped to the
   *  layout's media query starts the visible one early. */
  hero?: 'desk' | 'phone';
}) {
  if (hero) {
    const { props } = getImageProps({ src, width: w, height: h, alt, sizes, unoptimized: true });
    preload(props.src, {
      as: 'image',
      imageSrcSet: props.srcSet,
      imageSizes: props.sizes,
      fetchPriority: 'high',
      media: HERO_MEDIA[hero],
    });
  }
  return (
    <Image
      src={src}
      width={w}
      height={h}
      alt={alt}
      sizes={sizes}
      unoptimized
      style={style}
      loading="lazy"
      fetchPriority={hero ? 'high' : undefined}
      draggable={false}
    />
  );
}
