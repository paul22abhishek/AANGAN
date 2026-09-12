#!/usr/bin/env python3
"""Stamp assets/css/app.css and assets/js/*.js links with a version query so a
browser can't serve a stale copy after an edit. Run after changing CSS or JS."""
import pathlib, re, time

stamp = str(int(time.time()))
pat = re.compile(r'(assets/(?:css|js)/[A-Za-z0-9_.-]+\.(?:css|js))(\?v=\d+)?')
for f in sorted(pathlib.Path('.').glob('*.html')):
    src = f.read_text()
    out = pat.sub(lambda m: f"{m.group(1)}?v={stamp}", src)
    if out != src:
        f.write_text(out)
        print(f"{f.name}: stamped v={stamp}")
