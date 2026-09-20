#!/usr/bin/env python3
"""Analyse les migrations avec le vrai analyseur de PostgreSQL, sans base.

Pourquoi : sur ce projet une migration s'applique À LA MAIN sur la base réelle
(`supabase db query --file … --linked`). Une faute de frappe dans un corps
PL/pgSQL ne se découvre donc qu'au moment où on la joue en production — au
mieux la transaction échoue, au pire elle échoue à moitié.

Ce script lit les fichiers et les fait analyser par `libpg_query`, le parseur
que PostgreSQL utilise lui-même. Il ne se connecte à rien et ne modifie rien.

⚠️ IL VÉRIFIE LA SYNTAXE, PAS LE SENS. Une table qui n'existe pas, une colonne
mal nommée, une policy trop large : rien de tout ça ne se voit ici. C'est un
filtre bon marché posé avant les contrôles qui coûtent cher, pas un substitut.

⚠️ ET IL REGARDE LE CORPS DES FONCTIONS, ce que l'analyse SQL seule ne fait
pas : pour elle, `$function$ … $function$` n'est qu'une chaîne de caractères.
C'est justement là que vivent les fautes coûteuses.

Installation (une fois) :

    python3 -m venv .venv-pg && ./.venv-pg/bin/pip install pglast

Usage :

    ./.venv-pg/bin/python scripts/verifier-migrations.py            # toutes
    ./.venv-pg/bin/python scripts/verifier-migrations.py fichier.sql
"""
import pathlib
import re
import sys

try:
    from pglast import parse_sql
    from pglast.parser import parse_plpgsql_json, ParseError
except ImportError:
    sys.exit("pglast manque — voir l'en-tête de ce fichier pour l'installer.")

MIGRATIONS = pathlib.Path(__file__).resolve().parent.parent / "supabase" / "migrations"

# ⚠️ `parse_plpgsql` de pglast 8.4 échoue sur TOUTE fonction, y compris la plus
# simple : sa désérialisation JSON est cassée. `parse_plpgsql_json` rend la
# chaîne brute et lève quand même sur une vraie faute — c'est elle qu'on
# utilise. Vérifié en sabotant un corps (`if` sans `end if`) : refusé.
CORPS = re.compile(r"create (?:or replace )?function.*?\$function\$\s*;", re.S | re.I)


def verifier(fichier: pathlib.Path) -> tuple[int, int]:
    """Rend (instructions, corps de fonction). Lève sur la première faute."""
    sql = fichier.read_text(encoding="utf-8")
    instructions = parse_sql(sql)
    corps = CORPS.findall(sql)
    for c in corps:
        parse_plpgsql_json(c)
    return len(instructions), len(corps)


def main() -> int:
    cibles = [pathlib.Path(a) for a in sys.argv[1:]] or sorted(MIGRATIONS.glob("*.sql"))
    refusees = []
    instructions = corps = 0

    for fichier in cibles:
        try:
            i, c = verifier(fichier)
            instructions += i
            corps += c
            if len(cibles) <= 5:
                print(f"✓ {fichier.name} — {i} instructions, {c} corps PL/pgSQL")
        except (ParseError, Exception) as e:  # noqa: BLE001 — on veut tout attraper
            refusees.append((fichier.name, str(e).splitlines()[0][:120]))

    print(f"\n{len(cibles)} fichier(s) · {instructions} instructions · {corps} corps de fonction")
    if refusees:
        print(f"{len(refusees)} REFUSÉ(S) :")
        for nom, erreur in refusees:
            print(f"  ✗ {nom} — {erreur}")
        return 1
    print("aucune faute de syntaxe")
    return 0


if __name__ == "__main__":
    sys.exit(main())
