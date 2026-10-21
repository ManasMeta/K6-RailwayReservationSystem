import { t as Subscribable } from "./subscribable-czlHOxMP.js";
import { t as Removable } from "./removable-Cw9GNGyK.js";
//#region src/queryObserver.d.ts
type QueryObserverListener<TData, TError> = (result: QueryObserverResult<TData, TError>) => void;
interface ObserverFetchOptions extends FetchOptions {
  throwOnError?: boolean;
}
/**
 * A `QueryObserver` watches a single query in the `QueryCache` and computes a
 * `QueryObserverResult` from its state, recomputing and notifying subscribers
 * whenever the underlying query (or the observer's options) changes. It is
 * the primitive that framework adapters (e.g. `useQuery`) build their hooks
 * on top of, but it can also be used directly to observe and switch between
 * queries outside of any framework.
 * @example
 * ```ts
 * const observer = new QueryObserver(queryClient, {
 *   queryKey: ['posts'],
 *   queryFn: fetchPosts,
 * })
 *
 * const unsubscribe = observer.subscribe((result) => {
 *   console.log(result.data)
 * })
 * ```
 */
declare class QueryObserver<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> extends Subscribable<QueryObserverListener<TData, TError>> {
  #private;
  options: QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>;
  constructor(client: QueryClient, options: QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>);
  /**
   * Binds the methods of the result (`refetch`) to the observer, so they keep working when destructured
   * from it. Subclasses override it to bind their own result methods as well.
   */
  protected bindMethods(): void;
  protected onSubscribe(): void;
  protected onUnsubscribe(): void;
  /**
   * Returns whether the observed query is currently stale and configured
   * (via the `refetchOnReconnect` option) to refetch when the network
   * reconnects.
   * @returns `true` if the observer should refetch the query on reconnect.
   */
  shouldFetchOnReconnect(): boolean;
  /**
   * Returns whether the observed query is currently stale and configured
   * (via the `refetchOnWindowFocus` option) to refetch when the window
   * regains focus.
   * @returns `true` if the observer should refetch the query on window focus.
   */
  shouldFetchOnWindowFocus(): boolean;
  /**
   * Stops observing the current query: clears all listeners, cancels the
   * stale and refetch-interval timers, and removes this observer from the
   * query it was observing.
   */
  destroy(): void;
  /**
   * Updates the observer's options. This will re-resolve the query being
   * observed (switching to a different query if the `queryKey` changed),
   * trigger a fetch if the new options require one and the observer has
   * subscribers, recompute the current result, and reschedule the stale and
   * refetch-interval timers as needed.
   * @param options - The new observer options. They are defaulted with {@link
   * QueryClient#defaultQueryOptions} before being applied.
   * @throws {Error} If `enabled` is neither a boolean nor a function.
   * @example
   * ```ts
   * observer.setOptions({ queryKey: ['posts', 1], queryFn: () => fetchPost(1) })
   * // later: switch to a different query, reusing the same observer
   * observer.setOptions({ queryKey: ['posts', 2], queryFn: () => fetchPost(2) })
   * ```
   */
  setOptions(options: QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>): void;
  /**
   * Computes the result the observer would produce for the given (already-defaulted) options
   * right now, building the underlying `Query` if it doesn't exist yet, without waiting for a
   * subscription callback. Called by framework adapters on every render (e.g. `useQuery`) so the
   * returned value is available synchronously, ahead of `setOptions` triggering an actual fetch.
   * @param options - The defaulted observer options to compute the result for.
   * @returns The result for the given options.
   */
  getOptimisticResult(options: DefaultedQueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>): QueryObserverResult<TData, TError>;
  /**
   * Returns the most recently computed `QueryObserverResult` for the
   * observed query. This is a point-in-time read; to be notified of updates
   * as they happen, subscribe to the observer instead (its inherited
   * `subscribe` method).
   * @returns The observer's latest result.
   * @example
   * ```ts
   * const result = observer.getCurrentResult()
   * console.log(result.status, result.data)
   * ```
   */
  getCurrentResult(): QueryObserverResult<TData, TError>;
  /**
   * Wraps a `QueryObserverResult` in a `Proxy` that records which properties are read, via
   * {@link QueryObserver#trackProp} (and an optional `onPropTracked` callback). Used by framework
   * adapters when `notifyOnChangeProps` is not set, to implement its default "only re-render on
   * properties you actually read" behavior.
   * @param result - The result to wrap.
   * @param onPropTracked - Called with the name of each property that is read.
   * @returns A proxy of `result` that tracks property reads.
   */
  trackResult(result: QueryObserverResult<TData, TError>, onPropTracked?: (key: keyof QueryObserverResult) => void): QueryObserverResult<TData, TError>;
  /**
   * Records that the given `QueryObserverResult` property was read, so a subsequent update only
   * notifies this observer if a tracked property actually changed. Normally called indirectly via
   * {@link QueryObserver#trackResult}'s proxy; exposed directly for adapters that track property
   * access themselves (e.g. through their own reactivity system) instead of via the proxy.
   * @param key - The name of the property that was read.
   */
  trackProp(key: keyof QueryObserverResult): void;
  /**
   * Returns the `Query` instance this observer is currently observing.
   * @returns The observed query.
   */
  getCurrentQuery(): Query<TQueryFnData, TError, TQueryData, TQueryKey>;
  /**
   * Refetches the observed query and returns a promise that resolves with
   * the resulting `QueryObserverResult`.
   * @param options - Set `cancelRefetch` to `false` to keep a running fetch instead of cancelling
   * it, and `throwOnError` to `true` to reject when the refetch fails.
   * @returns A promise that resolves with the result after the refetch.
   * @example
   * ```ts
   * const result = await observer.refetch({ cancelRefetch: false })
   * console.log(result.data)
   * ```
   */
  refetch({ ...options }?: RefetchOptions): Promise<QueryObserverResult<TData, TError>>;
  /**
   * Fetches a query defined by the given options without affecting this
   * observer's own tracked query or result, and returns a promise that
   * resolves with the `QueryObserverResult` for that fetch. This is useful
   * for prefetching data that another observer (e.g. a query about to be
   * navigated to) will need, ahead of time.
   * @param options - The observer options of the query to fetch.
   * @returns A promise that resolves with the result for the fetched query.
   * @example
   * ```ts
   * const result = await observer.fetchOptimistic({
   *   queryKey: ['posts', 2],
   *   queryFn: () => fetchPost(2),
   * })
   * console.log(result.data)
   * ```
   */
  fetchOptimistic(options: QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>): Promise<QueryObserverResult<TData, TError>>;
  /**
   * Fetches the observed query and updates the result once the fetch settles. Used by `refetch` and,
   * in `InfiniteQueryObserver`, to fetch more pages.
   * @param fetchOptions - Options for this fetch. `cancelRefetch` defaults to `true`.
   * @returns A promise that resolves with the updated result.
   */
  protected fetch(fetchOptions: ObserverFetchOptions): Promise<QueryObserverResult<TData, TError>>;
  /**
   * Computes the result for a query and options from the query's state, applying `select`,
   * `placeholderData`, and the derived flags. Subclasses override it to add their own fields.
   * @param query - The query to compute the result for.
   * @param options - The observer options to compute the result with.
   * @returns The computed result.
   */
  protected createResult(query: Query<TQueryFnData, TError, TQueryData, TQueryKey>, options: QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>): QueryObserverResult<TData, TError>;
  /**
   * Recomputes and stores the current result from the current query/options, notifying listeners
   * if it changed. Framework adapters call this right after subscribing to make sure no query
   * update was missed in the gap between creating the observer and subscribing to it.
   */
  updateResult(): void;
  /**
   * Updates the observer's result when the observed query changes, and reschedules its timers if it
   * has listeners.
   * @internal
   */
  onQueryUpdate(): void;
}
//#endregion
//#region src/query.d.ts
interface QueryConfig<TQueryFnData, TError, TData, TQueryKey extends QueryKey = QueryKey> {
  client: QueryClient;
  queryKey: TQueryKey;
  queryHash: string;
  options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>;
  defaultOptions?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>;
  state?: QueryState<TData, TError>;
}
/**
 * The raw state stored on a `Query` instance. This is the underlying state
 * that observer results (e.g. `QueryObserverResult`) are derived from.
 */
interface QueryState<TData = unknown, TError = DefaultError> {
  /**
   * The last successfully resolved data for the query.
   */
  data: TData | undefined;
  /**
   * The number of times the query has successfully resolved.
   */
  dataUpdateCount: number;
  /**
   * The timestamp for when the query most recently returned the `status` as `"success"`.
   */
  dataUpdatedAt: number;
  /**
   * The error object for the query, if the last attempt resulted in an error.
   * - Defaults to `null`.
   */
  error: TError | null;
  /**
   * The sum of all errors, incremented every time the query resolves with an error.
   */
  errorUpdateCount: number;
  /**
   * The timestamp for when the query most recently returned the `status` as `"error"`.
   */
  errorUpdatedAt: number;
  /**
   * The failure count for the current fetch.
   * - Incremented every time the fetch fails.
   * - Reset to `0` when the fetch succeeds.
   */
  fetchFailureCount: number;
  /**
   * The reason the current fetch failed, as reported by the retryer.
   * - Reset to `null` when the fetch succeeds.
   */
  fetchFailureReason: TError | null;
  /**
   * Metadata passed to the currently in-flight (or most recent) fetch, e.g. the
   * `fetchMore` direction for infinite queries.
   */
  fetchMeta: FetchMeta | null;
  /**
   * Whether the query has been marked as invalidated via `invalidate()`.
   * - Reset to `false` whenever the query resolves successfully.
   */
  isInvalidated: boolean;
  /**
   * The status of the query.
   * - `pending` if there's no cached data and no attempt was finished yet.
   * - `error` if the last attempt resulted in an error.
   * - `success` if the query has data.
   */
  status: QueryStatus;
  /**
   * The fetch status of the query.
   * - `fetching`: the `queryFn` is currently executing.
   * - `paused`: a fetch wanted to run but has been paused (see network mode).
   * - `idle`: the query is not fetching.
   */
  fetchStatus: FetchStatus;
}
/**
 * The context passed to a {@link QueryBehavior}'s `onFetch`, which can replace `fetchFn` to change
 * how the query fetches (e.g. to fetch pages for an infinite query).
 */
interface FetchContext<TQueryFnData, TError, TData, TQueryKey extends QueryKey = QueryKey> {
  /**
   * The function that runs the fetch. By default it calls `queryFn`; `onFetch` can replace it.
   */
  fetchFn: () => unknown | Promise<unknown>;
  /**
   * The options of this fetch.
   */
  fetchOptions?: FetchOptions;
  /**
   * The `AbortSignal` that aborts when the fetch is cancelled.
   */
  signal: AbortSignal;
  /**
   * The options of the query.
   */
  options: QueryOptions<TQueryFnData, TError, TData, any>;
  /**
   * The `QueryClient` the query belongs to.
   */
  client: QueryClient;
  /**
   * The key of the query.
   */
  queryKey: TQueryKey;
  /**
   * The state of the query when the fetch starts.
   */
  state: QueryState<TData, TError>;
}
/**
 * Customizes how a query fetches, e.g. the behavior that fetches the pages of an infinite query.
 */
interface QueryBehavior<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> {
  /**
   * Called before each fetch of the query, e.g. to replace `fetchFn` in the context.
   */
  onFetch: (context: FetchContext<TQueryFnData, TError, TData, TQueryKey>, query: Query) => void;
}
/**
 * The direction an infinite query fetches in: `'forward'` for the next page, `'backward'` for the
 * previous one.
 */
type FetchDirection = 'forward' | 'backward';
/**
 * Metadata for a fetch, e.g. the direction when an infinite query fetches more pages.
 */
interface FetchMeta {
  /**
   * Set when an infinite query fetches another page, with the direction to fetch in.
   */
  fetchMore?: {
    direction: FetchDirection;
  };
}
/**
 * Options for a single fetch of a query.
 */
interface FetchOptions<TData = unknown> {
  /**
   * If `true`, an in-flight fetch is cancelled before starting a new one, when the query already
   * has data. Otherwise, the in-flight fetch is reused.
   */
  cancelRefetch?: boolean;
  /**
   * Metadata of the fetch, stored in the query's `fetchMeta` state.
   */
  meta?: FetchMeta;
  /**
   * A promise to use for the first attempt instead of calling `fetchFn`, e.g. a pending promise
   * restored by `hydrate`.
   */
  initialPromise?: Promise<TData>;
}
interface FailedAction$1<TError> {
  type: 'failed';
  failureCount: number;
  error: TError;
}
interface FetchAction {
  type: 'fetch';
  meta?: FetchMeta;
}
interface SuccessAction$1<TData> {
  data: TData | undefined;
  type: 'success';
  dataUpdatedAt?: number;
  manual?: boolean;
}
interface ErrorAction$1<TError> {
  type: 'error';
  error: TError;
}
interface InvalidateAction {
  type: 'invalidate';
}
interface PauseAction$1 {
  type: 'pause';
}
interface ContinueAction$1 {
  type: 'continue';
}
interface SetStateAction<TData, TError> {
  type: 'setState';
  state: Partial<QueryState<TData, TError>>;
}
/**
 * The actions a query dispatches to update its state, e.g. when it starts fetching, fails, or
 * succeeds.
 */
type Action$1<TData, TError> = ContinueAction$1 | ErrorAction$1<TError> | FailedAction$1<TError> | FetchAction | InvalidateAction | PauseAction$1 | SetStateAction<TData, TError> | SuccessAction$1<TData>;
/**
 * Represents a single cached query. A `Query` holds the query's key, options,
 * state (data/error/status), and the observers currently subscribed to it.
 *
 * Instances are created and managed internally by `QueryCache`; application
 * code typically interacts with queries indirectly through `QueryClient` or
 * a framework hook like `useQuery`. Direct access to a `Query` instance is
 * possible via `queryCache.find()`/`findAll()` for inspecting cache state.
 * @example
 * ```ts
 * const queryCache = queryClient.getQueryCache()
 * const query = queryCache.find({ queryKey: ['posts'] })
 *
 * if (query) {
 *   console.log(query.state.dataUpdatedAt)
 * }
 * ```
 */
declare class Query<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> extends Removable {
  #private;
  queryKey: TQueryKey;
  queryHash: string;
  options: QueryOptions<TQueryFnData, TError, TData, TQueryKey>;
  state: QueryState<TData, TError>;
  observers: Array<QueryObserver<any, any, any, any, any>>;
  constructor(config: QueryConfig<TQueryFnData, TError, TData, TQueryKey>);
  /**
   * The `meta` object passed in the query's options, if any.
   * @returns The query's `meta`, or `undefined` if none was set.
   */
  get meta(): QueryMeta | undefined;
  /**
   * `'infinite'` for an infinite query, otherwise `undefined`.
   * @internal
   * @returns The type of the query, set from the `_type` option (e.g. `'infinite'`).
   */
  get queryType(): "infinite" | undefined;
  /**
   * The promise for the currently in-flight fetch, if the query is fetching.
   * `undefined` when the query is not fetching.
   * @returns The promise of the in-flight fetch, or `undefined`.
   */
  get promise(): Promise<TData> | undefined;
  /**
   * Replaces the query's options and applies their `gcTime`. If the query has no data yet, it gets
   * the `initialData` from the new options, if any.
   * @internal
   * @param options - The new query options, merged on top of the query's default options.
   */
  setOptions(options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>): void;
  protected optionalRemove(): void;
  /**
   * Writes new data to the query and marks it as successfully fetched.
   * @internal
   * @param newData - The data to write. Structural sharing with the current data is applied.
   * @param options - Set `updatedAt` to override the timestamp, and `manual` to mark the write as
   * manual (e.g. from `queryClient.setQueryData`).
   * @returns The data that was written.
   */
  setData(newData: TData, options?: SetDataOptions & {
    manual: boolean;
  }): TData;
  /**
   * Merges the given partial state directly into this query's state, notifying observers. Used
   * by persistence and broadcast plugins to restore a state snapshot, and by devtools to let a
   * user manually trigger a loading/error state or edit the cached data.
   * @param state - The partial state to merge into the query's state.
   */
  setState(state: Partial<QueryState<TData, TError>>): void;
  /**
   * Cancels the query's currently in-flight fetch, if any.
   * - Returns a promise that resolves once the cancellation has settled.
   * - If no fetch is in progress, resolves immediately.
   * @param options - Set `revert` to restore the state from before the fetch started, and `silent`
   * to suppress the cancellation error when a new fetch replaces the cancelled one.
   * @returns A promise that resolves once the cancellation has settled.
   * @example
   * ```ts
   * await query.cancel()
   * ```
   */
  cancel(options?: CancelOptions): Promise<void>;
  /**
   * Clears the query's garbage collection timeout and silently cancels any
   * in-flight fetch. Called by `QueryCache` when the query is removed from
   * the cache.
   * @see {@link Query#cancel}
   */
  destroy(): void;
  /**
   * The state the query was created with.
   * @internal
   * @returns The state the query had when it was first created, used by {@link Query#reset}.
   */
  get resetState(): QueryState<TData, TError>;
  /**
   * Resets the query back to its initial state (the state it had when it was
   * first created, e.g. any `initialData`), destroying it first to cancel any
   * in-flight fetch.
   */
  reset(): void;
  /**
   * Returns `true` if the query has at least one observer for which `enabled`
   * does not resolve to `false`.
   * @returns `true` if the query has an enabled observer.
   */
  isActive(): boolean;
  /**
   * Returns `true` if the query is disabled, meaning it will not fetch
   * automatically.
   * - If the query has observers, it is disabled when none of them are active
   *   (see `isActive`).
   * - If the query has no observers, it is disabled when its `queryFn` is
   *   `skipToken` or it has never been fetched.
   * @returns `true` if the query is disabled.
   */
  isDisabled(): boolean;
  /**
   * Returns `true` if the query has been fetched, i.e. it has resolved with
   * either data or an error at least once.
   * @returns `true` if the query has been fetched.
   */
  isFetched(): boolean;
  /**
   * Returns `true` if the query has at least one observer configured with
   * `staleTime: 'static'`, meaning it is treated as never stale.
   * @returns `true` if the query is static.
   */
  isStatic(): boolean;
  /**
   * Returns `true` if the query is stale.
   * - If the query has observers, defers to whether any observer's current
   *   result reports `isStale` (which accounts for each observer's own
   *   `staleTime` and `enabled` state).
   * - If the query has no observers, it is considered stale when it has no
   *   data or has been invalidated.
   * @returns `true` if the query is stale.
   * @see {@link Query#isStaleByTime}
   * @example
   * ```ts
   * if (query.isStale()) {
   *   // refetch or otherwise treat the cached data as outdated
   * }
   * ```
   */
  isStale(): boolean;
  /**
   * Returns `true` if the query's data is stale relative to the given
   * `staleTime` (defaults to `0`).
   * - A query with no data is always stale.
   * - `staleTime: 'static'` is never stale.
   * - An invalidated query is always stale.
   * - Otherwise, staleness is based on elapsed time since `dataUpdatedAt`.
   * @param staleTime - The time, in milliseconds, after which data is considered stale, or
   * `'static'` to never treat existing data as stale. A query without data is stale either way.
   * @returns `true` if the query's data is stale.
   * @see {@link Query#isStale}
   * @example
   * ```ts
   * const isStale = query.isStaleByTime(1000 * 60)
   * ```
   */
  isStaleByTime(staleTime?: StaleTime): boolean;
  /**
   * Refetches the query when the window regains focus, if an observer wants that, and continues a
   * paused fetch.
   * @internal
   */
  onFocus(): void;
  /**
   * Refetches the query when the app reconnects, if an observer wants that, and continues a paused
   * fetch.
   * @internal
   */
  onOnline(): void;
  /**
   * Subscribes an observer to the query and stops its garbage collection.
   * @internal
   * @param observer - The observer to add. Adding an observer that is already subscribed does
   * nothing.
   */
  addObserver(observer: QueryObserver<any, any, any, any, any>): void;
  /**
   * Unsubscribes an observer from the query.
   * @internal
   * @param observer - The observer to remove. When the last observer is removed, the in-flight
   * fetch is cancelled if its abort signal was consumed (otherwise only its retries are stopped),
   * and garbage collection is scheduled.
   */
  removeObserver(observer: QueryObserver<any, any, any, any, any>): void;
  /**
   * Returns the number of observers currently subscribed to this query.
   * @returns The number of observers.
   * @example
   * ```ts
   * if (query.getObserversCount() === 0) {
   *   // no component is currently watching this query
   * }
   * ```
   */
  getObserversCount(): number;
  /**
   * Marks the query as invalidated, unless it is already invalidated. This
   * updates `state.isInvalidated` and notifies observers, but does not by
   * itself trigger a refetch.
   * @example
   * ```ts
   * query.invalidate()
   * ```
   */
  invalidate(): void;
  /**
   * Fetches the query, i.e. runs its `queryFn` (through any configured
   * retryer/behavior) and updates the query's state with the result.
   * - If a fetch is already in flight, returns its promise instead of
   *   starting a new one, unless `fetchOptions.cancelRefetch` is set and the
   *   query already has data, in which case the current fetch is silently
   *   cancelled first.
   * - If `options` is passed, it replaces the query's current options
   *   before fetching.
   * @param options - Query options that replace the query's current options before fetching. They
   * are not applied when an in-flight fetch is reused.
   * @param fetchOptions - Set `cancelRefetch` to cancel an in-flight fetch first (only if the query
   * already has data), and `meta` to pass extra information to the query's behavior.
   * @returns A promise that resolves with the fetched data, or rejects with the fetch error. If the
   * fetch is cancelled with `revert` while the query has data, it resolves with the restored data
   * instead.
   */
  fetch(options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>, fetchOptions?: FetchOptions<TQueryFnData>): Promise<TData>;
}
/**
 * Returns the state changes applied when a query starts fetching.
 * @param data - The query's current data. If it is `undefined`, the query is also reset to
 * `'pending'` with no error.
 * @param options - The query options, whose `networkMode` decides whether the query is `'fetching'`
 * or `'paused'`.
 * @returns The partial query state for a starting fetch.
 */
declare function fetchState<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(data: TData | undefined, options: QueryOptions<TQueryFnData, TError, TData, TQueryKey>): {
  readonly error?: null | undefined;
  readonly status?: "pending" | undefined;
  readonly fetchFailureCount: 0;
  readonly fetchFailureReason: null;
  readonly fetchStatus: "fetching" | "paused";
};
//#endregion
//#region src/mutationObserver.d.ts
type MutationObserverListener<TData, TError, TVariables, TOnMutateResult> = (result: MutationObserverResult<TData, TError, TVariables, TOnMutateResult>) => void;
/**
 * Observes a single mutation and derives a `MutationObserverResult` from it.
 * A framework hook like `useMutation` creates one `MutationObserver` per hook
 * call, keeps it stable across re-renders, calls `setOptions` when the options
 * passed to the hook change, subscribes to it to re-render on updates, and
 * reads `getCurrentResult()` for the value to return. Calling `mutate()`
 * builds a new underlying `Mutation` in the `MutationCache` and executes it.
 * @example
 * ```ts
 * const observer = new MutationObserver(queryClient, {
 *   mutationFn: (variables: { title: string }) => addPost(variables),
 * })
 * ```
 */
declare class MutationObserver<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> extends Subscribable<MutationObserverListener<TData, TError, TVariables, TOnMutateResult>> {
  #private;
  options: MutationObserverOptions<TData, TError, TVariables, TOnMutateResult>;
  constructor(client: QueryClient, options: MutationObserverOptions<TData, TError, TVariables, TOnMutateResult>);
  /**
   * Binds the methods of the result (`mutate` and `reset`) to the observer, so they keep working when
   * destructured from it.
   */
  protected bindMethods(): void;
  /**
   * Updates the observer's options.
   *
   * If the new `mutationKey` differs from the previous one (and both were
   * defined), the observer is reset, detaching it from the mutation it was
   * observing. Otherwise, if the currently observed mutation is still
   * `pending`, its options are updated in place as well.
   * @param options - The new mutation observer options. They are defaulted with {@link
   * QueryClient#defaultMutationOptions} before being applied.
   * @example
   * ```ts
   * observer.setOptions({
   *   mutationFn: (variables: { title: string }) => addPost(variables),
   *   onSuccess: (data) => console.log(data),
   * })
   * ```
   */
  setOptions(options: MutationObserverOptions<TData, TError, TVariables, TOnMutateResult>): void;
  protected onSubscribe(): void;
  protected onUnsubscribe(): void;
  /**
   * Updates the observer's result when the observed mutation changes, and notifies its listeners.
   * @internal
   * @param action - The action that updated the observed mutation, passed on to the observer's
   * callbacks.
   */
  onMutationUpdate(action: Action<TData, TError, TVariables, TOnMutateResult>): void;
  /**
   * Returns the observer's current result, derived from the observed
   * mutation's state (or the default, `idle` state if no mutation has been
   * built yet, e.g. before the first `mutate()` call or after `reset()`).
   * @returns The observer's latest result.
   */
  getCurrentResult(): MutationObserverResult<TData, TError, TVariables, TOnMutateResult>;
  /**
   * Detaches the observer from the mutation it is currently observing (if
   * any) and resets the observed result back to its default, `idle` state.
   *
   * This does not cancel an in-flight mutation; the mutation itself keeps
   * running to completion and its own callbacks still fire, but this
   * observer stops reflecting its state and a subsequent `mutate()` call
   * will build a brand new mutation.
   * @see {@link MutationObserver#mutate}
   * @example
   * ```ts
   * observer.reset()
   * ```
   */
  reset(): void;
  /**
   * Builds a new `Mutation` in the `MutationCache` using the observer's
   * current options, detaches this observer from any previously observed
   * mutation, attaches it to the new one, and executes it with the given
   * variables.
   *
   * The optional per-call `options` (`onSuccess`/`onError`/`onSettled`) are
   * invoked once the mutation settles, in addition to any callbacks defined
   * on the observer's own options.
   * @param variables - The variables passed to the `mutationFn`.
   * @param options - Per-call `onSuccess`, `onError`, and `onSettled` callbacks.
   * @returns A promise that resolves with the mutation's data, or rejects with its error.
   * @example
   * ```ts
   * await observer.mutate(
   *   { title: 'New post' },
   *   { onSuccess: (data) => console.log(data) },
   * )
   * ```
   */
  mutate(variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TOnMutateResult>): Promise<TData>;
}
//#endregion
//#region src/mutationCache.d.ts
/**
 * Global callbacks that fire for every mutation handled by a `MutationCache`, regardless of which
 * component or observer triggered it. They differ from the `defaultOptions` provided to a
 * `QueryClient` in two ways: `defaultOptions` can be overridden by each mutation, while these
 * callbacks are always called, and `onMutate` here does not allow returning a result.
 *
 * If a callback returns a promise, it will be awaited before the mutation continues.
 */
interface MutationCacheConfig {
  /** Called when any mutation in the cache encounters an error. */
  onError?: (error: DefaultError, variables: unknown, onMutateResult: unknown, mutation: Mutation<unknown, unknown, unknown>, context: MutationFunctionContext) => Promise<unknown> | unknown;
  /** Called when any mutation in the cache is successful. */
  onSuccess?: (data: unknown, variables: unknown, onMutateResult: unknown, mutation: Mutation<unknown, unknown, unknown>, context: MutationFunctionContext) => Promise<unknown> | unknown;
  /** Called before any mutation in the cache executes. */
  onMutate?: (variables: unknown, mutation: Mutation<unknown, unknown, unknown>, context: MutationFunctionContext) => Promise<unknown> | unknown;
  /** Called when any mutation in the cache is settled, either successfully or with an error. */
  onSettled?: (data: unknown | undefined, error: DefaultError | null, variables: unknown, onMutateResult: unknown, mutation: Mutation<unknown, unknown, unknown>, context: MutationFunctionContext) => Promise<unknown> | unknown;
}
interface NotifyEventMutationAdded extends NotifyEvent {
  type: 'added';
  mutation: Mutation<any, any, any, any>;
}
interface NotifyEventMutationRemoved extends NotifyEvent {
  type: 'removed';
  mutation: Mutation<any, any, any, any>;
}
interface NotifyEventMutationObserverAdded extends NotifyEvent {
  type: 'observerAdded';
  mutation: Mutation<any, any, any, any>;
  observer: MutationObserver<any, any, any>;
}
interface NotifyEventMutationObserverRemoved extends NotifyEvent {
  type: 'observerRemoved';
  mutation: Mutation<any, any, any, any>;
  observer: MutationObserver<any, any, any>;
}
interface NotifyEventMutationObserverOptionsUpdated extends NotifyEvent {
  type: 'observerOptionsUpdated';
  mutation?: Mutation<any, any, any, any>;
  observer: MutationObserver<any, any, any, any>;
}
interface NotifyEventMutationUpdated extends NotifyEvent {
  type: 'updated';
  mutation: Mutation<any, any, any, any>;
  action: Action<any, any, any, any>;
}
/**
 * The event passed to a `MutationCache` subscriber. Fired whenever a mutation is added or removed
 * from the cache, its state is updated, or one of its observers is added, removed, or has its
 * options updated.
 */
type MutationCacheNotifyEvent = NotifyEventMutationAdded | NotifyEventMutationRemoved | NotifyEventMutationObserverAdded | NotifyEventMutationObserverRemoved | NotifyEventMutationObserverOptionsUpdated | NotifyEventMutationUpdated;
type MutationCacheListener = (event: MutationCacheNotifyEvent) => void;
/**
 * The `MutationCache` is the storage for mutations.
 *
 * Normally, you will not interact with the `MutationCache` directly and instead use a
 * `QueryClient`. You can subscribe to it (inherited from `Subscribable`) to be informed of
 * safe/known updates to the cache, such as mutations being added, removed, or updated.
 * @example
 * ```ts
 * const unsubscribe = mutationCache.subscribe((event) => {
 *   console.log(event.type, event.mutation)
 * })
 * ```
 */
declare class MutationCache extends Subscribable<MutationCacheListener> {
  #private;
  config: MutationCacheConfig;
  constructor(config?: MutationCacheConfig);
  /**
   * Creates a mutation and adds it to the cache.
   * @internal
   * @param client - The client the mutation belongs to, used to default its options.
   * @param options - The mutation options. They are defaulted with {@link
   * QueryClient#defaultMutationOptions}.
   * @param state - The initial state of the mutation, e.g. when restoring a dehydrated mutation.
   * @returns The new mutation, already added to the cache.
   */
  build<TData, TError, TVariables, TOnMutateResult>(client: QueryClient, options: MutationOptions<TData, TError, TVariables, TOnMutateResult>, state?: MutationState<TData, TError, TVariables, TOnMutateResult>): Mutation<TData, TError, TVariables, TOnMutateResult>;
  /**
   * Adds a mutation to the cache.
   * @internal
   * @param mutation - The mutation to add. If it has a `scope`, it is queued in that scope.
   */
  add(mutation: Mutation<any, any, any, any>): void;
  /**
   * Removes a mutation from the cache.
   * @internal
   * @param mutation - The mutation to remove, also from its scope's queue.
   */
  remove(mutation: Mutation<any, any, any, any>): void;
  /**
   * Checks whether a mutation can run now, given the other mutations in its `scope`.
   * @internal
   * @param mutation - The mutation to check.
   * @returns `true` if the mutation has no `scope`, or no other mutation in its scope is pending
   * ahead of it.
   */
  canRun(mutation: Mutation<any, any, any, any>): boolean;
  /**
   * Continues the next paused mutation in the same `scope` after a mutation finishes.
   * @internal
   * @param mutation - The mutation that finished.
   * @returns A promise that resolves once the next paused mutation in the same scope has continued,
   * or immediately if there is none.
   */
  runNext(mutation: Mutation<any, any, any, any>): Promise<unknown>;
  /**
   * Removes all mutations from the cache.
   * @example
   * ```ts
   * const mutationCache = queryClient.getMutationCache()
   *
   * mutationCache.clear()
   * ```
   */
  clear(): void;
  /**
   * Returns all mutations within the cache.
   *
   * This is not typically needed for most applications, but can come in handy when needing more
   * information about a mutation in rare scenarios.
   * @returns Every mutation in the cache.
   * @example
   * ```ts
   * const mutationCache = queryClient.getMutationCache()
   *
   * const mutations = mutationCache.getAll()
   * ```
   */
  getAll(): Array<Mutation>;
  /**
   * A slightly more advanced method that can be used to get an existing mutation instance from
   * the cache. If the mutation does not exist, `undefined` is returned.
   *
   * This is not typically needed for most applications, but can come in handy when needing more
   * information about a mutation in rare scenarios.
   * @param filters - The filters to match. `exact` defaults to `true`.
   * @returns The first matching mutation, or `undefined`.
   * @see {@link MutationCache#findAll}
   * @example
   * ```ts
   * const mutationCache = queryClient.getMutationCache()
   *
   * const mutation = mutationCache.find({ mutationKey: ['addPost'] })
   * ```
   */
  find<TData = unknown, TError = DefaultError, TVariables = any, TOnMutateResult = unknown>(filters: MutationFilters): Mutation<TData, TError, TVariables, TOnMutateResult> | undefined;
  /**
   * An even more advanced method that can be used to get existing mutation instances from the
   * cache that match the given filters. If no mutations match, an empty array is returned.
   *
   * This is not typically needed for most applications, but can come in handy when needing more
   * information about mutations in rare scenarios.
   * @param filters - The filters to match. Without filters, every mutation is returned.
   * @returns The matching mutations.
   * @see {@link MutationCache#find}
   * @example
   * ```ts
   * const mutationCache = queryClient.getMutationCache()
   *
   * const mutations = mutationCache.findAll({ mutationKey: ['addPost'] })
   * ```
   */
  findAll(filters?: MutationFilters): Array<Mutation>;
  /**
   * Notifies every cache listener of an event, in one batch.
   * @internal
   * @param event - The event passed to every listener.
   */
  notify(event: MutationCacheNotifyEvent): void;
  /**
   * Continues every paused mutation, e.g. when the app comes back online.
   * @internal
   * @returns A promise that resolves once every paused mutation has continued and settled.
   */
  resumePausedMutations(): Promise<unknown>;
}
//#endregion
//#region src/mutation.d.ts
interface MutationConfig<TData, TError, TVariables, TOnMutateResult> {
  client: QueryClient;
  mutationId: number;
  mutationCache: MutationCache;
  options: MutationOptions<TData, TError, TVariables, TOnMutateResult>;
  state?: MutationState<TData, TError, TVariables, TOnMutateResult>;
}
/**
 * The raw state stored on a `Mutation` instance. This is the underlying state
 * that observer results (e.g. `MutationObserverResult`) are derived from.
 */
interface MutationState<TData = unknown, TError = DefaultError, TVariables = unknown, TOnMutateResult = unknown> {
  /**
   * The value returned by `onMutate`, if defined. Passed to `onSuccess`,
   * `onError` and `onSettled` as the mutation's context.
   */
  context: TOnMutateResult | undefined;
  /**
   * The last successfully resolved data for the mutation.
   */
  data: TData | undefined;
  /**
   * The error object for the mutation, if the last attempt resulted in an error.
   * - Defaults to `null`.
   */
  error: TError | null;
  /**
   * The number of times the mutation function has failed for the current attempt.
   */
  failureCount: number;
  /**
   * The reason the current attempt failed, as reported by the retryer.
   */
  failureReason: TError | null;
  /**
   * Whether the mutation is currently paused (see network mode), or is
   * waiting for another mutation with the same `scope` to finish.
   */
  isPaused: boolean;
  /**
   * The status of the mutation.
   */
  status: MutationStatus;
  /**
   * The variables the mutation was last called with.
   */
  variables: TVariables | undefined;
  /**
   * The timestamp for when the mutation was submitted.
   */
  submittedAt: number;
}
interface FailedAction<TError> {
  type: 'failed';
  failureCount: number;
  error: TError | null;
}
interface PendingAction<TVariables, TOnMutateResult> {
  type: 'pending';
  isPaused: boolean;
  variables?: TVariables;
  context?: TOnMutateResult;
}
interface SuccessAction<TData> {
  type: 'success';
  data: TData;
}
interface ErrorAction<TError> {
  type: 'error';
  error: TError;
}
interface PauseAction {
  type: 'pause';
}
interface ContinueAction {
  type: 'continue';
}
/**
 * The actions a mutation dispatches to update its state, e.g. when it starts, fails, pauses, or
 * succeeds.
 */
type Action<TData, TError, TVariables, TOnMutateResult> = ContinueAction | ErrorAction<TError> | FailedAction<TError> | PendingAction<TVariables, TOnMutateResult> | PauseAction | SuccessAction<TData>;
/**
 * Represents a single mutation attempt. A `Mutation` holds the mutation's
 * options, state (data/error/status), and the `MutationObserver`s currently
 * subscribed to it.
 *
 * Instances are created and managed internally by `MutationCache`; application
 * code typically interacts with mutations indirectly through `QueryClient` or
 * a framework hook like `useMutation`. Direct access to a `Mutation` instance
 * is possible via `mutationCache.find()`/`getAll()` for inspecting cache state.
 * @example
 * ```ts
 * const mutationCache = queryClient.getMutationCache()
 *
 * const mutation = mutationCache.find({ mutationKey: ['addPost'] })
 * ```
 */
declare class Mutation<TData = unknown, TError = DefaultError, TVariables = unknown, TOnMutateResult = unknown> extends Removable {
  #private;
  state: MutationState<TData, TError, TVariables, TOnMutateResult>;
  options: MutationOptions<TData, TError, TVariables, TOnMutateResult>;
  readonly mutationId: number;
  constructor(config: MutationConfig<TData, TError, TVariables, TOnMutateResult>);
  /**
   * Replaces the mutation's options and applies their `gcTime`.
   * @internal
   * @param options - The new mutation options.
   */
  setOptions(options: MutationOptions<TData, TError, TVariables, TOnMutateResult>): void;
  /**
   * The `meta` object passed in the mutation's options, if any.
   * @returns The mutation's `meta`, or `undefined` if none was set.
   */
  get meta(): MutationMeta | undefined;
  /**
   * Subscribes an observer to the mutation and stops its garbage collection.
   * @internal
   * @param observer - The observer to add. Adding an observer that is already subscribed does
   * nothing.
   */
  addObserver(observer: MutationObserver<any, any, any, any>): void;
  /**
   * Unsubscribes an observer from the mutation.
   * @internal
   * @param observer - The observer to remove. Garbage collection is scheduled afterwards.
   */
  removeObserver(observer: MutationObserver<any, any, any, any>): void;
  protected optionalRemove(): void;
  /**
   * Resumes a mutation that is currently paused or was restored from a
   * dehydrated, still-`pending` state.
   *
   * - If this mutation has an active retryer (it paused mid-attempt, e.g. due
   *   to the network mode or scope-based queuing), its retryer is resumed.
   * - Otherwise, if the mutation's status is still `pending` (e.g. it was
   *   dehydrated while an attempt was in flight and never got a retryer in
   *   this instance), `execute` is called again with the last known variables.
   * - Otherwise the mutation has already settled and this resolves immediately
   *   without running anything again.
   * @returns A promise that settles with the resumed mutation: it rejects if the mutation fails.
   * It resolves immediately if the mutation has already settled.
   * @see {@link Mutation#execute}
   * @example
   * ```ts
   * // typically driven by reconnect handling, e.g. queryClient.resumePausedMutations()
   * const mutation = mutationCache.find({ mutationKey: ['addPost'] })
   * await mutation?.continue()
   * ```
   */
  continue(): Promise<unknown>;
  /**
   * Runs the mutation function for the given variables through a retryer, and
   * drives the mutation's state and lifecycle callbacks through to settlement.
   *
   * If this mutation's state is already `pending` when `execute` is called
   * (i.e. it was restored, still in-flight, from a dehydrated state), the
   * `onMutate` step is skipped and a `continue` action is dispatched to
   * unpause it; otherwise a `pending` action is dispatched first, then the
   * mutation cache's `onMutate` and the mutation's own `onMutate` option are
   * awaited in that order, and the resulting context is stored.
   *
   * The mutation function is then run (subject to `retry`/`retryDelay`/
   * `networkMode`, and to the mutation cache's scope-based serialization).
   * On success, the cache's `onSuccess`/`onSettled` callbacks run before the
   * mutation's own `onSuccess`/`onSettled` options, a `success` action is
   * dispatched, and the resolved data is returned. On failure, the same
   * cache-then-option ordering is used for `onError`/`onSettled`, but each of
   * those four callbacks is individually caught so that a throwing callback
   * cannot mask the original error; an `error` action is then dispatched and
   * the original error is re-thrown.
   * @param variables - The variables passed to the `mutationFn`.
   * @returns A promise that resolves with the mutation's data, or rejects with its error.
   * @see {@link Mutation#continue}
   * @example
   * ```ts
   * // Called internally by `MutationObserver.mutate` and `Mutation.continue` —
   * // applications normally trigger mutations through those, not this method.
   * const data = await mutation.execute(variables)
   * ```
   */
  execute(variables: TVariables): Promise<TData>;
}
/**
 * Returns the initial state of a mutation: `'idle'`, with no data, error, or variables.
 * @returns The initial mutation state.
 */
declare function getDefaultState<TData, TError, TVariables, TOnMutateResult>(): MutationState<TData, TError, TVariables, TOnMutateResult>;
//#endregion
//#region src/utils.d.ts
type DropLast<T extends ReadonlyArray<unknown>> = T extends readonly [...infer R, unknown] ? readonly [...R] : never;
type TuplePrefixes<T extends ReadonlyArray<unknown>> = T extends readonly [] ? readonly [] : TuplePrefixes<DropLast<T>> | T;
/**
 * Filters used to select queries, for example in `queryClient.getQueriesData` or `queryClient.invalidateQueries`.
 * All provided filters must match; filters that are left unspecified are ignored.
 */
interface QueryFilters<TQueryKey extends QueryKey = QueryKey> {
  /**
   * Filter to active queries, inactive queries or all queries
   * @defaultValue 'all'
   */
  type?: QueryTypeFilter;
  /**
   * Match query key exactly
   */
  exact?: boolean;
  /**
   * Include queries matching this predicate function
   */
  predicate?: (query: Query) => boolean;
  /**
   * Include queries matching this query key
   */
  queryKey?: TQueryKey | TuplePrefixes<TQueryKey>;
  /**
   * Include or exclude stale queries
   */
  stale?: boolean;
  /**
   * Include queries matching their fetchStatus
   */
  fetchStatus?: FetchStatus;
}
/**
 * Filters used to select mutations, for example in `mutationCache.findAll` or `queryClient.isMutating`.
 * All provided filters must match; filters that are left unspecified are ignored.
 */
interface MutationFilters<TData = unknown, TError = DefaultError, TVariables = unknown, TOnMutateResult = unknown> {
  /**
   * Match mutation key exactly
   */
  exact?: boolean;
  /**
   * Include mutations matching this predicate function
   */
  predicate?: (mutation: Mutation<TData, TError, TVariables, TOnMutateResult>) => boolean;
  /**
   * Include mutations matching this mutation key
   */
  mutationKey?: TuplePrefixes<MutationKey>;
  /**
   * Filter by mutation status
   */
  status?: MutationStatus;
}
/**
 * Either a plain value of type `TOutput`, or a function that receives `TInput` and returns `TOutput`.
 * Used for example by `setQueryData`-style updaters, which accept either the new data directly or a
 * function that computes it from the previous data. See {@link functionalUpdate}.
 * @example
 * ```ts
 * queryClient.setQueryData(['posts'], newPosts)
 *
 * // Or, using an updater function that receives the current data:
 * queryClient.setQueryData(['posts'], (oldPosts) =>
 *   oldPosts ? [...oldPosts, newPost] : oldPosts,
 * )
 * ```
 */
type Updater<TInput, TOutput> = TOutput | ((input: TInput) => TOutput);
/**
 * Which queries a filter matches: all of them, only active ones (with enabled observers), or only
 * inactive ones.
 */
type QueryTypeFilter = 'all' | 'active' | 'inactive';
/**
 * @deprecated use `environmentManager.isServer()` instead.
 */
declare const isServer: boolean;
/**
 * A function that does nothing.
 */
declare function noop(): void;
declare function noop(): undefined;
/**
 * Resolves an {@link Updater}: calls it with `input` if it is a function, otherwise returns it as
 * is.
 * @param updater - The new value, or a function that receives `input` and returns the new value.
 * @param input - The current value, passed to `updater` if it is a function.
 * @returns The new value.
 */
declare function functionalUpdate<TInput, TOutput>(updater: Updater<TInput, TOutput>, input: TInput): TOutput;
/**
 * Checks whether a value can be used as a timeout: a non-negative, finite number.
 * @param value - The value to check.
 * @returns `true` if `value` is a number that is `>= 0` and not `Infinity`.
 */
declare function isValidTimeout(value: unknown): value is number;
/**
 * Calculates how long until data updated at `updatedAt` becomes stale.
 * @param updatedAt - The timestamp, in milliseconds, at which the data was last updated.
 * @param staleTime - The time, in milliseconds, after which data is considered stale. Defaults to
 * `0`.
 * @returns The remaining time in milliseconds, or `0` if the data is already stale.
 */
declare function timeUntilStale(updatedAt: number, staleTime?: number): number;
/**
 * Resolves an option that can be given either as a value or as a function of the query, such as
 * `staleTime`.
 * @param value - The option value, or a function that receives `query` and returns the value.
 * @param query - The query passed to `value` if it is a function.
 * @returns The resolved value, or `undefined` if `value` is `undefined`.
 */
declare function resolveQueryValue<TValue, TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(value: undefined | TValue | ((query: Query<TQueryFnData, TError, TData, TQueryKey>) => TValue), query: Query<TQueryFnData, TError, TData, TQueryKey>): TValue | undefined;
/**
 * Checks whether a query matches the given {@link QueryFilters}.
 * Every filter that is specified must match; filters that are left unspecified are ignored.
 * @param filters - The filters to check the query against.
 * @param query - The query to check.
 * @returns `true` if the query matches every specified filter.
 * @example
 * ```ts
 * const queryCache = queryClient.getQueryCache()
 *
 * const matchingQueries = queryCache
 *   .getAll()
 *   .filter((query) => matchQuery({ queryKey: ['posts'] }, query))
 * ```
 */
declare function matchQuery(filters: QueryFilters, query: Query<any, any, any, any>): boolean;
/**
 * Checks whether a mutation matches the given {@link MutationFilters}.
 * Every filter that is specified must match; filters that are left unspecified are ignored.
 * If a `mutationKey` filter is provided but the mutation has no `mutationKey` of its own, it does not match.
 * @param filters - The filters to check the mutation against.
 * @param mutation - The mutation to check.
 * @returns `true` if the mutation matches every specified filter.
 * @example
 * ```ts
 * const mutationCache = queryClient.getMutationCache()
 *
 * const matchingMutations = mutationCache
 *   .getAll()
 *   .filter((mutation) => matchMutation({ mutationKey: ['addPost'] }, mutation))
 * ```
 */
declare function matchMutation(filters: MutationFilters, mutation: Mutation<any, any>): boolean;
/**
 * Hashes a query key with the query's `queryKeyHashFn` option, falling back to {@link hashKey}.
 * @param queryKey - The query key to hash.
 * @param options - The query options that may provide a custom `queryKeyHashFn`.
 * @returns The query hash, a string that identifies the query in the cache.
 */
declare function hashQueryKeyByOptions<TQueryKey extends QueryKey = QueryKey>(queryKey: TQueryKey, options?: Pick<QueryOptions<any, any, any, any>, 'queryKeyHashFn'>): string;
/**
 * Default query & mutation keys hash function.
 * Hashes the value into a stable hash.
 * @param queryKey - The query or mutation key to hash.
 * @returns The stable hash of the key, as a JSON string.
 * @example
 * ```ts
 * // Object keys are sorted, so key order doesn't affect the hash:
 * hashKey(['todos', { page: 1, filter: 'done' }]) // === '["todos",{"filter":"done","page":1}]'
 * ```
 */
declare function hashKey(queryKey: QueryKey | MutationKey): string;
/**
 * Checks if key `b` partially matches with key `a`.
 * @param a - The key to check, e.g. a query's own key.
 * @param b - The (partial) key to match against `a`.
 * @returns `true` if every array element or object property in `b` matches the one at the same
 * position in `a`.
 */
declare function partialMatchKey(a: QueryKey, b: QueryKey): boolean;
/**
 * This function returns `a` if `b` is deeply equal.
 * If not, it will replace any deeply equal children of `b` with those of `a`.
 * This can be used for structural sharing between JSON values for example.
 * @param a - The previous value, whose deeply equal parts are reused.
 * @param b - The new value.
 * @param depth - The current recursion depth. Past a depth of `500`, `b` is returned as is.
 * @returns `a` if `b` is deeply equal to it, otherwise `b` with its deeply equal parts replaced by
 * those of `a`.
 */
declare function replaceEqualDeep<T>(a: unknown, b: T, depth?: number): T;
/**
 * Shallow compare objects.
 * @param a - The first object.
 * @param b - The second object, or `undefined`.
 * @returns `true` if both objects have the same keys, with strictly equal values for each key.
 */
declare function shallowEqualObjects<T extends Record<string, any>>(a: T, b: T | undefined): boolean;
/**
 * Checks whether a value is an array with no holes and no extra properties.
 * @param value - The value to check.
 * @returns `true` if `value` is an array whose number of own keys equals its `length`.
 */
declare function isPlainArray(value: unknown): value is Array<unknown>;
/**
 * Checks whether a value is a plain object, e.g. created with an object literal or
 * `Object.create(null)`.
 * @param o - The value to check.
 * @returns `true` if `o` is a plain object.
 */
declare function isPlainObject(o: any): o is Record<PropertyKey, unknown>;
/**
 * Waits for the given time, using the configured {@link timeoutManager}.
 * @param timeout - The time to wait, in milliseconds.
 * @returns A promise that resolves after `timeout` milliseconds.
 */
declare function sleep(timeout: number): Promise<void>;
/**
 * Applies a query's `structuralSharing` option when writing new data.
 * @param prevData - The previously cached data.
 * @param data - The new data.
 * @param options - The query options, whose `structuralSharing` decides how the data is merged.
 * @returns The result of a custom `structuralSharing` function, `data` with its unchanged parts
 * replaced by those of `prevData` by default, or `data` as is if `structuralSharing` is `false`.
 * @throws {Error} The error from the default structural sharing, e.g. when the data is not JSON serializable.
 * Outside production, it is also logged to the console.
 */
declare function replaceData<TData, TOptions extends QueryOptions<any, any, any, any>>(prevData: TData | undefined, data: TData, options: TOptions): TData;
/**
 * Intended to be passed as a query's `placeholderData` option, for example
 * `placeholderData: keepPreviousData`. Instead of resetting the query's data to `undefined` while a new
 * query key is fetching, it keeps displaying the previously fetched data until the new data arrives.
 * @param previousData - The data of the previous query key, passed by the observer.
 * @returns The previous data, unchanged.
 * @example
 * ```ts
 * new QueryObserver(queryClient, {
 *   queryKey: ['posts', page],
 *   queryFn: () => fetchPosts(page),
 *   placeholderData: keepPreviousData,
 * })
 * ```
 */
declare function keepPreviousData<T>(previousData: T | undefined): T | undefined;
/**
 * Returns a new array with `item` added at the end. If that makes the array longer than `max`,
 * the first item is dropped. Only one item is dropped, so the result can still exceed `max` if
 * `items` already did.
 * @param items - The current items.
 * @param item - The value to append.
 * @param max - The length above which an item is dropped. `0` (the default) means no limit.
 * @returns A new array with `item` added.
 */
declare function addToEnd<T>(items: Array<T>, item: T, max?: number): Array<T>;
/**
 * Returns a new array with `item` added at the start. If that makes the array longer than `max`,
 * the last item is dropped. Only one item is dropped, so the result can still exceed `max` if
 * `items` already did.
 * @param items - The current items.
 * @param item - The value to prepend.
 * @param max - The length above which an item is dropped. `0` (the default) means no limit.
 * @returns A new array with `item` added.
 */
declare function addToStart<T>(items: Array<T>, item: T, max?: number): Array<T>;
/**
 * Sentinel value that can be passed as a query's `queryFn` to conditionally disable the query (equivalent
 * to `enabled: false`) while preserving full type inference for the query's data. Unlike `enabled: false`,
 * a query disabled via `skipToken` cannot be triggered with `refetch`.
 * @example
 * ```ts
 * new QueryObserver(queryClient, {
 *   queryKey: ['post', postId],
 *   queryFn: postId != null ? () => fetchPost(postId) : skipToken,
 * })
 * ```
 */
declare const skipToken: unique symbol;
/**
 * The type of the {@link skipToken} sentinel value.
 */
type SkipToken = typeof skipToken;
/**
 * Returns the function to call for a fetch. If there is no `queryFn` but the fetch was started from
 * an `initialPromise`, that promise is returned instead. If there is no usable `queryFn` (missing or
 * {@link skipToken}), the returned function rejects with a `Missing queryFn` error.
 * @param options - The query options with the `queryFn`, and the `queryHash` used in error messages.
 * @param fetchOptions - The fetch options, which may carry an `initialPromise`.
 * @returns The function to call for the fetch.
 */
declare function ensureQueryFn<TQueryFnData = unknown, TQueryKey extends QueryKey = QueryKey>(options: {
  queryFn?: QueryFunction<TQueryFnData, TQueryKey> | SkipToken;
  queryHash?: string;
}, fetchOptions?: FetchOptions<TQueryFnData>): QueryFunction<TQueryFnData, TQueryKey>;
/**
 * Resolves a `throwOnError` option to a boolean.
 * If `throwOnError` is a function, it is called with `params` (e.g. the error and, depending on the caller,
 * additional context such as the query or mutation) and its result is returned, allowing the throwing
 * behavior to be decided per error. Otherwise, `throwOnError` itself is coerced to a boolean (`undefined`
 * resolves to `false`).
 * @param throwOnError - The `throwOnError` option: a boolean, a function that decides per error, or
 * `undefined`.
 * @param params - The arguments passed to `throwOnError` if it is a function.
 * @returns Whether the error should be thrown.
 * @example
 * ```ts
 * const throwOnError =
 *   query.state.error && typeof options.throwOnError === 'function'
 *     ? shouldThrowError(options.throwOnError, [query.state.error, query])
 *     : options.throwOnError
 * ```
 */
declare function shouldThrowError<T extends (...args: Array<any>) => boolean>(throwOnError: boolean | T | undefined, params: Parameters<T>): boolean;
/**
 * Adds a lazy `signal` getter to an object, such as a query function context. The first time
 * `signal` is read, `onCancelled` is registered for the signal's `abort` event (or called right
 * away if it is already aborted), so cancellation is only tracked when the signal is actually used.
 * @param object - The object to add the `signal` property to.
 * @param getSignal - Returns the `AbortSignal`. Called once, when `signal` is first read.
 * @param onCancelled - Called when the signal is aborted, if `signal` was read.
 * @returns The same object, with the `signal` property added.
 */
declare function addConsumeAwareSignal<T>(object: T, getSignal: () => AbortSignal, onCancelled: VoidFunction): T & {
  signal: AbortSignal;
};
//#endregion
//#region src/queryCache.d.ts
/**
 * Global callbacks that fire for every query handled by a `QueryCache`, regardless of which
 * component or observer triggered it. Unlike `QueryClient`'s `defaultOptions`, which a query can
 * override, these callbacks are always called. Unlike `MutationCacheConfig`'s callbacks, these
 * are fire-and-forget: their return value is not awaited before the query settles.
 */
interface QueryCacheConfig {
  /** Called when any query in the cache encounters an error. */
  onError?: (error: DefaultError, query: Query<unknown, unknown, unknown>) => void;
  /** Called when any query in the cache is successful. */
  onSuccess?: (data: unknown, query: Query<unknown, unknown, unknown>) => void;
  /** Called when any query in the cache is settled, either successfully or with an error. */
  onSettled?: (data: unknown | undefined, error: DefaultError | null, query: Query<unknown, unknown, unknown>) => void;
}
interface NotifyEventQueryAdded extends NotifyEvent {
  type: 'added';
  query: Query<any, any, any, any>;
}
interface NotifyEventQueryRemoved extends NotifyEvent {
  type: 'removed';
  query: Query<any, any, any, any>;
}
interface NotifyEventQueryUpdated extends NotifyEvent {
  type: 'updated';
  query: Query<any, any, any, any>;
  action: Action$1<any, any>;
}
interface NotifyEventQueryObserverAdded extends NotifyEvent {
  type: 'observerAdded';
  query: Query<any, any, any, any>;
  observer: QueryObserver<any, any, any, any, any>;
}
interface NotifyEventQueryObserverRemoved extends NotifyEvent {
  type: 'observerRemoved';
  query: Query<any, any, any, any>;
  observer: QueryObserver<any, any, any, any, any>;
}
interface NotifyEventQueryObserverResultsUpdated extends NotifyEvent {
  type: 'observerResultsUpdated';
  query: Query<any, any, any, any>;
}
interface NotifyEventQueryObserverOptionsUpdated extends NotifyEvent {
  type: 'observerOptionsUpdated';
  query: Query<any, any, any, any>;
  observer: QueryObserver<any, any, any, any, any>;
}
/**
 * The event passed to a `QueryCache` subscriber. Fired whenever a query is added or removed from
 * the cache, its state is updated (e.g. via `query.setState` or `queryClient.removeQueries`), or
 * one of its observers is added, removed, or has its results or options updated.
 */
type QueryCacheNotifyEvent = NotifyEventQueryAdded | NotifyEventQueryRemoved | NotifyEventQueryUpdated | NotifyEventQueryObserverAdded | NotifyEventQueryObserverRemoved | NotifyEventQueryObserverResultsUpdated | NotifyEventQueryObserverOptionsUpdated;
type QueryCacheListener = (event: QueryCacheNotifyEvent) => void;
/**
 * The store a `QueryCache` keeps its queries in, keyed by query hash.
 */
interface QueryStore {
  /**
   * Returns whether a query with the given hash is stored.
   */
  has: (queryHash: string) => boolean;
  /**
   * Stores a query under its hash.
   */
  set: (queryHash: string, query: Query) => void;
  /**
   * Returns the query with the given hash, if any.
   */
  get: (queryHash: string) => Query | undefined;
  /**
   * Removes the query with the given hash.
   */
  delete: (queryHash: string) => void;
  /**
   * Returns an iterator over all stored queries.
   */
  values: () => IterableIterator<Query>;
}
/**
 * The `QueryCache` is the storage mechanism for TanStack Query. It stores all the data, meta
 * information, and state of the queries it contains.
 *
 * Normally, you will not interact with the `QueryCache` directly and instead use a `QueryClient`
 * for a specific cache. You can subscribe to it (inherited from `Subscribable`) to be informed of
 * safe/known updates to the cache, such as queries being added, removed, or updated — updates made
 * outside of the cache's own tracked mechanisms (e.g. mutating a query's state object directly) do
 * not notify subscribers.
 * @example
 * ```ts
 * const unsubscribe = queryCache.subscribe((event) => {
 *   console.log(event.type, event.query)
 * })
 * ```
 */
declare class QueryCache extends Subscribable<QueryCacheListener> {
  #private;
  config: QueryCacheConfig;
  constructor(config?: QueryCacheConfig);
  /**
   * Returns the existing `Query` instance for the given options' `queryKey`/`queryHash`, or
   * builds and adds a new one to the cache if none exists yet. Used by framework adapters and
   * plugins (e.g. broadcast/persistence) that need to get-or-create a `Query` directly, bypassing
   * the reactive `QueryObserver` machinery.
   * @param client - The client the query belongs to, used to default its options.
   * @param options - The query options, including the `queryKey`. A new query is created with the
   * options defaulted by {@link QueryClient#defaultQueryOptions}.
   * @param state - The initial state of a newly created query, e.g. when hydrating. Ignored if the
   * query already exists.
   * @returns The existing or newly created query.
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   *
   * const query = queryCache.build(queryClient, {
   *   queryKey: ['posts'],
   *   queryFn: fetchPosts,
   * })
   * ```
   */
  build<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(client: QueryClient, options: WithRequired<QueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'queryKey'>, state?: QueryState<TData, TError>): Query<TQueryFnData, TError, TData, TQueryKey>;
  /**
   * Adds a query to the cache.
   * @internal
   * @param query - The query to add. If a query with the same hash is already cached, nothing
   * happens.
   */
  add(query: Query<any, any, any, any>): void;
  /**
   * Destroys the given `Query` and removes it from the cache, notifying subscribers with a
   * `'removed'` event. A no-op if the query is no longer the one currently stored under its hash
   * (e.g. it was already replaced). Used by plugins (e.g. the broadcast client) that mirror
   * removals across `QueryCache` instances.
   * @param query - The query to remove.
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   * const query = queryCache.find({ queryKey: ['posts'] })
   *
   * if (query) {
   *   queryCache.remove(query)
   * }
   * ```
   */
  remove(query: Query<any, any, any, any>): void;
  /**
   * Removes all queries from the cache.
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   *
   * queryCache.clear()
   * ```
   */
  clear(): void;
  /**
   * Returns the `Query` instance stored under the given `queryHash`, or `undefined` if none
   * exists. Unlike {@link QueryCache#find}, this looks up by the already-computed hash rather
   * than by `QueryFilters`. Used by plugins (e.g. broadcast/hydration) that already have a hash
   * to look up directly.
   * @param queryHash - The hash of the query to look up.
   * @returns The query stored under the hash, or `undefined`.
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   * const queryHash = hashKey(['posts'])
   *
   * const query = queryCache.get(queryHash)
   * ```
   */
  get<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(queryHash: string): Query<TQueryFnData, TError, TData, TQueryKey> | undefined;
  /**
   * Returns all queries within the cache.
   * @returns Every query in the cache.
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   *
   * const queries = queryCache.getAll()
   * ```
   */
  getAll(): Array<Query>;
  /**
   * A slightly more advanced method that can be used to get an existing query instance from the
   * cache. This instance not only contains all the state for the query, but all of the instances,
   * and underlying guts of the query as well. If the query does not exist, `undefined` is
   * returned.
   *
   * This is not typically needed for most applications, but can come in handy when needing more
   * information about a query in rare scenarios (e.g. looking at `query.state.dataUpdatedAt` to
   * decide whether a query is fresh enough to be used as an initial value).
   * @param filters - The filters to match, including the required `queryKey`. `exact` defaults to
   * `true`.
   * @returns The first matching query, or `undefined`.
   * @see {@link QueryCache#findAll}
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   *
   * const query = queryCache.find({ queryKey: ['posts'] })
   * ```
   */
  find<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData>(filters: WithRequired<QueryFilters, 'queryKey'>): Query<TQueryFnData, TError, TData> | undefined;
  /**
   * An even more advanced method that can be used to get existing query instances from the cache
   * that partially match a query key. If no queries match, an empty array is returned.
   *
   * This is not typically needed for most applications, but can come in handy when needing more
   * information about queries in rare scenarios.
   * @param filters - The filters to match. Without filters, every query is returned.
   * @returns The matching queries.
   * @see {@link QueryCache#find}
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   *
   * const queries = queryCache.findAll({ queryKey: ['posts'] })
   * ```
   */
  findAll(filters?: QueryFilters<any>): Array<Query>;
  /**
   * Notifies every cache listener of an event, in one batch.
   * @internal
   * @param event - The event passed to every listener.
   */
  notify(event: QueryCacheNotifyEvent): void;
  /**
   * Calls {@link Query#onFocus} on every cached query, in one batch.
   * @internal
   */
  onFocus(): void;
  /**
   * Calls {@link Query#onOnline} on every cached query, in one batch.
   * @internal
   */
  onOnline(): void;
}
//#endregion
//#region src/queryClient.d.ts
/**
 * `QueryClient` is used to interact with a cache of queries and mutations. It owns a
 * `QueryCache` and a `MutationCache` (creating default ones if none are passed in) and holds
 * the default options that are applied to queries and mutations created through it.
 * @example
 * ```ts
 * const queryClient = new QueryClient({
 *   defaultOptions: {
 *     queries: {
 *       staleTime: Infinity,
 *     },
 *   },
 * })
 *
 * await queryClient.query({ queryKey: ['posts'], queryFn: fetchPosts })
 * ```
 */
declare class QueryClient {
  #private;
  constructor(config?: QueryClientConfig);
  /**
   * Called by a framework adapter's `QueryClientProvider`-equivalent when it mounts, to start
   * listening for focus/online events and resume paused mutations. Ref-counted via an internal
   * mount count, so nested or multiple providers sharing the same `QueryClient` don't tear down
   * the shared listeners until the last one unmounts.
   */
  mount(): void;
  /**
   * The inverse of {@link QueryClient#mount} — called by a framework adapter's
   * `QueryClientProvider`-equivalent when it unmounts. Only tears down the focus/online
   * listeners once the mount count returns to `0`.
   */
  unmount(): void;
  /**
   * Returns the number of queries in the cache that are currently fetching, optionally
   * matching a set of filters. This includes background-fetching, loading new pages, and
   * loading more infinite query results.
   * @param filters - Narrows down which fetching queries are counted. Without filters, every
   * fetching query is counted.
   * @returns The number of matching queries whose `fetchStatus` is `'fetching'`.
   * @example
   * ```ts
   * if (queryClient.isFetching()) {
   *   console.log('At least one query is fetching!')
   * }
   * ```
   */
  isFetching<TQueryFilters extends QueryFilters<any> = QueryFilters>(filters?: TQueryFilters): number;
  /**
   * Returns the number of mutations in the cache that are currently pending, optionally
   * matching a set of filters.
   * @param filters - Narrows down which pending mutations are counted. Without filters, every
   * pending mutation is counted.
   * @returns The number of matching mutations whose `status` is `'pending'`.
   * @example
   * ```ts
   * if (queryClient.isMutating()) {
   *   console.log('At least one mutation is pending!')
   * }
   * ```
   */
  isMutating<TMutationFilters extends MutationFilters<any, any> = MutationFilters>(filters?: TMutationFilters): number;
  /**
   * Imperative (non-reactive) way to retrieve data for a QueryKey.
   * Should only be used in callbacks or functions where reading the latest data is necessary, e.g. for optimistic updates.
   *
   * Hint: Do not use this function inside a component, because it won't receive updates.
   * Use `useQuery` to create a `QueryObserver` that subscribes to changes.
   * @param queryKey - The query key of the query to read.
   * @returns The cached data for the query, or `undefined` if no query with this key has been observed yet.
   * @see {@link QueryClient#getQueriesData}
   */
  getQueryData<TQueryFnData = unknown, TTaggedQueryKey extends QueryKey = QueryKey, TInferredQueryFnData = InferDataFromTag<TQueryFnData, TTaggedQueryKey>>(queryKey: TTaggedQueryKey): TInferredQueryFnData | undefined;
  /**
   * Returns the cached data of a query, or fetches it if there is none. With `revalidateIfStale`,
   * stale cached data is also refetched in the background.
   * @param options - The query options. If the query has no cached data yet, it is fetched with
   * these options.
   * @returns A promise that resolves to the cached data, or to the fetched data if nothing was
   * cached yet.
   * @deprecated Use queryClient.query({ ...options, staleTime: 'static' }) instead. This method will be removed in the next major version.
   */
  ensureQueryData<TQueryFnData, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(options: EnsureQueryDataOptions<TQueryFnData, TError, TData, TQueryKey>): Promise<TData>;
  /**
   * Imperative (non-reactive) way to retrieve the cached data of multiple queries at once.
   * Only queries matching the given filters are returned; if none match, an empty array is
   * returned.
   *
   * Because the matched queries can hold data of different shapes (e.g. a broad filter can match
   * queries with unrelated data types), the `TQueryFnData` generic defaults to `unknown` rather
   * than being inferred. Passing a more specific type is a convenience for call sites that know
   * every matched query holds the same shape — it is not checked against the actual cache
   * contents.
   * @param filters - The filters that select which queries to read.
   * @returns An array of query key and data pairs. The data is `undefined` for a query with no cached data.
   * @see {@link QueryClient#getQueryData}
   * @example
   * ```ts
   * const data = queryClient.getQueriesData({ queryKey: ['posts'] })
   * ```
   */
  getQueriesData<TQueryFnData = unknown, TQueryFilters extends QueryFilters<any> = QueryFilters>(filters: TQueryFilters): Array<[QueryKey, TQueryFnData | undefined]>;
  /**
   * Synchronous way to immediately update a query's cached data. If the updater (or the value
   * passed) resolves to `undefined`, the cache is left untouched and no query is created;
   * otherwise, if the query does not exist yet, it will be created. To update multiple queries
   * at once by partially matching query keys, use {@link QueryClient#setQueriesData} instead.
   *
   * Updates must be performed immutably: do not mutate `oldData`, or data previously retrieved
   * via {@link QueryClient#getQueryData}, in place.
   * @param queryKey - The query key to set data for.
   * @param updater - Either the new data, or a function that receives the current data (which
   * may be `undefined`) and returns the new data.
   * @param options - Set `updatedAt` to override the timestamp the written data is recorded with.
   * @returns The data that was written, or `undefined` if the updater returned `undefined` — in that case
   * the write is skipped and the cache is left unchanged.
   * @example
   * ```ts
   * queryClient.setQueryData(['posts'], newPosts)
   *
   * // Or, using an updater function that receives the current data:
   * queryClient.setQueryData(['posts'], (oldPosts) => [...oldPosts, newPost])
   * ```
   */
  setQueryData<TQueryFnData = unknown, TTaggedQueryKey extends QueryKey = QueryKey, TInferredQueryFnData = InferDataFromTag<TQueryFnData, TTaggedQueryKey>>(queryKey: TTaggedQueryKey, updater: Updater<InferDataFromTag<NoInfer<TQueryFnData>, TTaggedQueryKey> | undefined, NoInfer<TInferredQueryFnData> | undefined>, options?: SetDataOptions): NoInfer<TInferredQueryFnData> | undefined;
  /**
   * Synchronous way to immediately update the cached data of multiple queries at once, using
   * filters or partial query key matching. Only queries that already exist and match the given
   * filters are updated; no new cache entries are created. Internally this calls
   * {@link QueryClient#setQueryData} for each matching query.
   * @param filters - The filters that select which existing queries to update.
   * @param updater - Either the new data, or a function that receives each matched query's current
   * data (which may be `undefined`) and returns the new data.
   * @param options - Set `updatedAt` to override the timestamp the written data is recorded with.
   * @returns One `[queryKey, data]` tuple per matched query, in the same shape and with the same
   * `undefined` case as {@link QueryClient#setQueryData}.
   * @example
   * ```ts
   * queryClient.setQueriesData({ queryKey: ['posts'] }, (oldPosts) =>
   *   oldPosts ? oldPosts.filter((post) => post.id !== deletedId) : oldPosts,
   * )
   * ```
   */
  setQueriesData<TQueryFnData, TQueryFilters extends QueryFilters<any> = QueryFilters>(filters: TQueryFilters, updater: Updater<NoInfer<TQueryFnData> | undefined, NoInfer<TQueryFnData> | undefined>, options?: SetDataOptions): Array<[QueryKey, TQueryFnData | undefined]>;
  /**
   * Imperative (non-reactive) way to retrieve an existing query's state. If the query does not
   * exist, `undefined` is returned.
   * @param queryKey - The query key of the query to read.
   * @returns The query's state, or `undefined` if no query with this key exists.
   * @example
   * ```ts
   * const state = queryClient.getQueryState(['posts'])
   * console.log(state?.dataUpdatedAt)
   * ```
   */
  getQueryState<TQueryFnData = unknown, TError = DefaultError, TTaggedQueryKey extends QueryKey = QueryKey, TInferredQueryFnData = InferDataFromTag<TQueryFnData, TTaggedQueryKey>, TInferredError = InferErrorFromTag<TError, TTaggedQueryKey>>(queryKey: TTaggedQueryKey): QueryState<TInferredQueryFnData, TInferredError> | undefined;
  /**
   * Removes queries from the cache that match the given filters. Unlike
   * {@link QueryClient#invalidateQueries} or {@link QueryClient#refetchQueries}, this removes
   * matching queries from the cache instead of refetching them. Without filters, every query in
   * the cache is removed.
   * @param filters - The filters that select which queries to remove. Without filters, every query
   * is removed.
   * @example
   * ```ts
   * queryClient.removeQueries({ queryKey: ['posts'], exact: true })
   * ```
   */
  removeQueries<TTaggedQueryKey extends QueryKey = QueryKey>(filters?: QueryFilters<TTaggedQueryKey>): void;
  /**
   * Resets queries matching the given filters back to their initial state (e.g. any
   * `initialData`), notifying subscribers rather than removing them. Active queries among the
   * matched set are then refetched, and the returned promise resolves once that refetch settles.
   * @param filters - The filters that select which queries to reset. Without filters, every query
   * is reset.
   * @param options - Passed to the refetch of the active matched queries, e.g. `cancelRefetch` and
   * `throwOnError`.
   * @returns A promise that resolves once the refetch of the active matched queries settles.
   * @example
   * ```ts
   * await queryClient.resetQueries({ queryKey: ['posts'], exact: true })
   * ```
   */
  resetQueries<TTaggedQueryKey extends QueryKey = QueryKey>(filters?: QueryFilters<TTaggedQueryKey>, options?: ResetOptions): Promise<void>;
  /**
   * Cancels outgoing fetches for queries matching the given filters. Most useful when performing
   * optimistic updates, since any outgoing refetch that resolves afterwards would otherwise
   * overwrite the optimistic update. By default (`revert: true`), a cancelled query's data is
   * reverted to its state before the outgoing fetch started.
   *
   * The returned promise never rejects, even if individual cancellations fail.
   * @param filters - The filters that select which queries to cancel. Without filters, every query
   * is cancelled.
   * @param cancelOptions - Passed to each matched query's cancellation. `revert` defaults to
   * `true`.
   * @returns A promise that resolves once every cancellation has settled.
   * @example
   * ```ts
   * await queryClient.cancelQueries({ queryKey: ['posts'], exact: true })
   * ```
   */
  cancelQueries<TTaggedQueryKey extends QueryKey = QueryKey>(filters?: QueryFilters<TTaggedQueryKey>, cancelOptions?: CancelOptions): Promise<void>;
  /**
   * Marks queries matching the given filters as invalidated. Unlike
   * {@link QueryClient#removeQueries}, invalidated queries stay in the cache.
   *
   * Unless `filters.refetchType` is `'none'`, matching queries are then refetched via
   * {@link QueryClient#refetchQueries}, using `filters.refetchType` if set, otherwise
   * `filters.type`, otherwise `'active'`.
   * @param filters - The filters that select which queries to invalidate, plus `refetchType` to
   * control which of them to refetch afterwards. Without filters, every query is invalidated.
   * @param options - Passed to {@link QueryClient#refetchQueries}, e.g. `cancelRefetch` and
   * `throwOnError`.
   * @returns A promise that resolves once the refetch settles, or immediately if `refetchType` is
   * `'none'`.
   * @example
   * ```ts
   * await queryClient.invalidateQueries({ queryKey: ['posts'], refetchType: 'active' })
   * ```
   */
  invalidateQueries<TTaggedQueryKey extends QueryKey = QueryKey>(filters?: InvalidateQueryFilters<TTaggedQueryKey>, options?: InvalidateOptions): Promise<void>;
  /**
   * Refetches queries matching the given filters, regardless of whether they are stale. Without
   * filters, every query in the cache is refetched. Queries that are disabled, or static (only
   * have observers with a static `staleTime`), are never refetched.
   *
   * By default (`cancelRefetch: true`), a currently running fetch is cancelled before the new
   * one starts. The returned promise resolves once all matching queries have settled; it does
   * not reject on individual query failures unless `throwOnError` is set.
   * @param filters - The filters that select which queries to refetch. Without filters, every query
   * in the cache is included.
   * @param options - Set `cancelRefetch` to `false` to keep a running fetch instead of cancelling
   * it, and `throwOnError` to `true` to reject when a refetch fails.
   * @returns A promise that resolves once every matched query has settled.
   * @example
   * ```ts
   * // refetch all active queries partially matching a query key:
   * await queryClient.refetchQueries({ queryKey: ['posts'], type: 'active' })
   * ```
   */
  refetchQueries<TTaggedQueryKey extends QueryKey = QueryKey>(filters?: RefetchQueryFilters<TTaggedQueryKey>, options?: RefetchOptions): Promise<void>;
  /**
   * Asynchronous method to fetch and cache a query, resolving with the data or throwing with
   * the error.
   *
   * If the query already exists in the cache and its data is not stale (per the given
   * `staleTime`), the cached data is returned without fetching. Otherwise, the query is fetched
   * and the promise resolves once the fetch settles. If a `select` function is provided, it is
   * applied to the data in both cases (cached or freshly fetched) before it is returned.
   *
   * Unlike a reactive observer, retries are disabled by default here (`retry: false`) unless
   * explicitly configured, since there is no component to catch a thrown error and retry through
   * re-render.
   *
   * The accepted options are `QueryObserverOptions` minus the fields that only make sense for a
   * reactive observer — `enabled`, `refetchInterval`, `refetchIntervalInBackground`,
   * `refetchOnWindowFocus`, `refetchOnReconnect`, `refetchOnMount`, `retryOnMount`,
   * `notifyOnChangeProps`, `throwOnError`, `suspense`, and `placeholderData` are not part of this
   * method's options.
   *
   * This method replaces the deprecated `fetchQuery`, and — combined with
   * `{ staleTime: 'static' }` — the deprecated `ensureQueryData`.
   * @param options - The query options, including the `queryKey` and the `queryFn` used if the
   * query needs to fetch.
   * @returns A promise that resolves to the data, or to the result of `select` if provided. It
   * rejects with the error from the fetch or from `select`.
   * @example
   * ```ts
   * try {
   *   const data = await queryClient.query({ queryKey, queryFn, staleTime: 10000 })
   * } catch (error) {
   *   console.log(error)
   * }
   * ```
   */
  query<TQueryFnData, TError = DefaultError, TData = TQueryFnData, TQueryData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = never>(options: QueryExecuteOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey, TPageParam>): Promise<TData>;
  /**
   * Fetches and caches a query, or returns its cached data if it isn't stale. Unlike in observers,
   * the fetch isn't retried unless `retry` is set.
   * @param options - The query options, including the `queryKey` and the `queryFn` used if the
   * query needs to fetch.
   * @returns A promise that resolves to the cached or fetched data, or rejects with the fetch
   * error.
   * @deprecated Use queryClient.query(options) instead. This method will be removed in the next major version.
   */
  fetchQuery<TQueryFnData, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = never>(options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>): Promise<TData>;
  /**
   * Fetches and caches a query like {@link QueryClient#fetchQuery}, but ignores the result and any
   * error.
   * @param options - The query options, including the `queryKey` and the `queryFn` used if the
   * query needs to fetch.
   * @returns A promise that resolves once the fetch settles. It never rejects.
   * @deprecated Use queryClient.query(options) instead. You can swallow errors with `.catch(noop)`. This method will be removed in the next major version.
   */
  prefetchQuery<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>): Promise<void>;
  /**
   * Asynchronous method to fetch and cache an infinite query, resolving with an
   * {@link InfiniteData} object or throwing with the error.
   *
   * Behaves like {@link QueryClient#query}, accepting the same options (minus
   * `initialPageParam`), plus the required `initialPageParam`, and an optional `pages` /
   * `getNextPageParam` pair used to refetch a fixed number of pages from the start.
   *
   * This method replaces the deprecated `fetchInfiniteQuery`, and — combined with
   * `{ staleTime: 'static' }` — the deprecated `ensureInfiniteQueryData`.
   * @param options - The infinite query options, including the `queryKey`, the `queryFn`, and the
   * `initialPageParam`.
   * @returns A promise that resolves to the {@link InfiniteData}, or to the result of `select` if
   * provided. It rejects with the error from the fetch or from `select`.
   * @example
   * ```ts
   * try {
   *   const data = await queryClient.infiniteQuery({ queryKey, queryFn, initialPageParam: 0 })
   *   console.log(data.pages)
   * } catch (error) {
   *   console.log(error)
   * }
   * ```
   */
  infiniteQuery<TQueryFnData, TError = DefaultError, TData = InfiniteData<TQueryFnData>, TQueryKey extends QueryKey = QueryKey, TPageParam = unknown>(options: InfiniteQueryExecuteOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>): Promise<Array<TData> extends Array<InfiniteData<TQueryFnData>> ? InfiniteData<TQueryFnData, TPageParam> : TData>;
  /**
   * Fetches and caches an infinite query, or returns its cached data if it isn't stale.
   * @param options - The infinite query options, including the `queryKey`, the `queryFn`, and the
   * `initialPageParam`.
   * @returns A promise that resolves to the cached or fetched {@link InfiniteData}, or rejects with
   * the fetch error.
   * @deprecated Use queryClient.infiniteQuery(options) instead. This method will be removed in the next major version.
   */
  fetchInfiniteQuery<TQueryFnData, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = unknown>(options: FetchInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>): Promise<InfiniteData<TData, TPageParam>>;
  /**
   * Fetches and caches an infinite query like {@link QueryClient#fetchInfiniteQuery}, but ignores
   * the result and any error.
   * @param options - The infinite query options, including the `queryKey`, the `queryFn`, and the
   * `initialPageParam`.
   * @returns A promise that resolves once the fetch settles. It never rejects.
   * @deprecated Use queryClient.infiniteQuery(options) instead. You can swallow errors with `.catch(noop)`. This method will be removed in the next major version.
   */
  prefetchInfiniteQuery<TQueryFnData, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = unknown>(options: FetchInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>): Promise<void>;
  /**
   * Returns the cached data of an infinite query, or fetches it if there is none. With
   * `revalidateIfStale`, stale cached data is also refetched in the background.
   * @param options - The infinite query options. If the query has no cached data yet, it is fetched
   * with these options.
   * @returns A promise that resolves to the cached {@link InfiniteData}, or to the fetched data if
   * nothing was cached yet.
   * @deprecated Use queryClient.infiniteQuery({ ...options, staleTime: 'static' }) instead. This method will be removed in the next major version.
   */
  ensureInfiniteQueryData<TQueryFnData, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = unknown>(options: EnsureInfiniteQueryDataOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>): Promise<InfiniteData<TData, TPageParam>>;
  /**
   * Resumes mutations that were paused because there was no network connection. Does nothing
   * (resolving immediately) if the client is currently offline.
   * @returns A promise that resolves once the resumed mutations have settled.
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * await queryClient.resumePausedMutations()
   * ```
   */
  resumePausedMutations(): Promise<unknown>;
  /**
   * Returns the query cache this client is connected to.
   * @returns The {@link QueryCache} instance.
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * const queryCache = queryClient.getQueryCache()
   * const queries = queryCache.findAll({ queryKey: ['posts'] })
   * ```
   */
  getQueryCache(): QueryCache;
  /**
   * Returns the mutation cache this client is connected to.
   * @returns The {@link MutationCache} instance.
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * const mutationCache = queryClient.getMutationCache()
   * const mutations = mutationCache.findAll({ status: 'pending' })
   * ```
   */
  getMutationCache(): MutationCache;
  /**
   * Returns the default options that were set when creating the client, or via
   * {@link QueryClient#setDefaultOptions}.
   * @returns The client's current default options.
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * const defaultOptions = queryClient.getDefaultOptions()
   * ```
   */
  getDefaultOptions(): DefaultOptions;
  /**
   * Dynamically sets the default options for this client, overwriting any previously defined
   * default options.
   * @param options - The new default options for queries and mutations.
   * @see {@link QueryClient#getDefaultOptions}
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * queryClient.setDefaultOptions({
   *   queries: {
   *     staleTime: Infinity,
   *   },
   * })
   * ```
   */
  setDefaultOptions(options: DefaultOptions): void;
  /**
   * Sets default options for queries whose query key partially matches the given `queryKey`.
   *
   * If several registered query defaults match a given query key, they are merged together in
   * registration order by {@link QueryClient#getQueryDefaults}, so register defaults from the
   * most generic key to the least generic one — more specific defaults should be registered
   * after more generic ones so they take precedence.
   * @param queryKey - The query key that query keys are partially matched against.
   * @param options - The default options applied to matching queries.
   * @example
   * ```ts
   * queryClient.setQueryDefaults(['posts'], { queryFn: fetchPosts })
   *
   * await queryClient.query({ queryKey: ['posts'] })
   * ```
   */
  setQueryDefaults<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryData = TQueryFnData>(queryKey: QueryKey, options: Partial<OmitKeyof<QueryObserverOptions<TQueryFnData, TError, TData, TQueryData>, 'queryKey'>>): void;
  /**
   * Returns the default options registered for queries whose query key partially matches the
   * given `queryKey`, via {@link QueryClient#setQueryDefaults}. If multiple registered defaults
   * match, they are merged together in registration order.
   * @param queryKey - The query key to look up registered defaults for.
   * @returns The merged default options of every registration that matches, or an empty object if
   * none match.
   * @example
   * ```ts
   * const defaultOptions = queryClient.getQueryDefaults(['posts'])
   * ```
   */
  getQueryDefaults(queryKey: QueryKey): OmitKeyof<QueryObserverOptions<any, any, any, any, any>, 'queryKey'>;
  /**
   * Sets default options for mutations whose mutation key partially matches the given
   * `mutationKey`. As with {@link QueryClient#setQueryDefaults}, the order of registration
   * matters when several registered defaults match the same mutation key.
   * @param mutationKey - The mutation key that mutation keys are partially matched against.
   * @param options - The default options applied to matching mutations.
   * @see {@link QueryClient#getMutationDefaults}
   * @example
   * ```ts
   * queryClient.setMutationDefaults(['addPost'], { mutationFn: addPost })
   * ```
   */
  setMutationDefaults<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown>(mutationKey: MutationKey, options: OmitKeyof<MutationObserverOptions<TData, TError, TVariables, TOnMutateResult>, 'mutationKey'>): void;
  /**
   * Returns the default options registered for mutations whose mutation key partially matches
   * the given `mutationKey`, via {@link QueryClient#setMutationDefaults}. If multiple registered
   * defaults match, they are merged together in registration order.
   * @param mutationKey - The mutation key to look up registered defaults for.
   * @returns The merged default options of every registration that matches, or an empty object if
   * none match.
   * @example
   * ```ts
   * const defaultOptions = queryClient.getMutationDefaults(['addPost'])
   * ```
   */
  getMutationDefaults(mutationKey: MutationKey): OmitKeyof<MutationObserverOptions<any, any, any, any>, 'mutationKey'>;
  /**
   * Called by framework adapters (e.g. inside `useQuery`) to resolve the options passed by the
   * caller into their final, defaulted form: merging the client's own `defaultOptions.queries`,
   * then `queryClient.setQueryDefaults` for the given `queryKey`, then the caller's options on
   * top. A no-op if the options are already defaulted (`_defaulted: true`).
   * @param options - The query options passed by the caller.
   * @returns The defaulted options, with `queryHash` and dependent defaults (e.g.
   * `refetchOnReconnect`) filled in.
   */
  defaultQueryOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = never>(options: QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey, TPageParam> | DefaultedQueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>): DefaultedQueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>;
  /**
   * The mutation counterpart of {@link QueryClient#defaultQueryOptions}. Called by framework
   * adapters (e.g. inside `useMutation`) to merge the client's `defaultOptions.mutations`, then
   * `queryClient.setMutationDefaults` for the given `mutationKey`, then the caller's options on
   * top. A no-op if the options are already defaulted (`_defaulted: true`).
   * @param options - The mutation options passed by the caller.
   * @returns The defaulted options.
   */
  defaultMutationOptions<T extends MutationOptions<any, any, any, any>>(options?: T): T;
  /**
   * Clears both the query cache and the mutation cache this client is connected to.
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * queryClient.clear()
   * ```
   */
  clear(): void;
}
//#endregion
//#region src/retryer.d.ts
interface RetryerConfig<TData = unknown, TError = DefaultError> {
  fn: () => TData | Promise<TData>;
  initialPromise?: Promise<TData>;
  onCancel?: (error: TError) => void;
  onFail?: (failureCount: number, error: TError) => void;
  onPause?: () => void;
  onContinue?: () => void;
  retry?: RetryValue<TError>;
  retryDelay?: RetryDelayValue<TError>;
  networkMode: NetworkMode | undefined;
  canRun: () => boolean;
}
/**
 * Runs a function with retries, and can pause, continue, or cancel it. Queries and mutations use
 * one for each fetch or execution.
 */
interface Retryer<TData = unknown> {
  /**
   * The promise that resolves with the data, or rejects once retries are exhausted or it is
   * cancelled.
   */
  promise: Promise<TData>;
  /**
   * Cancels the run, rejecting `promise` with a `CancelledError`.
   */
  cancel: (cancelOptions?: CancelOptions) => void;
  /**
   * Resumes a paused run, and returns `promise`.
   */
  continue: () => Promise<unknown>;
  /**
   * Stops further retries. The current attempt still finishes.
   */
  cancelRetry: () => void;
  /**
   * Allows retries again after `cancelRetry`.
   */
  continueRetry: () => void;
  /**
   * Returns whether the run can start now, based on the network mode and `canRun`.
   */
  canStart: () => boolean;
  /**
   * Starts the run, or waits until it can start, and returns `promise`.
   */
  start: () => Promise<TData>;
  /**
   * Returns whether `promise` is still pending, resolved, or rejected.
   */
  status: () => 'pending' | 'resolved' | 'rejected';
}
/** @inline */
type RetryValue<TError> = boolean | number | ShouldRetryFunction<TError>;
/** @inline */
type ShouldRetryFunction<TError = DefaultError> = (failureCount: number, error: TError) => boolean;
/** @inline */
type RetryDelayValue<TError> = number | RetryDelayFunction<TError>;
/** @inline */
type RetryDelayFunction<TError = DefaultError> = (failureCount: number, error: TError) => number;
/**
 * Checks whether a fetch can run for the given network mode.
 * @param networkMode - The `networkMode` option. Defaults to `'online'`.
 * @returns `true` if the network mode is not `'online'`, or if it is and the client is online.
 */
declare function canFetch(networkMode: NetworkMode | undefined): boolean;
/**
 * The error thrown by a `Retryer` (and surfaced to `query.promise`/`mutation`) when a fetch is cancelled, e.g. via
 * `query.cancel()`. `revert`, if `true`, tells the caller to restore the state the query was in before the fetch
 * started instead of surfacing the error. `silent`, if `true`, tells the caller to suppress this error and instead
 * resolve with the promise of the fetch that triggered the cancellation.
 * @example
 * ```ts
 * query.cancel()
 *
 * try {
 *   await query.promise
 * } catch (error) {
 *   if (error instanceof CancelledError) {
 *     // the fetch was cancelled, e.g. via `query.cancel()`
 *   }
 * }
 * ```
 */
declare class CancelledError extends Error {
  revert?: boolean;
  silent?: boolean;
  constructor(options?: CancelOptions);
}
/**
 * Checks whether a value is a `CancelledError`.
 * @param value - The value to check.
 * @returns `true` if `value` is a `CancelledError`.
 * @deprecated Use instanceof `CancelledError` instead.
 */
declare function isCancelledError(value: any): value is CancelledError;
/**
 * Creates a retryer, which runs a function and retries it on failure according to the `retry` and
 * `retryDelay` options. It pauses while the network mode doesn't allow fetching or `canRun` returns
 * `false`, and can be cancelled. Queries and mutations use it to run their `queryFn` and
 * `mutationFn`.
 * @param config - The function to run, the retry options, and the callbacks for failures, pausing,
 * continuing, and cancellation.
 * @returns The retryer, whose `promise` settles with the result of the function.
 */
declare function createRetryer<TData = unknown, TError = DefaultError>(config: RetryerConfig<TData, TError>): Retryer<TData>;
//#endregion
//#region src/types.d.ts
/**
 * Excludes `undefined` from `T`. Used where a value must be defined, such as the data type that a
 * defined `initialData` resolves to.
 */
type NonUndefinedGuard<T> = T extends undefined ? never : T;
/**
 * Like `Omit`, but applied to each member of a union separately, so each member keeps its own keys.
 */
type DistributiveOmit<TObject, TKey extends keyof TObject> = TObject extends any ? Omit<TObject, TKey> : never;
/**
 * Like `Omit`, but by default (`'strictly'`) `TKey` must be a key of `TObject`, so omitting a key
 * that doesn't exist is a type error. Pass `'safely'` to allow other keys too.
 */
type OmitKeyof<TObject, TKey extends (TStrictly extends 'safely' ? keyof TObject | (string & Record<never, never>) | (number & Record<never, never>) | (symbol & Record<never, never>) : keyof TObject), TStrictly extends 'strictly' | 'safely' = 'strictly'> = Omit<TObject, TKey>;
/**
 * Replaces the types of the properties of `TTargetA` that also exist in `TTargetB` with their types
 * in `TTargetB`. Properties that only exist in `TTargetB` are not added.
 */
type Override<TTargetA, TTargetB> = { [AKey in keyof TTargetA]: AKey extends keyof TTargetB ? TTargetB[AKey] : TTargetA[AKey]; };
/**
 * The interface to augment via declaration merging to override Query's default types repository-wide.
 * Each field it declares replaces the default of the matching type: `defaultError` for {@link DefaultError},
 * `queryKey` for {@link QueryKey}, `mutationKey` for {@link MutationKey}, `queryMeta` for {@link QueryMeta} and
 * `mutationMeta` for {@link MutationMeta}. Leave a field out to keep that type's default.
 * Augment the module you install — `@tanstack/react-query`, `@tanstack/vue-query`,
 * `@tanstack/solid-query`, `@tanstack/svelte-query`, `@tanstack/preact-query`,
 * `@tanstack/angular-query-experimental` or `@tanstack/lit-query`. Augmenting `@tanstack/query-core`
 * works too and covers every adapter at once.
 * @example
 * ```ts
 * // Use the module you installed — here, the React adapter.
 * declare module '@tanstack/react-query' {
 *   interface Register {
 *     defaultError: AxiosError
 *   }
 * }
 * ```
 */
interface Register {}
/**
 * The error type used wherever an error is not given an explicit type parameter.
 * Defaults to `Error`; declare `defaultError` on {@link Register} to change it everywhere at once.
 */
type DefaultError = Register extends {
  defaultError: infer TError;
} ? TError : Error;
/**
 * The type of a query key — the serializable array that identifies a query in the cache.
 * Defaults to `ReadonlyArray<unknown>`; declare `queryKey` on {@link Register} to narrow it repository-wide.
 */
type QueryKey = Register extends {
  queryKey: infer TQueryKey;
} ? TQueryKey extends ReadonlyArray<unknown> ? TQueryKey : TQueryKey extends Array<unknown> ? TQueryKey : ReadonlyArray<unknown> : ReadonlyArray<unknown>;
declare const dataTagSymbol: unique symbol;
/**
 * The type of the `dataTagSymbol` key, under which a {@link DataTag} stores its data type.
 */
type dataTagSymbol = typeof dataTagSymbol;
declare const dataTagErrorSymbol: unique symbol;
/**
 * The type of the `dataTagErrorSymbol` key, under which a {@link DataTag} stores its error type.
 */
type dataTagErrorSymbol = typeof dataTagErrorSymbol;
declare const unsetMarker: unique symbol;
/**
 * The type of `unsetMarker`, the default error type of a {@link DataTag}. It marks that no error
 * type was tagged.
 */
type UnsetMarker = typeof unsetMarker;
/**
 * Matches any type that has been tagged with {@link DataTag}, whatever its data and error types.
 */
type AnyDataTag = {
  /**
   * The data type the key was tagged with.
   */
  [dataTagSymbol]: any;
  /**
   * The error type the key was tagged with.
   */
  [dataTagErrorSymbol]: any;
};
/**
 * Tags `TType` (usually a query key) with a data type and an optional error type, so that APIs that
 * receive it, like `queryClient.getQueryData`, can infer them. A type that is already tagged is
 * returned as is.
 */
type DataTag<TType, TValue, TError = UnsetMarker> = TType extends AnyDataTag ? TType : TType & {
  [dataTagSymbol]: TValue;
  [dataTagErrorSymbol]: TError;
};
/**
 * An object whose `queryKey` is tagged with {@link DataTag}, like the options returned by
 * `queryOptions`.
 */
type QueryKeyWithDataTag<TQueryKey extends QueryKey = QueryKey, TQueryFnData = unknown, TError = DefaultError> = {
  /**
   * The query key, tagged with the query's data and error types.
   */
  queryKey: DataTag<TQueryKey, TQueryFnData, TError>;
};
/**
 * The data type tagged on a query key by {@link DataTag}, or `TQueryFnData` if the key is not
 * tagged.
 */
type InferDataFromTag<TQueryFnData, TTaggedQueryKey extends QueryKey> = TTaggedQueryKey extends DataTag<unknown, infer TaggedValue, unknown> ? TaggedValue : TQueryFnData;
/**
 * The error type tagged on a query key by {@link DataTag}, or `TError` if the key is not tagged or
 * was tagged without an error type.
 */
type InferErrorFromTag<TError, TTaggedQueryKey extends QueryKey> = TTaggedQueryKey extends DataTag<unknown, unknown, infer TaggedError> ? TaggedError extends UnsetMarker ? TError : TaggedError : TError;
/** @inline */
type QueryFunction<T = unknown, TQueryKey extends QueryKey = QueryKey, TPageParam = never> = (context: QueryFunctionContext<TQueryKey, TPageParam>) => T | Promise<T>;
/** @inline */
type StaleTime = number | 'static';
/** @inline */
type StaleTimeFunction<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> = StaleTime | ((query: Query<TQueryFnData, TError, TData, TQueryKey>) => StaleTime);
/** @inline */
type QueryBooleanOption<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> = boolean | ((query: Query<TQueryFnData, TError, TData, TQueryKey>) => boolean);
/** @inline */
type QueryPersister<T = unknown, TQueryKey extends QueryKey = QueryKey, TPageParam = never> = [TPageParam] extends [never] ? (queryFn: QueryFunction<T, TQueryKey, never>, context: QueryFunctionContext<TQueryKey>, query: Query) => T | Promise<T> : (queryFn: QueryFunction<T, TQueryKey, TPageParam>, context: QueryFunctionContext<TQueryKey>, query: Query) => T | Promise<T>;
/**
 * The object passed to `queryFn`: the `QueryClient`, the `queryKey`, an `AbortSignal` that aborts
 * when the query is cancelled, the query's `meta`, and for infinite queries the `pageParam` of the
 * page being fetched.
 */
type QueryFunctionContext<TQueryKey extends QueryKey = QueryKey, TPageParam = never> = [TPageParam] extends [never] ? {
  client: QueryClient;
  queryKey: TQueryKey;
  signal: AbortSignal;
  meta: QueryMeta | undefined;
  pageParam?: unknown;
  /**
   * @deprecated
   * if you want access to the direction, you can add it to the pageParam
   */
  direction?: unknown;
} : {
  client: QueryClient;
  queryKey: TQueryKey;
  signal: AbortSignal;
  pageParam: TPageParam;
  /**
   * @deprecated
   * if you want access to the direction, you can add it to the pageParam
   */
  direction: FetchDirection;
  meta: QueryMeta | undefined;
};
/** @inline */
type InitialDataFunction<T> = () => T | undefined;
type NonFunctionGuard<T> = T extends Function ? never : T;
/** @inline */
type PlaceholderDataFunction<TQueryFnData = unknown, TError = DefaultError, TQueryData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> = (previousData: TQueryData | undefined, previousQuery: Query<TQueryFnData, TError, TQueryData, TQueryKey> | undefined) => TQueryData | undefined;
/**
 * The `placeholderData` function of a query in `useQueries` and its counterparts. Unlike
 * {@link PlaceholderDataFunction}, it receives no previous data or query, because the number of
 * queries can differ between renders.
 */
type QueriesPlaceholderDataFunction<TQueryData> = (previousData: undefined, previousQuery: undefined) => TQueryData | undefined;
/** @inline */
type QueryKeyHashFunction<TQueryKey extends QueryKey> = (queryKey: TQueryKey) => string;
/** @inline */
type GetPreviousPageParamFunction<TPageParam, TQueryFnData = unknown> = (firstPage: TQueryFnData, allPages: Array<TQueryFnData>, firstPageParam: TPageParam, allPageParams: Array<TPageParam>) => TPageParam | undefined | null;
/** @inline */
type GetNextPageParamFunction<TPageParam, TQueryFnData = unknown> = (lastPage: TQueryFnData, allPages: Array<TQueryFnData>, lastPageParam: TPageParam, allPageParams: Array<TPageParam>) => TPageParam | undefined | null;
/**
 * The data shape of an infinite query: every page fetched so far, plus the page param each one was fetched with.
 * `pages` and `pageParams` are index-aligned — `pageParams[i]` is the param that produced `pages[i]`.
 */
interface InfiniteData<TData, TPageParam = unknown> {
  /**
   * The data of every page fetched so far, in order.
   */
  pages: Array<TData>;
  /**
   * The page param each page was fetched with, aligned by index with `pages`.
   */
  pageParams: Array<TPageParam>;
}
/**
 * The type of the `meta` object that can be attached to a query and read back from `queryFn`, callbacks and
 * cache-level handlers. Defaults to `Record<string, unknown>`; declare `queryMeta` on {@link Register} to narrow it.
 */
type QueryMeta = Register extends {
  queryMeta: infer TQueryMeta;
} ? TQueryMeta extends Record<string, unknown> ? TQueryMeta : Record<string, unknown> : Record<string, unknown>;
/** @inline */
type NetworkMode = 'online' | 'always' | 'offlineFirst';
/** @inline */
type NotifyOnChangeProps = Array<keyof InfiniteQueryObserverResult> | 'all' | undefined | (() => Array<keyof InfiniteQueryObserverResult> | 'all' | undefined);
/**
 * The options of a query itself — its `queryKey`, `queryFn`, retries, `gcTime`, `initialData`,
 * `meta`, and so on — shared by observers and the `QueryClient` methods that fetch queries.
 */
interface QueryOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = never> {
  /**
   * If `false`, failed queries will not retry by default.
   * If `true`, failed queries will retry infinitely.
   * If set to an integer number, e.g. 3, failed queries will retry until the failed query count meets that number.
   * If set to a function `(failureCount, error) => boolean` failed queries will retry until the function returns false.
   *
   * Defaults to `3` on the client and `0` on the server.
   */
  retry?: RetryValue<TError>;
  /**
   * This function receives a `retryAttempt` integer and the actual Error and returns the delay to apply before the
   * next attempt in milliseconds.
   *
   * A function like `attempt => Math.min(attempt > 1 ? 2 ** attempt * 1000 : 1000, 30 * 1000)` applies exponential
   * backoff.
   *
   * A function like `attempt => attempt * 1000` applies linear backoff.
   *
   * Defaults to a function that applies exponential backoff, capped at 30 seconds.
   */
  retryDelay?: RetryDelayValue<TError>;
  /**
   * Controls whether a query is allowed to run based on the current network connectivity.
   * @defaultValue 'online'
   * @see [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) for more information.
   */
  networkMode?: NetworkMode;
  /**
   * The time in milliseconds that unused/inactive cache data remains in memory.
   * When a query's cache becomes unused or inactive, that cache data will be garbage collected after this duration.
   * When different garbage collection times are specified, the longest one will be used.
   * Setting it to `Infinity` will disable garbage collection.
   *
   * Defaults to `5 * 60 * 1000` (5 minutes), or `Infinity` during SSR.
   *
   * Note: the maximum allowed time is about 24 days, imposed by `setTimeout`'s 32-bit signed integer delay — see
   * `timeoutManager.setTimeoutProvider` for a workaround.
   */
  gcTime?: number;
  /**
   * The function that the query will use to request data.
   * Required, unless a default query function has been set via `queryClient.setQueryDefaults` or
   * `queryClient.setDefaultOptions`.
   * Receives a {@link QueryFunctionContext}.
   * Must return a promise that will either resolve data or throw an error. The data cannot be `undefined`.
   */
  queryFn?: QueryFunction<TQueryFnData, TQueryKey, TPageParam> | SkipToken;
  /**
   * This option can be used to persist the result of a query to an external storage, bypassing the need to actually
   * call the `queryFn`. Useful for persisting a query's data across e.g. server/client boundaries.
   */
  persister?: QueryPersister<TQueryFnData, NoInfer<TQueryKey>, TPageParam>;
  /**
   * The hashed form of `queryKey`, computed with `queryKeyHashFn` (or the default hashing function otherwise). Used
   * as the actual cache key internally.
   */
  queryHash?: string;
  /**
   * The query key to use for this query.
   *
   * The query key will be hashed into a stable hash. See [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
   * for more information.
   *
   * The query will automatically update when this key changes (as long as `enabled` is not set to `false`).
   */
  queryKey?: TQueryKey;
  /**
   * If specified, this function is used to hash the `queryKey` to a string.
   */
  queryKeyHashFn?: QueryKeyHashFunction<TQueryKey>;
  /**
   * If set, this value will be used as the initial data for the query cache (as long as the query hasn't been
   * created or cached yet).
   * If set to a function, the function will be called **once** during the shared/root query initialization, and be
   * expected to synchronously return the initial data.
   * Initial data is considered stale by default unless a `staleTime` has been set.
   * `initialData` **is persisted** to the cache.
   */
  initialData?: TData | InitialDataFunction<TData>;
  /**
   * If set, this value will be used as the time (in milliseconds) of when the `initialData` itself was last updated.
   */
  initialDataUpdatedAt?: number | (() => number | undefined);
  /** @internal */
  behavior?: QueryBehavior<TQueryFnData, TError, TData, TQueryKey>;
  /**
   * Set this to `false` to disable structural sharing between query results.
   * Set this to a function which accepts the old and new data and returns resolved data of the same type to implement custom structural sharing logic.
   * @defaultValue true
   */
  structuralSharing?: boolean | ((oldData: unknown | undefined, newData: unknown) => unknown);
  /** @internal */
  _defaulted?: boolean;
  /** @internal */
  _type?: 'infinite';
  /**
   * Additional payload to be stored on each query.
   * Use this property to pass information that can be used in other places.
   */
  meta?: QueryMeta;
  /**
   * Maximum number of pages to store in the data of an infinite query.
   */
  maxPages?: number;
}
/**
 * Holds the `initialPageParam` option that every infinite query requires.
 */
interface InitialPageParam<TPageParam = unknown> {
  /**
   * The page param to start from when an infinite query has no pages yet.
   * It is passed to `queryFn` as `pageParam` for the first page; every page after that gets the
   * value returned by `getNextPageParam` or `getPreviousPageParam`.
   * It only applies while the query has no pages: once a first page exists, refetching starts from
   * that page's own param instead.
   */
  initialPageParam: TPageParam;
}
/**
 * The page param options of an infinite query: `initialPageParam`, and the `getNextPageParam` and
 * `getPreviousPageParam` functions that compute the params of the pages around it.
 */
interface InfiniteQueryPageParamsOptions<TQueryFnData = unknown, TPageParam = unknown> extends InitialPageParam<TPageParam> {
  /**
   * This function can be set to automatically get the previous cursor for infinite queries.
   * The result will also be used to determine the value of `hasPreviousPage`.
   */
  getPreviousPageParam?: GetPreviousPageParamFunction<TPageParam, TQueryFnData>;
  /**
   * This function can be set to automatically get the next cursor for infinite queries.
   * The result will also be used to determine the value of `hasNextPage`.
   */
  getNextPageParam: GetNextPageParamFunction<TPageParam, TQueryFnData>;
}
/** @inline */
type ThrowOnError<TQueryFnData, TError, TQueryData, TQueryKey extends QueryKey> = boolean | ((error: TError, query: Query<TQueryFnData, TError, TQueryData, TQueryKey>) => boolean);
/**
 * The options of a `QueryObserver`, and of the hooks built on it like `useQuery`: the
 * {@link QueryOptions} of the query, plus options that control the observer, such as `enabled`,
 * `staleTime`, `refetchInterval`, `select`, and `placeholderData`.
 */
interface QueryObserverOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = never> extends WithRequired<QueryOptions<TQueryFnData, TError, TQueryData, TQueryKey, TPageParam>, 'queryKey'> {
  /**
   * Set this to `false` or a function that returns `false` to disable automatic refetching when the query mounts or changes query keys.
   * To refetch the query, use the `refetch` method returned from the `useQuery` instance.
   * Accepts a boolean or function that returns a boolean.
   * @defaultValue true
   */
  enabled?: QueryBooleanOption<TQueryFnData, TError, TQueryData, TQueryKey>;
  /**
   * The time in milliseconds after data is considered stale.
   * If set to `Infinity`, the data will never be considered stale.
   * If set to `'static'`, the data will never be considered stale.
   * If set to a function, the function will be executed with the query to compute a `staleTime`.
   * @defaultValue 0
   */
  staleTime?: StaleTimeFunction<TQueryFnData, TError, TQueryData, TQueryKey>;
  /**
   * If set to a number, the query will continuously refetch at this frequency in milliseconds.
   * If set to a function, the function will be executed with the latest data and query to compute a frequency
   * @defaultValue false
   */
  refetchInterval?: number | false | ((query: Query<TQueryFnData, TError, TQueryData, TQueryKey>) => number | false | undefined);
  /**
   * If set to `true`, the query will continue to refetch while their tab/window is in the background.
   * @defaultValue false
   */
  refetchIntervalInBackground?: boolean;
  /**
   * If set to `true`, the query will refetch on window focus if the data is stale.
   * If set to `false`, the query will not refetch on window focus.
   * If set to `'always'`, the query will always refetch on window focus (except when `staleTime: 'static'` is used).
   * If set to a function, the function will be executed with the latest data and query to compute the value.
   * @defaultValue true
   */
  refetchOnWindowFocus?: boolean | 'always' | ((query: Query<TQueryFnData, TError, TQueryData, TQueryKey>) => boolean | 'always');
  /**
   * If set to `true`, the query will refetch on reconnect if the data is stale.
   * If set to `false`, the query will not refetch on reconnect.
   * If set to `'always'`, the query will always refetch on reconnect (except when `staleTime: 'static'` is used).
   * If set to a function, the function will be executed with the latest data and query to compute the value.
   *
   * Defaults to `true` unless `networkMode` is `'always'`.
   */
  refetchOnReconnect?: boolean | 'always' | ((query: Query<TQueryFnData, TError, TQueryData, TQueryKey>) => boolean | 'always');
  /**
   * If set to `true`, the query will refetch on mount if the data is stale.
   * If set to `false`, will disable additional instances of a query to trigger background refetch.
   * If set to `'always'`, the query will always refetch on mount (except when `staleTime: 'static'` is used).
   * If set to a function, the function will be executed with the latest data and query to compute the value
   * @defaultValue true
   */
  refetchOnMount?: boolean | 'always' | ((query: Query<TQueryFnData, TError, TQueryData, TQueryKey>) => boolean | 'always');
  /**
   * If set to `false`, the query will not be retried on mount if it contains an error.
   * If set to a function, the function will be executed with the query to compute the value.
   * @defaultValue true
   */
  retryOnMount?: QueryBooleanOption<TQueryFnData, TError, TQueryData, TQueryKey>;
  /**
   * If set, the component will only re-render if any of the listed properties change.
   * When set to `['data', 'error']`, the component will only re-render when the `data` or `error` properties change.
   * When set to `'all'`, the component will re-render whenever a query is updated.
   * When set to a function, the function will be executed to compute the list of properties.
   *
   * Defaults to `undefined`, in which case property access is tracked automatically, and the
   * component only re-renders when one of the tracked properties changes.
   */
  notifyOnChangeProps?: NotifyOnChangeProps;
  /**
   * Whether errors should be thrown instead of setting the `error` property.
   * If set to `true` or `suspense` is `true`, all errors will be thrown to the error boundary.
   * If set to `false` and `suspense` is `false`, errors are returned as state.
   * If set to a function, it will be passed the error and the query, and it should return a boolean indicating whether to show the error in an error boundary (`true`) or return the error as state (`false`).
   * @defaultValue false
   */
  throwOnError?: ThrowOnError<TQueryFnData, TError, TQueryData, TQueryKey>;
  /**
   * This option can be used to transform or select a part of the data returned by the query function. It affects
   * the returned `data` value, but does not affect what gets stored in the query cache.
   * The `select` function will only run if `data` changed, or if the reference to the `select` function itself
   * changes. To optimize, memoize the function so its reference stays stable across calls.
   */
  select?: (data: TQueryData) => TData;
  /**
   * If set to `true`, the query will suspend when `status === 'pending'`
   * and throw errors when `status === 'error'`.
   * @defaultValue false
   */
  suspense?: boolean;
  /**
   * If set, this value will be used as the placeholder data for this particular query observer while the query is still in the `loading` data and no initialData has been provided.
   */
  placeholderData?: NonFunctionGuard<TQueryData> | PlaceholderDataFunction<NonFunctionGuard<TQueryData>, TError, NonFunctionGuard<TQueryData>, TQueryKey>;
  /** @internal */
  _optimisticResults?: 'optimistic' | 'isRestoring';
}
/**
 * Makes the `TKey` properties of `TTarget` required and non-nullable.
 */
type WithRequired<TTarget, TKey extends keyof TTarget> = TTarget & { [_ in TKey]: {}; };
/**
 * The {@link QueryObserverOptions} after `QueryClient#defaultQueryOptions` has applied the
 * defaults, so `throwOnError`, `refetchOnReconnect`, and `queryHash` are always set.
 */
type DefaultedQueryObserverOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryData = TQueryFnData, TQueryKey extends QueryKey = QueryKey> = WithRequired<QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>, 'throwOnError' | 'refetchOnReconnect' | 'queryHash'>;
/**
 * The options of an `InfiniteQueryObserver`: {@link QueryObserverOptions} whose query data is
 * {@link InfiniteData}, plus the page param options.
 */
interface InfiniteQueryObserverOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = unknown> extends QueryObserverOptions<TQueryFnData, TError, TData, InfiniteData<TQueryFnData, TPageParam>, TQueryKey, TPageParam>, InfiniteQueryPageParamsOptions<TQueryFnData, TPageParam> {}
/**
 * The {@link InfiniteQueryObserverOptions} after `QueryClient#defaultQueryOptions` has applied the
 * defaults, so `throwOnError`, `refetchOnReconnect`, and `queryHash` are always set.
 */
type DefaultedInfiniteQueryObserverOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = unknown> = WithRequired<InfiniteQueryObserverOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>, 'throwOnError' | 'refetchOnReconnect' | 'queryHash'>;
/**
 * The options of `queryClient.query`: the {@link QueryOptions} of the query, plus a `staleTime`
 * that decides whether cached data is returned instead of fetching, and a `select` that only
 * transforms the value the call resolves with.
 */
interface QueryExecuteOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = never> extends WithRequired<QueryOptions<TQueryFnData, TError, TQueryData, TQueryKey, TPageParam>, 'queryKey'> {
  /**
   * Not allowed here, since `initialPageParam` only applies to infinite queries.
   */
  initialPageParam?: never;
  /**
   * This option can be used to transform or select a part of the data returned by the query function. It affects
   * the value this call resolves with, but does not affect what gets stored in the query cache.
   */
  select?: (data: TQueryData) => TData;
  /**
   * The time in milliseconds after data is considered stale.
   * If the data is fresh it will be returned from the cache.
   */
  staleTime?: StaleTimeFunction<TQueryFnData, TError, TQueryData, TQueryKey>;
}
/** @deprecated */
interface FetchQueryOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = never> extends WithRequired<QueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>, 'queryKey'> {
  /**
   * Not allowed here, since `initialPageParam` only applies to infinite queries.
   */
  initialPageParam?: never;
  /**
   * The time in milliseconds after data is considered stale.
   * If the data is fresh it will be returned from the cache.
   */
  staleTime?: StaleTimeFunction<TQueryFnData, TError, TData, TQueryKey>;
}
/** @deprecated */
interface EnsureQueryDataOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = never> extends FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam> {
  /**
   * If `true`, stale cached data is returned and also refetched in the background.
   */
  revalidateIfStale?: boolean;
}
/** @deprecated */
type EnsureInfiniteQueryDataOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = unknown> = FetchInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam> & {
  revalidateIfStale?: boolean;
};
type InfiniteQueryPages<TQueryFnData = unknown, TPageParam = unknown> = {
  pages?: never;
} | {
  pages: number;
  getNextPageParam: GetNextPageParamFunction<TPageParam, TQueryFnData>;
};
/**
 * The options of `queryClient.infiniteQuery`: like {@link QueryExecuteOptions}, with the
 * `initialPageParam`, and optionally `pages` together with `getNextPageParam` to fetch that many
 * pages at once.
 */
type InfiniteQueryExecuteOptions<TQueryFnData = unknown, TError = DefaultError, TData = InfiniteData<TQueryFnData>, TQueryKey extends QueryKey = QueryKey, TPageParam = unknown> = Omit<QueryExecuteOptions<TQueryFnData, TError, TData, InfiniteData<TQueryFnData, TPageParam>, TQueryKey, TPageParam>, 'initialPageParam'> & InitialPageParam<TPageParam> & InfiniteQueryPages<TQueryFnData, TPageParam>;
/** @deprecated */
type FetchInfiniteQueryOptions<TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey, TPageParam = unknown> = Omit<FetchQueryOptions<TQueryFnData, TError, InfiniteData<TData, TPageParam>, TQueryKey, TPageParam>, 'initialPageParam'> & InitialPageParam<TPageParam> & InfiniteQueryPages<TQueryFnData, TPageParam>;
/**
 * Options shared by the `QueryClient` and observer methods that refetch queries, controlling
 * whether a failed refetch makes the returned promise reject.
 */
interface ResultOptions {
  /**
   * If set to `true`, the method throws if any of the underlying query refetch tasks fail.
   * If set to `false`, failed refetches are swallowed and not surfaced to the caller.
   * @defaultValue false
   */
  throwOnError?: boolean;
}
/**
 * Options of the methods that refetch queries, like `refetch` and `queryClient.refetchQueries`.
 */
interface RefetchOptions extends ResultOptions {
  /**
   * If set to `true`, a currently running request will be cancelled before a new request is made
   *
   * If set to `false`, no refetch will be made if there is already a request running.
   * @defaultValue true
   */
  cancelRefetch?: boolean;
}
/**
 * The filters of `queryClient.invalidateQueries`: the {@link QueryFilters} that select the queries
 * to invalidate, plus `refetchType` to choose which of them are refetched.
 */
interface InvalidateQueryFilters<TQueryKey extends QueryKey = QueryKey> extends QueryFilters<TQueryKey> {
  /**
   * Controls which of the matched (now-invalidated) queries are refetched in the background.
   *
   * - `'active'`: only queries with at least one active observer are refetched.
   * - `'inactive'`: only queries with no active observer are refetched.
   * - `'all'`: every matched query is refetched, active or not.
   * - `'none'`: no query is refetched; matched queries are only marked as invalidated.
   * @defaultValue 'active'
   */
  refetchType?: QueryTypeFilter | 'none';
}
/**
 * The filters of `queryClient.refetchQueries`, which select the queries to refetch.
 */
interface RefetchQueryFilters<TQueryKey extends QueryKey = QueryKey> extends QueryFilters<TQueryKey> {}
/**
 * Options of `queryClient.invalidateQueries`, applied to the refetch that follows the invalidation.
 */
interface InvalidateOptions extends RefetchOptions {}
/**
 * Options of `queryClient.resetQueries`, applied to the refetch of the active queries after the
 * reset.
 */
interface ResetOptions extends RefetchOptions {}
/**
 * Options of `fetchNextPage` on an infinite query result.
 */
interface FetchNextPageOptions extends ResultOptions {
  /**
   * If set to `true`, calling `fetchNextPage` repeatedly will invoke `queryFn` every time,
   * whether the previous invocation has resolved or not. Also, the result from previous invocations will be ignored.
   *
   * If set to `false`, calling `fetchNextPage` repeatedly won't have any effect until the first invocation has resolved.
   * @defaultValue true
   */
  cancelRefetch?: boolean;
}
/**
 * Options of `fetchPreviousPage` on an infinite query result.
 */
interface FetchPreviousPageOptions extends ResultOptions {
  /**
   * If set to `true`, calling `fetchPreviousPage` repeatedly will invoke `queryFn` every time,
   * whether the previous invocation has resolved or not. Also, the result from previous invocations will be ignored.
   *
   * If set to `false`, calling `fetchPreviousPage` repeatedly won't have any effect until the first invocation has resolved.
   * @defaultValue true
   */
  cancelRefetch?: boolean;
}
/** @inline */
type QueryStatus = 'pending' | 'error' | 'success';
/** @inline */
type FetchStatus = 'fetching' | 'paused' | 'idle';
/**
 * The properties shared by every state of a query result, like `data`, `error`, `status`, the
 * `is*` flags, and `refetch`. Each `QueryObserver*Result` narrows them for one state.
 */
interface QueryObserverBaseResult<TData = unknown, TError = DefaultError> {
  /**
   * The last successfully resolved data for the query.
   */
  data: TData | undefined;
  /**
   * The timestamp for when the query most recently returned the `status` as `"success"`.
   */
  dataUpdatedAt: number;
  /**
   * The error object for the query, if an error was thrown.
   * - Defaults to `null`.
   */
  error: TError | null;
  /**
   * The timestamp for when the query most recently returned the `status` as `"error"`.
   */
  errorUpdatedAt: number;
  /**
   * The failure count for the query.
   * - Incremented every time the query fails.
   * - Reset to `0` when the query succeeds.
   */
  failureCount: number;
  /**
   * The failure reason for the query retry.
   * - Reset to `null` when the query succeeds.
   */
  failureReason: TError | null;
  /**
   * The sum of all errors.
   */
  errorUpdateCount: number;
  /**
   * A derived boolean from the `status` variable, provided for convenience.
   * - `true` if the query attempt resulted in an error.
   */
  isError: boolean;
  /**
   * Will be `true` if the query has been fetched.
   */
  isFetched: boolean;
  /**
   * Will be `true` if the query has been fetched after the component mounted.
   * - This property can be used to not show any previously cached data.
   */
  isFetchedAfterMount: boolean;
  /**
   * A derived boolean from the `fetchStatus` variable, provided for convenience.
   * - `true` whenever the `queryFn` is executing, which includes initial `pending` as well as background refetch.
   */
  isFetching: boolean;
  /**
   * Is `true` whenever the first fetch for a query is in-flight.
   * - Is the same as `isFetching && isPending`.
   */
  isLoading: boolean;
  /**
   * Will be `pending` if there's no cached data and no query attempt was finished yet.
   */
  isPending: boolean;
  /**
   * Will be `true` if the query failed while fetching for the first time.
   */
  isLoadingError: boolean;
  /**
   * @deprecated `isInitialLoading` is being deprecated in favor of `isLoading`
   * and will be removed in the next major version.
   */
  isInitialLoading: boolean;
  /**
   * A derived boolean from the `fetchStatus` variable, provided for convenience.
   * - The query wanted to fetch, but has been `paused`.
   */
  isPaused: boolean;
  /**
   * Will be `true` if the data shown is the placeholder data.
   */
  isPlaceholderData: boolean;
  /**
   * Will be `true` if the query failed while refetching.
   */
  isRefetchError: boolean;
  /**
   * Is `true` whenever a background refetch is in-flight, which _does not_ include initial `pending`.
   * - Is the same as `isFetching && !isPending`.
   */
  isRefetching: boolean;
  /**
   * Will be `true` if the data in the cache is invalidated or if the data is older than the given `staleTime`.
   */
  isStale: boolean;
  /**
   * A derived boolean from the `status` variable, provided for convenience.
   * - `true` if the query has received a response with no errors and is ready to display its data.
   */
  isSuccess: boolean;
  /**
   * `true` if this observer is enabled, `false` otherwise.
   */
  isEnabled: boolean;
  /**
   * A function to manually refetch the query.
   */
  refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<TData, TError>>;
  /**
   * The status of the query.
   * - Will be:
   *   - `pending` if there's no cached data and no query attempt was finished yet.
   *   - `error` if the query attempt resulted in an error.
   *   - `success` if the query has received a response with no errors and is ready to display its data.
   */
  status: QueryStatus;
  /**
   * The fetch status of the query.
   * - `fetching`: Is `true` whenever the queryFn is executing, which includes initial `pending` as well as background refetch.
   * - `paused`: The query wanted to fetch, but has been `paused`.
   * - `idle`: The query is not fetching.
   * - See [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) for more information.
   */
  fetchStatus: FetchStatus;
}
/**
 * A query result in the `pending` state: the query has no data yet.
 */
interface QueryObserverPendingResult<TData = unknown, TError = DefaultError> extends QueryObserverBaseResult<TData, TError> {
  /**
   * `undefined`, since the query has no data yet.
   */
  data: undefined;
  /**
   * `null`, since the query isn't in the `error` state.
   */
  error: null;
  /**
   * `false`, since the query isn't in the `error` state.
   */
  isError: false;
  /**
   * `true`, since there's no cached data and no query attempt has finished yet.
   */
  isPending: true;
  /**
   * `false`, since the query didn't fail while fetching for the first time.
   */
  isLoadingError: false;
  /**
   * `false`, since the query didn't fail while refetching.
   */
  isRefetchError: false;
  /**
   * `false`, since the query isn't in the `success` state.
   */
  isSuccess: false;
  /**
   * `false`, since the data shown isn't the `placeholderData`.
   */
  isPlaceholderData: false;
  /**
   * `'pending'`, since there's no cached data and no query attempt has finished yet.
   */
  status: 'pending';
}
/**
 * A query result in the `pending` state while the first fetch is in flight, so `isLoading` is
 * `true`.
 */
interface QueryObserverLoadingResult<TData = unknown, TError = DefaultError> extends QueryObserverBaseResult<TData, TError> {
  /**
   * `undefined`, since the query has no data yet.
   */
  data: undefined;
  /**
   * `null`, since the query isn't in the `error` state.
   */
  error: null;
  /**
   * `false`, since the query isn't in the `error` state.
   */
  isError: false;
  /**
   * `true`, since there's no cached data and no query attempt has finished yet.
   */
  isPending: true;
  /**
   * `true`, since the first fetch is in flight.
   */
  isLoading: true;
  /**
   * `false`, since the query didn't fail while fetching for the first time.
   */
  isLoadingError: false;
  /**
   * `false`, since the query didn't fail while refetching.
   */
  isRefetchError: false;
  /**
   * `false`, since the query isn't in the `success` state.
   */
  isSuccess: false;
  /**
   * `false`, since the data shown isn't the `placeholderData`.
   */
  isPlaceholderData: false;
  /**
   * `'pending'`, since there's no cached data and no query attempt has finished yet.
   */
  status: 'pending';
}
/**
 * A query result in the `error` state when the first fetch failed, so there is no data.
 */
interface QueryObserverLoadingErrorResult<TData = unknown, TError = DefaultError> extends QueryObserverBaseResult<TData, TError> {
  /**
   * `undefined`, since the first fetch failed before any data was cached.
   */
  data: undefined;
  /**
   * The error the first fetch failed with.
   */
  error: TError;
  /**
   * `true`, since the query is in the `error` state.
   */
  isError: true;
  /**
   * `false`, since the query has data or a query attempt has finished.
   */
  isPending: false;
  /**
   * `false`, since the first fetch isn't in flight.
   */
  isLoading: false;
  /**
   * `true`, since the query failed while fetching for the first time.
   */
  isLoadingError: true;
  /**
   * `false`, since the query didn't fail while refetching.
   */
  isRefetchError: false;
  /**
   * `false`, since the query isn't in the `success` state.
   */
  isSuccess: false;
  /**
   * `false`, since the data shown isn't the `placeholderData`.
   */
  isPlaceholderData: false;
  /**
   * `'error'`, since the query attempt resulted in an error.
   */
  status: 'error';
}
/**
 * A query result in the `error` state when a refetch failed, so the data from before is kept.
 */
interface QueryObserverRefetchErrorResult<TData = unknown, TError = DefaultError> extends QueryObserverBaseResult<TData, TError> {
  /**
   * The data from before the failed refetch, which is kept.
   */
  data: TData;
  /**
   * The error the refetch failed with.
   */
  error: TError;
  /**
   * `true`, since the query is in the `error` state.
   */
  isError: true;
  /**
   * `false`, since the query has data or a query attempt has finished.
   */
  isPending: false;
  /**
   * `false`, since the first fetch isn't in flight.
   */
  isLoading: false;
  /**
   * `false`, since the query didn't fail while fetching for the first time.
   */
  isLoadingError: false;
  /**
   * `true`, since the query failed while refetching.
   */
  isRefetchError: true;
  /**
   * `false`, since the query isn't in the `success` state.
   */
  isSuccess: false;
  /**
   * `false`, since the data shown isn't the `placeholderData`.
   */
  isPlaceholderData: false;
  /**
   * `'error'`, since the query attempt resulted in an error.
   */
  status: 'error';
}
/**
 * A query result in the `success` state with data from the cache.
 */
interface QueryObserverSuccessResult<TData = unknown, TError = DefaultError> extends QueryObserverBaseResult<TData, TError> {
  /**
   * The last successfully resolved data for the query.
   */
  data: TData;
  /**
   * `null`, since the query isn't in the `error` state.
   */
  error: null;
  /**
   * `false`, since the query isn't in the `error` state.
   */
  isError: false;
  /**
   * `false`, since the query has data or a query attempt has finished.
   */
  isPending: false;
  /**
   * `false`, since the first fetch isn't in flight.
   */
  isLoading: false;
  /**
   * `false`, since the query didn't fail while fetching for the first time.
   */
  isLoadingError: false;
  /**
   * `false`, since the query didn't fail while refetching.
   */
  isRefetchError: false;
  /**
   * `true`, since the query is in the `success` state.
   */
  isSuccess: true;
  /**
   * `false`, since the data shown isn't the `placeholderData`.
   */
  isPlaceholderData: false;
  /**
   * `'success'`, since the query has received a response with no errors and is ready to display its
   * data.
   */
  status: 'success';
}
/**
 * A query result in the `success` state that shows `placeholderData` while the query has no data
 * yet.
 */
interface QueryObserverPlaceholderResult<TData = unknown, TError = DefaultError> extends QueryObserverBaseResult<TData, TError> {
  /**
   * The `placeholderData` shown while the query has no data yet.
   */
  data: TData;
  /**
   * `false`, since the query isn't in the `error` state.
   */
  isError: false;
  /**
   * `null`, since the query isn't in the `error` state.
   */
  error: null;
  /**
   * `false`, since the query has data or a query attempt has finished.
   */
  isPending: false;
  /**
   * `false`, since the first fetch isn't in flight.
   */
  isLoading: false;
  /**
   * `false`, since the query didn't fail while fetching for the first time.
   */
  isLoadingError: false;
  /**
   * `false`, since the query didn't fail while refetching.
   */
  isRefetchError: false;
  /**
   * `true`, since the query is in the `success` state.
   */
  isSuccess: true;
  /**
   * `true`, since the data shown is the `placeholderData`.
   */
  isPlaceholderData: true;
  /**
   * `'success'`, since the query has received a response with no errors and is ready to display its
   * data.
   */
  status: 'success';
}
/**
 * A query result that always has `data`: the success and refetch error states.
 */
type DefinedQueryObserverResult<TData = unknown, TError = DefaultError> = QueryObserverRefetchErrorResult<TData, TError> | QueryObserverSuccessResult<TData, TError>;
/**
 * The result of a `QueryObserver`, and of the hooks built on it like `useQuery`. Narrow it by
 * `status` or the `is*` flags to get the type of each state.
 */
type QueryObserverResult<TData = unknown, TError = DefaultError> = DefinedQueryObserverResult<TData, TError> | QueryObserverLoadingErrorResult<TData, TError> | QueryObserverLoadingResult<TData, TError> | QueryObserverPendingResult<TData, TError> | QueryObserverPlaceholderResult<TData, TError>;
/**
 * The properties shared by every state of an infinite query result: those of
 * {@link QueryObserverBaseResult}, plus `fetchNextPage`, `fetchPreviousPage`, and the flags about
 * them, like `hasNextPage` and `isFetchingNextPage`.
 */
interface InfiniteQueryObserverBaseResult<TData = unknown, TError = DefaultError> extends QueryObserverBaseResult<TData, TError> {
  /**
   * This function allows you to fetch the next "page" of results.
   */
  fetchNextPage: (options?: FetchNextPageOptions) => Promise<InfiniteQueryObserverResult<TData, TError>>;
  /**
   * This function allows you to fetch the previous "page" of results.
   */
  fetchPreviousPage: (options?: FetchPreviousPageOptions) => Promise<InfiniteQueryObserverResult<TData, TError>>;
  /**
   * Will be `true` if there is a next page to be fetched (known via the `getNextPageParam` option).
   */
  hasNextPage: boolean;
  /**
   * Will be `true` if there is a previous page to be fetched (known via the `getPreviousPageParam` option).
   */
  hasPreviousPage: boolean;
  /**
   * Will be `true` if the query failed while fetching the next page.
   */
  isFetchNextPageError: boolean;
  /**
   * Will be `true` while fetching the next page with `fetchNextPage`.
   */
  isFetchingNextPage: boolean;
  /**
   * Will be `true` if the query failed while fetching the previous page.
   */
  isFetchPreviousPageError: boolean;
  /**
   * Will be `true` while fetching the previous page with `fetchPreviousPage`.
   */
  isFetchingPreviousPage: boolean;
}
/**
 * An infinite query result in the `pending` state: the query has no data yet.
 */
interface InfiniteQueryObserverPendingResult<TData = unknown, TError = DefaultError> extends InfiniteQueryObserverBaseResult<TData, TError> {
  /**
   * `undefined`, since the query has no data yet.
   */
  data: undefined;
  /**
   * `null`, since the query isn't in the `error` state.
   */
  error: null;
  /**
   * `false`, since the query isn't in the `error` state.
   */
  isError: false;
  /**
   * `true`, since there's no cached data and no query attempt has finished yet.
   */
  isPending: true;
  /**
   * `false`, since the query didn't fail while fetching for the first time.
   */
  isLoadingError: false;
  /**
   * `false`, since the query didn't fail while refetching.
   */
  isRefetchError: false;
  /**
   * `false`, since fetching the next page didn't fail.
   */
  isFetchNextPageError: false;
  /**
   * `false`, since fetching the previous page didn't fail.
   */
  isFetchPreviousPageError: false;
  /**
   * `false`, since the query isn't in the `success` state.
   */
  isSuccess: false;
  /**
   * `false`, since the data shown isn't the `placeholderData`.
   */
  isPlaceholderData: false;
  /**
   * `'pending'`, since there's no cached data and no query attempt has finished yet.
   */
  status: 'pending';
}
/**
 * An infinite query result in the `pending` state while the first fetch is in flight, so
 * `isLoading` is `true`.
 */
interface InfiniteQueryObserverLoadingResult<TData = unknown, TError = DefaultError> extends InfiniteQueryObserverBaseResult<TData, TError> {
  /**
   * `undefined`, since the query has no data yet.
   */
  data: undefined;
  /**
   * `null`, since the query isn't in the `error` state.
   */
  error: null;
  /**
   * `false`, since the query isn't in the `error` state.
   */
  isError: false;
  /**
   * `true`, since there's no cached data and no query attempt has finished yet.
   */
  isPending: true;
  /**
   * `true`, since the first fetch is in flight.
   */
  isLoading: true;
  /**
   * `false`, since the query didn't fail while fetching for the first time.
   */
  isLoadingError: false;
  /**
   * `false`, since the query didn't fail while refetching.
   */
  isRefetchError: false;
  /**
   * `false`, since fetching the next page didn't fail.
   */
  isFetchNextPageError: false;
  /**
   * `false`, since fetching the previous page didn't fail.
   */
  isFetchPreviousPageError: false;
  /**
   * `false`, since the query isn't in the `success` state.
   */
  isSuccess: false;
  /**
   * `false`, since the data shown isn't the `placeholderData`.
   */
  isPlaceholderData: false;
  /**
   * `'pending'`, since there's no cached data and no query attempt has finished yet.
   */
  status: 'pending';
}
/**
 * An infinite query result in the `error` state when the first fetch failed, so there is no data.
 */
interface InfiniteQueryObserverLoadingErrorResult<TData = unknown, TError = DefaultError> extends InfiniteQueryObserverBaseResult<TData, TError> {
  /**
   * `undefined`, since the first fetch failed before any data was cached.
   */
  data: undefined;
  /**
   * The error the first fetch failed with.
   */
  error: TError;
  /**
   * `true`, since the query is in the `error` state.
   */
  isError: true;
  /**
   * `false`, since the query has data or a query attempt has finished.
   */
  isPending: false;
  /**
   * `false`, since the first fetch isn't in flight.
   */
  isLoading: false;
  /**
   * `true`, since the query failed while fetching for the first time.
   */
  isLoadingError: true;
  /**
   * `false`, since the query didn't fail while refetching.
   */
  isRefetchError: false;
  /**
   * `false`, since fetching the next page didn't fail.
   */
  isFetchNextPageError: false;
  /**
   * `false`, since fetching the previous page didn't fail.
   */
  isFetchPreviousPageError: false;
  /**
   * `false`, since the query isn't in the `success` state.
   */
  isSuccess: false;
  /**
   * `false`, since the data shown isn't the `placeholderData`.
   */
  isPlaceholderData: false;
  /**
   * `'error'`, since the query attempt resulted in an error.
   */
  status: 'error';
}
/**
 * An infinite query result in the `error` state when a refetch failed, so the data from before is
 * kept.
 */
interface InfiniteQueryObserverRefetchErrorResult<TData = unknown, TError = DefaultError> extends InfiniteQueryObserverBaseResult<TData, TError> {
  /**
   * The data from before the failed refetch, which is kept.
   */
  data: TData;
  /**
   * The error the refetch failed with.
   */
  error: TError;
  /**
   * `true`, since the query is in the `error` state.
   */
  isError: true;
  /**
   * `false`, since the query has data or a query attempt has finished.
   */
  isPending: false;
  /**
   * `false`, since the first fetch isn't in flight.
   */
  isLoading: false;
  /**
   * `false`, since the query didn't fail while fetching for the first time.
   */
  isLoadingError: false;
  /**
   * `true`, since the query failed while refetching.
   */
  isRefetchError: true;
  /**
   * `false`, since the query isn't in the `success` state.
   */
  isSuccess: false;
  /**
   * `false`, since the data shown isn't the `placeholderData`.
   */
  isPlaceholderData: false;
  /**
   * `'error'`, since the query attempt resulted in an error.
   */
  status: 'error';
}
/**
 * An infinite query result in the `success` state with data from the cache.
 */
interface InfiniteQueryObserverSuccessResult<TData = unknown, TError = DefaultError> extends InfiniteQueryObserverBaseResult<TData, TError> {
  /**
   * The last successfully resolved data for the query.
   */
  data: TData;
  /**
   * `null`, since the query isn't in the `error` state.
   */
  error: null;
  /**
   * `false`, since the query isn't in the `error` state.
   */
  isError: false;
  /**
   * `false`, since the query has data or a query attempt has finished.
   */
  isPending: false;
  /**
   * `false`, since the first fetch isn't in flight.
   */
  isLoading: false;
  /**
   * `false`, since the query didn't fail while fetching for the first time.
   */
  isLoadingError: false;
  /**
   * `false`, since the query didn't fail while refetching.
   */
  isRefetchError: false;
  /**
   * `false`, since fetching the next page didn't fail.
   */
  isFetchNextPageError: false;
  /**
   * `false`, since fetching the previous page didn't fail.
   */
  isFetchPreviousPageError: false;
  /**
   * `true`, since the query is in the `success` state.
   */
  isSuccess: true;
  /**
   * `false`, since the data shown isn't the `placeholderData`.
   */
  isPlaceholderData: false;
  /**
   * `'success'`, since the query has received a response with no errors and is ready to display its
   * data.
   */
  status: 'success';
}
/**
 * An infinite query result in the `success` state that shows `placeholderData` while the query has
 * no data yet.
 */
interface InfiniteQueryObserverPlaceholderResult<TData = unknown, TError = DefaultError> extends InfiniteQueryObserverBaseResult<TData, TError> {
  /**
   * The `placeholderData` shown while the query has no data yet.
   */
  data: TData;
  /**
   * `false`, since the query isn't in the `error` state.
   */
  isError: false;
  /**
   * `null`, since the query isn't in the `error` state.
   */
  error: null;
  /**
   * `false`, since the query has data or a query attempt has finished.
   */
  isPending: false;
  /**
   * `false`, since the first fetch isn't in flight.
   */
  isLoading: false;
  /**
   * `false`, since the query didn't fail while fetching for the first time.
   */
  isLoadingError: false;
  /**
   * `false`, since the query didn't fail while refetching.
   */
  isRefetchError: false;
  /**
   * `true`, since the query is in the `success` state.
   */
  isSuccess: true;
  /**
   * `true`, since the data shown is the `placeholderData`.
   */
  isPlaceholderData: true;
  /**
   * `false`, since fetching the next page didn't fail.
   */
  isFetchNextPageError: false;
  /**
   * `false`, since fetching the previous page didn't fail.
   */
  isFetchPreviousPageError: false;
  /**
   * `'success'`, since the query has received a response with no errors and is ready to display its
   * data.
   */
  status: 'success';
}
/**
 * An infinite query result that always has `data`: the success and refetch error states.
 */
type DefinedInfiniteQueryObserverResult<TData = unknown, TError = DefaultError> = InfiniteQueryObserverRefetchErrorResult<TData, TError> | InfiniteQueryObserverSuccessResult<TData, TError>;
/**
 * The result of an `InfiniteQueryObserver`, and of the hooks built on it like `useInfiniteQuery`.
 * Narrow it by `status` or the `is*` flags to get the type of each state.
 */
type InfiniteQueryObserverResult<TData = unknown, TError = DefaultError> = DefinedInfiniteQueryObserverResult<TData, TError> | InfiniteQueryObserverLoadingErrorResult<TData, TError> | InfiniteQueryObserverLoadingResult<TData, TError> | InfiniteQueryObserverPendingResult<TData, TError> | InfiniteQueryObserverPlaceholderResult<TData, TError>;
/**
 * The type of a mutation key — the serializable array used to identify and filter mutations.
 * Defaults to `ReadonlyArray<unknown>`; declare `mutationKey` on {@link Register} to narrow it repository-wide.
 */
type MutationKey = Register extends {
  mutationKey: infer TMutationKey;
} ? TMutationKey extends ReadonlyArray<unknown> ? TMutationKey : TMutationKey extends Array<unknown> ? TMutationKey : ReadonlyArray<unknown> : ReadonlyArray<unknown>;
/** @inline */
type MutationStatus = 'idle' | 'pending' | 'success' | 'error';
/**
 * Groups mutations so they run one after another instead of in parallel.
 * Mutations that share the same `id` form a queue: while one is running, the others wait in `isPaused: true`
 * state and resume automatically when their turn comes. Mutations with no scope always run in parallel.
 */
type MutationScope = {
  /**
   * The scope's identifier. Mutations with the same `id` run one after another.
   */
  id: string;
};
/**
 * The type of the `meta` object that can be attached to a mutation and read back from `mutationFn`, callbacks and
 * cache-level handlers. Defaults to `Record<string, unknown>`; declare `mutationMeta` on {@link Register} to narrow it.
 */
type MutationMeta = Register extends {
  mutationMeta: infer TMutationMeta;
} ? TMutationMeta extends Record<string, unknown> ? TMutationMeta : Record<string, unknown> : Record<string, unknown>;
/**
 * The object passed to `mutationFn` and the mutation callbacks: the `QueryClient`, the mutation's
 * `meta`, and its `mutationKey`.
 */
type MutationFunctionContext = {
  /**
   * The `QueryClient` the mutation runs in.
   */
  client: QueryClient;
  /**
   * The `meta` of the mutation options.
   */
  meta: MutationMeta | undefined;
  /**
   * The `mutationKey` of the mutation options, if set.
   */
  mutationKey?: MutationKey;
};
/** @inline */
type MutationFunction<TData = unknown, TVariables = unknown> = (variables: TVariables, context: MutationFunctionContext) => Promise<TData>;
/**
 * The options of a mutation: its `mutationFn`, `mutationKey`, callbacks, retries, `scope`, and so
 * on.
 */
interface MutationOptions<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> {
  /**
   * The function that performs the asynchronous task this mutation runs.
   * Required, unless a default mutation function has been set for the matching `mutationKey` via
   * `queryClient.setMutationDefaults`.
   * Receives the `variables` passed to `mutate`, and a {@link MutationFunctionContext} holding the
   * `QueryClient`, the `mutationKey` and `meta`.
   * Must return a promise that resolves the mutation's data.
   */
  mutationFn?: MutationFunction<TData, TVariables>;
  /**
   * The key to use for this mutation. Optional, but required to inherit defaults registered with
   * `queryClient.setMutationDefaults`, and to match this mutation with `useMutationState` or
   * `queryClient.isMutating`.
   */
  mutationKey?: MutationKey;
  /**
   * This function fires before the mutation function runs, and receives the same variables.
   * Useful for optimistic updates applied in the hope that the mutation succeeds.
   * The value it returns is passed to `onSuccess`, `onError` and `onSettled` as `onMutateResult`,
   * which is where an optimistic update is usually rolled back.
   * If a promise is returned, it is awaited before the mutation function runs.
   */
  onMutate?: (variables: TVariables, context: MutationFunctionContext) => Promise<TOnMutateResult> | TOnMutateResult;
  /**
   * This function fires when the mutation succeeds, and is passed the mutation's result.
   * If a promise is returned, it is awaited before `onSettled` runs.
   */
  onSuccess?: (data: TData, variables: TVariables, onMutateResult: TOnMutateResult, context: MutationFunctionContext) => Promise<unknown> | unknown;
  /**
   * This function fires when the mutation encounters an error, and is passed the error.
   * If a promise is returned, it is awaited before `onSettled` runs.
   */
  onError?: (error: TError, variables: TVariables, onMutateResult: TOnMutateResult | undefined, context: MutationFunctionContext) => Promise<unknown> | unknown;
  /**
   * This function fires when the mutation either succeeds or errors, and is passed either the data
   * or the error.
   * If a promise is returned, it is awaited before the mutation settles.
   */
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, onMutateResult: TOnMutateResult | undefined, context: MutationFunctionContext) => Promise<unknown> | unknown;
  /**
   * If `false`, failed mutations will not retry by default.
   * If `true`, failed mutations will retry infinitely.
   * If set to an integer number, e.g. 3, failed mutations will retry until the failed mutation count meets that number.
   * If set to a function `(failureCount, error) => boolean` failed mutations will retry until the function returns false.
   * @defaultValue 0
   */
  retry?: RetryValue<TError>;
  /**
   * This function receives a `retryAttempt` integer and the actual Error and returns the delay to apply before the
   * next attempt in milliseconds.
   *
   * Defaults to a function that applies exponential backoff, capped at 30 seconds.
   */
  retryDelay?: RetryDelayValue<TError>;
  /**
   * Controls whether a mutation is allowed to run based on the current network connectivity.
   * @defaultValue 'online'
   * @see [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) for more information.
   */
  networkMode?: NetworkMode;
  /**
   * The time in milliseconds that an unused/inactive mutation remains in memory before it is
   * garbage collected.
   *
   * Defaults to `5 * 60 * 1000` (5 minutes), or `Infinity` during SSR.
   */
  gcTime?: number;
  /** @internal */
  _defaulted?: boolean;
  /**
   * Additional payload to be stored on the mutation cache entry.
   * Use it to pass information that can be read wherever the `mutation` is available, such as the
   * `onError` and `onSuccess` callbacks of the `MutationCache`.
   */
  meta?: MutationMeta;
  /**
   * Controls whether this mutation runs alongside others or waits its turn.
   * Mutations sharing the same `scope.id` run serially, in the order they were started.
   * Without a scope, a mutation runs as soon as it is triggered.
   */
  scope?: MutationScope;
}
/**
 * The options of a `MutationObserver`, and of the hooks built on it like `useMutation`: the
 * {@link MutationOptions}, plus `throwOnError`.
 */
interface MutationObserverOptions<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> extends MutationOptions<TData, TError, TVariables, TOnMutateResult> {
  /**
   * Whether errors should be thrown instead of setting the `error` property.
   * If set to `true`, all errors will be thrown to the nearest error boundary.
   * If set to a function, it will be passed the error and should return a boolean indicating whether to throw the
   * error (`true`) or return it as state (`false`).
   * @defaultValue false
   */
  throwOnError?: boolean | ((error: TError) => boolean);
}
/**
 * The callbacks that can be passed to `mutate` for a single call. They run after the callbacks of
 * the mutation options.
 */
interface MutateOptions<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> {
  /**
   * Called when the mutation of this call succeeds, after the `onSuccess` of the mutation options.
   */
  onSuccess?: (data: TData, variables: TVariables, onMutateResult: TOnMutateResult | undefined, context: MutationFunctionContext) => void;
  /**
   * Called when the mutation of this call fails, after the `onError` of the mutation options.
   */
  onError?: (error: TError, variables: TVariables, onMutateResult: TOnMutateResult | undefined, context: MutationFunctionContext) => void;
  /**
   * Called when the mutation of this call succeeds or fails, after the `onSettled` of the mutation
   * options.
   */
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, onMutateResult: TOnMutateResult | undefined, context: MutationFunctionContext) => void;
}
/**
 * The parameters of {@link MutateFunction}: `variables`, optional when `TVariables` accepts
 * `undefined`, and the {@link MutateOptions} for that call.
 */
type MutateFunctionRest<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> = undefined extends TVariables ? [variables?: TVariables, options?: MutateOptions<TData, TError, TVariables, TOnMutateResult>] : [variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TOnMutateResult>];
/**
 * The `mutate` function of a `MutationObserver`: runs the mutation with the given variables and
 * resolves with its data.
 */
type MutateFunction<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> = (...rest: MutateFunctionRest<TData, TError, TVariables, TOnMutateResult>) => Promise<TData>;
/**
 * The properties shared by every state of a mutation result, like `data`, `error`, `variables`,
 * `status`, the `is*` flags, `mutate`, and `reset`.
 */
interface MutationObserverBaseResult<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> extends MutationState<TData, TError, TVariables, TOnMutateResult> {
  /**
   * The last successfully resolved data for the mutation.
   */
  data: TData | undefined;
  /**
   * The variables object passed to the `mutationFn`.
   */
  variables: TVariables | undefined;
  /**
   * The error object for the mutation, if an error was encountered.
   * - Defaults to `null`.
   */
  error: TError | null;
  /**
   * A boolean variable derived from `status`.
   * - `true` if the last mutation attempt resulted in an error.
   */
  isError: boolean;
  /**
   * A boolean variable derived from `status`.
   * - `true` if the mutation is in its initial state prior to executing.
   */
  isIdle: boolean;
  /**
   * A boolean variable derived from `status`.
   * - `true` if the mutation is currently executing.
   */
  isPending: boolean;
  /**
   * A boolean variable derived from `status`.
   * - `true` if the last mutation attempt was successful.
   */
  isSuccess: boolean;
  /**
   * The status of the mutation.
   * - Will be:
   *   - `idle` initial status prior to the mutation function executing.
   *   - `pending` if the mutation is currently executing.
   *   - `error` if the last mutation attempt resulted in an error.
   *   - `success` if the last mutation attempt was successful.
   */
  status: MutationStatus;
  /**
   * The mutation function you can call with variables to trigger the mutation and optionally hooks on additional callback options.
   * @param variables - The variables object to pass to the `mutationFn`.
   * @param options.onSuccess - This function will fire when the mutation is successful and will be passed the mutation's result.
   * @param options.onError - This function will fire if the mutation encounters an error and will be passed the error.
   * @param options.onSettled - This function will fire when the mutation is either successfully fetched or encounters an error and be passed either the data or error.
   * @remarks
   * - If you make multiple requests, `onSuccess` will fire only after the latest call you've made.
   * - All the callback functions (`onSuccess`, `onError`, `onSettled`) are void functions, and the returned value will be ignored.
   */
  mutate: MutateFunction<TData, TError, TVariables, TOnMutateResult>;
  /**
   * A function to clean the mutation internal state (i.e., it resets the mutation to its initial state).
   */
  reset: () => void;
}
/**
 * A mutation result in the `idle` state: the mutation hasn't run yet, or was reset.
 */
interface MutationObserverIdleResult<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> extends MutationObserverBaseResult<TData, TError, TVariables, TOnMutateResult> {
  /**
   * `undefined`, since the mutation hasn't run.
   */
  data: undefined;
  /**
   * `undefined`, since the mutation hasn't run.
   */
  variables: undefined;
  /**
   * `null`, since the mutation hasn't failed.
   */
  error: null;
  /**
   * `false`, since the mutation hasn't failed.
   */
  isError: false;
  /**
   * `true`, since the mutation hasn't run yet or was reset.
   */
  isIdle: true;
  /**
   * `false`, since the mutation isn't running.
   */
  isPending: false;
  /**
   * `false`, since the mutation hasn't succeeded.
   */
  isSuccess: false;
  /**
   * `'idle'`, since the mutation hasn't run yet or was reset.
   */
  status: 'idle';
}
/**
 * A mutation result in the `pending` state while the mutation runs.
 */
interface MutationObserverLoadingResult<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> extends MutationObserverBaseResult<TData, TError, TVariables, TOnMutateResult> {
  /**
   * `undefined`, since the mutation hasn't succeeded.
   */
  data: undefined;
  /**
   * The variables passed to `mutate` for this mutation.
   */
  variables: TVariables;
  /**
   * `null`, since the mutation hasn't failed.
   */
  error: null;
  /**
   * `false`, since the mutation hasn't failed.
   */
  isError: false;
  /**
   * `false`, since the mutation has run.
   */
  isIdle: false;
  /**
   * `true`, since the mutation is running.
   */
  isPending: true;
  /**
   * `false`, since the mutation hasn't succeeded.
   */
  isSuccess: false;
  /**
   * `'pending'`, since the mutation is running.
   */
  status: 'pending';
}
/**
 * A mutation result in the `error` state after the mutation failed.
 */
interface MutationObserverErrorResult<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> extends MutationObserverBaseResult<TData, TError, TVariables, TOnMutateResult> {
  /**
   * `undefined`, since the mutation hasn't succeeded.
   */
  data: undefined;
  /**
   * The error the mutation failed with.
   */
  error: TError;
  /**
   * The variables passed to `mutate` for this mutation.
   */
  variables: TVariables;
  /**
   * `true`, since the mutation failed.
   */
  isError: true;
  /**
   * `false`, since the mutation has run.
   */
  isIdle: false;
  /**
   * `false`, since the mutation isn't running.
   */
  isPending: false;
  /**
   * `false`, since the mutation hasn't succeeded.
   */
  isSuccess: false;
  /**
   * `'error'`, since the mutation failed.
   */
  status: 'error';
}
/**
 * A mutation result in the `success` state after the mutation succeeded.
 */
interface MutationObserverSuccessResult<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> extends MutationObserverBaseResult<TData, TError, TVariables, TOnMutateResult> {
  /**
   * The data the mutation resolved with.
   */
  data: TData;
  /**
   * `null`, since the mutation hasn't failed.
   */
  error: null;
  /**
   * The variables passed to `mutate` for this mutation.
   */
  variables: TVariables;
  /**
   * `false`, since the mutation hasn't failed.
   */
  isError: false;
  /**
   * `false`, since the mutation has run.
   */
  isIdle: false;
  /**
   * `false`, since the mutation isn't running.
   */
  isPending: false;
  /**
   * `true`, since the mutation succeeded.
   */
  isSuccess: true;
  /**
   * `'success'`, since the mutation succeeded.
   */
  status: 'success';
}
/**
 * The result of a `MutationObserver`, and of the hooks built on it like `useMutation`. Narrow it by
 * `status` or the `is*` flags to get the type of each state.
 */
type MutationObserverResult<TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown> = MutationObserverIdleResult<TData, TError, TVariables, TOnMutateResult> | MutationObserverLoadingResult<TData, TError, TVariables, TOnMutateResult> | MutationObserverErrorResult<TData, TError, TVariables, TOnMutateResult> | MutationObserverSuccessResult<TData, TError, TVariables, TOnMutateResult>;
/**
 * The options of `new QueryClient()`: the `queryCache` and `mutationCache` to use, and the
 * `defaultOptions` for its queries and mutations.
 */
interface QueryClientConfig {
  /** The query cache this client is connected to. A new `QueryCache` is created if not provided. */
  queryCache?: QueryCache;
  /**
   * The mutation cache this client is connected to. A new `MutationCache` is created if not
   * provided.
   */
  mutationCache?: MutationCache;
  /** Default options for all queries and mutations created through this client. */
  defaultOptions?: DefaultOptions;
}
/**
 * The default options of a `QueryClient`, applied to every query (`queries`), mutation
 * (`mutations`), `hydrate`, and `dehydrate` call unless overridden.
 */
interface DefaultOptions<TError = DefaultError> {
  /** Default options applied to every query, unless overridden per-query. */
  queries?: OmitKeyof<QueryObserverOptions<unknown, TError>, 'suspense' | 'queryKey'>;
  /** Default options applied to every mutation, unless overridden per-mutation. */
  mutations?: MutationObserverOptions<unknown, TError, unknown, unknown>;
  /** Default options used when hydrating queries and mutations; see {@link HydrateOptions}. */
  hydrate?: HydrateOptions['defaultOptions'];
  /** Default options used when dehydrating the client's caches; see {@link DehydrateOptions}. */
  dehydrate?: DehydrateOptions;
}
/**
 * Options for cancelling an in-flight fetch, e.g. via `query.cancel()`.
 * They are carried on the {@link CancelledError} that the cancelled fetch rejects with.
 */
interface CancelOptions {
  /**
   * If `true`, the query goes back to the state it had before the fetch started, instead of getting
   * the cancellation error.
   */
  revert?: boolean;
  /**
   * If `true`, the cancellation error isn't surfaced, e.g. because another fetch replaces the
   * cancelled one.
   */
  silent?: boolean;
}
/**
 * Options for writing data into the cache, e.g. via `queryClient.setQueryData()`.
 * `updatedAt` overrides the timestamp the data is recorded with, which is what staleness is measured from;
 * omit it to use the current time.
 */
interface SetDataOptions {
  /**
   * The timestamp to record the data with, instead of the current time. Staleness is measured from
   * it.
   */
  updatedAt?: number;
}
/** @inline */
type NotifyEventType = 'added' | 'removed' | 'updated' | 'observerAdded' | 'observerRemoved' | 'observerResultsUpdated' | 'observerOptionsUpdated';
/**
 * The base shape of the events that the query and mutation caches send to their listeners.
 */
interface NotifyEvent {
  /**
   * The kind of event, e.g. `'added'`, `'removed'`, or `'updated'`.
   */
  type: NotifyEventType;
}
//#endregion
//#region src/hydration.d.ts
type TransformerFn = (data: any) => any;
/**
 * Options for `dehydrate`, controlling which queries/mutations are included in the resulting `DehydratedState` and
 * how their data/errors are transformed before being serialized (e.g. for embedding in server-rendered markup).
 */
interface DehydrateOptions {
  /** Transforms a query's `data` before it is dehydrated. Useful for non-JSON-serializable data. */
  serializeData?: TransformerFn;
  /** Predicate to decide whether a given `Mutation` should be dehydrated. Defaults to `defaultShouldDehydrateMutation`. */
  shouldDehydrateMutation?: (mutation: Mutation) => boolean;
  /** Predicate to decide whether a given `Query` should be dehydrated. Defaults to `defaultShouldDehydrateQuery`. */
  shouldDehydrateQuery?: (query: Query) => boolean;
  /**
   * Predicate to decide whether a query's error should be redacted before dehydration. Errors are redacted
   * (replaced with a generic `Error('redacted')`) unless this function is provided and returns `false` for the
   * given error, in which case the original error is kept.
   */
  shouldRedactErrors?: (error: unknown) => boolean;
}
/**
 * Options for `hydrate`, controlling the default options applied to queries/mutations restored from a
 * `DehydratedState`, and how to reverse any transformation applied by `DehydrateOptions.serializeData`.
 */
interface HydrateOptions {
  /** Options applied to the queries and mutations restored from the dehydrated state. */
  defaultOptions?: {
    /** Transforms a query's `data` after it is read from the dehydrated state, reversing `serializeData`. */
    deserializeData?: TransformerFn;
    /** Default options merged into every query restored from the dehydrated state. */
    queries?: QueryOptions;
    /** Default options merged into every mutation restored from the dehydrated state. */
    mutations?: MutationOptions<unknown, DefaultError, unknown, unknown>;
  };
}
interface DehydratedMutation {
  mutationKey?: MutationKey;
  state: MutationState;
  meta?: MutationMeta;
  scope?: MutationScope;
}
interface DehydratedQuery {
  queryHash: string;
  queryKey: QueryKey;
  state: QueryState;
  dehydratedAt: number;
  promise?: Promise<unknown>;
  meta?: QueryMeta;
  queryType?: 'infinite';
}
/**
 * A serializable snapshot of a `QueryClient`'s cache, as produced by `dehydrate` and consumed by `hydrate`. Typically
 * transported from server to client (e.g. embedded in server-rendered markup) to seed the client's cache with data
 * that has already been fetched, avoiding a redundant fetch on the client.
 */
interface DehydratedState {
  /**
   * The dehydrated mutations, by default only the paused ones.
   */
  mutations: Array<DehydratedMutation>;
  /**
   * The dehydrated queries, by default only the successful ones.
   */
  queries: Array<DehydratedQuery>;
}
/**
 * Dehydrates a single `Query` into a serializable `DehydratedQuery` snapshot. Note that most query config (e.g.
 * `queryFn`, `staleTime`) is not dehydrated but instead meant to be configured again when consuming the
 * de/rehydrated data, typically with `useQuery` on the client. If the query is still `pending`, its in-flight
 * promise is dehydrated too so it can be resumed on the other side instead of re-fetched.
 * @param query - The query to dehydrate.
 * @param serializeData - Optional transform applied to `query.state.data` before it is included in the snapshot.
 * @param shouldRedactErrors - Optional predicate; if it returns `false` for the promise's rejection error, that
 * error is kept as-is instead of being redacted.
 * @returns The dehydrated query.
 */
declare function dehydrateQuery(query: Query, serializeData?: TransformerFn, shouldRedactErrors?: (error: unknown) => boolean): DehydratedQuery;
/**
 * The default `shouldDehydrateMutation` predicate used by `dehydrate`. Only dehydrates mutations that are
 * currently paused (e.g. paused by `networkMode` while offline).
 * @param mutation - The mutation to check.
 * @returns `true` if the mutation is paused.
 */
declare function defaultShouldDehydrateMutation(mutation: Mutation): boolean;
/**
 * The default `shouldDehydrateQuery` predicate used by `dehydrate`. Only dehydrates queries whose status is
 * `'success'`.
 * @param query - The query to check.
 * @returns `true` if the query's status is `'success'`.
 */
declare function defaultShouldDehydrateQuery(query: Query): boolean;
/**
 * Dehydrates a `QueryClient`'s cache (queries and mutations) into a plain, serializable `DehydratedState`,
 * typically to embed in server-rendered markup and later restore into a client-side `QueryClient` via `hydrate`.
 * Which queries/mutations are included, and how their data/errors are transformed, is controlled by `options`,
 * falling back to the client's `dehydrate` default options, and finally to `defaultShouldDehydrateQuery` /
 * `defaultShouldDehydrateMutation`.
 * @param client - The client whose cache is dehydrated.
 * @param options - Controls which queries and mutations are included and how their data and errors
 * are transformed. Each option falls back to the client's `defaultOptions.dehydrate`.
 * @returns The dehydrated state, with the included `queries` and `mutations`.
 * @example
 * ```ts
 * const queryClient = new QueryClient()
 *
 * await queryClient.prefetchQuery({
 *   queryKey: ['posts'],
 *   queryFn: getPosts,
 * })
 *
 * const dehydratedState = dehydrate(queryClient)
 * ```
 */
declare function dehydrate(client: QueryClient, options?: DehydrateOptions): DehydratedState;
/**
 * Restores a `DehydratedState` (as produced by `dehydrate`) into a `QueryClient`'s cache, typically to seed the
 * client with data already fetched on the server. `mutations` and `queries` are each optional on `dehydratedState`.
 * Queries not yet in the cache are built from the dehydrated snapshot; queries that already exist are only updated
 * when the dehydrated data is newer than what's already cached. Newly built queries have their `fetchStatus` reset
 * to `'idle'` so they don't hydrate stuck in a fetching state. If a dehydrated query still had an in-flight
 * promise, it is resumed via `query.fetch()` (reusing that promise as `initialPromise`) rather than re-invoking
 * `queryFn`.
 * @param client - The client whose cache is restored into.
 * @param dehydratedState - The dehydrated state, e.g. produced by `dehydrate` on the server.
 * @param options - `defaultOptions` merged into every restored query and mutation (on top of the
 * client's `defaultOptions.hydrate`), and `deserializeData` to reverse `serializeData`.
 * @example
 * ```ts
 * // dehydratedState was produced by `dehydrate` on the server
 * // and sent to the client, e.g. embedded in server-rendered markup.
 * const queryClient = new QueryClient()
 *
 * hydrate(queryClient, dehydratedState)
 * ```
 */
declare function hydrate(client: QueryClient, dehydratedState: Partial<DehydratedState>, options?: HydrateOptions): void;
//#endregion
export { MutationObserverBaseResult as $, Query as $n, CancelledError as $t, InfiniteData as A, noop as An, QueryObserverOptions as At, InfiniteQueryObserverSuccessResult as B, Action as Bn, RefetchQueryFilters as Bt, FetchPreviousPageOptions as C, isPlainArray as Cn, QueryKey as Ct, GetPreviousPageParamFunction as D, keepPreviousData as Dn, QueryObserverBaseResult as Dt, GetNextPageParamFunction as E, isValidTimeout as En, QueryMeta as Et, InfiniteQueryObserverOptions as F, shallowEqualObjects as Fn, QueryObserverSuccessResult as Ft, InvalidateQueryFilters as G, MutationCacheConfig as Gn, StaleTime as Gt, InitialDataFunction as H, MutationState as Hn, ResetOptions as Ht, InfiniteQueryObserverPendingResult as I, shouldThrowError as In, QueryOptions as It, MutateOptions as J, Action$1 as Jn, UnsetMarker as Jt, MutateFunction as K, MutationCacheNotifyEvent as Kn, StaleTimeFunction as Kt, InfiniteQueryObserverPlaceholderResult as L, skipToken as Ln, QueryPersister as Lt, InfiniteQueryObserverBaseResult as M, replaceData as Mn, QueryObserverPlaceholderResult as Mt, InfiniteQueryObserverLoadingErrorResult as N, replaceEqualDeep as Nn, QueryObserverRefetchErrorResult as Nt, InferDataFromTag as O, matchMutation as On, QueryObserverLoadingErrorResult as Ot, InfiniteQueryObserverLoadingResult as P, resolveQueryValue as Pn, QueryObserverResult as Pt, MutationMeta as Q, FetchOptions as Qn, unsetMarker as Qt, InfiniteQueryObserverRefetchErrorResult as R, sleep as Rn, QueryStatus as Rt, FetchNextPageOptions as S, hashQueryKeyByOptions as Sn, QueryFunctionContext as St, FetchStatus as T, isServer as Tn, QueryKeyWithDataTag as Tt, InitialPageParam as U, getDefaultState as Un, ResultOptions as Ut, InfiniteQueryPageParamsOptions as V, Mutation as Vn, Register as Vt, InvalidateOptions as W, MutationCache as Wn, SetDataOptions as Wt, MutationFunctionContext as X, FetchDirection as Xn, dataTagErrorSymbol as Xt, MutationFunction as Y, FetchContext as Yn, WithRequired as Yt, MutationKey as Z, FetchMeta as Zn, dataTagSymbol as Zt, DefinedQueryObserverResult as _, addToEnd as _n, QueriesPlaceholderDataFunction as _t, defaultShouldDehydrateQuery as a, isCancelledError as an, MutationObserverSuccessResult as at, EnsureQueryDataOptions as b, functionalUpdate as bn, QueryExecuteOptions as bt, hydrate as c, QueryCacheConfig as cn, MutationStatus as ct, DataTag as d, MutationFilters as dn, NotifyEvent as dt, RetryDelayValue as en, QueryBehavior as er, MutationObserverErrorResult as et, DefaultError as f, QueryFilters as fn, NotifyEventType as ft, DefinedInfiniteQueryObserverResult as g, addConsumeAwareSignal as gn, PlaceholderDataFunction as gt, DefaultedQueryObserverOptions as h, Updater as hn, Override as ht, defaultShouldDehydrateMutation as i, createRetryer as in, MutationObserverResult as it, InfiniteQueryExecuteOptions as j, partialMatchKey as jn, QueryObserverPendingResult as jt, InferErrorFromTag as k, matchQuery as kn, QueryObserverLoadingResult as kt, AnyDataTag as l, QueryCacheNotifyEvent as ln, NetworkMode as lt, DefaultedInfiniteQueryObserverOptions as m, SkipToken as mn, OmitKeyof as mt, DehydratedState as n, Retryer as nn, fetchState as nr, MutationObserverLoadingResult as nt, dehydrate as o, QueryClient as on, MutationOptions as ot, DefaultOptions as p, QueryTypeFilter as pn, NotifyOnChangeProps as pt, MutateFunctionRest as q, MutationObserver as qn, ThrowOnError as qt, HydrateOptions as r, canFetch as rn, QueryObserver as rr, MutationObserverOptions as rt, dehydrateQuery as s, QueryCache as sn, MutationScope as st, DehydrateOptions as t, RetryValue as tn, QueryState as tr, MutationObserverIdleResult as tt, CancelOptions as u, QueryStore as un, NonUndefinedGuard as ut, DistributiveOmit as v, addToStart as vn, QueryBooleanOption as vt, FetchQueryOptions as w, isPlainObject as wn, QueryKeyHashFunction as wt, FetchInfiniteQueryOptions as x, hashKey as xn, QueryFunction as xt, EnsureInfiniteQueryDataOptions as y, ensureQueryFn as yn, QueryClientConfig as yt, InfiniteQueryObserverResult as z, timeUntilStale as zn, RefetchOptions as zt };
//# sourceMappingURL=hydration-Bf0oMcwO.d.ts.map