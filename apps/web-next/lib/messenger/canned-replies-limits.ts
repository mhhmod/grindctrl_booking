/* The shape and limits of a saved reply, apart from canned-replies.ts (which
   reads the database and is server-only) so the dashboard can use them. */

export interface CannedReply {
  id: string;
  title: string;
  content: string;
  status: 'active' | 'disabled';
  sort_order: number;
  updated_at: string;
}

export const CANNED_REPLY_TITLE_MAX = 100;
export const CANNED_REPLY_CONTENT_MAX = 2000;
export const CANNED_REPLIES_MAX_PER_SITE = 50;
