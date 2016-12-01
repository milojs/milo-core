'use strict';


var _ = require('protojs');
var util = require('./util');

module.exports = config;

function config(options) {
    if (options.hasOwnProperty('check'))
        util.check.disabled = !options.check;

    _.deepExtend(config, options);
}

config({
    mixin: {
        instancePropertiesMap: '___mixin_instances'
    },
    check: true,
    debug: false
});
