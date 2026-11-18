/** « de André » → « d'André », « de Léa » reste « de Léa ». */
export function deName(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöûüAEIOUYHÀÂÄÉÈÊËÎÏÔÖÛÜ]/.test(name) ? `d'${name}` : `de ${name}`;
}
