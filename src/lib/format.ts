const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const money = (n: number) => inr.format(Math.round(n));
export const pct = (n: number | null, digits = 1) => (n == null || !isFinite(n) ? '—' : `${(n * 100).toFixed(digits)}%`);
export const date = (iso: string) =>
  new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const uid = () => crypto.randomUUID();
