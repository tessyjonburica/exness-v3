const DEV_API_URL = "http://localhost:3000/api/v1";
const DEV_WS_URL = "ws://localhost:8080";

function getLocalPreviewOrigin(port: string) {
  if (typeof window === "undefined") {
    return "";
  }

  const { protocol, hostname } = window.location;
  const isLocalPreview =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  if (!isLocalPreview) {
    return "";
  }

  return `${protocol}//${hostname}:${port}`;
}

function getBrowserWebSocketOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

function getApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (import.meta.env.DEV) {
    return DEV_API_URL;
  }

  const localPreviewOrigin = getLocalPreviewOrigin("3000");
  return localPreviewOrigin ? `${localPreviewOrigin}/api/v1` : "/api/v1";
}

function getWebSocketBaseUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  if (import.meta.env.DEV) {
    return DEV_WS_URL;
  }

  const localPreviewOrigin = getLocalPreviewOrigin("8080");
  return localPreviewOrigin ? localPreviewOrigin.replace(/^http/, "ws") : getBrowserWebSocketOrigin();
}

export const API_BASE_URL = getApiBaseUrl();

export const WS_BASE_URL = getWebSocketBaseUrl();
