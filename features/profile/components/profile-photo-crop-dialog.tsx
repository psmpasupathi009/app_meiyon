"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";

async function cropToBlob(
  imageSrc: string,
  crop: Area
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size,
    size
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.92
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = url;
  });
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (user: PublicUser) => void;
};

export function ProfilePhotoCropDialog({
  open,
  onOpenChange,
  onUploaded,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  function reset() {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setError("");
  }

  function pickFile(file: File | null) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a JPG, PNG or WEBP image");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image too large (max 8 MB)");
      return;
    }
    if (src) URL.revokeObjectURL(src);
    setSrc(URL.createObjectURL(file));
  }

  async function handleUpload() {
    if (!src || !croppedArea) {
      setError("Adjust the crop first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const blob = await cropToBlob(src, croppedArea);
      const form = new FormData();
      form.set("file", blob, "avatar.jpg");
      const { ok, data } = await apiFetch<{ user: PublicUser }>(
        "/api/profile/photo",
        { method: "POST", body: form }
      );
      if (!ok) {
        setError(getErrorMessage(data, "Upload failed"));
        setBusy(false);
        return;
      }
      const user = data.user;
      toast.success("Profile photo updated");
      reset();
      onUploaded(user);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setBusy(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Profile photo</DialogTitle>
          <DialogDescription>
            Crop to a square — we’ll resize it for sharp display in the office
            portal.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-4">
          {!src ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground hover:bg-muted/50">
              <span className="font-medium text-navy">Choose image</span>
              <span>JPG, PNG or WEBP · max 8 MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <>
              <div className="relative h-72 overflow-hidden rounded-xl bg-brand">
                <Cropper
                  image={src}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-muted-foreground">Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  reset();
                }}
              >
                Choose another
              </Button>
            </>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={busy || !src}
          >
            {busy ? "Uploading…" : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
