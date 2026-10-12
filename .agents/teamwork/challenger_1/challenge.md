# Adversarial Challenge Report: Dependency Security & Metro Asset Integrity

## Challenge Summary

**Overall risk assessment**: CRITICAL

While `image-size@2.0.4` successfully patches the infinite loop DoS vulnerabilities (`GHSA-5p2g-fcmc-qvqq` and `GHSA-w3rx-r6r6-pgpr`), upgrading from `1.x` to `2.x` introduces a **fatal runtime breaking change in Metro bundler's asset transformation pipeline**.

Metro (`metro/src/Assets.js` and `metro-transform-worker/src/utils/assetTransformer.js`) passes asset file paths as string arguments to `image-size`. In `image-size@2.x`, string file paths are no longer supported by `imageSize()`, causing an unhandled `TypeError` whenever any image asset is bundled or imported by React Native.

**Verdict**: **`REQUEST_CHANGES`**

---

## Challenges

### [CRITICAL] Challenge 1: Metro Asset Transformation Failure Due to `image-size@2.x` API Incompatibility

- **Assumption challenged**: The worker assumed that because `Assets.getAssetSize('png', fs.readFileSync('assets/images/icon.png'), 'icon.png')` passes, `image-size@2.0.4` maintains full runtime compatibility with Metro bundler and Expo SDK 54.
- **Attack scenario**: During real bundling (via `metro-transform-worker/src/utils/assetTransformer.js`), Metro invokes `Assets.getAssetData(...)`. In `metro/src/Assets.js` (lines 170-173):
  ```javascript
  const isImageInput = assetInfo.files[0].includes(".zip/")
    ? _fs.default.readFileSync(assetInfo.files[0])
    : assetInfo.files[0];
  const dimensions = isImage ? (0, _imageSize.default)(isImageInput) : null;
  ```
  Unless the asset is inside a zip file, `isImageInput` is a filesystem path `string`.
  In `image-size@1.x`, `imageSize(stringPath)` synchronously read the file header.
  In `image-size@2.x`, `imageSize` requires a `Buffer` or `Uint8Array`. Passing a string causes `TextDecoder.decode` inside `bmp.validate` to crash:
  ```text
  TypeError: The "list" argument must be an instance of SharedArrayBuffer, ArrayBuffer or ArrayBufferView.
      at toUTF8String (node_modules/image-size/dist/cjs/types/utils.js:7:72)
      at Object.validate (node_modules/image-size/dist/cjs/types/bmp.js:6:51)
      at detector (node_modules/image-size/dist/cjs/detector.js:24:26)
      at imageSize (node_modules/image-size/dist/cjs/lookup.js:11:42)
      at Object.getAssetData (node_modules/metro/src/Assets.js:173:55)
      at async Object.transform (node_modules/metro-transform-worker/src/utils/assetTransformer.js:25:16)
  ```
- **Blast radius**: Complete bundling failure for any React Native screen or component that renders local images (`<Image source={require('./assets/...')} />`) or builds production bundles with Metro.
- **Mitigation**:
  Apply a postinstall patch via `scripts/patch-modules.js` (or `patch-package`):
  1. Patch `node_modules/image-size/dist/cjs/lookup.js` so that `imageSize(input)` checks:
     ```javascript
     if (typeof input === 'string') {
       input = require('fs').readFileSync(input);
     }
     ```
     This restores backward compatibility for any tool expecting the `1.x` signature.
  2. OR patch `node_modules/metro/src/Assets.js` line 170-173 to always read `isImageInput` via `_fs.default.readFileSync(assetInfo.files[0])`.

---

### [MEDIUM] Challenge 2: Unexported `package.json` in `image-size@2.0.4`

- **Assumption challenged**: Standard Node package resolution can introspect `image-size/package.json`.
- **Attack scenario**: `image-size@2.0.4` defines an strict `"exports"` field in its `package.json` but omits `"./package.json"`. Any tooling executing `require('image-size/package.json')` or `resolve.sync('image-size/package.json')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **Blast radius**: Build plugins, monorepo linters, or diagnostics attempting to read the package version via exports.
- **Mitigation**: Add `"./package.json": "./package.json"` to `node_modules/image-size/package.json` exports via `scripts/patch-modules.js`.

---

## Stress Test Results

### 1. `image-size@2.0.4` Core Parsing & Infinite Loop Resistance

All buffer-based stress tests executed synchronously in <=1ms, demonstrating complete infinite loop resistance:

| Test Scenario | Input Specification | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| Valid PNG | `assets/images/icon.png` (1024x1024) | Parse `{ width: 1024, height: 1024, type: 'png' }` | Parsed in 0ms | **PASS** |
| Valid PNG | `assets/images/favicon.png` (16x16) | Parse `{ width: 16, height: 16, type: 'png' }` | Parsed in 0ms | **PASS** |
| Valid GIF | 1x1 transparent GIF buffer | Parse `{ width: 1, height: 1, type: 'gif' }` | Parsed in 0ms | **PASS** |
| Valid BMP | 1x1 24bpp BMP buffer | Parse `{ width: 1, height: 1, type: 'bmp' }` | Parsed in 0ms | **PASS** |
| Valid SVG | `<svg width="200" height="150">` | Parse `{ width: 200, height: 150, type: 'svg' }` | Parsed in 1ms | **PASS** |
| Valid WebP | 1x1 lossless WebP buffer | Parse `{ width: 1, height: 1, type: 'webp' }` | Parsed in 0ms | **PASS** |
| Zero-length buffer | `Buffer.alloc(0)` | Safe rejection without hanging | Threw `RangeError` in 0ms | **PASS** |
| 1-byte headers | `0x89`, `0xff`, `0x47`, `0x42`, `0x00`, `0x69` | Safe rejection without hanging | Threw `TypeError` in 0ms | **PASS** |
| Truncated PNG header | `[0x89, 0x50, 0x4e, 0x47]` | Safe rejection without hanging | Threw `TypeError` in 0ms | **PASS** |
| Corrupted PNG IHDR length | Crafted IHDR chunk length `0x7fffffff` | Graceful parse or rejection | Parsed safely in 0ms | **PASS** |
| Truncated JPEG header | `[0xff, 0xd8, 0xff, 0xe0]` | Safe rejection without hanging | Threw `TypeError: Invalid JPG` in 0ms | **PASS** |
| JPEG zero-length marker | `[0xff, 0xd8, 0xff, 0xc0, 0x00, 0x00]` | Safe rejection without hanging | Threw `TypeError: Invalid JPG` in 0ms | **PASS** |
| ICNS zero chunk length | CVE-2025-71330 trigger sequence | No infinite loop | Threw `TypeError: Invalid ICNS` in 0ms | **PASS** |
| ICNS cyclic chunk offset | Cyclic chunk offsets | No infinite loop | Parsed safely in 0ms | **PASS** |
| JXL infinite loop pattern | GHSA-5p2g-fcmc-qvqq trigger sequence | No infinite loop | Threw `TypeError` in 0ms | **PASS** |
| HEIF circular ftyp box | Circular ftyp box headers | No infinite loop | Threw `TypeError` in 0ms | **PASS** |
| 1KB All zeros | `Buffer.alloc(1024, 0)` | No infinite loop | Handled safely in 0ms | **PASS** |
| 1KB All 0xFF | `Buffer.alloc(1024, 0xff)` | No infinite loop | Threw `TypeError` in 0ms | **PASS** |
| 4KB Random garbage | Pseudorandom bytes | No infinite loop | Threw `TypeError` in 0ms | **PASS** |

### 2. Metro Bundler Asset Pipeline

| Test Scenario | Invocation | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| Metro `getAssetSize` (buffer) | `getAssetSize('png', iconBuffer, 'icon.png')` | Returns dimensions | `{ width: 1024, height: 1024 }` | **PASS** |
| Metro `getAssetSize` (empty) | `getAssetSize('png', Buffer.alloc(0), 'empty.png')` | Throws specific Metro error | Throws "Image asset cannot be an empty file" | **PASS** |
| **Metro `getAssetData` (`icon.png`)** | `getAssetData(absPath, 'assets/images/icon.png', ...)` | Returns AssetData object | **Crashed with TypeError in `bmp.validate`** | **CRITICAL FAIL** |
| **Metro `getAssetData` (`splash-icon.png`)** | `getAssetData(absPath, 'assets/images/splash-icon.png', ...)` | Returns AssetData object | **Crashed with TypeError in `bmp.validate`** | **CRITICAL FAIL** |
| **Metro `getAssetData` (`adaptive-icon.png`)** | `getAssetData(absPath, 'assets/images/adaptive-icon.png', ...)` | Returns AssetData object | **Crashed with TypeError in `bmp.validate`** | **CRITICAL FAIL** |
| **Metro `getAssetData` (`favicon.png`)** | `getAssetData(absPath, 'assets/images/favicon.png', ...)` | Returns AssetData object | **Crashed with TypeError in `bmp.validate`** | **CRITICAL FAIL** |
| **Metro `assetTransformer.transform`** | `transformer.transform({ filename: 'assets/images/icon.png' })` | Returns AST for asset | **Crashed with TypeError via `getAssetData`** | **CRITICAL FAIL** |

### 3. `undici@7.30.0` Runtime Behavior

| Test Scenario | Invocation | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| Core exports | `['request', 'fetch', 'Agent', 'Pool', 'Client']` | All exported | All present | **PASS** |
| Agent instantiation | `new undici.Agent({ keepAliveTimeout: 1000 })` | Instance created | Success | **PASS** |
| Local HTTP Roundtrip | `undici.request(localServerUrl)` | HTTP 200, valid body text | Status 200, JSON received | **PASS** |
| Local Fetch Roundtrip | `undici.fetch(localServerUrl)` | HTTP 200, valid JSON response | Status 200, JSON received | **PASS** |

### 4. `node-forge@1.4.0` Runtime Behavior

| Test Scenario | Invocation | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| MD5 and SHA-256 Hashing | `forge.md.md5`, `forge.md.sha256` | Matching hex digests | `cb83cebce...` / `0d0a57f...` | **PASS** |
| AES-CBC Encryption/Decryption | Encrypt plaintext with random IV, decrypt | Plaintext matches | Decrypted string matches exact input | **PASS** |
| PKI RSA 1024-bit keypair & cert | `generateKeyPair`, `createCertificate`, `sign`, `certificateFromPem` | Valid self-signed certificate | Valid X.509 cert created and validated | **PASS** |

### 5. Automated Regression Test Gates

| Test Suite | Command | Expected | Actual | Result |
|---|---|---|---|---|
| Unit Test Suite | `npm test` | 0 failures | 29 passed, 0 failed | **PASS** |
| TypeScript Compiler | `npx tsc --noEmit` | 0 errors | 0 errors | **PASS** |
| ESLint | `npm run lint` | 0 errors | 0 errors (64 warnings) | **PASS** |

---

## Unchallenged Areas

- End-to-end native compilation (iOS/Android native binaries): Out of scope in this repository tier without local native SDK toolchains installed.
- Production HTTPS undici connections to external cloud servers: Mocked and tested via local HTTP loopback to ensure deterministic, isolated verification.
