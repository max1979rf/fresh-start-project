import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Users, Building2, AlertTriangle, TrendingUp, Clock, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";

const PIE_COLORS = [
  "hsl(210, 80%, 52%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(220, 10%, 50%)",
];

const statusStyle: Record<string, string> = {
  Vigente: "bg-success/10 text-success",
  Vencendo: "bg-warning/10 text-warning",
  Vencido: "bg-destructive/10 text-destructive",
  Encerrado: "bg-muted text-muted-foreground",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function Dashboard() {
  const { contratos, setores, usuarios, getSetorNome } = useData();
  const { currentUser, isAdmin } = useAuth();
  const [showAllRecent, setShowAllRecent] = useState(false);

  // Filter contracts by sector for non-admin
  const visibleContracts = isAdmin
    ? contratos
    : contratos.filter(c => c.idSetor === currentUser?.idSetor);

  // Stats
  const activeContracts = visibleContracts.filter(c => c.status === 'Vigente' || c.status === 'Vencendo');
  const stats = [
    { label: "Contratos Ativos", value: String(activeContracts.length), icon: FileText, change: `${visibleContracts.length} total`, color: "text-info" },
    { label: isAdmin ? "Usuários Cadastrados" : "Contratos do Setor", value: isAdmin ? String(usuarios.length) : String(visibleContracts.length), icon: Users, change: isAdmin ? `${usuarios.filter(u => u.status === 'ativo').length} ativos` : `${activeContracts.length} ativos`, color: "text-success" },
    { label: "Setores", value: String(setores.length), icon: Building2, change: "Departamentos", color: "text-accent" },
    { label: "Alertas Pendentes", value: String(visibleContracts.filter(c => c.status === 'Vencendo' || c.status === 'Vencido').length), icon: AlertTriangle, change: `${visibleContracts.filter(c => c.status === 'Vencido').length} vencidos`, color: "text-warning" },
  ];

  // Pie data
  const pieData = [
    { name: "Vigentes", value: visibleContracts.filter(c => c.status === 'Vigente').length },
    { name: "Vencendo", value: visibleContracts.filter(c => c.status === 'Vencendo').length },
    { name: "Vencidos", value: visibleContracts.filter(c => c.status === 'Vencido').length },
    { name: "Encerrados", value: visibleContracts.filter(c => c.status === 'Encerrado').length },
  ];

  // Bar data - contracts per sector (admin) or by status (sector user)
  const barData = isAdmin
    ? setores.slice(0, 8).map(s => ({
      nome: s.nome.length > 12 ? s.nome.substring(0, 12) + '…' : s.nome,
      contratos: contratos.filter(c => c.idSetor === s.id).length,
    }))
    : [
      { nome: 'Vigentes', contratos: visibleContracts.filter(c => c.status === 'Vigente').length },
      { nome: 'Vencendo', contratos: visibleContracts.filter(c => c.status === 'Vencendo').length },
      { nome: 'Vencidos', contratos: visibleContracts.filter(c => c.status === 'Vencido').length },
      { nome: 'Encerrados', contratos: visibleContracts.filter(c => c.status === 'Encerrado').length },
    ];

  const recentContracts = showAllRecent ? visibleContracts.slice(0, 20) : visibleContracts.slice(0, 5);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin ? "Visão geral dos contratos da FAP" : `Visão do setor: ${getSetorNome(currentUser?.idSetor || '')}`}
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card flex items-start gap-4">
            <div className={`p-2.5 rounded-lg bg-secondary ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {s.change}
              </p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Charts */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">
            {isAdmin ? "Contratos por Setor" : "Contratos por Status"}
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} stroke="hsl(220,10%,50%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220,10%,50%)" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0,0%,100%)",
                  border: "1px solid hsl(220,15%,88%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="contratos" fill="hsl(220,60%,22%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Status dos Contratos</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-semibold text-foreground ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Recent contracts table */}
      <motion.div variants={item} className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between p-5 pb-0">
          <h3 className="text-sm font-semibold text-foreground">Contratos Recentes</h3>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAllRecent(!showAllRecent)}
              className="text-xs text-accent font-medium flex items-center gap-1 hover:underline"
            >
              {showAllRecent ? (
                <>Ver menos <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Ver todos <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
            <a href="/contratos" className="text-xs text-muted-foreground font-medium flex items-center gap-1 hover:underline">
              Gerenciar tudo <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className={`overflow-x-auto ${showAllRecent ? 'max-h-[400px] overflow-y-auto' : ''}`}>
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 pb-3 text-xs font-medium text-muted-foreground">Nº Contrato</th>
                <th className="text-left px-5 pb-3 text-xs font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-5 pb-3 text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-5 pb-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-5 pb-3 text-xs font-medium text-muted-foreground">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {recentContracts.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{c.numero}</td>
                  <td className="px-5 py-3 text-foreground">{c.empresa}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.tipo}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {c.dataVencimento}
                  </td>
                </tr>
              ))}
              {recentContracts.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Nenhum contrato cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
