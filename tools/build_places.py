#!/usr/bin/env python3
"""重建 public/places.json：Wikidata 上冰島的候選景點（地圖上的灰點）。

    pip install opencc-python-reimplemented   # 簡轉繁；沒裝就保留原字
    python3 tools/build_places.py

places.rq 的 VALUES 一次查完會逾時，這裡按類型分批查。輸出依維基語言版數排序，
越多語言版本的越先列（地圖縮小時只畫前面那些）。"""
import json, re, sys, time, urllib.parse, urllib.request, collections, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = (ROOT / 'tools' / 'places.rq').read_text()
OUT = ROOT / 'public' / 'places.json'
UA = 'iceland-trip-places/1.0 (https://github.com/man572142/iceland-trip)'

try:
    from opencc import OpenCC
    to_tw = OpenCC('s2twp').convert
except ImportError:
    print('沒有 opencc：中文名照 Wikidata 原字輸出', file=sys.stderr)
    to_tw = lambda s: s

head, rest = SRC.split('VALUES (?cls ?type ?min) {', 1)
body, tail = rest.split('\n  }\n', 1)
rows = re.findall(r'\(wd:(Q\d+) "(\w+)" (\d+)\)', body)


def sparql(q):
    data = urllib.parse.urlencode({'query': q}).encode()
    for i in range(8):
        req = urllib.request.Request('https://query.wikidata.org/sparql', data=data, headers={
            'User-Agent': UA, 'Accept': 'application/sparql-results+json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)['results']['bindings']
        except Exception as e:  # 429／504：等一下再試
            print('  retry', i + 1, e, file=sys.stderr)
            time.sleep(15 * (i + 1))
    raise SystemExit('Wikidata 查不到')


AREA = re.compile(r'(mountain\b(?! and)|lake\b|volcanic system|ice cap|main island|seamount|lava field)', re.I)

got = []
for t in dict.fromkeys(t for _, t, _ in rows):
    vals = ' '.join(f'(wd:{q} "{tt}" {m})' for q, tt, m in rows if tt == t)
    print('query', t, file=sys.stderr)
    got += sparql(head + 'VALUES (?cls ?type ?min) { ' + vals + ' }\n' + tail)
    time.sleep(3)

v = lambda b, k: b.get(k, {}).get('value')
seen, places = set(), []
for b in sorted(got, key=lambda b: -int(v(b, 'sl'))):
    qid = v(b, 'item').rsplit('/', 1)[-1]
    if qid in seen:
        continue
    lng, lat = map(float, re.findall(r'-?[\d.]+', v(b, 'coord'))[:2])
    if not (62.5 < lat < 67.5 and -25 < lng < -13):   # 本島與近海，排除海外座標錯誤
        continue
    name = v(b, 'en') or v(b, 'is')
    if not name or re.fullmatch(r'Q\d+', name):
        continue
    if AREA.match(v(b, 'desc') or ''):   # 山名、湖名、地區名不是可以去的景點
        continue
    seen.add(qid)
    p = {'id': qid, 'name': name, 'lat': round(lat, 5), 'lng': round(lng, 5),
         'type': v(b, 'type'), 'sl': int(v(b, 'sl'))}
    zh = v(b, 'zhTw') or v(b, 'zhHant') or v(b, 'zh')
    if zh and zh != name:
        p['zh'] = to_tw(zh)
    if v(b, 'enwiki'):
        p['wiki'] = v(b, 'enwiki')
    if v(b, 'desc'):
        p['desc'] = v(b, 'desc')
    places.append(p)

OUT.write_text(json.dumps(places, ensure_ascii=False, separators=(',', ':')) + '\n')
print(len(places), 'places', dict(collections.Counter(p['type'] for p in places)), file=sys.stderr)
