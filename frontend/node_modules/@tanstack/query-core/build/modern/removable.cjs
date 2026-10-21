Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_timeoutManager = require("./timeoutManager.cjs");
const require_utils = require("./utils.cjs");
const require_environmentManager = require("./environmentManager.cjs");
//#region src/removable.ts
/**
* The base class for cache entries that are garbage collected once nothing is using them —
* `Query` and `Mutation` both extend it. `gcTime` controls how long an unused entry is kept.
*/
var Removable = class {
	#gcTimeout;
	/**
	* Clears the pending garbage collection timeout, so the entry is no longer scheduled for removal.
	* A subclass may override this to release what it holds on to as well — `Query` also cancels any
	* in-flight fetch.
	*/
	destroy() {
		this.clearGcTimeout();
	}
	/**
	* Schedules the entry to be removed from its cache after `gcTime`, replacing any timeout scheduled
	* before. Nothing is scheduled if `gcTime` is `Infinity`.
	*/
	scheduleGc() {
		this.clearGcTimeout();
		if (require_utils.isValidTimeout(this.gcTime)) this.#gcTimeout = require_timeoutManager.timeoutManager.setTimeout(() => {
			this.optionalRemove();
		}, this.gcTime);
	}
	/**
	* Updates `gcTime`, keeping the longest one seen so far. Without a value, it defaults to 5 minutes
	* on the client and `Infinity` on the server.
	* @param newGcTime - The `gcTime` from the latest options, if any.
	*/
	updateGcTime(newGcTime) {
		this.gcTime = Math.max(this.gcTime || 0, newGcTime ?? (require_environmentManager.isServer() ? Infinity : 3e5));
	}
	/**
	* Cancels the scheduled removal, if there is one.
	*/
	clearGcTimeout() {
		if (this.#gcTimeout !== void 0) {
			require_timeoutManager.timeoutManager.clearTimeout(this.#gcTimeout);
			this.#gcTimeout = void 0;
		}
	}
};
//#endregion
exports.Removable = Removable;

//# sourceMappingURL=removable.cjs.map