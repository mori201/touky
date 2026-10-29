import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary/90 shadow-sm",
  accent: "bg-accent text-white hover:bg-accent/90 shadow-sm",
  secondary: "bg-muted text-fg hover:bg-border/70",
  outline: "border border-border bg-surface text-fg hover:bg-muted",
  ghost: "text-fg hover:bg-muted",
  danger: "bg-danger text-white hover:bg-danger/90",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("input", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn("input min-h-[84px]", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn("input appearance-auto pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
  required,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-border bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4", className)}>
      <div>
        <h2 className="font-display text-base font-bold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-muted text-fg-muted",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/10 text-danger",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}

export function Alert({
  tone = "primary",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const border: Record<Tone, string> = {
    neutral: "border-border",
    primary: "border-primary/30",
    success: "border-success/30",
    warning: "border-warning/40",
    danger: "border-danger/30",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], border[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && "mt-0.5", "text-fg/80")}>{children}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">{icon}</div>}
      <p className="font-display text-base font-bold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}
export function TH({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn("border-b border-border bg-muted/60 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-fg-muted", className)}
      {...props}
    />
  );
}
export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-border/70 px-4 py-3 align-middle", className)} {...props} />;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: number | null;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
}) {
  const ring: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/10 text-danger",
    neutral: "bg-muted text-fg-muted",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-fg-muted">{label}</p>
        {icon && <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", ring[tone])}>{icon}</span>}
      </div>
      <p className="num mt-2 font-display text-2xl font-extrabold tracking-tight text-fg">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        {trend != null && (
          <span className={cn("font-bold", trend >= 0 ? "text-success" : "text-danger")}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1).replace(".", ",")} %
          </span>
        )}
        {hint}
      </div>
    </Card>
  );
}
