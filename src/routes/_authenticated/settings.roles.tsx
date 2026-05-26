import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Shield, Settings, CheckSquare } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/settings/roles")({
  component: RolesSettings,
});

function RolesSettings() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editRole, setEditRole] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get("/roles"),
  });

  const { data: permissionsGrouped = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => api.get("/permissions"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/roles", data),
    onSuccess: () => {
      toast.success("Role created successfully");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to create role"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) => api.put(`/roles/${data.id}`, data.payload),
    onSuccess: () => {
      toast.success("Role updated successfully");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to update role"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      toast.success("Role deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete role"),
  });

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Only Super Admins can manage roles and permissions.</div>;
  }

  const openEdit = (role: any) => {
    setEditRole({
      ...role,
      permissions: role.permissions.map((p: any) => p.id)
    });
    setOpen(true);
  };

  const openNew = () => {
    setEditRole({ name: "", description: "", permissions: [] });
    setOpen(true);
  };

  const saveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (editRole.id) {
      updateMutation.mutate({ id: editRole.id, payload: editRole });
    } else {
      createMutation.mutate(editRole);
    }
  };

  const togglePerm = (permId: string) => {
    setEditRole((prev: any) => {
      const perms = prev.permissions.includes(permId)
        ? prev.permissions.filter((id: string) => id !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: perms };
    });
  };

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-primary"/> Roles & Permissions</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage custom access levels and permissions for your team.</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      <div className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-4 font-medium">Role Name</th>
              <th className="text-left p-4 font-medium">Description</th>
              <th className="text-left p-4 font-medium">Type</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {roles.map((r: any) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="p-4 font-semibold capitalize">{r.name}</td>
                <td className="p-4 text-muted-foreground">{r.description || "—"}</td>
                <td className="p-4">
                  {r.is_system ? <Badge variant="secondary">System Role</Badge> : <Badge variant="outline" className="border-primary text-primary">Custom Role</Badge>}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                      <Settings className="w-3.5 h-3.5 mr-2" /> Edit Permissions
                    </Button>
                    {!r.is_system && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmDel(r.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editRole?.id ? `Edit Role: ${editRole.name}` : "Create Custom Role"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveRole} className="flex flex-col gap-4 overflow-hidden pt-2">
            <div className="grid grid-cols-2 gap-4 flex-shrink-0">
              <div>
                <Label>Role Name *</Label>
                <Input className="mt-1" required value={editRole?.name || ""} onChange={e => setEditRole({...editRole, name: e.target.value})} disabled={editRole?.is_system} placeholder="e.g., Marketing Manager" />
              </div>
              <div>
                <Label>Description</Label>
                <Input className="mt-1" value={editRole?.description || ""} onChange={e => setEditRole({...editRole, description: e.target.value})} placeholder="What this role does..." />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 pb-2">
              <Label className="mb-3 block font-semibold text-base mt-2 flex items-center gap-2"><CheckSquare className="w-4 h-4 text-primary"/> Assign Permissions</Label>
              <div className="grid sm:grid-cols-2 gap-4">
                {permissionsGrouped.map((group: any) => (
                  <div key={group.resource} className="border rounded-lg p-3 bg-muted/20">
                    <div className="font-semibold capitalize text-sm mb-2 pb-2 border-b flex justify-between items-center">
                      {group.resource}
                    </div>
                    <div className="space-y-2">
                      {group.permissions.map((p: any) => {
                        const isChecked = editRole?.permissions?.includes(p.id) || editRole?.name === "admin";
                        return (
                          <label key={p.id} className="flex items-start gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              disabled={editRole?.name === "admin"}
                              onChange={() => togglePerm(p.id)}
                              className="mt-0.5 rounded border-input accent-primary"
                            />
                            <div className="text-sm">
                              <span className="font-medium capitalize text-foreground group-hover:text-primary transition-colors">{p.action}</span>
                              <p className="text-xs text-muted-foreground">{p.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2 border-t mt-auto flex-shrink-0">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>Save Role</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(open) => !open && setConfirmDel(null)}
        title="Delete Role?"
        description="Are you sure? Users with this role will be downgraded to 'Read Only' automatically."
        confirmLabel="Delete Role"
        destructive
        onConfirm={() => confirmDel && deleteMutation.mutate(confirmDel)}
      />
    </div>
  );
}
