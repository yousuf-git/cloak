import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, MailWarning } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { codeSchema, type CodeValues } from '@/lib/auth-schemas';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from './AuthScreen';
import { FormError } from './FormError';
import { FormNotice } from './FormNotice';
import { CodeInput } from './CodeInput';

/** Seconds before another code can be requested — matches nothing on the server, it just stops mashing. */
const RESEND_COOLDOWN = 30;

export function VerifyEmailForm() {
  const email = useAuth((s) => s.email);
  const verifyEmail = useAuth((s) => s.verifyEmail);
  const resendVerification = useAuth((s) => s.resendVerification);
  const returnToLogin = useAuth((s) => s.returnToLogin);
  const resumed = useAuth((s) => s.resumedVerification);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);
  const notice = useAuth((s) => s.notice);

  // Login already sent a code on the way in, so the returning user starts on
  // cooldown rather than being invited to immediately ask for another.
  const [cooldown, setCooldown] = useState(resumed ? RESEND_COOLDOWN : 0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const { handleSubmit, setValue, watch, formState: { errors } } = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = (v: CodeValues) => verifyEmail(v.code);

  const resend = async () => {
    setResending(true);
    const sent = await resendVerification();
    setResending(false);
    if (sent) setCooldown(RESEND_COOLDOWN);
  };

  const Icon = resumed ? MailWarning : MailCheck;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex justify-center">
        <span className="auth-icon rounded-xl p-3">
          <Icon className="h-6 w-6" style={{ color: 'var(--color-accent)' }} />
        </span>
      </div>

      <AuthHeader
        title={resumed ? 'Finish setting up your vault' : 'Verify your email'}
        subtitle={
          resumed
            ? `This account was created but never verified, so it stays locked. Enter the 6-digit code we just sent to ${email ?? 'your inbox'}.`
            : `We sent a 6-digit code to ${email ?? 'your inbox'}. Enter it to activate your vault.`
        }
        onBack={() => returnToLogin()}
      />

      <FormError message={error} />
      <FormNotice message={error ? null : notice} />

      <CodeInput value={watch('code')} onChange={(v) => setValue('code', v)} error={errors.code?.message} />

      <Button type="submit" disabled={busy} className="h-10 w-full">
        {busy ? 'Verifying…' : 'Verify & open vault'}
      </Button>

      <div className="flex flex-col items-center gap-1">
        <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
          Codes expire after 10 minutes.
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={busy || resending || cooldown > 0}
          className="auth-link no-drag text-xs disabled:cursor-default disabled:no-underline"
          style={cooldown > 0 ? { color: 'var(--color-fg-muted)', opacity: 0.75 } : undefined}
        >
          {resending
            ? 'Sending…'
            : cooldown > 0
              ? `Send a new code in ${cooldown}s`
              : "Didn't get it? Send a new code"}
        </button>
      </div>
    </form>
  );
}
