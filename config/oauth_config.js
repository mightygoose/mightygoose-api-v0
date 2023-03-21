const FB_KEY = process.env['FB_KEY'];
const FB_SECRET = process.env['FB_SECRET'];
const FB_HOST = process.env['FB_HOST'];
const PORT = process.env['PORT'] || 3000;


module.exports = {
  "server": {
    "protocol": "http",
    "host": FB_HOST.concat(process.env['NODE_ENV'] !== 'production' ? `:${PORT}` : ''),
    "path": "/user",
    "transport": "session",
    "callback": "/user/handle_auth_callback"
  },
  "facebook": {
    "key": FB_KEY,
    "secret": FB_SECRET,
    //"callback": "/user/handle_facebook_callback",
    "scope": [
      "email"
    ]
  },
}
