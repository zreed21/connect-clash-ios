/**
 * Pairstorm — Nearby discovery bridge (Capacitor / iOS)
 *
 * Strategy (bandwidth honesty):
 *   Classic BLE cannot sustain twitch arena sync. This bridge only helps
 *   discover / exchange the existing 4-character duel code. Gameplay always
 *   stays on PeerJS WebRTC data channels (same as the itch build).
 *
 * Plugin reality (@capacitor-community/bluetooth-le@7):
 *   CENTRAL ROLE ONLY — can scan/connect; cannot advertise as a peripheral.
 *   Therefore "Host Nearby → advertise CC-XXXX" is a STUB on stock BLE-LE.
 *   Join Nearby can scan if some peripheral advertises that name/service;
 *   otherwise the joiner enters the on-screen code (WebRTC still works).
 *
 * Service UUID reserved for a future peripheral / Multipeer plugin:
 *   c0c1a501-c1a5-4000-8000-636f6e6e6563
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
  };

  function log() {
    try {
      console.log.apply(console, ['[CC-Nearby]'].concat([].slice.call(arguments)));
    } catch (e) {}
  }

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

  async function init() {
    api.isNative = detectNative();
    api.canAdvertise = false;
    var Ble = getBle();
    if (!api.isNative || !Ble) {
      api.bleAvailable = false;
      log('Web / no BLE plugin — scan/advertise disabled; WebRTC online still works.');
      return api;
    }
    try {
      await Ble.initialize({ androidNeverForLocation: true });
      api.bleAvailable = true;
      // Stock plugin has no startAdvertising — peripheral requires another plugin / native stub.
      api.canAdvertise = typeof Ble.startAdvertising === 'function';
      log('BLE central initialized; canAdvertise=', api.canAdvertise);
    } catch (e) {
      api.lastError = String(e && e.message ? e.message : e);
      api.bleAvailable = false;
      log('BLE init failed', api.lastError);
    }
    return api;
  }

  /**
   * Host advertise stub.
   * Persists the code for UI / future Multipeer native plugin
   * (see ios/App/App/CCNearbyNativeStub.md).
   */
  async function advertiseCode(code) {
    var c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (c.length !== 4) throw new Error('Need 4-char duel code');
    api.mode = 'host';
    try {
      localStorage.setItem('cc_nearby_code', c);
      localStorage.setItem('cc_nearby_role', 'host');
    } catch (e) {}

    var Ble = getBle();
    if (Ble && typeof Ble.startAdvertising === 'function') {
      await Ble.startAdvertising({ services: [SERVICE_UUID], name: PREFIX + c });
      api.lastError = null;
      log('Advertising', PREFIX + c);
      return c;
    }

    // Notify optional native stub (Multipeer / CBPeripheralManager) if registered.
    try {
      if (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.CCNearbyNative) {
        await global.Capacitor.Plugins.CCNearbyNative.advertise({ code: c, serviceUuid: SERVICE_UUID });
        api.canAdvertise = true;
        api.lastError = null;
        log('Native stub advertising', c);
        return c;
      }
    } catch (e) {
      log('Native advertise stub error', e);
    }

    api.lastError = 'advertise-unsupported';
    log('Peripheral advertise not available — show lobby code; rival types it or uses Join with code.');
    return c;
  }

  async function stopAdvertising() {
    var Ble = getBle();
    try {
      if (Ble && typeof Ble.stopAdvertising === 'function') await Ble.stopAdvertising();
    } catch (e) {
      log('stopAdvertising', e);
    }
    try {
      if (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.CCNearbyNative) {
        await global.Capacitor.Plugins.CCNearbyNative.stopAdvertise();
      }
    } catch (e) {}
  }

  /**
   * Join: scan for CC-XXXX (central role). Works when a peripheral advertises
   * that local name / service — otherwise times out and UI falls back to manual code.
   */
  async function scanForCode(timeoutMs) {
    var Ble = getBle();
    if (!Ble) throw new Error('BLE unavailable');
    api.mode = 'join';
    var found = null;
    var timeout = timeoutMs || 15000;

    await Ble.requestLEScan({
      // Empty services = broader scan; filter in JS on CC- prefix
      allowDuplicates: false,
    });

    var listener;
    try {
      listener = await Ble.addListener('onScanResult', function (result) {
        try {
          var name =
            (result && (result.localName || (result.device && result.device.name))) || '';
          var m = String(name).match(/CC-([A-Z0-9]{4})/i);
          if (m && !found) {
            found = m[1].toUpperCase();
            log('Found nearby host', found);
          }
        } catch (e) {}
      });

      var start = Date.now();
      while (!found && Date.now() - start < timeout) {
        await new Promise(function (r) {
          setTimeout(r, 250);
        });
      }
    } finally {
      try {
        await Ble.stopLEScan();
      } catch (e) {}
      try {
        if (listener && listener.remove) await listener.remove();
      } catch (e) {}
    }

    if (!found) throw new Error('No nearby host found (BLE central scan). Enter the code instead.');
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
    log('Launch', url);
    global.location.href = url;
  }

  api.init = init;
  api.advertiseCode = advertiseCode;
  api.stopAdvertising = stopAdvertising;
  api.scanForCode = scanForCode;
  api.launchGame = launchGame;
  api.SERVICE_UUID = SERVICE_UUID;
  api.CODE_CHAR_UUID = CODE_CHAR_UUID;

  global.CCNearby = api;
})(typeof window !== 'undefined' ? window : globalThis);
