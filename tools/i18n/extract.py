#!/usr/bin/env python3
"""Bataille des Alliés : liste des textes à traduire.

    python tools/i18n/extract.py          -> écrit tools/i18n/source.json (toutes les clés françaises, triées)
    python tools/i18n/extract.py --check  -> vérifie public/lang/<code>.js : clés manquantes, clés en trop,
                                             {variables} ou balises HTML différentes entre la clé et sa traduction.
                                             Code de sortie 1 s'il y a un problème.

La clé d'un texte, c'est le texte français lui-même (voir public/i18n.js). Sources des clés :
  a) le premier argument de chaque appel tr("...") dans cosmos.html ;
  b) le contenu HTML des éléments marqués data-i18n (espaces resserrés comme le fait i18n.js) ;
  c) les textes et les attributs aria-label / title du HTML statique (hors <script>, <style>, <head>, #splash,
     éléments data-i18n ou data-no-i18n), plus le <title> de la page ;
  d) les tables de données affichées au joueur (maisons, atouts, talents, boss, chapitres, niveaux d'IA, raretés,
     ligues, dés, dos, personnages, soldats, rivaux, tribus de casts.js, titres des cartes, formations).
Python 3, bibliothèque standard uniquement.
"""
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
GAME = PUBLIC / "cosmos.html"
CASTS = PUBLIC / "casts.js"
OUT = Path(__file__).resolve().parent / "source.json"
LANGS = ["en", "es", "de", "pt", "zh", "ja", "ko"]

HAS_LETTER = re.compile(r"[^\W\d_]")
STR_DQ = r'"((?:[^"\\\n]|\\.)*)"'


def js_unescape(s):
    """Décode les échappements d'une chaîne JS simple (\\" \\' \\\\ \\n \\t \\uXXXX)."""
    def rep(m):
        c = m.group(1)
        if c == "n":
            return "\n"
        if c == "t":
            return "\t"
        if c.startswith("u"):
            return chr(int(c[1:], 16))
        return c
    return re.sub(r"\\(u[0-9a-fA-F]{4}|.)", rep, s)


def keep(keys, text):
    if text and HAS_LETTER.search(text):
        keys.add(text)


def collapse(s):
    """Comme i18n.js : innerHTML.trim().replace(/\\s+/g, " ")."""
    return re.sub(r"\s+", " ", s.strip())


def serialize_inner(raw):
    """Approche la sérialisation innerHTML du navigateur pour du texte écrit à la main :
    les entités sont décodées puis &, <, > et l'espace insécable ressortent sous forme d'entités."""
    out = []
    for part in re.split(r"(<[^>]*>)", raw):
        if part.startswith("<"):
            out.append(part)
        else:
            t = html.unescape(part)
            t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace(" ", "&nbsp;")
            out.append(t)
    return "".join(out)


# ---------- a) appels tr("...") ----------
TR_CALL = re.compile(r'(?<![\w.$])tr\(\s*(' + STR_DQ + r"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`)", re.S)


def in_comment(src, pos):
    line_start = src.rfind("\n", 0, pos) + 1
    if re.search(r"(^|\s)//", src[line_start:pos]):
        return True
    return src.rfind("/*", 0, pos) > src.rfind("*/", 0, pos)


def tr_keys(src, keys, problems):
    for m in TR_CALL.finditer(src):
        if in_comment(src, m.start()):
            continue
        dq, sq, bt = m.group(2), m.group(3), m.group(4)
        raw = dq if dq is not None else sq if sq is not None else bt
        if bt is not None and "${" in bt:
            line = src.count("\n", 0, m.start()) + 1
            problems.append(f"cosmos.html:{line}: clé tr() avec ${{...}} : {bt[:60]}")
            continue
        keep(keys, js_unescape(raw))


# ---------- b) et c) HTML statique ----------
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class StaticText(HTMLParser):
    def __init__(self, keys):
        super().__init__(convert_charrefs=True)
        self.keys = keys
        self.stack = []  # (tag, skip)
        self.title = None

    def skipping(self):
        return bool(self.stack) and self.stack[-1][1]

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        skip = (self.skipping() or tag in ("script", "style", "head") or a.get("id") == "splash"
                or "data-i18n" in a or "data-no-i18n" in a)
        if not skip:
            for name in ("aria-label", "title"):
                if a.get(name):
                    keep(self.keys, a[name])
        if tag == "title":
            self.title = ""
        if tag not in VOID:
            self.stack.append((tag, skip))

    def handle_startendtag(self, tag, attrs):
        a = dict(attrs)
        if not self.skipping() and "data-i18n" not in a and "data-no-i18n" not in a:
            for name in ("aria-label", "title"):
                if a.get(name):
                    keep(self.keys, a[name])

    def handle_endtag(self, tag):
        if tag == "title" and self.title is not None:
            keep(self.keys, self.title.strip())
            self.title = None
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.title is not None:
            self.title += data
            return
        if not self.skipping():
            keep(self.keys, data.strip())


DATA_I18N = re.compile(r"<(\w+)\b([^>]*\sdata-i18n\b[^>]*)>(.*?)</\1\s*>", re.S)


def html_keys(src, keys):
    page = re.sub(r"<script\b.*?</script>", lambda m: "<script></script>", src, flags=re.S)
    for m in DATA_I18N.finditer(page):
        keep(keys, collapse(serialize_inner(m.group(3))))
    StaticText(keys).feed(page)


# ---------- d) tables de données ----------
def block(src, start_pat):
    """Texte d'une déclaration `const X = ...;` (jusqu'au premier `;` en fin de ligne)."""
    m = re.search(start_pat, src)
    if not m:
        return ""
    end = re.search(r"[\]}];\s*$", src[m.end():], re.M)
    return src[m.start(): m.end() + (end.end() if end else 0)]


def data_keys(game, casts, keys):
    script = game[game.index("<script>\n    const $"):] if "<script>\n    const $" in game else game
    # champs texte des tables : HOUSES, ATOUTS, PERKS, BOSSES, CHAPTERS, RARITY, LEAGUES, DICE, BACKS
    for field in ("name", "power", "desc", "move", "hint", "planet"):
        for m in re.finditer(r"\b" + field + r":\s*" + STR_DQ, script):
            keep(keys, js_unescape(m.group(1)))
    # tribus (casts.js)
    for m in re.finditer(r"\blabel:\s*" + STR_DQ, casts):
        keep(keys, js_unescape(m.group(1)))
    # listes de noms
    for name in ("CHAR_NAMES", "TIER_NAMES"):
        for m in re.finditer(STR_DQ, block(script, r"const " + name + r"\s*=")):
            keep(keys, js_unescape(m.group(1)))
    for m in re.finditer(r"soldiers:\s*\[([^\]]*)\]", script):
        for s in re.finditer(STR_DQ, m.group(1)):
            keep(keys, js_unescape(s.group(1)))
    for m in re.finditer(r"\[" + STR_DQ + r",\s*\"\w+\",\s*\d+\]", block(script, r"const RIVALS\s*=")):
        keep(keys, js_unescape(m.group(1)))
    # titres des cartes : 3e élément de RANKS
    for m in re.finditer(r"\[\"[^\"]*\",\s*\d+,\s*" + STR_DQ + r"\]", block(script, r"const RANKS\s*=")):
        keep(keys, js_unescape(m.group(1)))
    # formations et bonus affichés sur les puces de total : parts.push(["Jumeaux", 5]) (traduits par partText)
    for line in script.splitlines():
        if "parts.push(" in line:
            for s in re.finditer(STR_DQ, line):
                if s.group(1)[:1].isupper() and len(s.group(1)) > 1:  # pas les codes de famille ("X")
                    keep(keys, js_unescape(s.group(1)))


def collect():
    game = GAME.read_text(encoding="utf-8")
    casts = CASTS.read_text(encoding="utf-8")
    keys, problems = set(), []
    tr_keys(game, keys, problems)
    html_keys(game, keys)
    data_keys(game, casts, keys)
    return sorted(keys), problems


# ---------- --check ----------
PLACEHOLDER = re.compile(r"\{(\w+)\}")
TAG = re.compile(r"</?\s*([a-zA-Z][a-zA-Z0-9]*)")


def tags(s):
    return sorted(m.group(0).replace(" ", "").lower() for m in TAG.finditer(s))


def load_lang(path):
    text = path.read_text(encoding="utf-8")
    start, end = text.index("{"), text.rindex("}")
    return json.loads(text[start:end + 1])


def check(keys):
    problems = 0
    source = set(keys)
    for code in LANGS:
        path = PUBLIC / "lang" / f"{code}.js"
        if not path.exists():
            print(f"[{code}] fichier absent : {path.relative_to(ROOT)}")
            problems += 1
            continue
        try:
            table = load_lang(path)
        except (ValueError, json.JSONDecodeError) as e:
            print(f"[{code}] illisible : {e}")
            problems += 1
            continue
        missing = sorted(source - table.keys())
        extra = sorted(table.keys() - source)
        bad = []
        for k in sorted(source & table.keys()):
            v = table[k]
            if not isinstance(v, str):
                bad.append((k, "traduction non textuelle"))
                continue
            if sorted(PLACEHOLDER.findall(k)) != sorted(PLACEHOLDER.findall(v)):
                bad.append((k, f"variables {sorted(set(PLACEHOLDER.findall(k)))} -> {sorted(set(PLACEHOLDER.findall(v)))}"))
            if tags(k) != tags(v):
                bad.append((k, f"balises {tags(k)} -> {tags(v)}"))
        for k in missing:
            print(f"[{code}] manquante : {k}")
        for k in extra:
            print(f"[{code}] en trop : {k}")
        for k, why in bad:
            print(f"[{code}] {why} : {k}")
        n = len(missing) + len(extra) + len(bad)
        print(f"[{code}] {len(table)} traductions, {len(missing)} manquantes, {len(extra)} en trop, {len(bad)} incohérentes")
        problems += n
    return problems


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    keys, problems = collect()
    for p in problems:
        print(p)
    if "--check" in sys.argv[1:]:
        n = check(keys) + len(problems)
        print("OK" if not n else f"{n} problème(s)")
        sys.exit(1 if n else 0)
    OUT.write_text(json.dumps(keys, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(keys)} clés -> {OUT.relative_to(ROOT)}")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
