import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCurrency } from "@/lib/format";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<any>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => await api.get("/products"),
  });

  const filtered = products.filter((p: any) => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const deleteProd = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await api.delete(`/products/${id}`);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Product Catalog</h1>
          <p className="text-sm text-muted-foreground">Manage products and services for your quotes.</p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => { setEditingProd(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        )}
      </div>

      <div className="flex gap-2 items-center bg-card border rounded-lg p-2 max-w-sm">
        <Search className="w-4 h-4 text-muted-foreground ml-2" />
        <Input 
          className="border-0 bg-transparent focus-visible:ring-0 shadow-none" 
          placeholder="Search by name or SKU..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center p-8 text-muted-foreground">Loading products...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center p-8 text-muted-foreground">No products found.</TableCell></TableRow>
            ) : (
              filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.sku || "—"}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-md truncate">{p.description || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{fmtCurrency(p.unit_price)}</TableCell>
                  <TableCell className="text-right">
                    {!isReadOnly && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditingProd(p); setOpen(true); }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteProd(p.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingProd ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
          <ProductForm 
            initial={editingProd} 
            onSave={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); }} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({ initial, onSave }: { initial: any; onSave: () => void }) {
  const [f, setF] = useState({
    name: initial?.name || "",
    sku: initial?.sku || "",
    description: initial?.description || "",
    unit_price: initial?.unit_price || 0
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (initial?.id) {
        await api.put(`/products/${initial.id}`, { ...f, unit_price: Number(f.unit_price) });
        toast.success("Product updated");
      } else {
        await api.post("/products", { ...f, unit_price: Number(f.unit_price) });
        toast.success("Product created");
      }
      onSave();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save product");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 mt-4">
      <div>
        <Label>Product Name</Label>
        <Input className="mt-1" value={f.name} onChange={e => setF({...f, name: e.target.value})} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>SKU</Label>
          <Input className="mt-1" value={f.sku} onChange={e => setF({...f, sku: e.target.value})} />
        </div>
        <div>
          <Label>Unit Price</Label>
          <Input type="number" step="0.01" min="0" className="mt-1" value={f.unit_price} onChange={e => setF({...f, unit_price: Number(e.target.value)})} required />
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea className="mt-1" rows={3} value={f.description} onChange={e => setF({...f, description: e.target.value})} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : "Save Product"}</Button>
      </DialogFooter>
    </form>
  );
}
