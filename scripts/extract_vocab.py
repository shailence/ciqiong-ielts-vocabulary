import json, re
from pathlib import Path
import pdfplumber

ROOT = Path('/Users/apple/ielts-vocab')
SRC = Path('/Users/apple/Desktop/雅思')
TEXT_FILES = [
    (SRC/'list1~10 new.pdf', 1),
    (SRC/'list 38-47.pdf', 38),
    (SRC/'list48~56.pdf', 48),
    (SRC/'list57-64.pdf', 57),
]

POS = re.compile(r'(?i)^(?:n|v|adj|adv|prep|conj|pron|num|art|aux|modal)(?:[./,&-]*(?:n|v|adj|adv))*\.?$')
POS_INLINE = re.compile(r'(?i)\s+(?:n|v|adj|adv|prep|conj|pron|num)(?:[./,&-]*(?:n|v|adj|adv))*\.?\s*')

def clean_word(raw):
    raw = re.sub(r'^\s*[0-9ilIsS]{1,2}\s*', '', raw).strip(' .,:;·|')
    raw = re.sub(r'[*£□]+', '', raw).strip()
    parts = raw.split()
    kept = []
    for p in parts:
        if POS.match(p): break
        m = re.match(r'^(.*?)(?:n|v|adj|adv)\.$', p, re.I)
        if m and m.group(1):
            kept.append(m.group(1)); break
        if re.search(r'[\u4e00-\u9fff]', p): break
        kept.append(p)
    word = ' '.join(kept).strip(' .,:;·|')
    word = re.sub(r'^[^A-Za-z]+|[^A-Za-z)]+$', '', word)
    return word

def split_head(raw):
    m = POS_INLINE.search(raw)
    if not m: return clean_word(raw), ''
    return clean_word(raw[:m.start()]), raw[m.end():].strip()

def text_page(page, list_no):
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    W, H = page.width, page.height
    head_headers=sorted([w for w in words if w['text']=='单词' and w['top']<80],key=lambda w:w['x0'])
    def_headers=sorted([w for w in words if w['text']=='释义' and w['top']<80],key=lambda w:w['x0'])
    output=[]
    for c in range(3):
        expected_start=1+c*20
        nums=[]
        for w in words:
            t=w['text'].strip()
            if t.isdigit() and expected_start <= int(t) <= expected_start+19 and w['top']>70:
                nums.append(w)
        bins={}
        for w in nums: bins.setdefault(round(w['x0']/12)*12,[]).append(w)
        if not bins: continue
        cluster=max(bins.values(),key=len)
        ax=sum(w['x0'] for w in cluster)/len(cluster)
        anchors=[]
        for w in nums:
            if abs(w['x0']-ax)<16:
                anchors.append((int(w['text']), (w['top']+w['bottom'])/2))
        amap={n:y for n,y in anchors}
        if len(amap)<15:
            continue
        hs=(ax+7)/W
        ds=((def_headers[c]['x0']-10) if c<len(def_headers) else ax+.15*W)/W
        if c<2:
            future=[w['x0'] for w in words if w['text'].isdigit() and 1+(c+1)*20 <= int(w['text']) <= 20+(c+1)*20 and w['top']>70]
            ce=(min(future)-5)/W if future else (ax+.32*W)/W
        else: ce=.99
        centers=[amap.get(n) for n in range(expected_start,expected_start+20)]
        known=[(i,y) for i,y in enumerate(centers) if y is not None]
        if len(known)>=2:
            step=(known[-1][1]-known[0][1])/(known[-1][0]-known[0][0])
            base=known[0][1]-known[0][0]*step
            centers=[y if y is not None else base+i*step for i,y in enumerate(centers)]
        for i,y in enumerate(centers):
            prev=(centers[i-1]+y)/2 if i else y-(centers[1]-y)/2
            nxt=(y+centers[i+1])/2 if i<19 else y+(y-centers[i-1])/2
            hw=[w for w in words if hs*W <= w['x0'] < ds*W and prev <= (w['top']+w['bottom'])/2 < nxt]
            dw=[w for w in words if ds*W <= w['x0'] < ce*W and prev <= (w['top']+w['bottom'])/2 < nxt]
            hw.sort(key=lambda z:(z['top'],z['x0'])); dw.sort(key=lambda z:(z['top'],z['x0']))
            raw=' '.join(w['text'] for w in hw)
            word=clean_word(raw)
            definition=' '.join(w['text'] for w in dw).strip()
            if word:
                output.append({'id':f'l{list_no}-{expected_start+i}','order':expected_start+i,'word':word,'definition':definition})
    return output

def ocr_page(json_path, list_no):
    obs=json.loads(json_path.read_text())
    bins={}
    for o in obs:
        if re.match(r'^\s*[0-9ilIsS]{1,2}\s+[A-Za-z]',o['text']) and .035<o['y']<.86:
            k=round(o['x']/.02)*.02; bins[k]=bins.get(k,0)+1
    ranked=sorted(bins,key=lambda k:bins[k],reverse=True)
    heads=[]
    for x in ranked:
        if all(abs(x-y)>.1 for y in heads): heads.append(x)
        if len(heads)==3: break
    heads=sorted(heads)
    if not heads: heads=[.13,.37,.61]
    output=[]
    for c,hs in enumerate(heads):
        ds=hs+.09
        ce=(heads[c+1]-.015) if c+1<len(heads) else .97
        candidates=[]
        for o in obs:
            t=o['text']
            if abs(o['x']-hs)<.035 and .045 < o['y'] < .86 and re.search(r'[A-Za-z]{2}',t):
                word,_=split_head(t)
                if word and len(word)>1: candidates.append(o)
        ys=[]
        for o in sorted(candidates,key=lambda z:-z['y']):
            if not ys or abs(o['y']-ys[-1])>.016: ys.append(o['y'])
        centers=ys[:20]
        if len(centers)>1: step=(centers[0]-centers[-1])/(len(centers)-1)
        else: step=.038
        for i,y in enumerate(centers):
            near=[o for o in candidates if abs(o['y']-y)<max(.022,step*.48)]
            near.sort(key=lambda o:(abs(o['y']-y),o['x']))
            if not near: continue
            raw=near[0]['text']
            word,inline_def=split_head(raw)
            if not word: continue
            half=step*.48
            defs=[o for o in obs if ds-.01 <= o['x'] < ce and abs(o['y']-y)<half]
            defs.sort(key=lambda o:(-o['y'],o['x']))
            definition=' '.join(([inline_def] if inline_def else [])+[o['text'] for o in defs]).strip()
            order=1+c*20+i
            output.append({'id':f'l{list_no}-{order}','order':order,'word':word,'definition':definition})
    return output

lists={}
for pdf,start in TEXT_FILES:
    with pdfplumber.open(pdf) as doc:
        for ix,page in enumerate(doc.pages):
            n=start+ix
            if n>64: break
            txt=page.extract_text() or ''
            if len(txt)>400:
                lists[n]=text_page(page,n)

scan_dir=ROOT/'tmp/pdfs/scans300'
for p in sorted(scan_dir.glob('*.json')):
    m=re.match(r'list(\d+)-(\d+)-(\d+)\.json',p.name)
    if not m: continue
    start=int(m.group(1)); page=int(m.group(3)); n=start+page-1
    lists[n]=ocr_page(p,n)

payload=[]
for n in range(1,65):
    entries=sorted(lists.get(n,[]),key=lambda x:x['order'])
    seen=set(); entries=[e for e in entries if not (e['order'] in seen or seen.add(e['order']))]
    payload.append({'number':n,'title':f'List {n}','words':entries})

(ROOT/'public').mkdir(exist_ok=True)
(ROOT/'public/vocab.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
print('lists',len(payload),'words',sum(len(x['words']) for x in payload))
print('counts',' '.join(f"{x['number']}:{len(x['words'])}" for x in payload))
