#!/usr/bin/env python3
"""Scrape complet de l'API du MVP co-aut.com → JSON locaux.

Produit dans coaut-data/scraped/ :
- books.json  : tous les livres (statuts Launched + Published)
- turns.json  : tous les tours de tous les livres, avec leur contenu texte
- errors.json : requêtes en échec, pour contrôle
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "scraped"
OUT.mkdir(exist_ok=True)

API = "https://app-api.co-aut.com"
TOKEN = re.search(r"^Bearer (\S+)", (HERE / "route2.txt").read_text(), re.M).group(1)

errors = []


def get(path):
    url = API + path
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/json",
        "Origin": "https://app.co-aut.com",
        "User-Agent": "Mozilla/5.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except Exception as e:
        errors.append({"path": path, "error": str(e)})
        return None


def fetch_book_turns(book):
    code = book["code"]
    quoted = urllib.parse.quote(code, safe="")
    turns = []
    for n in range(1, book["turnsCount"] + 1):
        meta = get(f"/books/{quoted}/turns/{n}")
        if meta is None:
            continue
        content = get(f"/turns/{meta['id']}/content")
        meta["content"] = content
        turns.append(meta)
    print(f"{code}: {len(turns)}/{book['turnsCount']} tours", flush=True)
    return turns


def main():
    books = get("/books")
    if not books:
        sys.exit("échec /books")
    (OUT / "books.json").write_text(json.dumps(books, ensure_ascii=False, indent=2))
    print(f"{len(books)} livres récupérés")

    all_turns = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for turns in pool.map(fetch_book_turns, books):
            all_turns.extend(turns)

    (OUT / "turns.json").write_text(json.dumps(all_turns, ensure_ascii=False, indent=2))
    (OUT / "errors.json").write_text(json.dumps(errors, ensure_ascii=False, indent=2))
    print(f"{len(all_turns)} tours récupérés, {len(errors)} erreurs")


if __name__ == "__main__":
    main()
