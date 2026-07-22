# API INVENTORY — Seait ≈ com.waig.nalo (ZaffaLive)

**Total endpoints: 303** — 165 business + 117 sub-namespaced (Action/*) + 21 php.  Plus 48 H5 pages.

**Wire protocol:** `POST /api.php` form `app_id=com.waig.nalo&http_body=base64(XOR(json,md5(pkg)))`. Envelope: request `{action,token,uid,_login_uid,lang,ua,deviceid,sign,timestamp,...}` → response `{response_status:{error},response_data}`. `QxZ…` = encrypted.

## Systems (category → count)
- **Room**: 99
- **User**: 33
- **Feed**: 29
- **Game**: 23
- **Gift**: 19
- **Moderation**: 13
- **Store**: 11
- **PK**: 10
- **Config**: 8
- **Activity**: 5
- **Medal**: 5
- **index**: 5
- **Search**: 4
- **Noble**: 4
- **Task**: 3
- **Guild**: 3
- **IM**: 3
- **CP**: 2
- **Auth**: 2
- **Messages**: 2
- **Settings**: 2
- **Feedback**: 1
- **wallet**: 1
- **api**: 1
- **api_GetCountry**: 1
- **api_GetUserSig**: 1
- **api_bind_facebook**: 1
- **api_bind_google**: 1
- **api_sms_kit_bind_mobile_by_sms_kit**: 1
- **api_sms_kit_register_user_by_sms_kit**: 1
- **api_sms_kit_update_passwd_by_sms_kit**: 1
- **api_v1_report_single**: 1
- **api_v1_upload_applog**: 1
- **googleplay_getOrder**: 1
- **googleplay_getReceipt**: 1
- **googleplay_productList**: 1
- **googleplaySub_getSubOrder**: 1
- **googleplaySub_getSubReceipt**: 1
- **googleplaySub_subProductList**: 1

## Full action list by system

### Activity (5)
- · `activity.clickBanner` [POST /api.php]
- · `activity.createRoomEvents` [POST /api.php]
- · `activity.getBannerList` [POST /api.php]
- · `activity.getBannerListV2` [POST /api.php]
- · `activity.getRoomEvents` [POST /api.php]

### Auth (2)
- · `login.call` [POST /api.php]
- ✅ `login.checkMobile` [POST /index.php] req=['action', 'token', 'uid', '_login_uid', 'lang', 'ua']

### CP (2)
- · `couple.cpRank` [POST /api.php]
- · `couple.onAnswerCouple` [POST /api.php]

### Config (8)
- · `app.checkAppVersion` [POST /api.php]
- · `app.commonConfig` [POST /api.php]
- · `app.getConfig` [POST /api.php]
- ✅ `app.getConfigV2` [POST /api.php] req=['action', 'deviceid', 'lang', 'ua']
- · `app.initApp` [POST /api.php]
- · `app.uploadPing` [POST /api.php]
- ✅ `countryZone.getZonelist` [GET /api/GetCountry.php] req=['action', 'token', 'uid', '_login_uid', 'lang', 'ua']
- ✅ `preArea.getServer` [POST /api.php] req=['account', 'action', 'deviceid', 'ipCountry', 'lang', 'langueCountry']

### Feed (29)
- · `bottle.deleteCensorSong` [POST /api.php]
- · `bottle.deleteSong` [POST /api.php]
- · `bottle.getCensorIngUSongCnt` [POST /api.php]
- · `bottle.getLikeBottleList` [POST /api.php]
- · `bottle.getUserCensorSongs` [POST /api.php]
- · `bottle.getUserTimelineExNew` [POST /api.php]
- · `bottle.likeBottle` [POST /api.php]
- · `bottle.playFinish` [POST /api.php]
- · `bottle.unlikeBottle` [POST /api.php]
- · `bottle.uploadSong` [POST /api.php]
- · `comment.addComment` [POST /api.php]
- · `comment.bottleCommentList` [POST /api.php]
- · `comment.bottleInfoNew` [POST /api.php]
- · `comment.commentCommentList` [POST /api.php]
- · `comment.delMyComment` [POST /api.php]
- · `comment.praiseComment` [POST /api.php]
- · `comment.unpraiseComment` [POST /api.php]
- · `feedTopic.info` [POST /api.php]
- · `feedTopic.newUsong` [POST /api.php]
- · `feedTopic.recomList` [POST /api.php]
- · `feedTopic.selectList` [POST /api.php]
- · `moment.browseUsids` [POST /api.php]
- · `moment.follow` [POST /api.php]
- · `moment.getPublicSongTxt` [POST /api.php]
- · `moment.hasHistory` [POST /api.php]
- · `moment.history` [POST /api.php]
- · `moment.recomV3` [POST /api.php]
- · `moment.song` [POST /api.php]
- · `moment.topic` [POST /api.php]

### Feedback (1)
- · `feedback.report` [POST /api.php]

### Game (23)
- · `Action/Game.createGameRoom` [POST /api.php]
- · `Action/Game.getGameRoomId` [POST /api.php]
- · `Action/Game.getGameRoomRank` [POST /api.php]
- · `Action/Game.getGamerInfo` [POST /api.php]
- · `Action/Game.getOnlinePlayers` [POST /api.php]
- · `Action/Game.getSignInTable` [POST /api.php]
- · `Action/Game.hotGames` [POST /api.php]
- · `Action/Game.hotGamesHourly` [POST /api.php]
- · `Action/Game.rankingOverview` [POST /api.php]
- · `Action/Game.signIn` [POST /api.php]
- · `Action/GameMall.exchangeProduct` [POST /api.php]
- · `Action/GameMall.getMallProduct` [POST /api.php]
- · `Action/JoyPlay.getUidAndToken` [POST /api.php]
- · `Action/LiveLuckyBags.fetchBagInfos` [POST /api.php]
- · `Action/LiveLuckyBags.getBag` [POST /api.php]
- · `Action/LuckyDraw.drawPrizesPreview` [POST /api.php]
- · `Action/LuckyNumber.getConfig` [POST /api.php]
- · `Action/LuckyNumber.setConfig` [POST /api.php]
- · `Action/MiniGame.getUidAndToken` [POST /api.php]
- · `Action/MiniGame.getUidAndTokenByAmg` [POST /api.php]
- · `Action/MiniGame.getUidAndTokenByYomi` [POST /api.php]
- · `Action/MiniGame.getUidAndTokenV2` [POST /api.php]
- · `Action/MiniGame.tokenDestroy` [POST /api.php]

### Gift (19)
- · `Action/ChargeGiftBag.getGiftBagStatus` [POST /api.php]
- · `Action/LiveRocketGift.gifts` [POST /api.php]
- · `Action/LiveRocketGift.roomGifts` [POST /api.php]
- · `Action/RocketGift.gifts` [POST /api.php]
- · `Action/RocketGift.roomGifts` [POST /api.php]
- · `gift.checkHasPacketGift` [POST /api.php]
- · `gift.getClientGiftTabs` [POST /api.php]
- · `gift.getCommonGift` [POST /api.php]
- · `gift.getDrawGiftTemplate` [POST /api.php]
- · `gift.getGiftList` [POST /api.php]
- · `gift.getPacketGift` [POST /api.php]
- · `gift.getReceieveGift` [POST /api.php]
- · `gift.getTopUserGiftMap` [POST /api.php]
- · `gift.getUserGiftMap` [POST /api.php]
- · `gift.getUserSongGiftList` [POST /api.php]
- · `gift.sendPrivateGift` [POST /api.php]
- · `gift.sendSongGift` [POST /api.php]
- · `gift.shareGiftMapMoment` [POST /api.php]
- · `gift.songGiftRank` [POST /api.php]

### Guild (3)
- · `Action/Anchor.inviteJoinGuildRes` [POST /api.php]
- · `Action/BDCenter.inviteGuildRes` [POST /api.php]
- · `Action/BDCenter.inviteUserRes` [POST /api.php]

### IM (3)
- · `Action/IMSvc.getQuickChatMsg` [POST /api.php]
- · `Action/UsersRoamMsg.getIMNum` [POST /api.php]
- · `Action/UsersRoamMsg.getRelationIMNum` [POST /api.php]

### Medal (5)
- · `medal.adornMedalList` [POST /api.php]
- · `medal.getMedalList` [POST /api.php]
- · `medal.getSomeUserMedalList` [POST /api.php]
- · `medal.getUserMedalListAdorn` [POST /api.php]
- · `medal.getUserMedalListAll` [POST /api.php]

### Messages (2)
- · `notice.checkNotice` [POST /api.php]
- · `notice.clearNoticeAndImCount` [POST /api.php]

### Moderation (13)
- · `Action/SuperManage.ban` [POST /api.php]
- · `Action/SuperManage.behaviorBan` [POST /api.php]
- · `Action/SuperManage.deleteSong` [POST /api.php]
- · `Action/SuperManage.getUserBehaviorBanInfo` [POST /api.php]
- · `Action/SuperManage.resetLiveRoom` [POST /api.php]
- · `Action/SuperManage.resetRoom` [POST /api.php]
- · `Action/SuperManage.resetUser` [POST /api.php]
- · `report.addBlackList` [POST /api.php]
- · `report.checkInBlackList` [POST /api.php]
- · `report.delBlackList` [POST /api.php]
- · `report.getBlackList` [POST /api.php]
- ✅ `report.getReportConfig` [GET /api.php] req=['_login_uid', 'action', 'deviceid', 'lang', 'token', 'ua']
- · `report.reportUser` [POST /api.php]

### Noble (4)
- · `Action/Noble.getBirthdayInfo` [POST /api.php]
- · `Action/Noble.receiveBirthdayPresent` [POST /api.php]
- · `Action/Noble.sendHorn` [POST /api.php]
- · `Action/Noble.shareMoment` [POST /api.php]

### PK (10)
- · `Action/LivePk.acceptPk` [POST /api.php]
- · `Action/LivePk.breakOffPk` [POST /api.php]
- · `Action/LivePk.cancelPkMatch` [POST /api.php]
- · `Action/LivePk.friendList` [POST /api.php]
- · `Action/LivePk.getPkInfo` [POST /api.php]
- · `Action/LivePk.invitePk` [POST /api.php]
- · `Action/LivePk.matchLivePk` [POST /api.php]
- · `Action/LivePk.recently` [POST /api.php]
- · `Action/LivePk.refusePk` [POST /api.php]
- · `Action/LivePk.startLivePk` [POST /api.php]

### Room (99)
- · `Action/LiveRoom.addRole` [POST /api.php]
- · `Action/LiveRoom.blockade` [POST /api.php]
- · `Action/LiveRoom.closeLive` [POST /api.php]
- · `Action/LiveRoom.collectRoom` [POST /api.php]
- · `Action/LiveRoom.createRoom` [POST /api.php]
- · `Action/LiveRoom.delRole` [POST /api.php]
- · `Action/LiveRoom.facePropList` [POST /api.php]
- · `Action/LiveRoom.getCoinFlowRank` [POST /api.php]
- · `Action/LiveRoom.getLiveInfo` [POST /api.php]
- · `Action/LiveRoom.getMyCollectRoomList` [POST /api.php]
- · `Action/LiveRoom.getRoomExtraInfo` [POST /api.php]
- · `Action/LiveRoom.getRoomInfo` [POST /api.php]
- · `Action/LiveRoom.getUserContributeRank` [POST /api.php]
- · `Action/LiveRoom.getUserOnlineList` [POST /api.php]
- · `Action/LiveRoom.heartbeat` [POST /api.php]
- · `Action/LiveRoom.joinRoom` [POST /api.php]
- · `Action/LiveRoom.kickUser` [POST /api.php]
- · `Action/LiveRoom.recommend` [POST /api.php]
- · `Action/LiveRoom.sendLiveGift` [POST /api.php]
- · `Action/LiveRoom.setTextConfig` [POST /api.php]
- · `Action/LiveRoom.updateRoom` [POST /api.php]
- · `Action/LiveRoom.updateRoomImg` [POST /api.php]
- · `Action/LiveRoom.whichRoom` [POST /api.php]
- · `Action/LiveRoomBomb.getBombConfig` [POST /api.php]
- · `Action/LiveRoomBomb.getRoomPrizeRecord` [POST /api.php]
- · `Action/LiveRoomLevel.getRoomLevelInfo` [POST /api.php]
- · `Action/LiveRoomLevel.getRoomLevelPrize` [POST /api.php]
- · `Action/LiveRoomLevel.getTaskList` [POST /api.php]
- · `Action/LiveSearch.roomSearch` [POST /api.php]
- · `Action/RadioRoomPk.rank` [POST /api.php]
- · `Action/RoomAct.getActInfoById` [POST /api.php]
- · `Action/RoomAct.joinAct` [POST /api.php]
- · `Action/RoomApi.batchGetUserInfo` [POST /api.php]
- · `Action/RoomApi.blockade` [POST /api.php]
- · `Action/RoomApi.cancelCallFans` [POST /api.php]
- · `Action/RoomApi.disableMic` [POST /api.php]
- · `Action/RoomApi.divideGroup` [POST /api.php]
- · `Action/RoomApi.getDynamicKey` [POST /api.php]
- · `Action/RoomApi.heartbeat` [POST /api.php]
- · `Action/RoomApi.inviteJoinMic` [POST /api.php]
- · `Action/RoomApi.joinMic` [POST /api.php]
- · `Action/RoomApi.joinRoom` [POST /api.php]
- · `Action/RoomApi.kickUser` [POST /api.php]
- · `Action/RoomApi.lockMic` [POST /api.php]
- · `Action/RoomApi.mute` [POST /api.php]
- · `Action/RoomApi.notifyUpdateUInfo` [POST /api.php]
- · `Action/RoomApi.quitMic` [POST /api.php]
- · `Action/RoomApi.sendGift` [POST /api.php]
- · `Action/RoomApi.sendLuckyNum` [POST /api.php]
- · `Action/RoomApi.setCharmConfig` [POST /api.php]
- · `Action/RoomApi.setTextConfig` [POST /api.php]
- · `Action/RoomApi.startCallFans` [POST /api.php]
- · `Action/RoomApi.startTimingPKGroup` [POST /api.php]
- · `Action/RoomApi.stopTimingPKGroup` [POST /api.php]
- · `Action/RoomApi.switchMic` [POST /api.php]
- · `Action/RoomBomb.getBombConfig` [POST /api.php]
- · `Action/RoomBomb.getRoomPrizeRecord` [POST /api.php]
- · `Action/RoomLevel.getRoomLevelInfo` [POST /api.php]
- · `Action/RoomLevel.getRoomLevelPrize` [POST /api.php]
- · `Action/RoomLevel.getTaskList` [POST /api.php]
- · `room.addRole` [POST /api.php]
- · `room.batchGetRoomInfos` [POST /api.php]
- · `room.collectRoom` [POST /api.php]
- · `room.createRoomEx` [POST /api.php]
- · `room.delRole` [POST /api.php]
- · `room.discoverRoom` [POST /api.php]
- · `room.gameRank` [POST /api.php]
- · `room.getActivityGames` [POST /api.php]
- · `room.getActivityGamesV2` [POST /api.php]
- · `room.getApplyMicList` [POST /api.php]
- · `room.getBlackList` [POST /api.php]
- · `room.getCallFansList` [POST /api.php]
- · `room.getCoinFlowRank` [POST /api.php]
- · `room.getCoinFlowTotalRank` [POST /api.php]
- · `room.getCountryListV2` [POST /api.php]
- · `room.getCountryRoomListV2` [POST /api.php]
- · `room.getHotvalAndMedal` [POST /api.php]
- · `room.getMyCollectRoomList` [POST /api.php]
- · `room.getMyRoom` [POST /api.php]
- · `room.getMyRoomList` [POST /api.php]
- · `room.getRecommendRoomV3` [POST /api.php]
- · `room.getRoomCharmRank` [POST /api.php]
- · `room.getRoomInfo` [POST /api.php]
- · `room.getRoomManageList` [POST /api.php]
- · `room.getRoomModelConfig` [POST /api.php]
- · `room.getSendGiftRankV2` [POST /api.php]
- · `room.getTop3RankDataV2` [POST /api.php]
- · `room.getTopicRandom` [POST /api.php]
- · `room.getUserCharmRankV2` [POST /api.php]
- · `room.getUserContributeRank` [POST /api.php]
- · `room.getUserOnlineList` [POST /api.php]
- · `room.getUserOnlineListV2` [POST /api.php]
- · `room.getWealthInfo` [POST /api.php]
- · `room.inviteFriends` [POST /api.php]
- · `room.luckyGiftRank` [POST /api.php]
- · `room.shareReport` [POST /api.php]
- · `room.updateRoomImg` [POST /api.php]
- · `room.updateRoomInfo` [POST /api.php]
- · `room.userLoginRecommendRoom` [POST /api.php]

### Search (4)
- · `search.friendSearch` [POST /api.php]
- · `search.recommend` [POST /api.php]
- · `search.roomSearch` [POST /api.php]
- · `search.userSearch` [POST /api.php]

### Settings (2)
- · `Action/HiddenSettings.getHiddenSettings` [POST /api.php]
- · `Action/HiddenSettings.updateHiddenSettings` [POST /api.php]

### Store (11)
- · `mall.buyCustomizeTheme` [POST /api.php]
- · `mall.buyProduct` [POST /api.php]
- · `mall.buyTheme` [POST /api.php]
- · `mall.getMallProductV2` [POST /api.php]
- · `mall.getMyProduct` [POST /api.php]
- · `mall.getSomeUserCarFrame` [POST /api.php]
- · `mall.getUserProduct` [POST /api.php]
- · `mall.giveAwayProduct` [POST /api.php]
- · `mall.giveAwayUserList` [POST /api.php]
- · `mall.useProduct` [POST /api.php]
- · `mall.useTheme` [POST /api.php]

### Task (3)
- · `task.getSignInListV3` [POST /api.php]
- · `task.giveBeans` [POST /api.php]
- · `task.signInV3` [POST /api.php]

### User (33)
- · `backPhoto.updateDefultPhoto` [POST /api.php]
- · `backPhoto.updatePhoto` [POST /api.php]
- · `user.bashGetIsSubscribe` [POST /api.php]
- · `user.batchGetUserinfoV2` [POST /api.php]
- · `user.getCountryConfig` [POST /api.php]
- · `user.getCountryList` [POST /api.php]
- · `user.getFansList` [POST /api.php]
- · `user.getFriendList` [POST /api.php]
- · `user.getGiftWallList` [POST /api.php]
- · `user.getIsSubscribe` [POST /api.php]
- · `user.getNewUserPrizes` [POST /api.php]
- · `user.getRecommendUser` [POST /api.php]
- · `user.getSensitivePath` [POST /api.php]
- · `user.getSubcribeList` [POST /api.php]
- · `user.getUinfoV2` [POST /api.php]
- · `user.getUserIdentity` [POST /api.php]
- · `user.getUserImSendStatus` [POST /api.php]
- · `user.getUserinfo` [POST /api.php]
- · `user.getWhiteList` [POST /api.php]
- · `user.onlineUser` [POST /api.php]
- · `user.recommendUser` [POST /api.php]
- · `user.registerFinish` [POST /api.php]
- · `user.setCountry` [POST /api.php]
- · `user.subcribe` [POST /api.php]
- · `user.supporter` [POST /api.php]
- · `user.unbind` [POST /api.php]
- · `user.unsubcribe` [POST /api.php]
- · `user.updateAlias` [POST /api.php]
- · `user.updateCountry` [POST /api.php]
- · `user.updateLang` [POST /api.php]
- · `user.updateUInfo` [POST /api.php]
- · `user.uploadAvatar` [POST /api.php]
- · `user.visitors` [POST /api.php]

### api (1)
- · `/api.php` [POST /api.php]

### api_GetCountry (1)
- · `api_GetCountry.php` [POST /api/GetCountry.php]

### api_GetUserSig (1)
- · `api_GetUserSig.php` [POST /api/GetUserSig.php]

### api_bind_facebook (1)
- · `api_bind_facebook.php` [POST /api/bind_facebook.php]

### api_bind_google (1)
- · `api_bind_google.php` [POST /api/bind_google.php]

### api_sms_kit_bind_mobile_by_sms_kit (1)
- · `api_sms_kit_bind_mobile_by_sms_kit.php` [POST /api/sms_kit/bind_mobile_by_sms_kit.php]

### api_sms_kit_register_user_by_sms_kit (1)
- · `api_sms_kit_register_user_by_sms_kit.php` [POST /api/sms_kit/register_user_by_sms_kit.php]

### api_sms_kit_update_passwd_by_sms_kit (1)
- · `api_sms_kit_update_passwd_by_sms_kit.php` [POST /api/sms_kit/update_passwd_by_sms_kit.php]

### api_v1_report_single (1)
- · `api_v1_report_single` [POST /api/v1/report/single]

### api_v1_upload_applog (1)
- · `api_v1_upload_applog` [POST /api/v1/upload/applog]

### googleplaySub_getSubOrder (1)
- · `googleplaySub_getSubOrder.php` [POST /googleplaySub/getSubOrder.php]

### googleplaySub_getSubReceipt (1)
- · `googleplaySub_getSubReceipt.php` [POST /googleplaySub/getSubReceipt.php]

### googleplaySub_subProductList (1)
- · `googleplaySub_subProductList.php` [POST /googleplaySub/subProductList.php]

### googleplay_getOrder (1)
- · `googleplay_getOrder.php` [POST /googleplay/getOrder.php]

### googleplay_getReceipt (1)
- · `googleplay_getReceipt.php` [POST /googleplay/getReceipt.php]

### googleplay_productList (1)
- · `googleplay_productList.php` [POST /googleplay/productList.php]

### index (5)
- · `/html/changePhone/index.php` [POST /html/changePhone/index.php]
- · `/html/mobiChecker/index.php` [POST /html/mobiChecker/index.php]
- · `/index.php` [POST /index.php]
- · `/share_bottle/index.php` [POST /share_bottle/index.php]
- · `/share_room/index.php` [POST /share_room/index.php]

### wallet (1)
- · `wallet.getWalletInfo` [POST /api.php]

## H5 pages (48)
`/html/anchor/index.html?lang=`, `/html/announcement/index.html?`, `/html/announcementFamily/index.html?uid=`, `/html/announcementGift/index.html?`, `/html/bomb_rule/index.html?`, `/html/boomRank/index.html?`, `/html/changePhone/index.php?`, `/html/coinsMerchant/index.html?uid=`, `/html/cp/index.html?`, `/html/cp/list.html?`, `/html/cpReward/index.html?`, `/html/deleteAccount/index.html?`, `/html/dj_rule/index.html?`, `/html/friendCenter/index.html?`, `/html/friendRule/index.html?`, `/html/gameRank/index.html?`, `/html/gameTask/index.html?`, `/html/giftTips/index.html?`, `/html/giftWall/index.html?`, `/html/hallOfFame/index.html?`, `/html/inviteAgency/index.html?`, `/html/invite_activity/index.html?`, `/html/liveBoomRank/index.html?`, `/html/liveRocketRank/index.html?`, `/html/liveTask/index.html?`, `/html/luckyBox/index.html?uid=`, `/html/luckyDraw/index.html?`, `/html/magicBox/index.html?lang=`, `/html/medalRank/index.html?`, `/html/mobiChecker/index.php?bundleId=`, `/html/my_income/index.html?`, `/html/my_level/index.html?`, `/html/noble/index.html?`, `/html/pkReward/index.html?`, `/html/pkRule/index.html?`, `/html/rank/guard_rule.html?`, `/html/report/index.html?lang=`, `/html/rocketRank/index.html?`, `/html/rocketRule/index.html?`, `/html/roomParty/index.html?`, `/html/roomRule/index.html?`, `/html/roomScoreRank/index.html?type=%1$s&`, `/html/superAdmin/index.html?`, `/html/task/index.html?`, `/html/totalRank/index.html?`, `/html/vipPrivileges/index.html?`, `/html/vipScoreRank/index.html?type=%1$s&`, `/html/wealth_grade/index.html?lang=`