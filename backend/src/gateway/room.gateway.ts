import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
const LAYOUTS=[5,10,15,21,30];
type Seat={seatNo:number;uid:number|null;micState:number;speaking?:boolean;charm?:number};
@WebSocketGateway({ cors:true, namespace:'/room' })
export class RoomGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private rooms=new Map<number,{seatCount:number;seats:Seat[];members:Set<number>}>();
  private ensure(rid:number,n=10){ if(!LAYOUTS.includes(n)) n=10; let r=this.rooms.get(rid); if(!r){ r={seatCount:n,seats:Array.from({length:n},(_,i)=>({seatNo:i,uid:null,micState:0})),members:new Set()}; this.rooms.set(rid,r);} return r; }
  @SubscribeMessage('room_join') onJoin(@MessageBody() d:any,@ConnectedSocket() c:Socket){ const rm=`room_${d.rid}`; c.join(rm); (c.data as any)={rid:d.rid,uid:d.uid}; const r=this.ensure(d.rid,d.seatCount); r.members.add(d.uid); c.emit('room_state',r); this.server.to(rm).emit('user_enter',{uid:d.uid,effect:'join'}); }
  @SubscribeMessage('seat_update') onSeat(@MessageBody() d:any){ const r=this.ensure(d.rid); const s=r.seats[d.seatNo]; if(s&&!s.uid){ r.seats.forEach(x=>{if(x.uid===d.uid)x.uid=null;}); s.uid=d.uid; this.server.to(`room_${d.rid}`).emit('seat_update',s);} }
  @SubscribeMessage('mic_status') onMic(@MessageBody() d:any){ const s=this.rooms.get(d.rid)?.seats[d.seatNo]; if(s){ s.micState=d.micState; this.server.to(`room_${d.rid}`).emit('mic_status',s);} }
  @SubscribeMessage('speaking') onSpeak(@MessageBody() d:any){ this.server.to(`room_${d.rid}`).emit('speaking',d); }
  @SubscribeMessage('send_gift') onGift(@MessageBody() d:any){ this.server.to(`room_${d.rid}`).emit('gift_received',{...d,fullscreen:(d.price||0)>=5000}); }
  @SubscribeMessage('chat') onChat(@MessageBody() d:any){ this.server.to(`room_${d.rid}`).emit('chat',d); }
  handleDisconnect(c:Socket){ const {rid,uid}=(c.data as any)||{}; if(rid){ const r=this.rooms.get(rid); r?.members.delete(uid); r?.seats.forEach(s=>{if(s.uid===uid)s.uid=null;}); this.server.to(`room_${rid}`).emit('user_leave',{uid}); } }
}
