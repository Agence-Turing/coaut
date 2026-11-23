#!/usr/bin/env python3
"""Reprise de l'ancienne base Notion de Co-Aut (export « Bdd - prod ») dans la base Supabase.

Usage :
    python3 scripts/import-notion.py EXPORT [--dry-run | --apply] [--sql FICHIER] [--force]

EXPORT = le zip exporté depuis Notion (Markdown & CSV, sous-pages incluses) ou le dossier
déjà dézippé. Le script lit l'export, le traduit vers notre modèle et produit UN script
SQL transactionnel et rejouable (upsert sur l'identifiant de page Notion, `legacy_id`).

Connexion : variable d'environnement COAUT_PSQL = la commande psql qui lit le SQL sur
son entrée standard. Exemples :
    COAUT_PSQL='docker exec -i coaut-db psql -U postgres -d postgres'          (sur la VM)
    COAUT_PSQL='ssh -J ubuntu@DEDIE turing@VM docker exec -i coaut-db psql -U postgres -d postgres'
    COAUT_PSQL='psql postgresql://postgres:…@127.0.0.1:5432/postgres'

Modes :
    (rien)      analyse de l'export seule, aucun accès à la base
    --dry-run   exécute tout dans la base puis ROLLBACK : compteurs réels, rien n'est écrit
    --apply     exécute et COMMIT
    --sql F     écrit en plus le SQL dans F (contient des données personnelles : ne pas commiter)

Aucun mail n'est envoyé : les comptes sont créés directement dans auth.users, sans mot de
passe (connexion impossible tant que l'auteur n'a pas fait « mot de passe oublié »).
Prérequis : migration supabase/migrations/0006_reprise_notion.sql. Détail : docs/reprise-notion.md.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import secrets
import shlex
import subprocess
import sys
import uuid
import zipfile
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path, PurePosixPath

MOIS = {
    "janvier": 1, "février": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6, "juillet": 7,
    "août": 8, "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12,
}
STATUT_LIVRE = {"Lancé": "launched", "Commencé": "launched", "Publié": "published", "": "archived"}
STATUT_DEMANDE = {"Accepté": "accepted", "Refusé": "rejected", "En attente": "pending"}
# Niveau scolaire des joueurs → vocabulaire des livres (celui des filtres du site).
NIVEAU = {
    "cp": "CP", "ce1": "CE1", "ce2": "CE2", "cm1": "CM1", "cm2": "CM2", "6e": "6eme",
    "5e": "5ème", "4e": "4ème", "3e": "3ème", "2e": "2nde", "1e": "1ère",
    "term": "Terminale", "adulte": "Adulte",
}
ID_RE = re.compile(r"([0-9a-f]{32})\.md")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CRAYONS = re.compile("[✏️]")


# ---------------------------------------------------------------- lecture de l'export
class Export:
    """Accès uniforme à un zip Notion ou à un dossier dézippé."""

    def __init__(self, path: Path):
        self.files: dict[str, object] = {}
        if path.is_dir():
            for f in path.rglob("*"):
                if f.is_file():
                    self.files[f.relative_to(path).as_posix()] = f
        else:
            self.zip = zipfile.ZipFile(path)
            for info in self.zip.infolist():
                if info.is_dir():
                    continue
                name = info.filename
                if not info.flag_bits & 0x800:  # nom non marqué UTF-8 : Notion écrit quand même de l'UTF-8
                    try:
                        name = name.encode("cp437").decode("utf-8")
                    except UnicodeError:
                        pass
                self.files[name] = info

    def read(self, name: str) -> str:
        f = self.files[name]
        raw = f.read_bytes() if isinstance(f, Path) else self.zip.read(f)
        return raw.decode("utf-8-sig")

    def table(self, prefix: str) -> list[dict]:
        """Le CSV complet (« _all ») de la base dont le nom commence par prefix."""
        names = [n for n in self.files
                 if PurePosixPath(n).name.startswith(prefix) and n.endswith("_all.csv")]
        if len(names) != 1:
            sys.exit(f"Export : CSV « {prefix}…_all.csv » introuvable ou en double ({names}). "
                     "Exporter depuis Notion en « Markdown & CSV », toutes les propriétés.")
        return list(csv.DictReader(io.StringIO(self.read(names[0]))))

    def pages(self, folder: str) -> list[tuple[str, str]]:
        """(identifiant Notion, texte) des pages .md d'une base."""
        out = []
        for n in sorted(self.files):
            p = PurePosixPath(n)
            m = ID_RE.search(p.name)
            if m and p.parent.name.startswith(folder):
                out.append((str(uuid.UUID(m.group(1))), self.read(n)))
        return out


def parse_date(s: str, with_time: bool = True) -> str | None:
    m = re.match(r"\s*(\d{1,2}) (\S+) (\d{1,4})(?: (\d{1,2}):(\d{2}))?", s or "")
    if not m or m.group(2) not in MOIS:
        return None
    y = int(m.group(3))
    if y < 1900 or y > 2100:
        return None
    try:
        d = datetime(y, MOIS[m.group(2)], int(m.group(1)), int(m.group(4) or 0), int(m.group(5) or 0))
    except ValueError:
        return None
    # Notion exporte dans le fuseau du compte (France).
    return d.strftime("%Y-%m-%d %H:%M Europe/Paris") if with_time else d.strftime("%Y-%m-%d")


def link_ids(cell: str) -> list[str]:
    """Identifiants des pages liées dans une cellule de relation, dans l'ordre."""
    return [str(uuid.UUID(h)) for h in ID_RE.findall(cell or "")]


def page_title(text: str) -> str:
    first = text.split("\n", 1)[0]
    return first[2:].strip() if first.startswith("# ") else first.strip()


def page_props_body(text: str) -> tuple[dict, str]:
    """Page dont les propriétés tiennent sur une ligne : bloc « Clé: valeur » puis corps."""
    parts = text.split("\n\n", 2)
    props = {}
    for line in (parts[1] if len(parts) > 1 else "").split("\n"):
        k, sep, v = line.partition(": ")
        if sep:
            props[k.strip()] = v.strip()
    return props, (parts[2] if len(parts) > 2 else "")


def clean_body(md: str) -> str | None:
    """Corps Markdown d'un tour → texte en paragraphes (comme le reste de la base)."""
    lines = [l.rstrip() for l in md.replace("\r\n", "\n").split("\n")]
    text = "\n".join(lines).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text or None


def base_pseudo(p: str) -> str:
    return CRAYONS.sub("", p or "").strip().casefold()


def build(export: Export) -> tuple[dict, list[tuple[str, int]], dict]:
    """Traduit l'export vers notre modèle. Renvoie (données, compteurs, détails écartés)."""
    stats: list[tuple[str, int]] = []
    skipped: dict[str, list] = defaultdict(list)

    # --- Joueurs → authors + author_profiles + auth.users
    rows = export.table("Joueurs")
    ids_by_title = defaultdict(list)
    notes = {}
    for pid, text in export.pages("Joueurs"):
        ids_by_title[page_title(text)].append(pid)
        # Corps libre de la fiche (note de Juliette) : tout ce qui suit le bloc de propriétés.
        body = text.split("\n\n", 2)[2].strip() if text.count("\n\n") >= 2 else ""
        if body and not re.match(r"^[^\n:]{1,40}: ", body):
            notes[pid] = body
    players, emails = [], Counter()
    for r in rows:
        pseudo = r["Pseudo"].strip()
        cand = ids_by_title.get(pseudo, [])
        if not pseudo or len(cand) != 1:
            skipped["joueurs sans page Notion unique"].append(pseudo)
            continue
        email = r["E-mail"].strip().lower()
        if not EMAIL_RE.match(email):
            skipped["joueurs à l'e-mail invalide (auteur repris sans compte)"].append(pseudo)
            email = None
        else:
            emails[email] += 1
        players.append({
            "id": cand[0], "pseudo": pseudo, "email": email,
            "first_name": r["Prénom"].strip() or None, "last_name": r["Nom"].strip() or None,
            "birth_date": parse_date(r["Date de naissance"], with_time=False),
            "school_level": NIVEAU.get(r["Niveau scolaire"].strip().lower(), r["Niveau scolaire"].strip() or None),
            "city": r["Ville"].strip() or None, "country": r["Pays"].strip().title() or None,
            "is_professional": r["Professionnel"] == "Yes" or r["Est professionnel"] == "oui",
            "accepts_marketing": r["Accepte communications commerciales"] == "Yes" or r["Mailing List"] == "oui",
            "created": parse_date(r["Date de création"]), "note": notes.get(cand[0]),
        })
    for p in players:  # un e-mail partagé par plusieurs fiches : un seul compte possible
        if p["email"] and emails[p["email"]] > 1:
            skipped["joueurs à l'e-mail en double (auteur repris sans compte)"].append(p["pseudo"])
            p["email"] = None
    player_ids = {p["id"] for p in players}
    by_base = defaultdict(list)
    for p in players:
        by_base[base_pseudo(p["pseudo"])].append(p["id"])
    stats += [("Export · joueurs", len(rows)), ("Export · joueurs repris", len(players)),
              ("Export · comptes à créer ou rattacher (e-mail valide)", sum(1 for p in players if p["email"]))]

    # --- Tours (lus dans les pages : le texte n'est pas dans le CSV)
    turns, seen = [], set()
    pages = export.pages("Tours d")
    for tid, text in pages:
        props, body = page_props_body(text)
        code = page_title(text)
        book = link_ids(props.get("Livre", ""))
        if len(book) != 1:
            skipped["tours sans livre (livre supprimé de Notion)"].append(code)
            continue
        m = re.search(r"(\d+)\s*$", code)
        number = int(props["Numéro"]) if props.get("Numéro", "").isdigit() else (int(m.group(1)) if m else None)
        if number is None:
            skipped["tours sans numéro"].append(code)
            continue
        if (book[0], number) in seen:
            skipped["tours en double (même livre, même numéro)"].append(code)
            continue
        seen.add((book[0], number))
        author = [a for a in link_ids(props.get("Joueur", "")) if a in player_ids]
        turns.append({
            "id": tid, "book_id": book[0], "number": number, "author_id": author[0] if author else None,
            "content": clean_body(body), "is_ended": props.get("Terminé") == "Yes",
            "is_validated": props.get("Validé") == "Yes", "created": parse_date(props.get("Date de création", "")),
        })
    stats += [("Export · tours", len(pages))]

    # --- Livres
    rows = export.table("Livres")
    ids_by_title = defaultdict(list)
    for bid, text in export.pages("Livres"):
        ids_by_title[page_title(text)].append(bid)
    turns_by_book = defaultdict(list)
    for t in turns:
        turns_by_book[t["book_id"]].append(t)
    books = []
    for r in rows:
        code = r["Code"].strip()
        cand = ids_by_title.get(code, [])
        if not code or not r["Titre"].strip() or len(cand) != 1:
            skipped["livres vides (sans code ou sans titre)"].append(code or "(sans code)")
            continue
        launcher = [a for a in link_ids(r["Lanceur"]) if a in player_ids]
        team = [a for a in link_ids(r["Joueurs"]) if a in player_ids]
        if launcher and launcher[0] not in team:
            team.insert(0, launcher[0])
        # Ordre de passage = ordre de première écriture, puis l'ordre de la fiche.
        order = []
        for t in sorted(turns_by_book[cand[0]], key=lambda t: t["number"]):
            if t["author_id"] in team and t["author_id"] not in order:
                order.append(t["author_id"])
        order += [a for a in team if a not in order]
        # Livre en cours sans tour ouvert : le site calcule le prochain auteur par rotation
        # (tours terminés % taille de l'équipe). On décale l'ordre pour que ce soit bien
        # la personne qui suit le dernier auteur.
        mine = sorted(turns_by_book[cand[0]], key=lambda t: t["number"])
        if mine and len(order) > 1 and all(t["is_ended"] for t in mine) and mine[-1]["author_id"] in order:
            nxt = order[(order.index(mine[-1]["author_id"]) + 1) % len(order)]
            shift = (order.index(nxt) - len(mine)) % len(order)
            order = order[shift:] + order[:shift]
        books.append({
            "id": cand[0], "code": code, "title": r["Titre"].strip(), "synopsis": r["Synopsis"].strip() or None,
            "themes": [t.strip() for t in r["Thème(s)"].split(",") if t.strip()],
            "scolar_level": r["Niveau scolaire"].strip() or None,
            "status": STATUT_LIVRE.get(r["Statut"].strip(), "archived"),
            "launcher_id": launcher[0] if launcher else None,
            "created": parse_date(r["Date de création"] or r["Date"]), "players": order,
            # « Commencé » = l'équipe est formée et écrit : sur l'ancien site, plus personne ne
            # pouvait demander à rejoindre (seul « Lancé » montrait le bouton).
            "team_closed": r["Statut"].strip() == "Commencé",
        })
    book_ids = {b["id"] for b in books}
    by_code = {b["code"]: b["id"] for b in books}
    kept = []
    for t in turns:
        if t["book_id"] in book_ids:
            kept.append(t)
        else:
            skipped["tours sans livre (livre supprimé de Notion)"].append(str(t["number"]))
    turns = kept
    stats += [("Export · tours repris", len(turns)),
              ("Export · tours repris avec texte", sum(1 for t in turns if t["content"])),
              ("Export · livres", len(rows)), ("Export · livres repris", len(books)),
              ("Export · livres repris sans statut (→ archived, invisibles)", sum(1 for b in books if b["status"] == "archived")),
              ("Export · livres « Commencé » (équipe fermée, pas à rejoindre)", sum(1 for b in books if b["team_closed"])),
              ("Export · places dans les équipes", sum(len(b["players"]) for b in books))]

    # --- Demandes de participation (pas de relation dans Notion : code du livre et pseudo en texte)
    pages = export.pages("Demandes")
    requests = {}
    for rid, text in pages:
        props, _ = page_props_body(text)
        code, pseudo = props.get("Code livre", ""), props.get("Pseudo joueur", "")
        if code.endswith("_ANN"):
            skipped["demandes au code suffixé _ANN (annulées)"].append(code)
            continue
        if code not in by_code:
            skipped["demandes sur un livre supprimé de Notion"].append(code)
            continue
        cand = by_base.get(base_pseudo(pseudo), [])
        if len(cand) != 1:
            skipped["demandes d'un joueur supprimé de Notion"].append(code)
            continue
        req = {"id": rid, "book_id": by_code[code], "author_id": cand[0],
               "status": STATUT_DEMANDE.get(props.get("Statut", ""), "pending"),
               "created": parse_date(props.get("Date de création", ""))}
        key = (req["book_id"], req["author_id"])
        if key in requests:  # une seule demande par (livre, auteur) chez nous : on garde la dernière
            skipped["demandes en double (même livre, même joueur) : la plus récente gardée"].append(code)
            if (req["created"] or "") < (requests[key]["created"] or ""):
                continue
        requests[key] = req
    stats += [("Export · demandes", len(pages)), ("Export · demandes reprises", len(requests))]

    dates = [x["created"] for coll in (players, books, turns) for x in coll if x["created"]]
    data = {"players": players, "books": books, "turns": turns, "requests": list(requests.values()),
            "export_max_date": max(dates) if dates else None}
    return data, stats, skipped


# ---------------------------------------------------------------- SQL
SQL = r"""
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
begin;

do $check$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'author_profiles') then
    raise exception 'Migration supabase/migrations/0006_reprise_notion.sql non appliquée sur cette base.';
  end if;
end $check$;

create temp table _doc on commit drop as select $__TAG__$__JSON__$__TAG__$::jsonb as d;
create temp table _r (ord serial, label text, n bigint) on commit drop;

create temp table _p on commit drop as
  select * from jsonb_to_recordset((select d -> 'players' from _doc)) as x(
    id uuid, pseudo text, email text, first_name text, last_name text, birth_date date,
    school_level text, city text, country text, is_professional boolean,
    accepts_marketing boolean, created timestamptz, note text);
create temp table _b on commit drop as
  select * from jsonb_to_recordset((select d -> 'books' from _doc)) as x(
    id uuid, code text, title text, synopsis text, themes jsonb, scolar_level text,
    status text, launcher_id uuid, created timestamptz, players jsonb, team_closed boolean);
create temp table _t on commit drop as
  select * from jsonb_to_recordset((select d -> 'turns' from _doc)) as x(
    id uuid, book_id uuid, number integer, author_id uuid, content text,
    is_ended boolean, is_validated boolean, created timestamptz);
create temp table _q on commit drop as
  select * from jsonb_to_recordset((select d -> 'requests' from _doc)) as x(
    id uuid, book_id uuid, author_id uuid, status text, created timestamptz);

-- Garde-fou : après l'ouverture du nouveau site, rejouer écraserait ce que les auteurs ont écrit.
do $guard$
declare
  lim timestamptz := ((select d ->> 'export_max_date' from _doc))::timestamptz + interval '1 day';
  n integer;
begin
  select count(*) into n from public.turns where created_at > lim and legacy_id is null;
  if n > 0 and not __FORCE__ then
    raise exception 'La base contient % tour(s) écrits sur le nouveau site après la date de l''export : reprendre un export Notion à jour, ou relancer avec --force en connaissance de cause.', n;
  end if;
end $guard$;

-- 1. Auteurs ---------------------------------------------------------------
with u as (update public.authors a set legacy_id = p.id from _p p
           where a.legacy_id is null and a.nickname = p.pseudo and a.kind = 'adult'
             and not exists (select 1 from public.authors o where o.legacy_id = p.id) returning 1)
insert into _r (label, n) select 'auteurs déjà en base rattachés à leur fiche Notion', count(*) from u;

with i as (insert into public.authors (nickname, legacy_id, created_at)
           select p.pseudo, p.id, coalesce(p.created, now()) from _p p
           where not exists (select 1 from public.authors a where a.legacy_id = p.id)
           returning 1)
insert into _r (label, n) select 'auteurs créés', count(*) from i;

with u as (update public.authors a set created_at = p.created from _p p
           where a.legacy_id = p.id and p.created is not null and a.created_at is distinct from p.created returning 1)
insert into _r (label, n) select 'auteurs : date d''inscription corrigée', count(*) from u;

with s as (select a.id as author_id, p.* from _p p join public.authors a on a.legacy_id = p.id),
     i as (insert into public.author_profiles as ap (author_id, first_name, last_name, birth_date, school_level,
                                                    city, country, is_professional, accepts_marketing, admin_note)
           select author_id, first_name, last_name, birth_date, school_level, city, country,
                  is_professional, accepts_marketing, note from s
           on conflict (author_id) do update set
             first_name = excluded.first_name, last_name = excluded.last_name, birth_date = excluded.birth_date,
             school_level = excluded.school_level, city = excluded.city, country = excluded.country,
             is_professional = excluded.is_professional, accepts_marketing = excluded.accepts_marketing,
             admin_note = excluded.admin_note
           where (ap.first_name, ap.last_name, ap.birth_date, ap.school_level, ap.city, ap.country,
                  ap.is_professional, ap.accepts_marketing, ap.admin_note)
                 is distinct from
                 (excluded.first_name, excluded.last_name, excluded.birth_date, excluded.school_level, excluded.city,
                  excluded.country, excluded.is_professional, excluded.accepts_marketing, excluded.admin_note)
           returning 1)
insert into _r (label, n) select 'profils privés créés ou modifiés', count(*) from i;

-- 2. Comptes (auth.users) : sans mot de passe, e-mail déjà confirmé, aucun mail envoyé ---
create temp table _u on commit drop as
  select p.id as legacy_id, p.email, p.pseudo, p.created,
         (select u.id from auth.users u where lower(u.email) = p.email limit 1) as existing_id,
         gen_random_uuid() as new_id
  from _p p where p.email is not null;

with i as (insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                                   confirmation_token, recovery_token, email_change_token_new, email_change,
                                   phone_change, phone_change_token, email_change_token_current, reauthentication_token,
                                   raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
           select '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated', email, null, now(),
                  '', '', '', '', '', '', '', '',
                  '{"provider": "email", "providers": ["email"]}'::jsonb,
                  jsonb_build_object('nickname', pseudo, 'email_verified', true, 'phone_verified', false, 'legacy_import', 'notion'),
                  coalesce(created, now()), now(), false, false
           from _u where existing_id is null returning 1)
insert into _r (label, n) select 'comptes créés (sans mot de passe)', count(*) from i;

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  select new_id::text, new_id,
         jsonb_build_object('sub', new_id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
         'email', coalesce(created, now()), now()
  from _u where existing_id is null;

insert into _r (label, n) select 'comptes déjà existants (même e-mail), laissés tels quels', count(*) from _u where existing_id is not null;

with u as (update public.authors a set user_id = coalesce(x.existing_id, x.new_id) from _u x
           where a.legacy_id = x.legacy_id and a.user_id is null
             and not exists (select 1 from public.authors o where o.user_id = coalesce(x.existing_id, x.new_id))
           returning 1)
insert into _r (label, n) select 'auteurs reliés à leur compte', count(*) from u;

insert into _r (label, n)
  select 'CONFLIT : compte déjà relié à un autre pseudo (auteur Notion laissé sans compte)', count(*)
  from _u x join public.authors a on a.legacy_id = x.legacy_id where a.user_id is null;

-- 3. Livres ----------------------------------------------------------------
with u as (update public.books b set legacy_id = x.id from _b x
           where b.legacy_id is null and b.legacy_code = x.code
             and not exists (select 1 from public.books o where o.legacy_id = x.id) returning 1)
insert into _r (label, n) select 'livres déjà en base rattachés à leur fiche Notion', count(*) from u;

with i as (insert into public.books (legacy_id, legacy_code, title, synopsis, themes, scolar_level, status, launcher_id, created_at)
           select x.id, x.code, x.title, x.synopsis, array(select jsonb_array_elements_text(x.themes)), x.scolar_level,
                  x.status, (select a.id from public.authors a where a.legacy_id = x.launcher_id), coalesce(x.created, now())
           from _b x where not exists (select 1 from public.books b where b.legacy_id = x.id)
           returning 1)
insert into _r (label, n) select 'livres créés', count(*) from i;

with s as (select x.id, x.title, x.synopsis, array(select jsonb_array_elements_text(x.themes)) as themes, x.scolar_level,
                  x.status, (select a.id from public.authors a where a.legacy_id = x.launcher_id) as launcher_id, x.created
           from _b x),
     u as (update public.books b set title = s.title, synopsis = s.synopsis, themes = s.themes, scolar_level = s.scolar_level,
                  status = s.status, launcher_id = s.launcher_id, created_at = coalesce(s.created, b.created_at)
           from s where b.legacy_id = s.id
             and (b.title, b.synopsis, b.themes, b.scolar_level, b.status, b.launcher_id, b.created_at)
                 is distinct from
                 (s.title, s.synopsis, s.themes, s.scolar_level, s.status, s.launcher_id, coalesce(s.created, b.created_at))
           returning 1)
insert into _r (label, n) select 'livres mis à jour (statut, texte, lanceur, date)', count(*) from u;

-- 4. Équipes : l'ordre de passage vient de Notion ; on n'enlève jamais personne.
with s as (select b.id as book_id, a.id as author_id, (e.ord - 1)::integer as position
           from _b x join public.books b on b.legacy_id = x.id
           cross join lateral jsonb_array_elements_text(x.players) with ordinality as e(pid, ord)
           join public.authors a on a.legacy_id = e.pid::uuid),
     i as (insert into public.book_players as bp (book_id, author_id, position)
           select book_id, author_id, position from s
           on conflict (book_id, author_id) do update set position = excluded.position
           where bp.position is distinct from excluded.position returning 1)
insert into _r (label, n) select 'places d''équipe créées ou réordonnées', count(*) from i;

-- Équipe fermée (« Commencé » dans Notion) : nombre de places = taille de l'équipe, pour que le
-- livre ne soit plus à rejoindre (même règle que les nouveaux livres au complet). Les livres
-- « Lancé » gardent max_players null : ouverts à tous, sans règle « équipe au complet ».
-- Un nombre de places déjà posé et suffisant (rouvert par l'administration) est gardé.
with s as (select b.id, greatest((select count(*) from public.book_players bp where bp.book_id = b.id), 1)::integer as n
           from _b x join public.books b on b.legacy_id = x.id
           where x.team_closed and b.status = 'launched'),
     u as (update public.books b set max_players = s.n from s
           where b.id = s.id and (b.max_players is null or b.max_players < s.n) returning 1)
insert into _r (label, n) select 'livres « Commencé » fermés (places = équipe)', count(*) from u;

-- 5. Tours -----------------------------------------------------------------
create temp table _ts on commit drop as
  select x.id, b.id as book_id, x.number, (select a.id from public.authors a where a.legacy_id = x.author_id) as author_id,
         x.content, x.is_ended, x.is_validated, x.created
  from _t x join public.books b on b.legacy_id = x.book_id;

insert into _r (label, n)
  select 'CONFLIT : numéro de tour déjà pris par un tour écrit sur le nouveau site (tour Notion ignoré)', count(*)
  from _ts s join public.turns t on t.book_id = s.book_id and t.number = s.number and t.legacy_id is distinct from s.id
  where not exists (select 1 from public.turns o where o.legacy_id = s.id);

with u as (update public.turns t set book_id = s.book_id, number = s.number, author_id = s.author_id, content = s.content,
                  is_ended = s.is_ended, is_validated = s.is_validated, created_at = coalesce(s.created, t.created_at)
           from _ts s where t.legacy_id = s.id
             and (t.book_id, t.number, t.author_id, t.content, t.is_ended, t.is_validated, t.created_at)
                 is distinct from
                 (s.book_id, s.number, s.author_id, s.content, s.is_ended, s.is_validated, coalesce(s.created, t.created_at))
             and not exists (select 1 from public.turns o where o.book_id = s.book_id and o.number = s.number and o.id <> t.id)
           returning 1)
insert into _r (label, n) select 'tours déjà en base mis à jour (texte, auteur, date)', count(*) from u;

with i as (insert into public.turns (legacy_id, book_id, number, author_id, content, is_ended, is_validated, created_at)
           select s.id, s.book_id, s.number, s.author_id, s.content, s.is_ended, s.is_validated, coalesce(s.created, now())
           from _ts s
           where not exists (select 1 from public.turns t where t.legacy_id = s.id)
             and not exists (select 1 from public.turns t where t.book_id = s.book_id and t.number = s.number)
           returning 1)
insert into _r (label, n) select 'tours créés', count(*) from i;

-- 6. Demandes de participation --------------------------------------------
create temp table _qs on commit drop as
  select x.id, b.id as book_id, a.id as author_id, x.status, x.created
  from _q x join public.books b on b.legacy_id = x.book_id join public.authors a on a.legacy_id = x.author_id;

with u as (update public.join_requests j set legacy_id = s.id, status = s.status, created_at = coalesce(s.created, j.created_at)
           from _qs s where (j.legacy_id = s.id or (j.legacy_id is null and j.book_id = s.book_id and j.author_id = s.author_id
                                                    and not exists (select 1 from public.join_requests o where o.legacy_id = s.id)))
             and (j.legacy_id, j.status, j.created_at) is distinct from (s.id, s.status, coalesce(s.created, j.created_at))
           returning 1)
insert into _r (label, n) select 'demandes déjà en base mises à jour', count(*) from u;

with i as (insert into public.join_requests (legacy_id, book_id, author_id, status, created_at)
           select s.id, s.book_id, s.author_id, s.status, coalesce(s.created, now()) from _qs s
           where not exists (select 1 from public.join_requests j where j.legacy_id = s.id)
           on conflict (book_id, author_id) do nothing
           returning 1)
insert into _r (label, n) select 'demandes créées', count(*) from i;

-- Totaux de la base après import ------------------------------------------
insert into _r (label, n) select 'TOTAL auteurs', count(*) from public.authors;
insert into _r (label, n) select 'TOTAL auteurs avec un compte', count(*) from public.authors where user_id is not null;
insert into _r (label, n) select 'TOTAL profils privés', count(*) from public.author_profiles;
insert into _r (label, n) select 'TOTAL comptes (auth.users)', count(*) from auth.users;
insert into _r (label, n) select 'TOTAL comptes sans mot de passe', count(*) from auth.users where encrypted_password is null or encrypted_password = '';
insert into _r (label, n) select 'TOTAL livres', count(*) from public.books;
insert into _r (label, n) select 'TOTAL livres ' || status, count(*) from public.books group by status order by status;
insert into _r (label, n) select 'TOTAL places d''équipe', count(*) from public.book_players;
insert into _r (label, n) select 'TOTAL tours', count(*) from public.turns;
insert into _r (label, n) select 'TOTAL tours avec texte', count(*) from public.turns where content is not null;
insert into _r (label, n) select 'TOTAL demandes', count(*) from public.join_requests;

select label || '|' || n from _r order by ord;
__END__;
"""


def make_sql(data: dict, commit: bool, force: bool) -> str:
    doc = json.dumps(data, ensure_ascii=False)
    tag = "notion_" + secrets.token_hex(8)
    while tag in doc:
        tag = "notion_" + secrets.token_hex(8)
    return (SQL.replace("__TAG__", tag).replace("__FORCE__", "true" if force else "false")
            .replace("__END__", "commit" if commit else "rollback").replace("__JSON__", doc))


def main() -> int:
    ap = argparse.ArgumentParser(description="Reprise de la base Notion de Co-Aut (voir docs/reprise-notion.md).")
    ap.add_argument("export", type=Path, help="zip de l'export Notion ou dossier dézippé")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="exécute dans la base puis annule (ROLLBACK)")
    mode.add_argument("--apply", action="store_true", help="exécute dans la base et valide (COMMIT)")
    ap.add_argument("--sql", type=Path, help="écrit aussi le SQL généré dans ce fichier (données personnelles)")
    ap.add_argument("--force", action="store_true", help="passe outre le garde-fou « site déjà ouvert »")
    ap.add_argument("--details", action="store_true", help="liste les codes des lignes écartées")
    args = ap.parse_args()

    if not args.export.exists():
        sys.exit(f"Introuvable : {args.export}")
    data, stats, skipped = build(Export(args.export))

    print("== Lecture de l'export Notion")
    for label, n in stats:
        print(f"  {n:>6}  {label}")
    print("== Écarté (non repris)")
    for label, items in sorted(skipped.items()):
        print(f"  {len(items):>6}  {label}")
        if args.details:
            for code, n in sorted(Counter(items).items()):
                print(f"            {code}" + (f" ×{n}" if n > 1 else ""))

    sql = make_sql(data, commit=args.apply, force=args.force)
    if args.sql:
        args.sql.write_text(sql, encoding="utf-8")
        os.chmod(args.sql, 0o600)
        print(f"SQL écrit dans {args.sql} (données personnelles : à supprimer après usage)")
    if not (args.dry_run or args.apply):
        print("\nAnalyse seule : rien n'a été lu ni écrit dans la base (--dry-run ou --apply pour continuer).")
        return 0

    cmd = os.environ.get("COAUT_PSQL")
    if not cmd:
        sys.exit("COAUT_PSQL n'est pas définie (commande psql qui lit le SQL sur son entrée standard).")
    res = subprocess.run(shlex.split(cmd), input=sql.encode("utf-8"), capture_output=True)
    out, err = res.stdout.decode("utf-8", "replace"), res.stderr.decode("utf-8", "replace")
    if res.returncode != 0 or "ERROR" in err:
        print(err.strip() or out.strip(), file=sys.stderr)
        print("\nÉCHEC : la transaction a été annulée, la base n'a pas changé.", file=sys.stderr)
        return 1
    print("== Base " + ("(ESSAI À BLANC : tout a été annulé, rien n'est écrit)" if args.dry_run else "(import validé)"))
    for line in out.splitlines():
        label, sep, n = line.rpartition("|")
        if sep and n.strip().lstrip("-").isdigit():
            print(f"  {int(n):>6}  {label}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
