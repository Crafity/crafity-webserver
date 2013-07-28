/*jslint node:true, unparam: true, maxerr: 50, white: true */
"use strict";
/*!
 * crafity-webserver - Generic Webserver Configuration
 * Copyright(c) 2010-2013 Crafity
 * Copyright(c) 2010-2013 Bart Riemens
 * Copyright(c) 2010-2013 Galina Slavova
 * MIT Licensed
 */

/**
 * Module dependencies.
 */


/**
 * Initialize module
 */

/**
 * Module name.
 */

module.exports.fullname = 'crafity.Cache';

/**
 * Module version.
 */

module.exports.version = '0.0.1';

/**
 *
 * @param onfinish
 */

function Cache(disabled) {
  var cache = {};

  this.register = function (name, func) {
    if (cache[name] !== null && cache[name] !== undefined) {
      throw new Error("Already registered the key '" + name + "' with this cache");
    }
    cache[name] = {
      name: name,
      func: func,
      data: null,
      err: null,
      ready: false,
      loading: false,
      handlers: []
    };
  };
  this.has = function (name) {
    return cache[name];
  };
  this.get = function (name, callback) {
    var cacheEntry = cache[name];
    if (!cacheEntry) {
      return callback(new Error("The key '" + name + "' is not registered with this cache"));
    }
    if (cacheEntry.ready) {
      return callback(cacheEntry.err, cacheEntry.data);
    } else if (cacheEntry.loading) {
      cacheEntry.handlers.push(callback);
    }
    cacheEntry.loading = true;
    cacheEntry.handlers.push(callback);
    try {
      cacheEntry.func(cacheEntry.name, function (err, data, ignore) {
        cacheEntry.err = err;
        if (!disabled && !ignore) {
          cacheEntry.data = data;
          cacheEntry.ready = true;
        }
        cacheEntry.loading = false;
        cacheEntry.handlers.forEach(function (handler) {
          handler(err, data);
        });
        cacheEntry.handlers = [];
      });
    } catch (err) {
      cacheEntry.err = err;
      cacheEntry.data = null;
      cacheEntry.ready = true;
      cacheEntry.loading = false;
      cacheEntry.handlers.forEach(function (handler) {
        handler(err, null);
      });
      cacheEntry.handlers = [];
    }

  };
}

module.exports = Cache;
module.exports.Cache = Cache;
