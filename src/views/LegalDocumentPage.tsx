import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function LegalDocumentPage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="font-display">
            <Logo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </nav>
      <main className="container py-12 max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-foreground mb-8">{title}</h1>
        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{body}</div>
      </main>
    </div>
  );
}
