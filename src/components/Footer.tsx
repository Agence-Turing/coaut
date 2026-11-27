const LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/co_aut" },
  { label: "Facebook", href: "https://www.facebook.com/CoAutJuliette" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/juliette-lejeune-/" },
  { label: "Nous contacter", href: "https://www.co-aut.com/contact/" },
  { label: "Mentions légales", href: "https://www.co-aut.com/mentions-legales/" },
  { label: "Confidentialité", href: "https://www.co-aut.com/politique-de-confidentialite/" },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:px-6">
        <p>© 2026 Co-Aut</p>
        <ul className="flex flex-wrap items-center justify-center gap-x-6">
          {LINKS.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center font-medium text-link hover:text-link-hover hover:underline"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
