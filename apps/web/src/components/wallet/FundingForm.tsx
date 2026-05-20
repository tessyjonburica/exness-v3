import { Card } from "@/components/ui/card";

interface FundingFormProps {
  title: string;
  subtitle: string;
  amount: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  helperLabel: string;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
}

export function FundingForm({
  title,
  subtitle,
  amount,
  description,
  submitLabel,
  pendingLabel,
  pending,
  helperLabel,
  onAmountChange,
  onDescriptionChange,
  onSubmit,
}: FundingFormProps) {
  return (
    <Card className="border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <p className="mt-1 text-sm font-extrabold">{subtitle}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            Amount (USD)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-bold dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          />
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {helperLabel}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            Reference Note
          </label>
          <input
            type="text"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Optional note"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-bold dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        className="mt-4 w-full rounded-md bg-black px-3 py-3 text-sm font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </Card>
  );
}
