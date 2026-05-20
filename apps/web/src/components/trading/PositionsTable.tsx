import { Card } from "@/components/ui/card";
import { TradeRecordRow } from "@/components/trading/TradeRecordRow";
import type { TradeRecord } from "@/components/trading/types";

interface PositionsTableProps {
  orders: TradeRecord[];
  loading: boolean;
  onClosePosition: (order: TradeRecord) => void;
  pendingCloseOrderId: string | null;
  isClosePending: boolean;
  computeUnrealizedPnl: (order: TradeRecord) => number | null;
  compact?: boolean;
  testId?: string;
}

export function PositionsTable({
  orders,
  loading,
  onClosePosition,
  pendingCloseOrderId,
  isClosePending,
  computeUnrealizedPnl,
  compact = false,
  testId = "positions-table",
}: PositionsTableProps) {
  const rows = (
    <div className="space-y-3">
      {orders.map((order) => (
        <TradeRecordRow
          key={order.id}
          compact={compact}
          isClosing={isClosePending && pendingCloseOrderId === order.id}
          onClosePosition={onClosePosition}
          order={order}
          unrealizedPnl={computeUnrealizedPnl(order)}
        />
      ))}
    </div>
  );

  if (compact) {
    return (
      <Card className="border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div data-testid={testId} />
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Open positions
            </p>
            <p className="text-sm font-extrabold">Active exposure</p>
          </div>
          <span className="rounded-full border border-gray-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:text-gray-300">
            {orders.length} live
          </span>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Refreshing open positions...
          </p>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center dark:border-gray-600">
            <p className="text-sm font-bold">No open positions</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Live exposure will appear here after an order is executed.
            </p>
          </div>
        ) : (
          rows
        )}
      </Card>
    );
  }

  return (
    <div className="h-full" data-testid={testId}>
      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Refreshing open positions...
        </p>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center dark:border-gray-600">
          <p className="text-sm font-bold">No open positions</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Executed exposure will populate the blotter once a position is opened.
          </p>
        </div>
      ) : (
        rows
      )}
    </div>
  );
}
