import type { StoryText } from './story-strings';

/** The values a scene view reads, computed from the story state by
 *  story-vals.ts. They mirror the prototype's render values one to one, so
 *  the generated views can stay a straight port of its markup; that is why
 *  this one type is loose. */
export type V = Record<string, any>;

export type StoryT = (text: StoryText) => string;

export type ViewProps = { v: V; t: StoryT };

export type StoryLayout = 'desk' | 'phone';
