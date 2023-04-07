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

app.use(route.post('/releases', async (ctx) => {
  const params = JSON.parse(ctx.request.body);
  ctx.body = await store.search(params);
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

//@deprecated
app.use(route.get('/post/random', async (ctx) => {
  ctx.body = await store.getRandom();
}));

//@deprecated
app.use(route.get('/post/:post_id', async (ctx, post_id) => {
  const response = await store.getById(post_id);
  ctx.body = response;
}));

//@deprecated
app.use(route.get('/tags', async (ctx) => {
  ctx.body = await store.getTags();
}));

//@deprecated
app.use(route.post('/search/posts', async (ctx) => {
  const params = JSON.parse(ctx.request.body);
  const response = await store.search(params);
  ctx.body = response;
}));


module.exports = app;
