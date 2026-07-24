import Link from "next/link";
import type { ComponentProps } from "react";

type CtaProps = ComponentProps<typeof Link> & { variant?: "solid" | "outline" };

export function Cta({ variant = "solid", className = "", ...props }: CtaProps) {
  const base =
    "inline-block rounded-full px-7 py-3 text-sm font-bold tracking-wide transition-colors duration-200";
  const styles =
    variant === "solid"
      ? "bg-brand text-white hover:bg-brand-dark shadow-[0_4px_14px_rgba(236,104,28,0.4)]"
      : "border-2 border-white text-white hover:bg-white hover:text-aubergine";
  return <Link {...props} className={`${base} ${styles} ${className}`} />;
}
