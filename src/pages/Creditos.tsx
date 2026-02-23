import { motion } from "framer-motion";
import { Coins, Zap } from "lucide-react";

const LLM_CREDITS_TABLE = [
  {
    provider: "OpenAI",
    models: [
      { name: "GPT-5.2 (Novo)", credits: 5 },
      { name: "GPT-5.1", credits: 4 },
      { name: "GPT-5", credits: 4 },
      { name: "GPT-5 Mini", credits: 1 },
      { name: "GPT-4.1", credits: 4 },
      { name: "GPT-4.1 Mini", credits: 1 },
      { name: "o4-Mini", credits: 3 },
      { name: "o3", credits: 5 },
      { name: "GPT-4o Mini", credits: 1 },
      { name: "GPT-4o", credits: 5 },
      { name: "o3-Mini (Beta)", credits: 3 },
      { name: "o1", credits: 25 },
      { name: "GPT-4 Turbo", credits: 3 },
    ],
  },
  {
    provider: "Anthropic",
    models: [
      { name: "Claude 4.5 Sonnet (Novo)", credits: 10 },
      { name: "Claude 3.5 Sonnet (Depreciado)", credits: 10 },
      { name: "Claude 3.7 Sonnet", credits: 10 },
      { name: "Claude 3.5 Haiku", credits: 2 },
    ],
  },
  {
    provider: "Meta",
    models: [
      { name: "LLaMA 3.3", credits: 1 },
    ],
  },
  {
    provider: "Alibaba",
    models: [
      { name: "Qwen 2.5 Max", credits: 3 },
    ],
  },
  {
    provider: "Maritaca",
    models: [
      { name: "Sabiá 3.1 (Novo)", credits: 3 },
      { name: "Sabiá 3", credits: 3 },
    ],
  },
];

export default function Creditos() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Coins className="w-6 h-6 text-primary" /> Créditos & Consumo por LLM
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tabela de consumo de créditos por modelo de IA utilizado nas análises e geração de contratos.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-2" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-xs text-muted-foreground">
            Cada uso de IA consome créditos conforme o modelo escolhido. Pacote: <strong>1.000 créditos = R$ 100,00</strong>
          </span>
        </div>
      </div>

      {LLM_CREDITS_TABLE.map((group) => (
        <div key={group.provider} className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-3 bg-muted/40 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">{group.provider}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">LLM</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Créditos por uso</th>
              </tr>
            </thead>
            <tbody>
              {group.models.map((model, idx) => (
                <tr key={model.name} className={`border-b border-border/50 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <td className="px-5 py-2.5 text-foreground">{model.name}</td>
                  <td className="px-5 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      model.credits >= 10 ? 'bg-red-100 text-red-700' :
                      model.credits >= 4 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {model.credits}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </motion.div>
  );
}
