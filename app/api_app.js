const koa = require('koa');
const route = require('koa-route');
const request = require('koa-request');
const body_parser = require('koa-body-parser');
const urllib = require('url');
const Store = require('./store');

var app = koa();
global.store = new Store(); // bad!

app.use(body_parser({limit: '10mb'}));

app.use(route.get('/crawler/get_urls', function *(){
  var response = yield store.get_random_blogspot_urls(this.query.limit);
  this.body = response;
}));

app.use(route.get('/stat', function *(){
  this.body = JSON.stringify(yield store.get_stat());
}));

app.use(route.get('/tags', function *(){
  var response = yield store.get_tags();
  this.body = response;
}));

app.use(route.get('/post/random', function *(){
  var response = yield store.get_random();
  this.body = response;
}));

app.use(route.get('/post/:post_id', function *(post_id){
  var response = yield store.get_by_id(post_id);
  this.body = response;
}));

app.use(route.get('/search/autocomplete', function *(post_id){
  var query = this.query.q;
  if(!query || query.length < 3){
    this.body = JSON.stringify({
      "error": "wrong query"
    });
    return false;
  }
  var response = yield store.autocomplete_search(query);
  this.body = response;
}));

app.use(route.post('/search/tags', function *(){
  var response = yield store.get_by_tags(this.request.body);
  this.body = response;
}));

app.use(route.post('/search/posts', function *(){
  let params = JSON.parse(this.request.body);
  var response = yield store.search(params);
  this.body = response;
}));

app.use(route.get('/search/tag', function *(){
  var query = this.query.q;
  var response = yield store.get_by_tag(query);
  this.body = response;
}));

app.use(route.post('/mixcloud/get_tracks', function *(){
  var url_params = urllib.parse(JSON.parse(this.request.body).url);
  var mix_key = url_params.pathname;
  if(!url_params.host.includes('mixcloud.com')){
    this.body = JSON.stringify({
      "error": "not a mixcloud link"
    });
    return false;
  }
  if(!/^\/.*\/.{1,}(\/)?/.test(mix_key)){
    this.body = JSON.stringify({
      "error": "link is not valid"
    });
    return false;
  }
  var options = {
    url: 'https://www.mixcloud.com/player/details/',
    qs: {
      "key": mix_key
    },
    headers: { 'User-Agent': this.request.header['user-agent'] }
  };
  var response = yield request(options);
  this.body = response.body || {};
}));

app.use(route.post('/discogs_info', function *(){
  var response = yield store.get_discogs_info(this.request.body);
  this.body = response;
}));


module.exports = app;
