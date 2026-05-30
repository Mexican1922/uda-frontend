// Stable, per-browser device identity used for cross-device playback sync.
// The id is persisted so the same browser keeps the same identity across reloads.

const DEVICE_ID_KEY = "uda_device_id";

export type DeviceKind = "phone" | "tablet" | "desktop";

export interface DeviceInfo {
  id: string;
  name: string;
  kind: DeviceKind;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = makeId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function detectKind(ua: string): DeviceKind {
  if (/iPad|Tablet|PlayBook/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return "tablet";
  }
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) {
    return "phone";
  }
  return "desktop";
}

function detectOS(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua))          return "Android";
  if (/Windows/i.test(ua))          return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua))            return "Linux";
  return "device";
}

function detectBrowser(ua: string): string {
  // Order matters — Edge/Opera/Chrome all contain "Chrome"/"Safari"
  if (/Edg\//i.test(ua))                 return "Edge";
  if (/OPR\/|Opera/i.test(ua))           return "Opera";
  if (/Firefox\//i.test(ua))             return "Firefox";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua))   return "Safari";
  return "Browser";
}

let cached: DeviceInfo | null = null;

export function getDeviceInfo(): DeviceInfo {
  if (cached) return cached;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const kind = detectKind(ua);
  const os = detectOS(ua);
  const browser = detectBrowser(ua);

  // e.g. "Chrome on Windows", "Safari on iOS"
  const name = `${browser} on ${os}`;

  cached = { id: getDeviceId(), name, kind };
  return cached;
}
