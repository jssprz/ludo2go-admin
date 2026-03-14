'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type SyncResult = {
  message: string;
  synced: number;
  errors: { offerId: string; error: string }[];
  total: number;
};

export function GoogleMerchantSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  async function handleSync() {
    setIsSyncing(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch('/api/google-merchant/sync', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      setResult(data);
      setShowResultDialog(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unexpected error during sync');
      setShowResultDialog(true);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        onClick={handleSync}
        disabled={isSyncing}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          {isSyncing ? 'Syncing...' : 'Sync Google Merchant'}
        </span>
      </Button>

      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {errorMsg ? (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Sync Failed
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Sync Complete
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {errorMsg || result?.message || ''}
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md border p-3">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-2xl font-bold text-green-600">
                    {result.synced}
                  </div>
                  <div className="text-xs text-muted-foreground">Synced</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-2xl font-bold text-destructive">
                    {result.errors.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Errors</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Errors</h4>
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        className="border-b px-3 py-2 text-sm last:border-b-0"
                      >
                        <span className="font-mono text-xs font-medium">
                          {err.offerId}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {err.error}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
