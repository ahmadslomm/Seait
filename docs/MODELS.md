# DATA MODELS — Seait ≈ com.waig.nalo

Sources: decrypted `user.getUserinfo` (real account 1278472), `preArea.getServer` (ConfigModel), captured schemas, decoded field constants.

## UserModel  (from real user.getUserinfo — EXACT fields)
- `uid` : string  = "1278472"
- `mobile` : string  = "+43-069981944958"
- `sex` : string  = "1"
- `nick` : string  = "Ø§ÙÙÙÙÙØ§ÙÙ"
- `sign` : string  = "Ø§ÙÙØ¬ÙØ³ Ø§ÙÙÙ ÙØ§ ÙÙØ§Ø³Ø¨Ù.\nØ¹Ø¬Ù Ø¨ÙÙØ¬Ø§
- `avatar` : string  = "https://ufile.zaffalive.com/uc/img/head_1278472_1784162609.
- `birthday` : string  = "1998-01-01"
- `zone` : string  = ""
- `country` : string  = "886"
- `regkind` : string  = "1"
- `regtype` : string  = "4"
- `regtime` : string  = "1783241762"
- `identity` : string  = ""
- `credit` : string  = "0"
- `body` : string  = ""
- `height` : string  = "0"
- `edu` : string  = ""
- `school` : string  = ""
- `career` : string  = ""
- `emotion` : string  = ""
- `avatar_blur` : string  = ""
- `area` : string  = "0"
- `symbol` : string  = "0"
- `tag` : string  = ""
- `audit_avatar` : int  = 1
- `real_flag` : string  = "0"
- `reg_country` : string  = "BE"
- `region` : string  = "ar"
- `lang` : string  = "ar"
- `uinfo_extra` : object → see below
- `friend` : string  = "0"
- `cp_info` : object → see below
- `perfect` : string  = "0"
- `avatar_medium` : string  = "https://ufile.zaffalive.com/uc/img/head_1278472_1784162609.
- `avatar_small` : string  = "https://ufile.zaffalive.com/uc/img/head_1278472_1784162609.
- `isBanned` : int  = 0
- `age` : string  = "28"
- `subs` : string  = "5"
- `fans` : string  = "6"
- `gifts` : string  = "220651"
- `beans` : string  = "0"
- `photos` : string  = "0"
- `charm` : string  = "361519"
- `cost` : string  = "0"
- `days` : string  = "18"
- `wealthExp` : int  = 708075
- `wealthLv` : int  = 16
- `wealthLimit` : int  = 600000
- `nextWealthLvExp` : int  = 41925
- `nextExp` : int  = 750000
- `charmLv` : int  = 2
- `nationalFlag` : string  = "https://ufile.zaffalive.com/uc/img/cc_BE.png"
- `songs` : string  = "0"
- `medal` : list  = ["https://ufile.zaffalive.com/uc/img/url_lv1_1779861990.png"
- `medalRes` : list  = ["https://ufile.zaffalive.com/uc/img/resource_lv1_1779861990
- `singerScore` : string  = "0"
- `level` : string  = "0"
- `levelName` : string  = "Potential Rookie V"
- `singerRank` : int  = 0
- `avatarFrame` : string  = "https://ufile.zaffalive.com/uc/zip/goods_b06589db8ba1bb312f
- `carFrame` : string  = ""
- `chatBubble` : string  = "https://ufile.zaffalive.com/uc/zip/goods_288cfbe5e39393e551
- `infoBgImg` : string  = "https://ufile.zaffalive.com/uc/zip/goods_bd794c83b7cedba063
- `avatarFrameJson` : string  = ""
- `carFrameJson` : string  = ""
- `rid` : string  = "0"
- `roomType` : string  = ""
- `actTitles` : list  = []
- `user_label` : list  = []
- `reject` : string  = "0"
- `online` : list  = [0, 0]
- `usong_has_update` : bool  = false
- `constellation` : string  = "Capricorn"
- `whitelist` : int  = 0
- `isPresident` : bool  = false
- `isAnchor` : bool  = true
- `hasApplyGuild` : bool  = false
- `noble_level` : int  = 5
- `view_me` : object → see below
- `visitors` : object → see below
- `hidden_settings` : object → see below
- `guild_info` : object → see below
- `supporters` : object → see below
- `supporters_num` : int  = 23
- `active_level` : int  = 7
- `gameLv` : int  = 7
- `svip` : int  = 0
- `auth_list` : list  = []

### nested: cp_info (CP card)
- `apply_gid_info` : object
- `self_uinfo` : object
- `sweet_value` : string
- `days` : int
- `hasCp` : int
- `target_uinfo` : object
- `cp_lv` : int
- `is_ask_cp` : int

### nested: guild_info (Guild card)
- `avatar` : string
- `name` : string
- `id` : string
- `guild_id` : string
- `anchorNum` : string

### nested: view_me / visitors
- `new_view_num` : string
- `total_view_num` : string

## ConfigModel (preArea.getServer — SDK + server map)
- `mgrConnType` : int = 0
- `action_pwd` : string = "aloparty975qhe"
- `privateProtocolUrl` : string = "https://www.zaffalive.com"
- `rulesUrl` : string = "https://api.zaffalive.com"
- `shareUrl` : string = "https://zaffalive.com"
- `payUrl` : string = "https://pay.zaffalive.com"
- `pushUrl` : string = "https://push.zaffalive.com"
- `reportFileUrl` : string = "https://rfile.zaffalive.com"
- `reportUrl` : string = "https://r.zaffalive.com"
- `domainName` : string = "zaffalive.com"
- `domainNameV2` : list
- `googleFcmPushID` : int = 7298
- `imAppId` : int = 1721002742
- `qttKey` : string = "64d30a8587067e3150d6b5554d5fb47d"
- `agoraAppId` : string = "ae32cc1b085e4b27b08d3d664103b3c8"
- `name` : string = "ä¸­ä¸"
- `reportAppName` : string = "zaffalive"
- `chatCoins` : int = 0
- `RadioRoomMgrIp` : string = ""
- `RadioRoomMgrPort` : int = 699
- `AudioIp` : string = ""
- `AudioPort` : int = 399
- `bigoAppId` : string = "f52cb0325088a89aoi4xtpi46855n4i2"
- `TalkServiceIP` : string = ""
- `TalkServicePort` : int = 33100

## Captured response schemas
- **preArea.getServer** → resp: ['AudioIp', 'AudioPort', 'RadioRoomMgrIp', 'RadioRoomMgrPort', 'TalkServiceIP', 'TalkServicePort', 'action_pwd', 'activityUrl', 'agoraAppId', 'bigoAppId', 'domainName', 'domainNameV2', 'googleFcmPushID', 'imAppId', 'name', 'payUrl', 'privateProtocolUrl', 'pushUrl', 'qttKey', 'reportAppName', 'reportFileUrl', 'reportUrl', 'rulesUrl', 'shareUrl', 'umKey']
- **app.getConfigV2** → resp: ['value']
- **report.getReportConfig** → resp: ['http_reportAction', 'http_reportCnt', 'http_reportFeq', 'notReportFiles', 'ping_domain', 'roomImReportTimeout']
- **countryZone.getZonelist** → resp: ['appid', 'captcha', 'countryList', 'message', 'rescode', 'time']
- **login.checkMobile** → resp: ['exist', 'time']