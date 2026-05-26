import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CompanyForm } from "./companies";
import { ContactForm } from "./contacts";
import { fmtCurrency, fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/companies/$id")({
  component: CompanyDetail,
});

function CompanyDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => await api.get(`/companies/${id}`),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["company-contacts", id],
    queryFn: async () => {
      const allContacts = await api.get("/contacts?limit=1000");
      return (allContacts?.items || []).filter((c: any) => c.company_id === id);
    },
  });
  const { data: deals = [] } = useQuery({
    queryKey: ["company-deals", id],
    queryFn: async () => {
      const allDeals = await api.get("/deals?limit=1000");
      return (allDeals?.items || []).filter((d: any) => d.company_id === id);
    },
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["company-acts", id],
    queryFn: async () => {
      const cids = contacts.map((c: any) => c.id);
      if (cids.length === 0) return [];
      const allActs = await api.get("/activities?limit=1000");
      return (allActs?.items || [])
        .filter((a: any) => cids.includes(a.contact_id))
        .sort((a: any, b: any) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
    },
    enabled: contacts.length > 0,
  });

  if (!company) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/companies" className="text-sm text-muted-foreground hover:underline">← Back</Link>
      <div className="bg-card border rounded-lg p-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">{company.name}</h1>
          <div className="text-sm text-muted-foreground mt-1">{company.industry} · {company.size}</div>
          {company.website && <a href={company.website} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline mt-1 inline-block">{company.website}</a>}
        </div>
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetTrigger asChild><Button variant="outline" size="sm">Edit</Button></SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader><SheetTitle>Edit Company</SheetTitle></SheetHeader>
            <CompanyForm company={company} onSave={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["company", id] }); }} />
          </SheetContent>
        </Sheet>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({deals.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts">
          <div className="bg-card border rounded-lg p-5">
            <div className="flex justify-end mb-3">
              <Sheet open={addContactOpen} onOpenChange={setAddContactOpen}>
                <SheetTrigger asChild><Button size="sm" variant="outline">+ Add Contact</Button></SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader><SheetTitle>New Contact</SheetTitle></SheetHeader>
                  <ContactForm contact={{ company_id: id }} onSave={() => { setAddContactOpen(false); qc.invalidateQueries({ queryKey: ["company-contacts", id] }); }} />
                </SheetContent>
              </Sheet>
            </div>
            {contacts.length === 0 ? <p className="text-sm text-muted-foreground">No contacts</p> : (
              <ul className="space-y-2">
                {contacts.map((c: any) => (
                  <li key={c.id} className="flex justify-between py-2 border-b last:border-0">
                    <Link to="/contacts/$id" params={{ id: c.id }} className="font-medium hover:underline">{c.first_name} {c.last_name}</Link>
                    <span className="text-sm text-muted-foreground">{c.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="deals">
          <div className="bg-card border rounded-lg p-5">
            {deals.length === 0 ? <p className="text-sm text-muted-foreground">No deals</p> : (
              <ul className="space-y-2">
                {deals.map((d: any) => (
                  <li key={d.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <Link to="/deals/$id" params={{ id: d.id }} className="font-medium hover:underline">{d.name}</Link>
                    <div className="flex items-center gap-3">
                      <Badge style={{ backgroundColor: d.stages?.color, color: "white" }}>{d.stages?.name}</Badge>
                      <span>{fmtCurrency(d.value)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="activity">
          <div className="bg-card border rounded-lg p-5">
            {activities.length === 0 ? <p className="text-sm text-muted-foreground">No activity</p> : (
              <ul className="space-y-3">
                {activities.map((a: any) => (
                  <li key={a.id} className="text-sm pb-3 border-b last:border-0">
                    <div className="flex justify-between"><span className="font-medium">{a.subject ?? a.type}</span><span className="text-xs text-muted-foreground">{fmtDateTime(a.logged_at)}</span></div>
                    <div className="text-xs text-muted-foreground">{a.contacts?.first_name} {a.contacts?.last_name} · {a.profiles?.full_name}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
