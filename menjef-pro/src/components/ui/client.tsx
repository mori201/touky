"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { ActionState } from "@/lib/actions";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { InviteLink } from "@/components/invite-result";

export function SubmitButton({
  children,
  pendingText = "Enregistrement…",
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} aria-busy={pending} name={name} value={value}>
      {pending ? pendingText : children}
    </Button>
  );
}

/**
 * Formulaire relié à une Server Action. Le message de succès n'apparaît
 * qu'après la confirmation renvoyée par le serveur.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  redirectTo,
  onSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  redirectTo?: string;
  onSuccess?: (state: NonNullable<ActionState>) => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state?.ok) return;
    if (resetOnSuccess) ref.current?.reset();
    onSuccess?.(state);
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error && (
        <Alert tone="danger" className="mb-4">
          {state.error}
        </Alert>
      )}
      {state?.ok && state.message && (
        <Alert tone="success" className="mb-4">
          {state.message}
        </Alert>
      )}
      {state?.ok && typeof state.data?.link === "string" && (
        <div className="mb-4">
          <InviteLink link={state.data.link} />
        </div>
      )}
      {children}
    </form>
  );
}

export function Modal({
  trigger,
  title,
  children,
  triggerVariant = "primary",
  triggerSize = "md",
  wide = false,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  triggerVariant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
  triggerSize?: "sm" | "md" | "lg";
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <Button type="button" variant={triggerVariant} size={triggerSize} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
          <div className="absolute inset-0" onClick={close} aria-hidden />
          <div className={cn("relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <button type="button" onClick={close} className="focus-ring rounded-lg p-1.5 text-fg-muted hover:bg-muted" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">{typeof children === "function" ? children(close) : children}</div>
          </div>
        </div>
      )}
    </>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("mj-theme", next ? "dark" : "light");
    } catch {
      /* stockage indisponible : le choix ne sera pas mémorisé */
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn("focus-ring rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-semibold text-fg-muted hover:text-fg", className)}
      aria-label={dark ? "Activer le mode clair" : "Activer le mode sombre"}
    >
      {dark ? "☀ Clair" : "☾ Sombre"}
    </button>
  );
}

export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} className="no-print">
      {label}
    </Button>
  );
}

/** Confirmation native avant une action irréversible */
export function ConfirmSubmit({ children, message, variant = "danger", size = "sm" }: { children: ReactNode; message: string; variant?: "danger" | "outline" | "primary"; size?: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "Traitement…" : children}
    </Button>
  );
}
