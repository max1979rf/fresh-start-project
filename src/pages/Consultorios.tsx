import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Plus, Pencil, Trash2, DoorOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface Room {
    id: string;
    name: string;
    description: string | null;
}

export default function Consultorios() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const navigate = useNavigate();

    const fetchRooms = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("consulting_rooms" as any)
                .select("*")
                .order("name");

            if (error) {
                toast.error("Erro ao carregar consultórios");
            } else {
                setRooms((data as any) || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;

        try {
            if (editingRoom) {
                const { error } = await supabase
                    .from("consulting_rooms" as any)
                    .update({ name, description })
                    .eq("id", editingRoom.id);

                if (error) throw error;
                toast.success("Consultório atualizado!");
            } else {
                const { error } = await supabase
                    .from("consulting_rooms" as any)
                    .insert([{ name, description }]);

                if (error) throw error;
                toast.success("Consultório criado!");
            }
            setOpen(false);
            setEditingRoom(null);
            fetchRooms();
        } catch (err: any) {
            toast.error(err.message || "Erro ao salvar consultório");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir este consultório?")) return;
        try {
            const { error } = await supabase.from("consulting_rooms" as any).delete().eq("id", id);
            if (error) throw error;
            toast.success("Consultório excluído!");
            fetchRooms();
        } catch (err: any) {
            toast.error(err.message || "Erro ao excluir consultório");
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate("/")}
                        className="rounded-full hover:bg-secondary"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground">Consultórios</h1>
                        <p className="text-sm text-muted-foreground mt-1">Gerencie os consultórios da clínica</p>
                    </div>
                </div>

                <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setEditingRoom(null); }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 bg-primary text-primary-foreground accent-glow">
                            <Plus className="w-4 h-4" /> Novo Consultório
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border">
                        <DialogHeader>
                            <DialogTitle>{editingRoom ? "Editar Consultório" : "Novo Consultório"}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome do Consultório</Label>
                                <Input id="name" name="name" defaultValue={editingRoom?.name} placeholder="Ex: Sala 01, Ortodontia..." required className="bg-background border-input" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Descrição (Opcional)</Label>
                                <Input id="description" name="description" defaultValue={editingRoom?.description || ""} placeholder="Ex: Consultório principal" className="bg-background border-input" />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                                <Button type="submit">Salvar</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rooms.map((room) => (
                        <div key={room.id} className="bg-card rounded-xl border border-border p-6 flex items-start justify-between group transition-all hover:border-primary/50" style={{ boxShadow: "var(--shadow-sm)" }}>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <DoorOpen className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">{room.name}</h3>
                                    <p className="text-sm text-muted-foreground">{room.description || "Sem descrição"}</p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" onClick={() => { setEditingRoom(room); setOpen(true); }} className="h-8 w-8">
                                    <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(room.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {rooms.length === 0 && (
                        <div className="col-span-full py-12 text-center bg-card rounded-xl border border-dashed border-border text-muted-foreground">
                            Nenhum consultório cadastrado.
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
}
