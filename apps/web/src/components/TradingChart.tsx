import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "@/hooks/useTheme";
import { useBackendCandles } from "@/hooks/useBackendCandles";
import { getCandlesticks, type Candlestick } from "@/lib/candlestick-store";

interface TradingChartProps {
  symbol: string;
  interval: string;
}

type ChartInterval = "1m" | "5m" | "30m" | "1h" | "6h" | "1d" | "3d";

const MAX_FUTURE_DRIFT_SECONDS = 5 * 60;

function isValidCandle(candle: Candlestick) {
  return (
    Number.isFinite(candle.time) &&
    candle.time > 0 &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close)
  );
}

function normalizeCandleTime(time: number) {
  if (!Number.isFinite(time) || time <= 0) {
    return null;
  }

  return time > 10_000_000_000 ? Math.floor(time / 1000) : Math.floor(time);
}

function clampFutureCandles(candles: Candlestick[]) {
  const maxTime = Math.floor(Date.now() / 1000) + MAX_FUTURE_DRIFT_SECONDS;
  return candles.filter((candle) => candle.time <= maxTime);
}

function normalizeCandles(candles: Candlestick[]) {
  const merged = new Map<number, Candlestick>();

  for (const candle of candles) {
    if (!isValidCandle(candle)) {
      continue;
    }

    const normalizedTime = normalizeCandleTime(candle.time);
    if (normalizedTime === null) {
      continue;
    }

    const normalizedCandle: Candlestick = {
      time: normalizedTime,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    };

    const existing = merged.get(normalizedTime);
    if (!existing) {
      merged.set(normalizedTime, normalizedCandle);
      continue;
    }

    merged.set(normalizedTime, {
      time: normalizedTime,
      open: existing.open,
      high: Math.max(existing.high, normalizedCandle.high),
      low: Math.min(existing.low, normalizedCandle.low),
      close: normalizedCandle.close,
    });
  }

  return clampFutureCandles([...merged.values()].sort((left, right) => left.time - right.time));
}

function mergeCandlesByTime(backendCandles: Candlestick[], frontendCandles: Candlestick[]) {
  return normalizeCandles([...backendCandles, ...frontendCandles]).slice(-1000);
}

function toChartCandles(candles: Candlestick[]) {
  return candles.map((candle) => ({
    time: candle.time as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function getVisibleBars(width: number) {
  if (width <= 480) return 55;
  if (width <= 820) return 70;
  if (width <= 1180) return 90;
  return 110;
}

export function TradingChart({ symbol, interval }: TradingChartProps) {
  const { theme } = useTheme();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastErrorSignatureRef = useRef<string | null>(null);
  const visibleBarsRef = useRef(110);
  const candleCountRef = useRef(0);
  const { data: backendData, error, isError, isPending } = useBackendCandles(symbol, interval);

  const historicalCandles = useMemo(() => backendData?.candlesticks ?? [], [backendData]);
  const liveCandles = useMemo(() => {
    const normalizedInterval = interval as ChartInterval;
    return getCandlesticks(symbol, normalizedInterval);
  }, [symbol, interval]);

  const allCandles = useMemo(() => {
    if (!historicalCandles.length) {
      return isPending ? [] : normalizeCandles(liveCandles).slice(-1000);
    }

    return mergeCandlesByTime(historicalCandles, liveCandles);
  }, [historicalCandles, isPending, liveCandles]);

  useEffect(() => {
    candleCountRef.current = allCandles.length;
  }, [allCandles.length]);

  useEffect(() => {
    if (!isError) {
      lastErrorSignatureRef.current = null;
      return;
    }

    const message =
      error instanceof Error ? error.message : "Historical chart data could not be loaded.";
    if (lastErrorSignatureRef.current === message) {
      return;
    }

    lastErrorSignatureRef.current = message;
    toast.error("Historical chart unavailable", {
      description:
        "Live pricing remains active, but recent candlestick history could not be refreshed.",
    });
  }, [error, isError]);

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }

    const isDark = theme === "dark";
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: isDark ? "#020617" : "#FFFFFF" },
        textColor: isDark ? "#D1D4DC" : "#191919",
      },
      grid: {
        vertLines: { color: isDark ? "#1f2937" : "#E5E7EB" },
        horzLines: { color: isDark ? "#1f2937" : "#E5E7EB" },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
        barSpacing: 7,
        minBarSpacing: 5,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        borderColor: isDark ? "#334155" : "#D1D5DB",
        tickMarkFormatter: (time: number, tickMarkType: number) => {
          const date = new Date(time * 1000);

          if (tickMarkType === 0) {
            return date.toLocaleDateString("en-US", { year: "numeric" });
          }

          if (tickMarkType === 1 || tickMarkType === 2) {
            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
          }

          return date.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          });
        },
      },
      rightPriceScale: {
        borderColor: isDark ? "#334155" : "#D1D5DB",
        ticksVisible: true,
        minimumWidth: 82,
      },
      crosshair: {
        mode: 1,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    visibleBarsRef.current = getVisibleBars(chartContainerRef.current.clientWidth);

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) {
        return;
      }

      visibleBarsRef.current = getVisibleBars(chartContainerRef.current.clientWidth);
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });

      if (candleCountRef.current > 0) {
        const visibleBars = Math.min(candleCountRef.current, visibleBarsRef.current);
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: Math.max(candleCountRef.current - visibleBars, 0),
          to: Math.max(candleCountRef.current - 1, 0) + 2,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    if (!candlestickSeriesRef.current || !chartRef.current) {
      return;
    }

    if (isPending && historicalCandles.length === 0) {
      candlestickSeriesRef.current.setData([]);
      return;
    }

    candlestickSeriesRef.current.setData(toChartCandles(allCandles));

    if (allCandles.length === 0) {
      return;
    }

    const visibleBars = Math.min(allCandles.length, visibleBarsRef.current);
    chartRef.current.timeScale().applyOptions({
      rightOffset: 2,
      barSpacing: visibleBarsRef.current <= 70 ? 6 : 7,
    });
    chartRef.current.timeScale().setVisibleLogicalRange({
      from: Math.max(allCandles.length - visibleBars, 0),
      to: Math.max(allCandles.length - 1, 0) + 2,
    });
  }, [allCandles, historicalCandles.length, isPending, symbol, interval]);

  useEffect(() => {
    if (!candlestickSeriesRef.current || historicalCandles.length === 0) {
      return;
    }

    const updateInterval = setInterval(() => {
      const normalizedInterval = interval as ChartInterval;
      const latestFrontendCandles = getCandlesticks(symbol, normalizedInterval);
      const mergedCandles = mergeCandlesByTime(historicalCandles, latestFrontendCandles);

      if (candlestickSeriesRef.current) {
        candlestickSeriesRef.current.setData(toChartCandles(mergedCandles));
      }
    }, 1000);

    return () => clearInterval(updateInterval);
  }, [historicalCandles, interval, symbol]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
      <div ref={chartContainerRef} className="h-full w-full" data-testid="trade-chart" />
      {isPending && allCandles.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <div className="rounded-full border border-gray-200 bg-white/92 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 shadow-sm dark:border-gray-700 dark:bg-slate-900/92 dark:text-gray-400">
            Loading historical candles
          </div>
        </div>
      ) : null}
      {isError ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <div
            data-testid="chart-history-status"
            className="rounded-full border border-yellow-300 bg-yellow-50/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-yellow-900 shadow-sm dark:border-yellow-700 dark:bg-yellow-950/80 dark:text-yellow-100"
          >
            Chart history unavailable
          </div>
        </div>
      ) : null}
    </div>
  );
}
