#!/usr/bin/env python3
"""
Keep each gallery's rotating collection in step with its image folder.

  art/ai/collection.json            (AI Art Gallery)
  art/traditional/collection.json   (Traditional Art Gallery)

- Any image in art/ai or art/traditional that isn't listed in gallery.html
  or in the collection is added to the collection, titled from its file name
  (harbour-at-dusk.jpg -> "Harbour at Dusk"). Edit the title later if you like.
- Collection entries whose image file no longer exists are removed, and so
  are entries repeated in gallery.html or listed twice.

Usage:  python tools/sync_collection.py           (makes the changes)
        python tools/sync_collection.py --check   (only reports)
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GALLERY = ROOT / 'gallery.html'
EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}
HALLS = {'ai': 'AI-generated image', 'traditional': None}
SMALL = {'a','an','and','at','by','for','in','of','on','or','the','to','with'}

def title_from(name):
    words = re.sub(r'[_\-]+', ' ', Path(name).stem).split()
    if not words or any(len(w) > 14 or sum(c.isdigit() for c in w) > 4
                         or (len(w) >= 5 and sum(c.isdigit() for c in w) >= 2 and any(c.isalpha() for c in w)) for w in words):
        return 'Untitled'
    return ' '.join(w if w.isupper() and len(w) > 1 else (w.lower() if i and w.lower() in SMALL else w.capitalize())
                    for i, w in enumerate(words))

def load(path):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        return data if isinstance(data, list) else []
    except FileNotFoundError:
        return []
    except Exception as e:
        print(f'  {path.relative_to(ROOT)} could not be read ({e}); leaving it alone.')
        return None

def save(path, items):
    path.write_text('[\n' + ',\n'.join('  ' + json.dumps(e, ensure_ascii=False) for e in items) + ('\n' if items else '') + ']\n', encoding='utf-8')

def main():
    check = '--check' in sys.argv
    listed = set(re.findall(r"\bsrc\s*:\s*['\"]([^'\"]+)['\"]", GALLERY.read_text(encoding='utf-8')))
    changed = False
    for hall, medium in HALLS.items():
        folder = ROOT / 'art' / hall
        if not folder.is_dir(): continue
        path = folder / 'collection.json'
        items = load(path)
        if items is None: continue
        notes, keep, seen = [], [], set(listed)
        for e in items:
            src = e.get('src') if isinstance(e, dict) else None
            if not src:
                notes.append('removed an entry with no src'); continue
            local = not re.match(r'https?://', src)
            if local and not (ROOT / src).is_file():
                notes.append(f'removed {src} (file not found)'); continue
            if src in seen:
                notes.append(f'removed {src} (already listed)'); continue
            seen.add(src); keep.append(e)
        for p in sorted(folder.iterdir()):
            if not p.is_file() or p.suffix.lower() not in EXTS: continue
            src = f'art/{hall}/{p.name}'
            if src in seen: continue
            e = {'src': src, 'title': title_from(p.name)}
            if medium: e['medium'] = medium
            keep.append(e); seen.add(src); notes.append(f'added {src} as "{e["title"]}"')
        if notes:
            print(f'{path.relative_to(ROOT)}:'); print('\n'.join('  ' + n for n in notes))
            if not check: save(path, keep); changed = True
    if not changed and not check: print('Collections are up to date.')

if __name__ == '__main__':
    main()
