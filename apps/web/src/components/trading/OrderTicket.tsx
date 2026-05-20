import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatPrice } from "@/components/trading/formatters";
import type { TradeSide } from "@/components/trading/types";

interface OrderTicketProps {
  selectedCrypto: string;
  bidPrice: number;
  askPrice: number;
  leverage: number;
  volume: string;
  slippage: string;
  takeProfit: string;
  stopLoss: string;
  workingNotional: number | null;
  buyMarginEstimate: number | null;
  sellMarginEstimate: number | null;
  createPending: boolean;
  onVolumeChange: (value: string) => void;
  onLeverageChange: (value: number) => void;
  onSlippageChange: (value: string) => void;
  onTakeProfitChange: (value: string) => void;
  onStopLossChange: (value: string) => void;
  onSubmit: (side: TradeSide) => Promise<boolean>;
}

export function OrderTicket({
  selectedCrypto,
  bidPrice,
  askPrice,
  leverage,
  volume,
  slippage,
  takeProfit,
  stopLoss,
  workingNotional,
  buyMarginEstimate,
  sellMarginEstimate,
  createPending,
  onVolumeChange,
  onLeverageChange,
  onSlippageChange,
  onTakeProfitChange,
  onStopLossChange,
  onSubmit,
}: OrderTicketProps) {
  const hasLivePrice = askPrice > 0 && bidPrice > 0;

  return (
    <div className="space-y-2.5">
      {!hasLivePrice ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide">Price feed pending</p>
              <p className="mt-1 text-sm">
                Live executable prices are not available yet. Order entry will activate automatically when bid and ask pricing are received.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="border-gray-200 bg-white p-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Order ticket
          </p>
          <p className="mt-0.5 text-sm font-extrabold">{selectedCrypto}/USD market order</p>
          <p className="mt-0.5 text-[10px] leading-4 text-gray-500 dark:text-gray-400">
            Simulated market execution using live bid/ask pricing.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-green-200 bg-green-50 p-1.5 text-center dark:border-green-700 dark:bg-green-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-300">Bid</p>
            <p className="text-sm font-extrabold text-green-700 dark:text-green-300">{formatPrice(bidPrice)}</p>
          </div>
          <div className="rounded-md border border-red-200 bg-red-50 p-1.5 text-center dark:border-red-700 dark:bg-red-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">Ask</p>
            <p className="text-sm font-extrabold text-red-700 dark:text-red-300">{formatPrice(askPrice)}</p>
          </div>
        </div>

        <div className="mt-2 space-y-2">
          <div>
            <label className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              Quantity
            </label>
            <input
              data-testid="order-quantity-input"
              type="number"
              value={volume}
              onChange={(event) => onVolumeChange(event.target.value)}
              step="0.01"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Trade quantity in base units
            </p>
          </div>

          <div>
            <label className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              Leverage ({leverage}x)
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={leverage}
              onChange={(event) => onLeverageChange(Number(event.target.value))}
              className="w-full h-1"
            />
            <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <span>1x</span>
              <span>5x</span>
              <span>10x</span>
              <span>50x</span>
              <span>100x</span>
            </div>
          </div>

          <div>
            <label className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              Slippage tolerance (%)
            </label>
            <input
              data-testid="order-slippage-input"
              type="number"
              value={slippage}
              onChange={(event) => onSlippageChange(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <label className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Take profit
              </label>
              <input
                type="number"
                value={takeProfit}
                onChange={(event) => onTakeProfitChange(event.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Stop loss
              </label>
              <input
                type="number"
                value={stopLoss}
                onChange={(event) => onStopLossChange(event.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Estimated notional
            </span>
            <span className="font-extrabold">{formatCurrency(workingNotional)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Margin (long)
            </span>
            <span className="font-extrabold">{formatCurrency(buyMarginEstimate)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Margin (short)
            </span>
            <span className="font-extrabold">{formatCurrency(sellMarginEstimate)}</span>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            data-testid="open-long-button"
            onClick={() => void onSubmit("LONG")}
            disabled={createPending}
            className="rounded-md bg-black px-2 py-2 text-[11px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            {createPending ? "..." : "Long"}
          </button>
          <button
            data-testid="open-short-button"
            onClick={() => void onSubmit("SHORT")}
            disabled={createPending}
            className="rounded-md border-2 border-black bg-white px-2 py-2 text-[11px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-black dark:text-white dark:hover:bg-gray-800"
          >
            {createPending ? "..." : "Short"}
          </button>
        </div>
      </Card>
    </div>
  );
}
