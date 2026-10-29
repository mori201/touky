import { PublicFooter, PublicHeader } from "@/components/public-shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main id="contenu">{children}</main>
      <PublicFooter />
    </>
  );
}
