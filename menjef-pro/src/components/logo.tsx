import { cn } from "@/lib/utils";

export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill={inverted ? "rgb(255 255 255 / 0.12)" : "rgb(var(--navy))"} stroke={inverted ? "rgb(255 255 255 / 0.25)" : "none"} />
      <path d="M9 27.5V14l7.5 8.5L24 12v15.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22.5 27.5 31 17.5" stroke="rgb(var(--accent))" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M26.5 16.5H31.5V21.5" fill="none" stroke="rgb(var(--accent))" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, tagline = false, inverted = false }: { className?: string; tagline?: boolean; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark inverted={inverted} />
      <span className="leading-tight">
        <span className={cn("font-display text-lg font-extrabold tracking-tight", inverted ? "text-white" : "text-navy dark:text-fg")}>
          Mënjëf{" "}
          <span className="rounded-md bg-accent px-1.5 py-0.5 text-[0.7rem] font-black tracking-wider text-white align-middle">PRO</span>
        </span>
        {tagline && (
          <span className={cn("block text-[0.68rem] font-medium", inverted ? "text-white/70" : "text-fg-muted")}>
            Gérez mieux, décidez mieux, grandissez plus vite !
          </span>
        )}
      </span>
    </span>
  );
}
