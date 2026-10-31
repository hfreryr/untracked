# Vérification du classement des trajets en transports sur 24 trajets d'une station à une autre (souvent sur une même ligne) :
# compte les cas où la 1re proposition impose une correspondance alors qu'un trajet plus simple est proposé.
# Mêmes règles que app/src/lib/transitrank.js. Usage (après build_places.py) : python app/scripts/verif_correspondances.py
import json, glob, os, sys, urllib.request, urllib.parse, time
sys.path.insert(0, os.path.dirname(__file__))
import tileio
st={}
for it in tileio.iter_items('app/static/data/places'):
        t=it[3]
        if t.get('railway')=='station' and t.get('subway')=='yes' or (t.get('railway')=='station' and t.get('station')=='subway'):
            st.setdefault(t.get('name'),(it[2],it[1]))
PAIRS=[('Ségur','Odéon'),('Bastille','Concorde'),('Nation','Charles de Gaulle - Étoile'),('Porte d\'Orléans','Gare du Nord'),('Odéon','Strasbourg - Saint-Denis'),
('Place d\'Italie','Pasteur'),('Opéra','Pyramides'),('République','Saint-Lazare'),('Gare de Lyon','Madeleine'),('Jussieu','Pont Marie'),
('Duroc','Sèvres-Babylone'),('La Motte-Picquet - Grenelle','Michel-Ange - Auteuil'),('Javel - André Citroën','Mabillon'),('Montparnasse - Bienvenüe','Saint-Placide'),
('Belleville','Couronnes'),('Porte de Clichy','Varenne'),('Châtelet','Hôtel de Ville'),('Abbesses','Concorde'),('Pigalle','Barbès - Rochechouart'),('Château Rouge','Saint-Michel'),
('Bercy','Pyramides'),('Trocadéro','Raspail'),('Denfert-Rochereau','Place d\'Italie'),('Vavin','Edgar Quinet')]
H={'User-Agent':'UntrackedMaps-test/0.1 (+https://untrackedmaps.app)'}
bad=0; n=0
for a,b in PAIRS:
    if a not in st or b not in st: print('station inconnue',a if a not in st else b); continue
    q=urllib.parse.urlencode({'fromPlace':'%f,%f'%st[a],'toPlace':'%f,%f'%st[b],'time':time.strftime('%Y-%m-%dT%H:%M:00Z', time.gmtime()),'numItineraries':10})
    try: d=json.load(urllib.request.urlopen(urllib.request.Request('https://api.transitous.org/api/v5/plan?'+q,headers=H),timeout=40))
    except Exception as e: print(a,b,'erreur',e); continue
    groups={}
    for it in d.get('itineraries',[]):
        legs=[l for l in it['legs'] if l['mode']!='WALK']
        if not legs: continue
        key='>'.join(f"{l['mode']}:{l.get('routeShortName','')}" for l in legs)
        groups.setdefault(key,(it['endTime'],len(legs),key))
    if not groups: continue
    n+=1
    from datetime import datetime, timedelta
    def sc(g):
        lines=g[2].split('>'); e=datetime.fromisoformat(g[0].replace('Z','+00:00'))
        return (len(set(lines))<len(lines), e+timedelta(minutes=5*(len(lines)-1)), e)
    ranked=sorted(groups.values(), key=sc)
    top=ranked[0]; fewest=min(g[1] for g in ranked)
    flag = top[1]>fewest
    bad+=flag
    print(('⚠️ ' if flag else '   ')+f"{a} → {b} : 1er = {top[2]} ({top[0][11:16]}) ; options = "+' | '.join(f"{g[2]} {g[0][11:16]}" for g in ranked[:4]))
    time.sleep(1)
print(f'{bad} cas sur {n} où la 1re proposition a plus de correspondances qu\'une autre proposée')
