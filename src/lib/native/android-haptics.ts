/**
 * Native haptic helpers for the Coffeesentials member Android WebView.
 *
 * Bridge name: `window.AndroidHaptics`
 * Method: `triggerHaptic(type)` where type is `click` | `heavy` | `success` | `error`
 *
 * Optional pull-to-refresh hook: assign `window.onNativeRefresh = () => { ... }`
 * to handle refresh in JS; otherwise the app reloads the WebView.
 */

export type AndroidHapticType = "click" | "heavy" | "success" | "error";

type AndroidHapticsBridge = {
  triggerHaptic: (type: string) => void;
};

declare global {
  interface Window {
    AndroidHaptics?: AndroidHapticsBridge;
    onNativeRefresh?: () => void;
  }
}

export function isAndroidHapticsAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.AndroidHaptics?.triggerHaptic === "function";
}

/** Fire a native haptic when running inside the member Android app. */
export function triggerAndroidHaptic(type: AndroidHapticType = "click"): boolean {
  if (!isAndroidHapticsAvailable()) return false;
  try {
    window.AndroidHaptics?.triggerHaptic(type);
    return true;
  } catch {
    return false;
  }
}

/**
 * Example usage in a click handler:
 *
 * ```ts
 * import { triggerAndroidHaptic } from "@/lib/native/android-haptics";
 *
 * button.onClick = () => {
 *   triggerAndroidHaptic("click");
 * };
 * ```
 *
 * Or from plain JS in the WebView:
 *
 * ```js
 * window.AndroidHaptics?.triggerHaptic("success");
 * ```
 */
