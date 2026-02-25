import React, { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import {
    Search,
    Plus,
    Filter,
    MoreHorizontal,
    Save,
    Printer,
    UserPlus,
    User,
    Heart,
    Stethoscope,
    FileText,
    Activity,
    ClipboardList,
    Calendar,
    Megaphone,
    DoorOpen,
    Trash2,
    Pencil
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePatientCall } from "@/contexts/PatientCallContext";
import { motion } from "framer-motion";

const Pacientes = () => {
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const { callPatient, loading: callingLoading } = usePatientCall();
    const [rooms, setRooms] = useState<any[]>([]);
    const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
    const [callingPatient, setCallingPatient] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const { data } = await supabase.from("consulting_rooms" as any).select("id, name");
                if (data) setRooms(data);
            } catch (e) { }
        };
        fetchRooms();
    }, []);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("patients")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setPatients(data || []);
        } catch (error: any) {
            console.error("Error fetching patients:", error.message);
            toast.error("Erro ao carregar pacientes.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    const handleCallPatient = (id: string, name: string) => {
        const savedRoomId = localStorage.getItem("last_selected_room");
        if (savedRoomId && rooms.find(r => r.id === savedRoomId)) {
            const room = rooms.find(r => r.id === savedRoomId);
            callPatient(id, name, room.id, room.name);
        } else {
            setCallingPatient({ id, name });
            setIsRoomDialogOpen(true);
        }
    };

    const performCall = (roomId: string) => {
        const room = rooms.find(r => r.id === roomId);
        if (!room || !callingPatient) return;
        localStorage.setItem("last_selected_room", roomId);
        callPatient(callingPatient.id, callingPatient.name, room.id, room.name);
        setIsRoomDialogOpen(false);
    };

    const filtered = patients.filter(
        (p) =>
            (p.full_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
            (p.cpf || "").includes(searchQuery),
    );

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">Pacientes</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {patients.length} pacientes cadastrados
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-border"
                        onClick={() => toast.info("Funcionalidade em desenvolvimento")}
                    >
                        <Printer className="w-4 h-4" /> Imprimir
                    </Button>
                    <Button className="gap-2 bg-primary text-primary-foreground accent-glow" onClick={() => setIsDialogOpen(true)}>
                        <Plus className="w-4 h-4" /> Novo Paciente
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nome ou CPF..."
                    className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                />
            </div>

            <div className="stat-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left py-4 px-4 font-medium text-muted-foreground">Paciente</th>
                                <th className="text-left py-4 px-4 font-medium text-muted-foreground">CPF</th>
                                <th className="text-left py-4 px-4 font-medium text-muted-foreground">E-mail</th>
                                <th className="text-left py-4 px-4 font-medium text-muted-foreground">Cadastro</th>
                                <th className="w-20 px-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                                        Nenhum paciente encontrado.
                                    </td>
                                </tr>
                            ) : filtered.map((p) => (
                                <tr
                                    key={p.id}
                                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                                >
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {(p.full_name || "?").charAt(0)}
                                            </div>
                                            <span className="font-semibold text-foreground">
                                                {p.full_name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-muted-foreground">{p.cpf || "—"}</td>
                                    <td className="py-4 px-4 text-muted-foreground">{p.email || "—"}</td>
                                    <td className="py-4 px-4 text-muted-foreground">
                                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                                    </td>
                                    <td className="py-4 px-4">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                                                    <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-card border-border">
                                                <DropdownMenuItem onClick={() => navigate(`/prontuario/${p.id}`)}>
                                                    <ClipboardList className="w-4 h-4 mr-2" /> Abrir Prontuário
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleCallPatient(p.id, p.full_name)} disabled={callingLoading} className="text-blue-500 focus:text-blue-500 focus:bg-blue-500/10">
                                                    <Megaphone className="w-4 h-4 mr-2" /> Chamar Paciente
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-border" />
                                                <DropdownMenuItem className="text-destructive focus:bg-destructive/10">
                                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
                <DialogContent className="max-w-sm bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>Qual sala você ocupa agora?</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-2 pt-4">
                        {rooms.map(room => (
                            <Button
                                key={room.id}
                                variant="outline"
                                className="justify-start gap-4 h-14 border-border hover:border-primary hover:bg-primary/5 group"
                                onClick={() => performCall(room.id)}
                            >
                                <div className="w-8 h-8 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                    <DoorOpen className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                </div>
                                <span className="font-semibold">{room.name}</span>
                            </Button>
                        ))}
                        {rooms.length === 0 && (
                            <p className="text-sm text-center text-muted-foreground py-6">
                                Nenhum consultório cadastrado. <br />
                                <Button variant="link" onClick={() => navigate("/consultorios")} className="text-primary mt-2">Cadastrar um agora</Button>
                            </p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
};

export default Pacientes;
