/*global module*/
/*!
 * crafity.Cache - Cache Aync Information
 * Copyright(c) 2011 Crafity
 * Copyright(c) 2011 Bart Riemens
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

module.exports = function Cache(disabled) {
  var cache = {};

  this.register = function (name, func) {
    if (cache[name] != null) {
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
      throw new Error("The key '" + name + "' is not registered with this cache");
    } else {
      if (cacheEntry.ready) {
        callback(cacheEntry.err, cacheEntry.data);
      } else if (cacheEntry.loading) {
        cacheEntry.handlers.push(callback);
      } else {
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
      }
    }
  };
};

module.exports.Cache = module.Cache;
