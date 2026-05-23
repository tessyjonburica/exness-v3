import { useEffect, useRef } from "react";
import { MARKET_BY_PAIR } from "@/components/trading/constants";
import { setSymbolPrice } from "@/lib/price-store";
import { WS_BASE_URL } from "@/lib/runtime-config";

export interface TradeMessage {
  type: "ASK" | "BID";
  symbol: string;
  price: number;
  originalPrice: number;
  quantity: number;
  time: number;
}

export interface AccountUpdatePayload {
  email: string;
  event: "trade_opened" | "trade_closed" | "trade_liquidated" | "funding_updated";
  balance?: number;
  openOrders?: unknown[];
  transactionId?: string;
}

export type WebSocketFeedStatus = "connecting" | "connected" | "active" | "disconnected";

let ws: WebSocket | null = null;
let listeners: Array<(msg: TradeMessage) => void> = [];
let accountListeners: Array<(event: AccountUpdatePayload) => void> = [];
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let closeTimeout: ReturnType<typeof setTimeout> | null = null;
const WS_URL = WS_BASE_URL;

export function useWebSocket(
  onMessage: (msg: TradeMessage) => void,
  onStatusChange?: (status: WebSocketFeedStatus) => void,
  onAccountUpdate?: (event: AccountUpdatePayload) => void
) {
  const callbackRef = useRef(onMessage);
  const statusRef = useRef(onStatusChange);
  const accountCallbackRef = useRef(onAccountUpdate);

  useEffect(() => {
    callbackRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    statusRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    accountCallbackRef.current = onAccountUpdate;
  }, [onAccountUpdate]);

  useEffect(() => {
    const stableCallback = (msg: TradeMessage) => {
      callbackRef.current(msg);
    };
    const stableAccountCallback = (event: AccountUpdatePayload) => {
      accountCallbackRef.current?.(event);
    };

    const connectWebSocket = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        return;
      }

      statusRef.current?.("connecting");
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        statusRef.current?.("connected");
        const token = localStorage.getItem("token");
        if (token) {
          ws?.send(JSON.stringify({ type: "AUTH", token }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as unknown;

          if (
            parsed &&
            typeof parsed === "object" &&
            "type" in parsed &&
            parsed.type === "PRICE_UPDATE" &&
            "data" in parsed &&
            typeof parsed.data === "string"
          ) {
            const priceMap = JSON.parse(parsed.data) as Record<
              string,
              { buyPrice: number; sellPrice: number; decimal: number }
            >;

            const now = Date.now();

            Object.entries(priceMap).forEach(([pair, price]) => {
              const scale = Math.pow(10, price.decimal || 0);
              const ask = price.buyPrice / scale;
              const bid = price.sellPrice / scale;
              const symbol = mapPairToUiSymbol(pair);

              setSymbolPrice(symbol, { ask, bid, time: now });

              listeners.forEach((listener) =>
                listener({
                  type: "ASK",
                  symbol,
                  price: ask,
                  originalPrice: ask,
                  quantity: 0,
                  time: now,
                })
              );

              listeners.forEach((listener) =>
                listener({
                  type: "BID",
                  symbol,
                  price: bid,
                  originalPrice: bid,
                  quantity: 0,
                  time: now,
                })
              );
            });

            statusRef.current?.("active");
            return;
          }

          if (
            parsed &&
            typeof parsed === "object" &&
            "type" in parsed &&
            parsed.type === "ACCOUNT_UPDATE" &&
            "data" in parsed &&
            typeof parsed.data === "string"
          ) {
            const accountUpdate = JSON.parse(parsed.data) as AccountUpdatePayload;
            accountListeners.forEach((listener) => listener(accountUpdate));
            return;
          }

          if (
            parsed &&
            typeof parsed === "object" &&
            "type" in parsed &&
            "symbol" in parsed &&
            "price" in parsed
          ) {
            statusRef.current?.("active");
            listeners.forEach((listener) => listener(parsed as TradeMessage));
          }
        } catch {
          return;
        }
      };

      ws.onclose = () => {
        ws = null;
        statusRef.current?.("disconnected");

        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }

        reconnectTimeout = setTimeout(() => {
          if (listeners.length > 0 && !ws) {
            connectWebSocket();
          }
        }, 3000);
      };
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && (!ws || ws.readyState !== WebSocket.OPEN)) {
        connectWebSocket();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    connectWebSocket();

    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }

    listeners.push(stableCallback);
    accountListeners.push(stableAccountCallback);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      listeners = listeners.filter((listener) => listener !== stableCallback);
      accountListeners = accountListeners.filter((listener) => listener !== stableAccountCallback);

      if (listeners.length === 0 && accountListeners.length === 0 && ws) {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
        }

        closeTimeout = setTimeout(() => {
          if (listeners.length === 0 && accountListeners.length === 0 && ws) {
            ws.close();
            ws = null;
          }
        }, 1000);
      }
    };
  }, []);
}

function mapPairToUiSymbol(pair: string): string {
  const market = MARKET_BY_PAIR[pair];
  if (market) {
    return market.wsSymbol;
  }

  const compact = pair.replace("_", "");
  if (compact.endsWith("USDC")) return compact.replace("USDC", "USDT");
  return compact;
}
