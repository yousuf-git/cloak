import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { signupSchema, type SignupValues } from '@/lib/auth-schemas';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from './AuthScreen';
import { FormError } from './FormError';
import { RememberToggle } from './RememberToggle';
import { PasswordMeter } from './PasswordMeter';

export function SignupForm({ onSwitch }: { onSwitch: () => void }) {
  const signup = useAuth((s) => s.signup);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);
  const clearError = useAuth((s) => s.clearError);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', confirm: '', remember: false },
  });

  useEffect(() => clearError(), [clearError]);

  const password = watch('password');

  const onSubmit = (v: SignupValues) => signup(v.email.trim(), v.password, Boolean(v.remember));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <AuthHeader title="Create your vault" subtitle="One master password protects everything." />

      <FormError message={error} />

      <TextField
        label="Email"
        type="email"
        autoFocus
        autoComplete="username"
        placeholder="you@company.com"
        icon={<Mail className="h-4 w-4" />}
        error={errors.email?.message}
        {...register('email')}
      />

      <div className="flex flex-col gap-1.5">
        <TextField
          label="Master password"
          revealToggle
          autoComplete="new-password"
          placeholder="At least 10 characters"
          icon={<Lock className="h-4 w-4" />}
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordMeter password={password} />
      </div>

      <TextField
        label="Confirm master password"
        revealToggle
        autoComplete="new-password"
        placeholder="Re-enter your password"
        icon={<Lock className="h-4 w-4" />}
        error={errors.confirm?.message}
        {...register('confirm')}
      />

      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]"
        style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-fg-muted)' }}
      >
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-brand-500)' }} />
        <span>
          Your master password is never sent to our servers. If you forget it, you can regain access
          with the one-time <strong>recovery key</strong> we&apos;ll show you next — so keep it safe.
        </span>
      </div>

      <RememberToggle
        checked={Boolean(watch('remember'))}
        onChange={(v) => setValue('remember', v)}
      />

      <Button type="submit" disabled={busy} className="mt-1 h-10 w-full">
        {busy ? 'Creating vault…' : 'Create vault'}
      </Button>

      <p className="text-center text-xs" style={{ color: 'var(--color-fg-muted)' }}>
        Already have a vault?{' '}
        <button type="button" onClick={onSwitch} className="no-drag font-medium" style={{ color: 'var(--color-brand-500)' }}>
          Sign in
        </button>
      </p>
    </form>
  );
}
