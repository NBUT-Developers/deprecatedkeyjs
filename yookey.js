//
//  JockeyJS
//
//  Copyright (c) 2013, Tim Coulter
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be
//  included in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
//  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
//  LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
//  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
//  WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
;
(function() {

    // Non-accessible variable to send to the app, to ensure events only
    // come from the desired host.
    var host = window.location.host;

    var Dispatcher = {
        callbacks: {},

        send: function(envelope, complete) {
            this.dispatchMessage("event", envelope, complete);
        },

        sendCallback: function(messageId, data) {
            var envelope = Jockey.createEnvelope(messageId, "callback", data);

            this.dispatchMessage("callback", envelope, function() {});
        },

        triggerCallback: function(id, data) {
            var dispatcher = this;

            // Alerts within JS callbacks will sometimes freeze the iOS app.
            // Let's wrap the callback in a timeout to prevent this.
            setTimeout(function() {
                dispatcher.callbacks[id](data);
            }, 0);
        },

        // `type` can either be "event" or "callback"
        dispatchMessage: function(type, envelope, complete) {
            // We send the message by navigating the browser to a special URL.
            // The iOS library will catch the navigation, prevent the UIWebView
            // from continuing, and use the data in the URL to execute code
            // within the iOS app.

            var dispatcher = this;

            this.callbacks[envelope.id] = function(data) {
                complete(data);

                //这里我们先不删除callback id 做到多次callback可以回调，有有问题联系张创！！
                //  delete dispatcher.callbacks[envelope.id];
            };

            var src = "jockey://" + type + "/" + envelope.id + "?" + encodeURIComponent(JSON.stringify(envelope));
            var iframe = document.createElement("iframe");
            iframe.setAttribute("src", src);
            document.documentElement.appendChild(iframe);
            iframe.parentNode.removeChild(iframe);
            iframe = null;
        }
    };

    var Jockey = {
        listeners: {},

        dispatcher: null,

        messageCount: 0,

        on: function(type, fn) {
            if (!this.listeners.hasOwnProperty(type) || !this.listeners[type] instanceof Array) {
                this.listeners[type] = [];
            }

            this.listeners[type].push(fn);
        },

        off: function(type) {
            if (!this.listeners.hasOwnProperty(type) || !this.listeners[type] instanceof Array) {
                this.listeners[type] = [];
            }

            this.listeners[type] = [];
        },

        send: function(type, payload, complete) {
            if (payload instanceof Function) {
                complete = payload;
                payload = null;
            }

            payload = payload || {};
            complete = complete || function() {};

            var envelope = this.createEnvelope(this.messageCount, type, payload);

            this.dispatcher.send(envelope, complete);

            this.messageCount += 1;
        },

        //用于判断是否存在jockey
        isHooked: function() {
            return true;
        },

        // Called by the native application when events are sent to JS from the app.
        // Will execute every function, FIFO order, that was attached to this event type.
        trigger: function(type, messageId, json) {
            var self = this;

            var listenerList = this.listeners[type] || [];

            var executedCount = 0;

            var complete = function(data) {
                executedCount += 1;

                if (executedCount >= listenerList.length) {
                    self.dispatcher.sendCallback(messageId, data);
                }
            };

            if (listenerList.length === 0) {
                self.dispatcher.sendCallback(messageId, {
                    error: "NotFound"
                });
            } else {

                for (var index = 0; index < listenerList.length; index++) {
                    var listener = listenerList[index];

                    // If it's a "sync" listener, we'll call the complete() function
                    // after it has finished. If it's async, we expect it to call complete().
                    if (listener.length <= 1) {
                        listener(json);
                        complete();
                    } else {
                        listener(json, complete);
                    }
                }

            }
        },

        // Called by the native application in response to an event sent to it.
        // This will trigger the callback passed to the send() function for
        // a given message.
        triggerCallback: function(data) {
            var dataObj = JSON.parse(data);
            this.dispatcher.triggerCallback(dataObj.messageId, dataObj.data);
        },

        createEnvelope: function(id, type, payload) {
            return {
                id: id,
                type: type,
                host: host,
                payload: payload
            };
        }
    };

    // i.e., on a Desktop browser.
    var nullDispatcher = {
        send: function(envelope, complete) {
            complete();
        },
        triggerCallback: function() {},
        sendCallback: function() {}
    };

    // Dispatcher detection. Currently only supports iOS.
    // Looking for equivalent Android implementation.
    var i = 0,
        iOS = false,
        iDevice = ['iPad', 'iPhone', 'iPod'];

    for (; i < iDevice.length; i++) {
        if (navigator.platform.indexOf(iDevice[i]) >= 0) {
            iOS = true;
            break;
        }
    }

    // Detect UIWebview. In Mobile Safari proper, jockey urls cause a popup to
    // be shown that says "Safari cannot open page because the URL is invalid."
    // From here: http://stackoverflow.com/questions/4460205/detect-ipad-iphone-webview-via-javascript

    var UIWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(navigator.userAgent);
    var isAndroid = navigator.userAgent.toLowerCase().indexOf("android") > -1;

    if ((iOS && UIWebView) || isAndroid) {
        Jockey.dispatcher = Dispatcher;
    } else {
        Jockey.dispatcher = nullDispatcher;
    }

    window.Jockey = Jockey;
})();


/*兼容老版本的APP，封装APP提供给h5的各种原生方法*/
;(function() {

    var Cockey = {
        send: send,
        on: on
    };

    Cockey.has_Jockey = (function() {
        var ua = window.navigator.userAgent.toLowerCase();
        return ua.indexOf('jockey') != -1 && ua.indexOf('cheniu') != -1;
    })();

    var sendTypeStrategies = {
        /**
         * 通过cheniu://协议打开原生界面
         */
         /*Cockey.send('OpenVCBridge', {
            protocol: "cheniu://open/xxxx"
        });*/
        OpenVCBridge: function(payload) {
            window.location.href = payload.protocol;
        },
        /*Cockey.send('PushWebVCBridge', {
               url: '...',
               hasNav: '',
               hasCheNiu: '',
               hasShare: '',
        });*/
        /*打开一个新的web页面*/
        PushWebVCBridge: function(payload) {
            // CheNiu.openWebView(payload.url, true, true, false);
            var hasNav = payload.hasNav === undefined ? true : payload.hasNav;
            var hasCheNiu = payload.hasCheNiu === undefined ? true : payload.hasCheNiu;
            var hasShare = payload.hasShare === undefined ? false : payload.hasShare;
            CheNiu.openWebView(payload.url, hasNav, hasCheNiu, hasShare);
        },

        /*Cockey.send('ControlWebVCBridge', {
            action: 'close'
        });*/
        /*关闭现有页面*/
        ControlWebVCBridge: function(payload) {
            window.location.href = 'cheniu://webview/close';
        },

        /*Cockey.send('UserBridge', function(data) {
               //data.userToken;
        });*/
        UserBridge: function(payload, complete) {
            var token = '';
            var userId = '';

            token = CheNiu.getToken();
            userId = CheNiu.getLoginName(); //用户登录车牛手机号
            contactPhone = CheNiu.getPhoneNum(); //用户联系电话，注意用户有可能会修改联系方式

            complete({
                userToken: token,   //兼容，新版车牛返回的是userToken这个字段
                userId: userId,
                contactPhone: contactPhone
            });
        }

    }

    var onTypeStrategies = {

        /**
         * 分享
         * Cockey.on('shareBridge', function(payload, complete) {
                complete({
                    title: '标题',
                    content: '内容',
                    url: window.location.href,
                    image: 'http://img.souche.com/20160104/jpg/64569ed7ba6c37fd2c0ba89ad5ecfbd5.jpg@300h_1e_1c_1pr_1wh.jpg'
                });
            });
         */
        shareBridge: {

            payload: {},

            complete: function(obj) {
                obj = obj || {};

                obj.enable = 1;

                window.app_cheniu_share = obj;

                window.CheNiu && window.CheNiu.setShareInfo && window.CheNiu.setShareInfo(JSON.stringify(window.app_cheniu_share));
            }
        },

        /**
         * 分享成功后的回调
         * Cockey.on('shareResultBridge', function(payload, complete) {
                if (payload.result) {
                    //用户分享成功
                }
            });
         */
        shareResultBridge: {
            payload: {},

            complete: function() {

            },
            polyfill: function(fn) {
                var that = this;
                window.CheNiu && (window.CheNiu.shareSuccess = function() {
                    that.payload.result = true;
                    fn(that.payload, that.complete);
                });
            }
        }
    }

    function send(type, payload, complete) {
        if (Cockey.has_Jockey) {
            Jockey.send(type, payload, complete);
        } else {
            sendOld(type, payload, complete);
        }
    }

    function on(type, fn) {
        if (Cockey.has_Jockey) {
            Jockey.on(type, fn);
        } else {
            onOld(type, fn);
        }
    }

   function sendOld(type, payload, complete) {
        if (payload instanceof Function) {
            complete = payload;
            payload = null;
        }

        payload = payload || {};
        complete = complete || function() {};

        (function exec() {
            if (window.CheNiu) {
                if(!sendTypeStrategies[type]) return;
                sendTypeStrategies[type](payload, complete);
            } else {
                setTimeout(exec, 50);
            }
        })();
    }

    function onOld(type, fn) {
        fn = fn || function() {};

        (function exec() {
            if (window.CheNiu) {
                if(!onTypeStrategies[type]) return;

                if (onTypeStrategies[type].polyfill) {
                    onTypeStrategies[type].polyfill(fn);
                } else {
                    fn(onTypeStrategies[type].payload, onTypeStrategies[type].complete);
                }
            } else {
                setTimeout(exec, 50);
            }
        })();
    }

    window.Cockey = Cockey;
})();
