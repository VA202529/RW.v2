import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GenericBadge } from "@/components/status-badge";
import { orders, products as initialProducts, type Product } from "@/lib/mock-data";
import { ImageIcon, Package, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/webshop")({
  head: () => ({
    meta: [
      { title: "Webshop — BarberFlow" },
      { name: "description", content: "Beheer producten en bestellingen in je RW CUTZZ webshop." },
      { property: "og:title", content: "Webshop — BarberFlow" },
      { property: "og:description", content: "Producten en bestellingen op één plek." },
    ],
  }),
  component: WebshopPage,
});

const orderStatusTone: Record<
  (typeof orders)[number]["status"],
  { tone: "warning" | "info" | "success" | "danger"; label: string }
> = {
  processing: { tone: "warning", label: "In behandeling" },
  ready: { tone: "info", label: "Klaar" },
  picked_up: { tone: "success", label: "Afgehaald" },
  cancelled: { tone: "danger", label: "Geannuleerd" },
};

function WebshopPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [editing, setEditing] = useState<Product | null>(null);

  const save = (p: Product) => {
    if (p.id === "new") {
      setProducts([...products, { ...p, id: `p${products.length + 1}` }]);
      toast.success("Product toegevoegd");
    } else {
      setProducts(products.map((x) => (x.id === p.id ? p : x)));
      toast.success("Product bijgewerkt");
    }
    setEditing(null);
  };

  return (
    <>
      <AppHeader title="Webshop" large subtitle="Producten en bestellingen" />
      <PageHeader
        title="Webshop"
        actions={
          <Button
            size="sm"
            onClick={() =>
              setEditing({
                id: "new",
                name: "",
                description: "",
                price: 10,
                stock: 1,
                category: "Styling",
                active: true,
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Product toevoegen
          </Button>
        }
      />
      <div className="p-4 lg:p-8">
        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Producten</TabsTrigger>
            <TabsTrigger value="orders">Bestellingen</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setEditing(p)}
                  className="text-left rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors"
                >
                  <div className="aspect-video bg-gradient-to-br from-muted to-secondary grid place-items-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.category}
                        </div>
                      </div>
                      <div className="text-sm font-semibold">€{p.price}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      {p.stock === 0 ? (
                        <GenericBadge tone="danger">Uitverkocht</GenericBadge>
                      ) : p.stock < 5 ? (
                        <GenericBadge tone="warning">Lage voorraad · {p.stock}</GenericBadge>
                      ) : (
                        <GenericBadge tone="success">Voorraad · {p.stock}</GenericBadge>
                      )}
                      {!p.active && <GenericBadge tone="muted">Inactief</GenericBadge>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Klant</TableHead>
                    <TableHead>Producten</TableHead>
                    <TableHead>Totaal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="w-24">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const s = orderStatusTone[o.status];
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.customerName}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          <div className="flex items-center gap-1.5">
                            <Package className="h-3 w-3" />
                            {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                          </div>
                        </TableCell>
                        <TableCell>€{o.total}</TableCell>
                        <TableCell>
                          <GenericBadge tone={s.tone}>{s.label}</GenericBadge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(o.date).toLocaleDateString("nl-NL")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.success("Status bijgewerkt")}
                          >
                            Update
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ProductEditor product={editing} onClose={() => setEditing(null)} onSave={save} />
    </>
  );
}

function ProductEditor({
  product,
  onClose,
  onSave,
}: {
  product: Product | null;
  onClose: () => void;
  onSave: (p: Product) => void;
}) {
  const [form, setForm] = useState<Product | null>(product);
  if (product && (!form || form.id !== product.id)) setForm(product);

  return (
    <Dialog open={!!product} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {product?.id === "new" ? "Nieuw product" : "Product bewerken"}
          </DialogTitle>
        </DialogHeader>
        {form && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Naam</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Beschrijving</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Prijs (€)</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Voorraad</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Categorie</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>Actief</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button onClick={() => form && onSave(form)}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
