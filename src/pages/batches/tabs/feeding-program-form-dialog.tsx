import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { optionalNumber } from "@/lib/zod-helpers";
import { FEED_TYPES, type BatchFeedingProgram } from "@/pages/batches/types";
import type { Item } from "@/pages/inventory/types";

const feedingProgramSchema = z.object({
  feed_type: z.enum(FEED_TYPES, "Select a feed type"),
  item_id: z.string().min(1, "Select a feed item"),
  start_day: z.coerce.number().int().nonnegative("Must be 0 or more"),
  end_day: optionalNumber(z.coerce.number().int().nonnegative("Must be 0 or more")),
});

type FeedingProgramFormInput = z.input<typeof feedingProgramSchema>;
type FeedingProgramFormValues = z.output<typeof feedingProgramSchema>;

type FeedingProgramFormDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; batchId: string };

export function FeedingProgramFormDialog({ open, onOpenChange, batchId }: FeedingProgramFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FeedingProgramFormInput, unknown, FeedingProgramFormValues>({
    resolver: zodResolver(feedingProgramSchema),
    defaultValues: { feed_type: undefined, item_id: "", start_day: undefined, end_day: "" },
  });

  // Dialog stays mounted between opens — without this, a second "Add row" would
  // start from whatever was left in the form after the previous submit.
  useEffect(() => {
    if (open) reset({ feed_type: undefined, item_id: "", start_day: undefined, end_day: "" });
  }, [open, reset]);

  const { data: feedItems } = useGetData<Paginated<Item>>("/items?category=FEED&limit=100", ["items", "FEED"]);

  const createProgram = usePostData<BatchFeedingProgram, FeedingProgramFormValues & { batch_id: string }>(
    "/batch-feeding-programs",
    ["batch-feeding-programs", batchId]
  );

  const onSubmit = (values: FeedingProgramFormValues) => {
    const payload = { ...values, batch_id: batchId };
    createProgram.mutate(payload, {
      onSuccess: () => {
        toast.success("Feeding program row added");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["feed_type", "item_id", "start_day", "end_day"] as const) {
          const message = error.fieldError(key);
          if (message) {
            setError(key, { message });
            hadFieldError = true;
          }
        }
        if (!hadFieldError) toast.error(error.message);
      },
    });
  };

  const items = feedItems?.results ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add feeding program row</DialogTitle>
          <DialogDescription>Which feed type applies for which day range.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feed_type">Feed type</Label>
            <Controller
              control={control}
              name="feed_type"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="feed_type" className="w-full" aria-invalid={!!errors.feed_type}>
                    <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select feed type")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {FEED_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {humanizeEnum(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.feed_type && <p className="text-xs text-destructive">{errors.feed_type.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item_id">Feed item</Label>
            <Controller
              control={control}
              name="item_id"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="item_id" className="w-full" aria-invalid={!!errors.item_id}>
                    <SelectValue>{(v: string) => items.find((i) => i.id === v)?.name ?? "Select item"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {items.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No feed items in the catalog yet — add one from Inventory first.
              </p>
            )}
            {errors.item_id && <p className="text-xs text-destructive">{errors.item_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start_day">Start day</Label>
              <Input id="start_day" type="number" {...register("start_day")} aria-invalid={!!errors.start_day} />
              {errors.start_day && <p className="text-xs text-destructive">{errors.start_day.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end_day">End day (optional)</Label>
              <Input id="end_day" type="number" {...register("end_day")} aria-invalid={!!errors.end_day} />
              {errors.end_day && <p className="text-xs text-destructive">{errors.end_day.message}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Add row
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
