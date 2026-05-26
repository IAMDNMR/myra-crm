import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Shield, ShieldCheck, ShieldHalf, ShieldBan } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/settings/team")({
  component: TeamSettings,
});

function TeamSettings() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
    role_id: "",
  });

  const { data: users = [] } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const data = await api.get("/profiles");
      return data.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get("/roles"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/profiles", data),
    onSuccess: () => {
      toast.success("User added successfully");
      setOpen(false);
      setNewUser({ full_name: "", email: "", password: "", role_id: "" });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to add user"),
  });

  const updateRole = async (id: string, role_id: string) => {
    try {
      await api.put(`/profiles/${id}`, { role_id });
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
    }
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password) {
      toast.error("Email and password are required");
      return;
    }
    const payload = { ...newUser };
    if (!payload.role_id && roles.length > 0) {
      payload.role_id = roles.find((r:any) => r.name === "rep")?.id || roles[0].id;
    }
    createMutation.mutate(payload);
  };

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-semibold">Team Members ({users.length})</h2>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Add New Team Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddUser} className="space-y-4 pt-2">
                <div className="grid gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase">Full Name</Label>
                    <Input 
                      className="mt-1.5" 
                      placeholder="Jane Doe" 
                      value={newUser.full_name} 
                      onChange={e => setNewUser({...newUser, full_name: e.target.value})} 
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase">Email Address *</Label>
                    <Input 
                      className="mt-1.5" 
                      type="email" 
                      placeholder="jane@company.com" 
                      required 
                      value={newUser.email} 
                      onChange={e => setNewUser({...newUser, email: e.target.value})} 
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase">Temporary Password *</Label>
                    <Input 
                      className="mt-1.5" 
                      type="password" 
                      required 
                      value={newUser.password} 
                      onChange={e => setNewUser({...newUser, password: e.target.value})} 
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">They can change this after logging in.</p>
                  </div>
                  
                  <div className="pt-2">
                    <Label className="text-xs text-muted-foreground uppercase mb-2 block">Role Selection</Label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {roles.map((r: any) => {
                        const isSelected = newUser.role_id === r.id || (!newUser.role_id && r.name === "rep");
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setNewUser({...newUser, role_id: r.id})}
                            className={`flex flex-col items-start gap-1 p-2.5 rounded-lg border text-sm transition-all text-left ${
                              isSelected 
                                ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary" 
                                : "border-muted hover:border-muted-foreground/30 text-muted-foreground"
                            }`}
                          >
                            <span className="font-medium capitalize">{r.name}</span>
                            <span className="text-xs opacity-80 truncate w-full">{r.description || "Custom role"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Adding..." : "Add Member"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground"><tr><th className="p-3 text-left">Name</th><th className="p-3 text-left">Email</th><th className="p-3 text-left">Role</th></tr></thead>
        <tbody>
          {users.map((u: any) => (
            <tr key={u.id} className="border-t hover:bg-muted/20">
              <td className="p-3 font-medium">{u.full_name ?? "—"}</td>
              <td className="p-3 text-muted-foreground">{u.email}</td>
              <td className="p-3">
                {isAdmin ? (
                  <select value={u.role_id || ""} onChange={(e) => updateRole(u.id, e.target.value)} className="h-8 px-2 border rounded-md text-sm bg-background">
                    {roles.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                ) : <Badge variant="secondary" className="capitalize">
                      {roles.find((r:any) => r.id === u.role_id)?.name || u.role}
                    </Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!isAdmin && <p className="p-4 text-xs text-muted-foreground border-t">Only admins can add users or change roles.</p>}
    </div>
  );
}
