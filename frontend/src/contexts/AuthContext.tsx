"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://misu-api.mihailnica10.workers.dev";

interface User {
    id: string;
    email: string;
    name?: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    authLoading: boolean;
    signOut: () => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("misu_token");
}

function setToken(token: string | null) {
    if (typeof window === "undefined") return;
    if (token) localStorage.setItem("misu_token", token);
    else localStorage.removeItem("misu_token");
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            setAuthLoading(false);
            return;
        }
        fetch(`${API_BASE}/api/auth/session`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (data?.user) setUser(data.user);
                else setToken(null);
            })
            .catch(() => setToken(null))
            .finally(() => setAuthLoading(false));
    }, []);

    const signOut = async () => {
        setToken(null);
        setUser(null);
    };

    const login = async (email: string, password: string) => {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");
        setToken(data.token);
        setUser(data.user);
    };

    const signup = async (email: string, password: string, name: string) => {
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Signup failed");
        setToken(data.token);
        setUser(data.user);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                authLoading,
                signOut,
                login,
                signup,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
