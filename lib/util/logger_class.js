'use strict';

// ### Logger Class

// Properties:

// - level

//   - 0 - error
//   - 1 - warn
//   - 2 - info
//   - 3 - debug (default)

// - enabled

//   true by default. Set to false to disable all logging in browser console.


var _ = require('mol-proto')
    , Messenger = require('../messenger');


/**
 * Log levels.
 */

var levels = [
    'error',
    'warn',
    'info',
    'debug'
];

var maxLevelLength = Math.max.apply(Math, levels.map(function(level) { return level.length; }));

/**
 * Colors for log levels.
 */

var colors = [
    31,
    33,
    36,
    90
];

/**
 * Pads the nice output to the longest log level.
 */
function pad(str) {
    if (str.length < maxLevelLength)
        return str + new Array(maxLevelLength - str.length + 1).join(' ');

    return str;
};


function colored(str, color) {
    return '\x1B[' + color + 'm' + str + ' -\x1B[39m';
}


var DEFAULT_OPTIONS = {
    level: 3,
    throwLevel: -1, // never throw
    enabled: true,
    logPrefix: ''
}


/**
 * Expose Messenger methods on Logger prototype
 */
var MESSENGER_PROPERTY = '_messenger';
Messenger.useWith(Logger, MESSENGER_PROPERTY, Messenger.defaultMethods);


/**
 * Logger (console).
 *
 * @api public
 */
function Logger(opts) {
    _.extend(this, DEFAULT_OPTIONS);
    _.extend(this, opts || {});
    var messenger = new Messenger(this);
    _.defineProperty(this, MESSENGER_PROPERTY, messenger);
};


/**
 * Log method.
 *
 * @api public
 */

Logger.prototype.log = function (type) {
    var index = levels.indexOf(type);

    if (! this.enabled || index > this.level)
        return this;

    var args = _.slice(arguments, 1)
        , self = this;

    if (index <= this.throwLevel)
        throw new Error(logString());

    if (index <= this.messageLevel)
        this.postMessage('log', { level: index, type: type, str: logString() });

    console.log.apply(
          console
        , [ this.logPrefixColor
              ? '   ' + colored(this.logPrefix, this.logPrefixColor)
              : this.logPrefix,
            (this.colors
              ? ' ' + colored(pad(type), colors[index])
              : type) + ':'
          ].concat(args)
    );

    return this;


    function logString() {
        return [self.logPrefix, type + ':'].concat(args).join(' ');
    }
};

/**
 * Generate methods.
 */

levels.forEach(function (name) {
    Logger.prototype[name] = function () {
        this.log.apply(this, [name].concat(_.toArray(arguments)));
    };
});


module.exports = Logger;
