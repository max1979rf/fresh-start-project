import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Clock } from "lucide-react";
import { useData } from "../contexts/DataContext";

export default function ExpiryReminder() {
    const { contratosVencendo } = useData();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Show only once per session
        const shownKey = 'lwp_expiryReminderShown';
        if (sessionStorage.getItem(shownKey)) return;
        if (contratosVencendo.length === 0) return;

        sessionStorage.setItem(shownKey, 'true');
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 5000);
        return () => clearTimeout(timer);
    }, [contratosVencendo]);

    if (contratosVencendo.length === 0) return null;

    const vencidos = contratosVencendo.filter(c => c.status === 'Vencido');
    const vencendo = contratosVencendo.filter(c => c.status !== 'Vencido');

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: -20, x: 20 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={{ opacity: 0, y: -20, x: 20 }}
                    className="fixed top-20 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]"
                >
                    <div
                        className="bg-card border border-warning/30 rounded-xl p-4 space-y-2"
                        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-warning/10">
                                    <AlertTriangle className="w-4 h-4 text-warning" />
                                </div>
                                <h4 className="text-sm font-semibold text-foreground">Atenção — Contratos</h4>
                            </div>
                            <button onClick={() => setVisible(false)} className="p-1 rounded hover:bg-secondary transition-colors">
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                        </div>

                        {vencidos.length > 0 && (
                            <p className="text-xs text-destructive font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {vencidos.length} contrato{vencidos.length > 1 ? 's' : ''} vencido{vencidos.length > 1 ? 's' : ''}
                            </p>
                        )}
                        {vencendo.length > 0 && (
                            <p className="text-xs text-warning font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {vencendo.length} contrato{vencendo.length > 1 ? 's' : ''} próximo{vencendo.length > 1 ? 's' : ''} do vencimento
                            </p>
                        )}

                        <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                            {contratosVencendo.slice(0, 4).map(c => (
                                <div key={c.id} className="text-xs text-muted-foreground flex justify-between">
                                    <span className="truncate">{c.numero} — {c.empresa}</span>
                                    <span className={`flex-shrink-0 ml-2 font-medium ${c.status === 'Vencido' ? 'text-destructive' : 'text-warning'}`}>
                                        {c.dataVencimento}
                                    </span>
                                </div>
                            ))}
                            {contratosVencendo.length > 4 && (
                                <p className="text-xs text-muted-foreground">+ {contratosVencendo.length - 4} outros...</p>
                            )}
                        </div>

                        {/* Progress bar for auto-dismiss */}
                        <motion.div
                            initial={{ scaleX: 1 }}
                            animate={{ scaleX: 0 }}
                            transition={{ duration: 5, ease: "linear" }}
                            className="h-0.5 bg-warning/40 rounded-full origin-left mt-2"
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
