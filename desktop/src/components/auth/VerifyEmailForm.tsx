import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { codeSchema, type CodeValues } from '@/lib/auth-schemas';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from './AuthScreen';
import { FormError } from './FormError';
import { CodeInput } from './CodeInput';

export function VerifyEmailForm() {
  const email = useAuth((s) => s.email);
  const verifyEmail = useAuth((s) => s.verifyEmail);
  const returnToLogin = useAuth((s) => s.returnToLogin);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);

  const { handleSubmit, setValue, watch, formState: { errors } } = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = (v: CodeValues) => verifyEmail(v.code);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex justify-center">
        <span className="rounded-2xl p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
          <MailCheck className="h-6 w-6" style={{ color: 'var(--color-brand-500)' }} />
        </span>
      </div>

      <AuthHeader
        title="Verify your email"
        subtitle={`We sent a 6-digit code to ${email ?? 'your inbox'}. Enter it to activate your vault.`}
        onBack={() => returnToLogin()}
      />

      <FormError message={error} />

      <CodeInput value={watch('code')} onChange={(v) => setValue('code', v)} error={errors.code?.message} />

      <Button type="submit" disabled={busy} className="h-10 w-full">
        {busy ? 'Verifying…' : 'Verify & continue'}
      </Button>
    </form>
  );
}
