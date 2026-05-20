import type { LucideIcon } from "lucide-react";

export type TradeSide = "LONG" | "SHORT";
export type OrdersTab = "open" | "all";
export type SidebarTab = "ticket" | "commentary";
export type MobileSheet = "buy" | "sell" | "orders" | null;
export type Timeframe = "1m" | "5m" | "30m" | "1h" | "6h" | "1d" | "3d";

export interface TradeRecord {
  id: string;
  asset: string;
  side: TradeSide;
  quantity: number;
  leverage: number;
  margin?: number;
  status?: "OPEN" | "CLOSED";
  openPrice?: number;
  tradeOpeningPrice?: number;
  closePrice?: number;
  pnl?: number;
  slippage?: number;
  stopLoss?: number;
  takeProfit?: number;
  liquidated?: boolean;
  reason?: string | null;
  createdAt?: string;
}

export interface CommentaryCard {
  title: string;
  body: string;
  accent: string;
  icon: LucideIcon;
  value?: string;
}

export interface MarketDefinition {
  symbol: string;
  wsSymbol: string;
  asset: string;
  pair: string;
  label: string;
  icon: string;
}
