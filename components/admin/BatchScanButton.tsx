"use client";

import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  isRunning: boolean;
  onBatchScan: () => Promise<void>;
}

export function BatchScanButton({ count, isRunning, onBatchScan }: Props) {
  return (
    <Button
      onClick={onBatchScan}
      disabled={isRunning || count === 0}
      size="sm"
    >
      {isRunning ? (
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
          Scanning…
        </span>
      ) : (
        `Batch AI Scan All (${count})`
      )}
    </Button>
  );
}
