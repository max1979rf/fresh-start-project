import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, AlertTriangle, FileWarning, CheckCircle2, Loader2 } from 'lucide-react';

export interface AnalysisResult {
    hasAbusiveClauses: boolean;
    missingSignature: boolean;
    findings: string[];
    autoFilled: boolean;
}

interface Props {
    result: AnalysisResult | null;
    loading: boolean;
    onClose: () => void;
}

export default function AnalysisAlert({ result, loading, onClose }: Props) {
    const [visible, setVisible] = useState(false);
    const [progress, setProgress] = useState(100);

    const handleClose = useCallback(() => {
        setVisible(false);
        setTimeout(onClose, 300);
    }, [onClose]);

    useEffect(() => {
        if (loading || result) {
            setVisible(true);
            setProgress(100);
        }
    }, [loading, result]);

    // Auto-dismiss after 8 seconds when results are shown
    useEffect(() => {
        if (!result || loading) return;

        const duration = 8000;
        const interval = 50;
        const step = (interval / duration) * 100;
        const timer = setInterval(() => {
            setProgress(prev => {
                const next = prev - step;
                if (next <= 0) {
                    clearInterval(timer);
                    handleClose();
                    return 0;
                }
                return next;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [result, loading, handleClose]);

    const hasCritical = result?.hasAbusiveClauses || result?.missingSignature;
    const borderColor = loading
        ? 'border-blue-400/50'
        : hasCritical
            ? 'border-red-400/50'
            : 'border-green-400/50';

    const bgGradient = loading
        ? 'from-blue-50 to-white'
        : hasCritical
            ? 'from-red-50 to-white'
            : 'from-green-50 to-white';

    const progressColor = loading
        ? 'bg-blue-400'
        : hasCritical
            ? 'bg-red-400'
            : 'bg-green-400';

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`fixed top-4 right-4 z-[100] w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border-2 ${borderColor} bg-gradient-to-br ${bgGradient} shadow-2xl overflow-hidden`}
                >
                    {/* Progress bar */}
                    {!loading && (
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gray-200/50">
                            <div
                                className={`h-full ${progressColor} transition-all duration-50`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}

                    <div className="p-5">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2.5">
                                {loading ? (
                                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                    </div>
                                ) : hasCritical ? (
                                    <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                                        <ShieldAlert className="w-5 h-5 text-red-600" />
                                    </div>
                                ) : (
                                    <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
                                        {loading ? 'Analisando contrato...' : 'Análise da IA concluída'}
                                    </h4>
                                    <p className="text-[11px] text-gray-500">
                                        {loading
                                            ? 'Extraindo texto e verificando cláusulas'
                                            : hasCritical
                                                ? 'Atenção: problemas encontrados'
                                                : 'Nenhum problema crítico detectado'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-1 rounded-md hover:bg-gray-200/50 transition-colors flex-shrink-0"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>

                        {/* Auto-fill info */}
                        {result?.autoFilled && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200/50 mb-3">
                                <FileWarning className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                <p className="text-[11px] text-blue-700 font-medium">
                                    Campos do formulário preenchidos automaticamente — verifique os dados.
                                </p>
                            </div>
                        )}

                        {/* Findings */}
                        {result && result.findings.length > 0 && (
                            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                {result.findings.map((f, i) => (
                                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/70 border border-gray-100">
                                        <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${f.startsWith('🔴') ? 'text-red-500' : f.startsWith('⚠️') ? 'text-amber-500' : 'text-blue-500'
                                            }`} />
                                        <p className="text-xs text-gray-700">{f.replace(/^[⚠️🔴⚡]\s*/, '')}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {result && result.findings.length === 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200/50">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                <p className="text-xs text-green-700">Documento sem irregularidades aparentes.</p>
                            </div>
                        )}

                        {/* Loading skeleton */}
                        {loading && (
                            <div className="space-y-2">
                                <div className="h-8 rounded-lg bg-blue-100/50 animate-pulse" />
                                <div className="h-8 rounded-lg bg-blue-100/30 animate-pulse" />
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
