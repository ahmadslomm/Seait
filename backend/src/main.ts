// Load .env before anything reads process.env. Prisma reads .env itself for
// CLI commands, but the Nest app did not — so AGORA_* (and any future
// server config) were silently undefined at runtime.
import 'dotenv/config';
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
  // Admin asset uploads use multipart/form-data. This parser only activates for
  // that content type, so the api.php gateway (urlencoded) is untouched. Limit
  // guards against a single oversized upload wedging the process.
  await inst.register(require('@fastify/multipart'), { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
  await app.listen(process.env.PORT||8080,'0.0.0.0');
  console.log('Seait backend (api.php gateway, '+require('./actions.catalog.json')._total+' actions) on :'+(process.env.PORT||8080));
}
bootstrap();
