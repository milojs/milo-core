'use strict';

var Mixin = require('ml-mixin')
    , MessageSource = require('./m_source')
    , _ = require('protojs')
    , check = require('ml-check')
    , Match = check.Match;


// in browser code can be replaced with milo.util.zeroTimeout using useSetTimeout method
var _setTimeout = setTimeout;


/**
 * `milo.Messenger`
 * A generic Messenger class that is used for all kinds of messaging in milo. It is subclassed from [Mixin](../abstract/mixin.js.html) and it proxies its methods to the host object for convenience.
 * All facets and components have messenger attached to them. Messenger class interoperates with [MessageSource](./m_source.js.html) class that connects the messenger to some external source of messages (e.g., DOM events) and [MessengerAPI](./m_api.js.html) class that allows to define higher level messages than messages that exist on the source.
 * Messenger class is used internally in milo and can be used together with any objects/classes in the application.
 * milo also defines a global messenger [milo.mail](../mail/index.js.html) that dispatches `domready` event and can be used for any application wide messaging.
 * To initialize your app after DOM is ready use:
 * ```
 * milo.mail.on('domready', function() {
 *     // application starts
 * });
 * ```
 * or the following shorter form of the same:
 * ```
 * milo(function() {
 *     // application starts
 * });
 * ```
 */
var Messenger = _.createSubclass(Mixin, 'Messenger');

var messagesSplitRegExp = Messenger.messagesSplitRegExp = /\s*(?:\,|\s)\s*/;


/**
 * ####Messenger instance methods####
 *
 * - [init](#init)
 * - [on](#Messenger$on) (alias - onMessage, deprecated)
 * - [off](#Messenger$off) (alias - offMessage, deprecated)
 * - [onMessages](#onMessages)
 * - [offMessages](#offMessages)
 * - [once](#once)
 * - [onceSync](#onceSync)
 * - [postMessage](#postMessage)
 * - [getSubscribers](#getSubscribers)
 *
 * "Private" methods
 *
 * - [_chooseSubscribersHash](#_chooseSubscribersHash)
 * - [_registerSubscriber](#_registerSubscriber)
 * - [_removeSubscriber](#_removeSubscriber)
 * - [_removeAllSubscribers](#_removeAllSubscribers)
 * - [_callPatternSubscribers](#_callPatternSubscribers)
 * - [_callSubscribers](#_callSubscribers)
 * - [_setMessageSource](#_setMessageSource)
 * - [getMessageSource](#getMessageSource)
 */
_.extendProto(Messenger, {
    init: init, // called by Mixin (superclass)
    destroy: Messenger$destroy,
    on: Messenger$on,
    once: Messenger$once,
    onceSync: Messenger$onceSync,
    onSync: Messenger$onSync,
    onAsync: Messenger$onAsync,
    onMessage: Messenger$on, // deprecated
    off: Messenger$off,
    offMessage: Messenger$off, // deprecated
    onMessages: onMessages,
    offMessages: offMessages,
    offAll: Messenger$offAll,
    postMessage: postMessage,
    postMessageSync: postMessageSync,
    getSubscribers: getSubscribers,
    getMessageSource: getMessageSource,
    _chooseSubscribersHash: _chooseSubscribersHash,
    _registerSubscriber: _registerSubscriber,
    _removeSubscriber: _removeSubscriber,
    _removeAllSubscribers: _removeAllSubscribers,
    _callPatternSubscribers: _callPatternSubscribers,
    _callSubscribers: _callSubscribers,
    _callSubscriber: _callSubscriber,
    _setMessageSource: _setMessageSource
});


/**
 * A default map of proxy methods used by ComponentFacet and Component classes to pass to Messenger when it is instantiated.
 * This map is for convenience only, it is NOT used internally by Messenger, a host class should pass it for methods to be proxied this way.
 */
Messenger.defaultMethods = {
    on: 'on',
    onSync: 'onSync',
    once: 'once',
    onceSync: 'onceSync',
    off: 'off',
    onMessages: 'onMessages',
    offMessages: 'offMessages',
    postMessage: 'postMessage',
    postMessageSync: 'postMessageSync',
    getSubscribers: 'getSubscribers'
};


/**
 * Messenger class (static) methods
 * - [useSetTimeout](#useSetTimeout)
 */
Messenger.useSetTimeout = useSetTimeout;


module.exports = Messenger;


Messenger.subscriptions = [];


/**
 * Messenger instance method
 * Initializes Messenger. Method is called by Mixin class constructor.
 * See [on](#Messenger$on) method, [Messenger](#Messenger) class above and [MessageSource](./m_source.js.html) class.
 *
 * @param {Object} hostObject Optional object that stores the messenger on one of its properties. It is used to proxy methods of messenger and also as a context for subscribers when they are called by the Messenger. See `on` method.
 * @param {Object} proxyMethods Optional map of method names; key - proxy method name, value - messenger's method name.
 * @param {MessageSource} messageSource Optional messageSource linked to the messenger. If messageSource is supplied, the reference to the messenger will stored on its 'messenger' property
 */
function init(hostObject, proxyMethods, messageSource) {
    // hostObject and proxyMethods are used in Mixin and checked there
    if (messageSource)
        this._setMessageSource(messageSource);

    _initializeSubscribers.call(this);
}


function _initializeSubscribers() {
    _.defineProperties(this, {
        _messageSubscribers: {},
        _patternMessageSubscribers: {},
    }, _.CONF);
}


/**
 * Destroys messenger. Maybe needs to unsubscribe all subscribers
 */
function Messenger$destroy() {
    this.offAll();
    var messageSource = this.getMessageSource();
    if (messageSource)
        messageSource.destroy();
}


/**
 * Messenger instance method.
 * Registers a subscriber function for a certain message(s).
 * This method returns `true` if the subscription was successful. It can be unsuccessful if the passed subscriber has already been subscribed to this message type - double subscription never happens and it is safe to subscribe again - no error or warning is thrown or logged.
 * Subscriber is passed two parameters: `message` (string) and `data` (object). Data object is supplied when message is dispatched, Messenger itself adds nothing to it. For example, [events facet](../components/c_facets/Events.js.html) sends actual DOM event when it posts message.
 * Usage:
 * ```
 * // subscribes onMouseUpDown to two DOM events on component via events facet.
 * myComp.events.on('mousedown mouseup', onMouseUpDown);
 * function onMouseUpDown(eventType, event) {
 *     // ...
 * }
 *
 * myComp.data.on(/.+/, function(msg, data) {
 *     logger.debug(msg, data);
 * }); // subscribes anonymous function to all non-empty messages on data facet
 * // it will not be possible to unsubscribe anonymous subscriber separately,
 * // but myComp.data.off(/.+/) will unsubscribe it
 * ```
 * If messenger has [MessageSource](./m_source.js.html) attached to it, MessageSource will be notified when the first subscriber for a given message is added, so it can subscribe to the source.
 * [Components](../components/c_class.js.html) and [facets](../components/c_facet.js.html) change this method name to `on` when they proxy it.
 * See [postMessage](#postMessage).
 *
 * @param {String|Array[String]|RegExp} messages Message types that should envoke the subscriber.
 *  If string is passed, it can be a sigle message or multiple message types separated by whitespace with optional commas.
 *  If an array of strings is passed, each string is a message type to subscribe for.
 *  If a RegExp is passed, the subscriber will be envoked when the message dispatched on the messenger matches the pattern (or IS the RegExp with identical pattern).
 *  Pattern subscriber does NOT cause any subscription to MessageSource, it only captures messages that are already subscribed to with precise message types.
 * @param {Function|Object} subscriber Message subscriber - a function that will be called when the message is dispatched on the messenger (usually via proxied postMessage method of host object).
 *  If hostObject was supplied to Messenger constructor, hostObject will be the context (the value of this) for the subscriber envocation.
 *  Subscriber can also be an object with properties `subscriber` (function) and `context` ("this" value when subscriber is called)
 * @return {Boolean}
 */
function Messenger$on(messages, subscriber) {
    return _Messenger_onWithOptions.call(this, messages, subscriber);
}


function Messenger$once(messages, subscriber) {
    return _Messenger_onWithOptions.call(this, messages, subscriber, { dispatchTimes: 1 });
}

function Messenger$onceSync(messages, subscriber) {
    return _Messenger_onWithOptions.call(this, messages, subscriber, { dispatchTimes: 1, sync: true });
}


function Messenger$onSync(messages, subscriber) {
    return _Messenger_onWithOptions.call(this, messages, subscriber, { sync: true });
}


function Messenger$onAsync(messages, subscriber) {
    return _Messenger_onWithOptions.call(this, messages, subscriber, { sync: false });
}


function _Messenger_onWithOptions(messages, subscriber, options) {
    check(messages, Match.OneOf(String, [String], RegExp));
    check(subscriber, Match.OneOf(Function, {
        subscriber: Function,
        context: Match.Any,
        options: Match.Optional(Object),
    }));

    if (typeof subscriber == 'function') {
        subscriber = {
            subscriber: subscriber,
            context: this._hostObject,
        };
    }

    if (options) {
        subscriber.options = subscriber.options || {};
        _.extend(subscriber.options, options);
    }

    return _Messenger_on.call(this, messages, subscriber);
}


function _Messenger_on(messages, subscriber) {
    _.defineProperty(subscriber, '__messages', messages);
    return _eachMessage.call(this, '_registerSubscriber', messages, subscriber);
}


function _eachMessage(methodName, messages, subscriber) {
    if (typeof messages == 'string')
        messages = messages.split(messagesSplitRegExp);

    var subscribersHash = this._chooseSubscribersHash(messages);

    if (messages instanceof RegExp)
        return this[methodName](subscribersHash, messages, subscriber);

    else {
        var changed = false;

        messages.forEach(function(message) {
            var subscriptionChanged = this[methodName](subscribersHash, message, subscriber);
            changed = changed || subscriptionChanged;
        }, this);

        return changed;
    }
}


/**
 * "Private" Messenger instance method
 * It is called by [on](#Messenger$on) to register subscriber for one message type.
 * Returns `true` if this subscriber is not yet registered for this type of message.
 * If messenger has [MessageSource](./m_source.js.html) attached to it, MessageSource will be notified when the first subscriber for a given message is added.
 *
 * @private
 * @param {Object} subscribersHash The map of subscribers determined by [on](#Messenger$on) based on Message type, can be `this._patternMessageSubscribers` or `this._messageSubscribers`
 * @param {String} message Message type
 * @param {Function|Object} subscriber Subscriber function to be added or object with properties `subscriber` (function) and `context` (value of "this" when subscriber is called)
 * @return {Boolean}
 */
function _registerSubscriber(subscribersHash, message, subscriber) {
    if (! (subscribersHash[message] && subscribersHash[message].length)) {
        subscribersHash[message] = [];
        if (message instanceof RegExp)
            subscribersHash[message].pattern = message;
        if (this._messageSource)
            this._messageSource.onSubscriberAdded(message);
        var noSubscribers = true;
    }

    var msgSubscribers = subscribersHash[message];
    var notYetRegistered = noSubscribers || _indexOfSubscriber.call(this, msgSubscribers, subscriber) == -1;

    if (notYetRegistered)
        msgSubscribers.push(subscriber);

    return notYetRegistered;
}


/**
 * Finds subscriber index in the list
 *
 * @param {Array[Function|Object]} list list of subscribers
 * @param {Function|Object} subscriber subscriber function or object with properties `subscriber` (function) and `context` ("this" object)
 */
function _indexOfSubscriber(list, subscriber) {
    var self = this;
    return _.findIndex(list, function(subscr){
        return subscriber.subscriber == subscr.subscriber
                && subscriber.context == subscr.context
    });
}


/**
 * Messenger instance method.
 * Subscribes to multiple messages passed as map together with subscribers.
 * Usage:
 * ```
 * myComp.events.onMessages({
 *     'mousedown': onMouseDown,
 *     'mouseup': onMouseUp
 * });
 * function onMouseDown(eventType, event) {}
 * function onMouseUp(eventType, event) {}
 * ```
 * Returns map with the same keys (message types) and boolean values indicating whether particular subscriber was added.
 * It is NOT possible to add pattern subscriber using this method, as although you can use RegExp as the key, JavaScript will automatically convert it to string.
 *
 * @param {Object[Function]} messageSubscribers Map of message subscribers to be added
 * @return {Object[Boolean]}
 */
function onMessages(messageSubscribers) {
    check(messageSubscribers, Match.ObjectHash(Match.OneOf(Function, { subscriber: Function, context: Match.Any })));

    var notYetRegisteredMap = _.mapKeys(messageSubscribers, function(subscriber, messages) {
        return this.on(messages, subscriber);
    }, this);

    return notYetRegisteredMap;
}


/**
 * Messenger instance method.
 * Removes a subscriber for message(s). Removes all subscribers for the message if subscriber isn't passed.
 * This method returns `true` if the subscriber was registered. No error or warning is thrown or logged if you remove subscriber that was not registered.
 * [Components](../components/c_class.js.html) and [facets](../components/c_facet.js.html) change this method name to `off` when they proxy it.
 * Usage:
 * ```
 * // unsubscribes onMouseUpDown from two DOM events.
 * myComp.events.off('mousedown mouseup', onMouseUpDown);
 * ```
 * If messenger has [MessageSource](./m_source.js.html) attached to it, MessageSource will be notified when the last subscriber for a given message is removed and there is no more subscribers for this message.
 *
 * @param {String|Array[String]|RegExp} messages Message types that a subscriber should be removed for.
 *  If string is passed, it can be a sigle message or multiple message types separated by whitespace with optional commas.
 *  If an array of strings is passed, each string is a message type to remove a subscriber for.
 *  If a RegExp is passed, the pattern subscriber will be removed.
 *  RegExp subscriber does NOT cause any subscription to MessageSource, it only captures messages that are already subscribed to with precise message types.
 * @param {Function} subscriber Message subscriber - Optional function that will be removed from the list of subscribers for the message(s). If subscriber is not supplied, all subscribers will be removed from this message(s).
 * @return {Boolean}
 */
function Messenger$off(messages, subscriber) {
    check(messages, Match.OneOf(String, [String], RegExp));
    check(subscriber, Match.Optional(Match.OneOf(Function, {
        subscriber: Function,
        context: Match.Any,
        options: Match.Optional(Object),
        // __messages: Match.Optional(Match.OneOf(String, [String], RegExp))
    })));

    return _Messenger_off.call(this, messages, subscriber);
}


function _Messenger_off(messages, subscriber) {
    return _eachMessage.call(this, '_removeSubscriber', messages, subscriber);
}


/**
 * "Private" Messenger instance method
 * It is called by [off](#Messenger$off) to remove subscriber for one message type.
 * Returns `true` if this subscriber was registered for this type of message.
 * If messenger has [MessageSource](./m_source.js.html) attached to it, MessageSource will be notified when the last subscriber for a given message is removed and there is no more subscribers for this message.
 *
 * @private
 * @param {Object} subscribersHash The map of subscribers determined by [off](#Messenger$off) based on message type, can be `this._patternMessageSubscribers` or `this._messageSubscribers`
 * @param {String} message Message type
 * @param {Function} subscriber Subscriber function to be removed
 * @return {Boolean}
 */
function _removeSubscriber(subscribersHash, message, subscriber) {
    var msgSubscribers = subscribersHash[message];
    if (! msgSubscribers || ! msgSubscribers.length)
        return false; // nothing removed

    if (subscriber) {
        if (typeof subscriber == 'function')
            subscriber = { subscriber: subscriber, context: this._hostObject };

        var subscriberIndex = _indexOfSubscriber.call(this, msgSubscribers, subscriber);
        if (subscriberIndex == -1)
            return false; // nothing removed
        msgSubscribers.splice(subscriberIndex, 1);
        if (! msgSubscribers.length)
            this._removeAllSubscribers(subscribersHash, message);

    } else
        this._removeAllSubscribers(subscribersHash, message);

    return true; // subscriber(s) removed
}


/**
 * "Private" Messenger instance method
 * It is called by [_removeSubscriber](#_removeSubscriber) to remove all subscribers for one message type.
 * If messenger has [MessageSource](./m_source.js.html) attached to it, MessageSource will be notified that all message subscribers were removed so it can unsubscribe from the source.
 *
 * @private
 * @param {Object} subscribersHash The map of subscribers determined by [off](#Messenger$off) based on message type, can be `this._patternMessageSubscribers` or `this._messageSubscribers`
 * @param {String} message Message type
 */
function _removeAllSubscribers(subscribersHash, message) {
    delete subscribersHash[message];
    if (this._messageSource && typeof message == 'string')
        this._messageSource.onSubscriberRemoved(message);
}


/**
 * Messenger instance method.
 * Unsubscribes from multiple messages passed as map together with subscribers.
 * Returns map with the same keys (message types) and boolean values indicating whether particular subscriber was removed.
 * If a subscriber for one of the messages is not supplied, all subscribers for this message will be removed.
 * Usage:
 * ```
 * myComp.events.offMessages({
 *     'mousedown': onMouseDown,
 *     'mouseup': onMouseUp,
 *     'click': undefined // all subscribers to this message will be removed
 * });
 * ```
 * It is NOT possible to remove pattern subscriber(s) using this method, as although you can use RegExp as the key, JavaScript will automatically convert it to string.
 *
 * @param {Object[Function]} messageSubscribers Map of message subscribers to be removed
 * @return {Object[Boolean]}
 */
function offMessages(messageSubscribers) {
    check(messageSubscribers, Match.ObjectHash(Match.Optional(Match.OneOf(Function, { subscriber: Function, context: Match.Any }))));

    var subscriberRemovedMap = _.mapKeys(messageSubscribers, function(subscriber, messages) {
        return this.off(messages, subscriber);
    }, this);

    return subscriberRemovedMap;
}


/**
 * Unsubscribes all subscribers
 */
function Messenger$offAll() {
    _offAllSubscribers.call(this, this._patternMessageSubscribers);
    _offAllSubscribers.call(this, this._messageSubscribers);
}


function _offAllSubscribers(subscribersHash) {
    _.eachKey(subscribersHash, function(subscribers, message) {
        this._removeAllSubscribers(subscribersHash, message);
    }, this);
}


// TODO - send event to messageSource


/**
 * Messenger instance method.
 * Dispatches the message calling all subscribers registered for this message and, if the message is a string, calling all pattern subscribers when message matches the pattern.
 * Each subscriber is passed the same parameters that are passed to theis method.
 * The context of the subscriber envocation is set to the host object (`this._hostObject`) that was passed to the messenger constructor.
 * Subscribers are called in the next tick ("asynchronously") apart from those that were subscribed with `onSync` (or that have `options.sync == true`).
 *
 * @param {String|RegExp} message message to be dispatched
 *  If the message is a string, the subscribers registered with exactly this message will be called and also pattern subscribers registered with the pattern that matches the dispatched message.
 *  If the message is RegExp, only the subscribers registered with exactly this pattern will be called.
 * @param {Any} data data that will be passed to the subscriber as the second parameter. Messenger does not modify this data in any way.
 * @param {Function} callback optional callback to pass to subscriber
 * @param {Boolean} _synchronous if true passed, subscribers will be envoked synchronously apart from those that have `options.sync == false`. This parameter should not be used, instead postMessageSync should be used.
 */
function postMessage(message, data, callback, _synchronous) {
    check(message, Match.OneOf(String, RegExp));
    check(callback, Match.Optional(Function));

    var subscribersHash = this._chooseSubscribersHash(message);
    var msgSubscribers = subscribersHash[message];

    this._callSubscribers(message, data, callback, msgSubscribers, _synchronous);

    if (typeof message == 'string')
        this._callPatternSubscribers(message, data, callback, msgSubscribers, _synchronous);
}


/**
 * Same as postMessage apart from envoking subscribers synchronously, apart from those subscribed with `onAsync` (or with `options.sync == false`).
 *
 * @param {String|RegExp} message
 * @param {Any} data
 * @param {Function} callback
 */
function postMessageSync(message, data, callback) {
    this.postMessage(message, data, callback, true);
}


/**
 * "Private" Messenger instance method
 * Envokes pattern subscribers with the pattern that matches the message.
 * The method is called by [postMessage](#postMessage) - see more information there.
 *
 * @private
 * @param {String} message message to be dispatched. Pattern subscribers registered with the pattern that matches the dispatched message will be called.
 * @param {Any} data data that will be passed to the subscriber as the second parameter. Messenger does not modify this data in any way.
 * @param {Function} callback optional callback to pass to subscriber
 * @param {Array[Function|Object]} calledMsgSubscribers array of subscribers already called, they won't be called again if they are among pattern subscribers.
 */
function _callPatternSubscribers(message, data, callback, calledMsgSubscribers, _synchronous) {
    _.eachKey(this._patternMessageSubscribers,
        function(patternSubscribers) {
            var pattern = patternSubscribers.pattern;
            if (pattern.test(message)) {
                if (calledMsgSubscribers) {
                    var patternSubscribers = patternSubscribers.filter(function(subscriber) {
                        var index = _indexOfSubscriber.call(this, calledMsgSubscribers, subscriber);
                        return index == -1;
                    });
                }
                this._callSubscribers(message, data, callback, patternSubscribers, _synchronous);
            }
        }
    , this);
}


/**
 * "Private" Messenger instance method
 * Envokes subscribers from the passed list.
 * The method is called by [postMessage](#postMessage) and [_callPatternSubscribers](#_callPatternSubscribers).
 *
 * @private
 * @param {String} message message to be dispatched, passed to subscribers as the first parameter.
 * @param {Any} data data that will be passed to the subscriber as the second parameter. Messenger does not modify this data in any way.
 * @param {Array[Function|Object]} msgSubscribers the array of message subscribers to be called. Each subscriber is called with the host object (see Messenger constructor) as the context.
 * @param {Function} callback optional callback to pass to subscriber
 */
function _callSubscribers(message, data, callback, msgSubscribers, _synchronous) {
    if (msgSubscribers && msgSubscribers.length) {
        // cloning is necessary as some of the subscribers
        // can be unsubscribed during the dispatch
        // so this array would change in the process
        msgSubscribers = msgSubscribers.slice();

        msgSubscribers.forEach(function(subscriber) {
            this._callSubscriber(subscriber, message, data, callback, _synchronous);
        }, this);
    }
}


function _callSubscriber(subscriber, message, data, callback, _synchronous) {
    var syncSubscriber = subscriber.options && subscriber.options.sync
        , synchro = (_synchronous && syncSubscriber !== false)
                  || syncSubscriber;

    var dispatchTimes = subscriber.options && subscriber.options.dispatchTimes;
    if (dispatchTimes) {
        if (dispatchTimes <= 1) {
            var messages = subscriber.__messages;
            this.off(messages, subscriber);
        } else if (dispatchTimes > 1)
            subscriber.options.dispatchTimes--;
    }

    if (synchro)
        subscriber.subscriber.call(subscriber.context, message, data, callback);
    else
        _setTimeout(function() { subscriber.subscriber.call(subscriber.context, message, data, callback); }, 0);
}


/**
 * Replace setTimeout with another function (e.g. setImmediate in node or milo.util.zeroTimeout in browser)
 *
 * @param  {Function} setTimeoutFunc function to use to delay execution
 */
function useSetTimeout(setTimeoutFunc) {
    _setTimeout = setTimeoutFunc;
}


/**
 * Messenger instance method.
 * Returns the array of subscribers that would be called if the message were dispatched.
 * If `includePatternSubscribers === false`, pattern subscribers with matching patters will not be included (by default they are included).
 * If there are no subscribers to the message, `undefined` will be returned, not an empty array, so it is safe to use the result in boolean tests.
 *
 * @param {String|RegExp} message Message to get subscribers for.
 *  If the message is RegExp, only pattern subscribers registered with exactly this pattern will be returned.
 *  If the message is String, subscribers registered with the string messages and pattern subscribers registered with matching pattern will be returned (unless the second parameter is false).
 * @param {Boolean} includePatternSubscribers Optional false to prevent inclusion of patter subscribers, by default they are included.
 * @return {Array|undefined}
 */
function getSubscribers(message, includePatternSubscribers) {
    check(message, Match.OneOf(String, RegExp));

    var subscribersHash = this._chooseSubscribersHash(message);
    var msgSubscribers = subscribersHash[message]
                            ? [].concat(subscribersHash[message])
                            : [];

    // pattern subscribers are incuded by default
    if (includePatternSubscribers !== false && typeof message == 'string') {
        _.eachKey(this._patternMessageSubscribers,
            function(patternSubscribers) {
                var pattern = patternSubscribers.pattern;
                if (patternSubscribers && patternSubscribers.length
                        && pattern.test(message))
                    _.appendArray(msgSubscribers, patternSubscribers);
            }
        );
    }

    // return undefined if there are no subscribers
    return msgSubscribers.length
                ? msgSubscribers
                : undefined;
}


/**
 * "Private" Messenger instance method
 * Returns the map of subscribers for a given message type.
 *
 * @private
 * @param {String|RegExp} message Message to choose the map of subscribers for
 * @return {Object[Function]}
 */
function _chooseSubscribersHash(message) {
    return message instanceof RegExp
                ? this._patternMessageSubscribers
                : this._messageSubscribers;
}


/**
 * Messenger instance method
 * Sets [MessageSource](./m_source.js.html) for the messenger also setting the reference to the messenger in the MessageSource.
 * MessageSource can be passed to message constructor; this method allows to set it at a later time. For example, the subclasses of [ComponentFacet](../components/c_facet.js.html) use this method to set different MessageSource'es in the messenger that is created by ComponentFacet.
 * Currently the method is implemented in such way that it can be called only once - MessageSource cannot be changed after this method is called.
 *
 * @param {MessageSource} messageSource an instance of MessageSource class to attach to this messenger (and to have this messenger attached to it too)
 */
function _setMessageSource(messageSource) {
    check(messageSource, MessageSource);

    _.defineProperty(this, '_messageSource', messageSource);
    messageSource.messenger = this;
}


/**
 * Messenger instance method
 * Returns messenger MessageSource
 *
 * @return {MessageSource}
 */
function getMessageSource() {
    return this._messageSource
}
