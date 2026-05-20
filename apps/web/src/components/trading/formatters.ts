import type { TradeRecord } from "@/components/trading/types";
import { MARKET_BY_ASSET } from "@/components/trading/constants";

export function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function formatCurrency(value: number | null | undefined, digits = 2): string {
  const numeric = safeNumber(value);
  if (numeric === null) return "--";

  return numeric.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSignedCurrency(value: number | null | undefined, digits = 2): string {
  const numeric = safeNumber(value);
  if (numeric === null) return "--";

  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${formatCurrency(numeric, digits)}`;
}

export function formatDecimal(value: number | null | undefined, digits = 2): string {
  const numeric = safeNumber(value);
  if (numeric === null) return "--";

  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSignedPercent(value: number | null | undefined, digits = 2): string {
  const numeric = safeNumber(value);
  if (numeric === null) return "--";

  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(digits)}%`;
}

export function formatPrice(value: number | null | undefined): string {
  return formatCurrency(value, 2);
}

export function formatAssetLabel(asset: string): string {
  return asset.replace("_", "/");
}

export function getEntryPrice(order: TradeRecord): number | null {
  const openPrice = safeNumber(order.openPrice);
  if (openPrice !== null) return openPrice;

  return safeNumber(order.tradeOpeningPrice);
}

export function mapAssetToSymbol(asset: string): string {
  const market = MARKET_BY_ASSET[asset];
  if (market) {
    return market.wsSymbol;
  }

  const compact = asset.replace("_", "");
  if (compact.endsWith("USDC")) return compact.replace("USDC", "USDT");
  return compact;
}

export function isClosedTrade(order: TradeRecord): boolean {
  return (
    safeNumber(order.closePrice) !== null ||
    typeof order.liquidated === "boolean" ||
    typeof order.reason === "string"
  );
}

export function formatOrderSlippage(value: number | null | undefined): string {
  const numeric = safeNumber(value);
  if (numeric === null) return "--";

  return formatSignedPercent(numeric * 100, 2).replace("+", "");
}
