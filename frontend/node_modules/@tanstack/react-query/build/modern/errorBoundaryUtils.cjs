"use client";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_rolldown_runtime = require("./rolldown-runtime-VH7oDXx4.cjs");
let react = require("react");
react = require_rolldown_runtime.__toESM(react, 1);
let _tanstack_query_core = require("@tanstack/query-core");
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
	const throwOnError = query?.state.status === "error" && typeof options.throwOnError === "function" ? (0, _tanstack_query_core.shouldThrowError)(options.throwOnError, [query.state.error, query]) : options.throwOnError;
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
	react.useEffect(() => {
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
	return result.isError && !errorResetBoundary.isReset() && !result.isFetching && query && (suspense && result.data === void 0 || (0, _tanstack_query_core.shouldThrowError)(throwOnError, [result.error, query]));
};
//#endregion
exports.ensurePreventErrorBoundaryRetry = ensurePreventErrorBoundaryRetry;
exports.getHasError = getHasError;
exports.useClearResetErrorBoundary = useClearResetErrorBoundary;

//# sourceMappingURL=errorBoundaryUtils.cjs.map