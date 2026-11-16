#!/usr/bin/env python3
"""Génère la couverture illustrée des livres Co-Aut (une image par livre) avec le CLI Higgsfield.

Pour chaque livre non archivé sans couverture : une illustration tirée du titre et du résumé, convertie
en WebP 600×800, déposée dans le dossier des couvertures de l'app, puis `books.cover_path` renseigné.
L'app la sert à /couvertures/<cover_path> (src/app/couvertures/[fichier]/route.ts).

Rejouable : un livre qui a déjà son image brute dans le dossier de travail n'est jamais regénéré
(on reprend à la conversion et au dépôt), un livre qui a déjà un cover_path est ignoré.
Seuls le titre et le résumé partent chez Higgsfield : aucun pseudo, e-mail ni texte des tours.

Prérequis
  - CLI : `npm install -g @higgsfield/cli`, puis `higgsfield auth login` et
    `higgsfield workspace list` / `higgsfield workspace set <id>` (compte de l'agence).
  - Python avec Pillow.
  - COAUT_PSQL : commande psql vers la base (même variable que scripts/import-notion.py), ex.
      export COAUT_PSQL='ssh -J ubuntu@54.38.69.101 turing@192.168.200.10 docker exec -i coaut-db psql -U postgres -d postgres'
  - COAUT_COUVERTURES : destination rsync du dossier des couvertures, ex.
      export COAUT_COUVERTURES='turing@192.168.200.10:/opt/coaut/couvertures/'
      export COAUT_RSH='ssh -J ubuntu@54.38.69.101'        # facultatif, passé à rsync -e

Usage
  generer-couvertures.py --lister                 # livres à traiter, et ce qui partirait au service
  generer-couvertures.py --limite 6               # un premier lot
  generer-couvertures.py                          # tout le reste
  generer-couvertures.py --codes 052,070          # seulement ces livres (code hérité ou début d'uuid)
  generer-couvertures.py --refaire 052            # nouvelle image pour un livre (l'ancienne est retirée)
  generer-couvertures.py --retirer 052            # plus de couverture pour ce livre (repli de l'interface)

Dossier de travail (images brutes, journal) : ./couvertures-travail/, ignoré par git.
"""
import argparse
import hashlib
import io
import json
import os
import re
import shlex
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

TRAVAIL = Path(os.environ.get("COAUT_COUVERTURES_TRAVAIL", "couvertures-travail"))
MODELE_PAR_DEFAUT = "nano_banana_2"
LARGEUR, HAUTEUR, POIDS_MAX = 600, 800, 150_000

# Style unique de la collection : ne le changer qu'en refaisant toutes les couvertures.
STYLE = (
    "Flat children's book cover illustration, vector-like, simple bold shapes, soft rounded forms, "
    "no outlines or very thin ones, subtle paper grain. Limited warm palette: orange #FF8A1E, "
    "red-orange #E0421C, peach #FFD9B0, off-white, warm light grey, with one deep charcoal #1C1917 for contrast. "
    "One clear central subject in the upper two thirds, calm uncluttered background, and quiet empty space in the "
    "bottom third (a title will be overlaid there). Friendly, gentle, suitable for young children and schools: "
    "nothing violent, scary or suggestive. Characters, if any, are small simplified figures with minimal "
    "dot-like features, never realistic faces. "
    "Absolutely no text, no letters, no numbers, no words, no logo, no signature, no watermark, no book frame "
    "or border: the picture fills the whole portrait canvas. "
    "Do not depict any character, costume, emblem or object from an existing franchise, brand, film, game or "
    "book series: if the story refers to one, show a generic scene of the same genre instead."
)


def sh(cmd, entree=None):
    r = subprocess.run(cmd, input=entree, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError((r.stdout + r.stderr).strip()[-600:])
    return r.stdout


def psql(sql):
    cmd = os.environ.get("COAUT_PSQL")
    if not cmd:
        sys.exit("COAUT_PSQL n'est pas défini (voir l'en-tête du script).")
    return sh(shlex.split(cmd) + ["-v", "ON_ERROR_STOP=1", "-At", "-f", "-"], entree=sql)


def q(v):
    """Littéral SQL."""
    return "null" if v is None else "'" + str(v).replace("'", "''") + "'"


def livres(tous=False):
    filtre = "" if tous else "and cover_path is null"
    sortie = psql(
        "select coalesce(json_agg(b order by b.legacy_code nulls last, b.created_at), '[]') from ("
        "select id, legacy_code, title, synopsis, themes, cover_path, created_at from public.books "
        f"where status <> 'archived' {filtre}) b;"
    )
    return json.loads(sortie)


def cle(livre):
    """Identifiant court et sûr pour les noms de fichiers : code hérité (« 052 ») ou début de l'uuid."""
    code = re.sub(r"[^A-Za-z0-9]", "", livre.get("legacy_code") or "")
    return code or livre["id"].replace("-", "")[:12]


def correspond(livre, codes):
    return cle(livre) in codes or livre["id"] in codes or any(livre["id"].startswith(c) for c in codes if len(c) >= 8)


AMORCES = re.compile(
    r"^(livre commenc|recherche|projet de classe|histoire [ée]crite|[ée]crit par|avec \d|atelier|texte [ée]crit)", re.I
)


def nettoyer(titre, resume):
    """Ne garde que l'histoire : retire les mentions de suivi (« écrit : nov 23 - mars 24 », « Recherche
    1 co-auteur : », « Histoire écrite par X et Y lors d'un atelier : ») qui peuvent contenir des prénoms."""
    titre = re.split(r"\s[-–]\s*[ée]crit\b", titre or "", flags=re.I)[0]
    titre = re.sub(r"\s*[-–]\s*tome\s*\d+\s*$", "", titre, flags=re.I).strip()
    resume = (resume or "").strip()
    for _ in range(3):
        tete, sep, reste = resume.partition(":")
        if sep and len(tete) < 200 and AMORCES.match(tete.strip()):
            resume = reste.strip()
        else:
            break
    resume = re.sub(r"\s+", " ", resume)[:500]
    return titre, resume


def consigne(livre):
    titre, resume = nettoyer(livre["title"], livre.get("synopsis"))
    themes = ", ".join(livre.get("themes") or [])
    sujet = f'Story title: "{titre}".'
    if resume:
        sujet += f" Story summary (in French): {resume}"
    if themes:
        sujet += f" Genre: {themes}."
    return f"{STYLE} Illustrate this story with a single evocative scene. {sujet}"


def generer(texte, modele):
    """Un job Higgsfield, une image. Renvoie les octets de l'image."""
    sortie = subprocess.run(
        ["higgsfield", "generate", "create", modele, "--prompt", texte, "--aspect_ratio", "3:4",
         "--resolution", "1k", "--wait", "--wait-timeout", "15m", "--json"],
        capture_output=True, text=True,
    )
    try:
        url = json.loads(sortie.stdout)[0]["result_url"]
    except (ValueError, LookupError, TypeError):
        raise RuntimeError((sortie.stdout + sortie.stderr).strip()[-400:] or "réponse vide du CLI")
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()


def en_webp(brut):
    """Recadre en 3:4, réduit à 600×800 et compresse sous 150 Ko."""
    from PIL import Image

    im = Image.open(io.BytesIO(brut)).convert("RGB")
    w, h = im.size
    if w * HAUTEUR > h * LARGEUR:  # trop large : on coupe les côtés
        nw = h * LARGEUR // HAUTEUR
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:  # trop haut : on coupe en haut et en bas
        nh = w * HAUTEUR // LARGEUR
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im = im.resize((LARGEUR, HAUTEUR), Image.LANCZOS)
    for qualite in (84, 78, 72, 64, 56, 48):
        tampon = io.BytesIO()
        im.save(tampon, "WEBP", quality=qualite, method=6)
        if tampon.tell() <= POIDS_MAX:
            break
    return tampon.getvalue()


def deposer(fichier):
    dest = os.environ.get("COAUT_COUVERTURES")
    if not dest:
        sys.exit("COAUT_COUVERTURES n'est pas défini (voir l'en-tête du script).")
    cmd = ["rsync", "-a", "--chmod=F644"]
    if os.environ.get("COAUT_RSH"):
        cmd += ["-e", os.environ["COAUT_RSH"]]
    sh(cmd + [str(fichier), dest])


def retirer_distant(nom):
    """Supprime un fichier du dossier des couvertures (destination rsync locale ou hôte:chemin)."""
    dest = os.environ.get("COAUT_COUVERTURES", "")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,80}\.webp", nom or ""):
        return
    if ":" in dest:
        hote, chemin = dest.split(":", 1)
        rsh = shlex.split(os.environ.get("COAUT_RSH", "ssh"))
        sh(rsh + [hote, "rm", "-f", "--", chemin.rstrip("/") + "/" + nom])
    elif dest:
        Path(dest, nom).unlink(missing_ok=True)


def journal(ligne):
    TRAVAIL.mkdir(exist_ok=True)
    with open(TRAVAIL / "journal.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps({"quand": time.strftime("%Y-%m-%d %H:%M:%S"), **ligne}, ensure_ascii=False) + "\n")


def traiter(livre, modele, refaire=False):
    k = cle(livre)
    brut = TRAVAIL / "brut" / f"{k}.png"
    brut.parent.mkdir(parents=True, exist_ok=True)
    if refaire or not brut.exists():
        brut.write_bytes(generer(consigne(livre), modele))
        journal({"livre": k, "etape": "generee", "modele": modele})
    webp = en_webp(brut.read_bytes())
    nom = f"{k}-{hashlib.sha256(webp).hexdigest()[:8]}.webp"
    pret = TRAVAIL / "webp" / nom
    pret.parent.mkdir(parents=True, exist_ok=True)
    pret.write_bytes(webp)
    deposer(pret)
    garde = "" if refaire else "and cover_path is null"
    psql(f"update public.books set cover_path = {q(nom)} where id = {q(livre['id'])} {garde};")
    if refaire and livre.get("cover_path") and livre["cover_path"] != nom:
        retirer_distant(livre["cover_path"])
    journal({"livre": k, "etape": "en_ligne", "fichier": nom, "octets": len(webp)})
    return nom


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lister", action="store_true", help="montre les livres à traiter et la consigne envoyée")
    p.add_argument("--limite", type=int, help="nombre maximum de livres pour ce passage")
    p.add_argument("--codes", help="livres à traiter, séparés par des virgules")
    p.add_argument("--refaire", help="regénère la couverture de ce livre")
    p.add_argument("--retirer", help="retire la couverture de ce livre")
    p.add_argument("--modele", default=MODELE_PAR_DEFAUT, help=f"modèle Higgsfield (défaut : {MODELE_PAR_DEFAUT})")
    a = p.parse_args()

    if a.retirer or a.refaire:
        code = a.retirer or a.refaire
        cibles = [b for b in livres(tous=True) if correspond(b, {code})]
        if len(cibles) != 1:
            sys.exit(f"{len(cibles)} livre(s) pour « {code} » : rien de fait.")
        livre = cibles[0]
        if a.retirer:
            psql(f"update public.books set cover_path = null where id = {q(livre['id'])};")
            retirer_distant(livre.get("cover_path"))
            journal({"livre": cle(livre), "etape": "retiree", "fichier": livre.get("cover_path")})
            print(f"Couverture retirée : {livre['title']}")
        else:
            print(f"Refaite : {livre['title']} → {traiter(livre, a.modele, refaire=True)}")
        return

    a_faire = livres()
    if a.codes:
        codes = {c.strip() for c in a.codes.split(",") if c.strip()}
        a_faire = [b for b in a_faire if correspond(b, codes)]
    if a.limite:
        a_faire = a_faire[: a.limite]

    if a.lister:
        for b in a_faire:
            titre, resume = nettoyer(b["title"], b.get("synopsis"))
            print(f"{cle(b):>12} | {titre} | {resume[:110]}")
        print(f"{len(a_faire)} livre(s) sans couverture.")
        return

    faits, echecs = 0, []
    for i, b in enumerate(a_faire, 1):
        try:
            nom = traiter(b, a.modele)
            faits += 1
            print(f"[{i}/{len(a_faire)}] OK  {cle(b)} {b['title'][:50]} → {nom}", flush=True)
        except Exception as e:  # un livre en échec n'arrête pas le lot
            echecs.append(cle(b))
            journal({"livre": cle(b), "etape": "echec", "erreur": str(e)[-400:]})
            print(f"[{i}/{len(a_faire)}] ERR {cle(b)} {b['title'][:50]} : {str(e)[-200:]}", flush=True)
    print(f"{faits} couverture(s) en ligne, {len(echecs)} échec(s){' : ' + ', '.join(echecs) if echecs else ''}.")
    if echecs:
        sys.exit(1)


if __name__ == "__main__":
    main()
