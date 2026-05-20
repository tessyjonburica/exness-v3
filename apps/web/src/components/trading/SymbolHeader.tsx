import type { PriceData } from "@/lib/price-store";
import type { MarketDefinition, Timeframe } from "@/components/trading/types";
import { formatCurrency, formatPrice, formatSignedCurrency } from "@/components/trading/formatters";

interface SymbolHeaderProps {
  markets: MarketDefinition[];
  prices: Record<string, PriceData>;
  selectedCrypto: string;
  selectedTimeframe: Timeframe;
  selectedMidPrice: number;
  spreadValue: number | null;
  accountEquity: number;
  totalUnrealizedPnl: number;
  sessionStatus: string;
  onSelectCrypto: (symbol: string) => void;
  onSelectTimeframe: (timeframe: Timeframe) => void;
  timeframes: Timeframe[];
}

export function SymbolHeader({
  markets,
  prices,
  selectedCrypto,
  selectedTimeframe,
  selectedMidPrice,
  spreadValue,
  accountEquity,
  totalUnrealizedPnl,
  sessionStatus,
  onSelectCrypto,
  onSelectTimeframe,
  timeframes,
}: SymbolHeaderProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-2 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800/80 lg:px-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
          {markets.map((market) => {
            const marketPrice = prices[market.wsSymbol];
            const isActive = selectedCrypto === market.symbol;

            return (
              <button
                key={market.symbol}
                data-testid={`symbol-selector-${market.symbol}`}
                onClick={() => onSelectCrypto(market.symbol)}
                className={`min-w-[122px] rounded-md border px-2 py-1.5 text-left transition-all lg:min-w-[132px] ${
                  isActive
                    ? "border-black bg-white shadow-sm dark:border-white dark:bg-gray-900"
                    : "border-transparent bg-transparent hover:border-gray-300 hover:bg-white dark:hover:border-gray-600 dark:hover:bg-gray-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <img src={market.icon} alt={market.symbol} className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-extrabold leading-none">{market.symbol}/USD</p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                        Spot CFD
                      </p>
                    </div>
                  </div>
                  {isActive ? (
                    <span className="rounded-full bg-black px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.14em] text-white dark:bg-white dark:text-black">
                      Live
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] font-bold">
                  <div className="min-w-0">
                    <p className="uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Bid</p>
                    <p className="truncate text-green-700 dark:text-green-300">{formatPrice(marketPrice?.bid)}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Ask</p>
                    <p className="truncate text-red-700 dark:text-red-300">{formatPrice(marketPrice?.ask)}</p>
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-extrabold lg:text-xl">{selectedCrypto}/USD</h1>
            <span className="rounded-full border border-gray-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:text-gray-300">
              <span data-testid="price-feed-status">{sessionStatus}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Live execution pricing, charting, and persisted position tracking.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm lg:min-w-[420px] lg:grid-cols-4">
          <div className="rounded-md border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Mid</p>
            <p className="font-extrabold text-sm">{formatPrice(selectedMidPrice)}</p>
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Spread</p>
            <p className="font-extrabold text-sm">{formatCurrency(spreadValue, 2)}</p>
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Equity</p>
            <p className="font-extrabold text-sm">{formatCurrency(accountEquity)}</p>
          </div>
          <div className="rounded-md border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
              Unrealized P&amp;L
            </p>
            <p
              className={`font-extrabold text-sm ${
                totalUnrealizedPnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatSignedCurrency(totalUnrealizedPnl)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 overflow-x-auto">
        {timeframes.map((timeframe) => (
          <button
            key={timeframe}
            onClick={() => onSelectTimeframe(timeframe)}
            className={`rounded-md px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition-colors ${
              selectedTimeframe === timeframe
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "border border-gray-300 bg-white text-black hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            }`}
          >
            {timeframe}
          </button>
        ))}
      </div>
    </div>
  );
}
