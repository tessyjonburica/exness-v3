import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TradeHistory } from "@/components/trading/TradeHistory";
import { PositionsTable } from "@/components/trading/PositionsTable";
import { formatCurrency, formatPrice } from "@/components/trading/formatters";
import type { MobileSheet, OrdersTab, TradeRecord, TradeSide } from "@/components/trading/types";

interface MobileOrderSheetProps {
  mobileSheet: MobileSheet;
  ordersTab: OrdersTab;
  openOrders: TradeRecord[];
  closedOrders: TradeRecord[];
  openOrdersLoading: boolean;
  closedOrdersLoading: boolean;
  closedOrdersErrorMessage?: string | null;
  leverage: number;
  volume: string;
  slippage: string;
  takeProfit: string;
  stopLoss: string;
  accountBalance: number;
  selectedMarginEstimate: number | null;
  selectedPrice: {
    bid: number;
    ask: number;
  };
  createPending: boolean;
  closePending: boolean;
  pendingCloseOrderId: string | null;
  onDismiss: () => void;
  onOrdersTabChange: (value: OrdersTab) => void;
  onRetryClosedOrders?: () => void;
  onVolumeChange: (value: string) => void;
  onLeverageChange: (value: number) => void;
  onSlippageChange: (value: string) => void;
  onTakeProfitChange: (value: string) => void;
  onStopLossChange: (value: string) => void;
  onSubmitTrade: (side: TradeSide) => Promise<boolean>;
  onClosePosition: (order: TradeRecord) => void;
  computeUnrealizedPnl: (order: TradeRecord) => number | null;
}

export function MobileOrderSheet({
  mobileSheet,
  ordersTab,
  openOrders,
  closedOrders,
  openOrdersLoading,
  closedOrdersLoading,
  closedOrdersErrorMessage,
  leverage,
  volume,
  slippage,
  takeProfit,
  stopLoss,
  accountBalance,
  selectedMarginEstimate,
  selectedPrice,
  createPending,
  closePending,
  pendingCloseOrderId,
  onDismiss,
  onOrdersTabChange,
  onRetryClosedOrders,
  onVolumeChange,
  onLeverageChange,
  onSlippageChange,
  onTakeProfitChange,
  onStopLossChange,
  onSubmitTrade,
  onClosePosition,
  computeUnrealizedPnl,
}: MobileOrderSheetProps) {
  if (!mobileSheet) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onDismiss} />
      <div className="relative max-h-[85vh] rounded-t-2xl bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Trade X terminal
            </p>
            <h3 className="text-sm font-extrabold">
              {mobileSheet === "buy"
                ? "Open long position"
                : mobileSheet === "sell"
                  ? "Open short position"
                  : `Positions (${openOrders.length})`}
            </h3>
          </div>
          <button
            onClick={onDismiss}
            className="px-2 text-lg font-bold text-gray-500 dark:text-gray-400"
            aria-label="Close order sheet"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {mobileSheet === "orders" && (
            <Tabs value={ordersTab} onValueChange={(value) => onOrdersTabChange(value as OrdersTab)}>
              <TabsList className="mb-3 h-auto w-full justify-start rounded-none border-b border-gray-200 bg-transparent p-0 dark:border-gray-700">
                <TabsTrigger
                  value="open"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs font-extrabold uppercase tracking-wide data-[state=active]:border-black data-[state=active]:bg-transparent dark:data-[state=active]:border-white"
                >
                  Open ({openOrders.length})
                </TabsTrigger>
                <TabsTrigger
                  value="all"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs font-extrabold uppercase tracking-wide data-[state=active]:border-black data-[state=active]:bg-transparent dark:data-[state=active]:border-white"
                >
                  History ({closedOrders.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="open">
                <PositionsTable
                  compact
                  computeUnrealizedPnl={computeUnrealizedPnl}
                  isClosePending={closePending}
                  loading={openOrdersLoading}
                  onClosePosition={onClosePosition}
                  orders={openOrders}
                  pendingCloseOrderId={pendingCloseOrderId}
                />
              </TabsContent>

              <TabsContent value="all">
                <TradeHistory
                  compact
                  computeUnrealizedPnl={computeUnrealizedPnl}
                  errorMessage={closedOrdersErrorMessage}
                  loading={closedOrdersLoading}
                  onRetry={onRetryClosedOrders}
                  orders={closedOrders}
                  testId="mobile-trade-history"
                />
              </TabsContent>
            </Tabs>
          )}

          {(mobileSheet === "buy" || mobileSheet === "sell") && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-green-200 bg-green-50 p-2 text-center dark:border-green-700 dark:bg-green-950/30">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-300">Bid</p>
                  <p className="text-sm font-extrabold text-green-700 dark:text-green-300">{formatPrice(selectedPrice.bid)}</p>
                </div>
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-center dark:border-red-700 dark:bg-red-950/30">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">Ask</p>
                  <p className="text-sm font-extrabold text-red-700 dark:text-red-300">{formatPrice(selectedPrice.ask)}</p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Quantity
                </label>
                <input
                  type="number"
                  value={volume}
                  onChange={(event) => onVolumeChange(event.target.value)}
                  step="0.01"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-bold dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Leverage ({leverage}x)
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={leverage}
                  onChange={(event) => onLeverageChange(Number(event.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Slippage tolerance (%)
                </label>
                <input
                  type="number"
                  value={slippage}
                  onChange={(event) => onSlippageChange(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-bold dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Take profit
                </label>
                <input
                  type="number"
                  value={takeProfit}
                  onChange={(event) => onTakeProfitChange(event.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-bold dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Stop loss
                </label>
                <input
                  type="number"
                  value={stopLoss}
                  onChange={(event) => onStopLossChange(event.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-bold dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Available balance</span>
                  <span className="font-extrabold">{formatCurrency(accountBalance)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Estimated margin</span>
                  <span className="font-extrabold">{formatCurrency(selectedMarginEstimate)}</span>
                </div>
              </div>

              <button
                onClick={async () => {
                  const success = await onSubmitTrade(mobileSheet === "buy" ? "LONG" : "SHORT");
                  if (success) {
                    onDismiss();
                  }
                }}
                disabled={createPending}
                className={`w-full rounded-md py-3 text-sm font-extrabold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  mobileSheet === "buy" ? "bg-black dark:bg-white dark:text-black" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {createPending ? "Submitting..." : mobileSheet === "buy" ? "Confirm long" : "Confirm short"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
