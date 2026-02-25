import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Clock, CheckCircle2, Bell, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CHANNEL_NAME = "fresh-start-patient-calls";

interface PatientCall {
    id: string;
    patient_id: string;
    patient_name: string;
    called_by_name: string;
    called_at: string;
    room_name?: string;
}

const PainelChamada = () => {
    const [currentCall, setCurrentCall] = useState<PatientCall | null>(() => {
        try {
            const saved = localStorage.getItem("last_patient_call");
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [recentCalls, setRecentCalls] = useState<PatientCall[]>(() => {
        try {
            const saved = localStorage.getItem("recent_patient_calls");
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [animKey, setAnimKey] = useState(0);
    const [time, setTime] = useState(new Date());
    const [audioEnabled, setAudioEnabled] = useState(() => {
        return localStorage.getItem("panel_audio_enabled") === "true";
    });

    // Clock
    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

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
            console.error("Audio/Voice error:", e);
        }
    };

    useEffect(() => {
        const handleNewCall = (payload: PatientCall) => {
            setCurrentCall(payload);
            setAnimKey((k) => k + 1);
            setRecentCalls((prev) => {
                if (prev.find(c => c.id === payload.id)) return prev;
                const updated = [payload, ...prev.slice(0, 7)];
                localStorage.setItem("recent_patient_calls", JSON.stringify(updated));
                return updated;
            });
            localStorage.setItem("last_patient_call", JSON.stringify(payload));
            playFeedback(payload.patient_name, payload.room_name);
        };

        const broadcastChannel = supabase
            .channel(CHANNEL_NAME)
            .on(
                "broadcast",
                { event: "patient-called" },
                ({ payload }: { payload: PatientCall }) => handleNewCall(payload)
            )
            .subscribe();

        const dbChannel = supabase
            .channel("db-changes")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "patient_calls" },
                (payload) => handleNewCall(payload.new as PatientCall)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(broadcastChannel);
            supabase.removeChannel(dbChannel);
        };
    }, [audioEnabled]);

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
        });

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{
                background: "#080b18",
                color: "white",
                fontFamily: "'Inter', sans-serif",
            }}
        >
            <header
                className="flex items-center justify-between px-10 py-6 bg-black/20"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
                <div className="flex items-center gap-4">
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary accent-glow"
                    >
                        <Monitor className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                        <h1 className="font-display font-bold text-xl tracking-tight">
                            Painel de Chamadas
                        </h1>
                        <p className="text-muted-foreground text-xs uppercase font-bold tracking-widest opacity-60">
                            OdontoClinic
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => {
                            const newState = !audioEnabled;
                            setAudioEnabled(newState);
                            localStorage.setItem("panel_audio_enabled", String(newState));

                            if (newState) {
                                // Unlock audio context
                                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                                const ctx = new AudioContextClass();
                                const osc = ctx.createOscillator();
                                osc.connect(ctx.destination);
                                osc.start(0);
                                osc.stop(0.1);
                                toast.success("Áudio ativado para este navegador");
                            }
                        }}
                        className={cn(
                            "px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2",
                            audioEnabled
                                ? "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                                : "bg-primary animate-pulse text-primary-foreground accent-glow"
                        )}
                    >
                        {audioEnabled ? "🔊 ÁUDIO ATIVO" : "🔈 ATIVAR ÁUDIO"}
                    </button>

                    {audioEnabled && (
                        <button
                            onClick={() => playFeedback("Teste de Áudio", "Consultório de Teste")}
                            className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                            title="Testar som"
                        >
                            <Bell className="w-5 h-5 text-primary" />
                        </button>
                    )}
                    <div className="flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-2xl border border-white/5">
                        <Clock className="w-5 h-5 text-primary" />
                        <span className="font-mono font-bold text-2xl tabular-nums">
                            {time.toLocaleTimeString("pt-BR")}
                        </span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                <main className="flex-1 flex flex-col items-center justify-center p-12 relative">
                    <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full translate-y-1/4" />

                    {currentCall ? (
                        <div
                            key={animKey}
                            className="relative z-10 text-center"
                            style={{ animation: "callIn 0.8s cubic-bezier(0.34,1.56,0.64,1) both" }}
                        >
                            <div className="flex justify-center mb-8">
                                <span className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full text-sm font-bold bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
                                    ATENDIMENTO EM CURSO
                                </span>
                            </div>

                            <div className="flex justify-center mb-10">
                                <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-[0_0_80px_rgba(var(--primary),0.4)]" style={{ animation: "pulse 2.5s ease-in-out infinite" }}>
                                    <Bell className="w-16 h-16 text-white" />
                                </div>
                            </div>

                            <p className="text-muted-foreground text-lg font-semibold uppercase tracking-[0.3em] mb-4 opacity-50">
                                Chamando Paciente
                            </p>

                            <h1 className="font-display font-black leading-[0.9] text-white mb-8" style={{ fontSize: "clamp(3.5rem, 8vw, 6.5rem)", textShadow: "0 0 60px rgba(var(--primary),0.3)" }}>
                                {currentCall.patient_name}
                            </h1>

                            {currentCall.room_name && (
                                <div className="flex justify-center mt-12">
                                    <div className="px-10 py-5 rounded-[2rem] flex items-center gap-4 border-2 border-primary/30 bg-primary/5 animate-bounce shadow-[0_0_40px_rgba(var(--primary),0.2)]">
                                        <DoorOpen className="w-10 h-10 text-primary" />
                                        <span className="text-4xl font-black text-white uppercase tracking-tighter">
                                            {currentCall.room_name}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <p className="text-muted-foreground text-lg mt-12 font-medium">
                                Chamado por <span className="text-white font-bold">{currentCall.called_by_name}</span> às {formatTime(currentCall.called_at)}
                            </p>
                        </div>
                    ) : (
                        <div className="relative z-10 text-center">
                            <div className="w-32 h-32 rounded-[2.5rem] bg-white/5 flex items-center justify-center mx-auto mb-8 border border-white/5">
                                <Monitor className="w-16 h-16 text-white/10" />
                            </div>
                            <h2 className="text-4xl font-display font-bold text-white/20">
                                Aguardando chamadas...
                            </h2>
                            <p className="text-white/10 text-lg mt-4 font-medium uppercase tracking-widest">
                                Recepção • OdontoClinic
                            </p>
                        </div>
                    )}
                </main>

                <aside className="w-full lg:w-[400px] bg-black/10 border-l border-white/5 p-8 flex flex-col backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-8 opacity-40">
                        <Clock className="w-5 h-5" />
                        <h3 className="font-bold text-sm uppercase tracking-widest">Histórico Recente</h3>
                    </div>

                    <div className="flex-1 space-y-4">
                        {recentCalls.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-10">
                                <CheckCircle2 className="w-12 h-12 mb-4" />
                                <p className="font-medium uppercase tracking-wider text-sm">Sem histórico</p>
                            </div>
                        ) : (
                            recentCalls.map((call, i) => (
                                <div
                                    key={call.id}
                                    className={cn(
                                        "flex items-center gap-4 p-5 rounded-2xl transition-all border",
                                        i === 0
                                            ? "bg-primary/10 border-primary/20 shadow-[0_4px_15px_rgba(var(--primary),0.1)]"
                                            : "bg-white/5 border-white/5 opacity-50"
                                    )}
                                >
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                                        i === 0 ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/20"
                                    )}>
                                        {call.patient_name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            "font-bold truncate text-lg tracking-tight",
                                            i === 0 ? "text-white" : "text-white/40"
                                        )}>
                                            {call.patient_name}
                                        </p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-xs font-bold uppercase tracking-widest opacity-40">
                                                {call.room_name || "CONSULTÓRIO"}
                                            </span>
                                            <span className="text-xs font-mono opacity-30">
                                                {formatTime(call.called_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <footer className="mt-8 pt-8 border-t border-white/5 text-center opacity-20">
                        <p className="text-[10px] uppercase font-black tracking-[0.2em]">Fresh Start Project • 2026</p>
                    </footer>
                </aside>
            </div>

            <style>{`
        @keyframes callIn {
          from { opacity: 0; transform: scale(0.9) translateY(40px); filter: blur(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 80px rgba(var(--primary),0.4); transform: scale(1); }
          50%       { box-shadow: 0 0 120px rgba(var(--primary),0.7); transform: scale(1.05); }
        }
      `}</style>
        </div>
    );
};

export default PainelChamada;
