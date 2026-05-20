import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/components/trading/formatters";
import type { TransactionRecord } from "@/hooks/useTrade";

interface TransactionHistoryTableProps {
  transactions: TransactionRecord[];
  loading: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}

function formatTransactionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTransactionType(type: TransactionRecord["type"]) {
  switch (type) {
    case "DEPOSIT":
      return "Deposit";
    case "WITHDRAWAL":
      return "Withdrawal";
    case "TRADE_PNL":
      return "Trade P&L";
    case "ADJUSTMENT":
      return "Adjustment";
    default:
      return type;
  }
}

function statusClasses(status: TransactionRecord["status"]) {
  switch (status) {
    case "COMPLETED":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300";
    case "PENDING":
      return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300";
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300";
    case "CANCELLED":
      return "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
    default:
      return "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function amountClasses(type: TransactionRecord["type"], amount: number) {
  if (type === "WITHDRAWAL" || amount < 0) {
    return "text-red-600 dark:text-red-300";
  }

  return "text-green-600 dark:text-green-300";
}

function renderAmount(transaction: TransactionRecord) {
  const sign = transaction.type === "WITHDRAWAL" || transaction.amount < 0 ? "-" : "+";
  return `${sign}${formatCurrency(Math.abs(transaction.amount))}`;
}

function formatDescription(desc: string) {
  if (!desc) return "";
  let clean = desc;
  clean = clean.replace(/Sandbox funding credited to the trading account\./gi, "Funds credited to trading balance.");
  clean = clean.replace(/Sandbox withdrawal booked against the trading account\./gi, "Withdrawal recorded from trading balance.");
  clean = clean.replace(/Sandbox/gi, "Trading");
  clean = clean.replace(/mock/gi, "trading");
  return clean;
}

export function TransactionHistoryTable({
  transactions,
  loading,
  errorMessage,
  onRetry,
}: TransactionHistoryTableProps) {
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [transactions]);

  return (
    <Card className="border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Transaction history
          </p>
          <p className="mt-1 text-sm font-extrabold">Funding and ledger activity</p>
        </div>
        <span className="rounded-full border border-gray-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:text-gray-300">
          {sortedTransactions.length} entries
        </span>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950/30">
          <p className="text-sm font-bold text-red-700 dark:text-red-200">Transaction history temporarily unavailable</p>
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
      ) : loading && sortedTransactions.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Refreshing transaction history...
        </p>
      ) : sortedTransactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-gray-600">
          <p className="text-sm font-bold">No transactions booked</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Deposits, withdrawals, and realized trading ledger activity will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile view: Transaction cards */}
          <div className="block md:hidden space-y-2">
            {sortedTransactions.map((transaction) => (
              <div key={transaction.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusClasses(transaction.status)}`}>
                      {transaction.status}
                    </span>
                    <p className="mt-1 font-bold text-xs">{formatTransactionType(transaction.type)}</p>
                  </div>
                  <p className={`font-extrabold text-sm ${amountClasses(transaction.type, transaction.amount)}`}>
                    {renderAmount(transaction)}
                  </p>
                </div>
                <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">{formatDescription(transaction.description)}</p>
                <div className="mt-2 flex justify-between items-center text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                  <span>Ref: {transaction.reference}</span>
                  <span>{formatTransactionDate(transaction.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view: Traditional table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="py-2 pr-4 font-bold">{formatTransactionDate(transaction.createdAt)}</td>
                    <td className="py-2 pr-4">{formatTransactionType(transaction.type)}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClasses(transaction.status)}`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-bold text-gray-600 dark:text-gray-300">{transaction.reference}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{formatDescription(transaction.description)}</td>
                    <td className={`py-2 text-right font-extrabold ${amountClasses(transaction.type, transaction.amount)}`}>
                      {renderAmount(transaction)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
