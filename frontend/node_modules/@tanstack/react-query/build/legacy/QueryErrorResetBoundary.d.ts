import * as React from "react";
//#region src/QueryErrorResetBoundary.d.ts
/**
 * Resets any query errors within the boundary, so queries know they can try again.
 */
export type QueryErrorResetFunction = () => void;
/**
 * Returns whether the boundary has been reset and not yet cleared.
 */
export type QueryErrorIsResetFunction = () => boolean;
/**
 * Clears the reset state, so queries know not to try again until the boundary is reset again.
 */
export type QueryErrorClearResetFunction = () => void;
/**
 * The value a `QueryErrorResetBoundary` shares through context, used to reset query errors within
 * it and to check whether a reset was requested.
 */
export interface QueryErrorResetBoundaryValue {
  /**
   * Clears the reset state, so queries know not to try again until the boundary is reset again.
   */
  clearReset: QueryErrorClearResetFunction;
  /**
   * Returns whether the boundary has been reset and not yet cleared.
   */
  isReset: QueryErrorIsResetFunction;
  /**
   * Resets any query errors within the boundary, so queries know they can try again.
   */
  reset: QueryErrorResetFunction;
}
/**
 * This hook will reset any query errors within the closest `QueryErrorResetBoundary`. If there is no boundary
 * defined it will reset them globally.
 * @returns The boundary's {@link QueryErrorResetBoundaryValue}.
 * @example
 * ```tsx
 * import { ErrorBoundary } from 'react-error-boundary'
 * import { useQueryErrorResetBoundary } from '@tanstack/react-query'
 *
 * function App({ children }: { children: React.ReactNode }) {
 *   const { reset } = useQueryErrorResetBoundary()
 *
 *   return (
 *     <ErrorBoundary
 *       onReset={reset}
 *       fallbackRender={({ resetErrorBoundary }) => (
 *         <div>
 *           There was an error!
 *           <button onClick={() => resetErrorBoundary()}>Try again</button>
 *         </div>
 *       )}
 *     >
 *       {children}
 *     </ErrorBoundary>
 *   )
 * }
 * ```
 */
export declare const useQueryErrorResetBoundary: () => QueryErrorResetBoundaryValue;
/**
 * A render-prop function usable as `children` on `QueryErrorResetBoundary`.
 * @param value - The boundary's {@link QueryErrorResetBoundaryValue}.
 * @returns The children to render.
 */
export type QueryErrorResetBoundaryFunction = (value: QueryErrorResetBoundaryValue) => React.ReactNode;
/**
 * The props accepted by `QueryErrorResetBoundary`.
 */
export interface QueryErrorResetBoundaryProps {
  /**
   * Either a plain node, or a function that receives the boundary's {@link QueryErrorResetBoundaryValue} and
   * returns a node.
   */
  children: QueryErrorResetBoundaryFunction | React.ReactNode;
}
/**
 * When using `suspense` or `throwOnError` in your queries, you need a way to let queries know that you want to
 * try again when re-rendering after some error occurred. With the `QueryErrorResetBoundary` component you can
 * reset any query errors within the boundaries of the component.
 * @param props - The `children` to render.
 * @returns The `children`, rendered as-is, or called with the boundary's {@link QueryErrorResetBoundaryValue}
 * if `children` is a function.
 * @example
 * ```tsx
 * import { ErrorBoundary } from 'react-error-boundary'
 * import { QueryErrorResetBoundary } from '@tanstack/react-query'
 *
 * function App() {
 *   return (
 *     <QueryErrorResetBoundary>
 *       {({ reset }) => (
 *         <ErrorBoundary
 *           onReset={reset}
 *           fallbackRender={({ resetErrorBoundary }) => (
 *             <div>
 *               There was an error!
 *               <button onClick={() => resetErrorBoundary()}>Try again</button>
 *             </div>
 *           )}
 *         >
 *           <Page />
 *         </ErrorBoundary>
 *       )}
 *     </QueryErrorResetBoundary>
 *   )
 * }
 * ```
 */
export declare const QueryErrorResetBoundary: ({ children }: QueryErrorResetBoundaryProps) => import("react/jsx-runtime").JSX.Element;
//#endregion
//# sourceMappingURL=QueryErrorResetBoundary.d.ts.map