"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface NumericInputProps extends Omit<
  React.ComponentPropsWithoutRef<"input">,
  "type" | "onChange"
> {
  /** Allow a single decimal point. Default false (integers only). */
  allowDecimal?: boolean;
  /** Max digits after the decimal point (e.g. 2 for currency/weight). Only used when allowDecimal is true. Omit for unlimited. */
  decimalPlaces?: number;
  /**
   * Allow "0" as a valid value. Default false.
   * NOTE: this is only enforced in real time for INTEGER mode. In decimal mode,
   * blocking a bare "0" would also block the first keystroke of "0.5", "0.25", etc.,
   * so zero-rejection for decimals is left to your Zod schema's .positive() instead.
   */
  allowZero?: boolean;
  /** Placeholder text for the input field. */
  placeholder?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

/**
 * Text input restricted to non-negative numbers — integer or decimal.
 * - Strips anything that isn't 0-9 (and a single "." if allowDecimal)
 * - No +/-, no scientific notation, no second decimal point
 * - Strips leading zeros ("0124" -> "124", "0.5" untouched)
 * - Optionally caps decimal places ("12.3456" -> "12.34" with decimalPlaces=2)
 * - Blocks paste of invalid content
 * - inputMode is "decimal" or "numeric" for the right mobile keypad
 *
 * This is UX polish only, not validation. Always enforce the real rule server-side:
 *   initial_chick_count: z.coerce.number().int().positive()
 *   avg_weight_kg:        z.coerce.number().positive()   // decimal, allowDecimal
 *
 * IMPORTANT for react-hook-form: prefer `setValueAs` over `valueAsNumber` in register()
 * — valueAsNumber coerces an empty string to 0 instead of leaving it empty/undefined,
 * which will silently defeat a `required` check on this field. See usage below.
 */
export const NumericInput = React.forwardRef<
  HTMLInputElement,
  NumericInputProps
>(
  (
    {
      allowDecimal = false,
      decimalPlaces,
      allowZero = false,
      placeholder,
      onChange,
      onKeyDown,
      onPaste,
      className,
      ...props
    },
    ref,
  ) => {
    const sanitize = (raw: string) => {
      let v = allowDecimal
        ? raw.replace(/[^0-9.]/g, "")
        : raw.replace(/[^0-9]/g, "");

      if (allowDecimal) {
        // collapse to a single decimal point
        const firstDot = v.indexOf(".");
        if (firstDot !== -1) {
          v =
            v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
        }
      }

      // strip leading zeros in the integer part ("0123" -> "123", "0.5" untouched)
      v = v.replace(/^0+(?=\d)/, "");

      if (allowDecimal && decimalPlaces !== undefined && v.includes(".")) {
        const [intPart, decPart] = v.split(".");
        if (decPart.length > decimalPlaces) {
          v =
            decimalPlaces === 0
              ? intPart
              : `${intPart}.${decPart.slice(0, decimalPlaces)}`;
        }
      }

      // zero-blocking is only safe to do in real time for integers — see class doc above
      if (!allowDecimal && !allowZero && v === "0") {
        v = "";
      }

      return v;
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        placeholder={placeholder}
        pattern={
          allowDecimal
            ? "[0-9]*\\.?[0-9]*"
            : allowZero
              ? "[0-9]*"
              : "[1-9][0-9]*"
        }
        className={cn(className)}
        onChange={(e) => {
          e.target.value = sanitize(e.target.value);
          onChange?.(e);
        }}
        onKeyDown={(e) => {
          const blocked = allowDecimal
            ? ["e", "E", "+", "-"]
            : ["e", "E", "+", "-", "."];
          if (blocked.includes(e.key)) {
            e.preventDefault();
          }
          if (
            allowDecimal &&
            e.key === "." &&
            e.currentTarget.value.includes(".")
          ) {
            e.preventDefault();
          }
          onKeyDown?.(e);
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          const valid = allowDecimal
            ? /^\d*\.?\d*$/.test(pasted)
            : /^\d+$/.test(pasted);
          if (!valid) {
            e.preventDefault();
          }
          onPaste?.(e);
        }}
        {...props}
      />
    );
  },
);

NumericInput.displayName = "NumericInput";

/** Backward-compatible alias for the integer-only case — existing call sites don't need to change. */
export const PositiveIntegerInput = React.forwardRef<
  HTMLInputElement,
  Omit<NumericInputProps, "allowDecimal">
>((props, ref) => <NumericInput ref={ref} allowDecimal={false} {...props} />);

PositiveIntegerInput.displayName = "PositiveIntegerInput";
