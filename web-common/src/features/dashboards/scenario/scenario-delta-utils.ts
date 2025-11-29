/**
 * Utility functions for calculating scenario comparison deltas.
 *
 * These functions compute the difference between Main and Scenario values
 * for display in leaderboard, TDD, and pivot views.
 */

/**
 * Calculate the absolute delta between Main and Scenario values.
 * Formula: Scenario - Main
 *
 * @param mainValue - The main (baseline) measure value
 * @param scenarioValue - The scenario measure value
 * @returns The absolute difference, or null if either value is null/undefined
 */
export function calculateScenarioDelta(
  mainValue: number | null | undefined,
  scenarioValue: number | null | undefined,
): number | null {
  if (mainValue === null || mainValue === undefined) return null;
  if (scenarioValue === null || scenarioValue === undefined) return null;
  return scenarioValue - mainValue;
}

/**
 * Calculate the percentage delta between Main and Scenario values.
 * Formula: (Scenario - Main) / |Main| * 100
 *
 * Returns null if Main is 0 (to avoid division by zero) or if either value is null.
 *
 * @param mainValue - The main (baseline) measure value
 * @param scenarioValue - The scenario measure value
 * @returns The percentage difference, or null if calculation is not possible
 */
export function calculateScenarioDeltaPercent(
  mainValue: number | null | undefined,
  scenarioValue: number | null | undefined,
): number | null {
  if (mainValue === null || mainValue === undefined) return null;
  if (scenarioValue === null || scenarioValue === undefined) return null;
  if (mainValue === 0) return null; // Avoid division by zero

  return ((scenarioValue - mainValue) / Math.abs(mainValue)) * 100;
}

/**
 * Format a delta value for display.
 * Positive values get a "+" prefix.
 *
 * @param delta - The delta value to format
 * @param formatter - Optional formatter function for the numeric value
 * @returns Formatted string with sign prefix
 */
export function formatDelta(
  delta: number | null,
  formatter?: (value: number) => string,
): string {
  if (delta === null) return "-";

  const formattedValue = formatter ? formatter(Math.abs(delta)) : String(Math.abs(delta));

  if (delta > 0) {
    return `+${formattedValue}`;
  } else if (delta < 0) {
    return `-${formattedValue}`;
  }
  return formattedValue;
}

/**
 * Format a percentage delta value for display.
 *
 * @param deltaPercent - The percentage delta value
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string with sign prefix
 */
export function formatDeltaPercent(
  deltaPercent: number | null,
  decimals: number = 1,
): string {
  if (deltaPercent === null) return "-";

  const absValue = Math.abs(deltaPercent).toFixed(decimals);

  if (deltaPercent > 0) {
    return `+${absValue}%`;
  } else if (deltaPercent < 0) {
    return `-${absValue}%`;
  }
  return `${absValue}%`;
}
