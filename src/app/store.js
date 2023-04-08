"use strict"

const request = require('koa-request');
const _ = require('lodash');
const log = require('log-colors');
const dbClient = require('../lib/clients/asyncDb');

const DISCOGS_TOKEN = process.env['DISCOGS_TOKEN'];

//local workaround for queue drain listeners
if (process.env['NODE_ENV'] !== 'production') {
  require('events').EventEmitter.defaultMaxListeners = 100;
}


class Store {

  async getStat() {
    const response = await dbClient.query(`select count(id) from items`);
    return response[0];
  }

  async getRandomRelease() {
    const response = await dbClient.query(`
      SELECT id
      FROM items
      WHERE itunes->'similarity' = '1' OR deezer->'similarity' = '1' OR spotify->'similarity' = '1'
      ORDER BY random()
      LIMIT 1
    `);
    return response[0];
  }

  async getReleaseById(item_id) {
    const response = await dbClient.query(`select * from items where id=${item_id}`);
    return response[0];
  }

  //@deprecated
  async getTags() {
    const response = await dbClient.query(`select tags from items`);
    return _.reduce(response, (result, item) => {
      _.each(item['tags'], (value) => {
        result[value] = result[value] || 0;
        result[value]++;
      });
      return result;
    }, {});
  }

  async getAutocomplete(search_query) {
    const response = await dbClient.query(`
      WITH search_results AS (
	SELECT DISTINCT ON (title)
		title,
		id
	FROM items
	WHERE lower(title) LIKE '%${search_query.toLowerCase()}%'
	ORDER BY title
      ), tags_count AS (
	SELECT COUNT(id) AS count
	FROM items
	WHERE tags @> '["${search_query}"]'::jsonb
      )
      SELECT
	json_build_object(
          'items', ARRAY (
			SELECT
                          json_build_object('id', id, 'title', title)
                        FROM search_results
          ),
          'tags_count', (SELECT count FROM tags_count)
        ) AS object
    `);
    return response[0].object;
  }

  async getDiscogsInfo(discogs_object) {
    const response = await new Promise((resolve) => {
      var url = `${discogs_object.resource_url}?token=${DISCOGS_TOKEN}`;
      request({
        url: url,
        headers: {
          'User-Agent': 'request'
        }
      })((error, response) => resolve(response, error));
    });
    return response.body
  }

  async getReleases(params) {
    let tags_str = _.map([].concat(params.tags || []), tag => `"${tag}"`).join(', ')
    let limit = params.limit || 6;
    let offset = params.offset || 0;
    let criteria = (params.tags && params.tags.length) ? `tags @> '[${tags_str}]'::jsonb` : `
      (discogs->'thumb') IS NOT NULL
    `;
    const response = await dbClient.query(`
        SELECT *
        FROM items
        WHERE
          ${criteria}
        ORDER BY id DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);
    return response;
  }

}

module.exports = new Store();
