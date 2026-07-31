/** Add calendar (wall-clock) days to an ISO date. Fractional days truncate via setUTCDate. */
export function addCalendarDays(isoDate, days) {
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

/**
 * Add business days (Mon–Fri) to an ISO date.
 * Independent of working_days_per_week (that field is a capacity hours divisor,
 * not a calendar rule).
 */
export function addBusinessDays(isoDate, days) {
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00.000Z`);
  let remaining = Math.round(Number(days));
  const step = remaining >= 0 ? 1 : -1;
  remaining = Math.abs(remaining);
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/** Review due from work due + policy offsets. */
export function computeReviewDue(workDue, policy = {}, override = null) {
  if (override) return String(override).slice(0, 10);
  if (!workDue) return null;

  const lagDays = Number(policy.review_lag_days ?? 7);
  return addCalendarDays(workDue, lagDays);
}

/**
 * Materialize an ordered gate chain from an anchor date.
 * Each step's due date is previous due (or anchor for the first) + its duration.
 * Returns ordinary gate payloads: { label, dep_type, due_date }.
 */
export function materializeGateChain({ anchorDate, steps = [] }) {
  if (!anchorDate) return [];
  let cursor = String(anchorDate).slice(0, 10);
  const result = [];

  for (const step of steps) {
    const duration = Number(step.duration_days ?? 1);
    const dayKind = step.day_kind === 'calendar' ? 'calendar' : 'business';
    const due =
      dayKind === 'calendar' ? addCalendarDays(cursor, duration) : addBusinessDays(cursor, duration);
    result.push({
      label: step.label || '',
      dep_type: step.dep_type || 'input_ready',
      due_date: due,
    });
    cursor = due;
  }

  return result;
}
