/* The v15 line icon set: 24px grid, 1.8 stroke, round caps and joins,
   currentColor. Every icon is decorative (aria-hidden); the control that
   holds it carries the accessible name. Forward arrows that should flip in
   Arabic are marked by the caller with data-icon="inline-end" and
   rtl:-scale-x-100, which e2e/golden-standard-rtl.spec.ts checks. */

import * as React from 'react';

export type SiteIconProps = Omit<React.SVGProps<SVGSVGElement>, 'children'> & {
  size?: number;
  strokeWidth?: number;
};

function make(name: string, body: React.ReactNode) {
  function SiteIcon({ size = 16, strokeWidth = 1.8, ...rest }: SiteIconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {body}
      </svg>
    );
  }
  SiteIcon.displayName = name;
  return SiteIcon;
}

export const AlertIcon = make('AlertIcon', <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.8V13M12 16.2v.1" /></>);
export const AppIcon = make('AppIcon', <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 12h6M12 9v6" /></>);
export const ArrowIcon = make('ArrowIcon', <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>);
export const BagIcon = make('BagIcon', <><path d="M5.5 8.5h13l-1 12h-11l-1-12z" /><path d="M9 8.5V7a3 3 0 016 0v1.5" /></>);
export const BlocksIcon = make('BlocksIcon', <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><path d="M16.5 13v7M13 16.5h7" /></>);
export const BoltIcon = make('BoltIcon', <><path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" /></>);
export const BookIcon = make('BookIcon', <><path d="M5 4.5h9.5a3 3 0 013 3v12H8a3 3 0 01-3-3v-12z" /><path d="M5 16.5a3 3 0 013-3h9.5" /></>);
export const BoxIcon = make('BoxIcon', <><path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" /><path d="M4 8l8 4 8-4M12 12v8" /></>);
export const CalendarIcon = make('CalendarIcon', <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>);
export const CameraIcon = make('CameraIcon', <><path d="M4 8.5A1.5 1.5 0 015.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5v-9z" /><circle cx="12" cy="13" r="3.4" /></>);
export const CardIcon = make('CardIcon', <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M3.5 10h17M7 14.5h4" /></>);
export const ChartIcon = make('ChartIcon', <><path d="M5 19.5V12" /><path d="M12 19.5V5" /><path d="M19 19.5v-8" /></>);
export const ChatIcon = make('ChatIcon', <><path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8.5A1.5 1.5 0 0119 17H10l-4.5 3.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" /></>);
export const CheckIcon = make('CheckIcon', <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.8-5" /></>);
export const ChevronIcon = make('ChevronIcon', <><path d="M9 6l6 6-6 6" /></>);
export const ChevronDownIcon = make('ChevronDownIcon', <><path d="M7 10l5 5 5-5" /></>);
export const ClockIcon = make('ClockIcon', <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const CompareIcon = make('CompareIcon', <><rect x="3.5" y="5" width="7.5" height="14" rx="1.5" /><rect x="13" y="5" width="7.5" height="14" rx="1.5" /></>);
export const CopyIcon = make('CopyIcon', <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5" /></>);
export const DownloadIcon = make('DownloadIcon', <><path d="M12 4v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19.5h14" /></>);
export const EqualsIcon = make('EqualsIcon', <><path d="M6 9.5h12M6 14.5h12" /></>);
export const ExtIcon = make('ExtIcon', <><path d="M9 5h10v10" /><path d="M19 5L7 17" /></>);
export const GlobeIcon = make('GlobeIcon', <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z" /></>);
export const HandoffIcon = make('HandoffIcon', <><path d="M3.5 12h8" /><path d="M8.5 8.5L12 12l-3.5 3.5" /><circle cx="17.5" cy="9" r="2.6" /><path d="M13.8 19.5c.5-2.6 2-3.9 3.7-3.9s3.2 1.3 3.7 3.9" /></>);
export const HangerIcon = make('HangerIcon', <><path d="M12 7.5a2 2 0 112-2" /><path d="M12 7.5v1.2L3.5 15a1.3 1.3 0 00.8 2.3h15.4a1.3 1.3 0 00.8-2.3L12 8.7" /></>);
export const HelpIcon = make('HelpIcon', <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.6a2.5 2.5 0 114 2c-.9.6-1.6 1.1-1.6 2.1" /><path d="M12 16.8v.2" /></>);
export const InboxIcon = make('InboxIcon', <><path d="M4 13l2.2-7.2A1.5 1.5 0 017.6 4.7h8.8a1.5 1.5 0 011.4 1.1L20 13v5.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5V13z" /><path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20" /></>);
export const InfoIcon = make('InfoIcon', <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.2M12 7.8v.1" /></>);
export const KeyIcon = make('KeyIcon', <><circle cx="8" cy="15" r="3.5" /><path d="M10.5 12.5L19 4M16 7l2.5 2.5M14 9l2 2" /></>);
export const LockIcon = make('LockIcon', <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></>);
export const MailIcon = make('MailIcon', <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></>);
export const MinusIcon = make('MinusIcon', <><path d="M6 12h12" /></>);
export const NoteIcon = make('NoteIcon', <><path d="M5.5 4.5h13v10l-5 5h-8v-15z" /><path d="M13.5 19.5v-5h5" /></>);
export const PersonIcon = make('PersonIcon', <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.8 20.5c1.2-3.6 4-5.3 7.2-5.3s6 1.7 7.2 5.3" /></>);
export const PhotoIcon = make('PhotoIcon', <><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 15.5l-5-5-9 8.5" /></>);
export const PlusIcon = make('PlusIcon', <><path d="M12 6v12M6 12h12" /></>);
export const RefundIcon = make('RefundIcon', <><path d="M4.5 12a7.5 7.5 0 107.5-7.5H8" /><path d="M10.5 1.5L7.5 4.5l3 3" /></>);
export const ReloadIcon = make('ReloadIcon', <><path d="M19.5 12a7.5 7.5 0 11-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>);
export const ReplyIcon = make('ReplyIcon', <><path d="M9.5 8L5 12l4.5 4" /><path d="M5 12h9a5 5 0 015 5v1" /></>);
export const SearchIcon = make('SearchIcon', <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>);
export const SendIcon = make('SendIcon', <><path d="M4 12l16-7-5 16-3.5-6.5L4 12z" /></>);
export const ShieldIcon = make('ShieldIcon', <><path d="M12 3.5l7 3v5c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9v-5l7-3z" /></>);
export const ShirtIcon = make('ShirtIcon', <><path d="M8.5 4.5L12 6l3.5-1.5 4.5 3-2.3 3.4-2.2-1.2V19.5h-7V9.7l-2.2 1.2L4 7.5l4.5-3z" /></>);
export const SparkleIcon = make('SparkleIcon', <><path d="M12 3c.6 4.2 3.1 6.7 7.3 7.3-4.2.6-6.7 3.1-7.3 7.3-.6-4.2-3.1-6.7-7.3-7.3C8.9 9.7 11.4 7.2 12 3z" /></>);
export const StackIcon = make('StackIcon', <><path d="M12 4l8 4-8 4-8-4 8-4z" /><path d="M4 12l8 4 8-4" /><path d="M4 16l8 4 8-4" /></>);
export const SwapIcon = make('SwapIcon', <><path d="M7 7h11l-3-3" /><path d="M17 17H6l3 3" /></>);
export const TagIcon = make('TagIcon', <><path d="M4 12.5V5.5A1.5 1.5 0 015.5 4h7l7.5 7.5-8.5 8.5L4 12.5z" /><circle cx="8.5" cy="8.5" r="1.4" /></>);
export const TickIcon = make('TickIcon', <><path d="M5 12.5l4.2 4.2L19 7" /></>);
export const UploadIcon = make('UploadIcon', <><path d="M12 16V5" /><path d="M7.5 9.5L12 5l4.5 4.5" /><path d="M5 19h14" /></>);
export const XIcon = make('XIcon', <><path d="M7 7l10 10M17 7L7 17" /></>);

export const SITE_ICONS = {
  'alert': AlertIcon,
  'app': AppIcon,
  'arrow': ArrowIcon,
  'bag': BagIcon,
  'blocks': BlocksIcon,
  'bolt': BoltIcon,
  'book': BookIcon,
  'box': BoxIcon,
  'calendar': CalendarIcon,
  'camera': CameraIcon,
  'card': CardIcon,
  'chart': ChartIcon,
  'chat': ChatIcon,
  'check': CheckIcon,
  'chevron': ChevronIcon,
  'chevron-down': ChevronDownIcon,
  'clock': ClockIcon,
  'compare': CompareIcon,
  'copy': CopyIcon,
  'download': DownloadIcon,
  'equals': EqualsIcon,
  'ext': ExtIcon,
  'globe': GlobeIcon,
  'handoff': HandoffIcon,
  'hanger': HangerIcon,
  'help': HelpIcon,
  'inbox': InboxIcon,
  'info': InfoIcon,
  'key': KeyIcon,
  'lock': LockIcon,
  'mail': MailIcon,
  'minus': MinusIcon,
  'note': NoteIcon,
  'person': PersonIcon,
  'photo': PhotoIcon,
  'plus': PlusIcon,
  'refund': RefundIcon,
  'reload': ReloadIcon,
  'reply': ReplyIcon,
  'search': SearchIcon,
  'send': SendIcon,
  'shield': ShieldIcon,
  'shirt': ShirtIcon,
  'sparkle': SparkleIcon,
  'stack': StackIcon,
  'swap': SwapIcon,
  'tag': TagIcon,
  'tick': TickIcon,
  'upload': UploadIcon,
  'x': XIcon,
} as const;

export type SiteIconName = keyof typeof SITE_ICONS;
