"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/shared/components/data/page-header";
import { UserAvatar } from "@/shared/components/user/user-avatar";
import { apiFetch, getErrorMessage } from "@/lib/api/client";
import type { PublicUser } from "@/lib/auth/session";
import { displayMobile } from "@/lib/auth/mobile";
import { ProfilePhotoCropDialog } from "@/features/profile/components/profile-photo-crop-dialog";
import { personDisplayName } from "@/shared/lib/person";

export function ProfilePage({ user: initial }: { user: PublicUser }) {
  const router = useRouter();
  const [user, setUser] = useState(initial);
  const [name, setName] = useState(initial.name ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [photoBust, setPhotoBust] = useState(0);

  useEffect(() => {
    queueMicrotask(() => {
      setUser(initial);
      setName(initial.name ?? "");
      setEmail(initial.email ?? "");
      setAddress(initial.address ?? "");
    });
  }, [initial]);

  const photoSrc = user.photoUrl
    ? `${user.photoUrl}?v=${photoBust}`
    : undefined;

  async function handleSave() {
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    const { ok, data } = await apiFetch<{ user: PublicUser }>(
      "/api/profile",
      {
        method: "PATCH",
        json: {
          name,
          email: email || "",
          address: address || "",
        },
      }
    );
    setBusy(false);
    if (!ok) {
      setError(
        getErrorMessage(data as Record<string, unknown>, "Failed to save")
      );
      return;
    }
    const next =
      data && typeof data === "object" && "user" in data
        ? (data as { user: PublicUser }).user
        : user;
    setUser(next);
    toast.success("Profile saved");
    router.refresh();
  }

  async function handleRemovePhoto() {
    setBusy(true);
    const { ok, data } = await apiFetch<{ user: PublicUser }>(
      "/api/profile/photo",
      { method: "DELETE" }
    );
    setBusy(false);
    if (!ok) {
      toast.error(
        getErrorMessage(data as Record<string, unknown>, "Could not remove photo")
      );
      return;
    }
    const next =
      data && typeof data === "object" && "user" in data
        ? (data as { user: PublicUser }).user
        : { ...user, photoUrl: undefined };
    setUser({ ...next, photoUrl: next.photoUrl });
    setPhotoBust((n) => n + 1);
    toast.success("Photo removed");
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-2xl">
      <PageHeader
        title="My profile"
        description="Update how your name appears in the office portal. Mobile login cannot be changed here."
      />

      <div className="space-y-6 rounded-xl border border-border/80 bg-card p-5 sm:p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <UserAvatar
            name={personDisplayName({
              name: name || user.name,
              mobile: user.mobile,
              unitId: user.unitId,
            })}
            photoUrl={photoSrc}
            size="lg"
          />
          <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
            <p className="text-lg font-semibold text-navy">
              {personDisplayName({
                name: name || user.name,
                mobile: user.mobile,
                unitId: user.unitId,
                fallback: "Your name",
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {user.designation ?? user.roles.join(", ")} ·{" "}
              {displayMobile(user.mobile)}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setCropOpen(true)}
              >
                <Camera className="size-3.5" />
                {user.photoUrl ? "Change photo" : "Add photo"}
              </Button>
              {user.photoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  disabled={busy}
                  onClick={handleRemovePhoto}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-border/60 pt-5">
          <div className="grid gap-2">
            <Label htmlFor="pf-name">
              Display name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pf-name"
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As shown in sidebar"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pf-email">Email</Label>
            <Input
              id="pf-email"
              type="email"
              className="h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pf-address">Address</Label>
            <Textarea
              id="pf-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label>Mobile (login)</Label>
            <Input
              className="h-11 bg-muted/40"
              value={displayMobile(user.mobile)}
              disabled
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm">
            <p className="font-medium text-navy">Office resources</p>
            <p className="mt-1 text-muted-foreground">
              Staff address book (signed-in download only).
            </p>
            <a
              href="/api/office-files/address-and-mail"
              className="mt-2 inline-flex text-sm font-medium text-navy underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Open Address and mail.pdf
            </a>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </div>
      </div>

      <ProfilePhotoCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        onUploaded={(next) => {
          setUser(next);
          setPhotoBust((n) => n + 1);
          router.refresh();
        }}
      />
    </section>
  );
}
