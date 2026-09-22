# CCNearbyNative — design stub

```swift
//
// CCNearbyNativeStub.swift
// -----------------------
// Reference stub for a future Capacitor plugin that can ADVERTISE a duel code
// on iOS (MultipeerConnectivity or CoreBluetooth peripheral role).
//
// @capacitor-community/bluetooth-le is CENTRAL-ONLY and cannot advertise.
// Until a real plugin is added, Nearby Host falls back to the on-screen
// 4-character PeerJS code; Join can still type the code; WebRTC gameplay
// is unchanged.
//
// Suggested Capacitor plugin API (JS → native):
//   CCNearbyNative.advertise({ code: "AB12", serviceUuid: "..." })
//   CCNearbyNative.stopAdvertise()
//   CCNearbyNative.startBrowse() -> emits "code" events
//
// MultipeerConnectivity is often a better "Nearby" fit on iOS than BLE for
// exchanging a few bytes (peer ID / duel code), then hand off to WebRTC.
//
// This file is intentionally NOT registered as a Capacitor plugin yet so
// Codemagic builds succeed without extra pod wiring. Keep it as design docs
// in-tree; wire up when implementing the native Nearby advertiser.

#if false  // enable when turning this into a real plugin target
import MultipeerConnectivity
import Capacitor

@objc(CCNearbyNative)
public class CCNearbyNative: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CCNearbyNative"
    public let jsName = "CCNearbyNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "advertise", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAdvertise", returnType: CAPPluginReturnPromise),
    ]

    private let serviceType = "cc-duel" // max 15 chars for Bonjour service type

    @objc func advertise(_ call: CAPPluginCall) {
        let code = call.getString("code") ?? ""
        // TODO: MCNearbyServiceAdvertiser with discoveryInfo ["code": code]
        call.resolve(["ok": true, "code": code, "stub": true])
    }

    @objc func stopAdvertise(_ call: CAPPluginCall) {
        call.resolve()
    }
}
#endif

```
