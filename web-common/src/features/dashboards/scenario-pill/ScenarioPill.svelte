<script lang="ts">
  import Label from "@rilldata/web-common/components/forms/Label.svelte";
  import Switch from "@rilldata/web-common/components/forms/Switch.svelte";
  import { getStateManagers } from "@rilldata/web-common/features/dashboards/state-managers/state-managers";
  import { metricsExplorerStore } from "@rilldata/web-common/features/dashboards/stores/dashboard-stores";
  import type { MetricsViewSpecScenario } from "@rilldata/web-common/runtime-client";
  import * as DropdownMenu from "@rilldata/web-common/components/dropdown-menu";
  import CaretDownIcon from "@rilldata/web-common/components/icons/CaretDownIcon.svelte";
  import { GitBranch } from "lucide-svelte";

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
  <button class="toggle-button" on:click={toggleComparison}>
    <div class="pointer-events-none flex items-center gap-x-1.5">
      <Switch
        checked={showScenarioComparison ?? false}
        id="scenario-comparing"
        small
        theme
      />
      <GitBranch size={14} />
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
        <div class="flex items-center gap-x-2" class:opacity-50={!showScenarioComparison}>
          {#if !showScenarioComparison}
            <span class="truncate">no scenario selected</span>
          {:else}
            <b class="truncate">{currentLabel}</b>
          {/if}
        </div>
        <span class="flex-none transition-transform" class:-rotate-180={open} class:opacity-50={!showScenarioComparison}>
          <CaretDownIcon />
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
    @apply flex w-fit;
    @apply h-7 rounded-full;
    @apply overflow-hidden select-none;
  }

  .toggle-button {
    @apply flex gap-x-1.5 cursor-pointer;
    @apply border;
    @apply px-2 flex items-center justify-center bg-surface;
    @apply pl-2.5 rounded-l-full;
  }

  .toggle-button:hover {
    @apply bg-gray-50;
  }

  .scenario-select {
    @apply flex items-center gap-x-1;
    @apply border -ml-[1px];
    @apply px-2 pr-2.5 rounded-r-full bg-surface;
    @apply cursor-pointer;
  }

  .scenario-select:hover {
    @apply bg-gray-50;
  }

  .scenario-select.active {
    @apply bg-gray-50 border-gray-400 z-50;
  }
</style>
