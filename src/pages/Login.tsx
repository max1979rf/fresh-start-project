import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, AlertCircle, User, Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loginStr, setLoginStr] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { appConfig, loading: dataLoading } = useData();

  if (isAuthenticated) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginStr.trim() || !senha.trim()) {
      setError("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    setTimeout(async () => {
      const result = await login(loginStr.trim(), senha);
      if (result.success) {
        sessionStorage.removeItem('lwp_expiryReminderShown');
        navigate("/", { replace: true });
      } else {
        setError(result.error || "Credenciais inválidas.");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ====== LEFT PANEL — BRANDING ====== */}
      <div className="relative lg:w-1/2 flex flex-col justify-between overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #0a0e1a 0%, #0d1225 40%, #111832 70%, #0a0e1a 100%)",
        }}
      >
        {/* Circuit-board SVG pattern overlay */}
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="circuit" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                {/* Horizontal lines */}
                <line x1="0" y1="40" x2="80" y2="40" stroke="#c9a44e" strokeWidth="0.8" />
                <line x1="120" y1="40" x2="200" y2="40" stroke="#c9a44e" strokeWidth="0.8" />
                <line x1="0" y1="100" x2="60" y2="100" stroke="#c9a44e" strokeWidth="0.8" />
                <line x1="140" y1="100" x2="200" y2="100" stroke="#c9a44e" strokeWidth="0.8" />
                <line x1="0" y1="160" x2="100" y2="160" stroke="#c9a44e" strokeWidth="0.8" />
                <line x1="160" y1="160" x2="200" y2="160" stroke="#c9a44e" strokeWidth="0.8" />
                {/* Vertical lines */}
                <line x1="40" y1="0" x2="40" y2="60" stroke="#c9a44e" strokeWidth="0.8" />
                <line x1="40" y1="120" x2="40" y2="200" stroke="#c9a44e" strokeWidth="0.8" />
                <line x1="100" y1="0" x2="100" y2="40" stroke="#c9a44e" strokeWidth="0.8" />
                <line x1="100" y1="80" x2="100" y2="140" stroke="#c9a44e" strokeWidth="0.8" />
                <line x1="160" y1="60" x2="160" y2="200" stroke="#c9a44e" strokeWidth="0.8" />
                {/* Nodes / dots */}
                <circle cx="80" cy="40" r="3" fill="#c9a44e" />
                <circle cx="120" cy="40" r="2" fill="#c9a44e" />
                <circle cx="40" cy="60" r="3" fill="#c9a44e" />
                <circle cx="60" cy="100" r="2.5" fill="#c9a44e" />
                <circle cx="140" cy="100" r="3" fill="#c9a44e" />
                <circle cx="100" cy="80" r="2" fill="#c9a44e" />
                <circle cx="100" cy="140" r="2.5" fill="#c9a44e" />
                <circle cx="160" cy="60" r="3" fill="#c9a44e" />
                <circle cx="100" cy="160" r="2" fill="#c9a44e" />
                <circle cx="160" cy="160" r="3" fill="#c9a44e" />
                <circle cx="40" cy="120" r="2.5" fill="#c9a44e" />
                {/* Diagonal connectors */}
                <line x1="80" y1="40" x2="100" y2="80" stroke="#c9a44e" strokeWidth="0.6" />
                <line x1="100" y1="80" x2="60" y2="100" stroke="#c9a44e" strokeWidth="0.6" />
                <line x1="140" y1="100" x2="160" y2="60" stroke="#c9a44e" strokeWidth="0.6" />
                <line x1="100" y1="140" x2="160" y2="160" stroke="#c9a44e" strokeWidth="0.6" />
                <line x1="40" y1="120" x2="60" y2="100" stroke="#c9a44e" strokeWidth="0.6" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#circuit)" />
          </svg>
        </div>

        {/* Decorative glow orbs */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(201,164,78,0.08) 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(30,64,175,0.1) 0%, transparent 70%)" }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full px-10 lg:px-14 xl:px-20 py-10 lg:py-14">
          {/* Top: Logo */}
          <div className="flex items-center gap-4">
            {appConfig.logoBase64 ? (
              <img src={appConfig.logoBase64} alt="Logo" className="w-12 h-12 rounded-lg object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-lg flex items-center justify-center border border-[#c9a44e]/30"
                style={{ background: "linear-gradient(135deg, rgba(201,164,78,0.15), rgba(201,164,78,0.05))" }}>
                <Shield className="w-6 h-6 text-[#c9a44e]" />
              </div>
            )}
            <div>
              <span className="text-white font-bold text-xl tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>{appConfig.nomeEmpresa || 'IAX'}</span>
              <p className="text-[11px] text-gray-400 font-light tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>
                Gestão de Contratos
              </p>
            </div>
          </div>

          {/* Center: Title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6 py-10 lg:py-0"
          >
            <h1
              className="text-4xl lg:text-5xl xl:text-[3.5rem] font-bold leading-[1.15] text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Sistema de<br />
              Gestão de<br />
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(135deg, #c9a44e, #e8d48b, #c9a44e)" }}>
                Contratos
              </span>
            </h1>
            <p className="text-[15px] text-gray-400 leading-relaxed max-w-md" style={{ fontFamily: "'Inter', sans-serif" }}>
              Plataforma inteligente para controle, rastreabilidade e análise de contratos.
            </p>
            <div className="flex items-center gap-6 text-xs text-gray-500" style={{ fontFamily: "'Inter', sans-serif" }}>
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-[#c9a44e]/60" /> Acesso Seguro
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-[#c9a44e]/60" /> Dados Protegidos
              </span>
            </div>
          </motion.div>

          {/* Bottom: Footer */}
          <div className="space-y-1.5" style={{ fontFamily: "'Inter', sans-serif" }}>
            <p className="text-[11px] text-gray-500">
              © 2026 {appConfig.nomeEmpresa || 'IAX'} — Todos os direitos reservados
            </p>
            <p className="text-[10px] text-gray-600">
              Desenvolvido por{" "}
              <span className="text-[#c9a44e]/70 font-medium">IAX</span>
              <span className="text-gray-600"> — Inteligência Artificial Experience — Atualização 10</span>
            </p>
          </div>
        </div>

        {/* Top golden line accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, transparent 0%, #c9a44e 30%, #e8d48b 50%, #c9a44e 70%, transparent 100%)" }} />
      </div>

      {/* ====== RIGHT PANEL — LOGIN FORM ====== */}
      <div className="lg:w-1/2 flex items-center justify-center bg-white px-6 py-12 lg:py-0 min-h-[60vh] lg:min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-[420px]"
        >
          {/* Login Card */}
          <div
            className="rounded-2xl p-8 lg:p-10 relative overflow-hidden"
            style={{
              background: "white",
              border: "1px solid rgba(200,210,230,0.5)",
              boxShadow: "0 0 0 1px rgba(59,130,246,0.04), 0 4px 24px rgba(15,23,42,0.06), 0 0 60px rgba(59,130,246,0.03)",
            }}
          >
            {/* Top subtle glow line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px]"
              style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.3), rgba(6,182,212,0.3), transparent)" }} />

            {/* Logo centered */}
            <div className="flex flex-col items-center mb-8">
              {appConfig.logoBase64 ? (
                <img src={appConfig.logoBase64} alt="Logo" className="h-14 w-auto object-contain mb-5" />
              ) : (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: "linear-gradient(135deg, #0c1a3a, #1a2d5a)" }}>
                  <Shield className="w-7 h-7 text-[#c9a44e]" />
                </div>
              )}
              <h2 className="text-[22px] font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                Bem-vindo.
              </h2>
              <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                Faça login para acessar o sistema
              </p>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm mb-5"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Loading indicator while Supabase data loads */}
            {dataLoading && (
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-50 text-blue-600 text-sm mb-5" style={{ fontFamily: "'Inter', sans-serif" }}>
                <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                Conectando ao servidor...
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" style={{ fontFamily: "'Inter', sans-serif" }}>
              {/* Login field */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Login</label>
                <div className="relative">
                  <input
                    type="text"
                    value={loginStr}
                    onChange={(e) => setLoginStr(e.target.value)}
                    placeholder="seu.login"
                    autoComplete="username"
                    disabled={dataLoading}
                    className="w-full px-4 py-3 rounded-xl text-sm text-gray-900 placeholder:text-gray-300 outline-none transition-all duration-200 pr-11"
                    style={{
                      background: "#f7f8fa",
                      border: "1px solid #e8ecf2",
                    }}
                    onFocus={(e) => {
                      e.target.style.border = "1px solid rgba(59,130,246,0.4)";
                      e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.08)";
                    }}
                    onBlur={(e) => {
                      e.target.style.border = "1px solid #e8ecf2";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <User className="w-[18px] h-[18px] text-gray-300" />
                  </div>
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={dataLoading}
                    className="w-full px-4 py-3 rounded-xl text-sm text-gray-900 placeholder:text-gray-300 outline-none transition-all duration-200 pr-11"
                    style={{
                      background: "#f7f8fa",
                      border: "1px solid #e8ecf2",
                    }}
                    onFocus={(e) => {
                      e.target.style.border = "1px solid rgba(59,130,246,0.4)";
                      e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.08)";
                    }}
                    onBlur={(e) => {
                      e.target.style.border = "1px solid #e8ecf2";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || dataLoading}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white uppercase tracking-widest transition-all duration-300 disabled:opacity-50 relative overflow-hidden group"
                style={{
                  background: "linear-gradient(135deg, #1e40af, #0ea5e9)",
                  boxShadow: "0 4px 16px rgba(30,64,175,0.25)",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.boxShadow = "0 4px 24px rgba(30,64,175,0.4), 0 0 40px rgba(14,165,233,0.15)";
                  (e.target as HTMLElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.boxShadow = "0 4px 16px rgba(30,64,175,0.25)";
                  (e.target as HTMLElement).style.transform = "translateY(0)";
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Autenticando...
                  </span>
                ) : (
                  "LOGAR"
                )}
              </button>
            </form>

            {/* Footer text */}
            <p className="text-[11px] text-center text-gray-300 mt-6" style={{ fontFamily: "'Inter', sans-serif" }}>
              Sessão protegida • Acesso restrito a funcionários autorizados
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
