/**
 * Pairstorm — Nearby discovery bridge (Capacitor / iOS)
 * Production - MultipeerConnectivity strict Bluetooth + BLE fallback
 */
(function (global) {
  'use strict';

  var SERVICE_UUID = 'c0c1a501-c1a5-4000-8000-636f6e6e6563';
  var CODE_CHAR_UUID = 'c0c1a502-c1a5-4000-8000-636f6e6e6563';
  var PREFIX = 'CC-';

  var api = {
    isNative: false,
    bleAvailable: false,
    canAdvertise: false,
    mode: null,
    lastError: null,
    _Ble: null,
    _Native: null
  };

  function detectNative() {
    try {
      return !!(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform());
    } catch (e) {
      return false;
    }
  }

  function getBle() {
    if (api._Ble) return api._Ble;
    try {
      if (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.BluetoothLe) {
        api._Ble = global.Capacitor.Plugins.BluetoothLe;
        return api._Ble;
      }
    } catch (e) {}
    return null;
  }

  function getNative() {
    if (api._Native) return api._Native;
    try {
      if (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.CCNearbyNative) {
        api._Native = global.Capacitor.Plugins.CCNearbyNative;
        return api._Native;
      }
    } catch (e) {}
    return null;
  }

  async function init() {
    api.isNative = detectNative();
    api.canAdvertise = false;
    var Ble = getBle();
    var Native = getNative();

    if (Native) {
      api.bleAvailable = true;
      api.canAdvertise = true;
      return api;
    }

    if (!api.isNative || !Ble) {
      api.bleAvailable = false;
      return api;
    }
    try {
      await Ble.initialize({ androidNeverForLocation: true });
      api.bleAvailable = true;
      api.canAdvertise = typeof Ble.startAdvertising === 'function';
    } catch (e) {
      api.lastError = String(e && e.message ? e.message : e);
      api.bleAvailable = false;
    }
    return api;
  }

  async function advertiseCode(code) {
    var c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (c.length !== 4) throw new Error('Need 4-char duel code');
    api.mode = 'host';
    try {
      localStorage.setItem('cc_nearby_code', c);
      localStorage.setItem('cc_nearby_role', 'host');
    } catch (e) {}

    // Strict Bluetooth: Try Multipeer native first
    var Native = getNative();
    if (Native) {
      try {
        await Native.advertise({ code: c });
        api.canAdvertise = true;
        api.lastError = null;
        return c;
      } catch (e) {}
    }

    var Ble = getBle();
    if (Ble && typeof Ble.startAdvertising === 'function') {
      try {
        await Ble.startAdvertising({ services: [SERVICE_UUID], name: PREFIX + c });
        api.lastError = null;
        return c;
      } catch (e) {}
    }

    // Even if advertise unsupported, return code - host will still work via online
    api.lastError = 'advertise-unsupported';
    return c;
  }

  async function stopAdvertising() {
    var Ble = getBle();
    try {
      if (Ble && typeof Ble.stopAdvertising === 'function') await Ble.stopAdvertising();
    } catch (e) {}
    var Native = getNative();
    try {
      if (Native) await Native.stopAdvertise();
    } catch (e) {}
  }

  async function browseForCode(timeoutMs) {
    // Strict Bluetooth browse via Multipeer
    var Native = getNative();
    if (Native && Native.browse) {
      api.mode = 'join';
      try {
        var res = await Native.browse();
        var code = res && res.code ? String(res.code).toUpperCase() : null;
        if (code && code.length === 4) {
          try {
            localStorage.setItem('cc_nearby_code', code);
            localStorage.setItem('cc_nearby_role', 'join');
          } catch (e) {}
          return code;
        }
      } catch (e) {
        throw new Error(e.message || 'No nearby duels found');
      }
    }
    // Fallback to BLE scan if native not available
    return await scanForCode(timeoutMs);
  }

  async function stopBrowse() {
    var Native = getNative();
    try {
      if (Native && Native.stopBrowse) await Native.stopBrowse();
    } catch (e) {}
    var Ble = getBle();
    try {
      if (Ble) await Ble.stopLEScan();
    } catch (e) {}
  }

  async function scanForCode(timeoutMs) {
    // Try native browse first
    var Native = getNative();
    if (Native && Native.browse) {
      try {
        return await browseForCode(timeoutMs);
      } catch (e) {
        // fall through to BLE
      }
    }

    var Ble = getBle();
    if (!Ble) throw new Error('Nearby unavailable');
    api.mode = 'join';
    var found = null;
    var timeout = timeoutMs || 15000;

    try {
      await Ble.requestLEScan({ allowDuplicates: false });
    } catch (e) {
      throw new Error('Nearby unavailable');
    }

    var listener;
    try {
      listener = await Ble.addListener('onScanResult', function (result) {
        try {
          var name = (result && (result.localName || (result.device && result.device.name))) || '';
          var m = String(name).match(/CC-([A-Z0-9]{4})/i);
          if (m && !found) found = m[1].toUpperCase();
        } catch (e) {}
      });

      var start = Date.now();
      while (!found && Date.now() - start < timeout) {
        await new Promise(function (r) { setTimeout(r, 250); });
      }
    } finally {
      try { await Ble.stopLEScan(); } catch (e) {}
      try { if (listener && listener.remove) await listener.remove(); } catch (e) {}
    }

    if (!found) throw new Error('No nearby duel found');
    try {
      localStorage.setItem('cc_nearby_code', found);
      localStorage.setItem('cc_nearby_role', 'join');
    } catch (e) {}
    return found;
  }

  function launchGame(opts) {
    opts = opts || {};
    var q = [];
    if (opts.host) {
      q.push('cc_host=1');
      if (opts.advertise !== false) q.push('cc_advertise=1');
    }
    if (opts.join) q.push('cc_join=' + encodeURIComponent(String(opts.join).toUpperCase()));
    var url = 'game.html' + (q.length ? '?' + q.join('&') : '');
    global.location.href = url;
  }

  api.init = init;
  api.advertiseCode = advertiseCode;
  api.stopAdvertising = stopAdvertising;
  api.scanForCode = scanForCode;
  api.browseForCode = browseForCode;
  api.stopBrowse = stopBrowse;
  api.launchGame = launchGame;
  api.SERVICE_UUID = SERVICE_UUID;

  global.CCNearby = api;
})(typeof window !== 'undefined' ? window : globalThis);
