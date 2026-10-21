//#region src/removable.d.ts
/**
 * The base class for cache entries that are garbage collected once nothing is using them —
 * `Query` and `Mutation` both extend it. `gcTime` controls how long an unused entry is kept.
 */
declare abstract class Removable {
  #private;
  gcTime: number;
  /**
   * Clears the pending garbage collection timeout, so the entry is no longer scheduled for removal.
   * A subclass may override this to release what it holds on to as well — `Query` also cancels any
   * in-flight fetch.
   */
  destroy(): void;
  /**
   * Schedules the entry to be removed from its cache after `gcTime`, replacing any timeout scheduled
   * before. Nothing is scheduled if `gcTime` is `Infinity`.
   */
  protected scheduleGc(): void;
  /**
   * Updates `gcTime`, keeping the longest one seen so far. Without a value, it defaults to 5 minutes
   * on the client and `Infinity` on the server.
   * @param newGcTime - The `gcTime` from the latest options, if any.
   */
  protected updateGcTime(newGcTime: number | undefined): void;
  /**
   * Cancels the scheduled removal, if there is one.
   */
  protected clearGcTimeout(): void;
  /**
   * Called when the garbage collection timeout fires. Subclasses remove the entry from its cache
   * unless it is still in use, e.g. because it has observers.
   */
  protected abstract optionalRemove(): void;
}
//#endregion
export { Removable as t };
//# sourceMappingURL=removable-Cw9GNGyK.d.ts.map