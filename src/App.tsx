import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "./contexts/DataContext";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Contratos from "./pages/Contratos";
import Setores from "./pages/Setores";
import Usuarios from "./pages/Usuarios";
import Alertas from "./pages/Alertas";
import Auditoria from "./pages/Auditoria";
import Configuracoes from "./pages/Configuracoes";
import ModelosContratos from "./pages/ModelosContratos";
import Relatorios from "./pages/Relatorios";
import Creditos from "./pages/Creditos";
import ChatIA from "./pages/ChatIA";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DataProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }>
                <Route path="/" element={<Dashboard />} />
                <Route path="/contratos" element={<Contratos />} />
                <Route path="/chat-ia" element={<ChatIA />} />
                <Route path="/setores" element={
                  <ProtectedRoute adminOnly><Setores /></ProtectedRoute>
                } />
                <Route path="/usuarios" element={
                  <ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>
                } />
                <Route path="/alertas" element={<Alertas />} />
                <Route path="/auditoria" element={
                  <ProtectedRoute adminOnly><Auditoria /></ProtectedRoute>
                } />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/modelos" element={<ModelosContratos />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/creditos" element={<Creditos />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </DataProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
