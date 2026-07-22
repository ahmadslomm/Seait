class Wallet { final int coins, diamonds; Wallet(this.coins,this.diamonds);
  factory Wallet.fromJson(Map j)=>Wallet(int.tryParse('${j['coins']??j['coin']??0}')??0, int.tryParse('${j['diamonds']??j['diamond']??0}')??0); }
