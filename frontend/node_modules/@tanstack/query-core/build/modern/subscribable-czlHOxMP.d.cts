//#region src/subscribable.d.ts
/**
 * The base class behind everything in Query that you can subscribe to: `QueryCache`, `MutationCache`,
 * the observers, and the `FocusManager`/`OnlineManager` behind `focusManager` and `onlineManager`.
 * Subclasses decide what a listener receives and when it is called.
 */
declare class Subscribable<TListener extends Function> {
  protected listeners: Set<TListener>;
  constructor();
  /**
   * Registers a listener to be called on every update this object notifies about. Returns a function
   * that removes the listener again — call it to stop listening. The base class never drops a listener
   * on its own, though some subclasses clear all of theirs in `destroy()`.
   * @param listener - Called on each update, with whatever the subclass passes to its subscribers.
   * @returns A function that removes the listener.
   * @example
   * ```ts
   * const unsubscribe = subscribable.subscribe(() => {
   *   // react to the update
   * })
   *
   * unsubscribe()
   * ```
   */
  subscribe(listener: TListener): () => void;
  /**
   * Returns `true` while at least one listener is registered, `false` once they have all unsubscribed.
   * @returns `true` if at least one listener is registered.
   */
  hasListeners(): boolean;
  /**
   * Called after a listener is added. Does nothing here; subclasses override it, e.g. to start
   * tracking what they observe once the first listener subscribes.
   */
  protected onSubscribe(): void;
  /**
   * Called after a listener is removed. Does nothing here; subclasses override it, e.g. to clean up
   * once the last listener unsubscribes.
   */
  protected onUnsubscribe(): void;
}
//#endregion
export { Subscribable as t };
//# sourceMappingURL=subscribable-czlHOxMP.d.cts.map