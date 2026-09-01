import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QrCodeProps = {
  value: string;
  size?: number;
  className?: string;
};

/** QR + the human-readable code underneath, per docs/PRD.md §6.4 "Notes" -- error-correction tolerates dirty/torn farm labels, the text is the fallback until a scanning app exists. */
export function QrCode({ value, size = 96, className }: QrCodeProps) {
  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(
      () => toast.success("Code copied"),
      () => toast.error("Couldn't copy code")
    );
  };

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <QRCodeSVG value={value} size={size} level="M" />
      <div className="flex items-center gap-1">
        <span className="font-mono text-xs">{value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}
