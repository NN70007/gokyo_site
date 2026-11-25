#!/usr/bin/env python3
"""Copie initiale du site Crosswind METAR (niderlabs_site/aviator) vers watch/crosswind.
Utilisé une fois pour la migration vers watch.gokyo.lu ; ensuite, watch/ est la source."""
import os, re, shutil, sys
SRC = sys.argv[1]            # .../niderlabs_site
DST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'watch')
C = os.path.join(DST, 'crosswind')
if os.path.isdir(C): shutil.rmtree(C)
shutil.copytree(os.path.join(SRC, 'aviator'), C, ignore=shutil.ignore_patterns('pro'))
TEXTE = ('.html', '.css', '.js', '.webmanifest')
n = 0
for d, _, fs in os.walk(C):
    for f in fs:
        p = os.path.join(d, f)
        if not f.endswith(TEXTE) or f in ('airports.json',): continue
        if os.sep + 'tz' + os.sep in p: continue
        s = open(p, encoding='utf-8').read(); o = s
        s = s.replace('https://niderlabs.com/aviator/', 'https://watch.gokyo.lu/crosswind/')
        s = s.replace('niderlabs.com/aviator', 'watch.gokyo.lu/crosswind')
        s = s.replace('/aviator/', '/crosswind/')
        s = s.replace('Publisher of Crosswind METAR and niderlabs.com.', 'Publisher of Crosswind METAR.')
        s = s.replace('contact@niderlabs.com', 'contact@gokyo.lu')
        if f.endswith('.html') and '<meta name="robots"' not in s:
            s = s.replace('<meta name="viewport"', '<meta name="robots" content="noindex">\n<meta name="viewport"', 1)
        if s != o: open(p, 'w', encoding='utf-8').write(s); n += 1
v = open(os.path.join(SRC, 'visite.js'), encoding='utf-8').read()
v = v.replace('Compteur de visites anonyme de niderlabs.com.', 'Compteur de visites anonyme de watch.gokyo.lu.').replace('location.hostname !== "niderlabs.com"', 'location.hostname !== "watch.gokyo.lu"')
open(os.path.join(DST, 'visite.js'), 'w', encoding='utf-8').write(v)
print('fichiers adaptés :', n)
