import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Building2,
  Shield,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Scale,
  Users,
  BookOpen,
  BarChart3,
  Coins,
  MessageSquare,
  DollarSign,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";

const allNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", adminOnly: false },
  { to: "/contratos", icon: FileText, label: "Contratos", adminOnly: false },
  { to: "/chat-ia", icon: MessageSquare, label: "Chat IA", adminOnly: false },
  { to: "/modelos", icon: BookOpen, label: "Modelos", adminOnly: false },
  { to: "/setores", icon: Building2, label: "Setores", adminOnly: true },
  { to: "/usuarios", icon: Users, label: "Usuários", adminOnly: true },
  { to: "/financeiro", icon: DollarSign, label: "Financeiro", adminOnly: false },
  { to: "/alertas", icon: Bell, label: "Alertas", adminOnly: false },
  { to: "/relatorios", icon: BarChart3, label: "Relatórios", adminOnly: false },
  { to: "/auditoria", icon: Shield, label: "Auditoria", adminOnly: true },
  { to: "/creditos", icon: Coins, label: "Créditos", adminOnly: false },
  { to: "/configuracoes", icon: Settings, label: "Configurações", adminOnly: false },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isAdmin, logout } = useAuth();
  const { getSetorNome, appConfig } = useData();

  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="sidebar-gradient flex flex-col h-screen sticky top-0 z-30 border-r border-sidebar-border"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        {appConfig.logoBase64 ? (
          <img src={appConfig.logoBase64} alt="Logo" className="w-9 h-9 rounded-lg object-contain bg-white/10 p-0.5 flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <Scale className="w-5 h-5 text-accent-foreground" />
          </div>
        )}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden"
            >
              <span className="font-display text-lg font-bold text-sidebar-accent-foreground whitespace-nowrap">
                {appConfig.nomeEmpresa || 'IAX'}
              </span>
              <p className="text-[10px] text-sidebar-foreground/60 leading-none">Gestão de Contratos — Atualização 10</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to ||
            (item.to !== "/" && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 w-[3px] h-6 bg-sidebar-primary rounded-r-full"
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User info + bottom */}
      <div className="px-2 pb-4 space-y-2">
        {!collapsed && currentUser && (
          <div className="px-3 py-2 rounded-lg bg-sidebar-accent/30">
            <p className="text-xs font-semibold text-sidebar-accent-foreground truncate">{currentUser.nome}</p>
            <p className="text-[10px] text-sidebar-foreground/60 truncate">
              {currentUser.role === 'admin' ? 'Administrador' : getSetorNome(currentUser.idSetor || '')}
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors w-full"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span>Recolher</span>}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-destructive/20 hover:text-destructive transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </motion.aside>
  );
}
