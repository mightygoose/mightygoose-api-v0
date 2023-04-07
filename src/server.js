const Koa = require('koa');
const route = require('koa-route');
const compress = require('koa-compress');
const mount = require('koa-mount');

const api_app = require('./app/api_app');
const log = require('log-colors');

const app = new Koa();


//response time
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
  ctx.set('X-Response-Time', ms + 'ms');
});


//compress
app.use(compress({
  threshold: 2048,
  flush: require('zlib').Z_SYNC_FLUSH
}));

//api endpoints
app.use(mount('/api', api_app));


const port = process.env['PORT'] || 3000;

try {
  app.listen(port, () => log.info(`server is running on port: ${port}`))
} catch (error) {
  log.error(`could not start server: ${error}`)
}
