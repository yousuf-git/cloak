import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { codeSchema, type CodeValues } from '@/lib/auth-schemas';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from './AuthScreen';
import { FormError } from './FormError';
import { CodeInput } from './CodeInput';

export function RecoveryCodeForm() {
  const email = useAuth((s) => s.email);
  const verifyRecoveryCode = useAuth((s) => s.verifyRecoveryCode);
  const enterRecovery = useAuth((s) => s.enterRecovery);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);

  const { handleSubmit, setValue, watch, formState: { errors } } = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  return (
    <form onSubmit={handleSubmit((v) => verifyRecoveryCode(v.code))} className="flex flex-col gap-5">
      <div className="flex justify-center">
        <span className="rounded-2xl p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <ShieldCheck className="h-6 w-6" style={{ color: 'var(--color-brand-500)' }} />
        </span>
      </div>

      <AuthHeader
        title="Enter recovery code"
        subtitle={`We sent a 6-digit code to ${email ?? 'your inbox'}.`}
        onBack={enterRecovery}
      />

      <FormError message={error} />

      <CodeInput value={watch('code')} onChange={(v) => setValue('code', v)} error={errors.code?.message} />

      <Button type="submit" disabled={busy} className="h-10 w-full">
        {busy ? 'Verifying…' : 'Continue'}
      </Button>
    </form>
  );
}
