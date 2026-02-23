import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  Shield, Clock, LogIn, FileText, User, Pencil, ToggleRight, Trash2, Search,
  Printer, Download, BarChart3, AlertTriangle, Users, Activity, ChevronDown, ChevronUp,
  Calendar, Filter, TrendingUp, Eye, Sparkles, Wand2, Loader2, FileSearch
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { generateAuditSummary } from "../utils/llmService";
import { toast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, Cell
} from "recharts";

// ─── Tab types ───
type AuditoriaTab = 'usuarios' | 'logs' | 'analise' | 'alertas';

const TABS: { key: AuditoriaTab; label: string; icon: typeof Users }[] = [
  { key: 'usuarios', label: 'Relatório de Usuários', icon: Users },
  { key: 'logs', label: 'Logs de Atividade', icon: Activity },
  { key: 'analise', label: 'Análise Consolidada', icon: BarChart3 },
  { key: 'alertas', label: 'Alertas de Segurança', icon: AlertTriangle },
];

// ─── Action icons ───
const actionIcons: Record<string, typeof LogIn> = {
  'Login realizado': LogIn, 'Login bloqueado': Shield, 'Login falhou': Shield,
  'Logout': LogIn, 'Contrato criado': FileText, 'Contrato editado': Pencil,
  'Contrato excluído': Trash2, 'Setor criado': Shield, 'Setor editado': Pencil,
  'Setor excluído': Trash2, 'Usuário criado': User, 'Usuário editado': Pencil,
  'Usuário ativado': ToggleRight, 'Usuário desativado': ToggleRight,
  'Análise IA executada': Eye, 'LLM conectada': TrendingUp, 'LLM configurada': TrendingUp,
  'Configurações salvas': Shield, 'Logo atualizada': Shield, 'Logo removida': Shield,
  'API Key gerada': Shield,
};

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
];

export default function Auditoria() {
  const { logs, usuarios, alertas, addAlerta, appConfig } = useData();
  const [tab, setTab] = useState<AuditoriaTab>('usuarios');
  const reportRef = useRef<HTMLDivElement>(null);

  // ─── AI Summary state ───
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // ─── USERS TAB state ───
  const [userSearch, setUserSearch] = useState("");

  // ─── LOGS TAB state ───
  const [logSearch, setLogSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ─── Helpers ───
  const formatDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  const uniqueActions = useMemo(() => [...new Set(logs.map(l => l.acao))].sort(), [logs]);
  const uniqueUsers = useMemo(() => [...new Set(logs.map(l => l.nomeUsuario))].sort(), [logs]);

  const handleGenerateAISummary = async () => {
    if (isGeneratingSummary) return;
    setIsGeneratingSummary(true);
    setAiSummary(null);

    try {
      // Use last 100 logs for analysis to focus on recent activity and stay within context limits
      const recentLogs = [...logs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 100)
        .map(l => ({
          usuario: l.nomeUsuario,
          acao: l.acao,
          detalhes: l.detalhes,
          data: formatDate(l.timestamp)
        }));

      const summary = await generateAuditSummary(appConfig, recentLogs);
      if (summary) {
        setAiSummary(summary);
        toast({ title: "✅ Resumo Gerado", description: "A IA analisou os logs recentes com sucesso." });
      } else {
        toast({
          title: "❌ Falha na Análise",
          description: "Não foi possível gerar o resumo. Verifique a configuração da LLM.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("AI Audit Summary failed:", err);
      toast({
        title: "❌ Erro",
        description: "Falha técnica ao processar logs.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // ─── Filtered Users ───
  const filteredUsers = useMemo(() => {
    if (!userSearch) return usuarios;
    const q = userSearch.toLowerCase();
    return usuarios.filter(u =>
      u.nome.toLowerCase().includes(q) ||
      u.login.toLowerCase().includes(q) ||
      (u.role === 'admin' ? 'admin' : 'setor').includes(q)
    );
  }, [usuarios, userSearch]);

  const activeUsers = usuarios.filter(u => u.status === 'ativo').length;
  const inactiveUsers = usuarios.filter(u => u.status === 'inativo').length;

  // ─── Filtered Logs ───
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const q = logSearch.toLowerCase();
      const matchesSearch = !logSearch ||
        l.nomeUsuario.toLowerCase().includes(q) ||
        l.detalhes.toLowerCase().includes(q) ||
        l.acao.toLowerCase().includes(q);
      const matchesAction = !filterAction || l.acao === filterAction;
      const matchesUser = !filterUser || l.nomeUsuario === filterUser;
      let matchesDate = true;
      if (filterDateFrom || filterDateTo) {
        try {
          const logDate = new Date(l.timestamp).toISOString().slice(0, 10);
          if (filterDateFrom && logDate < filterDateFrom) matchesDate = false;
          if (filterDateTo && logDate > filterDateTo) matchesDate = false;
        } catch { /* skip */ }
      }
      return matchesSearch && matchesAction && matchesUser && matchesDate;
    });
  }, [logs, logSearch, filterAction, filterUser, filterDateFrom, filterDateTo]);

  // ─── Analysis Data ───
  const analysisData = useMemo(() => {
    // Per-user consolidated
    const userMap = new Map<string, {
      nome: string; total: number; logins: number; logouts: number;
      alteracoes: number; uploads: number; ultimoAcesso: string;
    }>();

    logs.forEach(l => {
      const entry = userMap.get(l.nomeUsuario) || {
        nome: l.nomeUsuario, total: 0, logins: 0, logouts: 0,
        alteracoes: 0, uploads: 0, ultimoAcesso: ''
      };
      entry.total++;
      if (l.acao.toLowerCase().includes('login')) entry.logins++;
      if (l.acao === 'Logout') entry.logouts++;
      if (['editado', 'criado', 'excluído', 'ativado', 'desativado', 'salvas'].some(k => l.acao.toLowerCase().includes(k))) entry.alteracoes++;
      if (l.acao.toLowerCase().includes('upload') || l.acao.toLowerCase().includes('análise')) entry.uploads++;
      if (!entry.ultimoAcesso || l.timestamp > entry.ultimoAcesso) entry.ultimoAcesso = l.timestamp;
      userMap.set(l.nomeUsuario, entry);
    });

    const perUser = [...userMap.values()].sort((a, b) => b.total - a.total);

    // Action frequency
    const actionMap = new Map<string, number>();
    logs.forEach(l => actionMap.set(l.acao, (actionMap.get(l.acao) || 0) + 1));
    const actionFrequency = [...actionMap.entries()]
      .map(([name, count]) => ({ name: name.length > 22 ? name.slice(0, 20) + '…' : name, fullName: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Hourly distribution
    const hourMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) hourMap.set(h, 0);
    logs.forEach(l => {
      try {
        const hour = new Date(l.timestamp).getHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      } catch { /* skip */ }
    });
    const hourlyDistribution = [...hourMap.entries()]
      .map(([hour, count]) => ({ hour: `${hour.toString().padStart(2, '0')}h`, count }));

    // Failed logins
    const failedLogins = logs.filter(l =>
      l.acao === 'Login falhou' || l.acao === 'Login bloqueado'
    );

    return { perUser, actionFrequency, hourlyDistribution, failedLogins };
  }, [logs]);

  // ─── Security Alerts (Filtered for Auditoria view) ───
  const visibleSecurityAlerts = useMemo(() => {
    if (!alertas) return [];
    return [...alertas].sort((a, b) => {
      const dateA = a.criadoEm || '';
      const dateB = b.criadoEm || '';
      return dateB.localeCompare(dateA);
    });
  }, [alertas]);

  // ─── Print/PDF ───
  const handlePrint = () => {
    const printArea = reportRef.current;
    if (!printArea) return;
    const printWin = window.open('', '_blank', 'width=1000,height=800');
    if (!printWin) return;
    printWin.document.write(`<!DOCTYPE html><html><head><title>Auditoria</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', Arial, sans-serif; padding: 24px; color: #1a1a2e; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #f0f2f5; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; border-bottom: 2px solid #ddd; text-transform: uppercase; }
      td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
      tr:nth-child(even) { background: #fafbfc; }
      h1 { font-size: 18px; color: #1a2d5a; margin-bottom: 8px; }
      h2 { font-size: 14px; color: #444; margin: 16px 0 8px; }
      .meta { font-size: 10px; color: #888; margin-bottom: 8px; }
      @media print { body { padding: 12px; } }
    </style></head><body>`);
    printWin.document.write(printArea.innerHTML);
    printWin.document.write('</body></html>');
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 300);
  };

  // ─── Export Excel (CSV) ───
  const handleExportExcel = () => {
    let csv = '';
    if (tab === 'usuarios') {
      csv = 'Nome,Login,Perfil,Status\n';
      filteredUsers.forEach(u => {
        csv += `"${u.nome}","${u.login}","${u.role === 'admin' ? 'Admin' : 'Setor'}","${u.status}"\n`;
      });
    } else if (tab === 'logs') {
      csv = 'Ação,Usuário,Detalhes,Data/Hora\n';
      filteredLogs.forEach(l => {
        csv += `"${l.acao}","${l.nomeUsuario}","${l.detalhes}","${formatDate(l.timestamp)}"\n`;
      });
    } else if (tab === 'analise') {
      csv = 'Usuário,Total de Ações,Logins,Logouts,Alterações,Último Acesso\n';
      analysisData.perUser.forEach(u => {
        csv += `"${u.nome}",${u.total},${u.logins},${u.logouts},${u.alteracoes},"${formatDate(u.ultimoAcesso)}"\n`;
      });
    } else {
      csv = 'Tipo,Mensagem,Urgência,Data/Hora\n';
      visibleSecurityAlerts.forEach(a => {
        csv += `"${a.tipo}","${a.mensagem}","${a.urgencia}","${formatDate(a.criadoEm)}"\n`;
      });
    }
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Auditoria_${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Custom Tooltip ───
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-primary font-bold">{payload[0].value} ação(ões)</p>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Auditoria</h1>
          <p className="text-sm text-muted-foreground mt-1">Logs de atividades, análise de segurança e relatórios de usuários</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity accent-glow">
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key
                ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card border border-border text-muted-foreground hover:bg-secondary'}`}>
              <Icon className="w-4 h-4" /> {t.label}
              {t.key === 'alertas' && visibleSecurityAlerts.filter(a => !a.lido).length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {visibleSecurityAlerts.filter(a => !a.lido).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content (printable) */}
      <div ref={reportRef}>

        {/* ═══════ TAB: USUARIOS ═══════ */}
        {tab === 'usuarios' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="stat-card"><p className="text-xs text-muted-foreground">Total de Usuários</p><p className="text-2xl font-bold text-foreground mt-1">{usuarios.length}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Usuários Ativos</p><p className="text-2xl font-bold text-success mt-1">{activeUsers}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Usuários Inativos</p><p className="text-2xl font-bold text-destructive mt-1">{inactiveUsers}</p></div>
            </div>
            {/* Search */}
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
              <Search className="w-4 h-4 text-muted-foreground" />
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nome, login ou perfil..."
                className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground" />
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
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-2.5 font-medium text-foreground">{u.nome}</td>
                        <td className="px-5 py-2.5 text-muted-foreground font-mono text-xs">{u.login}</td>
                        <td className="px-5 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-info/10 text-info'}`}>
                            {u.role === 'admin' ? 'Admin' : 'Setor'}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.status === 'ativo' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                            {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-12 text-muted-foreground text-sm">Nenhum usuário encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TAB: LOGS ═══════ */}
        {tab === 'logs' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="stat-card"><p className="text-xs text-muted-foreground">Total de Logs</p><p className="text-2xl font-bold text-foreground mt-1">{logs.length}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Logs Filtrados</p><p className="text-2xl font-bold text-primary mt-1">{filteredLogs.length}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Tipos de Ação</p><p className="text-2xl font-bold text-foreground mt-1">{uniqueActions.length}</p></div>
            </div>

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 flex-1 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
                <Search className="w-4 h-4 text-muted-foreground" />
                <input value={logSearch} onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Buscar por usuário, ação ou detalhes..."
                  className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground" />
              </div>
              <button onClick={() => setFiltersOpen(!filtersOpen)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:bg-secondary">
                <Filter className="w-4 h-4" /> Filtros
                {filtersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {filtersOpen && (
              <div className="bg-card rounded-xl border border-border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Usuário</label>
                  <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none">
                    <option value="">Todos</option>
                    {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tipo de Ação</label>
                  <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none">
                    <option value="">Todas</option>
                    {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Data de</label>
                  <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Data até</label>
                  <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none" />
                </div>
              </div>
            )}

            {/* Logs Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Ação</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Usuário</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Detalhes</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-12 text-muted-foreground text-sm">
                        {logs.length === 0 ? "Nenhum log registrado ainda." : "Nenhum log encontrado com esses filtros."}
                      </td></tr>
                    ) : (
                      filteredLogs.slice(0, 200).map((l) => {
                        const Icon = actionIcons[l.acao] || Shield;
                        const isSuspicious = l.acao === 'Login falhou' || l.acao === 'Login bloqueado' || l.acao === 'Contrato excluído';
                        return (
                          <tr key={l.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${isSuspicious ? 'bg-destructive/5' : ''}`}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${isSuspicious ? 'text-destructive' : 'text-muted-foreground'}`} />
                                <span className="font-medium text-foreground">{l.acao}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-foreground">{l.nomeUsuario}</td>
                            <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell max-w-[300px] truncate">{l.detalhes}</td>
                            <td className="px-5 py-3.5 text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(l.timestamp)}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {filteredLogs.length > 200 && (
                <div className="px-5 py-2 text-xs text-muted-foreground text-center border-t border-border/50">
                  Exibindo 200 de {filteredLogs.length} registros. Use filtros para refinar.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ TAB: ANALISE ═══════ */}
        {tab === 'analise' && (
          <div className="space-y-6">
            {/* AI Executive Summary Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-6 relative overflow-hidden group shadow-sm">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-24 h-24 text-indigo-600" />
              </div>

              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-600">
                      <Wand2 className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-indigo-950 font-display italic">Resumo Executivo de Auditoria (IA)</h3>
                  </div>
                  <p className="text-sm text-indigo-700/80 leading-relaxed">
                    Nossa inteligência artificial analisa os últimos 100 eventos para identificar padrões de uso,
                    tendências de segurança e sugerir recomendações estratégicas para o seu setor.
                  </p>
                </div>

                <button
                  onClick={handleGenerateAISummary}
                  disabled={isGeneratingSummary}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isGeneratingSummary ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isGeneratingSummary ? "Analisando Logs..." : "Gerar Resumo Inteligente"}
                </button>
              </div>

              {aiSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-6 rounded-xl bg-white/80 border border-white shadow-sm backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-indigo-100">
                    <FileSearch className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-bold text-indigo-900 uppercase tracking-tight">Relatório Final do Auditor IA</span>
                  </div>
                  <div className="prose prose-sm prose-indigo max-w-none text-indigo-900/90 leading-relaxed whitespace-pre-line">
                    {aiSummary}
                  </div>
                </motion.div>
              )}
            </div>
            {/* Consolidated User Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="p-5 pb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Relatório Consolidado por Usuário</h3>
                <span className="text-xs text-muted-foreground ml-auto">{analysisData.perUser.length} usuário(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Usuário</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Total de Ações</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Logins</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Logouts</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Alterações</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Último Acesso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.perUser.map((u, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-2.5 font-medium text-foreground">{u.nome}</td>
                        <td className="px-5 py-2.5"><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">{u.total}</span></td>
                        <td className="px-5 py-2.5 text-muted-foreground">{u.logins}</td>
                        <td className="px-5 py-2.5 text-muted-foreground">{u.logouts}</td>
                        <td className="px-5 py-2.5 text-muted-foreground">{u.alteracoes}</td>
                        <td className="px-5 py-2.5 text-muted-foreground text-xs">{u.ultimoAcesso ? formatDate(u.ultimoAcesso) : '—'}</td>
                      </tr>
                    ))}
                    {analysisData.perUser.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">Nenhum log registrado ainda.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Failed Logins Highlight */}
            {analysisData.failedLogins.length > 0 && (
              <div className="bg-destructive/5 rounded-xl border border-destructive/20 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <h3 className="text-sm font-semibold text-destructive">Tentativas de Login Mal-Sucedidas ({analysisData.failedLogins.length})</h3>
                </div>
                <div className="space-y-1">
                  {analysisData.failedLogins.slice(0, 10).map((l, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs text-foreground">
                      <span className="text-destructive font-medium w-32 truncate">{l.nomeUsuario}</span>
                      <span className="text-muted-foreground flex-1 truncate">{l.detalhes}</span>
                      <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(l.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Action Frequency Chart */}
              <div className="bg-card rounded-xl border border-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Ações Mais Frequentes
                </h3>
                {analysisData.actionFrequency.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={analysisData.actionFrequency} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {analysisData.actionFrequency.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-12">Sem dados para exibir.</p>
                )}
              </div>

              {/* Hourly Distribution Chart */}
              <div className="bg-card rounded-xl border border-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Distribuição por Horário
                </h3>
                {logs.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={analysisData.hourlyDistribution} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#colorActivity)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-12">Sem dados para exibir.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TAB: ALERTAS ═══════ */}
        {tab === 'alertas' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="stat-card"><p className="text-xs text-muted-foreground">Total de Alertas</p><p className="text-2xl font-bold text-foreground mt-1">{visibleSecurityAlerts.length}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Não Lidos</p><p className="text-2xl font-bold text-destructive mt-1">{visibleSecurityAlerts.filter(a => !a.lido).length}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Logins Falhos</p><p className="text-2xl font-bold text-warning mt-1">{analysisData.failedLogins.length}</p></div>
            </div>

            {visibleSecurityAlerts.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
                <Shield className="w-12 h-12 text-success mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">Nenhuma atividade suspeita detectada.</p>
                <p className="text-xs text-muted-foreground mt-1">O sistema monitora automaticamente logins falhos, exclusões e alterações críticas.</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Tipo</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Mensagem</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Urgência</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Data/Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSecurityAlerts.map((a, i) => (
                        <tr key={i} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${!a.lido && (a.urgencia === 'alta' || a.urgencia === 'critica') ? 'bg-destructive/5' : ''}`}>
                          <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap uppercase text-[10px] tracking-wider">{a.tipo}</td>
                          <td className="px-5 py-3 text-muted-foreground max-w-[400px] text-xs font-medium">{a.mensagem}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.urgencia === 'critica' || a.urgencia === 'alta' ? 'bg-destructive/10 text-destructive'
                              : a.urgencia === 'media' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>
                              {a.urgencia}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground text-[10px] font-mono whitespace-nowrap">
                            {a.criadoEm ? formatDate(a.criadoEm) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
