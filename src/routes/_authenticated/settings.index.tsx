import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/profiles/${profile!.id}`, { full_name: name });
      toast.success("Profile updated");
      refreshProfile();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-6 space-y-4 max-w-lg">
      <h2 className="font-semibold">Your Profile</h2>
      <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label>Email</Label><Input value={profile?.email ?? ""} disabled /></div>
      <div><Label>Role</Label><Input value={profile?.role ?? ""} disabled className="capitalize" /></div>
      <Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
    </div>
  );
}
