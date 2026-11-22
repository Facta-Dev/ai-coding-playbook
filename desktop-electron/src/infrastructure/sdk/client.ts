// <app> — the core's client of the backend, wired.
//
// `packages/sdk` is transport-shy: it takes the fetch it talks through. In
// Electron that transport is `net.fetch` (Chromium's network stack: system
// proxies/PAC, enterprise certificate stores, TLS policy), which the main
// process passes to the core at startup — the composition root adapts it to
// the `SdkFetch` shape.
//
// This module is the import surface of the infrastructure: the feature
// adapters and the core container import from `./client` and nowhere else
// inside `packages/sdk`.

export {
  SDK_PATHS,
  createSdk,
  type Sdk,
  type SdkError,
  type SdkErrorCode,
  type SdkFetch,
  type SdkNote,
  type SdkOptions,
  type SdkResponse,
  type SdkResult,
} from "../../../packages/sdk/src/index";
