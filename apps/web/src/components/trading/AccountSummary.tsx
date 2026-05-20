import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatSignedCurrency } from "@/components/trading/formatters";

interface AccountSummaryProps {
  accountBalance: number | null;
  marginInUse: number;
  accountEquity?: number | null;
  totalUnrealizedPnl?: number;
  balanceLoading?: boolean;
  compact?: boolean;
  className?: string;
}

export function AccountSummary({
  accountBalance,
  marginInUse,
  accountEquity,
  totalUnrealizedPnl,
  balanceLoading = false,
  compact = false,
  className = "",
}: AccountSummaryProps) {
  if (compact) {
    return (
      <Card className={`border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 ${className}`}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Account summary
            </p>
            <p className="text-sm font-extrabold">Balance and margin</p>
          </div>
          <Activity className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {accountBalance !== null && accountBalance < 0 ? <span className="text-red-500">Account deficit</span> : "Available balance"}
            </p>
            <p className={`mt-1 font-extrabold ${accountBalance !== null && accountBalance < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
              {balanceLoading || accountBalance === null ? "Loading balance..." : formatCurrency(accountBalance)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Margin in use
            </p>
            <p className="mt-1 font-extrabold">{formatCurrency(marginInUse)}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
        Account metrics
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {accountBalance !== null && accountBalance < 0 ? <span className="text-red-500">Account deficit</span> : "Available balance"}
          </p>
          <p className={`mt-1 font-extrabold ${accountBalance !== null && accountBalance < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
            {balanceLoading || accountBalance === null ? "Loading balance..." : formatCurrency(accountBalance)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Margin in use
          </p>
          <p className="mt-1 font-extrabold">{formatCurrency(marginInUse)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Equity
          </p>
          <p className="mt-1 font-extrabold">
            {balanceLoading || accountEquity === null || accountEquity === undefined
              ? "Loading balance..."
              : formatCurrency(accountEquity)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Unrealized P&amp;L
          </p>
          <p
            className={`mt-1 font-extrabold ${
              (totalUnrealizedPnl ?? 0) >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatSignedCurrency(totalUnrealizedPnl)}
          </p>
        </div>
      </div>
    </Card>
  );
}
