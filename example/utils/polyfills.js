/**
 * This file is automatically included in the JS bundle.
 * Don't import it manually.
 */

if (typeof Promise === 'undefined') {
    // Rejection tracking prevents a common issue where React gets into an
    // inconsistent state due to an error, but it gets swallowed by a Promise,
    // and the user has no idea what causes React's erratic future behavior.
    /* eslint-disable global-require */
    require('promise/lib/rejection-tracking').enable();
    window.Promise = require('promise/lib/es6-extensions.js');
    /* eslint-enable */
}