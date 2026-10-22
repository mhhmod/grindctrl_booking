/* Copy for the v16 Settings page, Team (04-dashboard.md, the Team board).
   The board's strings are drafts; the pull request lists the ones written
   here; the role names are the shell's (shell-copy.ts). The Arabic is simple Modern Standard Arabic in neutral forms, with
   Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { arCount } from './today-copy';

export interface TeamCopy {
  subtitle: string;
  tabsLabel: string;
  team: string;
  people: string;
  rule: string;
  /** "a, b and c" in the language's own way. */
  list: (items: string[]) => string;
  alertsTo: (addresses: string) => string;
  alertsOff: string;
  alertsNobody: string;
  changeInStoreChat: string;
  openingHours: string;
  hoursAlways: string;
  hoursNone: string;
  /** "Saturday to Thursday", "Saturday and Sunday", or one day. */
  dayRun: (first: string, last: string, length: number) => string;
  span: (from: string, to: string) => string;
  /** One run of days and its hours; the first run of the sentence, then each after it. */
  hoursRun: (days: string, spans: string, first: boolean) => string;
  hoursSentence: (runs: string[], zone: string | null) => string;
  time: (minute: number) => string;
  outsideHours: string;
  change: string;
  noStoreChat: string;
  openStoreChat: string;
  couldNotLoad: string;
  inviteSomeone: string;
  editButton: string;
  edit: (name: string) => string;
  invitedAgo: (days: number) => string;
  inviteExpired: string;
  notJoined: string;
  resend: string;
  resendTo: (email: string) => string;
  cancelInvite: string;
  cancelInviteTo: (email: string) => string;
  invited: string;
  emailLabel: string;
  roleLabel: string;
  roleHint: Record<'admin' | 'member', string>;
  sendInvite: string;
  cancel: string;
  close: string;
  save: string;
  removeFromTeam: string;
  removeConfirm: (name: string) => string;
  remove: string;
  sentTo: (email: string) => string;
  resentTo: (email: string) => string;
  saved: string;
  removed: (name: string) => string;
  canceled: string;
  errors: Record<'already_member' | 'not_allowed' | 'invite_expired' | 'not_found' | 'invalid_email' | 'daily_limit' | 'failed', string>;
}

function twelveHour(minute: number): { time: string; pm: boolean } {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = minute % 60;
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return { time: minutes === 0 ? String(twelve) : `${twelve}:${String(minutes).padStart(2, '0')}`, pm: hours >= 12 };
}

const en: TeamCopy = {
  subtitle: 'Who works in GrindCTRL, when they’re alerted, and how shoppers reach you.',
  tabsLabel: 'Settings',
  team: 'Team',
  people: 'People',
  rule: 'Owners see everything, including billing. Admins manage settings. Members answer chats and keep answers up to date.',
  list: (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`),
  alertsTo: (addresses) => `Email alerts go to ${addresses} when a shopper needs a person.`,
  alertsOff: 'Email alerts are off, so nobody is emailed when a shopper needs a person.',
  alertsNobody: 'Email alerts are on, but nobody on the team has an email address to send them to.',
  changeInStoreChat: 'Change in Store Chat',
  openingHours: 'Opening hours',
  hoursAlways: 'Always open.',
  hoursNone: 'No opening hours are set.',
  dayRun: (first, last, length) => (length === 1 ? first : length === 2 ? `${first} and ${last}` : `${first} to ${last}`),
  span: (from, to) => `${from} to ${to}`,
  hoursRun: (days, spans) => `${days} ${spans}`,
  hoursSentence: (runs, zone) => `${runs.join(', ')}${zone ? `, ${zone}` : ''}.`,
  time: (minute) => {
    if (minute % 1440 === 0) return 'midnight';
    const { time, pm } = twelveHour(minute);
    return `${time} ${pm ? 'pm' : 'am'}`;
  },
  outsideHours: 'Outside your opening hours nobody is alerted. The assistant keeps answering and asks where the team should reply.',
  change: 'Change',
  noStoreChat: 'Store Chat isn’t set up for this store yet, so nobody is alerted when a shopper needs a person.',
  openStoreChat: 'Open Store Chat',
  couldNotLoad: "Your team couldn't load just now. Refresh in a minute.",
  inviteSomeone: 'Invite someone',
  editButton: 'Edit',
  edit: (name) => `Edit ${name}`,
  invitedAgo: (days) => (days === 0 ? 'Invited today' : days === 1 ? 'Invited yesterday' : `Invited ${days} days ago`),
  inviteExpired: 'Invite expired',
  notJoined: 'Hasn’t joined yet',
  resend: 'Resend',
  resendTo: (email) => `Resend the invite to ${email}`,
  cancelInvite: 'Cancel',
  cancelInviteTo: (email) => `Cancel the invite to ${email}`,
  invited: 'Invited',
  emailLabel: 'Email',
  roleLabel: 'Role',
  roleHint: {
    admin: 'Manages settings, answers chats and keeps answers up to date. No billing.',
    member: 'Answers chats and keeps answers up to date.',
  },
  sendInvite: 'Send invite',
  cancel: 'Cancel',
  close: 'Close',
  save: 'Save',
  removeFromTeam: 'Remove from the team',
  removeConfirm: (name) => `Remove ${name}? They lose access to this store’s dashboard.`,
  remove: 'Remove',
  sentTo: (email) => `Invite sent to ${email}.`,
  resentTo: (email) => `Invite sent again to ${email}.`,
  saved: 'Saved.',
  removed: (name) => `${name} is no longer on the team.`,
  canceled: 'Invite canceled.',
  errors: {
    already_member: 'They’re already on your team.',
    not_allowed: 'You can’t do that on this team.',
    invite_expired: 'That invite has expired. Send a new one.',
    not_found: 'That invite or person is no longer here. Refresh the page.',
    invalid_email: 'Enter a full email address.',
    daily_limit: 'You’ve sent 20 invites today. Try again tomorrow.',
    failed: 'That didn’t work. Try again in a minute.',
  },
};

const ar: TeamCopy = {
  subtitle: 'من يعمل في GrindCTRL، ومتى يتلقى التنبيهات، وكيف يصل إليك المتسوقون.',
  tabsLabel: 'الإعدادات',
  team: 'الفريق',
  people: 'الأشخاص',
  rule: 'المالكون يرون كل شيء، بما في ذلك الفوترة. المسؤولون يديرون الإعدادات. الأعضاء يردون على المحادثات ويُبقون الإجابات محدّثة.',
  list: (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join('، ')} و${items[items.length - 1]}`),
  alertsTo: (addresses) => `تُرسل تنبيهات البريد الإلكتروني إلى ${addresses} عندما تحتاج متسوقة إلى شخص من الفريق.`,
  alertsOff: 'تنبيهات البريد الإلكتروني متوقفة، فلا يصل بريد لأحد عندما تحتاج متسوقة إلى شخص من الفريق.',
  alertsNobody: 'تنبيهات البريد الإلكتروني مفعّلة، لكن لا يوجد في الفريق عنوان بريد تُرسل إليه.',
  changeInStoreChat: 'غيّر ذلك في دردشة المتجر',
  openingHours: 'ساعات العمل',
  hoursAlways: 'مفتوح دائماً.',
  hoursNone: 'لم تُحدَّد ساعات العمل.',
  dayRun: (first, last, length) => (length === 1 ? first : length === 2 ? `${first} و${last}` : `من ${first} إلى ${last}`),
  span: (from, to) => `من ${from} إلى ${to}`,
  hoursRun: (days, spans, first) => `${first ? '' : 'و'}${days} ${spans}`,
  hoursSentence: (runs, zone) => `${runs.join('، ')}${zone ? `، ${zone}` : ''}.`,
  time: (minute) => {
    if (minute % 1440 === 0) return 'منتصف الليل';
    const { time, pm } = twelveHour(minute);
    return `${time} ${pm ? 'م' : 'ص'}`;
  },
  outsideHours: 'خارج ساعات العمل لا يُنبَّه أحد. يواصل المساعد الرد، ويسأل المتسوقة أين يرد عليها الفريق.',
  change: 'تغيير',
  noStoreChat: 'دردشة المتجر غير مُعدّة لهذا المتجر بعد، فلا يُنبَّه أحد عندما تحتاج متسوقة إلى شخص من الفريق.',
  openStoreChat: 'افتح دردشة المتجر',
  couldNotLoad: 'تعذّر تحميل فريقك الآن. حدّث الصفحة بعد دقيقة.',
  inviteSomeone: 'ادعُ شخصاً',
  editButton: 'تعديل',
  edit: (name) => `تعديل ${name}`,
  invitedAgo: (days) =>
    days === 0
      ? 'أُرسلت الدعوة اليوم'
      : days === 1
        ? 'أُرسلت الدعوة أمس'
        : `أُرسلت الدعوة قبل ${arCount(days, { one: 'يوم', two: 'يومين', few: (k) => `${k} أيام`, many: (k) => `${k} يوماً` })}`,
  inviteExpired: 'انتهت صلاحية الدعوة',
  notJoined: 'لم ينضم بعد',
  resend: 'أعد الإرسال',
  resendTo: (email) => `أعد إرسال الدعوة إلى ${email}`,
  cancelInvite: 'إلغاء',
  cancelInviteTo: (email) => `ألغِ الدعوة المرسلة إلى ${email}`,
  invited: 'مدعو',
  emailLabel: 'البريد الإلكتروني',
  roleLabel: 'الدور',
  roleHint: {
    admin: 'يدير الإعدادات، ويرد على المحادثات، ويُبقي الإجابات محدّثة. دون الفوترة.',
    member: 'يرد على المحادثات ويُبقي الإجابات محدّثة.',
  },
  sendInvite: 'أرسل الدعوة',
  cancel: 'إلغاء',
  close: 'إغلاق',
  save: 'حفظ',
  removeFromTeam: 'أزِل من الفريق',
  removeConfirm: (name) => `إزالة ${name}؟ لن يتمكن من دخول لوحة تحكم هذا المتجر.`,
  remove: 'إزالة',
  sentTo: (email) => `أُرسلت الدعوة إلى ${email}.`,
  resentTo: (email) => `أُعيد إرسال الدعوة إلى ${email}.`,
  saved: 'تم الحفظ.',
  removed: (name) => `لم يعد ${name} في الفريق.`,
  canceled: 'أُلغيت الدعوة.',
  errors: {
    already_member: 'هذا الشخص في فريقك بالفعل.',
    not_allowed: 'لا يمكنك فعل ذلك في هذا الفريق.',
    invite_expired: 'انتهت صلاحية هذه الدعوة. أرسل دعوة جديدة.',
    not_found: 'لم تعد هذه الدعوة أو هذا الشخص موجوداً. حدّث الصفحة.',
    invalid_email: 'أدخل عنوان بريد إلكتروني كاملاً.',
    daily_limit: 'أرسلت 20 دعوة اليوم. حاول مجدداً غداً.',
    failed: 'لم ينجح ذلك. حاول مجدداً بعد دقيقة.',
  },
};

export function getTeamCopy(locale: SiteLocale): TeamCopy {
  return locale === 'ar' ? ar : en;
}
