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
    const response = await dbClient.query(`
      WITH tags AS (
	SELECT DISTINCT jsonb_array_elements_text(tags)
	FROM items
      )
      SELECT json_build_object(
              'total_releases', (SELECT count(title) FROM items),
              'unique_releases', (SELECT count(DISTINCT title) FROM items),
              'unique_tags', (SELECT count(*) FROM tags)
      ) AS object
    `);
    return response[0].object;
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

  async getTags({ limit = 10, offset = 0 }) {
    const response = await dbClient.query(`
      WITH tags AS (
	SELECT jsonb_array_elements_text(tags) AS tag
	FROM items
      )
      SELECT tag, count(tag) as count
      FROM tags
      GROUP BY tag
      ORDER BY count DESC
      LIMIT ${limit}
      OFFSET ${offset}
      `);
    return response;
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

  async getBestReleases(params) {
    let tags_str = _.map([].concat(params.tags || []), tag => `"${tag}"`).join(', ')
    let limit = params.limit || 6;
    let offset = params.offset || 0;
    let criteria = (params.tags && params.tags.length) ? `tags @> '[${tags_str}]'::jsonb` : `
      (discogs->'thumb') IS NOT NULL
    `;
    const response = await dbClient.query(`
        SELECT *
        FROM items
        WHERE (discogs -> 'thumb') IS NOT NULL
                AND discogs -> 'similarity' = '1'
                AND spotify -> 'similarity' = '1'
                AND deezer -> 'similarity' = '1'
                AND(embed::text LIKE '%soundcloud%'
                        OR embed::text LIKE '%bandcamp%')
        ORDER BY id DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);
    return response;
  }

  async getSimilarRelease(id) {
    const response = await dbClient.query(`
        WITH target_tags AS (
          SELECT
            tags AS ttags,
            title AS ttitle,
            id AS tid,
            CASE WHEN jsonb_array_length(tags) > 3 THEN
                    3
            ELSE
                    1 END AS ttags_length
          FROM items
          WHERE id = ${id}
        ), result AS (
          SELECT items.*
          FROM items, target_tags
          WHERE id != target_tags.tid
            AND title != target_tags.ttitle
            AND tags ?| ARRAY(SELECT jsonb_array_elements_text(target_tags.ttags))
            AND cardinality (ARRAY (
                            SELECT jsonb_array_elements_text(target_tags.ttags)
                            INTERSECT
                            SELECT jsonb_array_elements_text(tags))) >= ttags_length
        )
        SELECT *
        FROM result
        LIMIT 3
      `);
    return response;
  }

  async getReleasesShort({ limit = 10, offset = 0 }) {
    const response = await dbClient.query(`
      WITH results AS (
	SELECT DISTINCT ON (title) title, id
	FROM items
      )
      SELECT *
      FROM results
      ORDER BY id
      LIMIT ${limit}
      OFFSET ${offset}
    `);
    return response;
  }


}

module.exports = new Store();
