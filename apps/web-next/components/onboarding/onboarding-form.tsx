'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, NativeSelect, Stack, TextInput, Textarea } from '@mantine/core';
import { submitOnboarding, type OnboardingFormState } from '@/app/onboarding/actions';
import type { AuthCopy } from '@/lib/auth/auth-i18n';
import type { OnboardingProfile } from '@/lib/onboarding/profile';

const INITIAL_STATE: OnboardingFormState = { errors: {} };

/* This form is filled on a phone far more often than on a desktop, so every
   input keeps the 44px minimum comfortable touch target. */
const FIELD = { radius: 'input', size: 'md', styles: { input: { minHeight: 44 } } } as const;

export function OnboardingForm({
  profile,
  copy,
  next,
}: {
  profile: OnboardingProfile | null;
  copy: AuthCopy;
  /** The page this account was on its way to; the action checks it again. */
  next?: string | null;
}) {
  const [state, formAction] = useActionState(submitOnboarding, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  /* Move focus to the first field the server rejected. Without this, a
     keyboard or screen reader user is left at the submit button with no idea
     which field failed. */
  useEffect(() => {
    const firstError = Object.keys(state.errors)[0];
    if (!firstError) return;
    const field = formRef.current?.elements.namedItem(firstError);
    if (field instanceof HTMLElement) field.focus();
  }, [state]);

  const value = (key: keyof OnboardingProfile) =>
    String(state.values?.[key as keyof typeof state.values] ?? profile?.[key] ?? '');

  return (
    <form ref={formRef} action={formAction}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Stack gap="md">
        {state.message ? (
          <Alert color="danger" variant="light" role="alert">
            {state.message}
          </Alert>
        ) : null}

        <TextInput
          {...FIELD}
          name="fullName"
          label={copy.fieldName}
          required
          error={state.errors.fullName}
          autoComplete="name"
          defaultValue={value('fullName')}
        />

        <TextInput
          {...FIELD}
          name="phone"
          label={copy.fieldPhone}
          description={copy.fieldPhoneHint}
          required
          error={state.errors.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+20 100 000 0000"
          /* A phone number reads left to right in Arabic too. */
          dir="ltr"
          defaultValue={value('phone')}
        />

        <TextInput
          {...FIELD}
          name="companyName"
          label={copy.fieldCompany}
          required
          error={state.errors.companyName}
          autoComplete="organization"
          defaultValue={value('companyName')}
        />

        <TextInput
          {...FIELD}
          name="website"
          label={copy.fieldWebsite}
          description={copy.fieldWebsiteHint}
          required
          error={state.errors.website}
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="yourstore.com"
          dir="ltr"
          defaultValue={value('website')}
        />

        {/* Native select on purpose: it gets the platform picker on mobile for
            free, which beats any custom listbox we would have to make
            accessible ourselves. */}
        <NativeSelect
          {...FIELD}
          name="storePlatform"
          label={copy.fieldPlatform}
          required
          error={state.errors.storePlatform}
          data={[{ value: '', label: copy.selectPlaceholder, disabled: true }, ...copy.platforms]}
          defaultValue={value('storePlatform')}
        />

        <NativeSelect
          {...FIELD}
          name="monthlyOrders"
          label={copy.fieldOrders}
          required
          error={state.errors.monthlyOrders}
          data={[{ value: '', label: copy.selectPlaceholder, disabled: true }, ...copy.orderRanges]}
          defaultValue={value('monthlyOrders')}
        />

        <Textarea
          radius="input"
          size="md"
          name="primaryGoal"
          label={copy.fieldGoal}
          description={copy.fieldGoalHint}
          rows={3}
          resize="vertical"
          defaultValue={value('primaryGoal')}
        />

        <SubmitButton copy={copy} />
      </Stack>
    </form>
  );
}

function SubmitButton({ copy }: { copy: AuthCopy }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" radius="pill" h={44} mt={4} loading={pending}>
      {pending ? copy.submitting : copy.submit}
    </Button>
  );
}
