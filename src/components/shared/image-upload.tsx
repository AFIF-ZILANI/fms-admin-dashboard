import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export type UploadedImage = { public_id: string; image_url: string };

type Signature = {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  folder: string;
  upload_preset: string;
  signature: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Click-or-drop image field. Asks our server for a short-lived Cloudinary
 * signature, then POSTs the file straight to Cloudinary — the bytes never pass
 * through our API, and the API secret never reaches the browser.
 */
export function ImageUpload({
  value,
  onChange,
  folder = "employees",
  label = "Photo",
  className,
  invalid,
}: {
  value: UploadedImage | null;
  onChange: (image: UploadedImage | null) => void;
  folder?: string;
  label?: string;
  className?: string;
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown while Cloudinary is still uploading, so the picture appears instantly.
  const [preview, setPreview] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return setError("That file isn't an image.");
    if (file.size > MAX_BYTES) return setError("Image must be 5 MB or smaller.");

    setError(null);
    setBusy(true);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const sig = await apiFetch<Signature>(`/uploads/signature?folder=${folder}`);
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.api_key);
      form.append("timestamp", String(sig.timestamp));
      form.append("folder", sig.folder);
      form.append("upload_preset", sig.upload_preset);
      form.append("signature", sig.signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, {
        method: "POST",
        body: form,
      });
      const body = (await res.json()) as { public_id?: string; secure_url?: string; error?: { message: string } };
      if (!res.ok || !body.public_id || !body.secure_url) {
        throw new Error(body.error?.message ?? "Cloudinary rejected the upload.");
      }
      onChange({ public_id: body.public_id, image_url: body.secure_url });
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      URL.revokeObjectURL(localUrl);
      setBusy(false);
    }
  };

  const shown = value?.image_url ?? preview;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void upload(file);
        }}
        className={cn(
          "relative flex size-28 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 transition-colors",
          invalid && "border-destructive",
          !shown && "hover:border-foreground/40 hover:bg-muted/60"
        )}
      >
        {shown ? (
          <img src={shown} alt={label} className="size-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground"
          >
            <ImagePlus className="size-5" />
            <span className="text-xs">{label}</span>
          </button>
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {shown && !busy && (
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              onChange(null);
            }}
            aria-label={`Remove ${label.toLowerCase()}`}
            className="absolute top-1 right-1 rounded-full bg-background/90 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {shown && !busy && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-28 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Replace
        </button>
      )}
      {error && <p className="max-w-40 text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
