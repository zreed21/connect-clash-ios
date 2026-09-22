# Connect Clash — iOS (Capacitor + TestFlight)

Native iOS shell around the **itch.io standalone HTML** build (`www/game.html`).  
**Does not** wrap the Next.js / Postgres server under `html-game/src/`.

| | |
|---|---|
| **App name** | Connect Clash |
| **Bundle ID** | `com.connectclash.app` |
| **Capacitor** | 7.x |
| **Web assets** | `www/` (shell + itch game + Nearby bridge) |
| **Cloud build** | Codemagic (`codemagic.yaml`) → TestFlight |

## What’s in the box

```
connect-clash-ios/
├── www/
│   ├── index.html          # Launcher: Play + Nearby Duel overlay
│   ├── game.html           # Unpacked itch build (+ tiny auto-join boot)
│   └── nearby-bridge.js    # Capacitor BLE discovery adapter
├── ios/                    # Xcode / Capacitor iOS platform
├── capacitor.config.json
├── codemagic.yaml
├── package.json
└── README-IOS.md
```

## Multiplayer: Web vs Nearby

### Web (default) — PeerJS WebRTC
- Same as itch: host gets a **4-character duel code**; Peer ID is `connectclash-{CODE}`.
- Signalling via public PeerJS broker **`0.peerjs.com:443`** (WSS / HTTPS-safe).
- Gameplay = WebRTC **data channels** (not video). Arena sync stays on this path.
- iOS WKWebView: Info.plist includes **camera + microphone** usage strings (commonly required for WebRTC APIs even when unused), plus **local network** for ICE.

### Nearby / Bluetooth — discovery only (honest design)
Full real-time arena sync over classic BLE is **too slow** for this game.  
Nearby mode therefore:

1. Keeps **PeerJS WebRTC** for all gameplay (data channels).
2. Uses **`@capacitor-community/bluetooth-le`** (Capacitor 7) as a **central-role** scanner to look for a `CC-XXXX` advertiser.
3. **Important:** that plugin **cannot advertise** (no peripheral role). Host “advertise” is a **stub** — see `www/nearby-bridge.js` + `ios/App/App/CCNearbyNativeStub.md` (MultipeerConnectivity sketch, `#if false`).
4. Practical UX today: Host Nearby still starts a normal online host lobby; share the **on-screen 4-char code**. Join Nearby tries BLE scan, then falls back to typing the code → `netJoin`.

**Host Nearby:** `game.html?cc_host=1&cc_advertise=1` → `netHost()` → optional advertise stub.  
**Join Nearby:** scan → `game.html?cc_join=CODE` → auto `netJoin`.  

UI entry: open the app → **Nearby Duel (Bluetooth)** on `www/index.html`.

To finish true zero-type Nearby later: implement the Multipeer (or BLE peripheral) Capacitor plugin sketched in `CCNearbyNativeStub.md`, then `CCNearby.advertiseCode` will call `Capacitor.Plugins.CCNearbyNative`.

## First-time: App Store Connect

1. Create an app with bundle ID **`com.connectclash.app`**.
2. Create an **App Store Connect API key** (.p8) with App Manager access. Note **Issuer ID** + **Key ID**.
3. Enroll the Apple Developer team; note **Team ID**.

## Codemagic setup (Windows OK — builds in the cloud)

1. Push this folder to a Git repo (or upload the zip and connect the repo).
2. In [Codemagic](https://codemagic.io): add the repo → detect `codemagic.yaml`.
3. Create environment group **`appstore_credentials`** with:

| Secret / variable | Purpose |
|---|---|
| `APP_STORE_CONNECT_ISSUER_ID` | ASC API Issuer ID |
| `APP_STORE_CONNECT_KEY_IDENTIFIER` | ASC API Key ID |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Full `.p8` PEM contents |
| `CERTIFICATE_PRIVATE_KEY` | RSA key for Codemagic-managed distribution cert (`openssl genrsa 2048`) |
| `APPLE_TEAM_ID` | Your 10-character Team ID (optional if integration supplies it) |

4. In Codemagic → Integrations, add **App Store Connect** and name it **`ConnectClash`** (matches `codemagic.yaml`), **or** switch publishing to explicit API key fields in the yaml.
5. Replace placeholders in `codemagic.yaml`:
   - `APP_STORE_APPLE_ID` — numeric ASC app id after the app exists  
   - `APPLE_TEAM_ID`  
   - email recipient under `publishing.email`
6. Run workflow **Connect Clash iOS → TestFlight**.
7. On first success, install via TestFlight; accept Camera / Mic / Bluetooth / Local Network prompts when dueling.

### Workflow summary
`npm install` → `npx cap sync ios` → `pod install` → fetch signing files → `xcode-project build-ipa` → publish TestFlight.

There is also **`ios-unsigned-check`** (simulator build, no signing) for a cheaper compile smoke test.

## Local Mac notes (optional)

You don’t need a Mac for Codemagic. If you later have one:

```bash
npm install
npx cap sync ios
cd ios/App && pod install
npx cap open ios
```

## Privacy strings (Info.plist)

Already set for:

- `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` (WebRTC)
- `NSLocalNetworkUsageDescription` + `NSBonjourServices`
- `NSBluetoothAlwaysUsageDescription` / `NSBluetoothPeripheralUsageDescription`
- `NSAppTransportSecurity` with `NSAllowsLocalNetworking` (no arbitrary cleartext)
- Background modes: `bluetooth-central`, `bluetooth-peripheral`

## Known limits / blockers

- **No Mac / no CocoaPods / no xcodebuild on the scaffold machine** — `ios/` is generated; pods resolve on Codemagic.
- **BLE peripheral advertising** depends on plugin + iOS support; discovery may require the joiner to type the code if advertise fails — WebRTC duel still works.
- **PeerJS public broker** is a free shared service; for production scale, consider a self-hosted PeerServer (HTTPS) later — not required for TestFlight.
- Do **not** point this app at the Next.js API; online play is peer-to-peer via PeerJS.

## Updating the game HTML

Replace `www/game.html` with a newer itch export, then re-append the small Nearby boot block (see end of `game.html`: `cc_host` / `cc_join` / `cc_advertise`) or re-run your inject step, then:

```bash
npx cap sync ios
```
