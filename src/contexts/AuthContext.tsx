import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User } from '../types';
import { useData } from './DataContext';

interface AuthContextType {
    currentUser: User | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    login: (loginStr: string, password: string) => { success: boolean; error?: string };
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

const SESSION_KEY = 'lwp_session';
const SESSION_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { findUserByLogin, validatePassword, addLog, addAlerta, usuarios } = useData();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // Restore session on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (raw) {
                const session = JSON.parse(raw);
                if (session.expiresAt > Date.now() && session.userId) {
                    const user = usuarios.find(u => u.id === session.userId);
                    if (user && user.status === 'ativo') {
                        setCurrentUser(user);
                    } else {
                        localStorage.removeItem(SESSION_KEY);
                    }
                } else {
                    localStorage.removeItem(SESSION_KEY);
                }
            }
        } catch {
            localStorage.removeItem(SESSION_KEY);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep currentUser synced with usuarios changes (e.g., name change)
    useEffect(() => {
        if (currentUser) {
            const updated = usuarios.find(u => u.id === currentUser.id);
            if (updated && updated !== currentUser) {
                setCurrentUser(updated);
            }
        }
    }, [usuarios, currentUser]);

    const login = useCallback((loginStr: string, password: string): { success: boolean; error?: string } => {
        const user = findUserByLogin(loginStr);
        if (!user) {
            return { success: false, error: 'Usuário não encontrado.' };
        }
        if (user.status === 'inativo') {
            addLog(user.id, user.nome, 'Login bloqueado', 'Usuário inativo tentou logar');
            addAlerta({
                tipo: 'geral',
                urgencia: 'alta',
                mensagem: `Tentativa de login bloqueada: ${user.nome} (Status: Inativo)`,
                empresa: 'Sistema de Segurança'
            });
            return { success: false, error: 'Usuário inativo. Entre em contato com o administrador.' };
        }
        if (!validatePassword(user, password)) {
            addLog(user.id, user.nome, 'Login falhou', 'Senha incorreta');
            addAlerta({
                tipo: 'geral',
                urgencia: 'media',
                mensagem: `Falha de login para usuário: ${user.login}`,
                empresa: 'Sistema de Segurança'
            });
            return { success: false, error: 'Senha incorreta.' };
        }
        // Success
        setCurrentUser(user);
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: user.id,
            expiresAt: Date.now() + SESSION_EXPIRY_MS,
        }));
        addLog(user.id, user.nome, 'Login realizado', `IP: navegador local`);
        return { success: true };
    }, [findUserByLogin, validatePassword, addLog]);

    const logout = useCallback(() => {
        if (currentUser) {
            addLog(currentUser.id, currentUser.nome, 'Logout', 'Sessão encerrada');
        }
        setCurrentUser(null);
        localStorage.removeItem(SESSION_KEY);
    }, [currentUser, addLog]);

    return (
        <AuthContext.Provider value={{
            currentUser,
            isAuthenticated: !!currentUser,
            isAdmin: currentUser?.role === 'admin',
            login,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}
