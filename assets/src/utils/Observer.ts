
    export interface IObserver {
        target: any;
        selector: Function;
        once: boolean;
    }

    export interface IPostData {
        target: any;
        data: any;
    }

    export class CallbackInfo {
        public callback: Function;
        public thisObj: any;
        public once: boolean;

        public static create() {
            if (CallbackInfo.pool.length > 0) {
                return CallbackInfo.pool.pop();
            }
            return new CallbackInfo();
        }

        public recycle() {
            let s = this;
            s.callback = undefined;
            s.thisObj = undefined;
            s.once = false;
            CallbackInfo.pool.push(s);
        }

        public removeAll() {
            CallbackInfo.pool = [];
        }

        static pool: CallbackInfo[] = [];
    }
    
    export class Observer extends Object {
        private _callbackMap: { [k: string]: CallbackInfo[] } = {};
        constructor() {
            super();

        }

        public on(name: string | number, callback: Function, thisObj: any, once = false): boolean {
            let s = this;
            let n = String(name);
            if (!s._callbackMap.hasOwnProperty(n)) {
                s._callbackMap[n] = [];
            }
            let list = s._callbackMap[n];
            for (let i = 0, len = list.length; i < len; i++) {
                let info = list[i];
                if (info && info.callback == callback && info.thisObj == thisObj) {
                    return;
                }
            }
            let cb = CallbackInfo.create();
            cb.callback = callback;
            cb.thisObj = thisObj;
            cb.once = once;
            list[list.length] = cb;
            return true;
        }

        public once(name: string | number, callback: Function, thisObj: any): boolean {
            return this.on(name, callback, thisObj, true);
        }

        public off(name: string | number, callback: Function, thisObj: any) {
            let n = String(name);
            if (this._callbackMap.hasOwnProperty(n)) {
                let list = this._callbackMap[n];
                for (let i = 0, len = list.length; i < len; i++) {
                    let info = list[i];
                    if (info && info.callback == callback && info.thisObj == thisObj) {
                        info.recycle();
                        list[i] = undefined;
                        break;
                    }
                }
            }
        }

        public post(name: string | number, data?: any) {
            let s = this;
            let n = String(name);
            if (s._callbackMap.hasOwnProperty(n)) {
                let list = s._callbackMap[n];
                let length = list.length;
                if (length == 0) {
                    return;
                }
                let currentIndex = 0;
                for (var i = 0; i < length; i++) {
                    let info = list[i];
                    if (info) {
                        let callback = info.callback;
                        let thisObj = info.thisObj;
                        if (info.once) {
                            info.recycle();
                            list[i] = undefined;
                        } else {
                            if (currentIndex != i) {
                                list[currentIndex] = info;
                                list[i] = undefined;
                            }
                            currentIndex++;
                        }
                        callback.call(thisObj, { data: data, target: self });
                    }
                }
                if (currentIndex != i) {
                    length = list.length;
                    while (i < length) {
                        list[currentIndex++] = list[i++];
                    }
                    list.length = currentIndex;
                }
            }
        }

        public rmvAll() {
            this._callbackMap = {};
        }
    }
