import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export interface BackendCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function useBackendCandles(symbol: string, timeframe: string) {
  return useQuery({
    queryKey: ["backendCandles", symbol, timeframe],
    queryFn: async () => {
      const response = await api.get("/trade/candlesticks", {
        params: { symbol, timeframe, limit: 1000 },
      });

      const payload = response.data as {
        candlesticks?: BackendCandle[];
        message?: BackendCandle[];
      };

      return {
        candlesticks: Array.isArray(payload.candlesticks)
          ? payload.candlesticks
          : Array.isArray(payload.message)
            ? payload.message
            : [],
      };
    },
    refetchInterval: 5000,
    retry: 1,
    staleTime: 2000,
  });
}
