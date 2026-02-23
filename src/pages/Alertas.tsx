import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Bell, AlertTriangle, Clock, CheckCircle2, Filter, Search, Shield, Mail, Loader2 } from "lucide-react";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const urgenciaStyle: Record<string, string> = {
  critica: "bg-destructive/10 text-destructive",
  alta: "bg-warning/10 text-warning",
  media: "bg-info/10 text-info",
  baixa: "bg-muted text-muted-foreground",
};

const urgenciaLabel: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const urgenciaIcon: Record<string, typeof AlertTriangle> = {
  critica: AlertTriangle,
  alta: AlertTriangle,
  media: Bell,
  baixa: Clock,
};

const tipoLabel: Record<string, string> = {
  vencimento: "Vencimento",
  clausula_abusiva: "Cláusula Abusiva",
  analise_ia: "Análise IA",
  geral: "Geral",
};

export default function Alertas() {
  const { alertas, contratos, contratosVencendo, marcarAlertaLido, addAlerta, addLog, appConfig, getSetorNome } = useData();
  const { currentUser, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [filterUrgencia, setFilterUrgencia] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  // Generate dynamic expiry alerts from contracts
  const dynamicAlerts = useMemo(() => {
    const existing = new Set(alertas.filter(a => a.tipo === 'vencimento').map(a => a.idContrato));
    const newAlerts = contratosVencendo
      .filter(c => !existing.has(c.id))
      .filter(c => isAdmin || c.idSetor === currentUser?.idSetor);

    return newAlerts.map(c => ({
      id: `dyn_${c.id}`,
      tipo: 'vencimento' as const,
      mensagem: c.status === 'Vencido'
        ? `Contrato ${c.numero} está vencido desde ${c.dataVencimento}`
        : `Contrato ${c.numero} vence em ${c.dataVencimento}`,
      idContrato: c.id,
      numeroContrato: c.numero,
      empresa: c.empresa,
      urgencia: (c.status === 'Vencido' ? 'critica' : 'alta') as 'critica' | 'alta',
      lido: false,
      criadoEm: new Date().toISOString(),
    }));
  }, [contratosVencendo, alertas, isAdmin, currentUser]);

  // Filter visible alerts by sector for non-admin
  const visibleAlertas = useMemo(() => {
    const stored = isAdmin
      ? alertas
      : alertas.filter(a => {
        if (!a.idContrato) return true;
        const ct = contratos.find(c => c.id === a.idContrato);
        return ct ? ct.idSetor === currentUser?.idSetor : true;
      });
    return [...dynamicAlerts, ...stored];
  }, [alertas, dynamicAlerts, isAdmin, contratos, currentUser]);

  const filtered = visibleAlertas.filter(a => {
    const matchesSearch =
      a.mensagem.toLowerCase().includes(search.toLowerCase()) ||
      (a.empresa || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.numeroContrato || '').toLowerCase().includes(search.toLowerCase());
    const matchesUrgencia = !filterUrgencia || a.urgencia === filterUrgencia;
    const matchesTipo = !filterTipo || a.tipo === filterTipo;
    return matchesSearch && matchesUrgencia && matchesTipo;
  });

  const handleMarkRead = (id: string) => {
    if (id.startsWith('dyn_')) {
      // For dynamic alerts, persist them first
      const dynAlert = dynamicAlerts.find(a => a.id === id);
      if (dynAlert) {
        const created = addAlerta({
          tipo: dynAlert.tipo,
          mensagem: dynAlert.mensagem,
          idContrato: dynAlert.idContrato,
          numeroContrato: dynAlert.numeroContrato,
          empresa: dynAlert.empresa,
          urgencia: dynAlert.urgencia,
        });
        marcarAlertaLido(created.id);
      }
    } else {
      marcarAlertaLido(id);
    }
  };

  const handleSendEmail = async (a: typeof visibleAlertas[0]) => {
    setSendingEmail(a.id);
    try {
      // Find sector email from config
      const ct = a.idContrato ? contratos.find(c => c.id === a.idContrato) : null;
      const setorId = ct?.idSetor;
      const setorEmail = setorId && appConfig.emailsAlertaSetor?.[setorId];
      const setorNome = setorId ? getSetorNome(setorId) : 'N/A';

      if (!setorEmail) {
        toast({
          title: "E-mail não configurado",
          description: `Configure o e-mail do setor "${setorNome}" em Configurações > Alertas.`,
          variant: "destructive",
        });
        setSendingEmail(null);
        return;
      }

      const response = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/send-alert-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: setorEmail,
            subject: `⚠️ Alerta: ${a.mensagem}`,
            contractNumber: a.numeroContrato || 'N/A',
            company: a.empresa || 'N/A',
            expiryDate: ct?.dataVencimento || 'N/A',
            sectorName: setorNome,
            message: a.mensagem,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao enviar');
      }

      addLog(
        currentUser!.id,
        currentUser!.nome,
        'E-mail de alerta enviado',
        `Alerta: ${a.mensagem} — ${a.empresa || 'N/A'} → ${setorEmail}`
      );

      toast({
        title: "E-mail enviado!",
        description: `Alerta enviado para ${setorEmail}`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao enviar e-mail",
        description: err.message || 'Erro desconhecido',
        variant: "destructive",
      });
    }
    setSendingEmail(null);
  };

  const naoLidos = visibleAlertas.filter(a => !a.lido).length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Alertas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Notificações, alertas de vencimento e análises de IA
            {naoLidos > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive">
                {naoLidos} não lido{naoLidos > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 flex-1 max-w-md" style={{ boxShadow: "var(--shadow-sm)" }}>
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar alertas..."
            className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={filterUrgencia}
          onChange={(e) => setFilterUrgencia(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm text-muted-foreground"
        >
          <option value="">Todas urgências</option>
          <option value="critica">Crítica</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-sm text-muted-foreground"
        >
          <option value="">Todos os tipos</option>
          <option value="vencimento">Vencimento</option>
          <option value="clausula_abusiva">Cláusula Abusiva</option>
          <option value="analise_ia">Análise IA</option>
          <option value="geral">Geral</option>
        </select>
      </div>

      {/* Alerts list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground opacity-30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum alerta encontrado.</p>
          </div>
        ) : (
          filtered.map((a) => {
            const Icon = urgenciaIcon[a.urgencia] || Bell;
            return (
              <div
                key={a.id}
                className={`bg-card rounded-xl border p-5 flex items-start gap-4 hover:shadow-md transition-all ${a.lido ? 'border-border opacity-60' : 'border-border'}`}
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                <div className={`p-2 rounded-lg ${urgenciaStyle[a.urgencia]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${urgenciaStyle[a.urgencia]}`}>
                      {urgenciaLabel[a.urgencia]}
                    </span>
                    <span className="text-xs text-muted-foreground">{tipoLabel[a.tipo] || a.tipo}</span>
                    {a.lido && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Lido</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground">{a.mensagem}</p>
                  {a.empresa && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.empresa} {a.numeroContrato ? `· ${a.numeroContrato}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {appConfig.alertaEmailAtivo && !a.lido && (
                    <button
                      onClick={() => handleSendEmail(a)}
                      disabled={sendingEmail === a.id}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title="Enviar alerta por e-mail"
                    >
                      {sendingEmail === a.id
                        ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                        : <Mail className="w-4 h-4 text-muted-foreground" />
                      }
                    </button>
                  )}
                  {!a.lido && (
                    <button
                      onClick={() => handleMarkRead(a.id)}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title="Marcar como lido"
                    >
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
