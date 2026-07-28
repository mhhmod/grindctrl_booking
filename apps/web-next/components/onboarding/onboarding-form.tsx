'use client';

import { useActionState, useEffect, useId, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { submitOnboarding, type OnboardingFormState } from '@/app/onboarding/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OnboardingProfile } from '@/lib/onboarding/profile';
import { cn } from '@/lib/utils';

const PLATFORMS = ['Shopify', 'WooCommerce', 'Salla', 'Zid', 'Custom build', 'Not live yet'];
const ORDER_RANGES = [
  'Under 100 a month',
  '100 to 500 a month',
  '500 to 2000 a month',
  'Over 2000 a month',
];

const INITIAL_STATE: OnboardingFormState = { errors: {} };

/* Inputs are h-11 rather than the default h-9: this form is filled on a phone
   far more often than on a desktop, and 44px is the minimum comfortable
   touch target. */
const FIELD_CLASS = 'h-11 md:h-10';

export function OnboardingForm({ profile }: { profile: OnboardingProfile | null }) {
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
    state.values?.[key as keyof typeof state.values] ?? profile?.[key] ?? '';

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      {state.message ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <Field
        name="fullName"
        label="Your name"
        required
        error={state.errors.fullName}
        inputProps={{ autoComplete: 'name', defaultValue: value('fullName') }}
      />

      <Field
        name="phone"
        label="Phone number"
        required
        hint="Include the country code so we can reach you on WhatsApp."
        error={state.errors.phone}
        inputProps={{
          type: 'tel',
          inputMode: 'tel',
          autoComplete: 'tel',
          placeholder: '+20 100 000 0000',
          defaultValue: value('phone'),
        }}
      />

      <Field
        name="companyName"
        label="Store or company name"
        required
        error={state.errors.companyName}
        inputProps={{ autoComplete: 'organization', defaultValue: value('companyName') }}
      />

      <Field
        name="website"
        label="Store website"
        required
        hint="We look at your product pages before the call."
        error={state.errors.website}
        inputProps={{
          type: 'url',
          inputMode: 'url',
          autoComplete: 'url',
          placeholder: 'yourstore.com',
          defaultValue: value('website'),
        }}
      />

      <SelectField
        name="storePlatform"
        label="Where does your store run?"
        options={PLATFORMS}
        error={state.errors.storePlatform}
        defaultValue={String(value('storePlatform'))}
      />

      <SelectField
        name="monthlyOrders"
        label="Roughly how many orders a month?"
        options={ORDER_RANGES}
        error={state.errors.monthlyOrders}
        defaultValue={String(value('monthlyOrders'))}
      />

      <TextAreaField
        name="primaryGoal"
        label="What do you want AI to fix first?"
        hint="Optional. One line is enough."
        defaultValue={String(value('primaryGoal'))}
      />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-1 h-11 rounded-full" disabled={pending}>
      {pending ? 'Saving...' : 'Go to my dashboard'}
    </Button>
  );
}

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  inputProps?: React.ComponentProps<typeof Input>;
};

function Field({ name, label, hint, error, required, inputProps }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} label={label} required={required} />
      <Input
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hint && hintId, error && errorId) || undefined}
        className={FIELD_CLASS}
        {...inputProps}
      />
      <FieldFooter hint={hint} hintId={hintId} error={error} errorId={errorId} />
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
  error,
  defaultValue,
}: {
  name: string;
  label: string;
  options: string[];
  error?: string;
  defaultValue: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} label={label} required />
      {/* Native select on purpose: it gets the platform picker on mobile for
          free, which beats any custom listbox we would have to make
          accessible ourselves. */}
      <select
        id={id}
        name={name}
        required
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-11 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:h-10 md:text-sm"
      >
        <option value="" disabled>
          Select an option
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FieldFooter error={error} errorId={errorId} />
    </div>
  );
}

function TextAreaField({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} label={label} />
      <textarea
        id={id}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        aria-describedby={hint ? hintId : undefined}
        className="w-full min-w-0 resize-y rounded-3xl border border-input bg-input/30 px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
      />
      <FieldFooter hint={hint} hintId={hintId} />
    </div>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-sm font-medium">
      {label}
      {required ? (
        <span className="ms-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      ) : null}
    </Label>
  );
}

function FieldFooter({
  hint,
  hintId,
  error,
  errorId,
}: {
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
}) {
  if (error) {
    return (
      <p id={errorId} role="alert" className="text-xs text-destructive">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={hintId} className="text-xs text-muted-foreground">
        {hint}
      </p>
    );
  }
  return null;
}
