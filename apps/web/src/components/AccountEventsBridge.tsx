import { useQueryClient } from "@tanstack/react-query";
import { readStoredSession } from "@/hooks/useAuth";
import { useWebSocket, type AccountUpdatePayload } from "@/hooks/useWebSocket";

export function AccountEventsBridge() {
  const queryClient = useQueryClient();

  useWebSocket(
    () => {},
    undefined,
    (event) => {
      const { userEmail } = readStoredSession();
      if (!userEmail || event.email !== userEmail) {
        return;
      }

      if (typeof event.balance === "number") {
        queryClient.setQueryData(["balance", userEmail], { balance: event.balance });
      }

      if (Array.isArray(event.openOrders)) {
        queryClient.setQueryData(["openOrders", userEmail], { orders: event.openOrders });
      }

      if (event.event === "trade_closed" || event.event === "trade_liquidated") {
        void queryClient.invalidateQueries({ queryKey: ["closedOrders", userEmail] });
        void queryClient.invalidateQueries({ queryKey: ["transactions", userEmail] });
      }

      if (event.event === "funding_updated") {
        void queryClient.invalidateQueries({ queryKey: ["transactions", userEmail] });
      }
    }
  );

  return null;
}
