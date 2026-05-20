import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CommentaryCard } from "@/components/trading/types";

interface MarketCommentaryProps {
  cards: CommentaryCard[];
  compact?: boolean;
}

export function MarketCommentary({ cards, compact = false }: MarketCommentaryProps) {
  if (compact) {
    return (
      <Card className="border-gray-200 bg-white p-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Market status
            </p>
          </div>
          <BarChart3 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900 ${card.accent}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]">{card.title}</p>
                  </div>
                  {card.value ? <p className="text-[10px] font-extrabold">{card.value}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          Market status
        </p>
        <p className="mt-1 text-sm font-extrabold">Execution conditions</p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Feed and spread conditions for the active simulated market.
        </p>
      </Card>

      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.title}
            className={`border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${card.accent}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <p className="text-xs font-extrabold uppercase tracking-wide">{card.title}</p>
              </div>
              {card.value ? <p className="text-sm font-extrabold">{card.value}</p> : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">{card.body}</p>
          </Card>
        );
      })}
    </div>
  );
}
