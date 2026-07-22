import os
R="/root/Seait/mobile/lib"
def w(p,c):
    f=os.path.join(R,p); os.makedirs(os.path.dirname(f),exist_ok=True); open(f,"w").write(c.lstrip("\n"))
A="../assets/ui"  # asset key prefix (declared in pubspec)

# ---------- DESIGN SYSTEM components ----------
w("ui/components.dart", f"""
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme.dart';

/// Coin/Diamond icon from the real cropped app art.
class CoinIcon extends StatelessWidget {{ final double s; const CoinIcon({{super.key,this.s=34}});
  @override Widget build(BuildContext c)=>Image.asset('{A}/coin_icon.png', width:s, height:s, errorBuilder:(_,__,___)=>Icon(Icons.monetization_on,color:ZC.coin,size:s)); }}
class DiamondIcon extends StatelessWidget {{ final double s; const DiamondIcon({{super.key,this.s=34}});
  @override Widget build(BuildContext c)=>Image.asset('{A}/diamond_icon.png', width:s, height:s, errorBuilder:(_,__,___)=>Icon(Icons.diamond,color:ZC.diamond,size:s)); }}
class VipMedallion extends StatelessWidget {{ final double s; const VipMedallion({{super.key,this.s=150}});
  @override Widget build(BuildContext c)=>Image.asset('{A}/vip_medallion.png', width:s, errorBuilder:(_,__,___)=>Icon(Icons.workspace_premium,color:ZC.gold,size:s)); }}

/// Small colored pill badge (wealth/level/noble/star).
class ZBadge extends StatelessWidget {{ final String text; final Color color; final IconData? icon;
  const ZBadge(this.text,this.color,{{super.key,this.icon}});
  @override Widget build(BuildContext c)=>Container(padding:const EdgeInsets.symmetric(horizontal:7,vertical:2),
    decoration:BoxDecoration(color:color.withOpacity(.9),borderRadius:BorderRadius.circular(9),boxShadow:[BoxShadow(color:color.withOpacity(.4),blurRadius:6)]),
    child:Row(mainAxisSize:MainAxisSize.min,children:[ if(icon!=null)...[Icon(icon,size:11,color:Colors.white),const SizedBox(width:2)],
      Text(text,style:const TextStyle(color:Colors.white,fontSize:11,fontWeight:FontWeight.bold))])); }}

/// Avatar with optional network frame overlay (svga/pag frames render as png fallback).
class AvatarFrame extends StatelessWidget {{ final String avatarUrl; final String? frameUrl; final double size;
  const AvatarFrame({{super.key,required this.avatarUrl,this.frameUrl,this.size=48}});
  @override Widget build(BuildContext c)=>SizedBox(width:size*1.4,height:size*1.4,child:Stack(alignment:Alignment.center,children:[
    ClipOval(child:CachedNetworkImage(imageUrl:avatarUrl,width:size,height:size,fit:BoxFit.cover,
      errorWidget:(_,__,___)=>CircleAvatar(radius:size/2,backgroundColor:ZC.card,child:Icon(Icons.person,color:ZC.textLo)))),
    if(frameUrl!=null && frameUrl!.isNotEmpty && frameUrl!.endsWith('.png')) CachedNetworkImage(imageUrl:frameUrl!,width:size*1.4,height:size*1.4),
  ])); }}

/// Wallet balance card (coin gradient / diamond gradient).
class WalletCard extends StatelessWidget {{ final String label; final String value; final bool diamond; final VoidCallback? onTap;
  const WalletCard({{super.key,required this.label,required this.value,this.diamond=false,this.onTap}});
  @override Widget build(BuildContext c)=>InkWell(onTap:onTap,borderRadius:BorderRadius.circular(14),child:Container(
    padding:const EdgeInsets.all(14),decoration:BoxDecoration(gradient:diamond?ZC.diaGrad:ZC.coinGrad,borderRadius:BorderRadius.circular(14)),
    child:Row(children:[ diamond?const DiamondIcon():const CoinIcon(), const SizedBox(width:10),
      Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        Text(label,style:TextStyle(color:(diamond?Colors.deepPurple.shade900:Colors.brown.shade800).withOpacity(.9),fontWeight:FontWeight.w700)),
        Text(value,style:TextStyle(color:diamond?Colors.deepPurple.shade900:Colors.brown.shade900,fontSize:22,fontWeight:FontWeight.bold))])),
    ]))); }}

/// Room seat (host/guest) — used by the voice room.
class RoomSeat extends StatelessWidget {{ final int no; final String? avatarUrl; final String name; final bool host; final bool speaking; final bool micOff; final VoidCallback? onTap;
  const RoomSeat({{super.key,required this.no,this.avatarUrl,this.name='',this.host=false,this.speaking=false,this.micOff=false,this.onTap}});
  @override Widget build(BuildContext c){{ final r=host?30.0:26.0; return InkWell(onTap:onTap,child:Column(mainAxisSize:MainAxisSize.min,children:[
    Stack(alignment:Alignment.center,children:[
      if(speaking) Container(width:r*2+10,height:r*2+10,decoration:BoxDecoration(shape:BoxShape.circle,border:Border.all(color:ZC.gold,width:3))),
      Container(width:r*2,height:r*2,decoration:BoxDecoration(shape:BoxShape.circle,color:ZC.card,border:Border.all(color:host?ZC.gold:Colors.white24,width:host?2:1)),
        child:avatarUrl!=null?ClipOval(child:CachedNetworkImage(imageUrl:avatarUrl!,fit:BoxFit.cover)):Icon(host?Icons.star:Icons.add,color:host?ZC.gold:ZC.textLo,size:r*0.7)),
      if(micOff) Positioned(right:0,bottom:0,child:CircleAvatar(radius:9,backgroundColor:Colors.black54,child:const Icon(Icons.mic_off,size:11,color:ZC.danger))),
    ]),
    const SizedBox(height:3),
    Text(avatarUrl==null?(host?'Host':'No.$no'):name,style:const TextStyle(color:ZC.textLo,fontSize:10),overflow:TextOverflow.ellipsis),
  ])); }} }}

/// Ranking list item.
class RankingItem extends StatelessWidget {{ final int rank; final String name; final int score; final String? avatarUrl;
  const RankingItem({{super.key,required this.rank,required this.name,required this.score,this.avatarUrl}});
  @override Widget build(BuildContext c)=>Padding(padding:const EdgeInsets.symmetric(horizontal:12,vertical:6),child:Row(children:[
    SizedBox(width:28,child:Text('$rank',style:TextStyle(color:rank<=3?ZC.gold:ZC.textLo,fontWeight:FontWeight.bold,fontSize:16))),
    CircleAvatar(radius:18,backgroundColor:ZC.card,backgroundImage:avatarUrl!=null?NetworkImage(avatarUrl!):null),
    const SizedBox(width:10),Expanded(child:Text(name,style:const TextStyle(color:Colors.white))),
    const CoinIcon(s:16),const SizedBox(width:4),Text('$score',style:const TextStyle(color:ZC.gold)),
  ])); }}
""")
print("components generated")
