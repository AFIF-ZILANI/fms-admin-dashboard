import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

type QrCodeProps = {
  value: string;
  size?: number;
  className?: string;
};

/** QR + the human-readable code underneath, per docs/PRD.md §6.4 "Notes" -- error-correction tolerates dirty/torn farm labels, the text is the fallback until a scanning app exists. */
export function QrCode({ value, size = 96, className }: QrCodeProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <QRCodeSVG value={value} size={size} level="M" />
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
