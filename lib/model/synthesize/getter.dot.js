'use strict';
/* Only use this style of comments, not "//" */

return function get(options) {
    var m = {{# def.modelAccessPrefix }};
    var ret =  m {{~ it.parsedPath :pathNode }}
        {{? pathNode.interpolate}}
            && (m = m[this._args[ {{= pathNode.interpolate }} ]])
        {{??}}
            && (m = m{{= pathNode.property }})
        {{?}} {{~}};

    if (options && options.destroyAfterUse) {
        this.destroy();
    }

    return ret;
};
