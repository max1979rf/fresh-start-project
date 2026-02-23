import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Building2, Upload, Image } from "lucide-react";
import { useData } from "@/contexts/DataContext";

export default function Empresas() {
  const { empresas, addEmpresa, deleteEmpresa } = useData();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");

  const filtered = empresas.filter((e) =>
    e.nome.toLowerCase().includes(search.toLowerCase()) ||
    e.sigla.toLowerCase().includes(search.toLowerCase())
  );

  function handleSave() {
    if (!nome.trim() || !sigla.trim()) return;
    addEmpresa({ nome: nome.trim(), sigla: sigla.trim() });
    setNome("");
    setSigla("");
    setShowForm(false);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Empresas Contratadas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie as empresas que contratam os serviços</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Nova Empresa
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-card rounded-xl border border-border p-6 space-y-4"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <h3 className="text-lg font-semibold text-foreground">Nova Empresa Contratada</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome da Empresa *</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sigla *</label>
              <input
                value={sigla}
                onChange={e => setSigla(e.target.value)}
                placeholder="Ex: FAP"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Logomarca</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                  <Image className="w-6 h-6 text-muted-foreground" />
                </div>
                <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
                  <Upload className="w-4 h-4" /> Upload
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowForm(false); setNome(""); setSigla(""); }} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              Salvar
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa..."
          className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((e) => (
          <div
            key={e.id}
            className="bg-card rounded-xl border border-border p-6 flex items-center gap-4 hover:shadow-md transition-all group"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              {e.logo ? (
                <img src={e.logo} alt={e.sigla} className="w-12 h-12 rounded-lg object-contain" />
              ) : (
                <Building2 className="w-7 h-7 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground text-sm truncate">{e.nome}</h3>
              <p className="text-xs text-muted-foreground">{e.sigla}</p>
            </div>
            <button
              onClick={() => deleteEmpresa(e.id)}
              className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 text-xs transition-opacity flex-shrink-0"
              title="Excluir empresa"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
