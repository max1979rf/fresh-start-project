import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import ExpiryReminder from "./ExpiryReminder";
import { Bell, Search } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useAutoExpiryAlerts } from "../hooks/useAutoExpiryAlerts";

export default function AppLayout() {
  const { currentUser, isAdmin } = useAuth();
  const { getSetorNome } = useData();
  useAutoExpiryAlerts();

  const initials = currentUser
    ? currentUser.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar contratos, setores..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-foreground">{currentUser?.nome || 'Usuário'}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? 'Administrador' : getSetorNome(currentUser?.idSetor || '')}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>

      {/* Expiry reminder toast */}
      <ExpiryReminder />
    </div>
  );
}
