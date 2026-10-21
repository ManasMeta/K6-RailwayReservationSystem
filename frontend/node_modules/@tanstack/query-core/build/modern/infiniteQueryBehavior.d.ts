import { A as InfiniteData, V as InfiniteQueryPageParamsOptions, er as QueryBehavior } from "./hydration-Bf0oMcwO.js";
//#region src/infiniteQueryBehavior.d.ts
/**
 * Creates the behavior that fetches the pages of an infinite query: the next or previous page for
 * `fetchNextPage`/`fetchPreviousPage`, or all pages again from the start on a refetch.
 * @param pages - The number of pages to fetch from the start when all pages are fetched again,
 * e.g. from the `pages` option of `queryClient.infiniteQuery`. Defaults to the number of cached
 * pages.
 * @returns The query behavior to set on an infinite query.
 */
export declare function infiniteQueryBehavior<TQueryFnData, TError, TData, TPageParam>(pages?: number): QueryBehavior<TQueryFnData, TError, InfiniteData<TData, TPageParam>>;
/**
 * Checks if there is a next page.
 * @param options - The infinite query options with `getNextPageParam`.
 * @param data - The current pages and page params.
 * @returns `true` if `getNextPageParam` returns a value other than `null` or `undefined`.
 */
export declare function hasNextPage(options: InfiniteQueryPageParamsOptions<any, any>, data?: InfiniteData<unknown>): boolean;
/**
 * Checks if there is a previous page.
 * @param options - The infinite query options with `getPreviousPageParam`.
 * @param data - The current pages and page params.
 * @returns `true` if `getPreviousPageParam` is set and returns a value other than `null` or
 * `undefined`.
 */
export declare function hasPreviousPage(options: InfiniteQueryPageParamsOptions<any, any>, data?: InfiniteData<unknown>): boolean;
//#endregion
//# sourceMappingURL=infiniteQueryBehavior.d.ts.map