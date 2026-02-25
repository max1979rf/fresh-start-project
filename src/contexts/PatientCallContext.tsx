import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

export interface PatientCall {
    id: string;
    patient_id: string;
    patient_name: string;
    called_by_name: string;
    called_at: string;
    consulting_room_id?: string;
    room_name?: string;
}

interface PatientCallContextType {
    currentCall: PatientCall | null;
    recentCalls: PatientCall[];
    callPatient: (patientId: string, patientName: string, roomId?: string, roomName?: string) => void;
    loading: boolean;
}

const PatientCallContext = createContext<PatientCallContextType | null>(null);

const CHANNEL_NAME = "fresh-start-patient-calls";

export function PatientCallProvider({
    children,
}: {
    children: React.ReactNode;
}) {
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

    const [loading, setLoading] = useState(false);
    const { currentUser } = useAuth();

    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        const channel = supabase
            .channel(CHANNEL_NAME)
            .on(
                "broadcast",
                { event: "patient-called" },
                ({ payload }: { payload: PatientCall }) => {
                    setCurrentCall(payload);
                    setRecentCalls((prev) => {
                        const updated = [payload, ...prev.slice(0, 9)];
                        localStorage.setItem("recent_patient_calls", JSON.stringify(updated));
                        return updated;
                    });
                    localStorage.setItem("last_patient_call", JSON.stringify(payload));
                },
            )
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    channelRef.current = channel;
                }
            });

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, []);

    const callPatient = useCallback(
        async (patientId: string, patientName: string, roomId?: string, roomName?: string) => {
            const ch = channelRef.current;
            if (!ch) {
                toast.error("Canal não conectado. Tentando reconectar...");
                return;
            }

            setLoading(true);

            try {
                const calledByName = currentUser?.nome || "Sistema";

                const callData = {
                    patient_id: patientId,
                    patient_name: patientName,
                    called_by_name: calledByName,
                    status: 'waiting',
                    consulting_room_id: roomId,
                    room_name: roomName
                };

                const { data, error } = await supabase.from("patient_calls" as any)
                    .insert([callData])
                    .select()
                    .single();

                if (error) throw error;

                const d = data as any;
                const call: PatientCall = {
                    id: d.id,
                    patient_id: d.patient_id,
                    patient_name: d.patient_name,
                    called_by_name: d.called_by_name,
                    called_at: d.called_at,
                    consulting_room_id: d.consulting_room_id,
                    room_name: d.room_name,
                };

                ch.send({
                    type: "broadcast",
                    event: "patient-called",
                    payload: call,
                });

                setCurrentCall(call);
                setRecentCalls((prev) => {
                    const updated = [call, ...prev.slice(0, 9)];
                    localStorage.setItem("recent_patient_calls", JSON.stringify(updated));
                    return updated;
                });
                localStorage.setItem("last_patient_call", JSON.stringify(call));
                toast.success(`📢 ${patientName} chamado(a)! ${roomName ? `(Sala: ${roomName})` : ''}`);
            } catch (err: any) {
                console.error("Error saving call:", err);
                toast.error("Erro ao chamar paciente.");
            } finally {
                setLoading(false);
            }
        },
        [currentUser],
    );

    return (
        <PatientCallContext.Provider
            value={{ currentCall, recentCalls, callPatient, loading }}
        >
            {children}
        </PatientCallContext.Provider>
    );
}

export function usePatientCall() {
    const ctx = useContext(PatientCallContext);
    if (!ctx)
        throw new Error("usePatientCall must be used inside PatientCallProvider");
    return ctx;
}
