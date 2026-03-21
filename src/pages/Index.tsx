import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Gift, Users, BarChart3, Zap, ArrowRight, Star } from "lucide-react";
import { useEffect, useRef } from "react";

const features = [
  {
    icon: Gift,
    title: "Raspadinhas Premiadas",
    description: "100% dos clientes ganham. Configure prêmios com distribuição personalizada.",
  },
  {
    icon: Users,
    title: "Captura de Leads",
    description: "Colete nome e WhatsApp automaticamente antes da raspagem.",
  },
  {
    icon: BarChart3,
    title: "Relatórios Completos",
    description: "Acompanhe todos os participantes, prêmios e métricas em tempo real.",
  },
  {
    icon: Zap,
    title: "Link & QR Code",
    description: "Compartilhe por WhatsApp com link único ou QR Code pronto.",
  },
];

const steps = [
  { num: "01", title: "Crie sua campanha", desc: "Defina os prêmios e regras em minutos." },
  { num: "02", title: "Compartilhe o link", desc: "Envie pelo WhatsApp ou redes sociais." },
  { num: "03", title: "Fidelize clientes", desc: "Acompanhe leads e resultados no painel." },
];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("animate-fade-up");
          el.style.opacity = "1";
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealSection({ children, className = "", delay = "" }: { children: React.ReactNode; className?: string; delay?: string }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={className} style={{ opacity: 0, animationDelay: delay }}>
      {children}
    </div>
  );
}

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="font-display text-xl font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-hero flex items-center justify-center">
              <Star className="w-4 h-4 text-primary-foreground" />
            </div>
            RaspaZap
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <RevealSection>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Gift className="w-4 h-4" />
                Fidelização gamificada
              </div>
            </RevealSection>
            <RevealSection delay="0.1s">
              <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground leading-[1.08] mb-6" style={{ textWrap: "balance" }}>
                Transforme clientes em fãs com raspadinhas premiadas
              </h1>
            </RevealSection>
            <RevealSection delay="0.2s">
              <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto" style={{ textWrap: "pretty" }}>
                Crie campanhas de raspadinhas digitais, capture leads pelo WhatsApp e aumente a recorrência do seu negócio.
              </p>
            </RevealSection>
            <RevealSection delay="0.3s">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" asChild className="text-base px-8">
                  <Link to="/register">
                    Criar minha campanha
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-base px-8">
                  <Link to="/demo">Ver demonstração</Link>
                </Button>
              </div>
            </RevealSection>
          </div>

          {/* Scratch card preview */}
          <RevealSection delay="0.4s" className="mt-16 max-w-sm mx-auto">
            <div className="relative">
              <div className="bg-gradient-gold rounded-2xl p-1 scratch-shadow">
                <div className="bg-card rounded-xl p-8 text-center">
                  <div className="w-full h-32 bg-gradient-gold rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,hsl(var(--gold-dark)/0.15)_8px,hsl(var(--gold-dark)/0.15)_16px)]" />
                    <span className="font-display text-2xl font-bold text-secondary-foreground relative z-10">🎁 RASPE AQUI</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Passe o dedo para revelar seu prêmio</p>
                </div>
              </div>
              <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-xs animate-float">
                100%
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <RevealSection className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tudo que você precisa para fidelizar
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Uma plataforma completa para criar experiências premiadas e capturar leads qualificados.
            </p>
          </RevealSection>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {features.map((f, i) => (
              <RevealSection key={f.title} delay={`${i * 0.1}s`}>
                <div className="bg-card rounded-xl p-6 card-elevated hover:card-elevated-hover transition-shadow duration-300 group">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20">
        <div className="container">
          <RevealSection className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simples como 1, 2, 3
            </h2>
          </RevealSection>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {steps.map((s, i) => (
              <RevealSection key={s.num} delay={`${i * 0.12}s`} className="text-center">
                <div className="text-4xl font-display font-bold text-gradient-gold mb-3">{s.num}</div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-muted/50">
        <div className="container">
          <RevealSection className="max-w-md mx-auto">
            <div className="bg-card rounded-2xl p-8 card-elevated text-center">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                PLANO PRO
              </div>
              <div className="mb-4">
                <span className="font-display text-5xl font-bold text-foreground">R$ 97</span>
                <span className="text-2xl text-muted-foreground">,90</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Até 5.000 raspadinhas por mês. Comece grátis com 50 raspadinhas!
              </p>
              <ul className="text-sm text-left space-y-3 mb-8">
                {["Campanhas ilimitadas", "Captura de leads", "QR Codes ilimitados", "Relatórios completos", "Suporte prioritário"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-foreground">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Star className="w-3 h-3 text-primary" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="w-full text-base" asChild>
                <Link to="/register">Começar grátis</Link>
              </Button>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container text-center">
          <div className="font-display text-lg font-bold text-foreground flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-gradient-hero flex items-center justify-center">
              <Star className="w-3 h-3 text-primary-foreground" />
            </div>
            RaspaZap
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} RaspaZap. Fidelização gamificada para seu negócio.
          </p>
        </div>
      </footer>
    </div>
  );
}
