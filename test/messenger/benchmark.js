'use strict';

var Benchmark = require('benchmark');
var suite = new Benchmark.Suite;

var Messenger = require('../../lib/milo-core').Messenger;
var messenger = new Messenger;

var _subscriber;
function subscriber() { _subscriber(); }
messenger.on('test', subscriber);
messenger.on(/testing/, subscriber);
 

// 2 june 2015:
// Message delivery x 345 ops/sec ±1.57% (66 runs sampled)
// Pattern message delivery x 349 ops/sec ±1.29% (62 runs sampled)
// Sync message delivery x 365,656 ops/sec ±0.66% (90 runs sampled)
// Sync pattern message delivery x 336,102 ops/sec ±0.91% (91 runs sampled)

Messenger.useSetTimeout(setImmediate);

suite
.add('Message delivery', {
    defer: true,
    fn: function(deferred) {
        suite.name;
        _subscriber = function() { deferred.resolve(); }
        messenger.postMessage('test');
    }
})
.add('Pattern message delivery', {
    defer: true,
    fn: function(deferred) {
        suite.name;
        _subscriber = function() { deferred.resolve(); }
        messenger.postMessage('testing pattern');
    }
})
.add('Sync message delivery', function() {
    _subscriber = function() {}
    messenger.postMessageSync('test');
})
.add('Sync pattern message delivery', function() {
    _subscriber = function() {}
    messenger.postMessageSync('testing pattern');
})

// add listeners
.on('cycle', function(event) {
  console.info(String(event.target));
})
.on('complete', function() {
  console.info('Fastest is ' + this.filter('fastest').pluck('name'));
})
// run async
.run({ 'async': true });
