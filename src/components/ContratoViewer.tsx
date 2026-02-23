import { X, Download, FileText, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface ContratoViewerProps {
    open: boolean;
    onClose: () => void;
    arquivoPdf?: string;
    nomeArquivo?: string;
    numeroContrato: string;
    objeto?: string;
    empresa?: string;
    status?: string;
    vencimento?: string;
}

function isStorageUrl(value?: string): boolean {
    if (!value) return false;
    return value.startsWith('http://') || value.startsWith('https://');
}

export default function ContratoViewer({ open, onClose, arquivoPdf, nomeArquivo, numeroContrato, objeto, empresa, status, vencimento }: ContratoViewerProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let currentUrl: string | null = null;

        if (open && arquivoPdf) {
            if (isStorageUrl(arquivoPdf)) {
                // Storage URL - use directly
                setBlobUrl(arquivoPdf);
                setLoading(false);
            } else if (arquivoPdf.startsWith('data:application/pdf')) {
                setLoading(true);
                try {
                    const base64Content = arquivoPdf.split(',')[1];
                    const byteCharacters = atob(base64Content);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'application/pdf' });
                    currentUrl = URL.createObjectURL(blob);
                    setBlobUrl(currentUrl);
                } catch (err) {
                    console.error("Erro ao gerar Blob URL do PDF:", err);
                    setBlobUrl(arquivoPdf);
                } finally {
                    setLoading(false);
                }
            } else {
                setBlobUrl(arquivoPdf);
            }
        } else {
            setBlobUrl(null);
        }

        return () => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }
        };
    }, [open, arquivoPdf]);

    if (!open) return null;

    const handleDownload = () => {
        if (!arquivoPdf) return;
        if (isStorageUrl(arquivoPdf)) {
            window.open(arquivoPdf, '_blank');
        } else {
            const link = document.createElement('a');
            link.href = arquivoPdf;
            link.download = nomeArquivo || `${numeroContrato}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const isDocFile = nomeArquivo && (nomeArquivo.toLowerCase().endsWith('.doc') || nomeArquivo.toLowerCase().endsWith('.docx'));
    const isPdfViewable = !isDocFile;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="bg-card rounded-xl border border-border w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
                        style={{ boxShadow: "var(--shadow-xl)" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <FileText className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground leading-none mb-1">{numeroContrato}</h3>
                                    <p className="text-xs text-muted-foreground leading-none">{nomeArquivo || 'Documento do contrato'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {arquivoPdf && (
                                    <button
                                        onClick={handleDownload}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
                                    >
                                        <Download className="w-3.5 h-3.5" /> Baixar
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Sidebar Info */}
                            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border p-6 bg-muted/5 overflow-auto">
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-primary" />
                                            Informações do Contrato
                                        </h4>

                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Número</p>
                                                <p className="text-sm font-medium text-foreground bg-background p-2.5 rounded-lg border border-border/50 shadow-sm">{numeroContrato}</p>
                                            </div>

                                            {empresa && (
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Empresa</p>
                                                    <p className="text-sm font-medium text-foreground">{empresa}</p>
                                                </div>
                                            )}

                                            {status && (
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Status</p>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${status === 'Vigente' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        status === 'Vencendo' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                        {status}
                                                    </span>
                                                </div>
                                            )}

                                            {vencimento && (
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Vencimento</p>
                                                    <p className="text-sm font-medium text-foreground">{vencimento}</p>
                                                </div>
                                            )}

                                            {objeto && (
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Objeto / Descrição</p>
                                                    <p className="text-xs text-foreground leading-relaxed italic border-l-2 border-primary/20 pl-3 py-1 bg-primary/5 rounded-r-md">
                                                        {objeto}
                                                    </p>
                                                </div>
                                            )}

                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-border/50">
                                        <button
                                            onClick={handleDownload}
                                            disabled={!arquivoPdf}
                                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-md disabled:opacity-50"
                                        >
                                            <Download className="w-4 h-4" />
                                            Baixar Documento
                                        </button>

                                        <p className="text-[10px] text-center text-muted-foreground mt-4 leading-tight italic">
                                            Visualize o documento oficial ao lado ou faça o download para arquivamento.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Document View Area */}
                            <div className="flex-1 bg-muted/5 relative">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-2">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                        <p className="text-xs text-muted-foreground">Processando documento...</p>
                                    </div>
                                ) : blobUrl && isPdfViewable ? (
                                    <div className="w-full h-full flex flex-col">
                                        <iframe
                                            src={isStorageUrl(blobUrl) ? blobUrl : `${blobUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                            className="w-full h-full border-none shadow-inner"
                                            style={{ minHeight: "calc(90vh - 65px)" }}
                                            title={`Visualização de ${numeroContrato}`}
                                        />
                                    </div>
                                ) : blobUrl && isDocFile ? (
                                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                        <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center mb-6">
                                            <FileText className="w-8 h-8 text-primary" />
                                        </div>
                                        <h4 className="text-base font-semibold text-foreground mb-2">Documento Word ({nomeArquivo?.split('.').pop()?.toUpperCase()})</h4>
                                        <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed mb-4">
                                            Arquivos DOC/DOCX não podem ser visualizados diretamente no navegador. Clique abaixo para baixar.
                                        </p>
                                        <button
                                            onClick={handleDownload}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                                        >
                                            <Download className="w-4 h-4" /> Baixar {nomeArquivo}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                        <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 rotate-3">
                                            <FileText className="w-8 h-8 text-primary opacity-30" />
                                        </div>
                                        <h4 className="text-base font-semibold text-foreground mb-2">Prévia não disponível</h4>
                                        <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
                                            Este contrato não possui um documento anexado ou o formato não é suportado para visualização direta.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
