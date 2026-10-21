Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/suspense.ts
/**
* The default `throwOnError` of the suspense hooks: throws the error to the nearest error boundary
* only if the query has no data to show.
* @param _error - The error of the query. Unused.
* @param query - The query that errored.
* @returns `true` if the query has no data.
*/
const defaultThrowOnError = (_error, query) => query.state.data === void 0;
/**
* Raises `staleTime` and a numeric `gcTime` to at least 1000ms when `suspense` is enabled, so a
* component that remounts after suspending doesn't refetch right away or find the query garbage
* collected. A `'static'` `staleTime` is kept as is. Mutates the options.
* @param defaultedOptions - The defaulted query options to adjust.
*/
const ensureSuspenseTimers = (defaultedOptions) => {
	if (defaultedOptions.suspense) {
		const MIN_SUSPENSE_TIME_MS = 1e3;
		const clamp = (value) => value === "static" ? value : Math.max(value ?? MIN_SUSPENSE_TIME_MS, MIN_SUSPENSE_TIME_MS);
		const originalStaleTime = defaultedOptions.staleTime;
		defaultedOptions.staleTime = typeof originalStaleTime === "function" ? (...args) => clamp(originalStaleTime(...args)) : clamp(originalStaleTime);
		if (typeof defaultedOptions.gcTime === "number") defaultedOptions.gcTime = Math.max(defaultedOptions.gcTime, MIN_SUSPENSE_TIME_MS);
	}
};
/**
* Checks whether a query should suspend: `suspense` is enabled and the result is still `pending`.
* @param defaultedOptions - The defaulted query options, if any.
* @param result - The current result of the observer.
* @returns `true` if the component should suspend.
*/
const shouldSuspend = (defaultedOptions, result) => defaultedOptions?.suspense && result.isPending;
/**
* Fetches the query for a suspending component, without affecting the observer's own result. If
* the fetch fails, the reset state of the error boundary is cleared, so the error is thrown to it.
* @param defaultedOptions - The defaulted query options to fetch with.
* @param observer - The observer of the query.
* @param errorResetBoundary - The value of the nearest `QueryErrorResetBoundary`.
* @returns A promise that resolves once the fetch settles. It never rejects.
*/
const fetchOptimistic = (defaultedOptions, observer, errorResetBoundary) => observer.fetchOptimistic(defaultedOptions).catch(() => {
	errorResetBoundary.clearReset();
});
//#endregion
exports.defaultThrowOnError = defaultThrowOnError;
exports.ensureSuspenseTimers = ensureSuspenseTimers;
exports.fetchOptimistic = fetchOptimistic;
exports.shouldSuspend = shouldSuspend;

//# sourceMappingURL=suspense.cjs.map