/** Review due from work due + policy offsets. */
export function computeReviewDue(workDue, policy = {}, override = null) {
  if (override) return String(override).slice(0, 10);
  if (!workDue) return null;

  const d = new Date(`${String(workDue).slice(0, 10)}T00:00:00.000Z`);
  const lagDays = Number(policy.review_lag_days ?? 7);
  d.setUTCDate(d.getUTCDate() + lagDays);
  return d.toISOString().slice(0, 10);
}
