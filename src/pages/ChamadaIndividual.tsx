import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Clock, ArrowLeft, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

const ChamadaIndividual = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patientName, setPatientName] = useState<string | null>(null);
    const [roomName, setRoomName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [time, setTime] = useState(new Date());
    const [audioEnabled, setAudioEnabled] = useState(false);

    // Clock
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const fetchPatientData = async () => {
            if (!id) return;
            try {
                // 1. Try fetching from patients table first
                const { data: patientData } = await supabase
                    .from("patients" as any)
                    .select("full_name")
                    .eq("id", id)
                    .maybeSingle();

                if (patientData) {
                    setPatientName((patientData as any).full_name);
                    setLoading(false);
                    return;
                }

                // 2. If not found, try fetching from patient_calls table
                const { data: callData } = await (supabase
                    .from("patient_calls" as any)
                    .select("patient_name, room_name")
                    .eq("id", id) as any)
                    .maybeSingle();

                if (callData) {
                    setPatientName(callData.patient_name);
                    setRoomName(callData.room_name);
                }
            } catch (error) {
                console.error("Error fetching patient:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPatientData();
    }, [id]);

    const playFeedback = (name: string, room?: string) => {
        if (!audioEnabled) return;
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.35, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.6);

            const utterance = new SpeechSynthesisUtterance(`Paciente, ${name}. Favor dirigir-se ao ${room || 'consultório'}`);
            utterance.lang = "pt-BR";
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error("Audio error:", e);
        }
    };

    useEffect(() => {
        if (!id) return;

        const handleNewCall = (payload: any) => {
            if (payload.patient_id === id || payload.id === id) {
                setPatientName(payload.patient_name);
                setRoomName(payload.room_name);
                playFeedback(payload.patient_name, payload.room_name);
            }
        };

        const broadcastChannel = supabase
            .channel("individual-broadcast")
            .on("broadcast", { event: "patient-called" }, ({ payload }) => handleNewCall(payload))
            .subscribe();

        const dbChannel = supabase
            .channel("individual-db")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "patient_calls" },
                (payload) => handleNewCall(payload.new)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(broadcastChannel);
            supabase.removeChannel(dbChannel);
        };
    }, [id, audioEnabled]);

    const enableAudio = () => {
        setAudioEnabled(true);
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) { }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{
                background: "black",
                color: "white",
                fontFamily: "'Inter', sans-serif",
            }}
        >
            <header
                className="flex items-center justify-between px-8 py-4 bg-white/5 border-b border-white/5"
            >
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate("/")}
                        className="text-white hover:bg-white/10"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary"
                    >
                        <Monitor className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-base leading-tight">
                            Chamada Individual
                        </p>
                        <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest">
                            OdontoClinic
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    {!audioEnabled && (
                        <Button
                            onClick={enableAudio}
                            className="bg-primary text-primary-foreground font-bold animate-pulse px-6 h-9 rounded-full text-xs"
                        >
                            🔈 ATIVAR ÁUDIO
                        </Button>
                    )}
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="font-mono font-bold text-xl">
                            {time.toLocaleTimeString("pt-BR")}
                        </span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center p-10">
                {patientName ? (
                    <div style={{ textAlign: "center", animation: "callIn 0.8s cubic-bezier(0.34,1.56,0.64,1) both" }}>
                        <div className="flex justify-center mb-8">
                            <span className="px-5 py-1.5 rounded-full text-xs font-black bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 uppercase tracking-widest">
                                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse mr-2 inline-block" />
                                Aguardando atendimento
                            </span>
                        </div>

                        <div className="flex justify-center mb-10">
                            <div className="w-28 h-28 rounded-3xl bg-primary flex items-center justify-center shadow-[0_0_80px_rgba(var(--primary),0.3)]" style={{ animation: "pulse 2s ease-in-out infinite" }}>
                                <Bell className="w-14 h-14 text-primary-foreground" />
                            </div>
                        </div>

                        <p className="text-white/40 text-sm uppercase font-black tracking-[0.4em] mb-4">
                            Chamando
                        </p>

                        <h1 className="font-display font-black text-white leading-none mb-4" style={{ fontSize: "clamp(3rem, 7vw, 6rem)" }}>
                            {patientName}
                        </h1>

                        {roomName && (
                            <div className="flex justify-center mt-8">
                                <div className="px-10 py-5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 animate-bounce">
                                    <Monitor className="w-10 h-10 text-primary" />
                                    <span className="text-4xl font-black text-white uppercase tracking-tighter">{roomName}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ textAlign: "center" }}>
                        <p className="text-2xl font-semibold mb-6 text-destructive">
                            Paciente não encontrado.
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => navigate("/")}
                            className="text-white border-white/20 px-10 h-11 rounded-full"
                        >
                            Voltar ao Início
                        </Button>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes callIn {
          from { opacity: 0; transform: scale(0.9) translateY(40px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.1); opacity: 0.9; }
        }
      `}</style>
        </div>
    );
};

export default ChamadaIndividual;
