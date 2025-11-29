<script lang="ts">
  import { selectedDimensionValues } from "@rilldata/web-common/features/dashboards/state-managers/selectors/dimension-filters";
  import { getStateManagers } from "@rilldata/web-common/features/dashboards/state-managers/state-managers";
  import type {
    MetricsViewSpecScenario,
    V1Expression,
    V1TimeRange,
  } from "@rilldata/web-common/runtime-client";
  import { runtime } from "@rilldata/web-common/runtime-client/runtime-store";
  import type { DimensionThresholdFilter } from "web-common/src/features/dashboards/stores/explore-state";
  import Leaderboard from "./Leaderboard.svelte";
  import LeaderboardControls from "./LeaderboardControls.svelte";
  import { COMPARISON_COLUMN_WIDTH, DEFAULT_COLUMN_WIDTH, valueColumn } from "./leaderboard-widths";

  export let metricsViewName: string;
  export let whereFilter: V1Expression;
  export let dimensionThresholdFilters: DimensionThresholdFilter[];
  export let timeRange: V1TimeRange;
  export let comparisonTimeRange: V1TimeRange | undefined;
  export let timeControlsReady: boolean;

  const StateManagers = getStateManagers();
  const {
    selectors: {
      numberFormat: { measureFormatters, activeMeasureFormatter },
      dimensionFilters: { isFilterExcludeMode },
      dimensions: { visibleDimensions },
      comparison: { isBeingCompared: isBeingComparedReadable },
      sorting: { sortedAscending, sortType },
      measures: { measureLabel, isMeasureValidPercentOfTotal },
      leaderboard: {
        leaderboardShowContextForAllMeasures,
        leaderboardMeasures,
        leaderboardSortByMeasureName,
      },
    },
    actions: {
      dimensions: { setPrimaryDimension },
      sorting: { toggleSort },
      dimensionsFilter: { toggleDimensionValueSelection },
      comparison: { toggleComparisonDimension },
    },
    exploreName,
    dashboardStore,
    validSpecStore,
  } = StateManagers;

  // Helper function to get scenario label from name
  function getScenarioLabel(
    scenarios: MetricsViewSpecScenario[],
    scenarioName: string | undefined,
  ): string {
    if (!scenarioName) return "Main";
    const scenario = scenarios.find((s) => s.name === scenarioName);
    return scenario?.label || scenario?.name || scenarioName;
  }

  let parentElement: HTMLDivElement;

  $: ({ instanceId } = $runtime);

  // Reset column widths when the measure changes
  $: if ($leaderboardSortByMeasureName) {
    valueColumn.reset();
  }

  $: dimensionColumnWidth = 164;

  $: showPercentOfTotal = $isMeasureValidPercentOfTotal(
    $leaderboardSortByMeasureName,
  );
  $: showDeltaPercent = !!comparisonTimeRange;

  // Scenario comparison state
  $: metricsViewSpec = $validSpecStore.data?.metricsView ?? {};
  $: scenarios = metricsViewSpec.scenarios ?? [];
  $: showScenarioComparison = $dashboardStore?.showScenarioComparison ?? false;
  $: selectedScenario = $dashboardStore?.selectedScenario;
  $: scenarioLabel = getScenarioLabel(scenarios, selectedScenario);
  $: scenarioDeltaAbsolute = $dashboardStore?.scenarioDeltaAbsolute ?? false;
  $: scenarioDeltaPercent = $dashboardStore?.scenarioDeltaPercent ?? false;

  // Calculate number of scenario delta columns (excluding the value column which is wider)
  $: scenarioDeltaColumnCount = showScenarioComparison
    ? (scenarioDeltaAbsolute ? 1 : 0) + (scenarioDeltaPercent ? 1 : 0)
    : 0;

  // Scenario value column uses DEFAULT_COLUMN_WIDTH for proper bar display
  $: scenarioValueColumnWidth = showScenarioComparison ? DEFAULT_COLUMN_WIDTH : 0;

  $: tableWidth =
    dimensionColumnWidth +
    $valueColumn +
    (comparisonTimeRange
      ? COMPARISON_COLUMN_WIDTH * (showDeltaPercent ? 2 : 1)
      : showPercentOfTotal
        ? COMPARISON_COLUMN_WIDTH
        : 0) +
    scenarioValueColumnWidth +
    scenarioDeltaColumnCount * COMPARISON_COLUMN_WIDTH;
</script>

<div class="flex flex-col overflow-hidden size-full" aria-label="Leaderboards">
  <div class="pl-2.5 pb-3">
    <LeaderboardControls exploreName={$exploreName} />
  </div>
  <div bind:this={parentElement} class="overflow-y-auto leaderboard-display">
    {#if parentElement}
      <div class="leaderboard-grid overflow-hidden pb-4">
        {#each $visibleDimensions as dimension (dimension.name)}
          {#if dimension.name}
            <Leaderboard
              isValidPercentOfTotal={$isMeasureValidPercentOfTotal}
              {metricsViewName}
              leaderboardSortByMeasureName={$leaderboardSortByMeasureName}
              leaderboardMeasures={$leaderboardMeasures}
              leaderboardShowContextForAllMeasures={$leaderboardShowContextForAllMeasures}
              {whereFilter}
              {dimensionThresholdFilters}
              {instanceId}
              {tableWidth}
              {timeRange}
              {dimensionColumnWidth}
              sortedAscending={$sortedAscending}
              sortType={$sortType}
              filterExcludeMode={$isFilterExcludeMode(dimension.name)}
              {comparisonTimeRange}
              {dimension}
              {parentElement}
              {timeControlsReady}
              selectedValues={selectedDimensionValues(
                $runtime.instanceId,
                [metricsViewName],
                $dashboardStore.whereFilter,
                dimension.name,
                timeRange.start,
                timeRange.end,
              )}
              isBeingCompared={$isBeingComparedReadable(dimension.name)}
              formatters={$leaderboardMeasures.length > 1
                ? $measureFormatters
                : { [$leaderboardSortByMeasureName]: $activeMeasureFormatter }}
              {setPrimaryDimension}
              {toggleSort}
              {toggleDimensionValueSelection}
              {toggleComparisonDimension}
              measureLabel={$measureLabel}
              {showScenarioComparison}
              {selectedScenario}
              {scenarioLabel}
              {scenarioDeltaAbsolute}
              {scenarioDeltaPercent}
            />
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .leaderboard-grid {
    @apply flex flex-row flex-wrap gap-4 overflow-x-auto;
  }
</style>
