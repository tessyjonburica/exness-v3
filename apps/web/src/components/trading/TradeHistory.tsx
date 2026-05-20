import { Card } from "@/components/ui/card";
import { TradeRecordRow } from "@/components/trading/TradeRecordRow";
import type { TradeRecord } from "@/components/trading/types";

interface TradeHistoryProps {
  orders: TradeRecord[];
  loading: boolean;
  computeUnrealizedPnl: (order: TradeRecord) => number | null;
  compact?: boolean;
  testId?: string;
  errorMessage?: string | null;
  onRetry?: () => void;
}

export function TradeHistory({
  orders,
  loading,
  computeUnrealizedPnl,
  compact = false,
  testId = "trade-history",
  errorMessage,
  onRetry,
}: TradeHistoryProps) {
  const errorState = errorMessage ? (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950/30">
      <p className="text-sm font-bold text-red-700 dark:text-red-200">Trade history temporarily unavailable</p>
      <p className="mt-1 text-xs text-red-600 dark:text-red-300">{errorMessage}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-300 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40"
        >
          Retry history
        </button>
      ) : null}
    </div>
  ) : null;

  if (compact) {
    return (
      <Card className="border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div data-testid={testId} />
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Trade history
            </p>
            <p className="text-sm font-extrabold">Closed activity</p>
          </div>
          <span className="rounded-full border border-gray-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:text-gray-300">
            {orders.length} booked
          </span>
        </div>

        {errorState ? (
          errorState
        ) : loading && orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Refreshing trade history...</p>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center dark:border-gray-600">
            <p className="text-sm font-bold">No trade history</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Closed positions will appear here once persistence completes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <TradeRecordRow
                key={order.id}
                compact
                order={order}
                unrealizedPnl={computeUnrealizedPnl(order)}
              />
            ))}
          </div>
        )}
      </Card>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div data-testid={testId}>
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Refreshing trade history...
        </p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div data-testid={testId}>
        {errorState ?? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-gray-600">
            <p className="text-sm font-bold">No closed trades booked</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Realized activity will appear here after a position is closed and persisted.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5" data-testid={testId}>
      {orders.map((order) => (
        <TradeRecordRow
          key={order.id}
          order={order}
          unrealizedPnl={computeUnrealizedPnl(order)}
        />
      ))}
    </div>
  );
}
