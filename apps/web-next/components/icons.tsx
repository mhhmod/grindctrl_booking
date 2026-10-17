import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon,
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  ArrowExpand01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowTurnBackwardIcon,
  ArrowUp01Icon,
  Camera01Icon,
  Cancel01Icon,
  Clock01Icon,
  CodeIcon,
  DashboardSpeed02Icon,
  Delete02Icon,
  DeliveryTruck01Icon,
  Download04Icon,
  Edit02Icon,
  ExclamationMarkIcon,
  FavouriteIcon,
  File02Icon,
  FilterHorizontalIcon,
  Flag02Icon,
  FlashIcon,
  Hold01Icon,
  Home01Icon,
  Image01Icon,
  Image02Icon,
  InboxIcon,
  InformationCircleIcon,
  Layout01Icon,
  Link01Icon,
  LinkSquare02Icon,
  Mail01Icon,
  Menu01Icon,
  Message01Icon,
  Mic01Icon,
  MinusSignIcon,
  Money01Icon,
  Moon02Icon,
  MoreHorizontalIcon,
  Notification01Icon,
  PackageIcon,
  PauseCircleIcon,
  PlusSignIcon,
  RefreshIcon,
  RulerIcon,
  Search01Icon,
  Settings02Icon,
  Shield01Icon,
  ShoppingBag01Icon,
  ShoppingCart01Icon,
  SmartPhone01Icon,
  SparklesIcon,
  SquareLock02Icon,
  StarIcon,
  Store01Icon,
  TShirtIcon,
  Tag01Icon,
  ThumbsUpIcon,
  Tick02Icon,
  TickDouble02Icon,
  TradeUpIcon,
  Undo02Icon,
  UnfoldMoreIcon,
  UserGroupIcon,
  UserIcon,
  UserMultipleIcon,
  ViewIcon,
  WifiOff01Icon,
} from '@hugeicons/core-free-icons';

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

/* The v16 boards' icon set (docs/handoff/product-v16/assets/icons), by the
   boards' own names, for the dashboard. Each is the matching Hugeicons
   glyph; the two with no match (desk, story) are the board's own drawing.
   The storefront widgets carry no icon library and inline the board files
   they need instead. shopify and wa are not here: they are stand-ins for
   the brand marks, which come from each brand's own resources. */
const desk: IconGlyph = [
  ['path', { d: 'M3 5h18v11H3V5zM9 20h6M12 16v4', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '1.7', key: '0' }],
];

const story: IconGlyph = [
  ['path', { d: 'M12 3a9 9 0 1 0 9 9', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '1.8', key: '0' }],
  ['circle', { cx: '12', cy: '12', r: '4', stroke: 'currentColor', strokeWidth: '1.8', key: '1' }],
];

export const GC_ICONS = {
  alert: ExclamationMarkIcon,
  arrow: ArrowRight02Icon,
  back: ArrowLeft01Icon,
  bag: ShoppingBag01Icon,
  bell: Notification01Icon,
  bolt: FlashIcon,
  box: PackageIcon,
  camera: Camera01Icon,
  cart: ShoppingCart01Icon,
  cash: Money01Icon,
  chat: Message01Icon,
  check: Tick02Icon,
  chev: ArrowRight01Icon,
  chevl: ArrowLeft01Icon,
  clock: Clock01Icon,
  close: Cancel01Icon,
  desk,
  dl: Download04Icon,
  doc: File02Icon,
  dots: MoreHorizontalIcon,
  down: ArrowDown01Icon,
  edit: Edit02Icon,
  expand: ArrowExpand01Icon,
  ext: LinkSquare02Icon,
  eye: ViewIcon,
  filter: FilterHorizontalIcon,
  flag: Flag02Icon,
  flip: ArrowDataTransferHorizontalIcon,
  gauge: DashboardSpeed02Icon,
  gear: Settings02Icon,
  hand: Hold01Icon,
  heart: FavouriteIcon,
  home: Home01Icon,
  image: Image01Icon,
  img: Image02Icon,
  inbox: InboxIcon,
  info: InformationCircleIcon,
  layout: Layout01Icon,
  link: Link01Icon,
  lock: SquareLock02Icon,
  lr: CodeIcon,
  mail: Mail01Icon,
  menu: Menu01Icon,
  mic: Mic01Icon,
  minus: MinusSignIcon,
  moon: Moon02Icon,
  more: MoreHorizontalIcon,
  off: WifiOff01Icon,
  pause: PauseCircleIcon,
  people: UserMultipleIcon,
  person: UserIcon,
  phone: SmartPhone01Icon,
  plus: PlusSignIcon,
  refresh: RefreshIcon,
  return: Undo02Icon,
  ruler: RulerIcon,
  save: Download04Icon,
  saved: TickDouble02Icon,
  search: Search01Icon,
  sel: UnfoldMoreIcon,
  send: ArrowRight02Icon,
  shield: Shield01Icon,
  shirt: TShirtIcon,
  spark: SparklesIcon,
  star: StarIcon,
  store: Store01Icon,
  story,
  swap: ArrowDataTransferHorizontalIcon,
  tag: Tag01Icon,
  team: UserGroupIcon,
  thumb: ThumbsUpIcon,
  trash: Delete02Icon,
  trend: TradeUpIcon,
  truck: DeliveryTruck01Icon,
  undo: ArrowTurnBackwardIcon,
  up: ArrowUp01Icon,
  user: UserIcon,
  warn: Alert02Icon,
  x: Cancel01Icon,
} satisfies Record<string, IconGlyph>;

export type GcIconName = keyof typeof GC_ICONS;

/* Icons that point along the reading direction, so they mirror in Arabic.
   The flag, the person, the camera and the rest stay as drawn. */
export const DIRECTIONAL_ICONS: ReadonlySet<GcIconName> = new Set<GcIconName>([
  'arrow',
  'back',
  'chev',
  'chevl',
  'send',
  'trend',
  'undo',
]);

export function GcIcon({
  name,
  size = 20,
  strokeWidth = 1.75,
  label,
  className,
}: {
  name: GcIconName;
  size?: number;
  strokeWidth?: number;
  /* Only for an icon that stands alone as the content (a count's bell, an
     icon-only status). An icon next to its words stays hidden. */
  label?: string;
  className?: string;
}) {
  const classes = [DIRECTIONAL_ICONS.has(name) ? 'rtl:-scale-x-100' : '', className].filter(Boolean).join(' ');
  return (
    <HugeiconsIcon
      icon={GC_ICONS[name]}
      size={size}
      strokeWidth={strokeWidth}
      color="currentColor"
      className={classes || undefined}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: false })}
    />
  );
}
