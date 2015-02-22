'use strict';

var _ = require('mol-proto');


/**
 * ####Milo packages####
 *
 * - [minder](./minder.js.html) - data reactivity, one or two way, shallow or deep, as you like it
 * - [config](./config.js.html) - milo configuration
 * - [util](./util/index.js.html) - logger, request, dom, check, error, etc.
 * - [classes](./classes.js.html) - abstract and base classes
 * - [Messenger](./messenger/index.js.html) - generic Messenger used in most other milo classes, can be mixed into app classes too.
 * - [Model](./model/index.js.html) - Model class that emits messages on changes to any depth without timer based watching
 */
var milo = {
    minder: require('./minder'),
    config: require('./config'),
    util: require('./util'),
    classes: require('./classes'),
    Messenger: require('./messenger'),
    Model: require('./model'),
    milo_version: '0.1.11',
    destroy: destroy
};


// export for node/browserify
if (typeof module == 'object' && module.exports)    
    module.exports = milo;

// global milo for browser
if (typeof window == 'object')
    window.milo = milo;


function destroy() {
    milo.minder.destroy();
}
