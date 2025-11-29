import {
  createAndExpression,
  createInExpression,
  sanitiseExpression,
} from "@rilldata/web-common/features/dashboards/stores/filter-utils";
import type { TimeRangeString } from "@rilldata/web-common/lib/time/types";
import {
  type V1Expression,
  type V1MetricsViewAggregationDimension,
  type V1MetricsViewAggregationMeasure,
  type V1MetricsViewAggregationResponse,
  type V1MetricsViewAggregationResponseDataItem,
  type V1MetricsViewAggregationSort,
  createQueryServiceMetricsViewAggregation,
} from "@rilldata/web-common/runtime-client";
import type { HTTPError } from "@rilldata/web-common/runtime-client/fetchWrapper";
import { runtime } from "@rilldata/web-common/runtime-client/runtime-store";
import {
  keepPreviousData,
  type CreateQueryResult,
} from "@tanstack/svelte-query";
import { type Readable, derived, readable } from "svelte/store";
import { mergeFilters } from "./pivot-merge-filters";
import {
  getErrorFromResponses,
  getFilterForMeasuresTotalsAxesQuery,
  getTimeGrainFromDimension,
  isTimeDimension,
  prepareMeasureForComparison,
} from "./pivot-utils";
import {
  COMPARISON_DELTA,
  COMPARISON_PERCENT,
  SCENARIO_DELTA,
  SCENARIO_PERCENT,
  SCENARIO_VALUE,
  type PivotAxesData,
  type PivotDashboardContext,
  type PivotDataStoreConfig,
  type PivotQueryError,
} from "./types";

/**
 * Check if a measure name has a scenario suffix
 */
function hasScenarioSuffix(measureName: string | undefined): boolean {
  if (!measureName) return false;
  return (
    measureName.endsWith(SCENARIO_VALUE) ||
    measureName.endsWith(SCENARIO_DELTA) ||
    measureName.endsWith(SCENARIO_PERCENT)
  );
}

/**
 * Get the base measure name by stripping scenario suffixes
 */
function getBaseMeasureName(measureName: string): string {
  return measureName
    .replace(SCENARIO_VALUE, "")
    .replace(SCENARIO_DELTA, "")
    .replace(SCENARIO_PERCENT, "");
}

/**
 * Merge scenario query results into main query results.
 * For each row, adds scenario values and calculates deltas.
 */
function mergeScenarioResults(
  mainData: V1MetricsViewAggregationResponseDataItem[] | undefined,
  scenarioData: V1MetricsViewAggregationResponseDataItem[] | undefined,
  scenarioMeasures: V1MetricsViewAggregationMeasure[],
  dimensions: V1MetricsViewAggregationDimension[],
): V1MetricsViewAggregationResponseDataItem[] {
  if (!mainData || mainData.length === 0) return mainData || [];
  if (!scenarioData || scenarioData.length === 0) return mainData;

  // Create a map of scenario data by dimension key for efficient lookup
  const scenarioMap = new Map<string, V1MetricsViewAggregationResponseDataItem>();
  const dimNames = dimensions.map((d) => d.alias || d.name || "");

  for (const row of scenarioData) {
    const key = dimNames.map((d) => String(row[d] ?? "")).join("|||");
    scenarioMap.set(key, row);
  }

  // Merge scenario values into main data
  return mainData.map((mainRow) => {
    const key = dimNames.map((d) => String(mainRow[d] ?? "")).join("|||");
    const scenarioRow = scenarioMap.get(key);

    const mergedRow = { ...mainRow };

    // For each scenario measure, add the value and calculate deltas
    for (const measure of scenarioMeasures) {
      const scenarioMeasureName = measure.name;
      if (!scenarioMeasureName) continue;

      const baseMeasureName = getBaseMeasureName(scenarioMeasureName);
      const mainValue = mainRow[baseMeasureName] as number | null | undefined;
      const scenarioValue = scenarioRow
        ? (scenarioRow[baseMeasureName] as number | null | undefined)
        : null;

      if (scenarioMeasureName.endsWith(SCENARIO_VALUE)) {
        // Store scenario value
        mergedRow[scenarioMeasureName] = scenarioValue ?? null;
      } else if (scenarioMeasureName.endsWith(SCENARIO_DELTA)) {
        // Calculate absolute delta: scenario - main
        if (
          scenarioValue !== null &&
          scenarioValue !== undefined &&
          mainValue !== null &&
          mainValue !== undefined
        ) {
          mergedRow[scenarioMeasureName] = scenarioValue - mainValue;
        } else {
          mergedRow[scenarioMeasureName] = null;
        }
      } else if (scenarioMeasureName.endsWith(SCENARIO_PERCENT)) {
        // Calculate percentage delta: (scenario - main) / |main| * 100
        if (
          scenarioValue !== null &&
          scenarioValue !== undefined &&
          mainValue !== null &&
          mainValue !== undefined &&
          mainValue !== 0
        ) {
          mergedRow[scenarioMeasureName] =
            ((scenarioValue - mainValue) / Math.abs(mainValue)) * 100;
        } else {
          mergedRow[scenarioMeasureName] = null;
        }
      }
    }

    return mergedRow;
  });
}

/**
 * Wrapper function for Aggregate Query API.
 * When scenario comparison is enabled and there are scenario measures,
 * this runs TWO queries: one for main data and one for scenario data,
 * then merges the results client-side.
 */
export function createPivotAggregationRowQuery(
  ctx: PivotDashboardContext,
  config: PivotDataStoreConfig,
  measures: V1MetricsViewAggregationMeasure[],
  dimensions: V1MetricsViewAggregationDimension[],
  whereFilter: V1Expression,
  sort: V1MetricsViewAggregationSort[] = [],
  limit = "100",
  offset = "0",
  timeRange: TimeRangeString | undefined = undefined,
): CreateQueryResult<V1MetricsViewAggregationResponse, HTTPError> {
  if (!sort.length) {
    sort = [
      {
        desc: false,
        name: measures[0]?.name || dimensions?.[0]?.name,
      },
    ];
  }

  let hasComparison = false;
  const comparisonTime = config.comparisonTime;
  if (
    measures.some(
      (m) =>
        m.name?.endsWith(COMPARISON_PERCENT) ||
        m.name?.endsWith(COMPARISON_DELTA),
    )
  ) {
    hasComparison = true;
  }

  // Separate measures into main measures and scenario measures
  const scenarioMeasures = measures.filter((m) => hasScenarioSuffix(m.name));
  const mainMeasures = measures.filter((m) => !hasScenarioSuffix(m.name));

  // Check if we need to run scenario query
  const needsScenarioQuery =
    scenarioMeasures.length > 0 &&
    config.enableScenarioComparison &&
    !!config.selectedScenario;

  // If no scenario query needed, run normal query
  if (!needsScenarioQuery) {
    return derived(
      [runtime, ctx.metricsViewName],
      ([$runtime, metricsViewName], set) =>
        createQueryServiceMetricsViewAggregation(
          $runtime.instanceId,
          metricsViewName,
          {
            measures: prepareMeasureForComparison(measures),
            dimensions,
            where: sanitiseExpression(whereFilter, undefined),
            timeRange: {
              start: timeRange?.start ? timeRange.start : config.time.timeStart,
              end: timeRange?.end ? timeRange.end : config.time.timeEnd,
            },
            comparisonTimeRange:
              hasComparison && comparisonTime
                ? {
                    start: comparisonTime.start,
                    end: comparisonTime.end,
                  }
                : undefined,
            sort,
            limit,
            offset,
          },
          {
            query: {
              enabled: ctx.enabled,
              placeholderData: keepPreviousData,
            },
          },
          ctx.queryClient,
        ).subscribe(set),
    );
  }

  // Need scenario query - run both main and scenario queries, then merge
  // Get the base measure names for scenario query
  const baseMeasureNamesForScenario = [
    ...new Set(scenarioMeasures.map((m) => getBaseMeasureName(m.name || ""))),
  ];
  const scenarioQueryMeasures = baseMeasureNamesForScenario.map((name) => ({
    name,
  }));

  // Main query - includes all main measures plus comparison measures
  const mainQuery = derived(
    [runtime, ctx.metricsViewName],
    ([$runtime, metricsViewName], set) =>
      createQueryServiceMetricsViewAggregation(
        $runtime.instanceId,
        metricsViewName,
        {
          measures: prepareMeasureForComparison(mainMeasures),
          dimensions,
          where: sanitiseExpression(whereFilter, undefined),
          timeRange: {
            start: timeRange?.start ? timeRange.start : config.time.timeStart,
            end: timeRange?.end ? timeRange.end : config.time.timeEnd,
          },
          comparisonTimeRange:
            hasComparison && comparisonTime
              ? {
                  start: comparisonTime.start,
                  end: comparisonTime.end,
                }
              : undefined,
          sort,
          limit,
          offset,
        },
        {
          query: {
            enabled: ctx.enabled,
            placeholderData: keepPreviousData,
          },
        },
        ctx.queryClient,
      ).subscribe(set),
  );

  // Scenario query - gets scenario values for the base measures
  const scenarioQuery = derived(
    [runtime, ctx.metricsViewName],
    ([$runtime, metricsViewName], set) =>
      createQueryServiceMetricsViewAggregation(
        $runtime.instanceId,
        metricsViewName,
        {
          measures: scenarioQueryMeasures,
          dimensions,
          where: sanitiseExpression(whereFilter, undefined),
          timeRange: {
            start: timeRange?.start ? timeRange.start : config.time.timeStart,
            end: timeRange?.end ? timeRange.end : config.time.timeEnd,
          },
          scenario: config.selectedScenario,
          sort,
          limit,
          offset,
        },
        {
          query: {
            enabled: ctx.enabled,
            placeholderData: keepPreviousData,
          },
        },
        ctx.queryClient,
      ).subscribe(set),
  );

  // Combine the two queries
  type QueryResult = {
    data?: V1MetricsViewAggregationResponse;
    error?: HTTPError;
    isFetching: boolean;
    isLoading?: boolean;
    isSuccess?: boolean;
    isError?: boolean;
  };

  return derived(
    [mainQuery, scenarioQuery],
    ([mainResult, scenarioResult]: [QueryResult, QueryResult]) => {
      // If either is still fetching, return fetching state
      if (mainResult.isFetching || scenarioResult.isFetching) {
        return {
          ...mainResult,
          isFetching: true,
        };
      }

      // If main query has error, return it
      if (mainResult.error) {
        return mainResult;
      }

      // Merge scenario data into main data
      const mergedData = mergeScenarioResults(
        mainResult.data?.data,
        scenarioResult.data?.data,
        scenarioMeasures,
        dimensions,
      );

      return {
        ...mainResult,
        data: {
          ...mainResult.data,
          data: mergedData,
        },
      };
    },
  ) as CreateQueryResult<V1MetricsViewAggregationResponse, HTTPError>;
}

/***
 * Get a list of axis values for a given list of dimension values and filters
 */
export function getAxisForDimensions(
  ctx: PivotDashboardContext,
  config: PivotDataStoreConfig,
  dimensions: string[],
  measures: V1MetricsViewAggregationMeasure[],
  whereFilter: V1Expression,
  sortBy: V1MetricsViewAggregationSort[] = [],
  timeRange: TimeRangeString | undefined = undefined,
  limit = "100",
  offset = "0",
): Readable<PivotAxesData | null> {
  if (!dimensions.length) return readable(null);

  const { time } = config;

  let sortProvided = true;
  if (!sortBy.length) {
    sortBy = [
      {
        desc: true,
        name: measures[0]?.name || dimensions?.[0],
      },
    ];
    sortProvided = false;
  }

  const dimensionBody = dimensions.map((d) => {
    if (isTimeDimension(d, time.timeDimension)) {
      return {
        name: time.timeDimension,
        timeGrain: getTimeGrainFromDimension(d),
        timeZone: time.timeZone,
        alias: d,
      };
    } else return { name: d };
  });

  return derived(
    dimensionBody.map((dimension) => {
      let sortByForDimension = sortBy;
      if (
        isTimeDimension(dimension.alias, time.timeDimension) &&
        !sortProvided
      ) {
        sortByForDimension = [
          {
            desc: false,
            name: dimension.alias,
          },
        ];
      }
      return createPivotAggregationRowQuery(
        ctx,
        config,
        measures,
        [dimension],
        whereFilter,
        sortByForDimension,
        limit,
        offset,
        timeRange,
      );
    }),
    (data) => {
      const axesMap: Record<string, string[]> = {};
      const totalsMap: Record<
        string,
        V1MetricsViewAggregationResponseDataItem[]
      > = {};

      // Wait for all data to populate
      if (data.some((d) => d?.isFetching)) return { isFetching: true };

      // Check for errors in any of the queries
      const errors: PivotQueryError[] = getErrorFromResponses(data);
      if (errors.length) {
        return {
          isFetching: false,
          error: errors,
        };
      }

      data.forEach((d, i: number) => {
        const dimensionName = dimensions[i];

        axesMap[dimensionName] = (d?.data?.data || [])?.map(
          (dimValue) => dimValue[dimensionName] as string,
        );
        totalsMap[dimensionName] = d?.data?.data || [];
      });

      if (Object.values(axesMap).some((d) => !d)) return { isFetching: true };
      return {
        isFetching: false,
        data: axesMap,
        totals: totalsMap,
      };
    },
  );
}

export function getAxisQueryForMeasureTotals(
  ctx: PivotDashboardContext,
  config: PivotDataStoreConfig,
  isMeasureSortAccessor: boolean,
  sortAccessor: string | undefined,
  anchorDimension: string,
  rowDimensionValues: string[],
  timeRange: TimeRangeString,
  otherFilters: V1Expression | undefined = undefined,
) {
  let rowAxesQueryForMeasureTotals: Readable<PivotAxesData | null> =
    readable(null);

  if (rowDimensionValues.length && isMeasureSortAccessor && sortAccessor) {
    const { measureNames } = config;
    const measuresBody = measureNames.map((m) => ({ name: m }));

    const sortedRowFilters = getFilterForMeasuresTotalsAxesQuery(
      config,
      anchorDimension,
      rowDimensionValues,
    );

    let mergedFilter: V1Expression | undefined = sortedRowFilters;

    if (otherFilters) {
      mergedFilter = mergeFilters(otherFilters, sortedRowFilters);
    }

    rowAxesQueryForMeasureTotals = getAxisForDimensions(
      ctx,
      config,
      [anchorDimension],
      measuresBody,
      mergedFilter ?? createAndExpression([]),
      [],
      timeRange,
    );
  }

  return rowAxesQueryForMeasureTotals;
}

export function getTotalsRowQuery(
  ctx: PivotDashboardContext,
  config: PivotDataStoreConfig,
  colDimensionAxes: Record<string, string[]> = {},
) {
  const { colDimensionNames } = config;

  const { time } = config;
  const measureBody = config.measureNames.map((m) => ({ name: m }));
  const dimensionBody = colDimensionNames.map((dimension) => {
    if (isTimeDimension(dimension, time.timeDimension)) {
      return {
        name: time.timeDimension,
        timeGrain: getTimeGrainFromDimension(dimension),
        timeZone: time.timeZone,
        alias: dimension,
      };
    } else return { name: dimension };
  });

  const colFilters = colDimensionNames
    .filter((d) => !isTimeDimension(d, time.timeDimension))
    .filter((d) => colDimensionAxes[d]?.length > 0)
    .map((dimension) =>
      createInExpression(dimension, colDimensionAxes[dimension]),
    );

  const mergedFilter =
    mergeFilters(createAndExpression(colFilters), config.whereFilter) ??
    createAndExpression([]);

  const sortBy = [
    {
      desc: true,
      name: config.measureNames[0],
    },
  ];
  return createPivotAggregationRowQuery(
    ctx,
    config,
    measureBody,
    dimensionBody,
    mergedFilter,
    sortBy,
    "300",
  );
}
