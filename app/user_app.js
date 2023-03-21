const pry = require('pryjs');

const koa = require('koa');
const mount = require('koa-mount');
const route = require('koa-route');
const session = require('koa-session');
const Grant = require('grant-koa');
const grant = new Grant(require('../config/oauth_config'));
const request = require('request');
const purest = require('purest')({request});
const config = require('@purest/providers');
const facebook = purest({provider: 'facebook', config});


var user_app = koa();

user_app.use(mount(grant));
user_app.use(route.get('/handle_auth_callback', function *(next){
  var fb_user = yield new Promise((resolve, reject) => facebook.query()
    .get('me')
    .qs({fields: 'email, picture, name, first_name, last_name'})
    .auth(this.session.grant.response.access_token)
    .request(function (err, _res, body) {
      if(err){
        return reject(err);
      }
      resolve(body);
    })
  );

  //bad
  var user = yield store.get_user_by_email(fb_user.email);
  if(!user){
    user = yield store.create_user(fb_user)
  }

  this.session.user = fb_user;

  this.body = `
    <script>
      window.close();
    </script>
  `;
}));

user_app.use(route.get('/logout', function *(next){
  this.session = null;
  this.body = 'true';
}));

user_app.use(route.get('/info', function *(next){
  var user = this.session.user;
  if(!user){
    this.body = JSON.stringify({
      auth: false,
      user: null
    });
    return;
  }

  this.body = JSON.stringify({
    auth: true,
    user: Object.assign({}, user, yield store.get_user_by_email(user.email))
  });
}));


module.exports = user_app;
