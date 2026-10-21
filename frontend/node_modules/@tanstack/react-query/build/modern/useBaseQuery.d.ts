import { UseBaseQueryOptions } from "./types.js";
import { QueryClient, QueryKey, QueryObserver, QueryObserverResult } from "@tanstack/query-core";
//#region src/useBaseQuery.d.ts
/**
 * Base implementation shared by `useQuery`, `useInfiniteQuery`, `useSuspenseQuery`, and
 * `useSuspenseInfiniteQuery`.
 * @param options - The options passed to the calling hook.
 * @param Observer - The observer class from query-core (`QueryObserver` or
 * `InfiniteQueryObserver`).
 * @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest
 * context will be used.
 * @returns The query result, tracking which properties are read unless `notifyOnChangeProps` is
 * set.
 * @throws {Error} If `options` is not an object (outside production), or the query error when it should be
 * thrown to the nearest error boundary (see `throwOnError`). While suspending, it throws a promise instead.
 */
export declare function useBaseQuery<TQueryFnData, TError, TData, TQueryData, TQueryKey extends QueryKey>(options: UseBaseQueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>, Observer: typeof QueryObserver, queryClient?: QueryClient): QueryObserverResult<TData, TError>;
//#endregion
//# sourceMappingURL=useBaseQuery.d.ts.map