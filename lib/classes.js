'use strict';

// <a name="classes"></a>
// milo.classes
// -----------

// This module contains foundation classes

var classes = {
    Mixin: require('./abstract/mixin'),
    MessageSource: require('./messenger/m_source'),
    MessengerMessageSource: require('./messenger/msngr_source'),
    MessengerAPI: require('./messenger/m_api'),
    MessengerRegexpAPI: require('./messenger/m_api_rx')
};

module.exports = classes;
