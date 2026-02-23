import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Building2, Pencil, Trash2, X, AlertCircle, ChevronDown, ChevronRight, FileText, Eye, Download } from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import ContratoViewer from "../components/ContratoViewer";

export default function Setores() {
    const { setores, addSetor, updateSetor, deleteSetor, addLog, usuarios, contratos } = useData();
    const { currentUser } = useAuth();
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [nome, setNome] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [expandedSetor, setExpandedSetor] = useState<string | null>(null);

    // Viewer
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerData, setViewerData] = useState<{ pdf?: string; nome?: string; numero: string }>({ numero: '' });

    const filtered = setores.filter(s => {
        const q = search.toLowerCase();
        return s.nome.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    });

    const handleSave = () => {
        setError(null);
        if (!nome.trim()) { setError("Informe o nome do setor."); return; }
        if (editingId) {
            const ok = updateSetor(editingId, nome);
            if (!ok) { setError("Já existe um setor com esse nome."); return; }
            addLog(currentUser!.id, currentUser!.nome, 'Setor editado', `Setor: ${nome}`);
        } else {
            const novo = addSetor(nome);
            if (!novo) { setError("Já existe um setor com esse nome."); return; }
            addLog(currentUser!.id, currentUser!.nome, 'Setor criado', `Setor: ${nome}`);
        }
        resetForm();
    };

    const handleDelete = (id: string, nomeSetor: string) => {
        const hasUsers = usuarios.some(u => u.idSetor === id);
        const hasContracts = contratos.some(c => c.idSetor === id);
        if (hasUsers || hasContracts) {
            alert("Não é possível excluir este setor. Existem usuários ou contratos vinculados.");
            return;
        }
        if (!confirm(`Deseja excluir o setor "${nomeSetor}"?`)) return;
        deleteSetor(id);
        addLog(currentUser!.id, currentUser!.nome, 'Setor excluído', `Setor: ${nomeSetor}`);
    };

    const handleEdit = (id: string, nomeAtual: string) => {
        setEditingId(id);
        setNome(nomeAtual);
        setShowForm(true);
        setError(null);
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingId(null);
        setNome("");
        setError(null);
    };

    const usersInSetor = (id: string) => usuarios.filter(u => u.idSetor === id).length;
    const contractsInSetor = (id: string) => contratos.filter(c => c.idSetor === id);

    const toggleExpand = (id: string) => {
        setExpandedSetor(prev => prev === id ? null : id);
    };

    const handleViewPdf = (c: typeof contratos[0]) => {
        setViewerData({ pdf: c.arquivoPdf, nome: c.nomeArquivo, numero: c.numero });
        setViewerOpen(true);
    };

    const handleDownloadPdf = (c: typeof contratos[0]) => {
        if (!c.arquivoPdf) return;
        const link = document.createElement('a');
        link.href = c.arquivoPdf;
        link.download = c.nomeArquivo || `${c.numero}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const statusStyle: Record<string, string> = {
        Vigente: "bg-success/10 text-success",
        Vencendo: "bg-warning/10 text-warning",
        Vencido: "bg-destructive/10 text-destructive",
        Encerrado: "bg-muted text-muted-foreground",
    };

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">Setores</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie os setores e visualize contratos por departamento</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity accent-glow"
                >
                    <Plus className="w-4 h-4" /> Novo Setor
                </button>
            </div>

            {/* Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-card rounded-xl border border-border p-6 space-y-4"
                        style={{ boxShadow: "var(--shadow-md)" }}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">
                                {editingId ? "Editar Setor" : "Novo Setor"}
                            </h3>
                            <button onClick={resetForm} className="p-1 rounded hover:bg-secondary transition-colors">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nome do Setor</label>
                            <input
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                placeholder="Ex: Departamento Financeiro"
                                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                                {editingId ? "Salvar Alterações" : "Criar Setor"}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search */}
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou código do setor..."
                    className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                />
            </div>

            {/* Cards with expandable contract list */}
            <div className="space-y-3">
                {filtered.map((s) => {
                    const sContracts = contractsInSetor(s.id);
                    const isExpanded = expandedSetor === s.id;
                    return (
                        <div key={s.id} className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                            <div className="flex items-center gap-4 px-5 py-4">
                                <button onClick={() => toggleExpand(s.id)} className="p-1 rounded hover:bg-secondary transition-colors">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                </button>
                                <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground">{s.nome}</p>
                                    <p className="text-xs text-muted-foreground">{usersInSetor(s.id)} usuário(s) · {sContracts.length} contrato(s)</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={() => handleEdit(s.id, s.nome)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Editar">
                                        <Pencil className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <button onClick={() => handleDelete(s.id, s.nome)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors" title="Excluir">
                                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                    </button>
                                </div>
                            </div>

                            {/* Expanded contract list */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-border"
                                    >
                                        {sContracts.length === 0 ? (
                                            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                                                Nenhum contrato vinculado a este setor.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-muted/20">
                                                            <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground">Contrato</th>
                                                            <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground">Empresa</th>
                                                            <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Status</th>
                                                            <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Vencimento</th>
                                                            <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sContracts.map(c => (
                                                            <tr key={c.id} className="border-t border-border/30 hover:bg-muted/10 transition-colors">
                                                                <td className="px-5 py-2.5">
                                                                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                                                                        <FileText className={`w-3.5 h-3.5 ${c.arquivoPdf ? 'text-primary' : 'text-muted-foreground'}`} />
                                                                        {c.numero}
                                                                    </span>
                                                                </td>
                                                                <td className="px-5 py-2.5 text-muted-foreground">{c.empresa}</td>
                                                                <td className="px-5 py-2.5 hidden md:table-cell">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyle[c.status]}`}>{c.status}</span>
                                                                </td>
                                                                <td className="px-5 py-2.5 text-muted-foreground hidden md:table-cell">{c.dataVencimento}</td>
                                                                <td className="px-5 py-2.5">
                                                                    <div className="flex items-center gap-0.5">
                                                                        <button onClick={() => handleViewPdf(c)} className="p-1 rounded hover:bg-secondary transition-colors" title="Visualizar">
                                                                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                                        </button>
                                                                        {c.arquivoPdf && (
                                                                            <button onClick={() => handleDownloadPdf(c)} className="p-1 rounded hover:bg-secondary transition-colors" title="Baixar PDF">
                                                                                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground text-sm">
                        Nenhum setor encontrado.
                    </div>
                )}
            </div>

            {/* PDF Viewer */}
            <ContratoViewer
                open={viewerOpen}
                onClose={() => setViewerOpen(false)}
                arquivoPdf={viewerData.pdf}
                nomeArquivo={viewerData.nome}
                numeroContrato={viewerData.numero}
            />
        </motion.div>
    );
}
