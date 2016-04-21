'use strict';

var config = require('../config');

/**
 * `milo.util`
 */
var util = {
    logger: require('./logger'),
    check: require('ml-check'),
    doT: require('dot')
};

util.check.disable = !config.check;

module.exports = util;
