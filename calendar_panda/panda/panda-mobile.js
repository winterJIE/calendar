(function () {
	/**
	 * ERROR START
	 */
	var Stack = {
        list:[],
        extractStacktrace:function(e, offset) {
            offset = offset === undefined ? 3 : offset;
            var stack, include, i;
			this.list.push(e);
            if (e.stacktrace) {
                return e.stacktrace.split("\n")[ offset + 3 ];
            } else if (e.stack) {
                stack = e.stack.split("\n");
                for (i = offset; i < stack.length; i++) {
                    this.list.push(stack[ i ]);
                }
            }
        },
        get:function (){
            return this.list.splice(0).join("\n");
        }
    };
	/**
	 * ERROR END
	 */
	var config = {
		charset:"UTF-8",
		path:""
	};
	
	var scriptNode = document.getElementById('panda');
	if(scriptNode) {
		config.path = scriptNode.getAttribute ? scriptNode.getAttribute('base') : scriptNode.base;
	}
	if(!config.path) {
		var splits = location.href.split('/');
		splits.pop();
		config.path = splits.join('/');
	}
	var head = document.getElementsByTagName("head")[0];
	
	/**
	 * PROMISE START
	 */
	var PromiseA = {};
	function Deferred() {
		var self = this;
		var successCallback = [], failCallback = [], state = "Pending";
		var value;
		
		function Promise() {
			var self = this;
			self.success = function(callback) {
				if(state == "Resolved") {
					callback.call(self, value);
				}else {
					successCallback.push(callback);
				}
				
				return self;
			};
			self.fail = function(callback) {
				if(state == "Rejected") {
					callback.call(self, value);
				}else {
					failCallback.push(callback);
				}
				
				return self;
			};
			self.then = function(onSuccess, onError) {
				return self.success(onSuccess).fail(onError);
			};
			self.always = function(callback) {
				return self.success(callback).fail(callback);
			};
		}
		
		self.promise = new Promise();
		self.resolve = function(result, data) {
			if (state === "Pending") {
                state = "Resolved";
                value = result;
				for(var i=0;i<successCallback.length;i++) {
					(function() {
						successCallback[i].call(self.promise, result, data);
					})();
				}
            }
		};
		self.reject = function(result) {
			if (state === "Pending") {
                state = "Rejected";
                value = result;
				for(var i=0;i<successCallback.length;i++) {
					(function() {
						successCallback[i].call(self.promise, result);
					})();
				}
            }
		};
	}
	
	function when(value, data) {
		var promises = value instanceof Array ? value : [value];
		var total = promises.length, completed = 0;
		var def = new Deferred();
		for(var i=0;i<promises.length;i++) {
			(function() {
				var pro = promises[i];
				pro.always(function(value) {
					completed++;
					if(completed === total) {
						def.resolve(value, data);
					}
				});
			})();
		}
		
		return def.promise;
	}
	
	PromiseA.Deferred = Deferred;
	PromiseA.when = when;
	/**
	 * PROMISE END
	 */
	
	/**
	 * AMD START
	 */
	var REQUIRE_RE = /require\(('|")([^()<>\\\/|?*:]*)('|")\)/g;
	//var COMMENT_RE = /(\/\*(\s|.)*?\*\/)|(\/\/\s*.*)/ig;
	var COMMENT_RE = /(\/\*(.|[\r\n])*?\*\/)|((\/\/.*))/g;
	var moduleCache = {};
	function request(id) {
		var node = document.createElement('script');
		node.charset = config.charset;
		node.src = config.path + "/" + id.replace(/\./g, '/') + '.js';
		node.async = true;
		
		var def = new PromiseA.Deferred();
		
		node.onload = node.onreadystatechange = function() {
			if(/^(?:loaded|complete|undefined)$/.test(node.readyState)) {
				node.onload = node.onerror = node.onreadystatechange = null;
				if (moduleCache[id] && moduleCache[id].factory) {
					moduleCache[id].state = 1;
					var flag = true;
					for(var i=0;i<moduleCache[id].deps.length;i++) {
						var testCache = moduleCache[moduleCache[id].deps[i]];
						if(!testCache || testCache.state < 1) {
							flag = false;
							break;
						}
					}
					if(flag) {
						def.resolve(id);
						return;
					}else {
						load(moduleCache[id], function() {def.resolve(id);});	
					}
				}else {
					setTimeout(arguments.callee, 0);
				}
			}
		};
		node.onerror = function() {
			node.onload = node.onerror = node.onreadystatechange = null;
			throw new Error("Module("+id+") requested error.");
			def.resolve(id);
		};
		// IE local filesystem just load timefly
		if(node.src.toLowerCase().indexOf("file:") == 0)
		node.onload();
		nodeCache = node;
		head.appendChild(node);
		nodeCache = null;
		
		return def.promise;
	}
	function getDeps(factory) {
		var result = [];
		factory.toString().replace(COMMENT_RE, '').replace(REQUIRE_RE, function(match, f1, f2, f3) {
			result.push(f2);
		});
		return result;
	}
	function unloaded(module) {
		module = typeof module == 'string' ? moduleCache[module] : module;
		var result = [];
		if(module) {
			var deps = module.deps;
			if(deps.length == 0) {
				deps = module.deps = getDeps(module.factory);
			}
			for(var i=0;i<deps.length;i++) {
				if(!moduleCache[deps[i]] || !moduleCache[deps[i]].factory) {
					result.push(deps[i]);
				}
			}
		}
		return result;
	}
	function execute(module, id) {
		function require(id) {
			return execute(moduleCache[id], id);
		}
		if(!module) {
			throw new Error("Can't find Module("+id+"), is it exists or right name?");
		}
		if(module.state < 2) {
			moduleCache[module.id].state = 2;
			var exports = module.factory.call(module, require, module.exports, module);
			if(exports) {
				module.exports = exports;
			}
		}
		if(!/PANDA\:\d{13}/.test(module.id)) {
			panda.regist(module.id, module.exports);
		}
		return module.exports;
	}
	function status(module, value) {
		for(var i=0;i<module.deps.length;i++) {
			moduleCache[module.deps[i]].state = value;
		}
	}
	function getModule(id, deps, factory) {
		if(id && !moduleCache[id]) {
			return moduleCache[id] = {id:id, deps:deps, factory:factory, state:0, exports:null};
		}
		
		return moduleCache[id];
	}
	function load(module, callback) {
		function done(id, callback) {
			var module = getModule(id);
			module.state < 1 && (module.state = 1);
			var reunload = [];
			for(var i=0;i<module.deps.length;i++) {
				reunload.concat(unloaded(module.deps[i]));
			}
			
			if(reunload.length) {
				module.deps = module.deps.concat(reunload);
				load(module, callback);
			}else {
				var redeps = [];
				for(var i=0;i<module.deps.length;i++) {
					var remodule = getModule(module.deps[i]);
					remodule.state > 0 && (redeps.concat(getDeps(remodule.factory)));
				}
				if (redeps.length) {
					var repros = [];
					for(var i=0;i<redeps.length;i++) {
						repros.push(request(redeps[i]));
					}
					PromiseA.when(repros, callback).then(load);
				}else {
					callback && callback(module);
				}
			}
		}
		
		var unload = unloaded(module);
		if(!unload.length) {
			callback && callback(module);
			return;
		}
		
		var pros = [];
		for(var i=0;i<unload.length;i++) {
			pros.push(request(unload[i]));
		}

		PromiseA.when(pros, callback).then(done);
	}
	/**
	 * AMD END
	 */
	var timestamp = new Date().getTime();
	window.define = function(id, deps, factory) {
		if(typeof id == 'function') {
			factory = id;
			id = "PANDA:"+(timestamp++);
		}
		var deps = (deps || []).concat(getDeps(factory));
		var module = getModule(id, deps, factory);
		if(/PANDA\:\d{13}/.test(id))
			load(module, function() {
				execute(module);
			});
	};
	
	var panda = window.panda;
	if(panda && panda.version)
		return;
		
	panda = function() {
		var param = arguments[0];
        if(param && typeof param == 'string') {
            return panda.query(param, arguments[1]);
        }
        if(param && typeof param == 'object') {
            if(param instanceof Array && param.__type__ !== "panda.dom") {
                return panda.array.createArray(param);
            }else {
                return panda.query(param);
            }
        }
        if(param && typeof param == 'function') {
            return panda.ready(param);
        }
	};
	var _rl_ = [];
	panda.ready = function(callback) {
        if(callback && typeof callback == 'function')
            _rl_.push(callback);
        if(this.isReady) {
            var call = null;
            while(call = _rl_.shift()) {
                define(call);
            }
        }
    };
	panda.allReady = function() {
		panda.ready();
	};
	panda.regist = function(id, func) {
		var name = id.replace(/^base\./, '').split('.'),ns,last = panda, str = name.join('"]["');
		while(ns = name.shift()) {
			last[ns] = last[ns] || {};
			last = last[ns];
		}
		last !== panda && (
			// panda[''][''] = func
			eval('panda["'+str+'"]=func')
		);
	};
	panda.use = define;
	panda.EXTEND_OBJECT_POOL = {};
	panda.isReady = false;
	panda.Deferred = PromiseA.Deferred;
	panda.when = PromiseA.when;
	panda.stack = Stack;
	window.panda = panda;
	
	function onDOMContentLoaded(onready, config) {
		function DOMContentLoaded() {
			document.attachEvent ? (document.readyState == 'complete' ? doReady() : null) : doReady();
		}
		
        function doReady() {
            if (!panda.isReady) {
				panda.isReady = true;
				onready();
			}
        }
        
		if ( document.readyState === "complete" ) {
            doReady();
        }
        else if ( document.addEventListener ) {
            document.addEventListener( "DOMContentLoaded", DOMContentLoaded, false );
            window.addEventListener( "load", doReady, false );
        } 
		else if ( document.attachEvent ) {
            document.attachEvent("onreadystatechange", DOMContentLoaded);
            window.attachEvent( "onload", doReady );
            var toplevel = false;
            try {
                toplevel = window.frameElement == null;
            } catch(e) {}

            if ( document.documentElement.doScroll && toplevel ) {
                (function () {
	                if (panda.isReady) return;
	                try {
	                    document.documentElement.doScroll("left");
	                } catch (error) {
	                    setTimeout(arguments.callee, 0);
	                    return;
	                }
	                doReady();
	            })();
            }
        }
    }
	
	onDOMContentLoaded(function(){
		define(function(require) {
			require("base.global");
		});
        var _ct_ = setInterval(function() {
			var module = moduleCache["base.global"];
            if (module && module.state >= 2) {
				clearInterval(_ct_);
                panda.allReady();
            }
        }, 0);
    });
}());
define("base.array",[],function (require, exports, module) {
	var _obj = require("base.object");
	
	var _arr = _obj.create();
	_arr = {
    	index:function() {
			var value = arguments[0];
			var self = this;
			
			for (var i = 0, il = self.length; i < il; i++) {
	            if (self[i] == value) {
	                return i;
	            }
	        }
	        return -1;
		},
		insert:function() {
			var value = arguments[0];
			var self = this;
			var index = arguments[1];
			
			index = isNaN(index) ? self.length : index;
			
			return self.slice(0, index).concat(value, self.slice(index));
		},
		map:function() {
			var value = arguments[0];
			var self = this;
			
			var len = self.length;
			var res = new Array();
			
			if(typeof value == 'function') {
	        	for (var i = 0; i < len; i++) {
		            if (i in self)
		                res[i] = value.call(self[i], self[i], i, self);
		        }
			}
	
	        return _obj.merge(res, _arr);
		},
		remove:function() {
			var value = arguments[0];
			var self = this;
			
			while(value < 0) {
				value += self.length;
			}
			
			var arr1 = self.slice(0, value);
	        var arr2 = self.slice(value + 1);
	        return arr1.concat(arr2);
		},
		unique:function() {
			var value = arguments[0];
			var self = this;
			
			for (var i = 0; i < self.length; i++) {
	            var it = self[i];
	            for (var j = self.length - 1; j > i; j--) {
	                if (self[j] == it) self.splice(j, 1);
	            }
	        }
	        return self;
		}
    };
	_arr.each = function() {
		var value = arguments[0];
		var self = this;
		var len = self.length;
		var res = new Array();
		
		if(typeof value == 'function') {
        	for (var i = 0; i < len; i++) {
	            if (i in self)
	                value.call(null, self[i], i, self);
	        }
		}
		return this;
	};
	
	_arr.createArray = function(value) {
		var result = [];
		if(typeof value == 'object') {
			if(value.length != 'undefined') {
				for(var i=0;i<value.length;i++) {
					result.push(value[i]);
				}
			}
		}
		return _obj.merge(result, _arr);
	};
	
	_arr = _obj._extend(_arr, []);
	_arr.__type__ = "panda.array";
	
	module.exports = _arr;
});
/**
 * Created with JetBrains WebStorm.
 * User: sunqingwei
 * Date: 13-4-11
 * Time: 上午9:22
 * To change this template use File | Settings | File Templates.
 */
define("base.dom",[],function (require, exports, module) {
    var _object = require("base.object"),
        _class = require("base.dom.class"),
        _style = require("base.dom.style"),
        _size = require("base.dom.size"),
        _attr = require("base.dom.attr"),
        _create = require("base.dom.create"),
        _traversal = require("base.dom.traversal"),
        _insertion = require("base.dom.insertion"),
		_position = require("base.dom.position"),
        _event = require("base.event"),
        _data = require("base.dom.data"),
        _animate = require("base.dom.animate");


    var DOM = {};
	DOM.__type__ = "panda.dom";
    DOM = _object.merge(DOM, _class);
    DOM = _object.merge(DOM, _size);
    DOM = _object.merge(DOM, _style);
    DOM = _object.merge(DOM, _attr);
    DOM = _object.merge(DOM, _create);
    DOM = _object.merge(DOM, _traversal);
    DOM = _object.merge(DOM, _insertion);
    DOM = _object.merge(DOM, _event);
	DOM = _object.merge(DOM, _position);
	DOM = _object.merge(DOM, _data);
	DOM = _object.merge(DOM, _animate);

    module.exports = DOM;
});
/**
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-6-18
 * Time: 下午5:54
 */
/**
 * @class event
 * @constructor
 */
define("base.event", [], function(require, exports, module) {
	var eventModule = {
		on: function(evType, func, useCapture){
			this.each(function(elm) {
				if (typeof useCapture == 'undefined') {
					useCapture = false;
				}
				if (typeof evType == 'undefined') {
					evType = 'click';
				}
				elm.addEventListener(evType, func, useCapture);
			});
			return this;
		},
		un: function(type, func) {
			this.each(function(target) {
				type = type.replace(/^on/i, '');
				target.removeEventListener(type, func, false);
			});
			return this;
		},
		get: function() {
			if(window.event) {
				return window.event;
			}
			var ori = arguments.callee.caller;
			var ev;
			var count = 0;
			while(ori != null && count < 40) {
				ev = ori.arguments[0];
				if(ev && (ev.constructor == Event || e.constructor == MouseEvent || ev.constructor == KeyboardEvent)) {
					return ev;
				}
				count++;
				ori = ori.caller;
			}
			
			return ev;
		},
		fix: function(e) {
			e = e || eventModule.get();
			if(!e.target) {
				e.target = e.srcElement;
				e.pageX = e.x;
				e.pageY = e.y;
			}
			
			return e;
		},
		stop: function(e) {
			e = e || eventModule.get();
			e.preventDefault();
			e.stopPropagation();
			
			return false;
		},
		fire: function(event) {
			this.each(function(target) {
				var e = document.createEvent('Events');
				e.initEvent(event, true, true);
				target.dispatchEvent(e);
			});
			return this;
		}
	};
	
	eventModule.bind = eventModule.on;
	eventModule.unbind = eventModule.un;
	eventModule.trigger = eventModule.fire;
	
	return eventModule;
});
/**
 * author: lizihan
 * Date: 13-11-14
 * Time: 下午3:14
 */
/**
 * @class gesture
 * @constructor
 */
define("base.gesture", [], function(require) {
	var touch = {};
	var touchTimeout, tapTimeout, swipeTimeout, longTapTimeout;
	var longTapDelay = 750;
	var gesture = null;
	
	var directionX = 1;
	var directionY = 1;
	
	var swipeDirection = function(x1, x2, y1, y2) {
		return (Math.abs(x1-x2) * directionX) >= (Math.abs(y1-y2) * directionY) ?
			(x1 - x2 > 0 ? 'Left' : 'Right') :
			(y1 - y2 > 0 ? 'Up' : 'Down');
	};
	
	var longTap = function() {
		longTapTimeout = null;
		if(touch.last) {
			touch.el.trigger('longTap');
			touch = {};
		}
	};
	
	var cancelLongTap = function() {
		if(longTapTimeout) {
			clearTimeout(longTapTimeout);
		}
		longTapTimeout = null;
	};
	
	var cancelAll = function() {
		clearTimeout(touchTimeout);
		clearTimeout(tapTimeout);
		clearTimeout(swipeTimeout);
		clearTimeout(longTapTimeout);
		
		touchTimeout = tapTimeout = swipeTimeout = longTapTimeout = null;
		
		touch = {};
	};
	
	var isPrimaryTouch = function(event) {
		// IE10 MSPOINTER_TYPE_TOUCH=2, IE11 = touch
		return (event.pointerType == 2 || event.pointerType == 'touch') && event.isPrimary;
	};
	
	var isMS = function(type, target) {
		return type.toLowerCase().indexOf(target) > -1;
	};
	
	panda.ready(function() {
		var self = this;
		var now, delta, deltaX = 0, deltaY = 0, firstTouch = null;
		if('MSGesture' in window) {
			gesture = new MSGesture();
			gesture.target = document.body;
		}
		
		var doc = panda(document.body);
		doc.bind('MSGestureEnd', function(e) {
			e = e || window.event;
			var swipeDirectionFromVelocity = 
				e.velocityX > 1 ? 'Right' : 
					e.velocityX < -1 ? 'Left' :
						e.velocityY > 1 ? 'Down' :
							e.veolcityY < -1 ? 'Up' :
								null;
			
			if(swipeDirectionFromVelocity) {
				touch.el.trigger('swipe');
				touch.el.trigger('swipe' + swipeDirectionFromVelocity);
			}
		});
		
		function touchStartHandler(e) {
			cancelAll();
			e = e || window.event;
			if(isMS(e.type, 'pointerdown') && !isPrimaryTouch(e))
				return;
			firstTouch = isMS(e.type, 'pointerdown') ? e : e.touches[0];
			now = new Date().getTime();
			delta = now - (touch.last || now);
			touch.el = panda('tagName' in firstTouch.target ? firstTouch.target : firstTouch.target.parentNode);
			touchTimeout && clearTimeout(touchTimeout);
			touch.x1 = firstTouch.pageX;
			touch.y1 = firstTouch.pageY;
			if(delta > 0 && delta <= 250)
				touch.isDoubleTap = true;
			touch.last = now;
			longTapTimeout = setTimeout(longTap, longTapDelay);
			if(gesture && isMS(e.type, 'pointerdown'))
				gesture.addPointer(e.pointerId);
		}
		doc.bind('touchstart', touchStartHandler);
		doc.bind('MSPointerDown', touchStartHandler);
		
		function touchMoveHandler(e) {
			e = e || window.event;
			if(isMS(e.type, 'pointermove') && !isPrimaryTouch(e))
				return;
				
			firstTouch = isMS(e.type, 'pointermove') ? e : e.touches[0];
			cancelLongTap();
			touch.x2 = firstTouch.pageX;
			touch.y2 = firstTouch.pageY;
			
			deltaX += Math.abs(touch.x1 - touch.x2);
			deltaY += Math.abs(touch.y1 - touch.y2);
		}
		doc.bind('touchmove', touchMoveHandler);
		doc.bind('MSPointerMove', touchMoveHandler);
	
		function touchEndHandler(e) {
			e = e || window.event;
			
			if(isMS(e.type, 'pointerup') && !isPrimaryTouch(e))
				return;
			
			cancelLongTap();
			if((touch.x2 && Math.abs(touch.x1 - touch.x2) > 30) ||
				(touch.y2 && Math.abs(touch.y1 - touch.y2) > 30)
			) {
				swipeTimeout = setTimeout(function() {
					touch.el.trigger('swipe');
					touch.el.trigger('swipe' + swipeDirection(touch.x1, touch.x2, touch.y1, touch.y2));
					toudh = {};
				}, 0);
			}
			else if('last' in touch) {
				if(deltaX < 30 && deltaY < 30) {
					tapTimeout = setTimeout(function() {
						touch.el.trigger('tap');
						if(touch.isDoubleTap) {
							touch.el.trigger('doubleTap');
							touch = {};
						}
						else {
							touchTimeout = setTimeout(function() {
								touchTimeout = null;
								touch.el.trigger('singleTap');
								touch = {};
							}, 250);
						}
					}, 0);
				}else {
					touch = {};
				}
				deltaX = deltaY = 0;
			}
		}
		doc.bind('touchend', touchEndHandler);
		doc.bind('MSPointerUp', touchEndHandler);
		
		doc.bind('touchcancel', cancelAll);
		doc.bind('pointercancel', cancelAll);
	});
	
	return {
		setDirection:function(x, y) {
			if(x) {
				directionX = x;
			}
			if(y) {
				directionY = y;
			}
		}
	};
});

/**
 * 全局变量配置文件
 * User: lizihan
 * Date: 13-06-14
 * Time: 11:35
 */
define("base.global",[],function(require,exports,module){
	require("base.array");
	require("base.dom");
	require("base.object");
	require("base.query");
	require("base.string");
	require("base.system");
	require("base.util");
	require("base.widget");
	require("base.gesture");
	
	panda.__type__ = 'panda.global';
	
	module.exports = {};
});
/**
 * User: sunqingwei
 * Date: 13-5-6
 * Time: 下午4:54
 */
/**
 * @class object
 * @contructor
 */
define("base.object", [], function (require, exports, module) {
    var class2type = {},
        toString = class2type.toString;
	
	function isType(type) {
        return function (obj) {
            return Object.prototype.toString.call(obj) === "[object " + type + "]";
        };
    }
	
    var _Object = {
		isArray:Array.isArray || isType("Array"),
		isObject:isType("Object"),
		isString:isType("String"),
		isFunction:isType("Function"),

        /**
         * @method    create        创建一个带构造函数的类
         * @update    lizihan
         */
        create: function () {
            return function () {
                if (typeof this.initialize != "undefined")
                    this.initialize.apply(this, arguments);
            };
        },
        /**
         * @method extend       类之间的继承
         * @param subClass      子类
         * @param superClass    父类
         * @param px            属性
         */
        extend: function (subClass, superClass, px) {
			if (!superClass || !subClass) throw Error();
            var F = function () {
				if(superClass.apply)
                	superClass.apply(this);
            };
            F.prototype = superClass.prototype;
            subClass.prototype = new F();
            subClass.prototype.constructor = subClass;
            subClass.superclass = superClass.prototype;
            if (px) {
                for (var k in px) {
                    if (px.hasOwnProperty(k)) subClass.prototype[k] = px[k];
                }
            }
            return subClass;
            
        },
        /**
         * @method parameter 参数合并
         * @param options
         * @param defaults 默认参数
         * @returns {{}}
         */
        parameter: function (options, defaults) {
            var _o = options || {};
            var _defaults = defaults || {};
            for (var key in _defaults) {
                _o[key] = _o.hasOwnProperty(key) ? _o[key] : _defaults[key];
            }
            return _o;
        },

        /**
         * @method merge 合并两个对象
         * @param destination
         * @param source
         */
        merge: function (destination, source) {
            var _des = destination || {};
            if (_Object.isArray(destination) && _Object.isArray(source)) {
                _des = _des.concat(source);
            } else if (typeof _des == "object" || typeof _des == 'function') {
                for (var key in source) {
                    var val = source[key];
                    (typeof val == "object" && typeof _des[key] == "object") ? _des[key] = arguments.callee(_des[key], val) : _des[key] = val;
                }
            }
            return _des;
        },
        /**
         * @method bind 变更作用域
         * @param func
         * @param scope
         */
        bind: function (func, scope, args) {
            try {
                var me = func;

                if (typeof args != 'array') {
                    args = [args];
                }

                return function () {
                    return me.apply(scope, args);
                };
            } catch (err) {

            }
        },

        _extend: function (nodeList, obj, preScope) { // TODO
            var list = nodeList || [];
            for (var key in obj) {
                list[key] = obj[key];
                list.prevObject = preScope;
            }
			for (var key in panda.EXTEND_OBJECT_POOL) {
                list[key] = panda.EXTEND_OBJECT_POOL[key];
            }
            list.each = function (func) {
                for (var i = 0; i < this.length; i++) {
                    func(this[i], i);
                }
            };
            return list;
        },
		
		isEmptyObject: function( obj ) {
            for ( var name in obj ) {
                return false;
            }
            return true;
        },
		
		isWindow: function (obj) {
            return obj != null && obj == obj.window;
        },
		
		makeArray:function(list) {
	        if (!list) return;
	        var rtn = [], len = list.length;
	        for (var i = 0; i < len; i++) {
	            rtn.push(list[i]);
	        }
	        return rtn;
	    }
    };

    panda = _Object.merge(panda, _Object);

    module.exports = _Object;
});
define("base.query", [], function(require) {
	var obj = require("base.object");
	
	function Sizzle( selector, context) {
		var _dom = require("base.dom");
	
		if(typeof context == 'string' && context != '') {
			context = Sizzle(context);
		}
	
		context = context || document;
	
		if (!selector) {
            return obj._extend([], _dom);
        }
        if (selector instanceof Object) {
            if (selector && selector.__type__ == "panda.dom") {
                return selector;
            }
            return obj._extend([selector], _dom);
        }
		if(selector instanceof Array) {
			selector = selector.join();
		}
        if(typeof selector == 'string' && selector.charAt(0) == '<' && selector.charAt(selector.length-1) == '>' && selector.length >= 3) {
			return _dom.create(selector);
		}
		
		var newContext = context && context[0] ? context[0] : context;
		
		try {
			var whitespace = "[\\x20\\t\\r\\n\\f]";
			var rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*)" + whitespace + "*\\]", "g" );
			selector = selector.replace( rattributeQuotes, "='$1']" );
			var results = newContext.querySelectorAll(selector);
			return obj._extend(obj.makeArray(results), _dom);
		} catch(qsaError) {
			return obj._extend([], _dom);
		}
	}
	
	return Sizzle;
});
/**
 * String配置文件
 * User: lizihan
 * Date: 13-05-08
 * Time: 16:41
 */
define("base.string", [], function(require,exports,module){
	var _obj = require("base.object");
	var _str = {
		bytesLength:function() {
			var value = arguments[0];
			var self = this;
			
			if(!self || !self.length) {
				return 0;
			}
			
			var regex = self.match(/[^\x00-\xff]/g);
			return (self.length + (!regex?0:regex.length));
		},
		trim:function(noMore) {
			var result = this.replace(/(^(\u3000|\s|\t|\u00A0)*)|((\u3000|\s|\t|\u00A0)*$)/g, '');
			
			if(noMore) {
				result = result.replace(/(\u3000|\s|\t|\u00A0){1,9999}/g, ' ');
			}
			
			return _obj.merge(new String(result), _str);
		}
	};
	_str.__type__ = "panda.string";

	return _obj.extend({
		create:function(value) {
			if(value == null || value == undefined)
				value = "";
			return _obj.merge(new String(value), _str);
		}
	}, new String(""), _str);
});
/**
 * System配置文件
 * User: lizihan
 * Date: 13-06-13
 * Time: 14:29
 */
define("base.system",[],function(require,exports,module){
	var _obj = require("base.object");
	var _system = {};
	
	var _browser = require("base.system.browser");
	var _cookie = require("base.system.cookie");
	
	_system.__type__ = "panda.system";
	
	_system = _obj.merge(_system, {
		browser: _browser
	});
	_system = _obj.merge(_system, {
		cookie: _cookie
	});

	panda = _obj.merge(panda, _system);
	module.exports = _system;
})
/**
 * 工具配置文件
 * User: lizihan
 * Date: 13-06-14
 * Time: 11:35
 */
define("base.util",[],function(require,exports,module){
	var _obj = require("base.object");
	var _util = {};
	
	_util.__type__ = "panda.util";
	
	_util = _obj.merge(_util, {
		guid:require("base.util.guid"),
		Timer:require("base.util.Timer"),
		Tweener:require("base.util.Tweener")
	});
	_util = _obj.merge(_util, require("base.util.io"));
	
	panda = _obj.merge(panda, _util);
	
	module.exports = _util;
});
/**
 * 组件核心类
 * User: lizihan
 * Date: 13-07-22
 * Time: 18:08
 */
define("base.widget",[],function(require,exports,module){
	var _obj = require("base.object");
	var _bw = {};
	
	_bw.__type__ = "panda.widget";
	
	_bw = _obj.merge(_bw, {
		manager: require("base.widget.WidgetManager"),
		base: require("base.widget.Widget")
	});
	
	module.exports = _bw;
});
/**
 * User: sunqingwei
 * Date: 13-9-24
 * Time: 下午3:31
 */
/**
 * @class animate
 * @constructor
 */
define("base.dom.animate", [], function (require, exports, module) {
    var _object = require("base.object");
    var _tweens = require("base.util.tweens");
    /**
     * 动画time 的类型
     */
    var DEFAULT_ANIMATE_TYPE = {
        "fast": 200,
        "slow": 600
    };
    /**
     * 参数纠正
     */
    function fix(speed, easing, fn) {
        var opt = {};
        if (speed && !_object.isObject(speed)) {
            if (_object.isString(speed) && isNaN(speed)) {
                if (DEFAULT_ANIMATE_TYPE[speed])opt["time"] = DEFAULT_ANIMATE_TYPE[speed];
            } else if (!isNaN(speed)) {
                opt["time"] = parseFloat(speed);
            }
            if ((fn && easing || easing && _object.isString(speed) ) && _object.isFunction(_tweens[easing]))
                opt["type"] = fn && easing || easing && _object.isString(speed) && easing;
            if (fn || !fn && easing || _object.isFunction(speed) && speed)
                opt["onEnd"] = fn || !fn && easing || _object.isFunction(speed) && speed;
        } else if (_object.isObject(speed)) {
            opt = speed;
        }
        return opt;
    }

    var Animate = {
        /**
         * 动画
         * @method animate
         * @param properties  一组包含作为动画属性和终值的样式属性和及其值的集合
         * @param duration   三种预定速度之一的字符串("slow", "normal", or "fast")或表示动画时长的毫秒数值(如：1000)
         * @param easing    要使用的擦除效果的名称(需要插件支持).默认jQuery提供"linear" 和 "swing".
         * @param callback   在动画完成时执行的函数
         * @returns {object}
         * @example
         *
         *     // jQuery 中的animate 函数的使用方式
         *     $("#book").animate({
         *       opacity: 0.25,
         *       left: '+=50',
         *       height: 'toggle'
         *     }, 5000, function() {
         *       // Animation complete.
         *     });
         *
         *      // panda 中的animate 函数的使用方式
         *     panda("#book").animate({
         *       opacity: 0.25,
         *       left: '+=50',
         *       height: 'toggle'
         *     }, 5000, function() {
         *       // Animation complete.
         *     });
         */
        animate: function (properties, duration, easing, callback) {
            var self = this,
                opts = {},
                index = 0,
                i = 0;

            if (_object.isEmptyObject(properties))
                return self;

            opts = _object.parameter(opts, fix(duration, easing, callback));
            opts.to = properties;

            if (properties.hasOwnProperty('autoComplete')) {
                opts.autoComplete = properties.autoComplete;
            }

            panda(self).each(function (item, index) {
                item = panda(item);

                var tweenerQueue = item.data("__animate__");
                if (!tweenerQueue) {
                    item.data("__animate__", {});
                    tweenerQueue = {};
                } else {
                    if (tweenerQueue.isPlay) {
                        tweenerQueue.stop();
                    }
                }

                opts.target = item;
                var tweener = new panda.Tweener(opts);
                tweenerQueue = tweener;

                if (panda.isFunction(tweenerQueue.start))
                    tweenerQueue.start();

                item.data("__animate__", tweenerQueue);
            });

            return self;
        },
        stop: function () {
            panda(this).each(function (item, index) {
                item = panda(item);

                var tweenerQueue = panda(item).data("__animate__");
                if (!tweenerQueue) {
                    item.data("__animate__", {});
                    tweenerQueue = {};
                }

                if (panda.isFunction(tweenerQueue.stop))
                    tweenerQueue.stop();
            });

            return this;
        }
    };
    module.exports = Animate;
})
;

/**
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-5-8
 * Time: 下午1:32
 */

define("base.dom.attr", [], function (require, exports, module) {
    var pObj = require("base.object");
    var Attr = {
        /**
         * 为所有匹配的元素设置属性值。
         * @method attr
         * @param {string or object}key 属性 ： key 支持json 对象
         * @param {string}value 属性值
         * @constructor
         * @returns {object}
         * @example
         *
         *     // jQuery 中的attr 函数的使用方式
         *      jQuery("#id").attr({
         *          data-value:"111"
         *      })
         *      // panda 中的attr 函数的使用方式
         *      panda("#id").attr({
         *          data-value:"111"
         *      })
         *      或者
         *      panda.query("#id").attr({
         *          data-value:"111"
         *      })
         *
         */
        attr: function (key, value) {
            var self = this;
            if (pObj.isObject(key)) {
                self.each(function (el) {
                    for (var i in key) {
                        _set(el, i, key[i]);
                    }
                });
                return self;
            } else if (pObj.isString(key) && pObj.isString(value)) {
                self.each(function (el) {
                    _set(el, key, value);
                });
                return self;
            } else if (pObj.isString(key)) {
                return _get((this && this.length) ? this[0] : {}, key);
            }
        },
        /**
         * 删除属性
         * @method removeAttr
         * @param key 删除的属性的名称
         * @returns {removeAttr}
         * @example
         *     // jQuery 中的removeAttr 函数的使用方式
         *      jQuery("#id").removeAttr(" data-value")
         *     // panda 中的removeAttr 函数的使用方式
         *      panda.query("#id").removeAttr(" data-value")
         *      或者
         *      panda("#id").removeAttr(" data-value")
         *
         */
        removeAttr: function (key) {
            if (!key)return this;
            var _this = this;
            _this.each(function (el) {
                _remove(el, key);  //TODO 需要过滤value的空格
            });
            return this;
        },
        /**
         * 当前滚动位置
         * @method scrollTop
         * @return {Number}
         * @example
         * 		panda("window").scrollTop(); // => 120 
         */
		scrollTop: function() {
			if (!this.length)
				return;
			return ('scrollTop' in this[0]) ? this[0].scrollTop : this[0].scrollY;
		}
    };


    /**
     * @method _set 设置属性
     * @param el
     * @private
     */
    function _set(el, key, value) {
        switch (key) {
            case 'class':
                el.className = value;
                break;
            case 'style':
                el.style.cssText = value;
                break;
            default:
            {
                el && el.setAttribute ? el.setAttribute(key, value) : el[key] = value;
            }
        }
    }

    /**
     * @method _get 获得属性
     * @returns {*}
     * @private
     */
    function _get(el, key) {
        switch (key) {
            case 'class':
                return el.className;
            case 'style':
                return el.style.cssText;
            default:
                var result = el && el.getAttribute ? el.getAttribute(key) : el[key];
                return (result == null) ? undefined : result;
        }
    }

    /**
     * @method _remove 删除属性
     * @param el
     * @private
     */
    function _remove(el, key) {
        el[key] = null;
        delete el[key];
        try {
            el.removeAttribute(key);
        } catch (e) {
        }
    }


    module.exports = Attr;
});
/**
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-5-7
 * Time: 下午4:22
 */
/**
 * @class dom
 * @constructor
 */
define("base.dom.class", [], function (require, exports, module) {
    var string = require("base.string");
    var pandaObj = require("base.object");
    var array = require("base.array");
    var Class = {
        /**
         * 为所有匹配的元素添加class。
         * @method addClass
         * @param {string}value  class的值
         * @example
         *
         *     // jQuery 中的addClass 函数使用方式
         *     $("#id").addClass("panda")
         *     // panda 中的addClass 函数使用方式
         *      panda.query("#id").addClass("panda") 或者  panda("#id").addClass("panda")
         *
         */
        addClass: function (value) {
        	value = string.create(value).trim();
            var self = this,
                proceed = pandaObj.isString(value) && value;
            if (proceed) {
                this.each(function (item) {
                    item = panda(item);
                    if (!item.hasClass(value)) {
                        item[0].className += ' ' + value;
                    }
                });
            }
            return this;
        },
        /**
         * 为所有匹配的元素删除指定的 class
         * @method removeClass
         * @param value
         * @example
         *      // jQuery 中的 removeClass 函数使用方式
         *     $("#id").removeClass("panda")
         *      // panda 中的 removeClass 函数使用方式
         *      panda.query("#id").removeClass("panda") 或者  panda("#id").removeClass("panda")
         *
         */
        removeClass: function (value) {
        	value = string.create(value).trim();
            var self = this;
            proceed = pandaObj.isString(value) && value;
            if (proceed) {
                this.each(function (item) {
                    item = panda(item);
                    if (item.hasClass(value)) {
						var reg = new RegExp('(^'+value+'\\s*)|(\\s+'+value+')');
                        item[0].className = item[0].className.replace(reg, '');
                    }
                });
            }
            return this;
        },
        /**
         * 为所有匹配的元素检测是否具有class
         * @method hasClass
         * @param {string}value 所要检查的class值
         * @returns {boolean}
         * @example
         *
         *      // jQuery 中的hasClass 函数使用方式
         *     $("#id").hasClass("panda")
         *     // panda 中的hasClass 函数使用方式
         *     panda("#id").hasClass("className") 或者 panda.query("#id").hasClass("className")
         *
         *
         */
        hasClass: function (value) {
        	value = string.create(value).trim();
            var reg = new RegExp('(^'+value+'\\s*)|(\\s+'+value+')');
            var target = this && this.length ? this[0] : null;
            if (target && target.className && target.className.match(reg)) {
                return true;
            }
            return false;
        },
        /**
         * 如果存在（不存在）就删除（添加）一个类。
         * @method toggleClass
         * @param {string}value
         * @returns {object}
         * @example
         *      // jQuery 中的 toggleClass 函数使用方式
         *      $("#id").toggleClass("panda")
         *     // panda 中的 toggleClass 函数使用方式
         *      panda.query("#id").toggleClass("panda")
         *      或者
         *      panda("#id").toggleClass("panda")
         */
        toggleClass: function (value) {
            var self = this;
            if (self && self.length > 0) {
                self.hasClass(value) ? self.removeClass(value) : self.addClass(value);
            }
            return self;
        }
    };

    module.exports = Class;
});
/**
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-5-8
 * Time: 下午1:40
 */
/**
 * @class dom
 * @constructor
 */
define("base.dom.create", [], function (require, exports, module) {
    var Create = {
        /**
         * 取得第一个匹配元素的html内容
         * @method html
         * @returns {object}
         * @example
         *      // jQuery 中的使用方式
         *      var $html = jQuery("#id").html()
         *      // panda的html 的使用方式
         *      panda.query("#id").html() 或者 panda("#id").html()
         *      // jquery中的html()的使用方式,如果使用 panda 只需要把jQuery 或者 $ 换成 panda 即可
         */

        /**
         * 设置每一个匹配元素的html内容
         * @method html(val)
         * @param val
         * @returns {object}
         * @example
         *      // jQuery 中的使用方式
         *      var $html = jQuery("#id").html("我是jQuery")
         *      // panda的html 的使用方式
         *      panda.query("#id").html("我是panda") 或者 panda("#id").html("我是panda")
         *      // jquery中的html()的使用方式,如果使用 panda 只需要把jQuery 或者 $ 换成 panda 即可
         */
        html: function () {
            var self = this,
                args = arguments;
            if (!self || !self[0])return this;
            if (args.length === 0) {
                return self[0].innerHTML;
            } else if (args.length > 0) {
                self.each(function (el) {
                    el.innerHTML = args[0];
                });
                return this;
            }
        },
        /**
         * 设置每一个匹配元素的当前值。
         * @method val(val)
         * @param {number or string} value
         * @returns {object}
         * @example
         *       // jQuery 中的使用方式
         *       $("#pandaText").val()
         *       // panda的使用方式
         *       panda.query("#id").val("我是panda") 或者 panda("#id").val("我是panda")
         *
         */

        /**
         * 获得第一个匹配元素的当前值。
         * @method val()
         * @returns {Number}
         * @example
         *       // jQuery 中的使用方式
         *       $("#pandaText").val()
         *       // panda的使用方式
         *       panda.query("#id").val() 或者 panda("#id").val()
         *
         */
        val: function (value) {
            if(typeof value != 'undefined') {
				if(this && this.length) {
					this.each(function(item) {
						var el = item;
                if (el.tagName.toLowerCase() == "select") {
                    var len = el.options.length;
                    for (var i = 0; i < len; i++) {
                        if (el.options[i].value == value) {
                            el.options[i].selected = true;
                        }
                    }
                } else {
                    el.value = value;
                }
					});
				}
                return this;
            } else {
				if(this && this.length) {
					var el = this[0];
                if (el.tagName.toLowerCase() == "select") {
                    var index = el.selectedIndex,
                        len = el.options.length;
                    if (len > 0) {
                        return el.options[index > -1 ? index : 0].value;
                    }
                } else {
                    return el.value;
                }
				}else {
					return null;
            }
			}
        }
    };
    module.exports = Create;
});
/**
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-5-8
 * Time: 下午1:38
 */
define("base.dom.data", [], function(require, exports, module) {

    /**
     * @method data 对对象绑定数据
     * @param name
     * @param data
     * 这只是一个最简单的实现，复杂实现后面再重构
     */
	// 修复了一个严重BUG，居然没有根据当前对象来存值
	// fixed by lizihan at 2013/10/22
	// 修复Panda对象无数据时返回数据不正确的问题
	// fixed by lizihan at 2013/12/23
	
	var Data = {};
	var guid = require("base.util.guid");
	
	function _getDataId(target) {
		var id = "";
		if(!target.__guid__) {
			id = target.__guid__ = guid();
		}else {
			id = target.__guid__;
		}
		
		if(!Data[id]) {
			Data[id] = {};
		}
		
		return id;
	}
	
    function data(key, value) {
    	if(!this) {
			return null;
		}
		
		var last = null;
		var isset = false;
		this.each(function(item) {
    		if(last) {
    			return;
    		}
    		var id = _getDataId(item);
		
	        if ( typeof key == 'object') {
	            for (var k in key) {
	                Data[id][k] = key[k];
	            }
	        }
	        if ( typeof key == 'string' && value) {
	            Data[id][key] = value;
	        }
	        if ( typeof value == 'undefined') {
				isset = true;
	            last = Data[id][key];
	        }
		});
		

        return isset ? last : this;
    }

    function removeData(key) {
		if(!this || !this.length) {
			return this;
		}
		
		this.each(function(item) {
			var id = _getDataId(item);
		
			Data[id][key] = null;
			delete Data[id][key];
		});
		
        return this;
    };

    module.exports = {
        data : data,
        removeData : removeData
    };
}); 
/**
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-5-8
 * Time: 下午1:41
 */
/**
 * @class dom
 * @constructor
 */
define("base.dom.insertion", [], function (require, exports, module) {

    var _object = require("base.object");
    var _browser = require("base.system.browser");
    var _string = require("base.string");

    var nodeNames = "abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|" +
            "header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",
        rhtml = /<|&#?\w+;/,
        rtagName = /<([\w:]+)/,
        rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
        nodes = [];

    /**
     * 把所有匹配的元素插入到另一个、指定的元素元素集合的前面。
     * @method insertBefore
     * @param elem
     * @returns {object}
     * @example
     *     // jQuery 使用方式
     *     HTML 代码:
     *     <div id="foo">Hello</div><p>I would like to say: </p>
     *     jQuery 代码:
     *          var $foo = $("#foo")
     *          $("p").insertBefore($foo);
     *          结果:
     *          <p>I would like to say: </p><div id="foo">Hello</div>
     *     // panda 使用方式
     *     HTML 代码:
     *     <div id="foo">Hello</div><p>I would like to say: </p>
     *     panda 代码:
     *          var foo = panda("#foo");
     *          panda("p").insertBefore(foo);
     *          结果:
     *          <p>I would like to say: </p><div id="foo">Hello</div>
     *
     */

    var Insertion = {
        appendTo: function (elem) {
            var _this = this;
            if (_this.length) {
                var result = [];
                _this.each(function (el) {
                    var node = panda(elem);
                    if (node[0] && (node[0].nodeType === 1 || node[0].nodeType === 9 || node[0].nodeType === 11)) {
                        result.push(node.append(el));
                    }
                });
            }
            return _this;
        },
        append: function (elem) {
            var _this = this;
            if (_this.length) {
                _this.each(function (el) {
                    var node = panda(elem);
                    if (el.nodeType === 1 || el.nodeType === 9 || el.nodeType === 11) {
                        node.each(function (item, index) {
                            el.appendChild(item);
                        });
                    }
                    ;
                });
            }
            return _this;
        },
        prependTo: function (elem) {
            var _this = this;
            if (_this.length) {
                var result = [];
                _this.each(function (el) {
                    if (el.parentNode) {
                        var node = panda(elem);
                        /**
                         * 元素element   1
                         * 属性attr    2
                         * 文本text  3
                         * 注释comments 8
                         * 文档document  9
                         * 文档碎片 fragment 11
                         */
                        if (node[0] && (el.nodeType === 1 || el.nodeType === 11 || el.nodeType === 9)) {
                            node[0].insertBefore(el, node[0].firstChild);
                        }

                    }
                });
            }
            return _this;
        },
        create: function (html) {
            var div = null;
            html = _string.create(html).trim();
            if (html.indexOf('<tr') == 0) {
                div = document.createElement('table');
            } else {
                div = document.createElement('div');
            }
            div.innerHTML = html;
            /*
             * bug fix
             * 修复了create的链式调用
             * 例如： panda.create("<div>测试节点</div>").appendTo(panda.query("#test"))
             */
            var _dom = require("base.dom");
            return _object._extend(_object.makeArray(div.childNodes), _dom);
        },
        remove: function () {
            var _this = this;
            if (_this.length) {
                _this.each(function (el, index) {
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                });
                _this && _this.splice(0, _this.length);
            }
            return _this;
        },
        empty: function () {
            this.each(function(item) {
				panda(item).html('');
			});
            return this;
        }
    };

    /**
     * 把所有匹配的元素插入到另一个、指定的元素元素集合的后面。
     * @method insertAfter
     * @param elem
     * @returns {object}
     * @example
     *     // jQuery 使用方式
     *     HTML 代码:
     *     <div id="foo">Hello</div><p>I would like to say: </p>
     *     jQuery 代码:
     *          var $foo = $("#foo")
     *          $("p").insertAfter($foo);
     *          结果:
     *          <div id="foo">Hello</div><p>I would like to say: </p>
     *     // panda 使用方式
     *     HTML 代码:
     *     <div id="foo">Hello</div><p>I would like to say: </p>
     *     panda 代码:
     *          var foo = panda("#foo");
     *          panda("p").insertAfter(foo);
     *          结果:
     *          <div id="foo">Hello</div><p>I would like to say: </p>
     *
     */


    /**
     * 把所有匹配的元素追加到另一个指定的元素元素集合中。
     * 实际上，使用这个方法是颠倒了常规的$(A).append(B)的操作，即不是把B追加到A中，而是把A追加到B中。
     * @method appendTo
     * @param  content
     * @returns {object}
     * @example
     *      //jQuery appendTo 的使用方式
     *      html代码：
     *      <p>I would like to say: </p>
     *      <div id="parent"></div>
     *      代码 ：var $parent = $("#parent");
     *             $("p").appendTo(parent);结果:
     *             <div id="parent"><p>I would like to say: </p></div>
     *
     *      // panda appendTo 的使用方式
     *      html代码：
     *      <p>I would like to say: </p>
     *      <div id="parent"></div>
     *      代码 ：var parent = panda("#parent");
     *             panda("p").appendTo(parent);结果:
     *             <div id="parent"><p>I would like to say: </p></div>
     *
     */


    /**
     * 向每个匹配的元素内部追加内容。
     * 这个操作与对指定的元素执行appendChild方法，将它们添加到文档中的情况类似。
     * @method append()
     * @param elem  支持的类型 String, Element, panda对象
     * @returns {object}
     * @example
     *
     *      //jQuery append 的使用方式
     *      $("#id").append(elem)
     *
     *      //panda中append 的方法使用方式
     *      panda("#id").append(elem)
     *
     */
    function _tableInnerHTML(table, html) {
        table.innerHTML = html;
    }

    /**
     * 创建dom 元素
     * @param html
     * @returns {object}
     * @example
     *   panda.dom.create("<div>动态创建的节点</div>");
     */


    /**
     * 从DOM中把所有段落删除
     * @method remove
     * @returns {object}
     * @example
     *      // jQuery 使用方式
     *      $("p").remove();
     *      // panda 使用方式
     *      panda("p").remove();
     *
     */

    function nodeName(elem, name) {
        return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
    }

    /**
     * @method empty 清空节点内容
     * @param elems
     * @returns {*}
     * @private
     */

    module.exports = Insertion;
})
;
/**
 * 指定节点的全屏坐标
 * author: lizihan <lizihan@jd.com>
 * Date: 13-6-25
 * Time: 17:49
 */
/**
 * @class dom
 * @constructor
 */
define("base.dom.position", [], function (require, exports, module) {
    var Position = {
        /**
         * 获取匹配的元素相对浏览器窗口 x 和 y 坐标
         * @method position
         * @returns {object} {x:50 , y:50}
         * @example
         *      var coord = null;
         *      coord = panda.query("#id").position();
         */
        position: function (target) {
            if (this.length==0) return {x:0,y:0};
            var obj = (this[0] === window || this[0] === window.document) ? {x:0,y:0} : this[0].getBoundingClientRect();
			obj.left += window.pageXOffset;
			obj.top += window.pageYOffset;
            return {
                x: obj.left,
                y: obj.top,
				left:obj.left,
				top:obj.top
            }
        }
    };

    module.exports = Position;
});
/**
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-5-9
 * Time: 上午10:33
 */
/**
 * @class dom
 * @constructor
 */
define("base.dom.size", [], function (require, exports, module) {

    var DEFAULT_UNIT = "px", WIDTH = "width", HEIGHT = "height";
    var cssShow = { position: "absolute", visibility: "hidden", display: "block" };
    var rdisplayswap = /^(none|table(?!-c[ea]).+)/;
    var PStyle = require("base.dom.style");

    /**
     * 取得第一个匹配元素当前计算的宽度值（px）。
     * @method width()
     * @return val
     * @example
     *      // jQuery 中的width 函数的使用方式
     *      var W = $("#id").width();
     *      // panda 中的 width 函数的使用方式
     */
    var Size = {
        width: function (value) {
            if (this.length <= 0)
                return null;
            if (value == undefined) {
                return _get(this[0], WIDTH);
            } else {
                var _val = parseFloat(value);
                if (isNaN(_val))
                    return this;
                this.each(function (el) {
                    _set(el, _val, WIDTH);
                });
                return this;
            }
        },
        height: function (value) {
            if (this.length <= 0)
                return null;
            if (!value) {
                return _get(this[0], HEIGHT);
            } else {
                var _val = parseFloat(value);
                if (isNaN(_val))
                    return this;
                this.each(function (el) {
                    _set(el, _val, HEIGHT);
                });
                return this;
            }
        },
        size: function () {
            return this.length;
        }
    }


    /**
     * 为每个匹配的元素设置CSS宽度(width)属性的值。
     * @method width(val)
     * @param {number or string}val
     * @return {panda object}
     * @example
     *      // jQuery 中的width 函数的使用方式
     *      $("#id").width(100);
     *      // panda 中的 width 函数的使用方式
     *      panda.query("#id").width(100);
     *
     */

    /**
     * 取得第一个匹配元素当前计算的高度值（px）。
     * @method height()
     * @return {number}val
     * @example
     *      // jQuery 中的 height 函数的使用方式
     *      $(".className").height();
     *      // panda 中的 height 函数的使用方式
     *      panda.query(".className").height() 或者 panda(".className").height()
     */
    /**
     * 为每个匹配的元素设置CSS高度(hidth)属性的值(px)。
     * @method height(val)
     * @param value
     * @returns {panda object}
     * @example
     *      // jQuery 中的 height 函数的使用方式
     *      $(".className").height();
     *      // panda 中的 height 函数的使用方式
     *      panda.query(".className").height() 或者 panda(".className").height()
     */

    /**
     * 获取对象的个数
     * @method size
     * @returns {Number}
     * @example
     *      // jQuery 中的size 函数的使用方式
     *      $("img").size();
     *      // panda 中的size 函数的使用方式
     *      panda("img").size();
     */


    /**
     * @method _set 设置元素的宽度or高度
     * @param value
     * @private
     */
    function _set(el, value, flag) {
        var style = {};
        style[flag] = value;
        PStyle._setStyle(el,PStyle._transformStyle(style));
        return el;
    }

    /**
     * @method _getWidth 获取元素的宽度
     * @param el
     * @returns {number}
     * @private
     */
    function _get(el, flag) {
        var _val = 0;
        switch (flag) {
            case WIDTH:
            case HEIGHT:
                _val = parseInt(getWidthOrHeight(el, flag));
                break;
            default :
                if (!isNaN(parseInt(PStyle._getStyle(el, flag))))
                    _val = parseInt(PStyle._getStyle(el, flag));
                break;
        }
        return _val;
    }

    /**
     * 特殊处理了 el 元素 隐藏的时候情况
     * @method _getWidthOrHeight
     * @private
     */
    function getWidthOrHeight(els, attributeValue) {
        var value = 0,
            name = attributeValue.toLocaleLowerCase() || null;
        if (panda.isWindow(els)) {
            name = firstIscapitalized(name);
            return els.document.documentElement[ "client" + name ];
        }
        // Get document width or height
        if (els && els.nodeType === 9) {
            doc = els.documentElement;
            name = firstIscapitalized(name);
            return Math.max(
                els.body[ "scroll" + name ], doc[ "scroll" + name ],
                els.body[ "offset" + name ], doc[ "offset" + name ],
                doc[ "client" + name ]
            );
        }
        value = (name === "width") ? els.offsetWidth : els.offsetHeight;
        if (value <= 0 || value == null) {
            value = PStyle._getStyle(els, name);
        }
        return value;
    }

    /**
     * 转换首字符为大写
     * @param string
     * @returns {*|XML|string|Node|void|replace}
     */
    function firstIscapitalized(string) {
        return  string.replace(/(^|\s+)\w/g, function (s) {
            return s.toUpperCase();
        });
    }

    panda = panda.merge(panda, Size);
    module.exports = Size;
})
;
define("base.dom.style", [], function (require, exports, module) {
    var _browser = require("base.system.browser");


    var DEFAULT_UNIT = "px",
        re_unit = /width|height|top|left|right|bottom|margin|padding|marginTop|marginLeft|marginRight|marginBottom|paddingTop|paddingLeft|paddingRight|paddingBottom|fontSize|opacity/i,
        STYLES = {},
        rmsPrefix = /^-ms-/,
        rdashAlpha = /-([\da-z])/gi,
        core_pnum = /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,
        rnumsplit = new RegExp("^(" + core_pnum + ")(.*)$", "i"),
        rrelNum = new RegExp("^([+-])=(" + core_pnum + ")", "i");

    function fcamelCase(all, letter) {
        return letter.toUpperCase();
    }

    var Style = {
        css: function (name, value) {
            if (this.length == 0)return this;
            var _arg = arguments;
            if (_arg.length == 1) {
                var first = _arg[0];
                if (panda.object.isArray(first)) {
                    var returnStyle = {
                    };
                    for (var i = 0, Ln = first.length; i < Ln; i++) {
                        returnStyle[first[i]] = _getStyle(this[0], first[i]);
                    }
                    return returnStyle;
                } else if (typeof first == "object") {
                    STYLES = _transformStyle(first);
                } else if (typeof first == "string") {
                    return _getStyle(this[0], name);
                }
            } else if (_arg.length === 2) {
//			此处第二个参数为何必须为 String ?
//            if (typeof _arg[0] == "string" && typeof _arg[1] == "string") {
                if (typeof _arg[0] == 'string') {
                    var _json = {};
                    if (value !== null)_json[name] = value;
                    STYLES = _transformStyle(_json);
                } else {
                    throw new Error("参数类型错误！！！！");
                }
            }

            this.each(function (el) {
                for (var key in STYLES) {
                    var value = STYLES[key];
                    if (typeof value === "string" && (ret = rrelNum.exec(value))) {
                        value = ( ret[1] + 1 ) * ret[2] + parseFloat(panda.query(el).css(key));
                        if (key !== "opacity") {
                            value += DEFAULT_UNIT;
                        }
                        STYLES[key] = value;
                    }
                }
                _setStyle(el, STYLES);
            });

            return this;
        },
        show: function () {
            var self = this;
            this.each(function (el) {
                 var item = panda(el);
                if (item.css("display") == "none")
                	item.css("display", (item.data("__oldDisplay__") ? false : item.data("__oldDisplay__")) || "block");
            });
            return this;
        },
        hide: function () {
            var self = this;
            this.each(function (el) {
                var item = panda(el);
                item.data("__oldDisplay__",item.css("display")=='none'?'':item.css("display"));
                item.css("display", "none");
            });
            return this;
        },
        toggle: function () {
            this.each(function (el) {
                (_getStyle(el, "display") !== "none") ? _setStyle(el, {display: "none"}) : _setStyle(el, {display: "block"});  //TODO 需要记录节点之前的display
            });
            return this;
        },
        isStyle: function (key) {
            return re_unit.test(key);
        }
    };
    /**
     * @method setStyle 设置元素样式
     * @param el
     * @private
     */
    function _setStyle(el, style) {
        var _styles = style || {};
        for (var key in _styles) {
            var value = _styles[key];
            if (key == 'opacity') {
                el.style.opacity = (value == 1 ? '1' : value);
            } else {
                try {
                    if (key == "width" || key == "height") {
                        el.style[key] = setPositiveNumber(value);
                    } else {
                        el.style[key] = value;
                    }
                } catch (e) {
                }
            }
        }

    }

    function setPositiveNumber(value, subtract) {
        var matches = rnumsplit.exec(value);
        return matches ?
            Math.max(0, matches[ 1 ] - ( subtract || 0 )) + ( matches[ 2 ] || "px" ) :
            value;
    }

    /**
     * @mehod _getStyle 获取样式
     * @param el    目标元素
     * @param namey 样式
     * @private
     */
    function _getStyle(el, name) {
        if (name == 'opacity') {
            return el.style.opacity ? parseFloat(el.style.opacity) : 1;
        } else {
            function hyphenate(name) {
                return name.replace(/[A-Z]/g,
                    function (match) {
                        return '-' + match.toLowerCase();
                    });
            }

			var flag = (name == 'width' || name == 'height') ? false : true;
			var p = el;
			if (!flag) {
				while (p = p.parentNode) {
					if (p.parentNode === document.body) {
						flag = true;
						break;
					}
				}
			}

            if (window.getComputedStyle && flag) {
                return  window.getComputedStyle(el, null) && window.getComputedStyle(el, null).getPropertyValue(hyphenate(name));
            }
            return el.style[name];
        }
    }

    /**
     * @method transformStyle 转换style
     * @param style
     * @returns {{}}
     * @private
     */
    function _transformStyle(style) {
        var _styles = {};
        for (var key in style) {
            var val = style[key];
            if (key != "opacity" && !isNaN(new Number(val)) && Style.isStyle(key)) {
                val += DEFAULT_UNIT;
            }
            if (val !== null)_styles[camelCase(key)] = val;
        }
        return _styles;
    }

    function camelCase(string) {
        return string.replace(rmsPrefix, "ms-").replace(rdashAlpha, fcamelCase);
    }

    module.exports = {
        css: Style.css,
        hide: Style.hide,
        show: Style.show,
        toggle: Style.toggle,
        isStyle: Style.isStyle,
        _getStyle: _getStyle,
        _setStyle: _setStyle,
        _transformStyle: _transformStyle
    };
});
/**
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-5-8
 * Time: 下午1:40
 */
/**
 * @class dom
 * @constructor
 */

define("base.dom.traversal", [], function (require, exports, module) {
    /**
     * 保存一些原生的函数
     * @type {*}
     */
    var core_concat = [].concat,
        obj = require("base.object"),
        array = require("base.array");
    /**
     * 获取第一个元素
     * @method first()
     * @return {panda array}
     * @example
     *      // jQuery 中 first()函数的使用方式
     *      $("li").first();
     *      // panda 中 first()函数的使用方式，返回的是封装后的panda array
     *      panda("li").first() 或者 panda.query("li").first();
     *
     */
    var Traversal = {
        parent: function () {
            var _dom = require("base.dom");
            if (!this[0])
                return obj._extend([], _dom, this);
            return obj._extend([this[0].parentNode], _dom, this);
        },
        siblings: function () {
            var _this = this;
            var resultSiblings = map(_this, function (el) {
                return sibling((el.parentNode || {}).firstChild, el);
            });
            var _dom = require("base.dom");
            return obj._extend(resultSiblings, _dom);
        },
        find: function () {
            return panda.query(arguments[0], this);
        },
        eq: function (index) {
        	if(!this.length) {
        		return this;
        	}
        	
            while (index < 0) {
                index = index + this.length;
            }
            if (index > this.length)
                index = this.length - 1;

            var self = this.__last_link__ ? this.__last_link__ : (this.__last_link__ = this);
            var temp = self[index];
            var _dom = require("base.dom");

            var result = obj._extend([temp], _dom);
            result.__last_link__ = self;
            return result;
        },
        /**
         * 获取该节点下的直接孩子节点（只是向下一层）
         * @method children
         * @example
         *     var children = panda('#test').children();
         */
        children: function () {
            var result = [];
            this.each(function (item, index) {
                result = result.concat(sibling(item.firstChild));
            });
            var _dom = require("base.dom");
            return obj._extend(result, _dom);
        }
    };

    /**
     * 获取匹配元素的第一个元素的父亲元素
     * @method parent()
     * @example
     *      // last() 返回的是封装后的panda array
     *      var pandaNode = panda.query("#id").parent();
     *      // 如果要获取原生的dom 节点
     *      if(pandaNode.length != 0 ){
     *          var domNode = pandaNode[0];
     *      }
     */

    /**
     * 获取匹配元素同辈元素的元素集合
     * @method siblings
     * @example
     *      // siblings() 返回的是封装后的panda array
     *      var pandaNode = panda.query("#id").siblings();
     *      // 如果要获取原生的dom 节点
     *      if(pandaNode.length != 0 ){
     *          var domNode = pandaNode[0];
     *      }
     */
    function sibling(n, elem) {
        var r = [];
        for (; n; n = n.nextSibling) {
            if (n.nodeType === 1 && n !== elem) {
                r.push(n);
            }
        }
        return r;
    }

    module.exports = Traversal;
});
/**
 * 浏览器类型及平台判断
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-5-8
 * Time: 下午4:25
 * @class browser
 * @constructor
 */
define("base.system.browser",[],function (require, exports, module) {
    var _ua = navigator.userAgent.toLowerCase();

	var browser = {
		/**
		 * 浏览器版本号
		 * @attribute version
		 * @type {String}
		 * @example
		 * panda.browser.version; //=> 10.0
		 */
		version : (_ua.match( /.+(?:rv|it|ra|ie)[\/: ]([\d.]+)/ ) || [])[1],
		/**
		 * 是否为IE
		 * @attribute ie
		 * @type {Boolean}
		 */
		ie : /msie/.test(_ua),
		/**
		 * 是否为Mozilla
		 * @attribute moz
		 * @type {Boolean}
		 */
		moz : /gecko/.test(_ua),
		/**
		 * 是否为Safari
		 * @attribute safari
		 * @type {Boolean}
		 */
		safari : /safari/.test(_ua),
		/**
		 * 是否为Firefox
		 * @attribute ff
		 * @type {Boolean}
		 */
		ff : /firefox/i.test(_ua),
		/**
		 * 是否为Chrome
		 * @attribute chrome
		 * @type {Boolean}
		 */
		chrome : /chrome/i.test(_ua)
	};
	/**
	 * 是否为IE6
	 * @attribute isIE6
	 * @type {Boolean}
	 */
    browser.isIE6 = (browser.ie && browser.version === '6.0');

    browser.platform={};

	/**
	 * 平台判断
	 * @attribute isAndroid
	 * @attribute isIpad
	 * @attribute isIphone
	 * @attribute isLinux
	 * @attribute isMacintosh
	 * @attribute isWindows
	 * @attribute isX11
	 * @attribute isTouch
	 * @type {Boolean}
	 */
    var ua = navigator.userAgent;
    var pltemp="Android iPad iPhone Linux Macintosh Windows X11 Touch".split(" ");
    for(var index in pltemp){
        var item=pltemp[index];
        var key = item.charAt(0).toUpperCase() + item.toLowerCase().substr(1);
        browser.platform[ "is" + key ] = !!~ua.indexOf( item );
    };
	
	/**
	 * 是否为移动端设备
	 * @attribute isMobile
	 * @type {Boolean}
	 */
    if(browser.platform.isAndroid || browser.platform.isIpad || browser.platform.isIphone || browser.platform.isTouch){
        browser.isMobile = true;
    }else{
        browser.isMobile = false;
    }
    module.exports = browser;
});
/**
 * author: lizihan <lizihan@jd.com>
 * Date: 13-6-13
 * Time: 15:09
 * @class cookie
 * @constructor
 */
define("base.system.cookie",[],function (require, exports, module) {
    module.exports = {
        /**
         * 获取指定 name 的cookie 值
         * @method get
         * @param {String} name
         * @returns {String} val
         * @example
         *      panda.cookie.get("pin")
         */
		get:function(name) {
			name = name.replace(/([\.\[\]\$])/g,'\\\$1');
			var rep = new RegExp(name + '=([^;]*)?;','i'); 
			var co = document.cookie + ';';
			var res = co.match(rep);
			if (res) {
				return unescape(res[1]) || "";
			}
			else {
				return "";
			}
		},
        /**
         * 设置cookie
         * @method set
         * @param {String} name
         * @param {String} value
         * @param {String} expire
         * @param {String} path
         * @param {String} domain
         * @param {String} secure
         * @example
         *      panda.cookie.set("pin","jd_yanfa")
         */
		set:function(name, value, expire, path, domain, secure) {
			var cstr = [];
			cstr.push(name + '=' + escape(value));
			if(expire){
				var dd = new Date();
				var expires = dd.getTime() + expire * 3600000;
				dd.setTime(expires);
				cstr.push('expires=' + dd.toGMTString());
			}
			if (path) {
				cstr.push('path=' + path);
			}
			if (domain) {
				cstr.push('domain=' + domain);
			}
			if (secure) {
				cstr.push(secure);
			}
			document.cookie = cstr.join(';');
		}
    };
});
/**
 * Timer封装类
 * @class Timer
 * @constructor
 * User: lizihan
 * Date: 13-06-14
 * Time: 15:46
 */
define("base.util.Timer", [], function (require, exports, module) {
	var obj = require("base.object");
	var guid = require("base.util.guid");
	
	var Timer = function(opts) {
		var self = this;
		/**
		 * 正常速度
		 * @protected
		 * @attribute NORMAL
		 * @type Number
		 * @default 100
		 */
		self.NORMAL = 100;
		/**
		 * 快速
		 * @protected
		 * @attribute FAST
		 * @type Number
		 * @default 16
		 */
		self.FAST = 16;
		/**
		 * 慢速
		 * @protected
		 * @attribute SLOW
		 * @type Number
		 * @default 500
		 */
		self.SLOW = 500;
		/**
		 * 初始化配置项
		 * @attribute _option
		 * @private
		 * @type Object
		 * @default null
		 */
		self._option = null;
		
		/**
		 * 轮循ID
		 * @private
		 * @attribute _cid
		 * @type Number
		 * @default 0
		 */
		self._cid = 0;
		/**
		 * 运行次数统计
		 * @private
		 * @attribute _count
		 * @type Number
		 * @default 0
		 */
		self._count = 0;
		/**
		 * 开始执行时间
		 * @protected
		 * @attribute startTime
		 * @type Number
		 * @default 0
		 */
		self.startTime = 0;
		
		/**
		 * 已运行时长
		 * @protected
		 * @attribute running
		 * @type Number
		 * @default 0
		 */
		self.running = 0;
		
		/**
		 * 初始化
		 * @method initialize
		 * @param {Object} opts duration:100,delay:0,repeat:0,callback:empty,complete:empty
		 * @example	new panda.util.Timer({
		 * 				duration:16,			运行间隔
		 * 				delay:300,				延迟运行时长, 默认为0
		 * 				repeat:0,				重复多少次 , 默认为0, 代表无次数限制
		 * 				callback:function(){}	回调函数
		 * 				complete:function(){}	运行结束回调
		 * 			}).start();
		 */
		self.initialize = function(opts) {
			var option = obj.parameter(opts, {
				duration:self.FAST,
				delay:0,
				repeat:0,
				callback:obj.bind(self.empty, self),
				complete:obj.bind(self.empty, self)
			});
			
			self._option = option;
			self._enterFrame = ( function() {
				return window.requestAnimationFrame ||
					window.webkitRequestAnimationFrame ||
					window.mozRequestAnimationFrame ||
					window.oRequestAnimationFrame ||
					window.msRequestAnimationFrame ||
					function( callback ) {
						window.setTimeout( callback, self.FAST );
					};
			})();
			
			return self;
		};
		
		/**
		 * 设置配置参数
		 * @method setOption
		 * @param {Object} opts
		 * @return this
		 */
		self.setOption = function(opts) {
			self._option = obj.parameter(opts, self._option);
			
			return self;
		};
		
		/**
		 * 开始运行
		 * @method start
		 * @return this
		 */
		self.start = function() {
			self.startTime = new Date().getTime();
			self.running = 0;
			self.lastrunning = 0;
			
			if(self._cid) {
				self.stop(self._cid);
			}
			
			self._enterFrame.call(window, obj.bind(self.step, self));
			self._signal = true;
			
			return self;
		};
		
		/**
		 * 每次更新执行 (此处会判断delay及次数限制)
		 * @method step
		 * @protected
		 * @return this
		 */
		self.step = function() {
			if (self._signal) {
				self._cid = self._enterFrame.call(window, obj.bind(self.step, self));
				
				var currentTime = new Date().getTime();
				
				if (self._option.delay) {
					if (currentTime - self.startTime < self._option.delay) {
						return;
					}
				}
				
				self.running += self.FAST;
				
				try {
					if (self.running - self.lastrunning >= self._option.duration) {
						if (self._option.repeat) {
							self._count++;
							if (self._count > self._option.repeat) {
								try {
									self._option.complete && self._option.complete.call();
								} 
								catch (e) {
									panda.stack.extractStacktrace(e, 1);
								}
								return self.stop();
							}
						}
						
						self.lastrunning = self.running;
						self._option.callback && self._option.callback.call();
					}
				} 
				catch (e) {
					panda.stack.extractStacktrace(e, 1);
				}
			}
		};
		
		/**
		 * 停止
		 * @method stop
		 * @return this
		 */
		self.stop = function() {
			self._count = 0;
			self._signal = false;
			
			return self;
		};
		
		/**
		 * 重置并重新运行
		 * @method reset
		 * @return this
		 */
		self.reset = function() {
			self.stop();
			self.start();
			
			return self;
		};
		
		/**
		 * 运行状态
		 * @method isPlay
		 * @return {Boolean} true|false
		 */
		self.isPlay = function() {
			return self._cid?true:false;
		};
		
		/**
		 * 内置临时空函数
		 * @method _empty
		 * @private
		 */
		self._empty = function() {
			
		};
		
		return self.initialize(opts);
	};
	
	module.exports = Timer;
});
/**
 * 动画类
 * @class Tweener
 * @constructor
 * User: lizihan
 * Date: 13-06-17
 * Time: 11:27
 */
define("base.util.Tweener", [], function (require, exports, module) {
	var _obj = require("base.object");
	var _$ = require("base.query");
	var _type = require("base.util.tweens");
	var _timer = require("base.util.Timer");
	
	var Tweener = function(opts) {
		var self = this;
		/**
		 * 目标对象
		 * @attribute target
		 * @protected 
		 * @type Node
		 * @default null
		 */
		self.target = null;
		/**
		 * 初始化配置项
		 * @attribute options
		 * @protected
		 * @type {Object}
		 * @default null
		 */
		self.options = null;
		/**
		 * 计时器对象
		 * @attribute timer
		 * @protected
		 * @type {Timer}
		 * @default null
		 */
		self.timer = null;
		
		/**
		 * 当前轮循值
		 * @protected
		 * @attribute
		 * @type {Number}
		 * @default 0
		 */
		self.current = 0;
		/**
		 * 延时值
		 * @protected
		 * @attribute
		 * @type {Number}
		 * @default 0
		 */
		self.delay = 0;
		/**
		 * 当前是否在播放
		 * @protected
		 * @attribute
		 * @type {Boolean}
		 * @default false
		 */
		self.isPlay = false;
		
		/**
		 * 初始化
		 * @method initialize
		 * @param {Object} opts
		 * @return this
		 * @example
		  	tweener = new panda.utilTweener({
				target:dom_target,
				from:{
					marginLeft:0
				},
				to:{
					marginLeft:190
				},
				time:1000,
				type:type
			}).start();
			
			opts 可选参数:
			{
				from:null,					从何值开始
				to:{},						到何值结束
				target:null,				目标节点
				time:600,					运行时长
				delay:0,					延迟执行
				autoComplete:true,			当结束时（不管是销毁，停止还是正常结束），是否自动调用 onEnd 回调函数
				onStart:_this._empty,		动画开始时的回调函数
				onEnd:_this._empty,			动画结束时的回调函数
				onStep:_this._empty,		单步更新时的回调函数
				onPause:_this._empty,		暂时时触发的回调函数
				onResume:_this._empty,		恢复运行时的回调函数
				type:"linear"				动画变化曲线
			}
		 */
		self.initialize = function(opts) {
			self.options = _obj.parameter(opts, {
				from:null,
				to:{},
				target:null,
				time:100,
				delay:0,
				autoComplete:true,
				onStart:self._empty,
				onEnd:self._empty,
				onStep:self._empty,
				onPause:self._empty,
				onResume:self._empty,
				type:"easeOutQuad"
			});
			
			if(typeof self.options.type == 'string') {
				if(typeof _type[self.options.type] != 'function') {
					self.options.type = 'linear';
				}
				self.options.type = _type[self.options.type];
			}
			
			if(self.options.target == null) {
				throw new Error('Tweener have a non-null Object to the Target');
			}
			
			if(opts.from == null) {
				self.options.from = self._getFrom(self.options.target, self.options.to);
			}
			
			self.delay = self.options.delay;
			self.target = self.options.target;
			
			return self;
		};
		/**
		 * 开始动画
		 * @method start
		 * @return this
		 */
		self.start = function() {
			if(self.holding) {
				self.resume();
			}else {
				self.options.onStart && self.options.onStart();
				
				if(self.timer == null) {
					self.timer = new _timer({
						duration:28,
						delay:self.delay,
						callback:_obj.bind(self.step, self)
					});
				}
				
				self.timer.start();
				self.isPlay = true;
			}
			
			return self;
		};
		/**
		 * 动画分步执行函数
		 * @method step
		 * @return this
		 * @example
		   onStep回调函数三个函数
		   target {Object}	目标对象
		   running {Object}	当前运行时间
		   time {Object}	总时间
		   onStep(target, running, time)
		   
		   该自定义回调函数将允许自主变更目标值
		 */
		self.step = function() {
			var running = self.timer.running;
			if(running < self.options.time) {
				var from = self.options.from;
				var to = self.options.to;

				for(var key in from) {
					if(from.hasOwnProperty(key)) {
						var isPercent = (to[key].charAt && to[key].charAt(to[key].length-1) == '%') ? '%' : '';
						var currentPropertyValue = self.options.type(running, self._toInt(from[key], key), self._toInt(to[key]) - self._toInt(from[key], key), self.options.time);
						currentPropertyValue = Math.round(currentPropertyValue * 100) / 100;
						if (panda.dom.isStyle(key)) {
							_$(self.target).css(key, currentPropertyValue + isPercent);
						}else {
							if (self.target && self.target.setAttribute) {
								_$(self.target).attr(key, currentPropertyValue + isPercent);
							}else {
								self.target[key] = currentPropertyValue + isPercent;
							}
						}
					}
				}
				
				// 自定义回调函数需要三个参数
				// @param target {Object}	目标对象
				// @param running {Object}	当前运行时间
				// @param time {Object}		总时间
				self.options.onStep && self.options.onStep(self.target, running, self.options.time);
			}else {
				self.stop();
			}
		};
		/**
		 * 停止
		 * @method stop
		 * @return this
		 */
		self.stop = function() {
			self.timer.stop();
			self.isPlay = false;
			
			if(self.options.autoComplete) {
				var currentStyles = self.options.to;
				for(var key in currentStyles) {
					if(currentStyles.hasOwnProperty(key)) {
						_$(self.target).css(key, currentStyles[key]);
					}
				}
				
				self.options.onEnd && self.options.onEnd();
			}
			
			return self;
		};
		/**
		 * 暂停动画
		 * @method pause
		 * @reutrn this
		 * @question 此处暂停的具体实现是将 delay 设置为大数, 可能会存在隐患
		 */
		self.pause = function() {
			if(self.timer) {
				self.timer.options.delay = 2592000000;
			}
			
			self.options.onPause && self.options.onPause();
			
			return self;
		};
		/**
		 * 恢复动画
		 * @method resume
		 * @return this
		 */
		self.resume = function() {
			if(self.timer) {
				self.timer.options.delay = self.delay;
			}
			
			self.options.onResume && self.options.onResume();
			
			return self;
		};
		/**
		 * 格式化目标值
		 * @method _getFrom
		 * @private
		 * @param {Object} source	源值
		 * @param {Object} target	目标值
		 * @return {Object} result
		 */
		self._getFrom = function(source, target) {
			var result = {};
			for(var key in target) {
				var value = _$(source).css(key);
				if(value === 'auto') {
					if(_$(self.target).css('position') == 'absolute') {
						if(key == 'top') {
							value = _$(self.target).position().y;
						}
						else if(key == 'left') {
							value = _$(self.target).position().x;
						}
					}else {
						value = 0;
					}
				}
				if(panda.dom.isStyle(key))
					result[key] = value;
				else
					result[key] = _$(source).attr(key) || 0;
			}
			
			for(var key in result) {
				return result;
			}
			
			return null;
		};
		self._empty = function() {
			
		};
		self._toInt = function(value, key) {
			if(typeof value === "string")
				return parseFloat(value);
			
			return value;
		};
		
		return self.initialize(opts);
	};
	
	module.exports = Tweener;
});
/**
 * 链接封装对象
 * @class URL
 * @constructor
 * User: lizihan
 * Date: 13-05-13
 * Time: 17:10
 */
define("base.util.URL", [], function (require, exports, module) {
	var URL = function(value) {
		var self = this;
		/**
		 * 原始链接
		 * @attribute _source
		 * @protected
		 * @type {String}
		 * @default ""
		 */
		self._source = "";
		/**
		 * 链接地址（无参数）
		 * @attribute _source
		 * @protected
		 * @type {String}
		 * @default ""
		 */
		self._url = "";
		/**
		 * 参数信息
		 * @attribute _query
		 * @protected
		 * @type {Object}
		 * @default null
		 */
		self._query = {};
		/**
		 * 锚点信息
		 * @attribute _anchor
		 * @protected
		 * @type {String}
		 * @default null
		 */
		self._anchor = null;
		/**
		 * 初始化方法
		 * @method initialize
		 * @param {Object} value
		 * @return this
		 */
		self.initialize = function(value) {
			value = value || "";
			self._source = value;
			self._url = value;
			self._query = {};
			self.parse();
			
			return self;
		};
		/**
		 * 解析链接数据
		 * @method parse
		 * @param {Object} value
		 * @return this
		 */
		self.parse = function(value) {
			if(value) {
				self._source = value;
				self._url = value;
			}
			
			self.parseAnchor();
			self.parseParam();
			
			return self;
		};
		/**
		 * 解析锚点信息
		 * @method parseAnchor
		 * @return this
		 */
		self.parseAnchor = function() {
			var anchor = self._url.match(/\#(.*)/);
			anchor = anchor ? anchor[1] : null;
			self._anchor = anchor;
			
			if(anchor != null) {
				self._anchor = self.getNameValuePair(anchor);
				self._url = self._url.replace(/\#.*/, '');
			}
			
			return self;
		};
		/**
		 * 解析参数信息
		 * @method parseParam
		 * @return this
		 */
		self.parseParam = function() {
			var query = self._url.match(/\?([^\?]*)/);
			query = query ? query[1] : null;
			if(query != null) {
				self._url = self._url.replace(/\?([^\?]*)/, '');
				self._query = self.getNameValuePair(query);
			}
			
			return self;
		};
		/**
		 * 设置键值对
		 * @method getNameValuePair
		 * @param {Object} value
		 * @return {Object} fix by encodeURIComponent()
		 */
		self.getNameValuePair = function(value) {
			var result = {};
			value.replace(/([^&=]*)(?:\=([^&]*))?/gim, function(w, name, value) {
				if(name == "")
					return;
					
				// 根据架构委员会建议：将匹配字段进行编码，以防出现XSS漏洞，该处修改导致对外API返回结果不一致		by lzh 2013-11-19
				result[name] = (value || "");
			});
			
			return result;
		};
		/**
		 * 获取源链接
		 * @method getSource
		 * @return {String}
		 */
		self.getSource = function() {
			return self._source;
		};
		/**
		 * 获取参数值
		 * @method getParam
		 * @param {Object} name
		 * @return {String}
		 */
		self.getParam = function(name) {
			return self._query[name] || "";
		};
		/**
		 * 设置参数值
		 * @param {Object} name
		 * @param {Object} value
		 * @method setParam
		 * @return this
		 */
		self.setParam = function(name, value) {
			if(name == null || name == "" || typeof name != 'string')
				throw new Error("URL.setParam invalidate param.");
				
			self._query = self._query || {};
			self._query[name] = value;
			
			return self;
		};
		/**
		 * 清除所有参数
		 * @mthod clearParam
		 * @return this
		 */
		self.clearParam = function() {
			self._query = {};
			
			return self;
		};
		/**
		 * 设置Query
		 * @param {Object} value
		 * @return this
		 */
		self.setQuery = function(value) {
			if(typeof value == 'string') {
				self.parse();
				self._source = self._url = self._url + "?"+ value;
				self.parse();
				return self;
			}
			
			self._query = value;
			
			return self;
		};
		/**
		 * 获取Query
		 * @method getQuery
		 * @return {String}
		 */
		self.getQuery = function() {
			return self._query;
		};
		/**
		 * 获取锚点信息
		 * @method getAnchor
		 * @return {String}
		 */
		self.getAnchor = function() {
			return self.serialize(self._anchor);
		};
		/**
		 * 序列化对象
		 * @param {Object} value
		 * @method serialize
		 * @return {String}
		 */
		self.serialize = function(value) {
			var result = [];
			for(var key in value) {
				if(value[key] == null || value[key] == "") {
					result.push(key + "");
				}else {
					result.push(key + "=" + value[key]);
				}
			}
			
			return result.join("&");
		};
		/**
		 * 返回字符串格式
		 * @method toString
		 * @return {String}
		 */
		self.toString = function() {
			var query = self.serialize(self.getQuery());
			return self._url + (query.length>0?"?"+query:"") + (self._anchor?"#"+self.serialize(self._anchor):"");	
		};
		
		return self.initialize(value);
	};
	
	module.exports = URL;
});
/**
 * 全局唯一标识生成器
 * User: lizihan
 * Date: 13-06-16
 * Time: 15:14
 */
define("base.util.guid", [], function (require, exports, module) {
	return function(type) {
		var g = "";
        var i = 32;
		type = "N"
        while (i--) {
            g += Math.floor(Math.random() * 16.0).toString(16);
        }
        return g.toString().replace(/,/g, "");
	};
});
/**
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-6-13
 * Time: 下午4:00
 */
/**
 * AJAX封装类
 * @class io
 * @constructor
 */
define("base.util.io", [], function (require, exports, module) {
    var PObj = require("base.object"),
        Guid = require("base.util.guid"),
        JSONPRequest = require("base.util.jsonp"),
        PUrl = require("base.util.URL"),
        uniqueId = new Date().getTime();

    /**
     * AJAX
     * @method ajax
     * @param {Object} options
     * @return this
     * @example
     *            panda.util.ajax({
	 * 				url:"#",
	 * 				type:"GET",
	 * 				data:{},
	 * 				async:true,
	 * 				useGzip:false,
	 * 				success:function() {},
	 * 				error:function() {},
	 * 				complete:function() {}
	 * 			});
     */
    function IO(opts) {
        var self = this,
            _defaultCallback = function () {
            },
            defaultOpts = {
                url: window.location.href,
                type: "GET",
                async: true,
                useGzip: false,
                noCache: true,
                dataType: "",
                requestHeaders: {},
                core: null,
                data: {},
                timeout: 60000,
                tId: null,
                success: _defaultCallback,
                error: _defaultCallback,
                complete: _defaultCallback,
                crossDomain:false
            };
        this.options = PObj.parameter(opts, defaultOpts);
        
        if(this.options.dataType == 'jsonp') {
			this.options.callbackParameter = this.options.callbackParameter || 'callback';
			this.options.callback = this.options.callback || ('_'+(uniqueId++));
			return new JSONPRequest()._init(this.options);
		}
        
        this.urlObj = new PUrl(this.options.url);
        this.setHeader = function (headName, headValue) {
            this.options.requestHeaders[headName] = headValue;
        };
        this.parameterData = function () {
            var result = [];
            var _data = this.urlObj._query;
            for (var i in _data)
                result.push(i + '=' + encodeURIComponent(decodeURIComponent(_data[i])));
            for (var key in self.options.data) {
            	if(self.options.data.hasOwnProperty(key)) {
            		result.push(key + "=" + self.options.data[key]);
            	}
            }
            return result.join('&');
        };

        this.getNoCacheableURL = function (url, cache) {
            if (cache) {
                var _url = url.indexOf('?') > 0 ? url + "&t=" : url + '?';
                return _url + Math.round(Math.random() * 10000);
            } else {
                return url;
            }
        };
        this.fixed = function () {
            if (( self.options.type.toUpperCase()) == "POST") {
                if (self.options.requestHeaders.contentType) {
                    self.setHeader("CONTENT-TYPE", self.requestHeaders.contentType);
                } else {
                    self.setHeader("CONTENT-TYPE", "application/x-www-form-urlencoded");
                }
            } else {
                var parameterData = self.parameterData();
                if (parameterData && parameterData.length > 0)
                    self.urlObj.url += "?" + self.parameterData();
            }
            if (self.options.useGzip) {
                self.setHeader("Accept-Encoding", "gzip, deflate");
            }
        };

        this.done = function () {
        	var url = self.urlObj._url;
        	if((self.options.type.toUpperCase()) == "GET") {
        		url = url + "?"+ self.parameterData();
        	}
        	url = self.getNoCacheableURL(url, true);
            self.core = this._createCore();
            try {
            self.core.id = Guid();
            }catch(e) {}
            self.core.onreadystatechange = _onReadyStateChange;
            self.core.open(self.options.type.toUpperCase(), url, !!self.options.async);
            try {
	            for (var i in self.options.requestHeaders) {
	                self.core.setRequestHeader(i, self.options.requestHeaders[i]);
	            }
	        }catch(e) {}
            self.core.send(self.parameterData() || null);
            if (self.options.async && self.options.timeout > 0) {
                self.timeoutTimer = setTimeout(function () {
                    self.core.abort();
                    self.options.error("", "timeout", self.core);
                }, self.options.timeout);
            }
        };
        function _onReadyStateChange() {
            switch (self.core.readyState) {
                case 1:
                case 2:
                case 3:
                    break;
                case 4:
                    if (window.ued_config && window.ued_config.development == 'online') {
                        try {
                            _onResponse();
                        } catch (e) {
                            panda.stack.extractStacktrace(e, 1);
                        }
                    } else {
                        _onResponse();
                    }
                    break;
                default:
                    break;
            }
        };

        function _onResponse() {
            if (self.options.timeoutTimer) clearTimeout(self.options.timeoutTimer);
            var _responseText = self.core.responseText;
            if (self.core.status == 200) {
                if (self.options.dataType && self.options.dataType == "json") {
                    eval("var response =" + (self.core.response || _responseText));
                } else {
                    var response = self.core.response || _responseText
                }
                self.options.success(response);
            } else {
                self.options.error(_responseText, self.core.statusText, self.core);
                if (self.timeoutTimer)clearTimeout(self.timeoutTimer);
            }
            self.options.complete(self.core.response);
        };
        this._createCore = function () {
            var _xmlhttp = null;
            if(self.options.crossDomain) {
				_xmlhttp = new XMLHttpRequest();
				if ("withCredentials" in _xmlhttp) {
				
				}else if(typeof window.XDomainRequest != 'undefined') {
					_xmlhttp = new XDomainRequest();
				}
			}else if (window.ActiveXObject) {
                try {
                    _xmlhttp = new ActiveXObject('microsoft.xmlhttp');
                } catch (e) {
                    _xmlhttp = new ActiveXObject('msxml2.xmlhttp');
                }
            } else {
                _xmlhttp = new XMLHttpRequest();
            }
            return _xmlhttp;
        };

        this.urlObj.parse();
        this.fixed();
        this.done();

        return self;
    }

    module.exports = {
        ajax: IO,
        jsonp: function () {
            var jp = new JSONPRequest();
            jp._init(arguments[0]);
        }
    };
});
/**
 * author: sunqingwei <sunqingwei@jd.com>
 * Date: 13-11-22
 * Time: 上午10:20
 */
define("base.util.jsonp", [], function (require, exports, module) {
    /**
     * 加载依赖
     */
    var PObject = require("base.object");
    var PGuid = require("base.util.guid");
    var win = PObject.isWindow(window) ? window : null,
        doc = PObject.isWindow(window) ? win.document : null,
        _defaultCallback = function () {
        };

    function jsonp() {
        this._configs = {
            STR_ASYNC: "async",
            STR_CHARSET: "charset",
            STR_CED_JSONP: "cedJsonp",
            STR_ON: "on",
            STR_ON_ERROR: "onerror",
            STR_ON_LOAD: "onload",
            STR_ON_READY_STATE_CHANGE: "onreadystatechange",
            STR_READY_STATE: "readyState",
            STR_REMOVE_CHILD: "removeChild",
            STR_SCRIPT_TAG: "<script>",
            STR_SUCCESS: "success",
            STR_ERROR: "error",
            STR_TIMEOUT: "timeout",
            STR_ID: "cedJsonp"
        };
        this.lastValue = null;
        this.done = 0;
        this.stamp = 0;
        this._header = doc.getElementsByTagName("head")[0];
        this._script = doc.createElement("script");
        this._defaultOpts = {
            success: _defaultCallback,
            error: _defaultCallback,
            complete: _defaultCallback,
            callback: "cedJsonp"
        };
    }

    jsonp.prototype = {
        _qMarkOrAmp: function (url) {
            return /\?/.test(url) ? "&" : "?";
        },
        _init: function (opts) {
            this._configs.STR_ID += PGuid();
            this.options = PObject.parameter(opts, this._defaultOpts);
            this.stamp = new Date().valueOf();
            this._open();
            this._send();
        },
        genericCallback: function (data) {
            this.lastValue = [ data ];
        },
        _open: function () {
            var self = this;
            win[self.options.callback] = self.genericCallback;
            self._script[self._configs.STR_ON_LOAD] =
                self._script[self._configs.STR_ON_ERROR] =
                    self._script[self._configs.STR_ON_READY_STATE_CHANGE] = function (result) {
                        if (!self._script[self._configs.STR_READY_STATE ] || !/i/.test(self._configs._script[self._configs.STR_READY_STATE ])) {
                            result = self.lastValue;
                            self.lastValue = 0;
                            result ? self.notifySuccess(result[ 0 ]) : self.notifyError(self._configs.STR_ERROR);
                        }
                    };
            this.options.url += this.options.data ? ( this._qMarkOrAmp(this.options.url) + this.data ) : "";
            this.options.callbackParameter && ( this.options.url += this._qMarkOrAmp(this.options.url) + encodeURIComponent(this.options.callbackParameter) + "=?" );
            !this.options.cache && !this.options.pageCache && ( this.options.url += this._qMarkOrAmp(this.options.url) + "_" + this.stamp + "=" );
            this.options.url = this.options.url.replace(/=\?(&|$)/, "=" + this.options.callback + "$1");
        },
        _send: function () {
            this._script.src = this.options.url || "";
            this._script.id = this._configs.STR_ID;
            this._script.charset = this.options.charset || "utf-8";
            this._header.appendChild(this._script);
        },
        notifySuccess: function (result) {
            if (!( this.done++ )) {
                this.options.success(result);
                this.clearUp();
            }
        },
        notifyError: function (result) {
            if (!( this.done++ )) {
                this.options.error(result);
                this.clearUp();
            }
        },
        startClientTime: function () {
            var self = this;
            this.tId = this.options.timeout > 0 && setTimeout(function () {
                self.notifyError(self.options.STR_TIMEOUT);
            }, this.options.timeout);
        },
        clearUp: function () {
            this.tId && clearTimeout(this.tId);
            this._script[ this._configs.STR_ON_READY_STATE_CHANGE ] =
                this._script[ this._configs.STR_ON_LOAD ] =
                    this._script[ this._configs.STR_ON_ERROR ] = null;
            if (doc.getElementById(this._configs.STR_ID).parentNode)
                doc.getElementById(this._configs.STR_ID).parentNode.removeChild(doc.getElementById(this._configs.STR_ID));
        }
    };
    module.exports = jsonp;
})
;
/**
 * 缓动函数
 * @class tweens
 * @constructor
 * User: lizihan
 * Date: 13-06-17
 * Time: 10:37
 */
define("base.util.tweens", [], function (require, exports, module) {
	module.exports = {
		/**
		 * @method linear
		 * @param {Object} t
		 * @param {Object} b
		 * @param {Object} c
		 * @param {Object} d
		 */
		linear:function(t,b,c,d){ 
			return c*t/d + b; 
		},
		/**
		 * @method easeOutQuad
		 * @param {Object} t
		 * @param {Object} b
		 * @param {Object} c
		 * @param {Object} d
		 */
		easeOutQuad: function(t, b, c, d){
			return -c * (t /= d) * (t - 2) + b;
		}
	};
});
/**
 * 组件基础类及建议公开的API
 * @class Widget
 * @constructor
 * User: lizihan
 * Date: 13-06-20
 * Time: 18:41
 */
define("base.widget.Widget", [], function(require, exports, module) {
	var _guid = require("base.util.guid");
	
	var Widget = function() {
		var self = this;
		/**
		 * 组件管理器的单例引用
		 * @attribute manager
		 * @protected
		 * @type {Object}
		 * @default WidgetManager instance
		 */
		self.manager = require("base.widget.WidgetManager");
		/**
		 * 组件唯一ID
		 * @attribute name
		 * @protected
		 * @type {String}
		 * @default Widget_[guid]
		 */
		self.name = "Widget_"+_guid();
		/**
		 * 组件可监听事件列表
		 * @attribute publishList
		 * @protected
		 * @type {Array}
		 * @default []
		 */
		self.publishList = [];
		/**
		 * 组件可发布事件列表
		 * @attribute notifyList
		 * @protected
		 * @type {Array}
		 * @default []
		 */
		self.notifyList = [];
		/**
		 * 组件可发布事件列表
		 * @attribute notifyList
		 * @protected
		 * @type {Array}
		 * @default []
		 */
		self.uiType = null;
		/**
		 * 组件实例化方法
		 * @method initialize
		 * @return this
		 */
		self.initialize = function() {
			self.manager.add({
				name:self.name,
				publishList:self.publishList,
				notifyList:self.notifyList,
				type:self.uiType,
				target:self
			});
			return self;
		};
		/**
		 * 组件初始化方法
		 * @method init
		 */
		self.init = function() {
			
		};
		/**
		 * 组件规范建议使用的渲染方法
		 * @method render
		 */
		self.render = function(opts) {
			
		};
		/**
		 * 组件规范建议使用的销毁方法
		 * @method destroy
		 */
		self.destroy = function() {
			
		};
		/**
		 * 获取自定义事件
		 * @method notify
		 * @param {String} eventName
		 * @param {Object} data
		 */
		self.notify = function(eventName, data) {
			
		};
		/**
		 * 发布自定义事件
		 * @method publish
		 * @param {Object} eventName
		 * @param {Object} data
		 */
		self.publish = function(eventName, data) {
			if(self.manager) {
				self.manager.publish(self, eventName, data);
			}
		};
		
		return self.initialize();
	};
	
	module.exports = Widget;
});

/**
 * 全局组件管理器
 * @class WidgetManager
 * @constructor
 * User: lizihan
 * Date: 13-06-20
 * Time: 18:41
 */
define("base.widget.WidgetManager", [], function(require, exports, module) {
	var Manager = function() {
		var self = this;
		/**
		 * 组件类型分类
		 * @private
		 * @attribute _types
		 * @type {Object}
		 * @default {}
		 */
		self._types = {};
		/**
		 * 保存所有组件
		 * @private
		 * @attribute _list
		 * @type {Object}
		 * @default {}
		 */
		self._list = {};
		/**
		 * 自定义事件发布者
		 * @private
		 * @attribute _dispatcher
		 * @type {Object}
		 * @default {}
		 */
		self._dispatcher = {};
		
		/**
		 * 添加组件实例，为组件添加事件相关处理，分类存储组件引用
		 * @method add
		 * @param {Object} ui 
		 * {
		 * 		name 唯一标识符
		 * 		publishList 发布事件列表
		 * 		notifyList 监听事件列表
		 * 		type UI类型标识
		 * 		target UI实例
		 * }
		 * @return ui.target
		 */
		self.add = function(ui) {
			if(!ui || !ui.target) {
				throw new Error("Can't added a null Object to WidgetManager");
			}
			
			if(typeof this._types[ui.type] != 'array') {
				this._types[ui.type] = [];
			}
			this._types[ui.type].push(ui);
			
			this._list[ui.name] = ui;
			
			// 待添加监听事件
			for (var i = 0; i < ui.notifyList.length; i++) {
				if (typeof this._dispatcher[ui.notifyList[i]] != 'array') {
					this._dispatcher[ui.notifyList[i]] = [];
				}
				
				this._dispatcher[ui.notifyList[i]].push(ui.name);
			}
			
			return ui.target;
		};
		/**
		 * 删除组件
		 * @method remove
		 * @param {Object} value
		 * @return ui
		 */
		self.remove = function(value) {
			var uiClass = null;
			if(typeof value == 'string') {
				uiClass = this._list[ui];
			}
			if(typeof value == 'object') {
				uiClass = this._list[ui.name];
			}
			
			//从types里删除
			for(var i=0;i<this._types[uiClass.type].length;i++) {
				if(this._types[uiClass.type][i] && this._types[uiClass.type][i].name == uiClass.name) {
					this._types[uiClass.type].splice(i, 1);
					break;
				}
			}
			
			//从list里删除
			for(var key in this._list) {
				if(this._list[key] && this._list[key].name == uiClass.name) {
					delete this._list[key];
					break;
				}
			}
			//执行destroy方法
			uiClass.target && uiClass.target.destroy && uiClass.target.destroy();
			
			//注销事件
			
			return uiClass;
		};
		/**
		 * 获取组件实例
		 * @method get
		 * @param {Widget} Class
		 * @param {Object} opts
		 * @return ui
		 * @example
		 * var slider = panda.widget.manager.get(require("widget.Slider"), {type:'vertical'});
		 */
		self.get = function(Class, opts) {
			var TypeWidget = null;
			TypeWidget = new Class();
			TypeWidget.init(opts);
			return TypeWidget;
		};
		/**
		 * 根据组件唯一ID获取组件实例
		 * @method getByName
		 * @param {String} name
		 * @return ui
		 */
		self.getByName = function(name) {
			return this._list[name].target;
		};
		/**
		 * 根据组件类型获取组件实例组
		 * @method getByType
		 * @param {String} name
		 * @return Array
		 */
		self.getByType = function(type) {
			return this._types[type];
		};
		/**
		 * 发布事件
		 * @method publish
		 * @param {Object} target
		 * @param {String} eventName
		 * @param {Object} data
		 */
		self.publish = function(target, eventName, data) {
			if(panda(target.publishList).index(eventName) > -1) {
				this.dispatch(eventName, data);
			}
		};
		/**
		 * 发布事件
		 * @method publish
		 * @protected
		 * @param {String} eventName
		 * @param {Object} data
		 */
		self.dispatch = function(eventName, data) {
			if(this._dispatcher[eventName] && this._dispatcher[eventName] instanceof Array) {
				for(var i=0;i<this._dispatcher[eventName].length;i++) {
					var target = this.getByName(this._dispatcher[eventName][i]);
					if(target) {
						target.notify.call(target, eventName, data);
					}
				}
			}
		};
		
		return self;
	};
	
	module.exports = new Manager();
});

var ued_concat = {"panda.js":["amd/panda.js","base/*.js","base/array/*.js","base/dom/*.js","base/event/*.js","base/string/*.js","base/system/*.js","base/util/*.js","base/widget/*.js","Concat.js"]}; try{panda.use("base.global");}catch(e){}