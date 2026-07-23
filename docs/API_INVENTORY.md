# API inventory — original app vs new backend

Generated 2026-07-23T18:48:26.435Z

- **350** distinct endpoints across **94** modules
- **350** implemented (100.0%)
- **6** confirmed called by the client at runtime
- **244** recovered model classes available as shape evidence

> Response shapes were never recovered: every catalog entry carries an
> empty `response_fields`. Field names come from decrypted
> `@SerializedName` keys, grouped by category rather than bound to an
> endpoint. Shapes are therefore reconstructed from what the client
> actually reads, not copied from a captured response.

## Coverage by module

| Module | Endpoints | Implemented | Called at runtime |
|---|---:|---:|---:|
| room | 49 | 49 | 0 |
| user | 32 | 32 | 0 |
| LiveRoom | 23 | 23 | 1 |
| RoomApi | 23 | 23 | 0 |
| gift | 14 | 14 | 0 |
| mall | 12 | 12 | 1 |
| Game | 10 | 10 | 0 |
| LivePk | 10 | 10 | 0 |
| bottle | 10 | 10 | 0 |
| moment | 9 | 9 | 0 |
| app | 8 | 8 | 1 |
| SuperManage | 7 | 7 | 0 |
| comment | 7 | 7 | 0 |
| activity | 6 | 6 | 0 |
| report | 6 | 6 | 0 |
| MiniGame | 5 | 5 | 0 |
| medal | 5 | 5 | 0 |
| task | 5 | 5 | 1 |
| Noble | 4 | 4 | 0 |
| feedTopic | 4 | 4 | 0 |
| search | 4 | 4 | 0 |
| BDCenter | 3 | 3 | 1 |
| LiveRoomLevel | 3 | 3 | 0 |
| RoomLevel | 3 | 3 | 0 |
| /html/mobiChecker/index | 2 | 2 | 0 |
| /share_bottle/index | 2 | 2 | 0 |
| GameMall | 2 | 2 | 0 |
| HiddenSettings | 2 | 2 | 0 |
| LiveLuckyBags | 2 | 2 | 0 |
| LiveRocketGift | 2 | 2 | 0 |
| LiveRoomBomb | 2 | 2 | 0 |
| LiveSearch | 2 | 2 | 0 |
| LuckyNumber | 2 | 2 | 0 |
| RocketGift | 2 | 2 | 0 |
| RoomAct | 2 | 2 | 0 |
| RoomBomb | 2 | 2 | 0 |
| UsersRoamMsg | 2 | 2 | 0 |
| luckyBags | 2 | 2 | 0 |
| backPhoto | 2 | 2 | 0 |
| couple | 2 | 2 | 0 |
| login | 2 | 2 | 0 |
| notice | 2 | 2 | 1 |
| /api/GetUserSig | 1 | 1 | 0 |
| /api/v1/upload/applog | 1 | 1 | 0 |
| /googleplaySub/getSubOrder | 1 | 1 | 0 |
| /googleplaySub/getSubReceipt | 1 | 1 | 0 |
| /googleplaySub/subProductList | 1 | 1 | 0 |
| /html/anchor/index | 1 | 1 | 0 |
| /html/announcementFamily/index | 1 | 1 | 0 |
| /html/changePhone/index | 1 | 1 | 0 |
| /html/coinsMerchant/index | 1 | 1 | 0 |
| /html/cpReward/index | 1 | 1 | 0 |
| /html/friendCenter/index | 1 | 1 | 0 |
| /html/luckyBox/index | 1 | 1 | 0 |
| /html/magicBox/index | 1 | 1 | 0 |
| /html/medalRank/index | 1 | 1 | 0 |
| /html/pkReward/index | 1 | 1 | 0 |
| /html/pkRule/index | 1 | 1 | 0 |
| /html/report/index | 1 | 1 | 0 |
| /html/roomParty/index | 1 | 1 | 0 |
| /html/roomScoreRank/index | 1 | 1 | 0 |
| /html/vipScoreRank/index | 1 | 1 | 0 |
| /html/wealth_grade/index | 1 | 1 | 0 |
| /index | 1 | 1 | 0 |
| /share_room/index | 1 | 1 | 0 |
| Anchor | 1 | 1 | 0 |
| Api | 1 | 1 | 0 |
| ChargeGiftBag | 1 | 1 | 0 |
| IMSvc | 1 | 1 | 0 |
| JoyPlay | 1 | 1 | 0 |
| LuckyDraw | 1 | 1 | 0 |
| RadioRoomPk | 1 | 1 | 0 |
| bestFriend | 1 | 1 | 0 |
| api_GetCountry | 1 | 1 | 0 |
| api_GetUserSig | 1 | 1 | 0 |
| api_bind_facebook | 1 | 1 | 0 |
| api_bind_google | 1 | 1 | 0 |
| api_sms_kit_bind_mobile_by_sms_kit | 1 | 1 | 0 |
| api_sms_kit_register_user_by_sms_kit | 1 | 1 | 0 |
| api_sms_kit_update_passwd_by_sms_kit | 1 | 1 | 0 |
| api_v1_report_single | 1 | 1 | 0 |
| api_v1_upload_applog | 1 | 1 | 0 |
| countryZone | 1 | 1 | 0 |
| feedback | 1 | 1 | 0 |
| googleplaySub_getSubOrder | 1 | 1 | 0 |
| googleplaySub_getSubReceipt | 1 | 1 | 0 |
| googleplaySub_subProductList | 1 | 1 | 0 |
| googleplay_getOrder | 1 | 1 | 0 |
| googleplay_getReceipt | 1 | 1 | 0 |
| googleplay_productList | 1 | 1 | 0 |
| preArea | 1 | 1 | 0 |
| rtc | 1 | 1 | 0 |
| sq | 1 | 1 | 0 |
| wallet | 1 | 1 | 0 |

## Called by the client but not implemented

These are not theoretical — the app requests them and currently gets an
empty envelope, so each one is a screen that renders wrong today.

| Action | Calls | Params observed |
|---|---:|---|
