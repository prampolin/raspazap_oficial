"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;
    router.replace("/dashboard");
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: { business_name: businessName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Com "Confirmar e-mail" ativo no Supabase, session vem null até o usuário clicar no link.
    if (!data.session) {
      toast.success("Enviamos um link para seu e-mail. Confirme o cadastro e depois faça login.");
      router.push("/login");
      return;
    }
    toast.success("Conta criada!");
    router.push("/dashboard");
  };

  if (authLoading || user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
        <div className="mb-8 font-display">
          <Logo />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Crie sua conta</h1>
        <p className="text-sm text-muted-foreground mb-8">Comece grátis com 50 raspadinhas.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="business">Nome do negócio</Label>
            <Input id="business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Minha Loja" required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              autoComplete="new-password"
              className="mt-1.5"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando conta..." : "Criar conta grátis"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
