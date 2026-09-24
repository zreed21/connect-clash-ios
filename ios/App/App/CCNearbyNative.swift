import Foundation
import Capacitor
import MultipeerConnectivity

@objc(CCNearbyNative)
public class CCNearbyNative: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CCNearbyNative"
    public let jsName = "CCNearbyNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "advertise", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAdvertise", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "browse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopBrowse", returnType: CAPPluginReturnPromise)
    ]

    private let serviceType = "cc-duel"
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?
    private var peerID: MCPeerID?
    private var foundCodes: [String: String] = [:] // peerName -> code
    private var browseCall: CAPPluginCall?
    private var advertiseCall: CAPPluginCall?

    @objc func advertise(_ call: CAPPluginCall) {
        let code = (call.getString("code") ?? "").uppercased()
        guard code.count == 4 else {
            call.reject("Need 4-char code")
            return
        }

        stopAdvertiseInternal()

        let displayName = UIDevice.current.name + "-" + code
        let safeName = String(displayName.prefix(20))
        peerID = MCPeerID(displayName: safeName)

        let discoveryInfo = ["code": code]

        advertiser = MCNearbyServiceAdvertiser(peer: peerID!, discoveryInfo: discoveryInfo, serviceType: serviceType)
        advertiser?.delegate = self
        advertiser?.startAdvertisingPeer()

        call.resolve(["code": code, "advertising": true])
    }

    @objc func stopAdvertise(_ call: CAPPluginCall) {
        stopAdvertiseInternal()
        call.resolve()
    }

    private func stopAdvertiseInternal() {
        advertiser?.stopAdvertisingPeer()
        advertiser?.delegate = nil
        advertiser = nil
    }

    @objc func browse(_ call: CAPPluginCall) {
        stopBrowseInternal()
        foundCodes.removeAll()

        let displayName = UIDevice.current.name + "-browser"
        let safeName = String(displayName.prefix(20))
        peerID = MCPeerID(displayName: safeName)

        browser = MCNearbyServiceBrowser(peer: peerID!, serviceType: serviceType)
        browser?.delegate = self
        browser?.startBrowsingForPeers()

        browseCall = call

        // Keep call alive for up to 20 seconds, but we'll resolve when we find one
        // If nothing found, timeout will reject
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
            guard let self = self, let bCall = self.browseCall, !bCall.isReleased else { return }
            if self.foundCodes.isEmpty {
                self.stopBrowseInternal()
                bCall.reject("No nearby duels found")
            }
        }
    }

    @objc func stopBrowse(_ call: CAPPluginCall) {
        stopBrowseInternal()
        call.resolve()
    }

    private func stopBrowseInternal() {
        browser?.stopBrowsingForPeers()
        browser?.delegate = nil
        browser = nil
        if let bCall = browseCall, !bCall.isReleased {
            // Don't reject if already resolved
        }
        browseCall = nil
    }
}

extension CCNearbyNative: MCNearbyServiceAdvertiserDelegate {
    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        // For code exchange only, we don't need session - just accept to make browsing feel responsive, but not required
        invitationHandler(false, nil)
    }

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {
        print("[CCNearbyNative] Advertise failed: \(error.localizedDescription)")
    }
}

extension CCNearbyNative: MCNearbyServiceBrowserDelegate {
    public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        guard let code = info?["code"]?.uppercased(), code.count == 4 else { return }
        foundCodes[peerID.displayName] = code

        // Resolve immediately on first found code for strict Bluetooth UX
        if let bCall = browseCall, !bCall.isReleased {
            bCall.resolve(["code": code, "peer": peerID.displayName])
            browseCall = nil
            stopBrowseInternal()
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        foundCodes.removeValue(forKey: peerID.displayName)
    }

    public func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
        print("[CCNearbyNative] Browse failed: \(error.localizedDescription)")
        if let bCall = browseCall, !bCall.isReleased {
            bCall.reject("Browse failed: \(error.localizedDescription)")
            browseCall = nil
        }
    }
}
