import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, User, Pencil, X, AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import PasswordInput from "../components/PasswordInput";

export default function Usuarios() {
    const { usuarios, addUsuario, updateUsuario, toggleUsuarioStatus, setores, addLog, getSetorNome } = useData();
    const { currentUser } = useAuth();
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form fields
    const [nome, setNome] = useState("");
    const [login, setLogin] = useState("");
    const [senha, setSenha] = useState("");
    const [senhaConfirm, setSenhaConfirm] = useState("");
    const [idSetor, setIdSetor] = useState<string | null>("");
    const [role, setRole] = useState<'admin' | 'setor'>('setor');
    const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo');

    const filtered = usuarios.filter(u => {
        const q = search.toLowerCase();
        return u.nome.toLowerCase().includes(q) ||
            u.login.toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q);
    });

    const resetForm = () => {
        setShowForm(false);
        setEditingId(null);
        setNome(""); setLogin(""); setSenha(""); setSenhaConfirm(""); setIdSetor(""); setRole('setor'); setStatus('ativo');
        setError(null);
    };

    const handleEdit = (u: typeof usuarios[0]) => {
        setEditingId(u.id);
        setNome(u.nome);
        setLogin(u.login);
        setSenha("");
        setIdSetor(u.idSetor || "");
        setRole(u.role);
        setStatus(u.status);
        setShowForm(true);
        setError(null);
    };

    const handleSave = async () => {
        setError(null);
        if (!nome.trim() || !login.trim()) { setError("Preencha nome e login."); return; }
        if (!editingId && !senha.trim()) { setError("Defina uma senha para o novo usuário."); return; }
        if (senha.trim() && senha.length < 8) { setError("A senha deve ter no mínimo 8 caracteres."); return; }
        if (senha.trim() && senha !== senhaConfirm) { setError("As senhas não coincidem."); return; }
        if (!editingId && !senhaConfirm.trim()) { setError("Confirme a senha do novo usuário."); return; }
        if (role === 'setor' && !idSetor) { setError("Selecione um perfil com setor para o usuário."); return; }

        if (editingId) {
            const ok = await updateUsuario(editingId, {
                nome: nome.trim(),
                login: login.trim(),
                idSetor: role === 'admin' ? null : idSetor,
                role,
                status,
                ...(senha.trim() ? { senha: senha.trim() } : {}),
            });
            if (!ok) { setError("Login já existe para outro usuário."); return; }
            addLog(currentUser!.id, currentUser!.nome, 'Usuário editado', `Usuário: ${nome.trim()}`);
        } else {
            const novo = await addUsuario({
                nome: nome.trim(),
                login: login.trim(),
                senha: senha.trim(),
                idSetor: role === 'admin' ? null : idSetor,
                role,
                status,
            });
            if (!novo) { setError("Login já existe."); return; }
            addLog(currentUser!.id, currentUser!.nome, 'Usuário criado', `Usuário: ${nome.trim()} (${login.trim()})`);
        }
        resetForm();
    };

    const handleToggleStatus = (u: typeof usuarios[0]) => {
        if (u.id === currentUser?.id) { alert("Você não pode desativar sua própria conta."); return; }
        toggleUsuarioStatus(u.id);
        const newStatus = u.status === 'ativo' ? 'inativo' : 'ativo';
        addLog(currentUser!.id, currentUser!.nome, `Usuário ${newStatus === 'ativo' ? 'ativado' : 'desativado'}`, `Usuário: ${u.nome}`);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">Usuários</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gerencie os usuários do sistema</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity accent-glow"
                >
                    <Plus className="w-4 h-4" /> Novo Usuário
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
                                {editingId ? "Editar Usuário" : "Novo Usuário"}
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Nome Completo</label>
                                <input
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    placeholder="Nome do usuário"
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Login</label>
                                <input
                                    value={login}
                                    onChange={(e) => setLogin(e.target.value)}
                                    placeholder="login.usuario"
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                            <PasswordInput
                                value={senha}
                                onChange={setSenha}
                                confirmValue={senhaConfirm}
                                onConfirmChange={setSenhaConfirm}
                                isEditing={!!editingId}
                            />
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Perfil</label>
                                <select
                                    value={role === 'admin' ? 'admin' : idSetor ? `setor_${idSetor}` : ''}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === 'admin') {
                                            setRole('admin');
                                            setIdSetor('');
                                        } else if (v.startsWith('setor_')) {
                                            setRole('setor');
                                            setIdSetor(v.replace('setor_', ''));
                                        }
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">Selecione o perfil...</option>
                                    <option value="admin">Administrador</option>
                                    <optgroup label="Usuário limitado ao setor">
                                        {setores.map(s => (
                                            <option key={s.id} value={`setor_${s.id}`}>{s.nome}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as 'ativo' | 'inativo')}
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="ativo">Ativo</option>
                                    <option value="inativo">Inativo</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                                {editingId ? "Salvar Alterações" : "Criar Usuário"}
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
                    placeholder="Buscar por nome, login ou ID..."
                    className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                />
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Usuário</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Login</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Perfil</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Setor</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((u) => (
                                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <User className="w-4 h-4 text-primary" />
                                            </div>
                                            <span className="font-medium text-foreground">{u.nome}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{u.login}</td>
                                    <td className="px-5 py-3.5">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin'
                                            ? 'bg-primary/10 text-primary'
                                            : 'bg-info/10 text-info'
                                            }`}>
                                            {u.role === 'admin' ? 'Admin' : 'Setor'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                                        {u.idSetor ? getSetorNome(u.idSetor) : '—'}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.status === 'ativo'
                                            ? 'bg-success/10 text-success'
                                            : 'bg-destructive/10 text-destructive'
                                            }`}>
                                            {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEdit(u)}
                                                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                            <button
                                                onClick={() => handleToggleStatus(u)}
                                                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                                                title={u.status === 'ativo' ? 'Desativar' : 'Ativar'}
                                            >
                                                {u.status === 'ativo'
                                                    ? <ToggleRight className="w-4 h-4 text-success" />
                                                    : <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                                }
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm">Nenhum usuário encontrado.</div>
                )}
            </div>
        </motion.div>
    );
}
