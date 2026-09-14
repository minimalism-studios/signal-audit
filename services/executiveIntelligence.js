/*
 * Compatibility entry point.
 *
 * Executive intelligence workflows now live under:
 *
 * services/intelligence/
 *
 * New code should import the Leadership workflow directly:
 *
 * require("./intelligence/leadership")
 */

module.exports = require(
  "./intelligence/leadership",
);
