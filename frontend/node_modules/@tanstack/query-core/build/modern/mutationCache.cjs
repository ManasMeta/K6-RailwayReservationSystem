Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_utils = require("./utils.cjs");
const require_subscribable = require("./subscribable.cjs");
const require_notifyManager = require("./notifyManager.cjs");
const require_mutation = require("./mutation.cjs");
//#region src/mutationCache.ts
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
var MutationCache = class extends require_subscribable.Subscribable {
	#mutations;
	#scopes;
	#mutationId;
	constructor(config = {}) {
		super();
		this.config = config;
		this.#mutations = /* @__PURE__ */ new Set();
		this.#scopes = /* @__PURE__ */ new Map();
		this.#mutationId = 0;
	}
	/**
	* Creates a mutation and adds it to the cache.
	* @internal
	* @param client - The client the mutation belongs to, used to default its options.
	* @param options - The mutation options. They are defaulted with {@link
	* QueryClient#defaultMutationOptions}.
	* @param state - The initial state of the mutation, e.g. when restoring a dehydrated mutation.
	* @returns The new mutation, already added to the cache.
	*/
	build(client, options, state) {
		const mutation = new require_mutation.Mutation({
			client,
			mutationCache: this,
			mutationId: ++this.#mutationId,
			options: client.defaultMutationOptions(options),
			state
		});
		this.add(mutation);
		return mutation;
	}
	/**
	* Adds a mutation to the cache.
	* @internal
	* @param mutation - The mutation to add. If it has a `scope`, it is queued in that scope.
	*/
	add(mutation) {
		this.#mutations.add(mutation);
		const scope = scopeFor(mutation);
		if (typeof scope === "string") {
			const scopedMutations = this.#scopes.get(scope);
			if (scopedMutations) scopedMutations.push(mutation);
			else this.#scopes.set(scope, [mutation]);
		}
		this.notify({
			type: "added",
			mutation
		});
	}
	/**
	* Removes a mutation from the cache.
	* @internal
	* @param mutation - The mutation to remove, also from its scope's queue.
	*/
	remove(mutation) {
		if (this.#mutations.delete(mutation)) {
			const scope = scopeFor(mutation);
			if (typeof scope === "string") {
				const scopedMutations = this.#scopes.get(scope);
				if (scopedMutations) {
					if (scopedMutations.length > 1) {
						const index = scopedMutations.indexOf(mutation);
						if (index !== -1) scopedMutations.splice(index, 1);
					} else if (scopedMutations[0] === mutation) this.#scopes.delete(scope);
				}
			}
		}
		this.notify({
			type: "removed",
			mutation
		});
	}
	/**
	* Checks whether a mutation can run now, given the other mutations in its `scope`.
	* @internal
	* @param mutation - The mutation to check.
	* @returns `true` if the mutation has no `scope`, or no other mutation in its scope is pending
	* ahead of it.
	*/
	canRun(mutation) {
		const scope = scopeFor(mutation);
		if (typeof scope === "string") {
			const firstPendingMutation = this.#scopes.get(scope)?.find((m) => m.state.status === "pending");
			return !firstPendingMutation || firstPendingMutation === mutation;
		} else return true;
	}
	/**
	* Continues the next paused mutation in the same `scope` after a mutation finishes.
	* @internal
	* @param mutation - The mutation that finished.
	* @returns A promise that resolves once the next paused mutation in the same scope has continued,
	* or immediately if there is none.
	*/
	runNext(mutation) {
		const scope = scopeFor(mutation);
		if (typeof scope === "string") return (this.#scopes.get(scope)?.find((m) => m !== mutation && m.state.isPaused))?.continue() ?? Promise.resolve();
		else return Promise.resolve();
	}
	/**
	* Removes all mutations from the cache.
	* @example
	* ```ts
	* const mutationCache = queryClient.getMutationCache()
	*
	* mutationCache.clear()
	* ```
	*/
	clear() {
		require_notifyManager.notifyManager.batch(() => {
			const mutations = this.getAll();
			this.#mutations.clear();
			this.#scopes.clear();
			mutations.forEach((mutation) => {
				this.notify({
					type: "removed",
					mutation
				});
			});
		});
	}
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
	getAll() {
		return Array.from(this.#mutations);
	}
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
	find(filters) {
		const defaultedFilters = {
			exact: true,
			...filters
		};
		return this.getAll().find((mutation) => require_utils.matchMutation(defaultedFilters, mutation));
	}
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
	findAll(filters = {}) {
		return this.getAll().filter((mutation) => require_utils.matchMutation(filters, mutation));
	}
	/**
	* Notifies every cache listener of an event, in one batch.
	* @internal
	* @param event - The event passed to every listener.
	*/
	notify(event) {
		require_notifyManager.notifyManager.batch(() => {
			this.listeners.forEach((listener) => {
				listener(event);
			});
		});
	}
	/**
	* Continues every paused mutation, e.g. when the app comes back online.
	* @internal
	* @returns A promise that resolves once every paused mutation has continued and settled.
	*/
	resumePausedMutations() {
		const pausedMutations = this.getAll().filter((x) => x.state.isPaused);
		return require_notifyManager.notifyManager.batch(() => Promise.all(pausedMutations.map((mutation) => mutation.continue().catch(require_utils.noop))));
	}
};
/**
* Returns the scope id of a mutation, used to run mutations with the same scope one after another.
* @param mutation - The mutation to read the scope of.
* @returns The mutation's `scope.id`, or `undefined` if it has no scope.
*/
function scopeFor(mutation) {
	return mutation.options.scope?.id;
}
//#endregion
exports.MutationCache = MutationCache;

//# sourceMappingURL=mutationCache.cjs.map