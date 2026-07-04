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
    blockInteractions: true,
    disableOnMobile: true,
    onTermination: null,
    hybridMode: true,
    serverEndpoint: '',
    sharedSecret: ''
  };

  var config = null;
  var terminated = false;
  var intervals = [];
  var heartbeatInterval = null;
  var scriptContent = null;
  var sessionId = null;

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

  function arrayBufferToHex(buf) {
    var bytes = new Uint8Array(buf);
    var hex = [];
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i].toString(16);
      if (b.length === 1) b = '0' + b;
      hex.push(b);
    }
    return hex.join('');
  }

  function isSecureContext() {
    return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
  }

  function sha256(str) {
    if (!isSecureContext()) return Promise.resolve('');
    var encoder = new TextEncoder();
    var data = encoder.encode(str);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return arrayBufferToHex(buf);
    });
  }

  function hmacSha256(message, secret) {
    if (!isSecureContext()) return Promise.resolve('');
    var encoder = new TextEncoder();
    var keyData = encoder.encode(secret);
    var msgData = encoder.encode(message);
    return crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: { name: 'SHA-256' } },
      false, ['sign']
    ).then(function (key) {
      return crypto.subtle.sign('HMAC', key, msgData);
    }).then(function (sig) {
      return arrayBufferToHex(sig);
    });
  }

  function generateFingerprint() {
    var ua = navigator.userAgent;
    var sw = screen.width;
    var sh = screen.height;
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    var raw = ua + '|' + sw + 'x' + sh + '|' + tz;
    return sha256(raw);
  }

  function getScriptContent() {
    if (scriptContent) return Promise.resolve(scriptContent);
    var scripts = document.querySelectorAll('script[data-devtools-terminator]');
    if (scripts.length === 0) {
      scripts = document.querySelectorAll('script[src*="devtools-terminator"]');
    }
    if (scripts.length === 0) {
      return Promise.resolve('');
    }
    var src = scripts[0].src;
    if (!src) {
      scriptContent = scripts[0].textContent || '';
      return Promise.resolve(scriptContent);
    }
    return fetch(src).then(function (res) {
      return res.text();
    }).then(function (text) {
      scriptContent = text;
      return text;
    }).catch(function () {
      return '';
    });
  }

  function fetchSessionId() {
    if (!config.serverEndpoint) return;
    fetch(config.serverEndpoint + '/session').then(function (res) {
      return res.json();
    }).then(function (data) {
      if (data && data.sessionId) {
        sessionId = data.sessionId;
      }
    }).catch(function () {});
  }

  function sendHeartbeat() {
    if (terminated) return;
    if (!config.serverEndpoint) return;

    var timestamp = Date.now();

    Promise.all([
      generateFingerprint(),
      getScriptContent().then(function (content) { return sha256(content || ''); })
    ]).then(function (results) {
      var fingerprint = results[0];
      var scriptHash = results[1];
      var payload = fingerprint + ':' + scriptHash + ':' + timestamp;

      return hmacSha256(payload, config.sharedSecret).then(function (signature) {
        return {
          fingerprint: fingerprint,
          scriptHash: scriptHash,
          timestamp: timestamp,
          signature: signature
        };
      });
    }).then(function (body) {
      var url = config.serverEndpoint + '/heartbeat';
      if (sessionId) url += '?session=' + encodeURIComponent(sessionId);
      if (typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(url, JSON.stringify(body));
      }
    }).catch(function () {});
  }

  function sendTerminationBeacon() {
    if (!config.serverEndpoint) return;
    var timestamp = Date.now();

    generateFingerprint().then(function (fingerprint) {
      var payload = fingerprint + '::' + timestamp;
      return hmacSha256(payload, config.sharedSecret).then(function (signature) {
        var body = JSON.stringify({
          fingerprint: fingerprint,
          timestamp: timestamp,
          signature: signature,
          reason: 'devtools_detected'
        });
        var url = config.serverEndpoint + '/terminate';
        if (sessionId) url += '?session=' + encodeURIComponent(sessionId);
        if (typeof navigator.sendBeacon === 'function') {
          navigator.sendBeacon(url, body);
        }
      });
    }).catch(function () {});
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
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    var cb = config.onTermination;
    if (typeof cb === 'function') {
      try { cb(reasonCode || REASON_CODES.UNKNOWN); } catch (e) {}
    }

    if (config.hybridMode && config.serverEndpoint) {
      sendTerminationBeacon();
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

  function startHeartbeat() {
    if (!config.hybridMode || !config.serverEndpoint || !config.sharedSecret) return;
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, 30000);
  }

  function init() {
    if (global.__DEVTOLS_TERMINATOR_INITIALIZED__) return;
    global.__DEVTOLS_TERMINATOR_INITIALIZED__ = true;

    loadConfig();

    keyboardInterception();
    consoleDetection();
    viewportDetection();
    debuggerDetection();
    fetchSessionId();
    startHeartbeat();

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
