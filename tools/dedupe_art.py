#!/usr/bin/env python3
"""
Find and remove duplicate artwork in art/ and gallery.html.

Catches the same image even if it was re-saved, resized or converted
(JPG/PNG/WebP), using a perceptual fingerprint, plus exact byte matches.

For each set of duplicates it keeps ONE copy:
  1. the copy gallery.html lists first, otherwise
  2. the copy that has been in the repository longest,
and removes the rest: the extra image files, and any gallery.html entries
that point at a removed file or repeat the same file.

Usage:  python tools/dedupe_art.py            (makes the changes)
        python tools/dedupe_art.py --check    (only reports)
        python tools/dedupe_art.py --check NEW_IMAGE   (is NEW_IMAGE already in art/?)
"""
import hashlib, re, subprocess, sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'art'
GALLERY = ROOT / 'gallery.html'
EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif'}
MAX_BITS = 10        # out of 256: how different two fingerprints may be and still count as the same image

def fingerprint(path):
    im = ImageOps.exif_transpose(Image.open(path)).convert('L')
    w, h = im.size
    small = im.resize((17, 16), Image.LANCZOS)
    px = list(small.tobytes())
    bits = 0
    for y in range(16):
        for x in range(16):
            bits = (bits << 1) | (px[y*17 + x] > px[y*17 + x + 1])
    return bits, w / h

def same_image(a, b):
    (ha, ra), (hb, rb) = a, b
    return abs(ra - rb) / max(ra, rb) < 0.03 and bin(ha ^ hb).count('1') <= MAX_BITS

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def first_commit_time(path):
    try:
        out = subprocess.run(['git', 'log', '--diff-filter=A', '--format=%ct', '--', str(path.relative_to(ROOT))],
                             cwd=ROOT, capture_output=True, text=True).stdout.split()
        return int(out[-1]) if out else 10**12
    except Exception:
        return 10**12

def gallery_entries(text):
    """(start, end, src) for each artwork block in the AI_ART / TRADITIONAL_ART lists."""
    start = text.find('const AI_ART = [')
    stop = text.find('const HALLS', start)
    if start < 0 or stop < 0:
        return []
    out = []
    for m in re.finditer(r"\{[^{}]*?\bsrc\s*:\s*['\"]([^'\"]+)['\"][^{}]*?\}\s*,?[ \t]*\n?", text[start:stop]):
        out.append((start + m.start(), start + m.end(), m.group(1)))
    return out

def images():
    return sorted(p for p in ART.rglob('*') if p.is_file() and p.suffix.lower() in EXTS)

def groups(files):
    prints = {}
    for p in files:
        try: prints[p] = (fingerprint(p), sha(p))
        except Exception as e: print(f'  (skipped {p.relative_to(ROOT)}: {e})')
    seen, result = set(), []
    keys = list(prints)
    for i, a in enumerate(keys):
        if a in seen: continue
        grp = [a]
        for b in keys[i+1:]:
            if b in seen: continue
            if prints[a][1] == prints[b][1] or same_image(prints[a][0], prints[b][0]):
                grp.append(b); seen.add(b)
        if len(grp) > 1: result.append(grp)
    return result

def main():
    check = '--check' in sys.argv
    extra = [a for a in sys.argv[1:] if not a.startswith('--')]
    files = images()

    if extra:   # is a new image already in the collection?
        new = Path(extra[0]).resolve()
        nf, ns = fingerprint(new), sha(new)
        hits = [p for p in files if sha(p) == ns or same_image(nf, fingerprint(p))]
        for p in hits: print(f'DUPLICATE of {p.relative_to(ROOT)}')
        if not hits: print('No duplicate found.')
        return

    text = GALLERY.read_text(encoding='utf-8')
    entries = gallery_entries(text)
    order = {}
    for i, (_, _, src) in enumerate(entries):
        order.setdefault(src, i)

    remove_files, notes = [], []
    for grp in groups(files):
        rel = {p: str(p.relative_to(ROOT)).replace('\\', '/') for p in grp}
        keep = min(grp, key=lambda p: (order.get(rel[p], 10**9), first_commit_time(p), rel[p]))
        for p in grp:
            if p != keep:
                remove_files.append(rel[p])
                notes.append(f'{rel[p]} is a duplicate of {rel[keep]}')

    # gallery.html entries to drop: repeats of the same src, or pointing at a removed file
    drop, seen = [], set()
    for s, e, src in entries:
        if src in seen or src in remove_files:
            drop.append((s, e)); notes.append(f'removed gallery entry for {src}' + (' (listed twice)' if src in seen else ''))
        seen.add(src)

    if not notes:
        print('No duplicates found.'); return
    print('\n'.join(notes))
    if check: return
    for s, e in sorted(drop, reverse=True):
        text = text[:s] + text[e:]
    if drop: GALLERY.write_text(text, encoding='utf-8')
    for r in remove_files:
        (ROOT / r).unlink()
    print(f'Removed {len(remove_files)} duplicate file(s) and {len(drop)} gallery entr{"y" if len(drop)==1 else "ies"}.')

if __name__ == '__main__':
    main()
