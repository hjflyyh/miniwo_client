window.EventSystem = new(function(){
    var isDebug = false,
        e = {},
        allObject = [],
        i = 0,
        n = !0;
    this.setDebug = function(e) {
        isDebug = e;
    };
    this.setSubscribeEnable = function(t) {
        n = t;
    };
    this.send = function(o, i , parm2) {
        var l = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
        if (n) {
            var r = null,
                a = 0,
                s = null;
            for (var c in e) {
                var _ = e[c],
                    d = _[o];
                if (null != d){
                    if (l) {
                        var u = parseInt(c.replace("__", ""));
                        if (u > a) {
                            a = u;
                            s = _.__target;
                            r = d;
                        }
                    } else d.apply(_.__target, null != i ? [i] : null);
                }
            }
            let param = null;
            if(i != null || parm2 != null){
                if(i != null){
                    param = [];
                    param.push(i)
                    if(parm2 != null){
                        param.push(parm2)
                    }
                }
                // param = [i != null ? i : null, parm2 != null ? parm2 : null];
            }
            l && null != r && r.apply(s, param);
        }
    };

    this.addListent = function(eventKey, eventCallBack, target) {
        var r = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3],
            targetName = target.__name;
        if (null == targetName) {
            target.__name = targetName = "__" + i++;
            var s = this;
            let oldFun = target["onDestroy"];
            r && (target.onDestroy = function() {
                oldFun && oldFun.apply(target);
                s.remove(target);
            });
        }
        if (null == e[targetName]) {
            e[targetName] = {
                __target: target
            };
        }
        e[targetName][eventKey] = eventCallBack;
    };
    this.remove = function(t) {
        var o = t.__name;
        e[o] = null;
        delete e[o];
    };
    this.removeAll = function() {
        e = {};
    };
    this.clostView = function(t) {
        if (t) {
            this.remove(t);
            t.node.destroy();
        }
    };

    //添加调用对象
    this.addBean = function(e) {
        allObject.push(e);
    };
    //每个对象调用e方法
    this.eachBean = function(e, i) {
        for (var n = 0, l = allObject.length; n < l; n++) {
            var r = allObject[n];
            if (e in r)
                try {
                    r[e].apply(r, i);
                } catch (t) {
                    cc.error(
                        "[FACADE]eachBean error: " +
                        r.constructor.name +
                        " " +
                    t.toString()
                );
            }
        }
    };
})();

//专门给格子用的事件
window.GridEventSystem = new(function(){
    var isDebug = false,
        e = {},
        allObject = [],
        i = 0,
        n = !0;
    this.setDebug = function(e) {
        isDebug = e;
    };
    this.setSubscribeEnable = function(t) {
        n = t;
    };
    this.send = function(o, i , parm2) {
        var l = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
        if (n) {
            var r = null,
                a = 0,
                s = null;
            for (var c in e) {
                var _ = e[c],
                    d = _[o];
                if (null != d){
                    if (l) {
                        var u = parseInt(c.replace("__", ""));
                        if (u > a) {
                            a = u;
                            s = _.__target;
                            r = d;
                        }
                    } else d.apply(_.__target, null != i ? [i] : null);
                }
            }
            let param = null;
            if(i != null || parm2 != null){
                if(i != null){
                    param = [];
                    param.push(i)
                    if(parm2 != null){
                        param.push(parm2)
                    }
                }
                // param = [i != null ? i : null, parm2 != null ? parm2 : null];
            }
            l && null != r && r.apply(s, param);
        }
    };

    this.addListent = function(eventKey, eventCallBack, target) {
        var r = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3],
            targetName = target.__name;
        if (null == targetName) {
            target.__name = targetName = "__" + i++;
            var s = this;
            let oldFun = target["onDestroy"];
            r && (target.onDestroy = function() {
                oldFun && oldFun.apply(target);
                s.remove(target);
            });
        }
        if (null == e[targetName]) {
            e[targetName] = {
                __target: target
            };
        }
        e[targetName][eventKey] = eventCallBack;
    };
    this.remove = function(t) {
        var o = t.__name;
        e[o] = null;
        delete e[o];
    };
    this.removeAll = function() {
        e = {};
    };
    this.clostView = function(t) {
        if (t) {
            this.remove(t);
            t.node.destroy();
        }
    };

    //添加调用对象
    this.addBean = function(e) {
        allObject.push(e);
    };
    //每个对象调用e方法
    this.eachBean = function(e, i) {
        for (var n = 0, l = allObject.length; n < l; n++) {
            var r = allObject[n];
            if (e in r)
                try {
                    r[e].apply(r, i);
                } catch (t) {
                    cc.error(
                        "[FACADE]eachBean error: " +
                        r.constructor.name +
                        " " +
                        t.toString()
                    );
                }
        }
    };
})();