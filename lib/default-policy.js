/** Default planning policy knobs for new cycles (SOX-style baseline). */
export const DEFAULT_POLICY_CONFIG = {
  weekly_capacity_default: 32,
  review_ratio: 0.35,
  review_lag_days: 7,
  overload_threshold: 1.0,
  spread_lag_weeks: 0,
  working_days_per_week: 5,
};
