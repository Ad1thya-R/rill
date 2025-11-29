import type { VirtualizedTableColumns } from "@rilldata/web-common/components/virtualized-table/types";
import type {
  MetricsViewSpecDimension,
  RpcStatus,
  V1MetricsViewAggregationResponse,
  V1MetricsViewAggregationResponseDataItem,
} from "@rilldata/web-common/runtime-client";
import type { QueryObserverResult } from "@tanstack/svelte-query";
import type { DimensionTableRow } from "../../dimension-table/dimension-table-types";
import {
  prepareDimensionTableRows,
  prepareVirtualizedDimTableColumns,
} from "../../dimension-table/dimension-table-utils";
import { activeMeasureName, isValidPercentOfTotal } from "./active-measure";
import { allMeasures, visibleMeasures } from "./measures";
import { isTimeComparisonActive, isScenarioComparisonActive } from "./time-range";
import type { DashboardDataSources } from "./types";

export const primaryDimension = (
  dashData: DashboardDataSources,
): MetricsViewSpecDimension | undefined => {
  const dimName = dashData.dashboard.selectedDimensionName;
  return dashData.validMetricsView?.dimensions?.find(
    (dim) => dim.name === dimName,
  );
};

export const virtualizedTableColumns =
  (
    dashData: DashboardDataSources,
  ): ((
    tableRows: Record<string, any>[],
    activeMeasures?: string[],
    scenarioLabel?: string,
  ) => VirtualizedTableColumns[]) =>
  (tableRows, activeMeasures, scenarioLabel) => {
    const dimension = primaryDimension(dashData);

    if (!dimension) return [];

    // temporary filter for advanced measures
    const measures = visibleMeasures(dashData).filter(
      (m) => !m.window && !m.requiredDimensions?.length,
    );

    // We always use the max value as total for bar values
    const maxValues: { [key: string]: number } = {};
    measures.map((m) => {
      if (!m.name) return;

      const numericValues = tableRows
        .map((row) => {
          const value = row[m.name!];
          return typeof value === "number" && isFinite(value)
            ? Math.abs(value)
            : null;
        })
        .filter(Boolean) as number[];
      maxValues[m.name] = Math.max(...numericValues);
    });

    // Get scenario delta toggle states from dashboard
    const scenarioDeltaAbsolute = dashData.dashboard?.scenarioDeltaAbsolute ?? false;
    const scenarioDeltaPercent = dashData.dashboard?.scenarioDeltaPercent ?? false;

    return prepareVirtualizedDimTableColumns(
      dashData.dashboard,
      measures,
      maxValues,
      dimension,
      isTimeComparisonActive(dashData),
      isValidPercentOfTotal(dashData),
      activeMeasures,
      isScenarioComparisonActive(dashData),
      scenarioLabel,
      scenarioDeltaAbsolute,
      scenarioDeltaPercent,
    );
  };

export const prepareDimTableRows =
  (
    dashData: DashboardDataSources,
  ): ((
    sortedQuery: QueryObserverResult<
      V1MetricsViewAggregationResponse,
      RpcStatus
    >,
    unfilteredTotal: number | { [key: string]: number },
    scenarioDataMap?: Map<string, V1MetricsViewAggregationResponseDataItem>,
  ) => DimensionTableRow[]) =>
  (sortedQuery, unfilteredTotal, scenarioDataMap) => {
    const dimension = primaryDimension(dashData);

    if (!dimension) return [];

    const dimensionColumn = dimension.name ?? "";
    const leaderboardSortByMeasureName = activeMeasureName(dashData);

    // FIXME: should this really be all measures, or just visible measures?
    const measures = allMeasures(dashData);

    return prepareDimensionTableRows(
      sortedQuery?.data?.data ?? [],
      measures,
      leaderboardSortByMeasureName,
      dimensionColumn,
      isTimeComparisonActive(dashData),
      isValidPercentOfTotal(dashData),
      unfilteredTotal,
      isScenarioComparisonActive(dashData) ? scenarioDataMap : undefined,
    );
  };

export const dimensionTableSelectors = {
  /**
   * gets the VirtualizedTableColumns array for the dimension table.
   */
  virtualizedTableColumns,

  /**
   * gets the MetricsViewSpecDimension for the dimension table's
   * primary dimension.
   */
  primaryDimension,

  /**
   * A readable containaing a function that will prepare
   * the dimension table rows for given a sorted query
   * and unfiltered total.
   */
  prepareDimTableRows,
};
