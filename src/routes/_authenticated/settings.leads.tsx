import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/leads")({
  component: LeadsSettings,
});

function LeadsSettings() {
  const qc = useQueryClient();
  const [newSource, setNewSource] = useState("");

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["lead-sources"],
    queryFn: () => api.get("/settings/lead-sources"),
  });

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource.trim()) return;
    try {
      await api.post("/settings/lead-sources", { name: newSource });
      setNewSource("");
      qc.invalidateQueries({ queryKey: ["lead-sources"] });
      toast.success("Source added");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await api.delete(`/settings/lead-sources/${id}`);
      qc.invalidateQueries({ queryKey: ["lead-sources"] });
      toast.success("Source deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Lead Sources</h2>
        <p className="text-sm text-muted-foreground">
          Configure predefined sources for new leads (e.g., Website, Referral, LinkedIn).
        </p>
      </div>

      <div className="bg-card border rounded-lg p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {sources.map((src: any) => (
              <li key={src.id} className="flex items-center justify-between p-2 hover:bg-accent rounded-md">
                <span className="text-sm font-medium">{src.name}</span>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteSource(src.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </li>
            ))}
            {sources.length === 0 && (
              <li className="text-sm text-muted-foreground p-2">No sources defined yet.</li>
            )}
          </ul>
        )}
        <form onSubmit={handleAddSource} className="flex gap-2">
          <Input 
            placeholder="Add new source..." 
            value={newSource} 
            onChange={(e) => setNewSource(e.target.value)} 
          />
          <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </form>
      </div>
    </div>
  );
}
