(function (global) {
  'use strict';

  var VERSION = '0.1.2';

  var REASON_CODES = {
    CONSOLE: 'SEC_DEVTOOLS_CONSOLE_001',
    SIZE: 'SEC_DEVTOOLS_SIZE_003',
    KEY: 'SEC_DEVTOOLS_KEY_004',
    MANUAL: 'SEC_DEVTOOLS_MANUAL',
    UNKNOWN: 'SEC_DEVTOOLS_UNKNOWN'
  };

  var DEFAULTS = {
    terminationURL: '/terminated.html',
    windowSizeCheck: true,
    blockKeyboard: true,
    blockInteractions: false,
    disableOnMobile: true,
    destructiveClear: false,
    onTermination: null
  };

  var config = null;
  var terminated = false;
  var intervals = [];

  function isMobile() {
    var ua = navigator.userAgent;
    var mobileUA = /Android|webOS|iPhone|iPod|iPad|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
    var isTouch = typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0;
    var isiPadorIOS = /Macintosh/i.test(ua) && isTouch;
    var smallScreen = screen.width < 768;
    return mobileUA || isiPadorIOS || smallScreen;
  }

  function loadConfig() {
    var userConfig = global.__DEVTOOLS_TERMINATOR_CONFIG__ || {};
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
    if (!config.destructiveClear) {
      console.warn('[DevToolsTerminator] DevTools detected. Storage was NOT cleared (destructiveClear is false).');
      return;
    }
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    try {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i];
        var eqIdx = c.indexOf('=');
        var name = eqIdx > -1 ? c.substring(0, eqIdx).trim() : c.trim();
        if (name) {
          document.cookie = name + '=;expires=' + new Date(0).toUTCString() + ';path=/';
          document.cookie = name + '=;expires=' + new Date(0).toUTCString() + ';path=/;domain=' + window.location.hostname;
          var hostParts = window.location.hostname.split('.');
          var domainParts = [];
          for (var j = hostParts.length - 1; j >= 0; j--) {
            domainParts.unshift(hostParts[j]);
            if (domainParts.length >= 2) {
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

    setTimeout(function() {
      var url = config.terminationURL;
      if (url) {
        global.location.replace(url);
      }
    }, 100);
  }

  function startDetection() {
    var obj = {};
    Object.defineProperty(obj, 'id', {
      get: function () {
        terminate(REASON_CODES.CONSOLE);
        return 'detected';
      },
      configurable: false,
      enumerable: true
    });

    var widthThreshold = 150;
    var heightThreshold = 170;
    var deltaThreshold = 100;
    var lastInnerWidth = global.innerWidth;
    var lastInnerHeight = global.innerHeight;
    var lastOuterWidth = global.outerWidth;
    var lastOuterHeight = global.outerHeight;

    var tick = function () {
      if (terminated) return;

      console.log(obj);

      if (!config.windowSizeCheck) return;

      var outerW = global.outerWidth;
      var outerH = global.outerHeight;
      var innerW = global.innerWidth;
      var innerH = global.innerHeight;

      if (outerW - innerW > widthThreshold || outerH - innerH > heightThreshold) {
        terminate(REASON_CODES.SIZE);
        return;
      }

      var deltaW = lastInnerWidth - innerW;
      var deltaH = lastInnerHeight - innerH;
      var outerDeltaW = Math.abs(outerW - lastOuterWidth);
      var outerDeltaH = Math.abs(outerH - lastOuterHeight);
      if ((deltaW > deltaThreshold || deltaH > deltaThreshold) && outerDeltaW < 20 && outerDeltaH < 20) {
        terminate(REASON_CODES.SIZE);
        return;
      }

      lastInnerWidth = innerW;
      lastInnerHeight = innerH;
      lastOuterWidth = outerW;
      lastOuterHeight = outerH;
    };

    intervals.push(setInterval(tick, 200));
  }

  function keyboardInterception() {
    if (!config.blockKeyboard) return;
    document.addEventListener('keydown', function (e) {
      var key = e.key || e.keyCode;
      var ctrl = e.ctrlKey || e.metaKey;
      var shift = e.shiftKey;
      var alt = e.altKey;

      if (key === 'F12' || key === 123) {
        e.preventDefault();
        terminate(REASON_CODES.KEY);
        return;
      }

      if (ctrl && (shift || alt)) {
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

    if (!config.blockInteractions) return;

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
    if (global.__DEVTOOLS_TERMINATOR_INITIALIZED__) return;
    global.__DEVTOOLS_TERMINATOR_INITIALIZED__ = true;

    loadConfig();

    keyboardInterception();
    startDetection();

    global.DevToolsTerminator = {
      version: VERSION,
      isTerminated: function () { return terminated; },
      terminate: function () { terminate(REASON_CODES.MANUAL); },
      config: config,
      _status: function () {
        return {
          terminated: terminated,
          windowSizeCheck: config.windowSizeCheck,
          isMobile: isMobile(),
          disableOnMobile: config.disableOnMobile,
          intervals: intervals.length,
          outerW: global.outerWidth,
          innerW: global.innerWidth,
          outerH: global.outerHeight,
          innerH: global.innerHeight,
          widthDiff: global.outerWidth - global.innerWidth,
          heightDiff: global.outerHeight - global.innerHeight
        };
      }
    };

    Object.freeze(global.DevToolsTerminator);
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
