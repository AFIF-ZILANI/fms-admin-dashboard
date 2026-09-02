import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDelete } from "@/lib/api";

type HouseDeleteDialogProps = {
  houseId: string;
  houseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HouseDeleteDialog({ houseId, houseName, open, onOpenChange }: HouseDeleteDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phrase, setPhrase] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setPhrase("");
    }
  }, [open]);

  const remove = useDelete<null, void>(`/houses/${houseId}`, ["houses"]);
  const confirmed = name === houseName && phrase === "delete";

  const onDelete = () => {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success("House deleted");
        onOpenChange(false);
        navigate("/houses");
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {houseName}?</DialogTitle>
          <DialogDescription>
            This cannot be undone. A house with any recorded history — batches, mortality, environment or
            stock — can't be deleted; deactivate it instead.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmed) onDelete();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-name">
              To confirm, type <span className="font-semibold">{houseName}</span> below
            </Label>
            <Input
              id="confirm-name"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-phrase">
              To verify, type <span className="font-semibold">delete</span> below
            </Label>
            {/* Typed by hand only -- pasting the phrase would defeat the point of asking for it. */}
            <Input
              id="confirm-phrase"
              autoComplete="off"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!confirmed || remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete this house"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
