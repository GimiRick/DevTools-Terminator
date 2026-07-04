(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  var REASON_CODES = {
    CONSOLE: 'SEC_DEVTOOLS_CONSOLE_001',
    DEBUGGER: 'SEC_DEVTOOLS_DEBUGGER_002',
    SIZE: 'SEC_DEVTOOLS_SIZE_003',
    KEY: 'SEC_DEVTOOLS_KEY_004',
    MANUAL: 'SEC_DEVTOOLS_MANUAL',
    UNKNOWN: 'SEC_DEVTOOLS_UNKNOWN'
  };

  var DEFAULTS = {
    terminationURL: '/terminated.html',
    checkInterval: 1000,
    windowSizeCheck: true,
    blockKeyboard: true,
    disableOnMobile: true,
    onTermination: null
  };

  var config = null;
  var terminated = false;
  var intervals = [];

  function isMobile() {
    var ua = navigator.userAgent;
    var mobileUA = /Android|webOS|iPhone|iPod|iPad|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    var isTouch = 'ontouchstart' in global;
    var isiPadorIOS = /Macintosh/i.test(ua) && isTouch;
    var smallScreen = screen.width < 768;
    return mobileUA || isiPadorIOS || smallScreen;
  }

  function loadConfig() {
    var userConfig = global.__DEVTOLS_TERMINATOR_CONFIG__ || {};
    if (config !== null) return config;
    config = {};
    for (var key in DEFAULTS) {
      if (DEFAULTS.hasOwnProperty(key)) {
        config[key] = userConfig.hasOwnProperty(key) ? userConfig[key] : DEFAULTS[key];
      }
    }
    if (typeof config.onTermination !== 'function') {
      config.onTermination = null;
    }
    if (config.disableOnMobile && isMobile()) {
      config.windowSizeCheck = false;
    }
    Object.freeze(config);
    return config;
  }

  function clearAllStorage() {
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    try {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i];
        var eqIdx = c.indexOf('=');
        var name = eqIdx > -1 ? c.substr(0, eqIdx).trim() : c.trim();
        if (name) {
          document.cookie = name + '=;expires=' + new Date(0).toUTCString() + ';path=/';
          document.cookie = name + '=;expires=' + new Date(0).toUTCString() + ';path=/;domain=' + document.domain;
          var hostParts = document.domain.split('.');
          if (hostParts.length > 2) {
            var domainParts = [hostParts[hostParts.length - 1]];
            for (var j = hostParts.length - 2; j >= 1; j--) {
              domainParts.unshift(hostParts[j]);
              document.cookie = name + '=;expires=' + new Date(0).toUTCString() + ';path=/;domain=.' + domainParts.join('.');
            }
          }
        }
      }
    } catch (e) {}
    try {
      if ('indexedDB' in global) {
        var req = indexedDB.databases();
        if (req && req.then) {
          req.then(function (dbs) {
            for (var i = 0; i < dbs.length; i++) {
              if (dbs[i].name) indexedDB.deleteDatabase(dbs[i].name);
            }
          }).catch(function () {});
        }
      }
    } catch (e) {}
    try {
      if ('caches' in global) {
        caches.keys().then(function (keys) {
          for (var i = 0; i < keys.length; i++) caches.delete(keys[i]);
        }).catch(function () {});
      }
    } catch (e) {}
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          for (var i = 0; i < regs.length; i++) regs[i].unregister();
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function terminate(reasonCode) {
    if (terminated) return;
    terminated = true;

    for (var i = 0; i < intervals.length; i++) {
      clearInterval(intervals[i]);
    }
    intervals = [];

    var cb = config.onTermination;
    if (typeof cb === 'function') {
      try { cb(reasonCode || REASON_CODES.UNKNOWN); } catch (e) {}
    }

    clearAllStorage();

    var url = config.terminationURL;
    if (url) {
      global.location.replace(url);
    }
  }

  function consoleDetection() {
    var obj = {};
    var fired = false;
    Object.defineProperty(obj, 'check', {
      get: function () {
        fired = true;
        return 'detected';
      },
      configurable: false,
      enumerable: false
    });
    console.log(obj);
    var check = function () {
      if (fired) {
        terminate(REASON_CODES.CONSOLE);
      }
    };
    intervals.push(setInterval(check, 100));
  }

  function viewportDetection() {
    if (!config.windowSizeCheck) return;
    var threshold = 200;
    var check = function () {
      if (terminated) return;
      var widthDiff = global.outerWidth - global.innerWidth;
      var heightDiff = global.outerHeight - global.innerHeight;
      if (widthDiff > threshold || heightDiff > threshold) {
        terminate(REASON_CODES.SIZE);
      }
    };
    intervals.push(setInterval(check, config.checkInterval));
  }

  function debuggerDetection() {
    var check = function () {
      if (terminated) return;
      var start = performance.now();
      debugger;
      var elapsed = performance.now() - start;
      if (elapsed > 100) {
        terminate(REASON_CODES.DEBUGGER);
      }
    };
    intervals.push(setInterval(check, config.checkInterval * 5));
  }

  function keyboardInterception() {
    if (!config.blockKeyboard) return;
    document.addEventListener('keydown', function (e) {
      var key = e.key || e.keyCode;
      var ctrl = e.ctrlKey || e.metaKey;
      var shift = e.shiftKey;

      if (key === 'F12' || key === 112) {
        e.preventDefault();
        terminate(REASON_CODES.KEY);
        return;
      }

      if (ctrl && shift) {
        var k = typeof key === 'string' ? key.toUpperCase() : '';
        if (k === 'I' || k === 'J' || k === 'C' || key === 73 || key === 74 || key === 67) {
          e.preventDefault();
          terminate(REASON_CODES.KEY);
          return;
        }
      }

      if (ctrl && (key === 'u' || key === 'U' || key === 85)) {
        e.preventDefault();
        terminate(REASON_CODES.KEY);
        return;
      }
    });

    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    document.addEventListener('dragstart', function (e) {
      var tag = e.target ? e.target.tagName : '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
      }
    });

    document.addEventListener('selectstart', function (e) {
      var tag = e.target ? e.target.tagName : '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.target.isContentEditable) {
        e.preventDefault();
      }
    });
  }

  function init() {
    if (global.__DEVTOLS_TERMINATOR_INITIALIZED__) return;
    global.__DEVTOLS_TERMINATOR_INITIALIZED__ = true;

    loadConfig();

    keyboardInterception();
    consoleDetection();
    viewportDetection();
    debuggerDetection();

    global.DevToolsTerminator = {
      version: VERSION,
      isTerminated: function () { return terminated; },
      terminate: function () { terminate(REASON_CODES.MANUAL); },
      config: config
    };

    Object.freeze(global.DevToolsTerminator);
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
