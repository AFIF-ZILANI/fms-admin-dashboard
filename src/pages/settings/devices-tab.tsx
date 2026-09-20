import { useState } from "react";
import { toast } from "sonner";
import { Smartphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActorSelect } from "@/components/shared/actor-select";
import { useGetData, usePostData } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Device = {
  id: string;
  label: string;
  platform: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
  profile: { id: string; name: string };
};

type PairingCode = { code: string; expires_at: string };

/** Devices are paired, never given a password: the pairing code is the only
 * credential and it is single-use. Every EXPO_PUBLIC_* value in the mobile app
 * is baked into its APK, so a shared secret was never an option. */
export function DevicesTab() {
  const [pairOpen, setPairOpen] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [issued, setIssued] = useState<PairingCode | null>(null);

  const { data, isLoading, isError } = useGetData<Device[]>("/devices", ["devices"]);
  const createCode = usePostData<PairingCode, { profile_id: string }>(
    "/devices/pairing-codes",
    ["devices"]
  );
  const revoke = usePostData<Device, { id: string }>((v) => `/devices/${v.id}/revoke`, ["devices"]);

  const devices = data ?? [];

  const columns: Column<Device>[] = [
    { key: "label", header: "Device", render: (d) => d.label, sortValue: (d) => d.label },
    {
      key: "operator",
      header: "Records as",
      render: (d) => d.profile.name,
      sortValue: (d) => d.profile.name,
    },
    { key: "platform", header: "Platform", render: (d) => d.platform ?? "—" },
    {
      key: "last_seen",
      header: "Last synced",
      render: (d) => (d.last_seen_at ? formatDate(d.last_seen_at) : "Never"),
      sortValue: (d) => d.last_seen_at ?? "",
    },
    {
      key: "status",
      header: "Status",
      render: (d) =>
        d.revoked_at ? (
          <StatusBadge tone="neutral" label="Revoked" />
        ) : (
          <StatusBadge tone="success" label="Active" />
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (d) =>
        d.revoked_at ? null : (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() =>
                revoke.mutate(
                  { id: d.id },
                  {
                    onSuccess: () => toast.success("Device revoked"),
                    onError: (error) => toast.error(error.message),
                  }
                )
              }
            >
              Revoke
            </Button>
          </div>
        ),
    },
  ];

  const handleIssue = () => {
    if (!profileId) return;
    createCode.mutate(
      { profile_id: profileId },
      {
        onSuccess: (code) => setIssued(code),
        onError: (error) => toast.error(error.message),
      }
    );
  };

  const closePairing = () => {
    setPairOpen(false);
    setIssued(null);
    setProfileId("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setPairOpen(true)}>
          <Plus />
          Pair a device
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={devices}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        empty={{
          icon: Smartphone,
          title: isError ? "Couldn't load devices" : "No devices paired yet",
          description: isError
            ? "Try refreshing the page."
            : "Pair a phone to let it send sales into FMS.",
        }}
      />

      <Dialog open={pairOpen} onOpenChange={(open) => (open ? setPairOpen(true) : closePairing())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pair a device</DialogTitle>
            <DialogDescription>
              Every sale this phone sends will be recorded against the person you pick here.
            </DialogDescription>
          </DialogHeader>

          {issued ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Type this code into PoultryScale. It works once and expires in 10 minutes.
              </p>
              <p className="rounded-lg border border-border bg-muted/40 py-6 text-center font-mono text-3xl tracking-[0.3em]">
                {issued.code}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pair_profile">Records as</Label>
              <ActorSelect id="pair_profile" value={profileId} onChange={setProfileId} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closePairing}>
              {issued ? "Done" : "Cancel"}
            </Button>
            {!issued && (
              <Button onClick={handleIssue} disabled={!profileId || createCode.isPending}>
                Create code
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
