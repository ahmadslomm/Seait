import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
async function bootstrap(){
  // bodyParser:false stops NestFastify from registering its default json/urlencoded
  // parsers (which would collide with ours during listen). We install RAW string
  // parsers instead: the base64 http_body contains +/ that a urlencoded parser
  // would mangle, so the gateway must see the untouched raw body.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { bodyParser: false });
  const inst:any = app.getHttpAdapter().getInstance();
  const raw = (_r:any,b:any,d:any)=>d(null,b);
  for (const ct of ['application/x-www-form-urlencoded','text/plain']) {
    if (inst.hasContentTypeParser(ct)) inst.removeContentTypeParser(ct);
    inst.addContentTypeParser(ct, { parseAs:'string' }, raw);
  }
  await app.listen(process.env.PORT||8080,'0.0.0.0');
  console.log('Seait backend (api.php gateway, '+require('./actions.catalog.json')._total+' actions) on :'+(process.env.PORT||8080));
}
bootstrap();
