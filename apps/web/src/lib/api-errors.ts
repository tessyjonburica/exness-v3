import axios, { AxiosError } from "axios";

type ApiErrorPayload = {
  message?: string;
  error?: string;
  detail?: string;
};

function isApiPayload(value: unknown): value is ApiErrorPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  return true;
}

export function getApiStatus(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null;
  }

  return null;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const payload = error.response?.data;
    if (isApiPayload(payload)) {
      const detail = payload.detail ? ` ${payload.detail}` : "";
      const base = payload.message || payload.error;
      if (base) {
        return `${base}${detail}`;
      }
    }

    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export type ApiAxiosError = AxiosError<ApiErrorPayload>;
