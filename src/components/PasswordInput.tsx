import { useState, useMemo } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";

interface PasswordInputProps {
  value: string;
  onChange: (v: string) => void;
  confirmValue: string;
  onConfirmChange: (v: string) => void;
  isEditing?: boolean;
  showStrength?: boolean;
}

const RULES = [
  { label: "Mínimo 8 caracteres", test: (s: string) => s.length >= 8 },
  { label: "Letra maiúscula", test: (s: string) => /[A-Z]/.test(s) },
  { label: "Letra minúscula", test: (s: string) => /[a-z]/.test(s) },
  { label: "Número", test: (s: string) => /\d/.test(s) },
  { label: "Caractere especial", test: (s: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(s) },
];

export default function PasswordInput({ value, onChange, confirmValue, onConfirmChange, isEditing, showStrength = true }: PasswordInputProps) {
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = useMemo(() => {
    if (!value) return { score: 0, label: "", color: "" };
    const passed = RULES.filter(r => r.test(value)).length;
    if (passed <= 1) return { score: 1, label: "Muito fraca", color: "bg-destructive" };
    if (passed === 2) return { score: 2, label: "Fraca", color: "bg-orange-500" };
    if (passed === 3) return { score: 3, label: "Média", color: "bg-yellow-500" };
    if (passed === 4) return { score: 4, label: "Forte", color: "bg-emerald-500" };
    return { score: 5, label: "Muito forte", color: "bg-emerald-600" };
  }, [value]);

  const mismatch = confirmValue.length > 0 && value !== confirmValue;
  const match = confirmValue.length > 0 && value === confirmValue && value.length > 0;

  return (
    <div className="space-y-3">
      {/* Password */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {isEditing ? "Nova Senha (deixe em branco para manter)" : "Senha"}
        </label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 pr-10 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary transition-colors"
            title={showPass ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPass ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Strength indicator */}
      {showStrength && value.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : "bg-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Força: <span className="font-medium">{strength.label}</span></p>
          <div className="grid grid-cols-2 gap-1">
            {RULES.map(r => (
              <div key={r.label} className="flex items-center gap-1.5 text-xs">
                {r.test(value)
                  ? <Check className="w-3 h-3 text-emerald-500" />
                  : <X className="w-3 h-3 text-muted-foreground/50" />}
                <span className={r.test(value) ? "text-foreground" : "text-muted-foreground/60"}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm password */}
      {(value.length > 0 || !isEditing) && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Confirmar Senha</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmValue}
              onChange={(e) => onConfirmChange(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-ring bg-background ${
                mismatch ? "border-destructive" : match ? "border-emerald-500" : "border-input"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary transition-colors"
              title={showConfirm ? "Ocultar senha" : "Mostrar senha"}
            >
              {showConfirm ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          {mismatch && <p className="text-xs text-destructive font-medium">As senhas não coincidem.</p>}
          {match && <p className="text-xs text-emerald-600 font-medium">✓ Senhas coincidem.</p>}
        </div>
      )}
    </div>
  );
}
