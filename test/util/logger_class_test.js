'use strict';

var Logger = require('../../lib/util/logger_class')
    , assert = require('assert');

var logger = new Logger();

describe('Logger', function() {
    it('should define logger methods when instantiated', function() {
        ['log', 'error', 'warn', 'info', 'debug'].forEach(function(level) {
            assert(typeof (logger[level]) == 'function', 'should define logger methods');
        });
    });

    it('should send messages on errors and warning with messageLevel == 1', function (done) {
        logger.messageLevel = 1;
        logger.on('log', function(msg, data) {
            assert.deepEqual(data, { level: 0, type: 'error', str: ' error: test' });
            done();
        });

        logger.error('test');
    });
});
