"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "raspaZap_legal_accepted_v1";

function shouldSkipLegalGate(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/termos" || pathname === "/privacidade") return true;
  return false;
}

export function LegalAcceptanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);

  useEffect(() => {
    try {
      setAccepted(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setAccepted(false);
    }
    setHydrated(true);
  }, []);

  const skip = shouldSkipLegalGate(pathname);
  const showModal = hydrated && !skip && !accepted;
  const canContinue = termsOk && privacyOk;

  useEffect(() => {
    if (!showModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showModal]);

  const handleContinue = () => {
    if (!canContinue) return;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage bloqueado */
    }
    setAccepted(true);
    setTermsOk(false);
    setPrivacyOk(false);
  };

  return (
    <>
      {children}
      {showModal && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-background/40 backdrop-blur-[2px]"
            aria-hidden
            onMouseDown={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          />
          <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pointer-events-none pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pb-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="legal-gate-title"
              className="pointer-events-auto w-full max-w-md rounded-2xl border border-border/60 bg-card/95 shadow-lg backdrop-blur-md px-4 py-3.5 sm:px-5 sm:py-4 animate-in slide-in-from-bottom-3 fade-in duration-300"
              onKeyDown={(e) => {
                if (e.key === "Escape") e.preventDefault();
              }}
            >
              <h2 id="legal-gate-title" className="text-sm font-semibold text-foreground mb-1.5 text-center sm:text-left">
                Termos e privacidade
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3 text-center sm:text-left">
                Confirme abaixo para continuar. Os links abrem em nova aba.
              </p>

              <div className="space-y-2.5 mb-3">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="legal-terms"
                    checked={termsOk}
                    onCheckedChange={(v) => setTermsOk(v === true)}
                    className="mt-0.5"
                    aria-describedby="legal-terms-label"
                  />
                  <Label
                    id="legal-terms-label"
                    htmlFor="legal-terms"
                    className="text-xs font-normal leading-snug cursor-pointer text-foreground/90"
                  >
                    Li e aceito os{" "}
                    <Link
                      href="/termos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 hover:no-underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Termos de uso
                    </Link>
                  </Label>
                </div>
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="legal-privacy"
                    checked={privacyOk}
                    onCheckedChange={(v) => setPrivacyOk(v === true)}
                    className="mt-0.5"
                    aria-describedby="legal-privacy-label"
                  />
                  <Label
                    id="legal-privacy-label"
                    htmlFor="legal-privacy"
                    className="text-xs font-normal leading-snug cursor-pointer text-foreground/90"
                  >
                    Li e aceito a{" "}
                    <Link
                      href="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 hover:no-underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Política de privacidade
                    </Link>
                  </Label>
                </div>
              </div>

              <div className="flex justify-center sm:justify-end">
                <Button type="button" size="sm" disabled={!canContinue} onClick={handleContinue} className="min-w-[120px]">
                  Continuar
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
