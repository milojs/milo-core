'use strict';


var _ = require('protojs');


module.exports = config;

function config(options) {
    _.deepExtend(config, options);
}

config({
    mixin: {
        instancePropertiesMap: '___mixin_instances'
    },
    check: false,
    debug: false
});
