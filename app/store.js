"use strict"
const pry = require('pryjs');

//this module becomes a monster.
//split into db connector, items store and user store

const request = require('koa-request');
const _ = require('lodash');
const log = require('log-colors');
const jackrabbit = require('jackrabbit');
const massive = require("massive");
const url = require('url');

const DbClient = require('../lib/clients/db')


//FIXME: use lib/clients/db.js for db connection
const DB_HOST = process.env['DB_HOST'];
const DB_PORT = process.env['DB_PORT'];
const DB_USER = process.env['DB_USER'];
const DB_PASSWD = process.env['DB_PASSWD'];
const DB_NAME = process.env['DB_NAME'];

const RABBITMQ_URL = process.env['RABBITMQ_URL'];
const RABBITMQ_CHANNEL = process.env['RABBITMQ_CHANNEL'];

const DISCOGS_TOKEN = process.env['DISCOGS_TOKEN'];

const USERS_TABLE = process.env['USERS_TABLE'];

const CONNECT_TIMEOUT = 200;
const REQUEST_TIMEOUT = 200;

//local workaround for queue drain listeners
if(process.env['NODE_ENV'] !== 'production'){
  require('events').EventEmitter.defaultMaxListeners = 100;
}


class Store {
  constructor(){
    this.collection = [];
    this.tags = [];

    DbClient.then((db) => {
      this.db = db;
    })

    log.info('connecting to queue');
    this.queue = jackrabbit(RABBITMQ_URL)
    .on('connected', function() {
      log.info('connected to queue');
    })
    .on('error', function(err) {
      log.info('queue error: ', err);
    })
    .on('disconnected', function() {
      log.info('disconnected from queue');
    }).default();

    //var q = this.queue.queue({ name: RABBITMQ_CHANNEL, durable: true });
  }

  get_stat(){
    return new Promise((resolve) => {
      this.db.run("select count(*) from items", (err,stat) => {
        resolve(stat, err);
      });
    }).then((response, error) => {
      return response[0];
    });
  }

  get_random(){
    return new Promise((resolve) => {
      this.db.run(`
          SELECT *
          FROM items
          WHERE itunes->'similarity' > '0.52' OR deezer->'similarity' > '0.52'
          ORDER BY random()
          LIMIT 1
      `, (err,stat) => {
        resolve(stat, err);
      });
    }).then((response, error) => {
      return response;
    });
  }

  get_random_blogspot_urls(limit){
    limit || (limit = 10);
    return new Promise((resolve) => {
      this.db.run(`select url from items where sh_type='BlogPostItem' order by random() limit ${limit}`, (err,stat) => {
        resolve(stat, err);
      });
    }).then((response, error) => {
      return response.map((item) => url.resolve(item.url, '/'));
    });
  }

  get_by_id(item_id){
    return new Promise((resolve) => {
      this.db.run(`select * from items where id=${item_id}`, (err,stat) => {
        resolve(stat, err);
      });
    }).then((response, error) => {
      return response;
    });
  }

  get_tags(){
    return new Promise((resolve) => {
      this.db.run("select tags from items", (err,stat) => {
        resolve(stat, err);
      });
    }).then((response, error) => {
      return  _.reduce(response, (result, item) => {
        _.each(item['tags'], (value) => {
          result[value] = result[value] || 0;
          result[value]++;
        });
        return result;
      }, {});
    });
  }

  get_by_tags(tags){
    return new Promise((resolve) => {
      var tags_str = _.map(tags, tag => `'${tag}'`).join(', ')
      var query = `SELECT * FROM items WHERE tags ?| array[${tags_str}]`;
      this.db.run(query, (err,items) => {
        resolve(items, err);
      });
    }).then((response, error) => {
      return response;
    });
  }

  get_by_tag(tag){
    return new Promise((resolve) => {
      var query = `SELECT array_to_json(ARRAY(
          SELECT id
          FROM items
          WHERE lower(tags::text) LIKE '%${tag.toLowerCase()}%'
          ORDER BY random()
      )) as ids`;
      this.db.run(query, (err,items) => {
        resolve(items, err);
      });
    }).then((response, error) => {
      return response[0].ids;
    });
  }

  autocomplete_search(search_query){
    return new Promise((resolve) => {
      var query = `
        SELECT json_build_object(
            'items', ARRAY(
              SELECT json_build_object('id', id, 'title',title,'image',images->0)
              FROM items
              WHERE lower(title) LIKE '%${search_query.toLowerCase()}%' ORDER BY title
            ),
            'tags_count', (
              SELECT COUNT(id)
              FROM items
              WHERE tags @> '["${search_query}"]'::jsonb
            )
        ) as object
      `;
      this.db.run(query, (err,items) => {
        resolve(items, err);
      });
    }).then((response, error) => {
      return response[0].object;
    });
  }

  get_discogs_info(discogs_object){
    return new Promise((resolve) => {
      var url = `${discogs_object.resource_url}?token=${DISCOGS_TOKEN}`;
      request({
        url: url,
        headers: {
          'User-Agent': 'request'
        }
      })((error, response) => resolve(response, error));
    }).then((response, error) => {
      return response.body;
    });
  }

  search(params){
    let tags_str = _.map([].concat(params.tags || []), tag => `"${tag}"`).join(', ')
    let limit = params.limit || 6;
    let offset = params.offset || 0;
    let criteria = (params.tags && params.tags.length) ? `tags @> '[${tags_str}]'::jsonb` : `
      (discogs->'thumb') IS NOT NULL AND
      (spotify->'similarity' = '1' OR deezer->'similarity' = '1' OR itunes->'similarity' = '1')
    `;
    return new Promise((resolve) => {
      this.db.run(`
        SELECT *
        FROM items
        WHERE
          ${criteria}
        ORDER BY id DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `, (err,stat) => {
        resolve(stat, err);
      });
    }).then((response, error) => {
      return response;
    });
  }

  //user
  get_user_by_email(email){
    return new Promise((resolve) => {
      var query = `
        SELECT * FROM ${USERS_TABLE} WHERE email = '${email}' LIMIT 1
      `;
      this.db.run(query, (err,items) => {
        resolve(items, err);
      });
    }).then((response, error) => {
      return (response || [null])[0];
    });
  }

  create_user(user){
    return new Promise((resolve) => {
      var query = `
        INSERT INTO ${USERS_TABLE}
          (email, first_name, last_name)
        VALUES
          ('${user.email}', '${user.first_name}', '${user.last_name}')
      `;
      this.db.run(query, (err,items) => {
        resolve(items, err);
      });
    }).then((response, error) => {
      return user;
    });
  }

  //upload post
  add_post(item){
    return new Promise((resolve) => {
      this.queue
        .publish(item, { key: RABBITMQ_CHANNEL })
        .on('drain', () => resolve(true));
    }).then(() => {
      log.info(`${item.crawler_name} crawler item #${item.sh_key} added to queue`);
      return ["in_process", item['badges']];
    });
  }
}

module.exports = Store;
