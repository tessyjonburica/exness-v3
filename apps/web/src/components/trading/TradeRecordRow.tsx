import { Card } from "@/components/ui/card";
import {
  formatAssetLabel,
  formatCurrency,
  formatDecimal,
  formatOrderSlippage,
  formatPrice,
  formatSignedCurrency,
  getEntryPrice,
  isClosedTrade,
} from "@/components/trading/formatters";
import type { TradeRecord } from "@/components/trading/types";

interface TradeRecordRowProps {
  order: TradeRecord;
  unrealizedPnl: number | null;
  onClosePosition?: (order: TradeRecord) => void;
  isClosing?: boolean;
  compact?: boolean;
}

export function TradeRecordRow({
  order,
  unrealizedPnl,
  onClosePosition,
  isClosing = false,
  compact = false,
}: TradeRecordRowProps) {
  const entryPrice = getEntryPrice(order);
  const effectivePnl = isClosedTrade(order) ? order.pnl ?? null : unrealizedPnl;
  const statusLabel = isClosedTrade(order) ? "Closed" : "Open";
  const statusColor =
    order.side === "LONG" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  const pnlColor =
    effectivePnl === null
      ? "text-gray-500 dark:text-gray-400"
      : effectivePnl >= 0
        ? "text-green-600 dark:text-green-400"
        : "text-red-600 dark:text-red-400";

  if (compact) {
    return (
      <Card className="border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div data-testid={isClosedTrade(order) ? "closed-trade-row" : "open-position-row"} />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold dark:text-white">{formatAssetLabel(order.asset)}</p>
            <p className={`text-xs font-bold uppercase tracking-wide ${statusColor}`}>{order.side}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {statusLabel}
            </p>
            <p className={`text-sm font-extrabold ${pnlColor}`}>{formatSignedCurrency(effectivePnl)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="font-bold text-gray-500 dark:text-gray-400">Quantity</p>
            <p className="font-extrabold dark:text-white">{formatDecimal(order.quantity, 2)}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 dark:text-gray-400">Entry</p>
            <p className="font-extrabold dark:text-white">{formatPrice(entryPrice)}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 dark:text-gray-400">Leverage</p>
            <p className="font-extrabold dark:text-white">{formatDecimal(order.leverage, 0)}x</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 dark:text-gray-400">
              {isClosedTrade(order) ? "Exit" : "Unrealized P&L"}
            </p>
            <p className="font-extrabold dark:text-white">
              {isClosedTrade(order) ? formatPrice(order.closePrice) : formatSignedCurrency(unrealizedPnl)}
            </p>
          </div>
        </div>

        {!isClosedTrade(order) && onClosePosition && (
          <button
            data-testid="close-position-button"
            onClick={() => onClosePosition(order)}
            disabled={isClosing}
            className="mt-3 w-full rounded-md border border-red-500 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/30"
          >
            {isClosing ? "Closing position..." : "Close position"}
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card
      className="border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
      data-testid={isClosedTrade(order) ? "closed-trade-row" : "open-position-row"}
    >
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-[1.15fr_0.7fr_0.8fr_0.95fr_1fr_0.8fr_1fr_0.9fr]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Instrument
          </p>
          <p className="text-sm font-extrabold dark:text-white">{formatAssetLabel(order.asset)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Side</p>
          <p className={`text-sm font-extrabold ${statusColor}`}>{order.side}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Quantity
          </p>
          <p className="text-sm font-extrabold dark:text-white">{formatDecimal(order.quantity, 2)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Entry</p>
          <p className="text-sm font-extrabold dark:text-white">{formatPrice(entryPrice)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {isClosedTrade(order) ? "Exit" : "Margin in use"}
          </p>
          <p className="text-sm font-extrabold dark:text-white">
            {isClosedTrade(order) ? formatPrice(order.closePrice) : formatCurrency(order.margin)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</p>
          <p className="text-sm font-extrabold text-gray-700 dark:text-gray-300">{statusLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {isClosedTrade(order) ? "Realized P&L" : "Unrealized P&L"}
          </p>
          <p className={`text-sm font-extrabold ${pnlColor}`}>{formatSignedCurrency(effectivePnl)}</p>
        </div>
        <div className="flex items-end justify-start xl:justify-end">
          {!isClosedTrade(order) && onClosePosition ? (
            <button
              data-testid="close-position-button"
              onClick={() => onClosePosition(order)}
              disabled={isClosing}
              className="rounded-md border border-red-500 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/30"
            >
              {isClosing ? "Closing..." : "Close position"}
            </button>
          ) : (
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Booked
            </span>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-gray-200 pt-2.5 text-[11px] dark:border-gray-700">
        <div>
          <span className="font-bold text-gray-500 dark:text-gray-400">Leverage:</span>
          <span className="ml-1 font-extrabold dark:text-white">{formatDecimal(order.leverage, 0)}x</span>
        </div>
        <div>
          <span className="font-bold text-gray-500 dark:text-gray-400">Slippage tolerance:</span>
          <span className="ml-1 font-extrabold dark:text-white">{formatOrderSlippage(order.slippage)}</span>
        </div>
        {order.stopLoss !== undefined && (
          <div>
            <span className="font-bold text-gray-500 dark:text-gray-400">Stop loss:</span>
            <span className="ml-1 font-extrabold dark:text-white">{formatPrice(order.stopLoss)}</span>
          </div>
        )}
        {order.takeProfit !== undefined && (
          <div>
            <span className="font-bold text-gray-500 dark:text-gray-400">Take profit:</span>
            <span className="ml-1 font-extrabold dark:text-white">{formatPrice(order.takeProfit)}</span>
          </div>
        )}
        {order.reason && (
          <div>
            <span className="font-bold text-gray-500 dark:text-gray-400">Close reason:</span>
            <span className="ml-1 font-extrabold dark:text-white">{order.reason}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
