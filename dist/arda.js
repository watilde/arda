(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
var Component,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __hasProp = {}.hasOwnProperty;

module.exports = Component = (function(_super) {
  __extends(Component, _super);

  function Component() {
    return Component.__super__.constructor.apply(this, arguments);
  }

  Component.contextTypes = {
    shared: React.PropTypes.any
  };

  Component.prototype.dispatch = function() {
    var _ref;
    return (_ref = this.context.shared).emit.apply(_ref, arguments);
  };

  Component.prototype.createChildRouter = function(node) {
    var DefaultLayout, Router, childRouter;
    Router = require('./router');
    DefaultLayout = require('./default-layout');
    childRouter = new Router(DefaultLayout, node);
    return childRouter;
  };

  Component.prototype.createContextOnNode = function(node, contextClass, props) {
    var childRouter;
    childRouter = this.createChildRouter(node);
    return childRouter.pushContext(contextClass, props).then((function(_this) {
      return function(context) {
        return Promise.resolve(context);
      };
    })(this));
  };

  return Component;

})(React.Component);



},{"./default-layout":4,"./router":8}],3:[function(require,module,exports){
var Context, EventEmitter,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __hasProp = {}.hasOwnProperty;

EventEmitter = require('./event-emitter');

module.exports = Context = (function(_super) {
  __extends(Context, _super);

  function Context(_at__component, _at_props) {
    var subscribers, _ref;
    this._component = _at__component;
    this.props = _at_props;
    Context.__super__.constructor.apply(this, arguments);
    subscribers = (_ref = this.constructor.subscribers) != null ? _ref : [];
    this._onDisposes = [];
    this.delegate((function(_this) {
      return function(eventName, callback) {
        if (callback != null) {
          return _this.on(eventName, callback);
        } else {
          if (typeof Rx === "undefined" || Rx === null) {
            throw new Error('you need callback as second argument if you don\'t have Rx');
          }
          return Rx.Node.fromEvent(_this, eventName);
        }
      };
    })(this));
  }

  Context.prototype.dispose = function() {
    return Promise.all(this._onDisposes);
  };

  Context.prototype.getActiveComponent = function() {
    return this._component.refs.root;
  };

  Context.prototype.delegate = function(subscribe) {
    var subscribers, _ref;
    subscribers = (_ref = this.constructor.subscribers) != null ? _ref : [];
    return subscribers.forEach((function(_this) {
      return function(subscriber) {
        return subscriber(_this, subscribe);
      };
    })(this));
  };

  Context.prototype.update = function(stateFn) {
    if (stateFn == null) {
      stateFn = null;
    }
    return Promise.resolve((this.state == null) && this.props ? Promise.resolve(this.initState(this.props)).then((function(_this) {
      return function(_at_state) {
        _this.state = _at_state;
        return Promise.resolve();
      };
    })(this)) : void 0).then((function(_this) {
      return function() {
        var nextState, _ref;
        nextState = (_ref = typeof stateFn === "function" ? stateFn(_this.state) : void 0) != null ? _ref : _this.state;
        if (nextState != null) {
          _this.state = nextState;
        }
        return _this.expandComponentProps(_this.props, _this.state);
      };
    })(this)).then((function(_this) {
      return function(templateProps) {
        return _this._component.setState({
          activeContext: _this,
          templateProps: templateProps
        });
      };
    })(this));
  };

  Context.prototype.initState = function(props) {
    return props;
  };

  Context.prototype.expandComponentProps = function(props, state) {
    return props;
  };

  Context.prototype.render = function(templateProps) {
    var component;
    if (templateProps == null) {
      templateProps = {};
    }
    component = React.createFactory(this.constructor.component);
    return component(templateProps);
  };

  Context.prototype._initByProps = function(_at_props) {
    this.props = _at_props;
    return new Promise((function(_this) {
      return function(done) {
        return Promise.resolve(_this.initState(_this.props)).then(function(_at_state) {
          _this.state = _at_state;
          return done();
        });
      };
    })(this));
  };

  return Context;

})(EventEmitter);



},{"./event-emitter":5}],4:[function(require,module,exports){
var T;

T = React.PropTypes;

module.exports = React.createClass({
  childContextTypes: {
    shared: T.any
  },
  getChildContext: function() {
    return {
      shared: this.state.activeContext
    };
  },
  getInitialState: function() {
    return {
      activeContext: null,
      templateProps: {}
    };
  },
  render: function() {
    var _ref;
    if (this.state.activeContext != null) {
      this.state.templateProps.ref = 'root';
      return React.createFactory((_ref = this.state.activeContext) != null ? _ref.constructor.component : void 0)(this.state.templateProps);
    } else {
      return React.createElement('div');
    }
  }
});



},{}],5:[function(require,module,exports){
module.exports = require('events').EventEmitter;



},{"events":1}],6:[function(require,module,exports){
var Arda;

module.exports = Arda = {};

Arda.Component = require('./component');

Arda.Context = require('./context');

Arda.DefaultLayout = require('./default-layout');

Arda.Router = require('./router');

Arda.mixin = require('./mixin');

Arda.subscriber = function(id) {
  return id;
};



},{"./component":2,"./context":3,"./default-layout":4,"./mixin":7,"./router":8}],7:[function(require,module,exports){
module.exports = {
  contextTypes: {
    shared: React.PropTypes.any
  },
  dispatch: function() {
    var _ref;
    return (_ref = this.context.shared).emit.apply(_ref, arguments);
  },
  createChildRouter: function(node) {
    var DefaultLayout, Router, childRouter;
    Router = require('./router');
    DefaultLayout = require('./default-layout');
    childRouter = new Router(DefaultLayout, node);
    return childRouter;
  },
  createContextOnNode: function(node, contextClass, props) {
    var childRouter;
    childRouter = this.createChildRouter(node);
    return childRouter.pushContext(contextClass, props).then((function(_this) {
      return function(context) {
        return Promise.resolve(context);
      };
    })(this));
  }
};



},{"./default-layout":4,"./router":8}],8:[function(require,module,exports){
var EventEmitter, Router,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __hasProp = {}.hasOwnProperty;

EventEmitter = require('./event-emitter');

module.exports = Router = (function(_super) {
  __extends(Router, _super);

  function Router(layoutComponent, _at_el) {
    var Layout;
    this.el = _at_el;
    this._locked = false;
    this._disposers = [];
    this.history = [];
    if (this.el) {
      Layout = React.createFactory(layoutComponent);
      this._rootComponent = React.render(Layout(), this.el);
      this._rootComponent.isRoot = true;
    }
  }

  Router.prototype.isLocked = function() {
    return this._locked;
  };

  Router.prototype.dispose = function() {
    return Promise.all(this._disposers.map((function(_this) {
      return function(disposer) {
        return disposer();
      };
    })(this))).then((function(_this) {
      return function() {
        return new Promsie(function(done) {
          var popUntilBlank;
          return (popUntilBlank = function() {
            if (_this.history.length > 0) {
              return _this.popContext().then(function() {
                return popUntilBlank();
              });
            } else {
              return done();
            }
          })();
        }).then(function() {
          _this.diposed = true;
          _this._lock = true;
          delete _this.history;
          delete _this._disposers;
          _this.removeAllListeners();
          Object.freeze(_this);
          if (_this.el != null) {
            React.unmountComponentAtNode(_this.el);
          }
          return _this.emit('router:disposed');
        });
      };
    })(this));
  };

  Router.prototype.pushContextAndWaitForBack = function(contextClass, initialProps) {
    if (initialProps == null) {
      initialProps = {};
    }
    return new Promise((function(_this) {
      return function(done) {
        return _this.pushContext(contextClass, initialProps).then(function(context) {
          return context.on('context:disposed', done);
        });
      };
    })(this));
  };

  Router.prototype.pushContext = function(contextClass, initialProps) {
    var lastContext;
    if (initialProps == null) {
      initialProps = {};
    }
    this._lock();
    if (lastContext = this.activeContext) {
      lastContext.emit('context:paused');
    }
    this.activeContext = new contextClass(this._rootComponent, initialProps);
    return this._mountToParent(this.activeContext, initialProps).then((function(_this) {
      return function() {
        _this.history.push({
          name: contextClass.name,
          props: initialProps,
          context: _this.activeContext
        });
        _this._unlock();
        _this.activeContext.emit('context:created');
        _this.activeContext.emit('context:started');
        return _this.emit('router:pushed', _this.activeContext);
      };
    })(this)).then((function(_this) {
      return function() {
        return _this.activeContext;
      };
    })(this));
  };

  Router.prototype.popContext = function() {
    var lastContext;
    if (this.history.length <= 0) {
      throw 'history stack is null';
    }
    this._lock();
    this.history.pop();
    return Promise.resolve((lastContext = this.activeContext) ? this._disposeContext(lastContext) : void 0).then((function(_this) {
      return function() {
        var _ref;
        _this.activeContext = (_ref = _this.history[_this.history.length - 1]) != null ? _ref.context : void 0;
        if (_this.activeContext != null) {
          return _this._mountToParent(_this.activeContext, _this.activeContext.props);
        } else {
          return _this._unmountAll();
        }
      };
    })(this)).then((function(_this) {
      return function() {
        if (_this.activeContext) {
          _this.activeContext.emit('context:started');
          _this.activeContext.emit('context:resumed');
          _this.emit('router:popped', _this.activeContext);
        } else {
          _this.emit('router:blank');
        }
        return _this._unlock();
      };
    })(this)).then((function(_this) {
      return function() {
        return _this.activeContext;
      };
    })(this));
  };

  Router.prototype.replaceContext = function(contextClass, initialProps) {
    var lastContext;
    if (initialProps == null) {
      initialProps = {};
    }
    if (this.history.length <= 0) {
      throw 'history stack is null';
    }
    this._lock();
    lastContext = this.activeContext;
    return Promise.resolve(lastContext ? this._disposeContext(lastContext) : null).then((function(_this) {
      return function() {
        _this.activeContext = new contextClass(_this._rootComponent, initialProps);
        _this.activeContext.emit('context:created');
        _this.activeContext.emit('context:started');
        return _this._mountToParent(_this.activeContext, initialProps);
      };
    })(this)).then((function(_this) {
      return function() {
        _this.history.pop();
        _this.history.push({
          name: contextClass.name,
          props: initialProps,
          context: _this.activeContext
        });
        _this._unlock();
        return _this.emit('router:replaced', _this.activeContext);
      };
    })(this)).then((function(_this) {
      return function() {
        return _this.activeContext;
      };
    })(this));
  };

  Router.prototype._mountToParent = function(context, initialProps) {
    return this._initContextWithExpanding(context, initialProps).then((function(_this) {
      return function(templateProps) {
        return _this._outputByEnv(context, templateProps);
      };
    })(this));
  };

  Router.prototype._unmountAll = function() {
    return this._outputByEnv(null);
  };

  Router.prototype._outputByEnv = function(activeContext, props) {
    if (this.el != null) {
      return this._outputToDOM(activeContext, props);
    } else {
      return this._outputToRouterInnerHTML(activeContext, props);
    }
  };

  Router.prototype._outputToDOM = function(activeContext, props) {
    return this._rootComponent.setState({
      activeContext: activeContext,
      templateProps: props
    });
  };

  Router.prototype._outputToRouterInnerHTML = function(activeContext, templateProps) {
    var rendered;
    if (activeContext) {
      rendered = React.createFactory(activeContext.constructor.component)(templateProps);
      return this.innerHTML = React.renderToString(rendered);
    } else {
      return this.innerHTML = '';
    }
  };

  Router.prototype._unlock = function() {
    return this._locked = false;
  };

  Router.prototype._lock = function() {
    return this._locked = true;
  };

  Router.prototype._disposeContext = function(context) {
    delete context.props;
    delete context.state;
    context.emit('context:disposed');
    if (typeof context.removeAllListeners === "function") {
      context.removeAllListeners();
    }
    context.dispose();
    context.disposed = true;
    return Object.freeze(context);
  };

  Router.prototype._initContextWithExpanding = function(context, props) {
    return context._initByProps(props).then((function(_this) {
      return function() {
        return context.expandComponentProps(context.props, context.state);
      };
    })(this));
  };

  return Router;

})(EventEmitter);



},{"./event-emitter":5}]},{},[6]);
