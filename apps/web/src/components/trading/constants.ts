import btcIcon from "@/assets/btc.png";
import ethIcon from "@/assets/eth.png";
import solIcon from "@/assets/sol.png";
import type { MarketDefinition, Timeframe } from "@/components/trading/types";

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "30m", "1h", "6h", "1d", "3d"];

export const SUPPORTED_MARKETS: MarketDefinition[] = [
  {
    symbol: "BTC",
    wsSymbol: "BTCUSDT",
    asset: "BTC_USDC",
    pair: "BTC_USDC",
    label: "BTC/USD",
    icon: btcIcon,
  },
  {
    symbol: "ETH",
    wsSymbol: "ETHUSDT",
    asset: "ETH_USDC",
    pair: "ETH_USDC",
    label: "ETH/USD",
    icon: ethIcon,
  },
  {
    symbol: "SOL",
    wsSymbol: "SOLUSDT",
    asset: "SOL_USDC",
    pair: "SOL_USDC",
    label: "SOL/USD",
    icon: solIcon,
  },
];

export const MARKET_DEFINITIONS = SUPPORTED_MARKETS;

export const MARKET_BY_PAIR = Object.fromEntries(
  SUPPORTED_MARKETS.map((market) => [market.pair, market])
) as Record<string, MarketDefinition>;

export const MARKET_BY_ASSET = Object.fromEntries(
  SUPPORTED_MARKETS.map((market) => [market.asset, market])
) as Record<string, MarketDefinition>;

export const MARKET_BY_WS_SYMBOL = Object.fromEntries(
  SUPPORTED_MARKETS.map((market) => [market.wsSymbol, market])
) as Record<string, MarketDefinition>;
