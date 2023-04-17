const Koa = require('koa');
const route = require('koa-route');
const { koaBody } = require('koa-body');
const store = require('./store');

const app = new Koa();

app.use(koaBody());

app.use(route.get('/stat', async (ctx) => {
  ctx.body = await store.getStat();
}));

app.use(route.get('/release/random', async (ctx) => {
  ctx.body = await store.getRandomRelease();
}));

app.use(route.get('/release/:releaseId', async (ctx, releaseId) => {
  ctx.body = await store.getReleaseById(releaseId);
}));

app.use(route.get('/release/:releaseId/similar', async (ctx, releaseId) => {
  ctx.body = await store.getSimilarRelease(releaseId);
}));

app.use(route.post('/releases', async (ctx) => {
  const params = JSON.parse(ctx.request.body);
  ctx.body = await store.getReleases(params);
}));

app.use(route.post('/releases/best', async (ctx) => {
  const params = JSON.parse(ctx.request.body);
  ctx.body = await store.getBestReleases(params);
}));

app.use(route.get('/search/autocomplete', async (ctx) => {
  const query = ctx.query.q;
  if (!query || query.length < 3) {
    ctx.body = {
      "error": "wrong query"
    };
    return false;
  }
  ctx.body = await store.getAutocomplete(query);
}));

app.use(route.post('/discogs_info', async (ctx) => {
  const response = await store.getDiscogsInfo(ctx.request.body);
  ctx.body = response;
}));

app.use(route.get('/tags', async (ctx) => {
  const { limit, offset } = ctx.query;
  ctx.body = await store.getTags({ limit, offset });
}));


module.exports = app;
