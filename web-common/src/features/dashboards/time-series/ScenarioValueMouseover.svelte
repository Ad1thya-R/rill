<script lang="ts">
  import { WithTween } from "@rilldata/web-common/components/data-graphic/functional-components";
  import WithGraphicContexts from "@rilldata/web-common/components/data-graphic/functional-components/WithGraphicContexts.svelte";
  import MultiMetricMouseoverLabel from "@rilldata/web-common/components/data-graphic/marks/MultiMetricMouseoverLabel.svelte";
  import type { Point } from "@rilldata/web-common/components/data-graphic/marks/types";
  import { NumberKind } from "@rilldata/web-common/lib/number-formatting/humanizer-types";
  import { formatMeasurePercentageDifference } from "@rilldata/web-common/lib/number-formatting/percentage-formatter";
  import { numberPartsToString } from "@rilldata/web-common/lib/number-formatting/utils/number-parts-utils";

  /** Main (baseline) data point */
  export let mainPoint: Record<string, unknown> | undefined;
  /** Selected scenario data point */
  export let scenarioPoint: Record<string, unknown> | undefined;
  export let xAccessor: string;
  export let yAccessor: string;
  export let mouseoverFormat: (value: unknown) => string;
  export let numberKind: NumberKind;
  /** Label for the selected scenario */
  export let scenarioLabel: string | undefined = undefined;
  export let strokeWidth = 2;

  $: x = mainPoint?.[xAccessor] ?? scenarioPoint?.[xAccessor];
  $: mainY = mainPoint?.[yAccessor] as number | undefined;
  $: scenarioY = scenarioPoint?.[yAccessor] as number | undefined;

  $: hasMain = mainY !== undefined && mainY !== null;
  $: hasScenario = scenarioY !== undefined && scenarioY !== null;

  // Calculate percentage difference between Main and selected scenario
  $: diff =
    hasMain && hasScenario && mainY !== 0
      ? (scenarioY! - mainY!) / mainY!
      : NaN;
  $: isDiffValid = !isNaN(diff) && isFinite(diff);
  $: diffIsPositive = diff >= 0;
  $: diffLabel =
    isDiffValid && numberPartsToString(formatMeasurePercentageDifference(diff));

  // Build point set for the label
  let pointSet: Point[] = [];
  $: {
    const points: Point[] = [];

    if (hasMain) {
      points.push({
        x,
        y: mainY!,
        yOverride: false,
        yOverrideLabel: "",
        yOverrideStyleClass: "",
        key: "main",
        label: "Main",
        pointColor: "var(--color-theme-700)",
        valueStyleClass: "font-semibold",
        valueColorClass: "fill-gray-600",
        labelColorClass: "fill-gray-500",
      });
    }

    if (hasScenario) {
      const displayLabel = scenarioLabel || "Scenario";
      points.push({
        x,
        y: scenarioY!,
        yOverride: false,
        yOverrideLabel: "",
        yOverrideStyleClass: "",
        key: "scenario",
        label:
          displayLabel +
          (isDiffValid && numberKind !== NumberKind.PERCENT
            ? ` (${diffLabel})`
            : ""),
        pointColor: "var(--color-green-600)",
        valueStyleClass: "font-semibold",
        valueColorClass: "fill-gray-600",
        labelColorClass: diffIsPositive ? "fill-gray-500" : "fill-red-500",
      });
    }

    pointSet = points;
  }
</script>

<WithGraphicContexts let:xScale let:yScale>
  <WithTween
    tweenProps={{ duration: 25 }}
    value={xScale(x)}
    let:output={xArrow}
  >
    <WithTween
      tweenProps={{ duration: 60 }}
      value={{
        yMain: hasMain ? yScale(mainY) : yScale(0),
        yScenario: hasScenario ? yScale(scenarioY) : yScale(0),
      }}
      let:output
    >
      {#if hasMain && hasScenario && x !== undefined}
        <!-- Draw connecting line between Main and scenario points -->
        {#if Math.abs(output.yMain - output.yScenario) > 8}
          {@const bufferSize = Math.abs(output.yMain - output.yScenario) > 16 ? 8 : 4}
          {@const yBuffer = diffIsPositive ? bufferSize : -bufferSize}
          {@const sign = diffIsPositive ? 1 : -1}
          {@const dist = 3}
          {@const signedDist = sign * dist}
          {@const yLoc = output.yMain + bufferSize * sign}
          {@const show = Math.abs(output.yMain - output.yScenario) > 16}

          <g>
            <!-- Background stroke for visibility -->
            <line
              x1={xArrow}
              x2={xArrow}
              y1={output.yMain + yBuffer}
              y2={output.yScenario - yBuffer}
              stroke="var(--surface)"
              stroke-width={strokeWidth + 3}
              stroke-linecap="round"
            />
            <!-- Foreground stroke -->
            <line
              x1={xArrow}
              x2={xArrow}
              y1={output.yMain + yBuffer}
              y2={output.yScenario - yBuffer}
              class="stroke-gray-400"
              stroke-width={strokeWidth}
              stroke-linecap="round"
            />

            <!-- Arrow indicators -->
            <g class:opacity-0={!show} class="transition-opacity">
              {#if show}
                <line
                  x1={xArrow}
                  x2={xArrow + dist}
                  y1={yLoc}
                  y2={yLoc + signedDist}
                  stroke="var(--surface)"
                  stroke-width={strokeWidth + 3}
                  stroke-linecap="round"
                />
                <line
                  x1={xArrow}
                  x2={xArrow - dist}
                  y1={yLoc}
                  y2={yLoc + signedDist}
                  stroke="var(--surface)"
                  stroke-width={strokeWidth + 3}
                  stroke-linecap="round"
                />
                <line
                  x1={xArrow}
                  x2={xArrow + dist}
                  y1={yLoc}
                  y2={yLoc + signedDist}
                  class="stroke-gray-400"
                  stroke-width={strokeWidth}
                  stroke-linecap="round"
                />
                <line
                  x1={xArrow}
                  x2={xArrow - dist}
                  y1={yLoc}
                  y2={yLoc + signedDist}
                  class="stroke-gray-400"
                  stroke-width={strokeWidth}
                  stroke-linecap="round"
                />
              {/if}
            </g>
          </g>
        {/if}
      {:else if hasMain && x !== undefined}
        <!-- Single Main line to zero -->
        <line
          x1={xArrow}
          x2={xArrow}
          y1={yScale(0)}
          y2={output.yMain}
          stroke-width={strokeWidth}
          class="stroke-theme-300"
        />
      {:else if hasScenario && x !== undefined}
        <!-- Single scenario line to zero -->
        <line
          x1={xArrow}
          x2={xArrow}
          y1={yScale(0)}
          y2={output.yScenario}
          stroke-width={strokeWidth}
          class="stroke-green-300"
        />
      {/if}
    </WithTween>
  </WithTween>

  <MultiMetricMouseoverLabel
    direction="right"
    flipAtEdge="body"
    formatValue={mouseoverFormat}
    point={pointSet}
  />
</WithGraphicContexts>
