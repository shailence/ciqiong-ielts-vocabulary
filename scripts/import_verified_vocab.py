import csv, json
from pathlib import Path

root=Path('/Users/apple/ielts-vocab')
rows=list(csv.DictReader(open(root/'tmp/word_list_reference.csv',encoding='utf-8-sig')))

# 1-based starts verified against the first headword on each supplied List page.
starts=[1,61,120,180,243,302,363,423,483,540,602,665,731,788,850,908,
972,1016,1074,1130,1190,1250,1304,1368,1433,1485,1540,1602,1658,1717,
1785,1857,1890,1937,1991,2043,2100,2155,2199,2248,2299,2352,2405,2473,
2532,2592,2651,2723,2783,2852,2925,2987,3046,3105,3166,3226,
3192,3253,3313,3377,3437,3497,3558,3617]

payload=[]
for i,start in enumerate(starts):
    if i==55: end=3253              # supplied List 56 starts at neck
    elif i==56: end=3253            # supplied List 57 restarts Chapter 21 at feel
    elif i+1<len(starts): end=starts[i+1]
    else: end=len(rows)+1
    segment=rows[start-1:end-1]
    words=[]
    for order,r in enumerate(segment,1):
        words.append({
            'id':f'l{i+1}-{order}', 'order':order,
            'word':r['word'].strip(), 'definition':r['meaning'].strip(),
            'phonetic':r.get('phonetic','').strip()
        })
    chapter=segment[0]['title'].strip() if segment else ''
    payload.append({'number':i+1,'title':f'List {i+1}','chapter':chapter,'words':words})

(root/'public/vocab.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
all_words=[w['word'].casefold() for l in payload for w in l['words']]
print('entries',len(all_words),'unique',len(set(all_words)),'lists',len(payload))
print('counts',' '.join(f"{l['number']}:{len(l['words'])}" for l in payload))
