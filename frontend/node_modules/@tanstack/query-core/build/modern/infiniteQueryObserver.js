import { hasNextPage, hasPreviousPage } from "./infiniteQueryBehavior.js";
import { QueryObserver } from "./queryObserver.js";
//#region src/infiniteQueryObserver.ts
/**
* An `InfiniteQueryObserver` extends `QueryObserver` to observe and switch
* between infinite queries. It augments the base `QueryObserverResult` with
* infinite-query-specific fields and methods, such as `hasNextPage` and
* `fetchNextPage`, and is the primitive that framework adapters (e.g.
* `useInfiniteQuery`) build their hooks on top of.
* @example
* ```ts
* const observer = new InfiniteQueryObserver(queryClient, {
*   queryKey: ['projects'],
*   queryFn: ({ pageParam }) => fetchProjects(pageParam),
*   initialPageParam: 0,
*   getNextPageParam: (lastPage) => lastPage.nextCursor,
* })
*
* const unsubscribe = observer.subscribe((result) => console.log(result))
* ```
*/
var InfiniteQueryObserver = class extends QueryObserver {
	constructor(client, options) {
		super(client, options);
	}
	bindMethods() {
		super.bindMethods();
		this.fetchNextPage = this.fetchNextPage.bind(this);
		this.fetchPreviousPage = this.fetchPreviousPage.bind(this);
	}
	/**
	* Updates the observer's options. Behaves the same as
	* `QueryObserver.setOptions`, additionally marking the options as
	* belonging to an infinite query before delegating to the base
	* implementation.
	* @param options - The new infinite query observer options.
	*/
	setOptions(options) {
		options._type = "infinite";
		super.setOptions(options);
	}
	/**
	* The infinite-query counterpart of {@link QueryObserver#getOptimisticResult}, marking the
	* options as an infinite query before delegating to it. Called by framework adapters (e.g.
	* `useInfiniteQuery`) ahead of subscribing, to compute the current `InfiniteQueryObserverResult`
	* synchronously.
	* @param options - The defaulted infinite query observer options to compute the result for.
	* @returns The result for the given options.
	*/
	getOptimisticResult(options) {
		options._type = "infinite";
		return super.getOptimisticResult(options);
	}
	/**
	* Fetches the next page of the infinite query and returns a promise that
	* resolves with the resulting `InfiniteQueryObserverResult`. The page
	* param used for the fetch is determined by `getNextPageParam`, which
	* receives the current pages/page params and whose result also determines
	* `hasNextPage`.
	* @param options - Set `cancelRefetch` to `false` to ignore the call while a fetch is running,
	* and `throwOnError` to `true` to reject when the fetch fails.
	* @returns A promise that resolves with the result after the next page is fetched. With
	* `cancelRefetch: false`, a running fetch is reused instead, so the next page may not be fetched.
	* @see {@link InfiniteQueryObserver#fetchPreviousPage}
	* @example
	* ```ts
	* const { hasNextPage } = observer.getCurrentResult()
	*
	* if (hasNextPage) {
	*   await observer.fetchNextPage()
	* }
	* ```
	*/
	fetchNextPage(options) {
		return this.fetch({
			...options,
			meta: { fetchMore: { direction: "forward" } }
		});
	}
	/**
	* Fetches the previous page of the infinite query and returns a promise
	* that resolves with the resulting `InfiniteQueryObserverResult`. The page
	* param used for the fetch is determined by `getPreviousPageParam`, which
	* receives the current pages/page params and whose result also determines
	* `hasPreviousPage`.
	* @param options - Set `cancelRefetch` to `false` to ignore the call while a fetch is running,
	* and `throwOnError` to `true` to reject when the fetch fails.
	* @returns A promise that resolves with the result after the previous page is fetched. With
	* `cancelRefetch: false`, a running fetch is reused instead, so the previous page may not be fetched.
	* @see {@link InfiniteQueryObserver#fetchNextPage}
	* @example
	* ```ts
	* const { hasPreviousPage } = observer.getCurrentResult()
	*
	* if (hasPreviousPage) {
	*   await observer.fetchPreviousPage()
	* }
	* ```
	*/
	fetchPreviousPage(options) {
		return this.fetch({
			...options,
			meta: { fetchMore: { direction: "backward" } }
		});
	}
	createResult(query, options) {
		const { state } = query;
		const parentResult = super.createResult(query, options);
		const { isFetching, isRefetching, isError, isRefetchError } = parentResult;
		const fetchDirection = state.fetchMeta?.fetchMore?.direction;
		const isFetchNextPageError = isError && fetchDirection === "forward";
		const isFetchingNextPage = isFetching && fetchDirection === "forward";
		const isFetchPreviousPageError = isError && fetchDirection === "backward";
		const isFetchingPreviousPage = isFetching && fetchDirection === "backward";
		return {
			...parentResult,
			fetchNextPage: this.fetchNextPage,
			fetchPreviousPage: this.fetchPreviousPage,
			hasNextPage: hasNextPage(options, state.data),
			hasPreviousPage: hasPreviousPage(options, state.data),
			isFetchNextPageError,
			isFetchingNextPage,
			isFetchPreviousPageError,
			isFetchingPreviousPage,
			isRefetchError: isRefetchError && !isFetchNextPageError && !isFetchPreviousPageError,
			isRefetching: isRefetching && !isFetchingNextPage && !isFetchingPreviousPage
		};
	}
};
//#endregion
export { InfiniteQueryObserver };

//# sourceMappingURL=infiniteQueryObserver.js.map