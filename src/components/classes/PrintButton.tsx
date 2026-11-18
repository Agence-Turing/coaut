"use client";

import { BTN_PRIMARY } from "@/components/ui";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={BTN_PRIMARY}>
      Imprimer
    </button>
  );
}
