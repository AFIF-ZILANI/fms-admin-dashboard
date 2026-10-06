import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type TempCredentials = { name: string; email: string | null; password: string };

/** The one place a temporary password is ever visible -- the server stores only a hash. */
export function TempPasswordDialog({
  credentials,
  onClose,
}: {
  credentials: TempCredentials | null;
  onClose: () => void;
}) {
  const copy = () => {
    if (!credentials) return;
    const text = `Email: ${credentials.email ?? ""}\nPassword: ${credentials.password}`;
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Could not copy -- select and copy it by hand"));
  };

  return (
    <Dialog open={!!credentials} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Login for {credentials?.name}</DialogTitle>
          <DialogDescription>
            Give them this email and temporary password. They'll be asked to choose their own
            password at first login. It won't be shown again.
          </DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="font-medium break-all">{credentials?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Temporary password</dt>
            <dd className="font-mono text-base font-semibold select-all">{credentials?.password}</dd>
          </div>
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            <Copy />
            Copy
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
