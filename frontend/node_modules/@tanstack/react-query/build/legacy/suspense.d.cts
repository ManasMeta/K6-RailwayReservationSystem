import { QueryErrorResetBoundaryValue } from "./QueryErrorResetBoundary.cjs";
import { DefaultError, DefaultedQueryObserverOptions, Query, QueryKey, QueryObserver, QueryObserverResult } from "@tanstack/query-core";
//#region src/suspense.d.ts
/**
 * The default `throwOnError` of the suspense hooks: throws the error to the nearest error boundary
 * only if the query has no data to show.
 * @param _error - The error of the query. Unused.
 * @param query - The query that errored.
 * @returns `true` if the query has no data.
 */
export declare const defaultThrowOnError: <TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(_error: TError, query: Query<TQueryFnData, TError, TData, TQueryKey>) => boolean;
/**
 * Raises `staleTime` and a numeric `gcTime` to at least 1000ms when `suspense` is enabled, so a
 * component that remounts after suspending doesn't refetch right away or find the query garbage
 * collected. A `'static'` `staleTime` is kept as is. Mutates the options.
 * @param defaultedOptions - The defaulted query options to adjust.
 */
export declare const ensureSuspenseTimers: (defaultedOptions: DefaultedQueryObserverOptions<any, any, any, any, any>) => void;
/**
 * Checks whether a query should suspend: `suspense` is enabled and the result is still `pending`.
 * @param defaultedOptions - The defaulted query options, if any.
 * @param result - The current result of the observer.
 * @returns `true` if the component should suspend.
 */
export declare const shouldSuspend: (defaultedOptions: DefaultedQueryObserverOptions<any, any, any, any, any> | undefined, result: QueryObserverResult<any, any>) => boolean | undefined;
/**
 * Fetches the query for a suspending component, without affecting the observer's own result. If
 * the fetch fails, the reset state of the error boundary is cleared, so the error is thrown to it.
 * @param defaultedOptions - The defaulted query options to fetch with.
 * @param observer - The observer of the query.
 * @param errorResetBoundary - The value of the nearest `QueryErrorResetBoundary`.
 * @returns A promise that resolves once the fetch settles. It never rejects.
 */
export declare const fetchOptimistic: <TQueryFnData, TError, TData, TQueryData, TQueryKey extends QueryKey>(defaultedOptions: DefaultedQueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>, observer: QueryObserver<TQueryFnData, TError, TData, TQueryData, TQueryKey>, errorResetBoundary: QueryErrorResetBoundaryValue) => Promise<void | QueryObserverResult<TData, TError>>;
//#endregion
//# sourceMappingURL=suspense.d.cts.map