import { useMemo } from 'react';

interface Strength {
  score: number; // 0..4
  label: string;
  color: string;
}

function scorePassword(pw: string): Strength {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  score = Math.min(4, score);

  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#dc2626', '#dc2626', '#d97706', '#16a34a', '#16a34a'];
  return { score, label: labels[score]!, color: colors[score]! };
}

export function PasswordMeter({ password }: { password: string }) {
  const strength = useMemo(() => scorePassword(password ?? ''), [password]);
  if (!password) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{
              backgroundColor: i < strength.score ? strength.color : 'var(--color-border)',
            }}
          />
        ))}
      </div>
      <span className="text-[11px] font-medium" style={{ color: strength.color }}>
        {strength.label}
      </span>
    </div>
  );
}
