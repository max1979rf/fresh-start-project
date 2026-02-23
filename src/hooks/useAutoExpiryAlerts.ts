import { useEffect, useRef } from "react";
import { useData } from "../contexts/DataContext";

const SENT_KEY = "lwp_autoAlertsSent";

function parseDateBR(str: string): Date | null {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function loadSent(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSent(data: Record<string, string>) {
  localStorage.setItem(SENT_KEY, JSON.stringify(data));
}

export function useAutoExpiryAlerts() {
  const { contratos, appConfig, setores } = useData();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (!appConfig.alertaEmailAtivo || !appConfig.emailsAlertaSetor) return;

    ran.current = true;

    const now = new Date();
    const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
    const sent = loadSent();
    const today = now.toISOString().slice(0, 10);

    // Clean old entries (older than 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const key of Object.keys(sent)) {
      if (sent[key] < thirtyDaysAgo) delete sent[key];
    }

    const contractsToAlert = contratos.filter((c) => {
      if (c.excluido || c.status === "Encerrado") return false;
      const venc = parseDateBR(c.dataVencimento);
      if (!venc) return false;
      const diff = venc.getTime() - now.getTime();
      // Within 10 days (including already expired up to 3 days)
      return diff <= tenDaysMs && diff >= -3 * 24 * 60 * 60 * 1000;
    });

    const toSend = contractsToAlert.filter((c) => {
      const key = `${c.id}_${today}`;
      return !sent[key];
    });

    if (toSend.length === 0) return;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    toSend.forEach(async (c) => {
      const setorEmail = appConfig.emailsAlertaSetor?.[c.idSetor];
      if (!setorEmail) return;

      const setorNome = setores.find((s) => s.id === c.idSetor)?.nome || "N/A";
      const isExpired = parseDateBR(c.dataVencimento)!.getTime() < now.getTime();

      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/send-alert-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: setorEmail,
              subject: isExpired
                ? `🔴 Contrato VENCIDO: ${c.numero} — ${c.empresa}`
                : `⚠️ Contrato vencendo em breve: ${c.numero} — ${c.empresa}`,
              contractNumber: c.numero,
              company: c.empresa,
              expiryDate: c.dataVencimento,
              sectorName: setorNome,
              message: isExpired
                ? `O contrato ${c.numero} (${c.empresa}) está VENCIDO desde ${c.dataVencimento}. Ação imediata necessária.`
                : `O contrato ${c.numero} (${c.empresa}) vence em ${c.dataVencimento}. Providencie a renovação.`,
            }),
          }
        );

        if (res.ok) {
          sent[`${c.id}_${today}`] = today;
          saveSent(sent);
        }
      } catch {
        // Silent fail for auto alerts
      }
    });
  }, [contratos, appConfig, setores]);
}
