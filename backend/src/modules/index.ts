import { EconomyService } from './economy.service';
import { NoticeModule } from './notice.service';
import { TaskModule } from './task.service';
import { MallModule } from './mall.service';
import { RoomModule } from './room.service';
import { UserModule } from './user.service';
import { ThemeModule } from './theme.service';
import { WalletModule, ActivityModule, SearchModule, MedalModule, AgencyModule } from './misc.service';

export { ThemeModule, EconomyService, NoticeModule, TaskModule, MallModule, RoomModule, UserModule,
         WalletModule, ActivityModule, SearchModule, MedalModule, AgencyModule };

/** Domain modules whose handlers the router merges, in registration order. */
export const API_MODULES = [
  UserModule, RoomModule, WalletModule, MallModule, TaskModule,
  NoticeModule, ActivityModule, SearchModule, MedalModule, AgencyModule, ThemeModule,
] as const;

/** Everything the Nest module must provide for the above to resolve. */
export const API_PROVIDERS = [EconomyService, ...API_MODULES];
