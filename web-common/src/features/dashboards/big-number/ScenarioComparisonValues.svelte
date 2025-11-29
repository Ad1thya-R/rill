<script lang="ts">
  import Tooltip from "@rilldata/web-common/components/tooltip/Tooltip.svelte";
  import { createMeasureValueFormatter } from "@rilldata/web-common/lib/number-formatting/format-measure-value";
  import type { MetricsViewSpecMeasure } from "@rilldata/web-common/runtime-client";
  import { WithTween } from "@rilldata/web-common/components/data-graphic/functional-components";

  export let measure: MetricsViewSpecMeasure;
  export let mainValue: number | null;
  export let scenarioValue: number | null;
  export let scenarioLabel: string;
  export let isFetching = false;

  $: measureValueFormatter = createMeasureValueFormatter<null>(
    measure,
    "big-number",
  );

  $: measureValueFormatterTooltip = createMeasureValueFormatter<null>(
    measure,
    "tooltip",
  );

  $: mainTooltipValue =
    mainValue !== null ? measureValueFormatterTooltip(mainValue) : "no data";
  $: scenarioTooltipValue =
    scenarioValue !== null
      ? measureValueFormatterTooltip(scenarioValue)
      : "no data";
</script>

<div class="flex flex-col gap-y-1.5">
  <!-- Main value with blue dot -->
  <Tooltip distance={8} location="right" alignment="start">
    <div slot="tooltip-content" class="text-xs">
      <div class="font-medium">Main</div>
      <div class="ui-copy-muted">{mainTooltipValue}</div>
    </div>

    <div class="flex items-center gap-x-2 cursor-default group" role="listitem">
      <!-- Blue dot for Main -->
      <span
        class="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style:background-color="var(--color-primary-500)"
      />

      <!-- Value display -->
      <span class="text-lg font-light ui-copy-muted group-hover:ui-copy">
        {#if mainValue !== null}
          <WithTween value={mainValue} tweenProps={{ duration: 500 }} let:output>
            {measureValueFormatter(output)}
          </WithTween>
        {:else if isFetching}
          <span class="ui-copy-disabled-faint italic text-sm">loading...</span>
        {:else}
          <span class="ui-copy-disabled-faint italic text-sm">no data</span>
        {/if}
      </span>
    </div>
  </Tooltip>

  <!-- Scenario value with green dot -->
  <Tooltip distance={8} location="right" alignment="start">
    <div slot="tooltip-content" class="text-xs">
      <div class="font-medium">{scenarioLabel}</div>
      <div class="ui-copy-muted">{scenarioTooltipValue}</div>
    </div>

    <div class="flex items-center gap-x-2 cursor-default group" role="listitem">
      <!-- Green dot for Scenario -->
      <span
        class="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style:background-color="var(--color-green-500)"
      />

      <!-- Value display -->
      <span class="text-lg font-light ui-copy-muted group-hover:ui-copy">
        {#if scenarioValue !== null}
          <WithTween
            value={scenarioValue}
            tweenProps={{ duration: 500 }}
            let:output
          >
            {measureValueFormatter(output)}
          </WithTween>
        {:else if isFetching}
          <span class="ui-copy-disabled-faint italic text-sm">loading...</span>
        {:else}
          <span class="ui-copy-disabled-faint italic text-sm">no data</span>
        {/if}
      </span>
    </div>
  </Tooltip>
</div>
