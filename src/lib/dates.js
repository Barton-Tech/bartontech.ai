export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function shiftDays(date, delta) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// GitHub Actions cron is best-effort: runs can be delayed or skipped entirely.
// Every run looks back over a window and reports which dates are missing, so a
// skipped night is backfilled rather than becoming a permanent hole.
export function missingDates(window, hasDate, end = today()) {
  const gaps = [];
  for (let i = window - 1; i >= 0; i -= 1) {
    const date = shiftDays(end, -i);
    if (!hasDate(date)) gaps.push(date);
  }
  return gaps;
}
