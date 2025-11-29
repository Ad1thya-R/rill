import { mergeDimensionAndMeasureFilters } from "@rilldata/web-common/features/dashboards/filters/measure-filters/measure-filter-utils";
import { allDimensions } from "@rilldata/web-common/features/dashboards/state-managers/selectors/dimensions";
import { allMeasures } from "@rilldata/web-common/features/dashboards/state-managers/selectors/measures";
import type { StateManagers } from "@rilldata/web-common/features/dashboards/state-managers/state-managers";
import {
  dimensionSearchText,
  metricsExplorerStore,
} from "@rilldata/web-common/features/dashboards/stores/dashboard-stores";
import { timeControlStateSelector } from "@rilldata/web-common/features/dashboards/time-controls/time-control-store";
import type { TimeRangeString } from "@rilldata/web-common/lib/time/types";
import { type Readable, derived } from "svelte/store";
import {
  canEnablePivotComparison,
  getPivotConfigKey,
  splitPivotChips,
} from "./pivot-utils";
import {
  COMPARISON_DELTA,
  COMPARISON_PERCENT,
  PivotChipType,
  SCENARIO_DELTA,
  SCENARIO_PERCENT,
  SCENARIO_VALUE,
  type PivotDataStoreConfig,
  type PivotTimeConfig,
} from "./types";

let lastKey: string | undefined = undefined;

/**
 * Extract out config relevant to pivot from dashboard and meta store
 */
export function getPivotConfig(
  ctx: StateManagers,
): Readable<PivotDataStoreConfig> {
  return derived(
    [
      ctx.validSpecStore,
      ctx.timeRangeSummaryStore,
      ctx.dashboardStore,
      dimensionSearchText,
    ],
    ([validSpec, timeRangeSummary, dashboardStore, searchText]) => {
      if (
        !validSpec?.data?.metricsView ||
        !validSpec?.data?.explore ||
        timeRangeSummary.isFetching
      ) {
        return {
          measureNames: [],
          rowDimensionNames: [],
          colDimensionNames: [],
          allMeasures: [],
          allDimensions: [],
          whereFilter: dashboardStore.whereFilter,
          pivot: dashboardStore.pivot,
          time: {} as PivotTimeConfig,
          comparisonTime: undefined,
          enableComparison: false,
          searchText,
          isFlat: false,
          enableScenarioComparison: false,
          selectedScenario: undefined,
          scenarioDeltaAbsolute: false,
          scenarioDeltaPercent: false,
        };
      }

      const { metricsView, explore } = validSpec.data;

      // This indirection makes sure only one update of dashboard store triggers this
      const timeControl = timeControlStateSelector([
        metricsView,
        explore,
        timeRangeSummary,
        dashboardStore,
      ]);

      const time: PivotTimeConfig = {
        timeStart: timeControl.timeStart,
        timeEnd: timeControl.timeEnd,
        timeZone: dashboardStore?.selectedTimezone || "UTC",
        timeDimension: metricsView.timeDimension || "",
      };

      const enableComparison =
        canEnablePivotComparison(
          dashboardStore.pivot,
          timeControl.comparisonTimeStart,
        ) && !!timeControl.showTimeComparison;

      let comparisonTime: TimeRangeString | undefined = undefined;
      if (enableComparison) {
        comparisonTime = {
          start: timeControl.comparisonTimeStart,
          end: timeControl.comparisonTimeEnd,
        };
      }

      const { dimension: colDimensions, measure: colMeasures } =
        splitPivotChips(dashboardStore.pivot.columns);

      // Scenario comparison settings
      const enableScenarioComparison =
        dashboardStore.showScenarioComparison ?? false;
      const selectedScenario = dashboardStore.selectedScenario;
      const scenarioDeltaAbsolute =
        dashboardStore.scenarioDeltaAbsolute ?? false;
      const scenarioDeltaPercent = dashboardStore.scenarioDeltaPercent ?? false;

      // Get all measures for checking scenario expressions
      const allMeasuresList = allMeasures({
        validMetricsView: metricsView,
        validExplore: explore,
      });

      const measureNames = colMeasures.flatMap((m) => {
        const measureName = m.id;
        const group = [measureName];

        if (enableComparison) {
          group.push(
            `${measureName}${COMPARISON_DELTA}`,
            `${measureName}${COMPARISON_PERCENT}`,
          );
        }

        // Add scenario columns only for measures that have scenario expressions for the selected scenario
        if (enableScenarioComparison && selectedScenario) {
          const measure = allMeasuresList.find((mes) => mes.name === measureName);
          const hasScenarioExpression =
            measure?.scenarioExpressions &&
            selectedScenario in measure.scenarioExpressions;

          if (hasScenarioExpression) {
            // Add scenario value column
            group.push(`${measureName}${SCENARIO_VALUE}`);
            // Add delta columns based on toggles
            if (scenarioDeltaAbsolute) {
              group.push(`${measureName}${SCENARIO_DELTA}`);
            }
            if (scenarioDeltaPercent) {
              group.push(`${measureName}${SCENARIO_PERCENT}`);
            }
          }
        }

        return group;
      });

      // This is temporary until we have a better way to handle time grains
      let rowDimensionNames = dashboardStore.pivot.rows.map((d) => {
        if (d.type === PivotChipType.Time) {
          return `${time.timeDimension}_rill_${d.id}`;
        }
        return d.id;
      });

      let colDimensionNames = colDimensions.map((d) => {
        if (d.type === PivotChipType.Time) {
          return `${time.timeDimension}_rill_${d.id}`;
        }
        return d.id;
      });

      const isFlat = dashboardStore.pivot.tableMode === "flat";

      /**
       * For flat table, internally rows have all
       * the dimensions and measures are in columns
       */
      if (isFlat) {
        rowDimensionNames = colDimensionNames;
        colDimensionNames = [];
      }

      const config: PivotDataStoreConfig = {
        measureNames,
        rowDimensionNames,
        colDimensionNames,
        allMeasures: allMeasuresList,
        allDimensions: allDimensions({
          validMetricsView: metricsView,
          validExplore: explore,
        }),
        whereFilter: mergeDimensionAndMeasureFilters(
          dashboardStore.whereFilter,
          dashboardStore.dimensionThresholdFilters,
        ),
        pivot: dashboardStore.pivot,
        enableComparison,
        comparisonTime,
        time,
        searchText,
        isFlat,
        enableScenarioComparison,
        selectedScenario,
        scenarioDeltaAbsolute,
        scenarioDeltaPercent,
      };

      const currentKey = getPivotConfigKey(config);

      if (lastKey !== currentKey) {
        // Reset rowPage when pivot config changes
        lastKey = currentKey;
        if (config.pivot.rowPage !== 1) {
          metricsExplorerStore.setPivotRowPage(dashboardStore.name, 1);
          config.pivot.rowPage = 1;
        }
      }

      return config;
    },
  );
}
