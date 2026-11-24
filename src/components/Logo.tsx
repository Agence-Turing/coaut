import Image from "next/image";

/**
 * Logo Co-Aut complet (rond + « Co-Aut » en American Typewriter), pour fond clair.
 * `logo-co-aut-clair.png` = le fichier officiel du site (`logo-co-aut.png`)
 * avec « Co » passé du blanc à l'encre, sinon invisible sur fond blanc.
 */
const RATIO = 1197 / 451;

export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/images/logo-co-aut-clair.png"
      alt="Co-Aut"
      width={Math.round(size * RATIO)}
      height={size}
      priority
      className="shrink-0"
    />
  );
}
