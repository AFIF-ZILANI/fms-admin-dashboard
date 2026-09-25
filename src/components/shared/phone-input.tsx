import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PHONE_PREFIX, toLocalDigits } from "@/lib/phone";

/**
 * Phone field with the +880 country code fixed in the leading addon, so the
 * number is entered the way it's spoken locally (1712345678) and stored the way
 * the API wants it (+8801712345678). Pairs with toE164 at submit time.
 */
export const PhoneInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentPropsWithoutRef<"input">, "type" | "value" | "onChange"> & {
    value?: string;
    onChange?: (localDigits: string) => void;
    invalid?: boolean;
  }
>(({ value, onChange, invalid, className, ...props }, ref) => (
  <div
    className={cn(
      "flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
      invalid && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
      className
    )}
  >
    <span className="flex select-none items-center border-r border-input bg-muted/50 px-2.5 text-sm text-muted-foreground">
      {PHONE_PREFIX}
    </span>
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder="1712345678"
      value={value ?? ""}
      onChange={(e) => onChange?.(toLocalDigits(e.target.value))}
      className="h-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
      {...props}
    />
  </div>
));

PhoneInput.displayName = "PhoneInput";
