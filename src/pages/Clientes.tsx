import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Users, Building2, Phone, Mail, MapPin } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import type { Cliente } from "@/types";

const classStyle: Record<string, string> = {
  Matriz: "bg-info/10 text-info",
  Filial: "bg-accent/10 text-accent",
  Parceiro: "bg-success/10 text-success",
};

const EMPTY_FORM = {
  nomeFantasia: "",
  razaoSocial: "",
  cnpj: "",
  classificacao: "Matriz" as Cliente["classificacao"],
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  cep: "",
  logradouro: "",
  bairro: "",
  cidade: "",
  estado: "",
  contatoNome: "",
  contatoEmail: "",
  contatoTelefone: "",
};

export default function Clientes() {
  const { clientes, addCliente, deleteCliente } = useData();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const filtered = clientes.filter(
    (c) =>
      c.nomeFantasia.toLowerCase().includes(search.toLowerCase()) ||
      c.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj.includes(search)
  );

  function handleSave() {
    if (!form.nomeFantasia.trim() || !form.razaoSocial.trim() || !form.cnpj.trim()) return;
    addCliente({
      nomeFantasia: form.nomeFantasia,
      razaoSocial: form.razaoSocial,
      cnpj: form.cnpj,
      classificacao: form.classificacao,
      inscricaoEstadual: form.inscricaoEstadual || undefined,
      inscricaoMunicipal: form.inscricaoMunicipal || undefined,
      cep: form.cep || undefined,
      logradouro: form.logradouro || undefined,
      bairro: form.bairro || undefined,
      cidade: form.cidade || undefined,
      estado: form.estado || undefined,
      contatoNome: form.contatoNome || undefined,
      contatoEmail: form.contatoEmail || undefined,
      contatoTelefone: form.contatoTelefone || undefined,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  function field(key: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro de empresas e pessoas físicas contratadas</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity accent-glow"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-card rounded-xl border border-border p-6 space-y-6"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <h3 className="text-lg font-semibold text-foreground">Cadastro de Novo Cliente</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome Fantasia *</label>
              <input value={form.nomeFantasia} onChange={e => field("nomeFantasia", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Razão Social *</label>
              <input value={form.razaoSocial} onChange={e => field("razaoSocial", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">CNPJ *</label>
              <input value={form.cnpj} onChange={e => field("cnpj", e.target.value)} placeholder="00.000.000/0001-00" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Classificação</label>
              <select value={form.classificacao} onChange={e => field("classificacao", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring">
                <option>Matriz</option>
                <option>Filial</option>
                <option>Parceiro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Inscrição Estadual</label>
              <input value={form.inscricaoEstadual} onChange={e => field("inscricaoEstadual", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Inscrição Municipal</label>
              <input value={form.inscricaoMunicipal} onChange={e => field("inscricaoMunicipal", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent" /> Endereço
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">CEP</label>
                <input value={form.cep} onChange={e => field("cep", e.target.value)} placeholder="00000-000" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Logradouro</label>
                <input value={form.logradouro} onChange={e => field("logradouro", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Bairro</label>
                <input value={form.bairro} onChange={e => field("bairro", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                <input value={form.cidade} onChange={e => field("cidade", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <input value={form.estado} onChange={e => field("estado", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Phone className="w-4 h-4 text-accent" /> Contato Principal
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nome</label>
                <input value={form.contatoNome} onChange={e => field("contatoNome", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                <input value={form.contatoEmail} onChange={e => field("contatoEmail", e.target.value)} type="email" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                <input value={form.contatoTelefone} onChange={e => field("contatoTelefone", e.target.value)} placeholder="(00) 0000-0000" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              Salvar Cliente
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, razão social ou CNPJ..."
          className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all duration-200 group"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{c.nomeFantasia}</h3>
                  <p className="text-xs text-muted-foreground">{c.cnpj}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${classStyle[c.classificacao]}`}>
                  {c.classificacao}
                </span>
                <button
                  onClick={() => deleteCliente(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 text-xs transition-opacity"
                  title="Excluir cliente"
                >
                  ✕
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3 truncate">{c.razaoSocial}</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {c.cidade && <div className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {c.cidade}</div>}
              {c.contatoNome && <div className="flex items-center gap-2"><Users className="w-3 h-3" /> {c.contatoNome}</div>}
              {c.contatoEmail && <div className="flex items-center gap-2"><Mail className="w-3 h-3" /> {c.contatoEmail}</div>}
              {c.contatoTelefone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> {c.contatoTelefone}</div>}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
