import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { EntityCombo } from "./EntityCombo";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { dealSchema, type DealFormData } from "@/lib/schemas";

export function DealForm({ deal, onSave, defaultStageId }: { deal?: any; onSave: () => void; defaultStageId?: string | null }) {
  const { user } = useAuth();
  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const data = await api.get("/pipelines");
      return Array.isArray(data) ? data : [];
    },
  });
  const defaultPipeline: any = pipelines.find((p: any) => p.is_default) ?? pipelines[0];
  const stages = (defaultPipeline?.stages ?? []).sort((a: any, b: any) => a.order_index - b.order_index);

  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      name: deal?.name ?? "",
      value: deal?.value ?? 0,
      pipeline_id: deal?.pipeline_id ?? defaultPipeline?.id ?? null,
      stage_id: deal?.stage_id ?? defaultStageId ?? stages[0]?.id ?? null,
      contact_id: deal?.contact_id ?? null,
      company_id: deal?.company_id ?? null,
      owner_id: deal?.owner_id ?? user?.id ?? null,
      close_date: deal?.close_date ?? "",
      probability: deal?.probability ?? 0,
    }
  });

  const stage_id = watch("stage_id");
  const contact_id = watch("contact_id");
  const company_id = watch("company_id");
  const owner_id = watch("owner_id");

  const submit = async (f: DealFormData) => {
    setBusy(true);
    const payload = { ...f, value: Number(f.value), probability: Number(f.probability) || 0, close_date: f.close_date || null };
    try {
      if (deal) {
        await api.put(`/deals/${deal.id}`, payload);
      } else {
        await api.post("/deals", payload);
      }
      toast.success("Saved");
      onSave();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save deal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 mt-4">
      <div>
        <Label>Deal name *</Label>
        <Input {...register("name")} />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Value</Label>
          <Input type="number" {...register("value")} />
          {errors.value && <p className="text-xs text-red-500 mt-1">{errors.value.message}</p>}
        </div>
        <div>
          <Label>Probability %</Label>
          <Input type="number" min={0} max={100} {...register("probability")} />
          {errors.probability && <p className="text-xs text-red-500 mt-1">{errors.probability.message}</p>}
        </div>
      </div>
      <div>
        <Label>Stage</Label>
        <select className="w-full h-10 px-3 border rounded-md text-sm bg-background" {...register("stage_id")}>
          {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div><Label>Contact</Label><EntityCombo table="contacts" value={contact_id ?? null} onChange={(v) => setValue("contact_id", v)} /></div>
      <div><Label>Company</Label><EntityCombo table="companies" value={company_id ?? null} onChange={(v) => setValue("company_id", v)} /></div>
      <div><Label>Close date</Label><Input type="date" {...register("close_date")} /></div>
      <div><Label>Owner</Label><EntityCombo table="profiles" value={owner_id ?? null} onChange={(v) => setValue("owner_id", v)} /></div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : "Save Deal"}</Button>
    </form>
  );
}
