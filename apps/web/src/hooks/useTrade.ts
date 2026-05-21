import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { getApiStatus } from "@/lib/api-errors";
import { readStoredSession } from "@/hooks/useAuth";

interface CreateOrderData {
  asset: string;
  side: "LONG" | "SHORT";
  quantity: number;
  leverage: number;
  tradeOpeningPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  slippage: number;
}

interface CloseOrderData {
  orderId: string;
}

interface MockFundingData {
  amount: number;
  currency?: string;
  method?: string;
  accountLabel?: string;
  description?: string;
}

type BalanceResponse = {
  balance?: number;
};

type OrderMutationResponse = {
  balance?: number;
};

function getBalanceQueryKey() {
  const { userEmail } = readStoredSession();
  return ["balance", userEmail] as const;
}

function setBalanceCache(queryClient: QueryClient, nextBalance: number | undefined) {
  if (typeof nextBalance !== "number") {
    return;
  }

  queryClient.setQueryData(getBalanceQueryKey(), { balance: nextBalance } satisfies BalanceResponse);
}

export interface TransactionRecord {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRADE_PNL" | "ADJUSTMENT";
  status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
  amount: number;
  currency: string;
  reference: string;
  description: string;
  method?: string | null;
  provider?: string | null;
  accountLabel?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOrderData) => {
      const response = await api.post("/trade/create-order", data);
      return response.data;
    },
    onSuccess: async (data: OrderMutationResponse) => {
      setBalanceCache(queryClient, data.balance);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["openOrders"] }),
        queryClient.invalidateQueries({ queryKey: ["balance"] }),
      ]);

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["openOrders"], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["balance"], type: "active" }),
      ]);
    },
  });
}

export function useCloseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CloseOrderData) => {
      const response = await api.post("/trade/close-order", data);
      return response.data;
    },
    onSuccess: async (data: OrderMutationResponse) => {
      setBalanceCache(queryClient, data.balance);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["openOrders"] }),
        queryClient.invalidateQueries({ queryKey: ["closedOrders"] }),
        queryClient.invalidateQueries({ queryKey: ["balance"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["openOrders"], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["closedOrders"], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["balance"], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["transactions"], type: "active" }),
      ]);
    },
  });
}

export function useOpenOrders() {
  const { token, userEmail } = readStoredSession();

  return useQuery({
    queryKey: ["openOrders", userEmail],
    queryFn: async () => {
      const response = await api.get("/trade/get-open-orders");
      return response.data;
    },
    enabled: Boolean(token),
    refetchInterval: 3000,
    retry: 1,
  });
}

export function useClosedOrders() {
  const { token, userEmail } = readStoredSession();

  return useQuery({
    queryKey: ["closedOrders", userEmail],
    queryFn: async () => {
      const response = await api.get("/trade/get-close-orders");
      return response.data;
    },
    enabled: Boolean(token),
    refetchInterval: 5000,
    staleTime: 3000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      const status = getApiStatus(error);
      if (status === 401 || status === 404) {
        return false;
      }

      return failureCount < 1;
    },
  });
}

export function useBalance() {
  const { token, userEmail } = readStoredSession();

  return useQuery({
    queryKey: ["balance", userEmail],
    queryFn: async () => {
      const response = await api.get("/balance/me");
      return response.data;
    },
    enabled: Boolean(token),
    refetchInterval: 5000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useTransactions() {
  const { token, userEmail } = readStoredSession();

  return useQuery({
    queryKey: ["transactions", userEmail],
    queryFn: async () => {
      const response = await api.get("/transactions");
      return response.data;
    },
    enabled: Boolean(token),
    refetchInterval: 10000,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      const status = getApiStatus(error);
      if (status === 401 || status === 404) {
        return false;
      }

      return failureCount < 1;
    },
  });
}

export function useMockDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MockFundingData) => {
      const response = await api.post("/deposits/mock", data);
      return response.data;
    },
    onSuccess: async (data: BalanceResponse) => {
      setBalanceCache(queryClient, data.balance);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["balance"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["balance"], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["transactions"], type: "active" }),
      ]);
    },
  });
}

export function useMockWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MockFundingData) => {
      const response = await api.post("/withdrawals/mock", data);
      return response.data;
    },
    onSuccess: async (data: BalanceResponse) => {
      setBalanceCache(queryClient, data.balance);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["balance"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["balance"], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["transactions"], type: "active" }),
      ]);
    },
  });
}
