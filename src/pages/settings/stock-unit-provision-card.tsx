import { useState } from "react";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePostData } from "@/lib/api";
import type { StockUnit } from "@/pages/settings/types";

// ponytail: lists the provisioned unit ids as plain text (each id IS the QR
// payload). Actual scannable QR images are rendered by the Inventory
// provisioning dialog (provision-codes-dialog.tsx), not here.
export function StockUnitProvisionCard() {
  const [count, setCount] = useState("50");
  const [lastBatch, setLastBatch] = useState<StockUnit[] | undefined>(undefined);

  const provision = usePostData<StockUnit[], { count: number }>("/stock-units", ["stock-units"]);

  const onProvision = () => {
    const n = Number(count);
    if (!Number.isInteger(n) || n <= 0 || n > 500) {
      toast.error("Enter a whole number between 1 and 500");
      return;
    }
    provision.mutate(
      { count: n },
      {
        onSuccess: (units) => {
          toast.success(`Provisioned ${units.length} code${units.length === 1 ? "" : "s"}`);
          setLastBatch(units);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stock unit code provisioning</CardTitle>
        <CardDescription>
          Prints blank codes ahead of need — bind each one to a purchase lot later from Inventory.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stock-unit-count">Count (max 500)</Label>
            <Input
              id="stock-unit-count"
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-32"
            />
          </div>
          <Button onClick={onProvision} disabled={provision.isPending}>
            <QrCode />
            Provision codes
          </Button>
        </div>

        {lastBatch && lastBatch.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>Last provisioned batch ({lastBatch.length})</Label>
            <div className="max-h-48 overflow-auto rounded-md border border-border p-2 font-mono text-xs">
              {lastBatch.map((u) => (
                <div key={u.id}>{u.id}</div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
