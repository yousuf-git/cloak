import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { loginSchema, type LoginValues } from '@/lib/auth-schemas';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from './AuthScreen';
import { FormError } from './FormError';
import { RememberToggle } from './RememberToggle';

export function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const login = useAuth((s) => s.login);
  const enterRecovery = useAuth((s) => s.enterRecovery);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);
  const clearError = useAuth((s) => s.clearError);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  useEffect(() => clearError(), [clearError]);

  const onSubmit = (v: LoginValues) => login(v.email.trim(), v.password, Boolean(v.remember));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <AuthHeader title="Welcome back" subtitle="Unlock your vault with your master password." />

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

      <TextField
        label="Master password"
        revealToggle
        autoComplete="current-password"
        placeholder="••••••••••"
        icon={<Lock className="h-4 w-4" />}
        error={errors.password?.message}
        {...register('password')}
      />

      <div className="flex items-center justify-between gap-3">
        <RememberToggle
          checked={Boolean(watch('remember'))}
          onChange={(v) => setValue('remember', v)}
        />
        <button type="button" onClick={enterRecovery} className="auth-link no-drag text-xs">
          Forgot your master password?
        </button>
      </div>

      <Button type="submit" disabled={busy} className="mt-1 h-10 w-full">
        {busy ? 'Unlocking…' : 'Unlock vault'}
      </Button>

      <p className="auth-alt">
        New to Cloak?
        <button type="button" onClick={onSwitch} className="auth-link no-drag">
          Create an account
        </button>
      </p>
    </form>
  );
}
