import type { PanelCopy } from '../i18n';
import { formatTeamTime } from '../panel-state';
import type { MessengerLocale } from '@/lib/messenger/types';

/* The v16 header's status (Chat-Home): "Assistant answers now · team here
   until 10 pm". The assistant half shows whenever the assistant will
   answer, the team half follows opening hours, and the dot is lit only
   when someone or something really answers now. */
export function v16StatusLine(
  {
    aiEnabled,
    available,
    afterHours,
    team,
  }: {
    aiEnabled: boolean;
    /** Within opening hours. */
    available: boolean;
    /** The assistant keeps answering outside them (N23). */
    afterHours: boolean;
    team: { open: boolean; opensAt: string | null; closesAt: string | null } | null | undefined;
  },
  t: PanelCopy,
  locale: MessengerLocale,
): { text: string; live: boolean } {
  const assistantAnswers = aiEnabled && (available || afterHours);
  const teamOpen = team ? team.open : available;
  const teamHalf = !team
    ? null
    : team.open
      ? team.closesAt
        ? t.teamHereUntil(formatTeamTime(team.closesAt, locale))
        : null
      : team.opensAt
        ? t.teamAwayUntil(formatTeamTime(team.opensAt, locale))
        : t.teamAway;
  const parts = [assistantAnswers ? t.assistantNow : null, teamHalf].filter((part): part is string => !!part);
  if (!parts.length) return { text: teamOpen ? '' : t.offlineNote, live: teamOpen };
  const text = parts.join(' · ');
  // "team away until 10 am" leads the line when the assistant is not answering.
  return { text: text.charAt(0).toUpperCase() + text.slice(1), live: assistantAnswers || teamOpen };
}
