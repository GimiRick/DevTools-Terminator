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
    var isTouch = typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0;
    var isiPadorIOS = /Macintosh/i.test(ua) && isTouch;
    var smallScreen = screen.width < 768;
    return mobileUA || isiPadorIOS || smallScreen;
  }

  function loadConfig() {
    var userConfig = global.__DEVTOOLS_TERMINATOR_CONFIG__ || global.__DEVTOLS_TERMINATOR_CONFIG__ || {};
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

  function fetchWithTimeout(url, options, timeoutMs) {
    if (typeof AbortController === 'undefined') {
      return fetch(url, options);
    }
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs || 5000);
    options.signal = controller.signal;
    return fetch(url, options).then(function (result) {
      clearTimeout(timeoutId);
      return result;
    }, function (err) {
      clearTimeout(timeoutId);
      throw err;
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
    return fetchWithTimeout(src, {}, 5000).then(function (res) {
      return res.text();
    }).then(function (text) {
      scriptContent = text;
      return text;
    }).catch(function (err) {
      console.warn('[DevToolsTerminator] Failed to fetch script content:', err ? err.message : 'unknown');
      return '';
    });
  }

  function fetchSessionId() {
    if (!config.serverEndpoint) return Promise.resolve();
    return fetchWithTimeout(config.serverEndpoint + '/session', {}, 5000).then(function (res) {
      return res.json();
    }).then(function (data) {
      if (data && data.sessionId) {
        sessionId = data.sessionId;
      }
    }).catch(function (err) {
      console.warn('[DevToolsTerminator] Failed to fetch session ID:', err ? err.message : 'unknown');
    });
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
      var opts = { method: 'POST', body: JSON.stringify(body), keepalive: true };
      if (sessionId) {
        opts.headers = { 'X-Session-ID': sessionId };
        url += '?session=' + encodeURIComponent(sessionId);
      }
      if (typeof fetch === 'function') {
        fetchWithTimeout(url, opts, 5000).catch(function (err) {
          console.warn('[DevToolsTerminator] Heartbeat failed:', err ? err.message : 'unknown');
        });
      } else if (typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(url, JSON.stringify(body));
      }
    }).catch(function (err) {
      console.warn('[DevToolsTerminator] Heartbeat preparation failed:', err ? err.message : 'unknown');
    });
  }

  function sendTerminationBeacon() {
    if (!config.serverEndpoint) return Promise.resolve();
    var timestamp = Date.now();

    return generateFingerprint().then(function (fingerprint) {
      var payload = fingerprint + '::' + timestamp;
      return hmacSha256(payload, config.sharedSecret).then(function (signature) {
        var body = JSON.stringify({
          fingerprint: fingerprint,
          timestamp: timestamp,
          signature: signature,
          reason: 'devtools_detected'
        });
        var url = config.serverEndpoint + '/terminate';
        var opts = { method: 'POST', body: body, keepalive: true };
        if (sessionId) {
          opts.headers = { 'X-Session-ID': sessionId };
          url += '?session=' + encodeURIComponent(sessionId);
        }
        if (typeof fetch === 'function') {
          fetchWithTimeout(url, opts, 5000).catch(function (err) {
            console.warn('[DevToolsTerminator] Termination beacon failed:', err ? err.message : 'unknown');
          });
        } else if (typeof navigator.sendBeacon === 'function') {
          navigator.sendBeacon(url, body);
        }
      });
    }).catch(function (err) {
      console.warn('[DevToolsTerminator] Termination beacon preparation failed:', err ? err.message : 'unknown');
    });
  }

  function clearAllStorage() {
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
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    var cb = config.onTermination;
    if (typeof cb === 'function') {
      try { cb(reasonCode || REASON_CODES.UNKNOWN); } catch (e) {}
    }

    var doNavigate = function() {
      clearAllStorage();
      setTimeout(function() {
        var url = config.terminationURL;
        if (url) {
          global.location.replace(url);
        }
      }, 100);
    };

    if (config.hybridMode && config.serverEndpoint) {
      var navDone = false;
      var triggerNav = function() {
        if (navDone) return;
        navDone = true;
        doNavigate();
      };
      sendTerminationBeacon().then(triggerNav).catch(triggerNav);
      setTimeout(triggerNav, 500);
    } else {
      doNavigate();
    }
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

  function startHeartbeat() {
    if (!config.hybridMode || !config.serverEndpoint || !config.sharedSecret) return;
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, 30000);
  }

  function init() {
    if (global.__DEVTOOLS_TERMINATOR_INITIALIZED__ || global.__DEVTOLS_TERMINATOR_INITIALIZED__) return;
    global.__DEVTOOLS_TERMINATOR_INITIALIZED__ = true;

    loadConfig();

    keyboardInterception();
    startDetection();

    if (config.hybridMode && !isSecureContext()) {
      console.error('[DevToolsTerminator] FAILED: Hybrid mode requires a secure context (HTTPS). Heartbeats and beacons will be silently rejected by the server. Switch to HTTPS or use client-only mode.');
    }

    fetchSessionId().then(function () {
      startHeartbeat();
    });

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
