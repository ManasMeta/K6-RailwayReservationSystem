"use client";
import * as React from "react";
import { shouldThrowError } from "@tanstack/query-core";
//#region src/errorBoundaryUtils.ts
/**
* Turns off `retryOnMount` for a query that throws its errors (with `suspense` or `throwOnError`),
* unless the error boundary has been reset, so a remount doesn't retry the failed query before the
* user resets the boundary. Mutates the options.
* @param options - The defaulted query options to adjust.
* @param errorResetBoundary - The value of the nearest `QueryErrorResetBoundary`.
* @param query - The query, used to evaluate a `throwOnError` function against its error.
*/
const ensurePreventErrorBoundaryRetry = (options, errorResetBoundary, query) => {
	const throwOnError = query?.state.status === "error" && typeof options.throwOnError === "function" ? shouldThrowError(options.throwOnError, [query.state.error, query]) : options.throwOnError;
	if (options.suspense || throwOnError) {
		if (!errorResetBoundary.isReset()) options.retryOnMount = false;
	}
};
/**
* Clears the reset state of the error boundary after the component mounts, so later errors are
* thrown to the boundary again.
* @param errorResetBoundary - The value of the nearest `QueryErrorResetBoundary`.
*/
const useClearResetErrorBoundary = (errorResetBoundary) => {
	React.useEffect(() => {
		errorResetBoundary.clearReset();
	}, [errorResetBoundary]);
};
/**
* Checks whether the query error should be thrown to the nearest error boundary: the query errored
* and isn't fetching, the boundary hasn't been reset, and either `suspense` is enabled with no data
* or `throwOnError` says so.
* @param params - The observer `result`, the `errorResetBoundary`, the `throwOnError` option, the
* `query`, and the `suspense` option.
* @returns `true` if the error should be thrown.
*/
const getHasError = ({ result, errorResetBoundary, throwOnError, query, suspense }) => {
	return result.isError && !errorResetBoundary.isReset() && !result.isFetching && query && (suspense && result.data === void 0 || shouldThrowError(throwOnError, [result.error, query]));
};
//#endregion
export { ensurePreventErrorBoundaryRetry, getHasError, useClearResetErrorBoundary };

//# sourceMappingURL=errorBoundaryUtils.js.map