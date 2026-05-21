import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Moon, Sun, WalletCards } from "lucide-react";
import { toast } from "sonner";
import tradexLogo from "@/assets/tradex-logo.png";
import whiteLogo from "@/assets/whitelogo.png";
import { FundingForm } from "@/components/wallet/FundingForm";
import { TransactionHistoryTable } from "@/components/wallet/TransactionHistoryTable";
import { Card } from "@/components/ui/card";
import {
  formatCurrency,
  safeNumber,
} from "@/components/trading/formatters";
import { getUserEmail, isAuthenticated, useLogout } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  TransactionRecord,
  useBalance,
  useMockDeposit,
  useMockWithdrawal,
  useTransactions,
} from "@/hooks/useTrade";
import { getApiErrorMessage, getApiStatus } from "@/lib/api-errors";

type BalanceResponse = {
  balance?: number;
};

type TransactionsResponse = {
  transactions?: TransactionRecord[];
};

function truncateEmail(email: string | null) {
  if (!email) return "user@example.com";
  const [localPart, domain] = email.split("@");
  if (!domain || localPart.length <= 3) return email;
  return `${localPart.substring(0, 3)}...@${domain}`;
}

function toastTitle(text: string) {
  return <span data-testid="wallet-toast-title">{text}</span>;
}

function toastDescription(text: string) {
  return <span data-testid="wallet-toast-description">{text}</span>;
}

export default function WalletPage() {
  const navigate = useNavigate();
  const logout = useLogout();
  const { theme, toggleTheme } = useTheme();
  const balanceQuery = useBalance();
  const transactionsQuery = useTransactions();
  const depositMutation = useMockDeposit();
  const withdrawalMutation = useMockWithdrawal();
  const [depositAmount, setDepositAmount] = useState("1000");
  const [depositDescription, setDepositDescription] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("250");
  const [withdrawalDescription, setWithdrawalDescription] = useState("");
  const transactionToastCacheRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/signin");
    }
  }, [navigate]);

  const accountBalance = safeNumber((balanceQuery.data as BalanceResponse | undefined)?.balance);
  const balanceLoading = balanceQuery.isPending && accountBalance === null;
  const resolvedAccountBalance = accountBalance ?? 0;
  const transactions = useMemo(
    () => Array.isArray((transactionsQuery.data as TransactionsResponse | undefined)?.transactions)
      ? ((transactionsQuery.data as TransactionsResponse | undefined)?.transactions ?? [])
      : [],
    [transactionsQuery.data]
  );

  const transactionErrorMessage =
    transactionsQuery.isError && !transactionsQuery.isFetching && transactions.length === 0
      ? getApiStatus(transactionsQuery.error) === 401
        ? "Your session expired before ledger activity could be loaded. Sign in again to continue."
        : getApiErrorMessage(
            transactionsQuery.error,
            "Funding activity could not be refreshed right now. Retry when the connection stabilizes."
          )
      : null;

  useEffect(() => {
    if (transactionsQuery.isSuccess) {
      transactionToastCacheRef.current = null;
    }
  }, [transactionsQuery.isSuccess]);

  useEffect(() => {
    if (!transactionErrorMessage) {
      return;
    }

    if (transactionToastCacheRef.current === transactionErrorMessage) {
      return;
    }

    transactionToastCacheRef.current = transactionErrorMessage;
    toast.error(toastTitle("Transaction history unavailable"), {
      description: toastDescription(transactionErrorMessage),
    });
  }, [transactionErrorMessage]);

  const handleDeposit = async () => {
    const amount = safeNumber(depositAmount);
    if (amount === null || amount <= 0) {
      toast.error(toastTitle("Invalid deposit amount"), {
        description: toastDescription("Amount must be greater than zero."),
      });
      return;
    }

    try {
      const response = await depositMutation.mutateAsync({
        amount,
        currency: "USD",
        method: "Account Transfer",
        accountLabel: "Primary trading account",
        description: depositDescription || "Funds credited to trading balance.",
      });

      setDepositDescription("");
      toast.success(toastTitle("Deposit completed"), {
        description: toastDescription(
          `${formatCurrency(response.balance)} is now available after funding reference ${response.transaction.reference}.`
        ),
      });
    } catch (error) {
      toast.error(toastTitle("Deposit could not be completed"), {
        description: toastDescription(
          getApiErrorMessage(
            error,
            "Funds could not be added to the account at this time."
          )
        ),
      });
    }
  };

  const handleWithdrawal = async () => {
    const amount = safeNumber(withdrawalAmount);
    if (amount === null || amount <= 0) {
      toast.error(toastTitle("Invalid withdrawal amount"), {
        description: toastDescription("Amount must be greater than zero."),
      });
      return;
    }

    try {
      const response = await withdrawalMutation.mutateAsync({
        amount,
        currency: "USD",
        method: "Account Transfer",
        accountLabel: "Primary trading account",
        description: withdrawalDescription || "Withdrawal recorded from trading balance.",
      });

      setWithdrawalDescription("");
      toast.success(toastTitle("Withdrawal completed"), {
        description: toastDescription(
          `${formatCurrency(response.balance)} remains available after withdrawal reference ${response.transaction.reference}.`
        ),
      });
    } catch (error) {
      const status = getApiStatus(error);
      const fallback =
        status === 422
          ? "Amount exceeds available funds."
          : "Withdrawal could not be completed at this time.";
      toast.error(toastTitle(status === 422 ? "Insufficient available funds" : "Withdrawal could not be completed"), {
        description: toastDescription(getApiErrorMessage(error, fallback)),
      });
    }
  };

  return (
    <div className="min-h-screen bg-white text-black transition-colors dark:bg-gray-900 dark:text-white">
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-3 py-3 lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/trade" className="flex items-center gap-2">
              <img src={theme === "dark" ? whiteLogo : tradexLogo} alt="Trade X" className="h-6 lg:h-7" />
            </Link>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <Link
              to="/trade"
              className="hidden rounded-md border border-gray-200 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 md:inline-flex"
            >
              Back to trade
            </Link>

            <div className="hidden rounded-lg border border-gray-200 px-3 py-2 text-right dark:border-gray-700 md:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Available funds
              </p>
              <p className="text-sm font-extrabold">
                {balanceLoading ? "Loading balance..." : formatCurrency(resolvedAccountBalance)}
              </p>
            </div>

            <button
              onClick={toggleTheme}
              className="rounded-full border border-gray-200 p-2 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              onClick={logout}
              className="rounded-md border border-gray-200 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-3 py-4 lg:px-5 lg:py-5">
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Account funding
                  </p>
                  <h1 className="mt-1 text-xl font-extrabold">Wallet</h1>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    These entries update your available trading funds.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600 dark:border-gray-600 dark:text-gray-300">
                  <WalletCards className="h-3.5 w-3.5" />
                  Active
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Account balance
                  </p>
                  <p className="mt-2 text-2xl font-extrabold">
                    {balanceLoading ? "Loading balance..." : formatCurrency(resolvedAccountBalance)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Account holder
                  </p>
                  <p className="mt-2 text-sm font-extrabold">{truncateEmail(getUserEmail())}</p>
                </div>
              </div>
            </Card>

            <FundingForm
              title="Add Funds"
              subtitle="Credit your account"
              amount={depositAmount}
              description={depositDescription}
              helperLabel="Funds post immediately to the trading balance."
              onAmountChange={setDepositAmount}
              onDescriptionChange={setDepositDescription}
              onSubmit={() => void handleDeposit()}
              pending={depositMutation.isPending}
              pendingLabel="Processing..."
              submitLabel="Add Funds"
            />

            <FundingForm
              title="Withdraw Funds"
              subtitle="Debit your account"
              amount={withdrawalAmount}
              description={withdrawalDescription}
              helperLabel="Available funds must cover the full withdrawal request."
              onAmountChange={setWithdrawalAmount}
              onDescriptionChange={setWithdrawalDescription}
              onSubmit={() => void handleWithdrawal()}
              pending={withdrawalMutation.isPending}
              pendingLabel="Processing..."
              submitLabel="Submit Withdrawal"
            />
          </div>

          <TransactionHistoryTable
            transactions={transactions}
            loading={transactionsQuery.isLoading}
            errorMessage={transactionErrorMessage}
            onRetry={() => void transactionsQuery.refetch()}
          />
        </div>
      </main>
    </div>
  );
}
