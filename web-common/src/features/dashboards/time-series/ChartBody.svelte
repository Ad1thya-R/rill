<script lang="ts">
  import {
    ChunkedLine,
    ClippedChunkedLine,
  } from "@rilldata/web-common/components/data-graphic/marks";
  import {
    AreaMutedColorGradientDark,
    AreaMutedColorGradientLight,
    LineMutedColor,
    MainAreaColorGradientDark,
    MainAreaColorGradientLight,
    MainLineColor,
  } from "@rilldata/web-common/features/dashboards/time-series/chart-colors";
  import type { DimensionDataItem } from "@rilldata/web-common/features/dashboards/time-series/multiple-dimension-queries";
  import { splitDataAtForecastCutoff } from "@rilldata/web-common/features/dashboards/time-series/utils";
  import { previousValueStore } from "@rilldata/web-common/lib/store-utils";
  import { writable } from "svelte/store";

  export let xMin: Date | undefined = undefined;
  export let xMax: Date | undefined = undefined;
  export let yExtentMax: number | undefined = undefined;
  export let showComparison: boolean;
  export let dimensionValue: string | undefined | null;
  export let isHovering: boolean;
  export let data;
  export let dimensionData: DimensionDataItem[] = [];
  export let xAccessor: string;
  export let yAccessor: string;
  export let scrubStart;
  export let scrubEnd;
  /** Optional forecast cutoff date - data after this date renders with dashed lines */
  export let forecastCutoffDate: Date | null = null;

  /** Dash pattern for forecast lines (dotted/dashed style) */
  const FORECAST_DASH_PATTERN = "4,4";

  $: hasSubrangeSelected = Boolean(scrubStart && scrubEnd);

  $: mainLineColor = hasSubrangeSelected ? LineMutedColor : MainLineColor;

  const focusedAreaGradient: [string, string] = [
    MainAreaColorGradientDark,
    MainAreaColorGradientLight,
  ];

  $: areaGradientColors = (
    hasSubrangeSelected
      ? [AreaMutedColorGradientDark, AreaMutedColorGradientLight]
      : focusedAreaGradient
  ) as [string, string];

  $: isDimValueHiglighted =
    dimensionValue !== undefined &&
    dimensionData.map((d) => d.value).includes(dimensionValue);

  // we delay the tween if previousYMax < yMax
  let yMaxStore = writable(yExtentMax);
  let previousYMax = previousValueStore(yMaxStore);

  $: if (typeof yExtentMax === "number") yMaxStore.set(yExtentMax);
  const timeRangeKey = writable(`${xMin}-${xMax}`);

  const previousTimeRangeKey = previousValueStore(timeRangeKey);

  // FIXME: move this function to utils.ts
  /** reset the keys to trigger animations on time range changes */
  let syncTimeRangeKey;
  $: {
    timeRangeKey.set(`${xMin}-${xMax}`);
    if ($previousTimeRangeKey !== $timeRangeKey) {
      if (syncTimeRangeKey) clearTimeout(syncTimeRangeKey);
      syncTimeRangeKey = setTimeout(() => {
        previousTimeRangeKey.set($timeRangeKey);
      }, 400);
    }
  }

  $: delay =
    $previousTimeRangeKey === $timeRangeKey &&
    yExtentMax &&
    $previousYMax < yExtentMax
      ? 100
      : 0;
</script>

<!-- key on the time range itself to prevent weird tweening animations.
    We'll need to migrate this to a more robust solution once we've figured out
    the right way to "tile" together a time series with multiple pages of data.
    -->
{#key $timeRangeKey}
  {#if dimensionData?.length}
    {#each dimensionData as d}
      {@const isHighlighted = d?.value === dimensionValue}
      {@const dimSplitData = forecastCutoffDate
        ? splitDataAtForecastCutoff(
            d?.data || [],
            xAccessor,
            forecastCutoffDate,
          )
        : { historical: d?.data || [], forecast: [] }}
      <g
        class="transition-opacity"
        class:opacity-0={isDimValueHiglighted && !isHighlighted}
      >
        <!-- Historical data (solid line) -->
        <ChunkedLine
          lineWidth={isHighlighted ? 2 : 1.5}
          delay={$timeRangeKey !== $previousTimeRangeKey ? 0 : delay}
          duration={hasSubrangeSelected ||
          $timeRangeKey !== $previousTimeRangeKey
            ? 0
            : 200}
          lineColor={d?.color}
          data={dimSplitData.historical}
          {xAccessor}
          {yAccessor}
        />
        <!-- Forecast data (dashed line) -->
        {#if dimSplitData.forecast.length > 0}
          <ChunkedLine
            lineWidth={isHighlighted ? 2 : 1.5}
            delay={$timeRangeKey !== $previousTimeRangeKey ? 0 : delay}
            duration={hasSubrangeSelected ||
            $timeRangeKey !== $previousTimeRangeKey
              ? 0
              : 200}
            lineColor={d?.color}
            data={dimSplitData.forecast}
            {xAccessor}
            {yAccessor}
            strokeDasharray={FORECAST_DASH_PATTERN}
          />
        {/if}
      </g>
      {#if isHighlighted && showComparison}
        <g class="transition-opacity">
          <ChunkedLine
            lineColor={d?.color}
            lineOpacity={0.5}
            delay={$timeRangeKey !== $previousTimeRangeKey ? 0 : delay}
            duration={hasSubrangeSelected ||
            $timeRangeKey !== $previousTimeRangeKey
              ? 0
              : 200}
            data={d?.data || []}
            {xAccessor}
            yAccessor="comparison.{yAccessor}"
          />
        </g>
      {/if}
    {/each}
  {:else}
    {@const splitData = forecastCutoffDate
      ? splitDataAtForecastCutoff(data, xAccessor, forecastCutoffDate)
      : { historical: data, forecast: [] }}
    {#if showComparison}
      <g
        class="transition-opacity"
        class:opacity-100={isHovering}
        class:opacity-60={!isHovering}
      >
        <ChunkedLine
          lineOpacity={0.5}
          lineColor={mainLineColor}
          delay={$timeRangeKey !== $previousTimeRangeKey ? 0 : delay}
          duration={hasSubrangeSelected ||
          $timeRangeKey !== $previousTimeRangeKey
            ? 0
            : 200}
          {data}
          {xAccessor}
          yAccessor="comparison.{yAccessor}"
        />
      </g>
    {/if}
    <!-- Historical data (solid line with area gradient) -->
    <ChunkedLine
      lineColor={mainLineColor}
      {areaGradientColors}
      delay={$timeRangeKey !== $previousTimeRangeKey ? 0 : delay}
      duration={hasSubrangeSelected || $timeRangeKey !== $previousTimeRangeKey
        ? 0
        : 200}
      data={splitData.historical}
      {xAccessor}
      {yAccessor}
    />
    <!-- Forecast data (dashed line, no area) -->
    {#if splitData.forecast.length > 0}
      <ChunkedLine
        lineColor={mainLineColor}
        delay={$timeRangeKey !== $previousTimeRangeKey ? 0 : delay}
        duration={hasSubrangeSelected || $timeRangeKey !== $previousTimeRangeKey
          ? 0
          : 200}
        data={splitData.forecast}
        {xAccessor}
        {yAccessor}
        strokeDasharray={FORECAST_DASH_PATTERN}
      />
    {/if}
    {#if hasSubrangeSelected}
      <ClippedChunkedLine
        start={Math.min(scrubStart, scrubEnd)}
        end={Math.max(scrubStart, scrubEnd)}
        lineColor={MainLineColor}
        areaGradientColors={focusedAreaGradient}
        delay={0}
        duration={0}
        {data}
        {xAccessor}
        {yAccessor}
      />
    {/if}
  {/if}
{/key}
