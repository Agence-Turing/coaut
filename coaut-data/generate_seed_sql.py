#!/usr/bin/env python3
"""Génère supabase/migrations/0002_seed.sql à partir des JSON scrapés."""
import json
import uuid
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
books = json.loads((HERE / "scraped" / "books.json").read_text())
turns = json.loads((HERE / "scraped" / "turns.json").read_text())

STATUS = {"Lancé": "launched", "Publié": "published"}


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def arr(items):
    return "array[" + ", ".join(q(i) for i in items) + "]::text[]" if items else "'{}'::text[]"


# 1. Auteurs (pseudonymes rencontrés partout)
nicknames = sorted(
    {n for b in books for n in b["playersNickname"]}
    | {b["launcherNickname"] for b in books if b["launcherNickname"]}
    | {t["playerNickname"] for t in turns if t.get("playerNickname")}
)
author_ids = {n: str(uuid.uuid4()) for n in nicknames}

out = ["-- Co-Aut v2 — seed : données réelles du MVP (72 livres, 448 tours)", ""]

out.append("insert into public.authors (id, nickname) values")
out.append(",\n".join(f"  ({q(author_ids[n])}, {q(n)})" for n in nicknames) + ";")
out.append("")

# 2. Livres
book_ids = {b["code"]: str(uuid.uuid4()) for b in books}
out.append(
    "insert into public.books (id, legacy_code, title, synopsis, themes, scolar_level, status, launcher_id) values"
)
rows = []
for b in sorted(books, key=lambda x: x["code"]):
    launcher = author_ids.get(b["launcherNickname"]) if b["launcherNickname"] else None
    rows.append(
        f"  ({q(book_ids[b['code']])}, {q(b['code'])}, {q(b['title'])}, {q(b['synopsys'])}, "
        f"{arr(b['themes'])}, {q(b['scolarLevel'])}, {q(STATUS[b['status']])}, {q(launcher)})"
    )
out.append(",\n".join(rows) + ";")
out.append("")

# 3. Équipes (ordre du tableau playersNickname = ordre de passage)
rows = []
for b in sorted(books, key=lambda x: x["code"]):
    for pos, n in enumerate(b["playersNickname"]):
        rows.append(f"  ({q(book_ids[b['code']])}, {q(author_ids[n])}, {pos})")
if rows:
    out.append("insert into public.book_players (book_id, author_id, position) values")
    out.append(",\n".join(rows) + ";")
    out.append("")

# 4. Tours (contenu = paragraphes joints par double saut de ligne)
out.append(
    "insert into public.turns (id, legacy_id, book_id, number, author_id, content, is_ended, is_validated) values"
)
rows = []
for t in sorted(turns, key=lambda x: (x["bookCode"], x["number"])):
    content = "\n\n".join(t["content"]) if t["content"] else None
    author = author_ids.get(t["playerNickname"]) if t.get("playerNickname") else None
    rows.append(
        f"  ({q(t['id'])}, {q(t['id'])}, {q(book_ids[t['bookCode']])}, {t['number']}, "
        f"{q(author)}, {q(content)}, {q(t['isEnded'])}, {q(t['isValidated'])})"
    )
out.append(",\n".join(rows) + ";")

dest = ROOT / "supabase" / "migrations" / "0002_seed.sql"
dest.write_text("\n".join(out), encoding="utf-8")
print(f"{dest} : {len(nicknames)} auteurs, {len(books)} livres, {len(turns)} tours")
