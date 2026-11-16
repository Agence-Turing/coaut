import Image from "next/image";

/**
 * Logo Co-Aut pour fond clair : le rond du logo (image) + le nom retapé.
 * Le fichier d'origine a « Co » en blanc, illisible sur blanc.
 */
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-3">
      <Image
        src="/images/logo-mark.png"
        alt=""
        width={size}
        height={size}
        priority
        className="shrink-0 rounded-full"
      />
      <span
        className="font-display font-bold leading-none tracking-tight text-ink"
        style={{ fontSize: Math.round(size * 0.65) }}
      >
        Co-<span className="text-accent">Aut</span>
      </span>
    </span>
  );
}
