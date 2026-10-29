"use client";

import { useState } from "react";

/** Lien d'invitation à copier ou partager par WhatsApp */
export function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const full = link.startsWith("/") ? `${window.location.origin}${link}` : link;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm sm:col-span-2">
      <code className="min-w-0 flex-1 break-all text-xs">{full}</code>
      <button
        type="button"
        className="rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-white"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(full);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copié ✓" : "Copier"}
      </button>
      <a
        className="rounded-lg border border-success/40 px-3 py-1.5 text-xs font-bold text-success"
        href={`https://wa.me/?text=${encodeURIComponent(`Rejoignez notre espace Mënjëf PRO : ${full}`)}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>
    </div>
  );
}

