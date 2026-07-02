import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, LifeBuoy } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from './AuthScreen';
import { FormError } from './FormError';

const schema = z.object({ email: z.string().min(1, 'Email is required').email('Enter a valid email') });
type Values = z.infer<typeof schema>;

export function RecoveryEmailForm() {
  const startRecovery = useAuth((s) => s.startRecovery);
  const cancelRecovery = useAuth((s) => s.cancelRecovery);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);

  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  return (
    <form onSubmit={handleSubmit((v) => startRecovery(v.email.trim()))} className="flex flex-col gap-5">
      <div className="flex justify-center">
        <span className="rounded-2xl p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <LifeBuoy className="h-6 w-6" style={{ color: 'var(--color-brand-500)' }} />
        </span>
      </div>

      <AuthHeader
        title="Recover your vault"
        subtitle="Enter your email and we'll send a code to verify it's you. You'll also need your recovery key."
        onBack={cancelRecovery}
      />

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

      <Button type="submit" disabled={busy} className="h-10 w-full">
        {busy ? 'Sending…' : 'Send recovery code'}
      </Button>
    </form>
  );
}
