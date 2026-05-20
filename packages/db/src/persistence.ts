type NumericInput = number | string | { toNumber?: () => number } | null | undefined;

function fail(field: string, reason: string): never {
  throw new Error(`[persistence] Invalid ${field}: ${reason}`);
}

export function normalizeFiniteNumber(field: string, value: NumericInput): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      fail(field, `received non-finite number ${String(value)}`);
    }
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      fail(field, 'received empty string');
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      fail(field, `received non-numeric string "${value}"`);
    }
    return parsed;
  }

  if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
    const parsed = value.toNumber();
    if (!Number.isFinite(parsed)) {
      fail(field, 'Decimal-like value could not be converted to a finite number');
    }
    return parsed;
  }

  fail(field, `received unsupported type ${value === null ? 'null' : typeof value}`);
}

export function normalizeDate(field: string, value: Date | string | number): Date {
  const normalized = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(normalized.getTime())) {
    fail(field, `received invalid date ${String(value)}`);
  }
  return normalized;
}

export function summarizeForLog(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map((item) => summarizeForLog(item));
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (/password|secret|token/i.test(key)) {
        return [key, '[redacted]'];
      }

      if (value instanceof Date) {
        return [key, value.toISOString()];
      }

      return [key, summarizeForLog(value)];
    })
  );
}
