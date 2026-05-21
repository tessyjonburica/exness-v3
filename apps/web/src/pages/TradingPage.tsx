import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  Clock3,
  LogOut,
  Moon,
  Sun,
  User,
  Wifi,
  WalletCards,
} from "lucide-react";
import tradexLogo from "@/assets/tradex-logo.png";
import whiteLogo from "@/assets/whitelogo.png";
import { TradingChart } from "@/components/TradingChart";
import { AccountSummary } from "@/components/trading/AccountSummary";
import { MARKET_DEFINITIONS, TIMEFRAMES } from "@/components/trading/constants";
import {
  formatAssetLabel,
  formatCurrency,
  getEntryPrice,
  mapAssetToSymbol,
  safeNumber,
} from "@/components/trading/formatters";
import { MarketCommentary } from "@/components/trading/MarketCommentary";
import { MobileOrderSheet } from "@/components/trading/MobileOrderSheet";
import { OrderTicket } from "@/components/trading/OrderTicket";
import { PositionsTable } from "@/components/trading/PositionsTable";
import { SymbolHeader } from "@/components/trading/SymbolHeader";
import { TradeHistory } from "@/components/trading/TradeHistory";
import type {
  CommentaryCard,
  MobileSheet,
  OrdersTab,
  Timeframe,
  TradeRecord,
  TradeSide,
} from "@/components/trading/types";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserEmail, isAuthenticated, useLogout } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  useBalance,
  useCloseOrder,
  useClosedOrders,
  useCreateOrder,
  useOpenOrders,
} from "@/hooks/useTrade";
import { getApiErrorMessage, getApiStatus } from "@/lib/api-errors";
import { processPriceTick } from "@/lib/candlestick-store";
import type { PriceData } from "@/lib/price-store";
import { useWebSocket, type WebSocketFeedStatus } from "@/hooks/useWebSocket";

type OrdersResponse = {
  orders?: TradeRecord[];
};

type BalanceResponse = {
  balance?: number;
};

function readOrders(data: OrdersResponse | undefined): TradeRecord[] {
  return Array.isArray(data?.orders) ? data.orders : [];
}

function truncateEmail(email: string | null) {
  if (!email) return "user@example.com";
  const [localPart, domain] = email.split("@");
  if (!domain || localPart.length <= 3) return email;
  return `${localPart.substring(0, 3)}...@${domain}`;
}

function toastTitle(text: string) {
  return <span data-testid="trade-toast-title">{text}</span>;
}

function toastDescription(text: string) {
  return <span data-testid="trade-toast-description">{text}</span>;
}

const TradingPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [ordersTab, setOrdersTab] = useState<OrdersTab>("open");
  const [selectedCrypto, setSelectedCrypto] = useState("BTC");
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1m");
  const [leverage, setLeverage] = useState(1);
  const [volume, setVolume] = useState("0.01");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);
  const [pendingCloseOrderId, setPendingCloseOrderId] = useState<string | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [priceFeedStatus, setPriceFeedStatus] = useState<WebSocketFeedStatus>("connecting");
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const queryToastCacheRef = useRef<Record<string, string>>({});
  const priceFeedToastCacheRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/signin");
    }
  }, [navigate]);

  const balanceQuery = useBalance();
  const openOrdersQuery = useOpenOrders();
  const closedOrdersQuery = useClosedOrders();
  const createOrder = useCreateOrder();
  const closeOrder = useCloseOrder();
  const logout = useLogout();

  useWebSocket(
    (msg) => {
      setPrices((prev) => {
        const current = prev[msg.symbol] || { ask: 0, bid: 0, time: Date.now() };
        const nextPrices = {
          ...prev,
          [msg.symbol]: {
            ask: msg.type === "ASK" ? msg.price : current.ask,
            bid: msg.type === "BID" ? msg.price : current.bid,
            time: msg.time,
          },
        };

        const symbolPrices = nextPrices[msg.symbol];
        if (symbolPrices.ask > 0 && symbolPrices.bid > 0) {
          processPriceTick({
            ...msg,
            price: (symbolPrices.ask + symbolPrices.bid) / 2,
          });
        }

        return nextPrices;
      });
    },
    setPriceFeedStatus
  );

  const openOrders = useMemo(() => readOrders(openOrdersQuery.data as OrdersResponse | undefined), [openOrdersQuery.data]);
  const closedOrders = useMemo(
    () => readOrders(closedOrdersQuery.data as OrdersResponse | undefined),
    [closedOrdersQuery.data]
  );

  const accountBalance = safeNumber((balanceQuery.data as BalanceResponse | undefined)?.balance);
  const balanceLoading = balanceQuery.isPending && accountBalance === null;
  const resolvedAccountBalance = accountBalance ?? 0;
  const selectedMarket = MARKET_DEFINITIONS.find((market) => market.symbol === selectedCrypto) ?? MARKET_DEFINITIONS[0];
  const selectedPrice = prices[selectedMarket.wsSymbol] || { ask: 0, bid: 0, time: 0 };
  const selectedMidPrice =
    selectedPrice.ask > 0 && selectedPrice.bid > 0
      ? (selectedPrice.ask + selectedPrice.bid) / 2
      : safeNumber(selectedPrice.ask) ?? safeNumber(selectedPrice.bid) ?? 0;

  const spreadValue =
    selectedPrice.ask > 0 && selectedPrice.bid > 0 ? selectedPrice.ask - selectedPrice.bid : null;
  const spreadPercent =
    spreadValue !== null && selectedMidPrice > 0 ? (spreadValue / selectedMidPrice) * 100 : null;

  const parsedVolume = safeNumber(volume);
  const inputSlippage = safeNumber(slippage);
  const buyMarginEstimate =
    parsedVolume !== null && parsedVolume > 0 && selectedPrice.ask > 0
      ? (parsedVolume * selectedPrice.ask) / leverage
      : null;
  const sellMarginEstimate =
    parsedVolume !== null && parsedVolume > 0 && selectedPrice.bid > 0
      ? (parsedVolume * selectedPrice.bid) / leverage
      : null;
  const selectedMarginEstimate = mobileSheet === "sell" ? sellMarginEstimate : buyMarginEstimate;
  const workingNotional =
    parsedVolume !== null && parsedVolume > 0 && selectedMidPrice > 0 ? parsedVolume * selectedMidPrice : null;

  const computeUnrealizedPnl = useCallback(
    (order: TradeRecord): number | null => {
      const entryPrice = getEntryPrice(order);
      if (!order.asset || entryPrice === null) return null;

      const symbol = mapAssetToSymbol(order.asset);
      const livePrice = prices[symbol];
      if (!livePrice || !livePrice.ask || !livePrice.bid) return null;

      const quantity = safeNumber(order.quantity);
      if (quantity === null || quantity <= 0) return null;

      const direction = order.side === "LONG" ? 1 : -1;
      const closePrice = order.side === "LONG" ? livePrice.bid : livePrice.ask;
      return direction * (closePrice - entryPrice) * quantity;
    },
    [prices]
  );

  const marginInUse = useMemo(
    () => openOrders.reduce((sum, order) => sum + (safeNumber(order.margin) ?? 0), 0),
    [openOrders]
  );
  const totalUnrealizedPnl = useMemo(
    () => openOrders.reduce((sum, order) => sum + (computeUnrealizedPnl(order) ?? 0), 0),
    [computeUnrealizedPnl, openOrders]
  );
  const accountEquity =
    accountBalance === null ? null : accountBalance + marginInUse + totalUnrealizedPnl;
  const closedOrdersErrorMessage =
    closedOrdersQuery.isError && !closedOrdersQuery.isFetching && closedOrders.length === 0
      ? getApiStatus(closedOrdersQuery.error) === 401
        ? "Your trading session has expired. Sign in again to recover persisted history."
        : getApiErrorMessage(
            closedOrdersQuery.error,
            "Persisted trade activity could not be refreshed right now. Retry when the connection stabilizes."
          )
      : null;

  const sessionStatus =
    selectedPrice.time > 0 || priceFeedStatus === "active"
      ? "Price feed active"
      : priceFeedStatus === "connected"
        ? "Price feed connected"
        : priceFeedStatus === "disconnected"
          ? "Price feed disconnected"
          : "Price feed connecting";
  const volatilityLabel =
    spreadPercent === null
      ? "Volatility signal pending"
      : spreadPercent > 0.4
        ? "Elevated spread conditions. Trade sizing should stay disciplined."
        : spreadPercent > 0.15
          ? "Moderate spread expansion. Monitor execution quality closely."
          : "Spread conditions remain contained across the selected instrument.";

  const commentaryCards: CommentaryCard[] = [
    {
      title: "Feed status",
      value: selectedPrice.time > 0 || priceFeedStatus === "active" ? "Active" : "Pending",
      body: selectedPrice.time > 0 ? "Executable bid and ask pricing available." : "Waiting for executable pricing.",
      accent: "border-l-4 border-black dark:border-white",
      icon: Wifi,
    },
    {
      title: "Volatility",
      value:
        spreadPercent === null ? "Pending" : spreadPercent > 0.4 ? "Elevated" : spreadPercent > 0.15 ? "Moderate" : "Contained",
      body: volatilityLabel,
      accent: "border-l-4 border-gray-400 dark:border-gray-500",
      icon: Activity,
    },
    {
      title: "Spread condition",
      value: spreadPercent === null ? "Pending" : `${spreadPercent.toFixed(3)}%`,
      body:
        spreadPercent === null
          ? "Spread check pending."
          : spreadPercent > 0.15
            ? "Spread is widening. Monitor execution quality."
            : "Spread remains stable for the selected market.",
      accent: "border-l-4 border-gray-300 dark:border-gray-600",
      icon: Activity,
    },
    {
      title: "Session",
      value: "24/7",
      body: `${sessionStatus}. Margin and slippage still govern execution quality.`,
      accent: "border-l-4 border-gray-300 dark:border-gray-600",
      icon: Clock3,
    },
  ];

  const notifyQueryError = useCallback(
    (key: string, error: unknown, title: string, fallback: string) => {
      if (!error) return;

      const status = getApiStatus(error);
      const description =
        status === 401
          ? "Your trading session has expired. Please sign in again to continue."
          : getApiErrorMessage(error, fallback);
      const signature = `${status ?? "na"}:${description}`;

      if (queryToastCacheRef.current[key] === signature) {
        return;
      }

      queryToastCacheRef.current[key] = signature;
      toast.error(toastTitle(title), { description: toastDescription(description) });

      if (status === 401) {
        setSessionExpiredMessage("Session expired. Redirecting to sign in.");
        window.setTimeout(() => navigate("/signin"), 900);
      }
    },
    [navigate]
  );

  useEffect(() => {
    if (balanceQuery.error) {
      notifyQueryError(
        "balance",
        balanceQuery.error,
        "Account summary unavailable",
        "Balance data could not be refreshed. Trading controls remain available while the platform retries."
      );
    }
  }, [balanceQuery.error, notifyQueryError]);

  useEffect(() => {
    if (openOrdersQuery.error) {
      notifyQueryError(
        "open-orders",
        openOrdersQuery.error,
        "Open positions unavailable",
        "Active position data could not be refreshed. The blotter will update automatically when the request recovers."
      );
    }
  }, [notifyQueryError, openOrdersQuery.error]);

  useEffect(() => {
    if (closedOrdersQuery.isSuccess) {
      delete queryToastCacheRef.current["closed-orders"];
    }
  }, [closedOrdersQuery.isSuccess]);

  useEffect(() => {
    if (closedOrdersQuery.error && !closedOrdersQuery.isFetching && closedOrders.length === 0) {
      notifyQueryError(
        "closed-orders",
        closedOrdersQuery.error,
        "Trade history unavailable",
        "Closed trade history could not be refreshed. Persisted activity will reappear once the request succeeds."
      );
    }
  }, [closedOrders.length, closedOrdersQuery.error, closedOrdersQuery.isFetching, notifyQueryError]);

  useEffect(() => {
    if (selectedPrice.time > 0) {
      priceFeedToastCacheRef.current = null;
      return;
    }

    const timeout = window.setTimeout(() => {
      if (
        selectedPrice.time > 0 ||
        priceFeedStatus === "active" ||
        priceFeedToastCacheRef.current === selectedCrypto
      ) {
        return;
      }

      priceFeedToastCacheRef.current = selectedCrypto;
      toast.warning("Live price feed delayed", {
        description: toastDescription(
          `${selectedCrypto}/USD pricing has not initialized yet. Order entry will activate automatically when executable bid and ask prices are received.`
        ),
      });
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [priceFeedStatus, selectedCrypto, selectedPrice.time]);

  const handleTrade = async (side: TradeSide) => {
    const asset = `${selectedCrypto}_USDC`;
    const executionPrice = side === "LONG" ? selectedPrice.ask : selectedPrice.bid;
    const estimatedMargin = side === "LONG" ? buyMarginEstimate : sellMarginEstimate;

    if (!executionPrice || executionPrice <= 0) {
      toast.error("Executable price unavailable", {
        description: toastDescription(
          "Live bid and ask pricing has not been received yet. Wait for the price feed before submitting the order ticket."
        ),
      });
      return false;
    }

    if (parsedVolume === null || parsedVolume <= 0) {
      toast.error("Invalid order size", {
        description: toastDescription("Enter a valid quantity before submitting the order ticket."),
      });
      return false;
    }

    if (inputSlippage === null || inputSlippage < 0) {
      toast.error("Invalid slippage tolerance", {
        description: toastDescription("Slippage tolerance must be zero or greater."),
      });
      return false;
    }

    if (balanceLoading) {
      toast.warning("Loading balance", {
        description: toastDescription(
          "Account balance is still synchronizing. Wait a moment before submitting the order ticket."
        ),
      });
      return false;
    }

    if (estimatedMargin !== null && estimatedMargin > resolvedAccountBalance) {
      toast.error("Insufficient available balance", {
        description: toastDescription(
          `Initial margin is estimated at ${formatCurrency(estimatedMargin)} while available balance is ${formatCurrency(resolvedAccountBalance)}.`
        ),
      });
      return false;
    }

    try {
      const response = await createOrder.mutateAsync({
        asset,
        side,
        quantity: parsedVolume,
        leverage,
        tradeOpeningPrice: executionPrice,
        stopLoss: stopLoss ? Number(stopLoss) : undefined,
        takeProfit: takeProfit ? Number(takeProfit) : undefined,
        slippage: inputSlippage,
      });

      setTakeProfit("");
      setStopLoss("");

      toast.success(toastTitle(`${side === "LONG" ? "Long" : "Short"} position opened`), {
        description: toastDescription(
          `${selectedCrypto}/USD exposure is now live. Estimated initial margin reserved: ${formatCurrency(response?.trade?.margin ?? estimatedMargin)}.`
        ),
      });
      return true;
    } catch (error: unknown) {
      const status = getApiStatus(error);
      if (status === 401) {
        setSessionExpiredMessage("Session expired. Redirecting to sign in.");
      }
      toast.error(toastTitle(status === 401 ? "Session expired" : "Order rejected"), {
        description:
          status === 401
            ? toastDescription("Your trading session has expired. Sign in again to continue placing orders.")
            : toastDescription(
                getApiErrorMessage(
                  error,
                  "The order could not be submitted with the current trading parameters."
                )
              ),
      });

      if (status === 401) {
        window.setTimeout(() => navigate("/signin"), 900);
      }

      return false;
    }
  };

  const handleClosePosition = async (order: TradeRecord) => {
    setPendingCloseOrderId(order.id);

    try {
      await closeOrder.mutateAsync({ orderId: order.id });
      toast.success(toastTitle("Position closed"), {
        description: toastDescription(
          `${formatAssetLabel(order.asset)} has been closed. Realized P&L and available balance have been updated.`
        ),
      });
    } catch (error: unknown) {
      const status = getApiStatus(error);
      if (status === 401) {
        setSessionExpiredMessage("Session expired. Redirecting to sign in.");
      }
      toast.error(toastTitle(status === 401 ? "Session expired" : "Close request failed"), {
        description:
          status === 401
            ? toastDescription("Your trading session has expired. Sign in again to continue managing positions.")
            : toastDescription(getApiErrorMessage(error, "The position could not be closed at this time.")),
      });

      if (status === 401) {
        window.setTimeout(() => navigate("/signin"), 900);
      }
    } finally {
      setPendingCloseOrderId(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black transition-colors dark:bg-gray-900 dark:text-white">
      <div className="flex min-h-screen flex-col overflow-x-hidden">
        <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-3 py-3 lg:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/trade" className="flex items-center gap-2">
                <img src={theme === "dark" ? whiteLogo : tradexLogo} alt="Trade X" className="h-6 lg:h-7" />
              </Link>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <Link
                to="/wallet"
                className="rounded-full border border-gray-200 p-2 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                aria-label="Wallet"
              >
                <WalletCards className="h-5 w-5 lg:h-4 lg:w-4" />
              </Link>

              <div className="hidden rounded-lg border border-gray-200 px-3 py-2 text-right dark:border-gray-700 md:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Available balance
                </p>
                <p className="text-sm font-extrabold" data-testid="balance-summary">
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

              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown((current) => !current)}
                  className="rounded-full border border-gray-200 p-2 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                  aria-label="Account options"
                >
                  <User className="h-5 w-5" />
                </button>

                {showUserDropdown ? (
                  <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <div className="border-b border-gray-200 p-3 dark:border-gray-700">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Account
                      </p>
                      <p className="truncate text-sm font-extrabold">{truncateEmail(getUserEmail())}</p>
                    </div>
                    <button
                      onClick={() => logout()}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm font-extrabold text-red-600 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <LogOut className="h-4 w-4" />
                      LOG OUT
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-2 pb-6 pt-2 sm:px-3 lg:px-4 lg:pt-3">
          <SymbolHeader
            accountEquity={accountEquity}
            markets={MARKET_DEFINITIONS}
            onSelectCrypto={setSelectedCrypto}
            onSelectTimeframe={setSelectedTimeframe}
            prices={prices}
            selectedCrypto={selectedCrypto}
            selectedMidPrice={selectedMidPrice}
            selectedTimeframe={selectedTimeframe}
            sessionStatus={sessionStatus}
            spreadValue={spreadValue}
            timeframes={TIMEFRAMES}
            totalUnrealizedPnl={totalUnrealizedPnl}
          />

          <div className="mt-3 grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex min-w-0 flex-col">
              {sessionExpiredMessage ? (
                <div
                  data-testid="session-expired-status"
                  className="mb-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-100"
                >
                  {sessionExpiredMessage}
                </div>
              ) : null}
              <div className="flex flex-col gap-3 lg:flex-1">
                <Card className="h-[320px] overflow-hidden border-gray-200 bg-white p-0 shadow-sm dark:border-gray-700 dark:bg-slate-950 sm:h-[360px] md:h-[400px] lg:h-[430px] xl:h-[470px]">
                  <TradingChart symbol={selectedMarket.wsSymbol} interval={selectedTimeframe} />
                </Card>

              <div className="mt-3 grid gap-3 lg:hidden">
                <AccountSummary
                  accountBalance={accountBalance}
                  accountEquity={accountEquity}
                  balanceLoading={balanceLoading}
                  compact
                  marginInUse={marginInUse}
                  totalUnrealizedPnl={totalUnrealizedPnl}
                />
                <MarketCommentary cards={commentaryCards} compact />
              </div>

              <div className="mt-3 lg:hidden">
                <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setMobileSheet("orders")}
                    className="border-r border-gray-200 bg-white px-3 py-3 text-xs font-extrabold uppercase tracking-wide dark:border-gray-700 dark:bg-gray-900"
                  >
                    Positions
                  </button>
                  <button
                    onClick={() => setMobileSheet("buy")}
                    className="bg-black px-3 py-3 text-xs font-extrabold uppercase tracking-wide text-white dark:bg-white dark:text-black"
                  >
                    Long
                  </button>
                  <button
                    onClick={() => setMobileSheet("sell")}
                    className="border-l border-gray-200 bg-white px-3 py-3 text-xs font-extrabold uppercase tracking-wide dark:border-gray-700 dark:bg-gray-900"
                  >
                    Short
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-3 lg:hidden">
                <PositionsTable
                  compact
                  computeUnrealizedPnl={computeUnrealizedPnl}
                  isClosePending={closeOrder.isPending}
                  loading={openOrdersQuery.isLoading}
                  onClosePosition={handleClosePosition}
                  orders={openOrders}
                  pendingCloseOrderId={pendingCloseOrderId}
                  testId="mobile-positions-table"
                />
                <TradeHistory
                  compact
                  computeUnrealizedPnl={computeUnrealizedPnl}
                  errorMessage={closedOrdersErrorMessage}
                  loading={closedOrdersQuery.isLoading}
                  onRetry={() => void closedOrdersQuery.refetch()}
                  orders={closedOrders}
                  testId="mobile-trade-history"
                />
              </div>

                <Card className="mt-3 hidden border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:block">
                  <Tabs value={ordersTab} onValueChange={(value) => setOrdersTab(value as OrdersTab)}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                          Positions and history
                        </p>
                        <p className="text-sm font-extrabold">Position blotter</p>
                      </div>
                      <TabsList className="h-auto justify-start bg-transparent p-0">
                        <TabsTrigger
                          value="open"
                          data-testid="positions-tab-open"
                          className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-extrabold uppercase tracking-wide data-[state=active]:border-black data-[state=active]:bg-transparent dark:data-[state=active]:border-white"
                        >
                          Open positions ({openOrders.length})
                        </TabsTrigger>
                        <TabsTrigger
                          value="all"
                          data-testid="positions-tab-history"
                          className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-extrabold uppercase tracking-wide data-[state=active]:border-black data-[state=active]:bg-transparent dark:data-[state=active]:border-white"
                        >
                          Trade history ({closedOrders.length})
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="open" className="mt-3">
                      <PositionsTable
                        computeUnrealizedPnl={computeUnrealizedPnl}
                        isClosePending={closeOrder.isPending}
                        loading={openOrdersQuery.isLoading}
                        onClosePosition={handleClosePosition}
                        orders={openOrders}
                        pendingCloseOrderId={pendingCloseOrderId}
                        testId="desktop-positions-table"
                      />
                    </TabsContent>

                    <TabsContent value="all" className="mt-3">
                      <TradeHistory
                        computeUnrealizedPnl={computeUnrealizedPnl}
                        errorMessage={closedOrdersErrorMessage}
                        loading={closedOrdersQuery.isLoading}
                        onRetry={() => void closedOrdersQuery.refetch()}
                        orders={closedOrders}
                        testId="desktop-trade-history"
                      />
                    </TabsContent>
                  </Tabs>
                </Card>
              </div>
            </div>

            <aside className="hidden min-w-0 lg:block">
              <div className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
                <AccountSummary
                  accountBalance={accountBalance}
                  accountEquity={accountEquity}
                  balanceLoading={balanceLoading}
                  marginInUse={marginInUse}
                  totalUnrealizedPnl={totalUnrealizedPnl}
                />
                <OrderTicket
                  askPrice={selectedPrice.ask}
                  bidPrice={selectedPrice.bid}
                  buyMarginEstimate={buyMarginEstimate}
                  createPending={createOrder.isPending}
                  leverage={leverage}
                  onLeverageChange={setLeverage}
                  onSlippageChange={setSlippage}
                  onStopLossChange={setStopLoss}
                  onSubmit={handleTrade}
                  onTakeProfitChange={setTakeProfit}
                  onVolumeChange={setVolume}
                  selectedCrypto={selectedCrypto}
                  sellMarginEstimate={sellMarginEstimate}
                  slippage={slippage}
                  stopLoss={stopLoss}
                  takeProfit={takeProfit}
                  volume={volume}
                  workingNotional={workingNotional}
                />
                <MarketCommentary cards={commentaryCards} compact />
              </div>
            </aside>
          </div>
        </div>

        <MobileOrderSheet
          accountBalance={accountBalance}
          closedOrders={closedOrders}
          closePending={closeOrder.isPending}
          closedOrdersErrorMessage={closedOrdersErrorMessage}
          closedOrdersLoading={closedOrdersQuery.isLoading}
          computeUnrealizedPnl={computeUnrealizedPnl}
          createPending={createOrder.isPending}
          leverage={leverage}
          mobileSheet={mobileSheet}
          onClosePosition={handleClosePosition}
          onDismiss={() => setMobileSheet(null)}
          onLeverageChange={setLeverage}
          onOrdersTabChange={setOrdersTab}
          onRetryClosedOrders={() => void closedOrdersQuery.refetch()}
          onSlippageChange={setSlippage}
          onStopLossChange={setStopLoss}
          onSubmitTrade={handleTrade}
          onTakeProfitChange={setTakeProfit}
          onVolumeChange={setVolume}
          openOrders={openOrders}
          openOrdersLoading={openOrdersQuery.isLoading}
          ordersTab={ordersTab}
          pendingCloseOrderId={pendingCloseOrderId}
          selectedMarginEstimate={selectedMarginEstimate}
          selectedPrice={{ ask: selectedPrice.ask, bid: selectedPrice.bid }}
          slippage={slippage}
          stopLoss={stopLoss}
          takeProfit={takeProfit}
          volume={volume}
        />
      </div>
    </div>
  );
};

export default TradingPage;
