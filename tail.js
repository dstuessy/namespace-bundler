/**
 * Wrapper for tail call optimization.
 * passes the given function a "recur" function
 * that allows it to be excuted within a 
 * while loop.
 *
 * @param {function} fn Function to be tail call optimized.
 * @return {function} Wrapper for tail call optimization.
 */
module.exports = function tail(fn) {

    /**
     * Wrapper for recursion using a while-loop.
     * Wraps the arguments in order to detect
     * when a base-value has been reached. 
     * @param {args} ...args Any number of arguments
     * @return {object} An object with wrapper and args values. Args are the arguments passed to "recur".
     */
    var recur = function (...args) {
        var wrapper = Object.freeze({
            wrapper: "recur",
            args: args
        });
        return wrapper;
    };

    /**
     * Check if given object is a wrapper for
     * recur function.
     * @param {object} obj Object to check for wrapper property.
     * @return {boolean} True if obj is wrapper, false otherwise.
     */
    var isWrapper = function (obj) {
        if (obj != null && obj.wrapper === "recur")
            return true;
        return false;
    };

    /**
     * Function that executes "fn" 
     * in a while loop, using the 
     * "recur" function.
     * If "fn" returns a value using 
     * "recur", it will pass the arguments
     * given to "recur" over to the 
     * next time it calls "fn" in the while-loop.
     * @param {args} ...args Any number of arguments.
     * @return {mixed} The result of the recursive loop.
     */
    return function (...args) {

        var result = fn(recur, ...args);

        while (isWrapper(result)) {
            result = fn(recur, ...result.args);
        }

        return result;
    };
};