<script lang="ts">
  import Tooltip from "@rilldata/web-common/components/tooltip/Tooltip.svelte";
  import { createMeasureValueFormatter } from "@rilldata/web-common/lib/number-formatting/format-measure-value";
  import type { MetricsViewSpecMeasure } from "@rilldata/web-common/runtime-client";
  import type { DimensionDataItem } from "@rilldata/web-common/features/dashboards/time-series/multiple-dimension-queries";
  import { WithTween } from "@rilldata/web-common/components/data-graphic/functional-components";

  export let measure: MetricsViewSpecMeasure;
  export let dimensionData: DimensionDataItem[];
  export let yAccessor: string;

  $: measureValueFormatter = createMeasureValueFormatter<null>(
    measure,
    "big-number",
  );

  $: measureValueFormatterTooltip = createMeasureValueFormatter<null>(
    measure,
    "tooltip",
  );

  // Calculate total for each dimension value from time series data
  function calculateTotal(data: DimensionDataItem["data"]): number | null {
    if (!data || data.length === 0) return null;

    // Sum up all non-null values in the time series
    let sum = 0;
    let hasValue = false;
    for (const datum of data) {
      const val = datum[yAccessor];
      if (val !== null && val !== undefined && typeof val === "number") {
        sum += val;
        hasValue = true;
      }
    }
    return hasValue ? sum : null;
  }

  // Get the total value - prefer using the provided total, otherwise calculate from time series
  function getTotalForDimension(item: DimensionDataItem): number | null {
    // If total is already provided (e.g., from "table" surface query), use it
    if (item.total !== undefined && item.total !== null) {
      return item.total;
    }
    // Otherwise, calculate the sum from time series data
    // For aggregate measures (e.g., Total Revenue), this gives the total over the time period
    return calculateTotal(item.data);
  }
</script>

<div class="flex flex-col gap-y-1.5">
  {#each dimensionData as item, index (item.value)}
    {@const total = getTotalForDimension(item)}
    {@const tooltipValue =
      total !== null ? measureValueFormatterTooltip(total) : "no data"}
    {@const displayValue = item.value || "(null)"}

    <Tooltip distance={8} location="right" alignment="start">
      <div slot="tooltip-content" class="text-xs">
        <div class="font-medium">{displayValue}</div>
        <div class="ui-copy-muted">{tooltipValue}</div>
      </div>

      <div
        class="flex items-center gap-x-2 cursor-default group"
        role="listitem"
      >
        <!-- Color indicator dot -->
        <span
          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style:background-color={item.color}
        />

        <!-- Value display -->
        <span class="text-lg font-light ui-copy-muted group-hover:ui-copy">
          {#if total !== null}
            <WithTween value={total} tweenProps={{ duration: 500 }} let:output>
              {measureValueFormatter(output)}
            </WithTween>
          {:else if item.isFetching}
            <span class="ui-copy-disabled-faint italic text-sm">loading...</span
            >
          {:else}
            <span class="ui-copy-disabled-faint italic text-sm">no data</span>
          {/if}
        </span>
      </div>
    </Tooltip>
  {/each}
</div>
