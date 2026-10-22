'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Modal, Radio, Stack, TextInput } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { getTeamCopy, type TeamCopy } from '@/lib/dashboard/team-copy';
import type { TeamView } from '@/lib/dashboard/team-model';
import type { InviteRole } from '@/lib/team/invites';
import type { TeamActionResult } from '@/app/dashboard/settings/actions';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { V16PageFrame } from '../page-frame';
import classes from './v16-team.module.css';

/* The v16 Settings page (04-dashboard.md), Team, the Team board's first
   tab. The model in lib/dashboard/team-model.ts decides what has a source;
   this file lays it out and calls the team actions (N21) it is given.
   Store details and Notifications have no board yet, so Team is the one
   tab. */

export type TeamActions = {
  invite: (input: { email: string; role: InviteRole }) => Promise<TeamActionResult>;
  resend: (input: { inviteId: string }) => Promise<TeamActionResult>;
  revoke: (input: { inviteId: string }) => Promise<TeamActionResult>;
  changeRole: (input: { profileId: string; role: InviteRole }) => Promise<TeamActionResult>;
  remove: (input: { profileId: string }) => Promise<TeamActionResult>;
};

type Status = { tone: 'ok' | 'error'; text: string } | null;

/** An address that may wrap only before its @, never mid-word. */
function Address({ value }: { value: string }) {
  const at = value.indexOf('@');
  if (at <= 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, at)}
      <wbr />
      {value.slice(at)}
    </>
  );
}

function errorText(copy: TeamCopy, result: TeamActionResult): string | null {
  return result.ok ? null : copy.errors[result.error];
}

function RolePicker({ copy, roles, value, onChange }: { copy: TeamCopy; roles: Record<InviteRole, string>; value: InviteRole; onChange: (role: InviteRole) => void }) {
  return (
    <Radio.Group label={copy.roleLabel} value={value} onChange={(next) => onChange(next as InviteRole)}>
      <Stack gap={10} mt={6}>
        {(['member', 'admin'] as const).map((role) => (
          <Radio key={role} value={role} label={roles[role]} description={copy.roleHint[role]} />
        ))}
      </Stack>
    </Radio.Group>
  );
}

function InviteDialog({
  copy,
  roles,
  opened,
  onClose,
  onSend,
}: {
  copy: TeamCopy;
  roles: Record<InviteRole, string>;
  opened: boolean;
  onClose: () => void;
  onSend: (email: string, role: InviteRole) => Promise<string | null>;
}) {
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<InviteRole>('member');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  return (
    <Modal opened={opened} onClose={onClose} title={copy.inviteSomeone} centered closeButtonProps={{ 'aria-label': copy.close }}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const failed = await onSend(email, role);
          setBusy(false);
          setError(failed);
          if (!failed) {
            setEmail('');
            setRole('member');
          }
        }}
      >
        <Stack gap={16}>
          <TextInput
            label={copy.emailLabel}
            type="email"
            dir="ltr"
            autoComplete="off"
            required
            value={email}
            error={error}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <RolePicker copy={copy} roles={roles} value={role} onChange={setRole} />
          <div className={classes.actions}>
            <Button variant="default" radius="pill" onClick={onClose}>
              {copy.cancel}
            </Button>
            <Button type="submit" radius="pill" loading={busy}>
              {copy.sendInvite}
            </Button>
          </div>
        </Stack>
      </form>
    </Modal>
  );
}

function EditDialog({
  copy,
  roles,
  person,
  onClose,
  onSave,
  onRemove,
}: {
  copy: TeamCopy;
  roles: Record<InviteRole, string>;
  person: { key: string; name: string; roleKey: string } | null;
  onClose: () => void;
  onSave: (role: InviteRole) => Promise<string | null>;
  onRemove: () => Promise<string | null>;
}) {
  const [role, setRole] = React.useState<InviteRole>(person?.roleKey === 'admin' ? 'admin' : 'member');
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const act = async (work: () => Promise<string | null>) => {
    setBusy(true);
    const failed = await work();
    setBusy(false);
    setError(failed);
  };
  return (
    <Modal
      opened={person !== null}
      onClose={onClose}
      title={person ? copy.edit(person.name) : ''}
      centered
      closeButtonProps={{ 'aria-label': copy.close }}
    >
      <Stack gap={16}>
        <RolePicker copy={copy} roles={roles} value={role} onChange={setRole} />
        {error && (
          <p className={classes.formError} role="alert">
            {error}
          </p>
        )}
        {confirming ? (
          <div className={classes.confirm}>
            <p>{person ? copy.removeConfirm(person.name) : ''}</p>
            <div className={classes.actions}>
              <Button variant="default" radius="pill" onClick={() => setConfirming(false)}>
                {copy.cancel}
              </Button>
              <Button color="danger" radius="pill" loading={busy} onClick={() => act(onRemove)}>
                {copy.remove}
              </Button>
            </div>
          </div>
        ) : (
          <div className={classes.actions}>
            <Button variant="subtle" color="danger" radius="pill" className={classes.removeButton} onClick={() => setConfirming(true)}>
              {copy.removeFromTeam}
            </Button>
            <Button variant="default" radius="pill" onClick={onClose}>
              {copy.cancel}
            </Button>
            <Button radius="pill" loading={busy} onClick={() => act(() => onSave(role))}>
              {copy.save}
            </Button>
          </div>
        )}
      </Stack>
    </Modal>
  );
}

const STORE_CHAT_ALERTS = '/dashboard/store-chat/setup?tab=behaviour';

function V16SettingsFrame({ locale, children }: { locale: SiteLocale; children: React.ReactNode }) {
  const copy = getTeamCopy(locale);
  return (
    <V16PageFrame
      badge={null}
      subtitle={copy.subtitle}
      tabsLabel={copy.tabsLabel}
      tabs={[{ label: copy.team, href: '/dashboard/settings', current: true }]}
    >
      {children}
    </V16PageFrame>
  );
}

function ChangeLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button component={Link} href={href} radius="pill" variant="default" className={classes.change}>
      {children}
    </Button>
  );
}

export function V16Team({
  view,
  locale,
  roles,
  actions,
}: {
  view: TeamView;
  locale: SiteLocale;
  /** The role names, admin and member, for the pickers. */
  roles?: Record<InviteRole, string>;
  /** The team actions, given while n21_team_invites is on. */
  actions?: TeamActions;
}) {
  const copy = getTeamCopy(locale);
  const manage = Boolean(view.manage && actions && roles);
  const [inviting, setInviting] = React.useState(false);
  const [editing, setEditing] = React.useState<TeamView['people'][number] | null>(null);
  const [status, setStatus] = React.useState<Status>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  const rowAction = async (key: string, work: () => Promise<TeamActionResult>, done: string) => {
    setPending(key);
    const result = await work();
    setPending(null);
    setStatus(result.ok ? { tone: 'ok', text: done } : { tone: 'error', text: errorText(copy, result)! });
  };

  return (
    <V16SettingsFrame locale={locale}>
      <div className={classes.page}>
        <section aria-labelledby="team-people" className={classes.card}>
          <div className={classes.headRow}>
            <div className={classes.head}>
              <h2 id="team-people" className={classes.h2}>
                {copy.people}
              </h2>
              <p className={classes.muted}>{copy.rule}</p>
            </div>
            {manage && (
              <Button radius="pill" leftSection={<GcIcon name="plus" size={16} />} onClick={() => setInviting(true)}>
                {copy.inviteSomeone}
              </Button>
            )}
          </div>
          <p className={classes.status} role="status" data-tone={status?.tone}>
            {status?.text}
          </p>
          <ul className={classes.people}>
            {view.people.map((person) => (
              <li key={person.key} className={classes.person} data-edit={person.editable && manage}>
                <span className={classes.avatar} aria-hidden="true">
                  {person.initials}
                </span>
                <span className={classes.who}>
                  <bdi className={classes.name}>{person.name}</bdi>
                  {person.email && (
                    <bdi className={classes.email}>
                      <Address value={person.email} />
                    </bdi>
                  )}
                </span>
                <span className={classes.role} data-owner={person.owner}>
                  {person.role}
                </span>
                {person.editable && manage && (
                  <Button variant="subtle" radius="pill" className={classes.rowButton} aria-label={copy.edit(person.name)} onClick={() => setEditing(person)}>
                    {copy.editButton}
                  </Button>
                )}
              </li>
            ))}
            {manage &&
              view.invites.map((invite) => (
                <li key={invite.id} className={classes.person} data-edit="true" data-invite="true">
                  <span className={`${classes.avatar} ${classes.inviteAvatar}`} aria-hidden="true">
                    <GcIcon name="mail" size={16} />
                  </span>
                  <span className={classes.who}>
                    <bdi className={classes.name}>
                      <Address value={invite.email} />
                    </bdi>
                    <span className={classes.email} data-expired={invite.expired}>
                      {invite.sent}
                      {!invite.expired && <> · {copy.notJoined}</>}
                    </span>
                  </span>
                  <span className={classes.role}>{invite.role}</span>
                  <span className={classes.rowButtons}>
                    <Button
                      variant="subtle"
                      radius="pill"
                      className={classes.rowButton}
                      aria-label={copy.resendTo(invite.email)}
                      loading={pending === `resend:${invite.id}`}
                      onClick={() => rowAction(`resend:${invite.id}`, () => actions!.resend({ inviteId: invite.id }), copy.resentTo(invite.email))}
                    >
                      {copy.resend}
                    </Button>
                    <Button
                      variant="subtle"
                      color="gray"
                      radius="pill"
                      className={classes.rowButton}
                      aria-label={copy.cancelInviteTo(invite.email)}
                      loading={pending === `revoke:${invite.id}`}
                      onClick={() => rowAction(`revoke:${invite.id}`, () => actions!.revoke({ inviteId: invite.id }), copy.canceled)}
                    >
                      {copy.cancelInvite}
                    </Button>
                  </span>
                </li>
              ))}
          </ul>
          <div className={classes.row}>
            <span className={classes.rowIcon} aria-hidden="true">
              <GcIcon name="mail" size={16} />
            </span>
            <p className={classes.rowText}>{view.alerts ?? copy.noStoreChat}</p>
            <ChangeLink href={view.alerts ? STORE_CHAT_ALERTS : '/dashboard/store-chat'}>
              {view.alerts ? copy.changeInStoreChat : copy.openStoreChat}
            </ChangeLink>
          </div>
        </section>

        {view.hours && (
          <section aria-labelledby="team-hours" className={classes.card}>
            <div className={classes.row}>
              <span className={classes.rowIcon} aria-hidden="true">
                <GcIcon name="clock" size={16} />
              </span>
              <div className={classes.rowText}>
                <h2 id="team-hours" className={classes.h3}>
                  {copy.openingHours}
                </h2>
                <p className={classes.muted}>{view.hours}</p>
                {view.outsideHours && <p className={classes.muted}>{copy.outsideHours}</p>}
              </div>
              <ChangeLink href={STORE_CHAT_ALERTS}>{copy.change}</ChangeLink>
            </div>
          </section>
        )}
      </div>
      {manage && (
        <>
          <InviteDialog
            copy={copy}
            roles={roles!}
            opened={inviting}
            onClose={() => setInviting(false)}
            onSend={async (email, role) => {
              const result = await actions!.invite({ email, role });
              if (result.ok) {
                setInviting(false);
                setStatus({ tone: 'ok', text: copy.sentTo(email.trim().toLowerCase()) });
              }
              return errorText(copy, result);
            }}
          />
          <EditDialog
            key={editing?.key ?? 'none'}
            copy={copy}
            roles={roles!}
            person={editing}
            onClose={() => setEditing(null)}
            onSave={async (role) => {
              const result = await actions!.changeRole({ profileId: editing!.key, role });
              if (result.ok) {
                setEditing(null);
                setStatus({ tone: 'ok', text: copy.saved });
              }
              return errorText(copy, result);
            }}
            onRemove={async () => {
              const name = editing!.name;
              const result = await actions!.remove({ profileId: editing!.key });
              if (result.ok) {
                setEditing(null);
                setStatus({ tone: 'ok', text: copy.removed(name) });
              }
              return errorText(copy, result);
            }}
          />
        </>
      )}
    </V16SettingsFrame>
  );
}

export function V16TeamError({ locale }: { locale: SiteLocale }) {
  return (
    <V16SettingsFrame locale={locale}>
      <p className={`${classes.card} ${classes.error}`} role="status">
        {getTeamCopy(locale).couldNotLoad}
      </p>
    </V16SettingsFrame>
  );
}
