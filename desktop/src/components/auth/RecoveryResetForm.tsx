import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Lock } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from './AuthScreen';
import { FormError } from './FormError';
import { RememberToggle } from './RememberToggle';
import { PasswordMeter } from './PasswordMeter';

const schema = z
  .object({
    recoveryKey: z.string().min(1, 'Enter your recovery key'),
    password: z.string().min(10, 'Use at least 10 characters').max(128, 'Too long'),
    confirm: z.string(),
    remember: z.boolean().optional(),
  })
  .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type Values = z.infer<typeof schema>;

export function RecoveryResetForm() {
  const completeRecovery = useAuth((s) => s.completeRecovery);
  const cancelRecovery = useAuth((s) => s.cancelRecovery);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { recoveryKey: '', password: '', confirm: '', remember: false },
  });

  const onSubmit = (v: Values) =>
    completeRecovery(v.recoveryKey.trim(), v.password, Boolean(v.remember));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <AuthHeader
        title="Set a new master password"
        subtitle="Enter your recovery key to unlock the vault, then choose a new master password."
        onBack={() => cancelRecovery()}
      />

      <FormError message={error} />

      <TextField
        label="Recovery key"
        autoFocus
        placeholder="XXXX-XXXX-XXXX-XXXX-…"
        icon={<KeyRound className="h-4 w-4" />}
        error={errors.recoveryKey?.message}
        className="font-mono"
        {...register('recoveryKey')}
      />

      <div className="flex flex-col gap-1.5">
        <TextField
          label="New master password"
          revealToggle
          autoComplete="new-password"
          placeholder="At least 10 characters"
          icon={<Lock className="h-4 w-4" />}
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordMeter password={watch('password')} />
      </div>

      <TextField
        label="Confirm new password"
        revealToggle
        autoComplete="new-password"
        placeholder="Re-enter your password"
        icon={<Lock className="h-4 w-4" />}
        error={errors.confirm?.message}
        {...register('confirm')}
      />

      <RememberToggle checked={Boolean(watch('remember'))} onChange={(v) => setValue('remember', v)} />

      <Button type="submit" disabled={busy} className="mt-1 h-10 w-full">
        {busy ? 'Recovering…' : 'Recover & unlock vault'}
      </Button>
    </form>
  );
}
