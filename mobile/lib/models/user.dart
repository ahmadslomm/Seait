class UserModel {
  final int uid; final String nick, avatar, avatarFrame, chatBubble, infoBgImg, sign, levelName, nationalFlag, constellation;
  final int sex, age, nobleLevel, vipLevel, svip, wealthLv, charmLv, activeLevel, gameLv; final bool isAnchor;
  final int fans, following, gifts, beans, photos, days, visitors; final int charm;
  final int coins, diamonds, gold; final int wealthExp;
  final Map cpInfo; final Map guildInfo; final List medals;
  UserModel.fromJson(Map j):
    uid=int.tryParse('${j['uid']}')??0, nick=j['nick']??'', avatar=j['avatar']??'', avatarFrame=j['avatarFrame']??'',
    chatBubble=j['chatBubble']??'', infoBgImg=j['infoBgImg']??'', sign=j['sign']??'', levelName=j['levelName']??'',
    nationalFlag=j['nationalFlag']??'', constellation=j['constellation']??'', sex=int.tryParse('${j['sex']}')??0,
    age=int.tryParse('${j['age']}')??0, nobleLevel=int.tryParse('${j['noble_level']??0}')??0,
    vipLevel=int.tryParse('${j['vip_level']??0}')??0, svip=int.tryParse('${j['svip']??0}')??0,
    wealthLv=int.tryParse('${j['wealthLv']??0}')??0, charmLv=int.tryParse('${j['charmLv']??0}')??0,
    activeLevel=int.tryParse('${j['active_level']??0}')??0, gameLv=int.tryParse('${j['gameLv']??0}')??0,
    isAnchor=j['isAnchor']==true, fans=int.tryParse('${j['fans']}')??0,
    following=int.tryParse('${j['subs']}')??0, gifts=int.tryParse('${j['gifts']}')??0, beans=int.tryParse('${j['beans']}')??0,
    photos=int.tryParse('${j['photos']}')??0, days=int.tryParse('${j['days']}')??0,
    visitors=int.tryParse('${j['visitors']??0}')??0, charm=int.tryParse('${j['charm']}')??0,
    coins=int.tryParse('${j['coins']??0}')??0, diamonds=int.tryParse('${j['diamonds']??0}')??0, gold=int.tryParse('${j['gold']??0}')??0,
    wealthExp=int.tryParse('${j['wealthExp']??0}')??0,
    cpInfo=j['cp_info']??const{}, guildInfo=j['guild_info']??const{}, medals=j['medal']??const[];
}
