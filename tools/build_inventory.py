import json, re, os
T="/root/Seait/tools"
inv=json.load(open(f"{T}/api_inventory_raw.json"))
cap=json.load(open(f"{T}/captured_actions.json"))
prof=json.load(open(f"{T}/user_profile_1278472.json"))
cfg=json.load(open(f"{T}/evn_config.json"))

# ---- categorize every action ----
MODMAP = {
 'user':'User','backPhoto':'User','report':'Moderation','SuperManage':'Moderation',
 'mall':'Store','gift':'Gift','RocketGift':'Gift','LiveRocketGift':'Gift','ChargeGiftBag':'Gift',
 'room':'Room','RoomApi':'Room','LiveRoom':'Room','RoomAct':'Room','RoomBomb':'Room','RoomLevel':'Room',
 'LiveRoomBomb':'Room','LiveRoomLevel':'Room','LiveSearch':'Room','RadioRoomPk':'Room',
 'LivePk':'PK','Noble':'Noble','medal':'Medal','couple':'CP',
 'moment':'Feed','feedTopic':'Feed','bottle':'Feed','comment':'Feed',
 'activity':'Activity','task':'Task','Game':'Game','MiniGame':'Game','GameMall':'Game','JoyPlay':'Game',
 'LuckyDraw':'Game','LuckyNumber':'Game','LiveLuckyBags':'Game',
 'notice':'Messages','IMSvc':'IM','UsersRoamMsg':'IM','Anchor':'Guild','BDCenter':'Guild',
 'HiddenSettings':'Settings','app':'Config','preArea':'Config','config':'Config','countryZone':'Config',
 'login':'Auth','feedback':'Feedback','search':'Search','preLogin':'Auth',
}
def cat(action):
    a=action.split('/')[-1]  # strip Action/
    mod=a.split('.')[0]
    return MODMAP.get(mod, mod)

catalog={}
def add(action, endpoint, method, encrypted, src, req=None, resp=None):
    catalog[action]={"action":action,"category":cat(action),"endpoint":endpoint,"method":method,
                     "encrypted":encrypted,"request_fields":req or [],"response_fields":resp or [],"source":src}

ENV=["action","token","uid","_login_uid","lang","ua","deviceid","sign","timestamp"]
# business + sub-namespaced -> api.php encrypted POST
for a in inv["business_actions"]:
    if a in cap:
        c=cap[a]; add(a,(c["endpoint"] or ["/api.php"])[0],(c["method"] or ["POST"])[0],c["encrypted"],"captured",c["req_fields"] or ENV, c["resp_fields"])
    else:
        add(a,"/api.php","POST",True,"decoded",ENV,[])
for a in inv["sub_namespaced"]:
    if a=="MM.dd": continue
    add(a,"/api.php","POST",True,"decoded",ENV,[])
# php endpoints (mostly plaintext)
for p in inv["php_endpoints"]:
    ep=p.split('?')[0]
    add(ep.strip('/').replace('/','_') if 'api.php' not in ep and 'index.php' not in ep else ep, ep,"POST",False,"decoded",["mobile","password","deviceid","token"],[])

# ---- write full catalog ----
os.makedirs("/root/Seait/backend/src",exist_ok=True)
json.dump({"_cipher":{"key":"md5(package_name)=840c48cfef8d10fa6dd80419f8e16dc8","scheme":"http_body=base64(XOR(json,key))"},
          "_envelope":{"request":ENV,"response":["response_status.error","response_data"]},
          "_total":len(catalog),"actions":catalog},
          open("/root/Seait/backend/src/actions.catalog.json","w"),indent=1,ensure_ascii=False)

# ---- API_INVENTORY.md ----
from collections import Counter,defaultdict
bycat=defaultdict(list)
for a,m in catalog.items(): bycat[m["category"]].append(a)
lines=["# API INVENTORY — Seait ≈ com.waig.nalo (ZaffaLive)","",
 f"**Total endpoints: {len(catalog)}** — {len(inv['business_actions'])} business + {len([a for a in inv['sub_namespaced'] if a!='MM.dd'])} sub-namespaced (Action/*) + {len(inv['php_endpoints'])} php.  Plus {len(inv['h5_pages'])} H5 pages.","",
 "**Wire protocol:** `POST /api.php` form `app_id=com.waig.nalo&http_body=base64(XOR(json,md5(pkg)))`. Envelope: request `{action,token,uid,_login_uid,lang,ua,deviceid,sign,timestamp,...}` → response `{response_status:{error},response_data}`. `QxZ…` = encrypted.","",
 "## Systems (category → count)"]
for c,n in sorted(Counter(m["category"] for m in catalog.values()).items(),key=lambda x:-x[1]):
    lines.append(f"- **{c}**: {n}")
lines.append("\n## Full action list by system")
for c in sorted(bycat):
    lines.append(f"\n### {c} ({len(bycat[c])})")
    for a in sorted(bycat[c]):
        m=catalog[a]; sc="✅" if m["source"]=="captured" else "·"
        lines.append(f"- {sc} `{a}` [{m['method']} {m['endpoint']}]" + (f" req={m['request_fields'][:6]}" if m['source']=='captured' else ""))
lines.append("\n## H5 pages ("+str(len(inv['h5_pages']))+")\n"+", ".join(f"`{h}`" for h in inv['h5_pages']))
open("/root/Seait/docs/API_INVENTORY.md","w").write("\n".join(lines))

print("catalog actions:",len(catalog))
print("categories:",dict(Counter(m['category'] for m in catalog.values())))
