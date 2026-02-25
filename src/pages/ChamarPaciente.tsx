import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Megaphone, Calendar, Clock, DoorOpen, Search, Filter, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePatientCall } from "@/contexts/PatientCallContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface Appointment {
    id: string;
    patient_id: string;
    patient_name: string;
    appointment_time: string;
    procedure: string;
    status: string;
    consulting_room_id: string | null;
    room?: any;
}

interface Room {
    id: string;
    name: string;
}

export default function ChamarPaciente() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedRoomId, setSelectedRoomId] = useState<string>("");
    const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
    const [callingApt, setCallingApt] = useState<Appointment | null>(null);

    const { currentUser } = useAuth();
    const { callPatient, loading: callingLoading } = usePatientCall();
    const navigate = useNavigate();

    const fetchData = async () => {
        setLoading(true);
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            let query = supabase
                .from("appointments" as any)
                .select("*, room:consulting_rooms(name)")
                .gte("appointment_time", today.toISOString())
                .lt("appointment_time", tomorrow.toISOString())
                .order("appointment_time");

            // Add role-based filtering if needed, but project uses different role structure
            // For now, fetch all related to the current context

            const { data, error } = await (query as any);
            if (error) throw error;
            setAppointments((data as any) || []);

            const { data: rmData } = await supabase.from("consulting_rooms" as any).select("id, name");
            const roomsData = (rmData as any) || [];
            setRooms(roomsData);

            if (roomsData.length > 0) {
                const savedRoom = localStorage.getItem("last_selected_room");
                if (savedRoom && roomsData.find((r: any) => r.id === savedRoom)) {
                    setSelectedRoomId(savedRoom);
                } else if (roomsData.length === 1) {
                    setSelectedRoomId(roomsData[0].id);
                }
            }

        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar agendamentos do dia");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCallRequest = (apt: Appointment) => {
        setCallingApt(apt);
        if (selectedRoomId) {
            performCall(apt, selectedRoomId);
        } else {
            setIsRoomDialogOpen(true);
        }
    };

    const performCall = async (apt: Appointment, roomId: string) => {
        const room = rooms.find(r => r.id === roomId);
        if (!room) return;

        localStorage.setItem("last_selected_room", roomId);
        setSelectedRoomId(roomId);

        await callPatient(apt.patient_id, apt.patient_name, room.id, room.name);
        setIsRoomDialogOpen(false);

        setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, status: 'in_progress' } : a));

        await supabase.from("appointments" as any).update({ status: 'in_progress' }).eq("id", apt.id);
    };

    const filtered = appointments.filter(a =>
        a.patient_name.toLowerCase().includes(search.toLowerCase()) ||
        a.procedure.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                        <h1 className="text-2xl font-display font-bold text-foreground">Chamar Paciente</h1>
                        <p className="text-sm text-muted-foreground mt-1">Fila de espera baseada na agenda de hoje</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Seu Consultório</p>
                        <div className="flex items-center gap-2">
                            <DoorOpen className="w-4 h-4 text-primary" />
                            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                                <SelectTrigger className="w-[180px] h-8 text-xs bg-muted/50 border-0 focus:ring-1 focus:ring-primary">
                                    <SelectValue placeholder="Selecione sua sala..." />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                    {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="stat-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Filtrar por nome ou procedimento..."
                            className="pl-10 bg-muted/50 border-border h-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="gap-2 h-10 border-border">
                        <Filter className="w-4 h-4" /> Filtros
                    </Button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((apt) => (
                            <div
                                key={apt.id}
                                className={cn(
                                    "p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
                                    apt.status === 'in_progress' ? "bg-primary/5 border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.05)]" : "bg-card border-border hover:border-primary/30"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex flex-col items-center justify-center text-foreground shrink-0 border border-border">
                                        <span className="text-sm font-bold tracking-tight">
                                            {new Date(apt.appointment_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-foreground">{apt.patient_name}</h3>
                                            <Badge variant={apt.status === 'in_progress' ? "default" : "secondary"} className="text-[10px] h-4 uppercase font-bold tracking-wider">
                                                {apt.status === 'in_progress' ? "Em Atendimento" : apt.status === 'waiting' ? "Na Espera" : "Agendado"}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                            <Clock className="w-3.5 h-3.5" /> {apt.procedure}
                                            {apt.room && <> • <DoorOpen className="w-3.5 h-3.5 ml-1" /> {apt.room.name}</>}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => handleCallRequest(apt)}
                                        disabled={callingLoading || (apt.status === 'done')}
                                        className={cn(
                                            "gap-2 h-10 px-6 shrink-0 accent-glow",
                                            apt.status === 'in_progress' ? "bg-indigo-600 hover:bg-indigo-700" : "bg-primary"
                                        )}
                                    >
                                        <Megaphone className="w-4 h-4" />
                                        {apt.status === 'in_progress' ? "Chamar Novamente" : "Chamar Agora"}
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {filtered.length === 0 && (
                            <div className="py-16 text-center border border-dashed border-border rounded-xl">
                                <Calendar className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-muted-foreground font-medium">Nenhum agendamento encontrado para hoje.</p>
                            </div>
                        )}
                    </div>
                )}
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
                                onClick={() => callingApt && performCall(callingApt, room.id)}
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
                                Cadastre um consultório primeiro.
                            </p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
