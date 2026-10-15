# Belma — iPhone hukuk asistanı

Standalone Expo SDK 57 app for the existing Belma assistant. The iOS application name is **Belma**; it has its own EAS project and bundle identifier and does not change the Şahika application.

| Setting | Value |
| --- | --- |
| Expo owner/project | `kemalsutcus-team/belma-hukuk` |
| EAS project ID | `976cd0de-2e47-4383-97c4-8a3a9b5e8bff` |
| iOS bundle identifier | `com.yapaymevzular.belma` |
| Assistant | `agent_3901m4m3a562fat953akjhk0b9d4` |
| HTTPS assistant page | `https://www.yapaymevzular.com/belmabelge` |

The WebView uses the live, verified HTTPS assistant page so iOS microphone capture has a secure origin. An injected adaptation isolates the existing `virtari-belma-belge` element and its ancestor chain without moving or remounting it. Website desktop/mobile headers, navigation, language selection, footers, and floating siblings are hidden. Belma's own header, chat, attachment controls and document workspace remain. A native loading cover is removed only after configuration, controls, page isolation and shadow styles are ready. The native navigation header is disabled.

The supplied JavaScript files are retained unchanged in `vendor/` with SHA-256 provenance for reviewing source contracts. They are **not** injected into the live page or registered a second time. The live page remains the source of the assistant's interface, agent connection and PDF/OCR/document libraries. Therefore, website changes can affect the app; if its required controls cease to exist, the loading cover fails closed and offers retry.

The supplied Belma portrait, turquoise call button and both Yapay Mevzular logo variants are bundled locally. Original images are kept byte-for-byte with SHA-256 provenance in `assets/source-manifest.json`. Resized derivatives are embedded as data images for the assistant's existing header, empty state, voice button and compact options-menu credit. This avoids extra image requests and leaves the live HTTPS origin and existing event handlers intact. No second native header is added. The existing verified app icon and native splash already depict the same portrait and remain unchanged. The supplied portrait now appears in the native loading cover; the light-background logo appears at the bottom of the loading cover. A shadow-root observer restores the branding after later conversation rendering without duplicating images.

The app starts in light appearance and uses native safe areas. Belma's message composer and document input font sizes are kept at 16 px to avoid iPhone focus zoom. The web export intentionally shows an iPhone instruction page: a cross-origin iframe cannot apply the iOS page adaptation and would show the website header.

## Document sharing and microphone lifecycle

TXT, JSON, PDF, DOCX and unsigned UDF downloads use the native iOS share sheet. The bridge captures local Blob references before URL revocation, including detached anchors and programmatic clicks after asynchronous document generation. It transfers binary bytes using base64, validates page origin, message shape, filename, MIME and exact byte count, and limits each export to 20 MiB. Names are normalized to safe filenames without altering document contents. Temporary files are removed after the share sheet is dismissed. No API key or conversation/document content is stored in native logs or embedded configuration.

When the app backgrounds or unmounts, `endSession(false)` ends the existing session while preserving on-page conversation and document data. Captured microphone tracks stop and AudioContexts suspend. Epoch checks close capture requests which resolve after backgrounding, even if the app has returned to foreground. Returning to the app never reopens the microphone automatically. The initial microphone permission dialog's temporary `inactive` state is treated separately; actual backgrounding always cancels capture.

## Development and builds

Run commands from `apps/belma`:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run export:ios
npx --yes eas-cli@24.9.0 build --platform ios --profile belma-simulator
npx --yes eas-cli@24.9.0 build --platform ios --profile belma-preview
```

The development dependency directory can be shared locally with the sibling SDK 57 app for verification; the symlink is ignored by Git. EAS runs a clean install from this app's own lockfile. `belma-preview` is an internal-distribution build requiring a provisioning profile for the new Belma bundle identifier and registered iPhones. Şahika's profile cannot sign Belma. `production` is the App Store/TestFlight build profile; an App Store Connect app must be configured before submission. No Apple legal agreement is accepted by these scripts.

## Validation and remaining device checks

Automated tests exercise exact-origin navigation, binary/UTF-8 export integrity, malformed message rejection, detached/revoked Blob download paths, large conversion chunks, legal-title filenames, late Wix hydration, website chrome isolation, permission prompt handling and background capture races. Lint and TypeScript validation are required along with an iOS Metro export.

Physical iPhone verification remains necessary for the microphone permission prompt and live voice session, camera/photo/document picker, PDF/DOCX/UDF file sharing and preview, keyboard visibility with small iPhone screens, and actual app switching. Simulators and JavaScript tests cannot establish those hardware/platform behaviors. Voice, OCR and generated documents also require the live site and third-party services to be available; the application is not offline-capable. Chat/document state follows the supplied web component and can be lost if iOS terminates the WebView process.
