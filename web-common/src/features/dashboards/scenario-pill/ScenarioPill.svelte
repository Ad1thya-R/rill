<script lang="ts">
  import Label from "@rilldata/web-common/components/forms/Label.svelte";
  import Switch from "@rilldata/web-common/components/forms/Switch.svelte";
  import { getStateManagers } from "@rilldata/web-common/features/dashboards/state-managers/state-managers";
  import { metricsExplorerStore } from "@rilldata/web-common/features/dashboards/stores/dashboard-stores";
  import type { MetricsViewSpecScenario } from "@rilldata/web-common/runtime-client";
  import * as DropdownMenu from "@rilldata/web-common/components/dropdown-menu";
  import CaretDownIcon from "@rilldata/web-common/components/icons/CaretDownIcon.svelte";

  export let exploreName: string;
  export let scenarios: MetricsViewSpecScenario[];

  const { dashboardStore } = getStateManagers();

  let open = false;

  $: ({
    showScenarioComparison,
    selectedScenario,
    scenarioDeltaAbsolute,
    scenarioDeltaPercent,
  } = $dashboardStore);

  // Build options - only the actual scenarios (not Main, since Main is always the baseline)
  $: options = scenarios.map((s) => ({
    name: s.name ?? "",
    label: s.label || s.name || "Unknown",
  }));

  // Get current label for display
  $: currentLabel = getLabelForScenario(selectedScenario);

  function getLabelForScenario(scenarioName: string | undefined) {
    if (!scenarioName) return options[0]?.label || "Scenario";
    const scenario = scenarios.find((s) => s.name === scenarioName);
    return scenario?.label || scenario?.name || scenarioName;
  }

  function toggleComparison() {
    const newState = !showScenarioComparison;
    metricsExplorerStore.toggleScenarioComparison(exploreName, newState);
    // If enabling and no scenario selected, select first one
    if (newState && !selectedScenario && options.length > 0) {
      metricsExplorerStore.setSelectedScenario(exploreName, options[0].name);
    }
  }

  function selectScenario(name: string) {
    // Selecting a scenario also enables scenario comparison mode
    if (!showScenarioComparison) {
      metricsExplorerStore.toggleScenarioComparison(exploreName, true);
    }
    metricsExplorerStore.setSelectedScenario(exploreName, name || undefined);
  }

  function toggleDeltaAbsolute() {
    metricsExplorerStore.setScenarioDeltaAbsolute(
      exploreName,
      !scenarioDeltaAbsolute,
    );
  }

  function toggleDeltaPercent() {
    metricsExplorerStore.setScenarioDeltaPercent(
      exploreName,
      !scenarioDeltaPercent,
    );
  }
</script>

<div class="wrapper">
  <button class="flex gap-x-1.5 cursor-pointer" on:click={toggleComparison}>
    <div class="pointer-events-none flex items-center gap-x-1.5">
      <Switch
        checked={showScenarioComparison ?? false}
        id="scenario-comparing"
        small
        theme
      />
      <Label class="font-normal text-xs cursor-pointer" for="scenario-comparing">
        Scenario
      </Label>
    </div>
  </button>

  <!-- Always show dropdown (like ComparisonPill) -->
  <DropdownMenu.Root bind:open typeahead={false}>
    <DropdownMenu.Trigger asChild let:builder>
      <button
        class="scenario-select"
        class:active={open}
        {...builder}
        use:builder.action
      >
        {#if !showScenarioComparison}
          <span class="text-gray-400 truncate">no scenario selected</span>
        {:else}
          <span class="truncate">{currentLabel}</span>
        {/if}
        <span class="transition-transform" class:-rotate-180={open}>
          <CaretDownIcon size="10px" />
        </span>
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="start">
      {#each options as option (option.name)}
        <DropdownMenu.Item on:click={() => selectScenario(option.name)}>
          <span class:font-bold={showScenarioComparison && selectedScenario === option.name}>
            {option.label}
          </span>
        </DropdownMenu.Item>
      {/each}

      {#if showScenarioComparison}
        <DropdownMenu.Separator />
        <DropdownMenu.CheckboxItem
          checked={scenarioDeltaAbsolute ?? false}
          on:click={toggleDeltaAbsolute}
        >
          Show Δ (absolute)
        </DropdownMenu.CheckboxItem>
        <DropdownMenu.CheckboxItem
          checked={scenarioDeltaPercent ?? false}
          on:click={toggleDeltaPercent}
        >
          Show Δ% (percentage)
        </DropdownMenu.CheckboxItem>
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

<style lang="postcss">
  .wrapper {
    @apply flex items-center w-fit;
    @apply h-7 rounded-full;
    @apply overflow-hidden select-none;
  }

  :global(.wrapper > button) {
    @apply border;
  }

  :global(.wrapper > button:not(:first-child)) {
    @apply -ml-[1px];
  }

  :global(.wrapper > button) {
    @apply border;
    @apply px-2 flex items-center justify-center bg-surface;
  }

  :global(.wrapper > button:first-child) {
    @apply pl-2.5 rounded-l-full;
  }

  :global(.wrapper > button:last-child) {
    @apply pr-2.5 rounded-r-full;
  }

  :global(.wrapper > button:hover:not(:disabled)) {
    @apply bg-gray-50 cursor-pointer;
  }

  .scenario-select {
    @apply flex items-center gap-x-1 h-full;
    @apply px-2 text-xs font-medium;
    @apply border border-gray-200 bg-surface;
    @apply hover:bg-gray-50 cursor-pointer;
  }

  .scenario-select.active {
    @apply bg-gray-50 border-gray-400;
  }
</style>
