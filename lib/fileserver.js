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

var fs = require('crafity-filesystem')
  , core = require('crafity-core')
  , Synchronizer = core.Synchronizer
  , Cache = require('./Cache')
  , urlParser = require('./url')
  , mime = require('mime')
  ;

/**
 * Initialize module
 */
module.exports = {};

function getFileHandler(url, directories) {

  return function (key, callback) {

    function scanDirectories(directories) {
      var directory = directories.shift()
        , virtualPath = directory.url
        , physicalPath = directory.path
        , uri = urlParser.parse(url).pathname
        , filename = ""
        , disableCache = !directory.cached;

      if (virtualPath !== "/" && uri.indexOf(virtualPath) === 0) {
        uri = uri.substr(virtualPath.length, uri.length - virtualPath.length);
      }
      uri = (physicalPath || "") + uri;

      filename = fs.combine(process.cwd(), uri).replace(/\%20/gmi, ' ');

      function readFile(err, stat) {

        if (!err && stat) {
          console.error("\u001b[31mLoaded file from disk '" + key + "'\u001b[39m");
          callback(null, {
            url: url,
            statusCode: 200,
            head: {
              "Content-Type": mime.lookup(filename),
              "Last-Modified": new Date().toGMTString(),
              "Cache-Control": "max-age=31536000",
              "Content-Length": stat.size,
              'Access-Control-Allow-Origin': '*'
            },
            filename: filename,
            stat: stat
          }, disableCache);
        } else {
          if (directories.length > 0) {
            scanDirectories(directories);
          } else {
            callback(null, {
              url: url,
              statusCode: 404,
              head: {
                "Content-Type": "text/plain",
                "Last-Modified": new Date().toGMTString(),
                "Cache-Control": "max-age=0",
                "Content-Length": "Resource not found!".length
              }, data: "Resource not found!",
              stat: stat
            }, disableCache);
          }
        }
      }

      if (directory.include && !fs.matchFilePattern(filename, directory.include)) {
        return readFile(null, null);
      }
      if (directory.exclude && fs.matchFilePattern(filename, directory.exclude)) {
        return readFile(null, null);
      }

      fs.stat(filename, readFile);

    }

    scanDirectories(directories.slice());
  };
}

/**
 * A type representing a File Server
 * @param app An existing application to bind to
 */

function FileServer(app) {
  var cache = new Cache();

  this.configure = function (options) {

    if (!options || !options.directories) { return; }

    var filters = []
      , directories = [].concat(options.directories);

    if (directories.length) {

      app.use(function (req, res, next) {
        //return next();

        if (!cache.has(req.url)) {
          cache.register(req.url, getFileHandler(req.url, directories));
        }

        cache.get(req.url, function (err, fileDescriptor) {
          if (err) { return app.sendError(req, res, err); }
          if (fileDescriptor) {
            res.writeHead(fileDescriptor.statusCode, fileDescriptor.head);
            if (fileDescriptor.filename) {
              var readStream = fs.createReadStream(fileDescriptor.filename);
              readStream.on('data', function (data) {
                res.write(data);
              });

              return readStream.on('close', function () {
                res.end();
              });
            }
            return res.end(fileDescriptor.data);
          }
          next();
        });
      });

    }
    return {
      register: function (filter) {
        filters.push(filter);
      }
    };
  };
}

module.exports.FileServer = FileServer;

/**
 * Create an instance of a File Server
 * @param app
 */

module.exports.createServer = function createServer(app) {
  return new FileServer(app);
};

var allPaths = {}
  , cache = {}
  , settings = { cacheEnabled: false };

module.exports.register = function (app, cacheEnabled) {
  /**
   * Serve a static file or folder
   * @param virtualPath The url of the file or folder to serve
   * @param physicalPath The physical path to the static content
   */
  settings.cacheEnabled = !!cacheEnabled || false;

  app.serve = function (virtualPath, include, exclude, physicalPath) {
    //var includes = include.split("|");
    //includes.forEach(function (include) {
    //  app.get(virtualPath + include, exports.create(physicalPath, virtualPath + include));
    //  app.get(virtualPath + include, exports.create(physicalPath, virtualPath));
    //});
    return false;
  };
  return module.exports;
};

module.exports.unregister = function (server) {
  delete server.serve;
};

/**
 * Create a new static file handler
 * @param virtualPath
 * @param physicalPath
 */

function createListener(virtualPath) {

  return function listener(req, res, next) {
    var paths = allPaths[virtualPath].slice();

    function processRequest(paths) {

      var physicalPath = paths.pop()
        , synchronizer = new Synchronizer()
        , uri = urlParser.parse(req.url).pathname
        , filename = "";

      if (virtualPath !== "/" && uri.indexOf(virtualPath) === 0) {
        uri = uri.substr(virtualPath.length, uri.length - virtualPath.length);
      }
      uri = (physicalPath || "") + uri;

      filename = fs.combine(process.cwd(), uri).replace(/\%20/gmi, ' ');

      if (cache[filename]) {
        console.log("\u001b[32mLoaded from Cache '" + filename + "\u001b[39m'");
        if (cache[filename] === 404) {
          res.writeHead(404, {"Content-Type": "text/plain"});
          res.write("Content not found");
          res.end();
        } else {
          if (req.headers["If-Modified-Since"] === cache[filename].since) {
            res.writeHead(304, {
              'Content-Type': mime.lookup(filename),
              'Last-Modified': cache[filename].since,
              //'If-Modified-Since': cache[filename].since,
              "Cache-Control": "max-age=31536000"
            });
            res.end();
          } else {
            res.writeHead(200, {
              'Content-Type': mime.lookup(filename),
              //'If-Modified-Since': cache[filename].since,
              'Last-Modified': cache[filename].since,
              "Cache-Control": "max-age=31536000"
            });
            res.write(cache[filename].data, "binary");
            res.end();
          }
        }
        return;
      }

      if (filename) {
        fs.readFile(filename, "binary", synchronizer.register("file"));
      }

      synchronizer.onfinish(function (err, data) {
        if (err) {
          if (paths.length > 0) {
            processRequest(paths);
          } else if (next) {
            next();
          } else {
            console.log("\u001b[31mStatic file not found '" + filename + "'\u001b[39m");
            cache[filename] = 404;
            res.writeHead(404, {"Content-Type": "text/plain"});
            res.write("Content not found");
            res.end();
          }
          return;
        }
        console.error("\u001b[31mLoaded static file '" + filename + "'\u001b[39m");
        cache[filename] = {
          data: data.file,
          since: new Date().toGMTString()
        };
        res.writeHead(200, {
          'Content-Type': mime.lookup(filename),
          //'If-Modified-Since': cache[filename].since,
          'Last-Modified': cache[filename].since,
          "Cache-Control": "max-age=31536000"
        });
        res.write(data.file, "binary");
        res.end();
        if (!settings.cacheEnabled) { cache[filename] = undefined; }
      });
    }

    processRequest(paths);
  };

}

module.exports.create = function (physicalPaths, virtualPath) {
  virtualPath = urlParser.path(virtualPath);

  if (!allPaths[virtualPath]) {
    allPaths[virtualPath] = [];
  }
  allPaths[virtualPath] = allPaths[virtualPath]
    .concat(physicalPaths instanceof Array ? physicalPaths.reverse() : [physicalPaths]);

  return createListener(virtualPath);
};
