import { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onImageReady: (dataUrl: string) => void;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  currentImage?: string | null;
  onClear?: () => void;
}

export function ImageUploader({
  onImageReady,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8,
  currentImage,
  onClear,
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentImage ?? null);
  const [dragOver, setDragOver] = useState(false);

  const processImage = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          setPreview(dataUrl);
          onImageReady(dataUrl);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [maxWidth, maxHeight, quality, onImageReady]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  const handleClear = useCallback(() => {
    setPreview(null);
    onClear?.();
  }, [onClear]);

  if (preview) {
    return (
      <div className="relative inline-block">
        <img
          src={preview}
          alt="Preview"
          className="max-w-xs rounded-lg border object-cover"
        />
        <button
          type="button"
          onClick={handleClear}
          className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white"
          aria-label="Remove image"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      className={cn(
        "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      )}
      onClick={() => document.getElementById("image-input")?.click()}
    >
      <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">Drop an image here or click to browse</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Auto-resized to {maxWidth}×{maxHeight}, JPEG compressed
      </p>
      <input
        id="image-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
