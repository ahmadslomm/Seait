import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
async function bootstrap(){
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  // accept x-www-form-urlencoded + text bodies raw
  const inst:any = app.getHttpAdapter().getInstance();
  inst.addContentTypeParser('application/x-www-form-urlencoded', { parseAs:'string' }, (_r:any,b:any,d:any)=>d(null,b));
  inst.addContentTypeParser('text/plain', { parseAs:'string' }, (_r:any,b:any,d:any)=>d(null,b));
  await app.listen(process.env.PORT||8080,'0.0.0.0');
  console.log('Seait backend (api.php gateway, '+require('./actions.catalog.json')._total+' actions) on :'+(process.env.PORT||8080));
}
bootstrap();
