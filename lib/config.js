'use strict';


var _ = require('mol-proto');


module.exports = config;

function config(options) {
    _.deepExtend(config, options);
}

config({
    mixin: {
        instancePropertiesMap: '___mixin_instances'
    },
    check: true,
    debug: false
});
