'use strict';

var ModelPath = require('./m_path')
    , synthesize = require('./synthesize')
    , pathUtils = require('./path_utils')
    , modelUtils = require('./model_utils')
    , changeDataHandler = require('./change_data')
    , Messenger = require('../messenger')
    , MessengerMessageSource = require('../messenger/msngr_source')
    , ModelMsgAPI = require('./m_msg_api')
    , Mixin = require('ml-mixin')
    , _ = require('protojs')
    , check = require('ml-check')
    , Match = check.Match
    , logger = require('../util/logger');


module.exports = Model;


/**
 * `milo.Model`
 * Model class instantiates objects that allow deep data access with __safe getters__ that return undefined (rather than throwing exception) when properties/items of unexisting objects/arrays are requested and __safe setters__ that create object trees when properties/items of unexisting objects/arrays are set and also post messages to allow subscription on changes and enable data reactivity.
 * Reactivity is implememnted via [Connector](./connector.js.html) that can be instantiated either directly or with more convenient interface of [milo.minder](../minder.js.html). At the moment model can be connected to [Data facet](../components/c_facets/Data.js.html) or to another model or [ModelPath](./m_path.js.html).
 * Model constructor returns objects that are functions at the same time; when called they return ModelPath objects that allow get/set access to any point in model data. See [ModelData](#ModelData) below.
 *
 * You can subscribe to model changes with `on` method by passing model access path in place of message, pattern or string with any number of stars to subscribe to a certain depth in model (e.g., `'***'` to subscribe to three levels).
 *
 * @constructor
 * @param {Object|Array} data optional initial array data. If it is planned to connect model to view it is usually better to instantiate an empty Model (`var m = new Model`), connect it to [Component](../components/c_class.js.html)'s [Data facet](../components/c_facets/Data.js.html) (e.g., `milo.minder(m, '<<->>', c.data);`) and then set the model with `m.set(data)` - the view will be automatically updated.
 * @param {Object} hostObject optional object that hosts model on one of its properties. Can be used when model itself is the context of the message subscriber and you need to travers to this object (although it is possible to set any context). Can also be used to proxy model's methods to the host like [Model facet](../components/c_facets/ModelFacet.js.html) is doing.
 * @param {Object} options pass { reactive: false } to use model without messaging when it is not needed - it makes it much faster
 * @return {Model}
 */
function Model(data, hostObject, options) {
    // `model` will be returned by constructor instead of `this`. `model`
    // (`modelPath` function) should return a ModelPath object with "synthesized" methods
    // to get/set model properties, to subscribe to property changes, etc.
    // Additional arguments of modelPath can be used in the path using interpolation - see ModelPath below.
    var model = function modelPath(accessPath) { // , ... arguments that will be interpolated
        return Model$path.apply(model, arguments);
    };
    model.__proto__ = Model.prototype;

    model._hostObject = hostObject;
    model._options = options || {};

    if (model._options.reactive !== false) {
        model._prepareMessengers();
        // subscribe to "changedata" message to enable reactive connections
        model.onSync('changedata', changeDataHandler);
    }

    if (data) model._data = data;

    return model;
}

Model.prototype.__proto__ = Model.__proto__;


/**
 * ####Model instance methods####
 *
 * - [path](#path) - returns ModelPath object that allows access to any point in Model
 * - [get](#Model$get) - get model data
 * - set - set model data, synthesized
 * - splice - splice model data (as array or pseudo-array), synthesized
 * - [len](./m_path.js.html#ModelPath$len) - returns length of array (or pseudo-array) in model in safe way, 0 if no length is set
 * - [push](./m_path.js.html#ModelPath$push) - add items to the end of array (or pseudo-array) in model
 * - [pop](./m_path.js.html#ModelPath$pop) - remove item from the end of array (or pseudo-array) in model
 * - [unshift](./m_path.js.html#ModelPath$unshift) - add items to the beginning of array (or pseudo-array) in model
 * - [shift](./m_path.js.html#ModelPath$shift) - remove item from the beginning of array (or pseudo-array) in model
 * - [proxyMessenger](#proxyMessenger) - proxy model's Messenger methods to host object
 * - [proxyMethods](#proxyMethods) - proxy model methods to host object
 */
_.extendProto(Model, {
    path: Model$path,
    get: Model$get,
    proxyMessenger: proxyMessenger, // deprecated, should not be used
    proxyMethods: proxyMethods,
    _prepareMessengers: _prepareMessengers,
    _getHostObject: _getHostObject,
    destroy: Model$destroy
});

// set, del, splice are added to model
_.extendProto(Model, synthesize.modelMethods);


/**
 * - Path: ModelPath class as `milo.Model.Path`
 */
_.extend(Model, {
    Path: ModelPath,
    useWith: Model$$useWith,
    _utils: {
        path: pathUtils,
        model: modelUtils,
        changeDataHandler: changeDataHandler
    }
});


/**
 * Expose Messenger methods on Facet prototype
 */
var MESSENGER_PROPERTY = '_messenger';
Messenger.useWith(Model, MESSENGER_PROPERTY, Messenger.defaultMethods);


/**
 * ModelPath methods added to Model prototype
 */
['len', 'push', 'pop', 'unshift', 'shift'].forEach(function(methodName) {
    var method = ModelPath.prototype[methodName];
    _.defineProperty(Model.prototype, methodName, method);
});


/**
 * Model instance method.
 * Get model data.
 *
 * @return {Any}
 */
function Model$get() {
    return this._data;
}


/**
 * Model instance method.
 * Returns ModelPath object that implements the same API as model but allows access to any point inside model as defined by `accessPath`.
 * See [ModelPath](./m_path.js.html) class for more information.
 *
 * @param {String} accessPath string that defines path to access model.
 *  Path string consists of parts to define either property access (`".name"` to access property name) or array item access (`"[1]"` to access item with index 1).
 *  Access path can contain as many parts as necessary (e.g. `".list[0].name"` to access property `name` in the first element of array stored in property `list`.
 * @param {List} arguments additional arguments of this method can be used to create interpolated paths.
 *  E.g. `m.path("[$1].$2", id, prop)` returns ModelPath to access property with name `prop` in array item with index `id`. Although this ModelPath object will work exactly as `m("[" + id + "]." + prop)`, the interpolated is much more efficient as ModelPath with interpolation will not synthesize new getters and setters, while ModelPath with computed access path will synthesize new getters and setters for each pair of values of `id` and `prop`.
 * @return {ModelPath}
 */
function Model$path(accessPath) {  // , ... arguments that will be interpolated
    if (! accessPath) return this;

    // "null" is context to pass to ModelPath, first parameter of bind
    // "this" (model) is added in front of all arguments
    _.splice(arguments, 0, 0, null, this);

    // calling ModelPath constructor with new and the list of arguments: this (model), accessPath, ...
    return new (Function.prototype.bind.apply(ModelPath, arguments));
}


/**
 * Model instance method.
 * Proxy model's Messenger methods to host object.
 *
 * @param {Object} modelHostObject optional host object. If not passed, hostObject passed to Model constructor will be used.
 */
function proxyMessenger(modelHostObject) {
    modelHostObject = modelHostObject || this._hostObject;
    Mixin.prototype._createProxyMethods.call(this[MESSENGER_PROPERTY], Messenger.defaultMethods, modelHostObject);
}


var modelMethodsToProxy = ['path', 'get', 'set', 'del', 'splice', 'len', 'push', 'pop', 'unshift', 'shift'];


/**
 * Expose model methods on
 * See same method in Mixin class for parameters meaning
 *
 * @param {Function} hostClass
 * @param {[type]} instanceKey
 * @param {[type]} mixinMethods optional
 */
function Model$$useWith(hostClass, instanceKey, mixinMethods) {
    mixinMethods = mixinMethods || modelMethodsToProxy;
    Mixin.useWith.call(Model, hostClass, instanceKey, mixinMethods);
}


/**
 * Model instance method.
 * Proxy model methods to host object.
 *
 * @param {Object} modelHostObject optional host object. If not passed, hostObject passed to Model constructor will be used.
 */
function proxyMethods(modelHostObject) {
    modelHostObject = modelHostObject || this._hostObject;
    Mixin.prototype._createProxyMethods.call(this, modelMethodsToProxy, modelHostObject);
}


/**
 * Model instance method.
 * Create and connect internal and external model's messengers.
 * External messenger's methods are proxied on the model and they allows "*" subscriptions.
 */
function _prepareMessengers() {
    // model will post all its changes on internal messenger
    var internalMessenger = new Messenger(this, undefined, undefined);

    // message source to connect internal messenger to external
    var internalMessengerSource = new MessengerMessageSource(this, undefined, new ModelMsgAPI, internalMessenger);

    // external messenger to which all model users will subscribe,
    // that will allow "*" subscriptions and support "changedata" message api.
    var externalMessenger = new Messenger(this, undefined, internalMessengerSource);

    _.defineProperty(this, MESSENGER_PROPERTY, externalMessenger);
    _.defineProperty(this, '_internalMessenger', internalMessenger);
}


function _getHostObject() {
    return this._hostObject;
}


function Model$destroy() {
    this[MESSENGER_PROPERTY].destroy();
    this._internalMessenger.destroy();
    this._destroyed = true;
}
