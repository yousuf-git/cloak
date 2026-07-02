/** Parse a short duration string like "15m", "30d", "12h", "45s" into milliseconds. */
const MULTIPLIERS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${input}`);
  }
  const value = Number(match[1]);
  const unit = match[2] as string;
  const multiplier = MULTIPLIERS[unit];
  if (multiplier === undefined) {
    throw new Error(`Invalid duration unit: ${input}`);
  }
  return value * multiplier;
}

export function futureDate(durationMs: number): Date {
  return new Date(Date.now() + durationMs);
}
