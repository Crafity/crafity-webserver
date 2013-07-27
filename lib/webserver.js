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
  , configuration = require('crafity-config')
  , resources = require('crafity-resources')
  , core = require('crafity-core')

  , Synchronizer = core.Synchronizer
  , Event = core.Event
  , objects = core.objects

  , fileServer = require('./fileserver')
  , stylusFileFilter = require("./fileserver.stylus")
  , auth = require('./auth')
  , oauth = require('./oauth')
  , assests = require('./assests')
  , State = require('./State')
  , Encoder = require('./encoder').Encoder
  , flash = require('./flash')

  , express = require('express')
  , httpProxy = require('http-proxy')
  , gzip = require('crafity-gzip')
  , RedisStore = require('connect-redis')(express)
  , stylus = require('stylus')
  , validator = require('validator')
  , util = require('util')
  , nib = require('nib')
  , url = require('url');

/**
 * Framework name.
 */
exports.fullname = 'crafity-webserver';

function log(req, res, err) {
  console.log(
    "\u001b[37mClient: \u001b[32m" + req.client.remoteAddress + ":" + req.client.remotePort +
      ", \u001b[37mMethod: \u001b[35m" + req.method + "\u001b[39m" +
      ", \u001b[37mHost: \u001b[35m" + req.headers.host + "\u001b[39m" +
      ", \u001b[37mUrl: \u001b[35m" + req.url + "\u001b[39m" +
      ", \u001b[37mStatusCode: \u001b[35m" + (res.statusCode || "?") + "\u001b[39m" +
      (req.headers && req.headers.referer ? ", \u001b[37mReferer: \u001b[35m" + req.headers.referer + "\u001b[39m" : "") +
      ", \u001b[37mUA: \u001b[33m" + req.headers["user-agent"] + "\u001b[39m" +
      ", \u001b[37mDate: \u001b[33m" + new Date().toString() + "\u001b[39m" +
      (err ? ", \u001b[37merror: \u001b[31m" + err.toString() + (err.stack ? err.stack + "\n" : "") + "\u001b[39m" : ""));
}

function sendError(req, res, err) {
  try {
    if (err.user) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end(err.message);
    }
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    return res.end("Something went wrong! Please inform the owner of this problem.");
  } catch (err1) {
    log(req, res, err1);
    try {
      res.end();
    } catch (err2) {
      return log(req, res, err2);

    }
  }
  return log(req, res, err);
}

/**
 * Module Functionality
 */
exports.createServer = function (config, callback) {

  var app = express.createServer()
    , synchronizer = new Synchronizer()
    , onconfigureEvent = new Event('sync')
    , onlisteningEvent = new Event()
    , onerrorEvent = new Event()
    , urlBuilder = {};

  if (!callback && config instanceof Function) {
    callback = config;
    config = undefined;
  }
  callback = callback || function () {
    return false;
  };

  function configureResources(config, cb) {
    if (config && config.webserver.resources) {
      return resources.configure(config.webserver.resources,
        synchronizer.register("resources", function (err, resources) {
          if (err) { return callback(err); }
          cb(config, resources);
        }));
    }
    return cb(config, null);
  }

  function configureServer(config, resources) {
    config = config || {};

    if (!config.webserver) {
      return callback(null, app);
    }

    if (config.logging) {
      require('crafity-logging').create(config.logging);
    }

    app.config = config;

    app.onconfigure = function (handler) {
      onconfigureEvent.subscribe(handler);
    };

    app.onlistening = function (handler) {
      onlisteningEvent.subscribe(handler);
    };

    app.onerror = function (handler) {
      onerrorEvent.subscribe(handler);
    };

    app.exit = function exit(exitCode) {
      try { app.close(); } catch (ignore) {}
      process.exit(exitCode || 0);
    };
    process.on('SIGTERM', app.exit);
    process.on('SIGHUP', app.exit);

    app.sendError = sendError;

    app.configure(synchronizer.register("config", function () {
      app.use(function (req, res, next) {
        res.setHeader("x-powered-by", "Crafity");
        res.setHeader("x-crafity-location", req.url.replace('?layout=false&', '?').replace('?layout=false', '').replace('&layout=false', ''));
        next();
      });
      app.use(express.favicon(process.cwd() + (config.webserver.favicon || '/static/favicon.ico')));

      app.use(function (req, res, next) {
        try {
          var writeHead = res.writeHead
            , end = res.end;
          res.writeHead = function (statusCode) {
            if (typeof statusCode === 'number') {
              res.statusCode = statusCode;
            }
            writeHead.apply(res, arguments);
          };
          res.end = function (statusCode) {
            if (typeof statusCode === 'number') {
              res.statusCode = statusCode;
            }
            log(req, res);
            end.apply(res, arguments);
          };
        } catch (err) {
          console.log("err", err);
        }
        next();
      });

      if (config.webserver.views) {
        console.log("Using Body Parser");
        app.use(express.bodyParser());
      }
      if (config.webserver.cookies || config.webserver.cookies === undefined) {
        console.log("Using Cookies");
        app.use(express.cookieParser());
      }
      if (config.webserver.session) {
        console.log("Using Session");
        app.use(express.session({
          secret: config.webserver.session.secret,
          store: new RedisStore({ "db": config.webserver.session.db }),
          cookie: { maxAge: new Date(new Date().setMinutes(new Date().getMinutes() + config.webserver.session.timeout || 240)) }
        }));
        express.session.ignore.push('/favicon.ico');
        express.session.ignore.push('/robots.txt');
        app.use(flash.middleware());
      }
      if (config.webserver.resources) {
        console.log("Using Resources");
        app.resources = resources;
        app.use(resources.resourceParser());
      }
      if (config.webserver.oauth) {
        console.log("Using OAuth");
        app.auth = auth.init(app);
        app.oauth = oauth.init(app);
      }
      console.log("Using GZip");
      app.use(gzip.gzip());

      app.use(express.errorHandler({
        dumpExceptions: config.webserver.dumpExceptions,
        showStack: config.webserver.showStack
      }));

      function extend(name, fn) {
        app[name] = function () {
          var args = Array.prototype.slice.call(arguments)
            , handler = args.pop();

          function replacementHandler(req, res) {
            //log(req, null);

            (function render(renderfn) {
              res.render = function () {
                var innerArgs = Array.prototype.slice.call(arguments)
                  , defaultOptions = {}
                  , options = innerArgs.length > 1 ? innerArgs.pop() : {}
                  , result;

                if (req.query && req.query.layout) {
                  req.query.layout = [].concat(req.query.layout)
                    .reduce(function (first, next) {
                      return first || next;
                    });
                }

                defaultOptions.url = req.url;
                defaultOptions.returnUrl = req.returnUrl;
                defaultOptions.locations = config.webserver && config.webserver.locations;
                defaultOptions.config = app.config;
                defaultOptions.flash = req.flash && req.flash.getMessages && req.flash.getMessages();
                defaultOptions.useLayout = req.query && req.query.layout !== "false";
                defaultOptions.auth = req.auth;
                defaultOptions.currentProfile = req.auth && req.auth.currentProfile;
//								defaultOptions.session = req.session;
//								defaultOptions.customFlash = false;
                //defaultOptions.details = req.query && req.query.details !== "false";
                //defaultOptions.summary = req.query && req.query.summary === "true";
                //defaultOptions.createUrl = req.createUrl;
                //defaultOptions.createUrlState = req.createUrlState;
                //defaultOptions.getUrlParam = req.getUrlParam;

                if (req.query["return"]) {
                  defaultOptions.currentUrl = req.url.replace("?return=" + req.query["return"], "?").replace("&return=" + req.query["return"], "")
                    .replace("?layout=" + req.query.layout, "?").replace("&layout=" + req.query.layout, ""); //.replace('?', encodeURIComponent("?")).replace('&', encodeURIComponent("&"));
                  defaultOptions.currentUrl = defaultOptions.currentUrl.replace("?layout=false", "?").replace("&layout=false", "");
                } else {
                  defaultOptions.currentUrl = req.url.replace("?layout=" + req.query.layout, "?").replace("&layout=" + req.query.layout, ""); //.replace('?', encodeURIComponent("?")).replace('&', encodeURIComponent("&"));
                }
                if (defaultOptions.currentUrl.match(/\?$/)) {
                  defaultOptions.currentUrl = defaultOptions.currentUrl.substr(0, defaultOptions.currentUrl.length - 1);
                }
                if (config.webserver.views && config.webserver.views.layouts &&
                  config.webserver.views.layouts.content && req.query.layout === 'false') {
                  defaultOptions.layout = config.webserver.views.layouts.content;
                }

                options = objects.extend(defaultOptions, options);

                result = renderfn.apply(res, innerArgs.concat(options));
                if (req.flash.empty) { req.flash.empty(); }
                return result;
              };
            }(res.render));

            (function redirect(redirectfn) {
              res.redirect = function (url) {

                if (req.query.layout && !url.match(/(\?|&){1}layout=/)) {
                  url += (url.indexOf("?") > -1 ? "&" : "?") + "layout=" + req.query.layout;
                }

                return redirectfn.call(res, url);
              };
            }(res.redirect));

            req.session = req.session || {};
            req.resources = req.resources || {};
            req.unsafeParams = req.params;
            req.returnUrl = decodeURIComponent(
              (req.query && req.query["return"]) ||
                (req.headers && req.headers.referrer) ||
                "");

            req.params = {};
            Object.keys(req.unsafeParams).forEach(function (key) {
              if (req.unsafeParams.hasOwnProperty(key)) {
                req.params[key] = req.unsafeParams[key] && app.sanitizeInput(req.unsafeParams[key]);
              }
            });
            req.unsafeBody = req.body;
            req.body = {};
            if (req.unsafeBody) {
              Object.keys(req.unsafeBody).forEach(function (key) {
                if (req.unsafeBody.hasOwnProperty(key)) {
                  req.body[key] = app.sanitizeInput(req.unsafeBody[key]);
                }
              });
            }
            req.state = new State(req);
            req.createUrl = urlBuilder.create(req);
            req.createUrlState = urlBuilder.createUrlState(req);
            req.getUrlParam = urlBuilder.getParam(req);
            res.catchError = function (callback) {
              return function (err) {
                if (err) {
                  return app.sendError(req, res, err);
                }
                try {
                  return callback.apply(callback, arguments);
                } catch (err2) {
                  return app.sendError(req, res, err2);
                }

              };
            };
            try {
              return handler.apply(app, arguments);
            } catch (err) {
              app.sendError(req, res, err);
            }
          }

          fn.apply(app, args.concat(replacementHandler));

        };
      }

      ["get", "post", "all"].forEach(function (name) {
        extend(name, app[name]);
      });

      if (config.webserver.views) {
        console.log("Using View Engine");
        app.set('views', process.cwd() + config.webserver.views.path);
        app.set('view engine', config.webserver.views.engine);
        if (config.webserver.views.layouts && config.webserver.views.layouts["default"]) {
          app.set('view options', { layout: config.webserver.views.layouts["default"] });
        }
        if (config.webserver.views.cached) {
          app.enable('view cache');
        }
        if (!config.webserver.views.compress) {
          app.set('view options', {pretty: true});
        }
      }

      if (app.config.webserver.assests) {
        console.log("Using Assets compression and concatenation");
        app.use(assests.assests(app.config.webserver.assests));
      }

      app.use(app.router);

    }));
  }

  if (config) {
    configureResources(config, configureServer);
  } else {
    configuration.open(synchronizer.register(function (err, config) {
      if (err) { return callback(err); }
      configureResources(config, configureServer);
    }));
  }

  (function createUrlBuilder() {
    urlBuilder.create = function (req) {
      return function (args) {
        var url = "", innerKey, options = {}, lastOption, i;

        function processArguments(key) {
          var j;

          if (!arguments.length) { return; }
          if (arguments.length > 1) {
            innerKey = key;
            options[innerKey] = {};
            lastOption = options[innerKey];

            for (j = 1; j < arguments.length; j += 1) {
              if (j === arguments.length - 1) {
                lastOption[innerKey] = arguments[j];
              } else {
                innerKey = arguments[j];
                lastOption[innerKey] = {};
              }
            }
          } else {
            objects.merge(options, key);
          }

        }

        if (arguments.length && args instanceof Array) {
          for (i = 0; i < arguments.length; i += 1) {
            processArguments.apply(this, [].concat(arguments[i]));
          }
        } else {
          processArguments.apply(this, arguments);
        }

        Object.keys(req.query).forEach(function (key) {
          if (key.toString().toLowerCase() === "delta") { return; }
          var value = req.query[key];
          if (!options[key]) {
            url += (url.length ? "&" : "") + key + (value ? "=" + value : "");
          } else {
            if (typeof value === 'string') {
              return '"' + value + '"';
            }
            value = req.query[key] ? JSON.parse(decodeURIComponent(req.query[key])) : {};
            value = core.objects.merge(value, options[key]);
            if (value) {
              value = JSON.stringify(value);
              url += (url.length ? "&" : "") + key + (value ? "=" + value : "");
            }
            options[key] = undefined;
          }
        });
        Object.keys(options).forEach(function (key) {
          if (options[key] === undefined) { return; }
          url += (url.length ? "&" : "") + key + (options[key] ? "=" + JSON.stringify(options[key]) : "");
        });
        return url.length ? "/?" + url : url;
      };
    };

    urlBuilder.createUrlState = function (req) {
      return function (args) {
        var url = "", innerKey, options = {}, lastOption, i;

        function processArguments(key) {
          var j;
          if (!arguments.length) { return false; }
          if (arguments.length > 1) {
            innerKey = key;
            options[innerKey] = {};
            lastOption = options[innerKey];

            for (j = 1; j < arguments.length; j += 1) {
              if (j === arguments.length - 1) {
                lastOption[innerKey] = arguments[j];
              } else {
                innerKey = arguments[j];
                lastOption[innerKey] = {};
              }
            }
          } else {
            objects.merge(options, key);
          }

        }

        if (arguments.length && args instanceof Array) {
          for (i = 0; i < arguments.length; i += 1) {
            processArguments.apply(this, [].concat(arguments[i]));
          }
        } else {
          processArguments.apply(this, arguments);
        }

        Object.keys(req.query).forEach(function (key) {
          if (key.toString().toLowerCase() === "delta") { return; }
          var value = req.query[key];
          if (!options[key]) {
            url += (url.length ? "&" : "") + key + (value ? "=" + value : "");
          } else {
            if (typeof value === 'string') {
              value = '"' + value + '"';
            } else {
              value = req.query[key] ? JSON.parse(decodeURIComponent(req.query[key])) : {};
              value = core.objects.merge(value, options[key]);
            }
            if (value) {
              value = JSON.stringify(value);
              url += (url.length ? "&" : "") + key + (value ? "=" + value : "");
            }
            options[key] = undefined;
          }
        });
        Object.keys(options).forEach(function (key) {
          if (options[key] === undefined) { return; }
          url += (url.length ? "&" : "") + key + (options[key] ? "=" + JSON.stringify(options[key]) : "");
        });
        return "?" + url;
      };
    };

    urlBuilder.getParam = function (req) {
      return function (name) {
        if (req.query[name]) {
          var value = req.query[name];

          if (typeof value === 'string') {
            return value;
          }
          return (req.query[name] && JSON.parse(decodeURIComponent(req.query[name].toString()))) || undefined;
        }
        return undefined;
      };
    };
  }());

  app.validator = validator;
  app.Encoder = Encoder;
  app.url = url;
  app.Synchronizer = Synchronizer;

  app.sanitizeInput = function (input) {
    //Example: '<a>' => decode => '&lt;a&gt;'
    return validator.sanitize(validator.sanitize(input).xss()).entityEncode();
  };

  synchronizer.onfinish(function (err) {
    if (err) { return callback(err); }
    var appConfig = app.config
      , retryCount = 3;

    function listen() {
      try {
        console.log("Opening '\u001b[37mhttp://" + app.config.webserver.ip + ":" + app.config.webserver.port + "\u001b[39m'");
        app.listen(appConfig.webserver.port, appConfig.webserver.ip);
        console.log("Listening on '\u001b[36mhttp://" + app.config.webserver.ip + ":" + app.config.webserver.port + "\u001b[39m' for requests");
        onlisteningEvent.raise();
      } catch (err) {
        if (err.code === "EADDRINUSE" && retryCount > 1) {
          retryCount -= 1;
          console.log("\u001b[31mPort '\u001b[36m" + app.config.webserver.port + "\u001b[31m' is in use. Retry '\u001b[36m" + retryCount + "\u001b[31m' in 2 sec.\u001b[39m");
          setTimeout(listen, 2000);
        } else {
          throw err;
        }
      }
    }
    
    try {
      callback(null, app);

      onconfigureEvent.raise(app);

      if (app.config.webserver.controllers) {
        console.log("Using Controllers");
        (function () {
          var path = app.config.webserver.controllers.path || "/controllers"
            , order = app.config.webserver.controllers.order || ["*"];

          function loadController(filename) {
            try {
              require(fs.combine(process.cwd(), path, filename)).init(app);
              console.log("Controller '" + filename + "' loaded sucessfully.");
            } catch (err) {
              console.error("Error loading controller", filename, err.stack, err);
              throw err;
            }
          }

          fs.getAllFiles(fs.combine(process.cwd(), path), "*.js", function (err, files) {
            files = files.sort();
            var orderEntry = order.shift(), untilFile, index;

            while (orderEntry) {
              if (orderEntry === "*") {
                untilFile = order.length > 0 ? order[0] : undefined;

                while (files.length &&
                  files[0] !== untilFile + ".js") {
                  loadController(files.shift());
                }

              } else {
                for (index = 0; index < files.length; index += 1) {
                  if (orderEntry + ".js" === files[index]) {
                    loadController(files[index]);
                    files.splice(index, 1);
                    orderEntry = undefined;
                  }
                }
                if (orderEntry) { throw new Error("Unable to find registered controller '" + orderEntry + "'"); }
              }
              orderEntry = order.shift();
            }

          });
        }());
      }

      if (app.config.webserver.stylus) {
        console.log("Using Stylus");
        app.use(stylus.middleware({
          debug: app.config.webserver.stylus.debug,
          force: app.config.webserver.stylus.force,
          src: process.cwd() + app.config.webserver.stylus.src,
          dest: process.cwd() + app.config.webserver.stylus.dest,
          compile: function compile(str, path) {
            console.log("\u001b[31mCOMPILING CSS\u001b[39m", path);
            return stylus(str)
              .set('filename', path)
              .set('compress', app.config.webserver.stylus.compress || false)
              .use(nib());
          }
        }));
      }

      if (app.config.webserver.fileserver) {
        console.log("Using Static File Server");
        fileServer
          .createServer(app)
          .configure(app.config.webserver.fileserver)
          .register(stylusFileFilter);
      }

      if (app.config.webserver.autolisten && app.config.webserver.ip && app.config.webserver.port) {
        listen();
      }

    } catch (err1) {
      return onerrorEvent.raise(err1);
    }
  });

};

exports.createProxy = function (config, callback) {
  if (!callback && config instanceof Function) {
    callback = config;
    config = undefined;
  }
  callback = callback || function () {
    return false;
  };

  function configureProxy(err, config) {
    if (err) { return callback(err); }

    if (!config.proxyserver) {
      return callback(null, null);
    }

    if (config.logging) {
      require('crafity-logging').create(config.logging);
    }

    var proxyConfig = config.proxyserver.proxy
      , onerrorEvent = new Event()
      , onmissingRouteEvent = new Event('sync')
      , onredirectEvent = new Event('sync')
      , app
      , retryCount = 3;

    objects.forEach(proxyConfig, function (value, name) {
      proxyConfig[name.toLowerCase()] = value;
    });

    app = httpProxy.createServer(function (req, res, proxy) {
      var writeHead = res.writeHead
        , end = res.end
        , route;
      
      try {
        try {
          res.writeHead = function (statusCode) {
            if (typeof statusCode === 'number') {
              res.statusCode = statusCode;
            }
            writeHead.apply(res, arguments);
          };
          res.end = function (statusCode) {
            if (typeof statusCode === 'number') {
              res.statusCode = statusCode;
            }
            log(req, res);
            end.apply(res, arguments);
          };
        } catch (err) {
          console.log("err", err);
        }

        req.headers.host = req.headers.host || "";
        route = proxyConfig[req.headers.host.toLowerCase()];
        if (!route) {
          onmissingRouteEvent.raise(req, res, proxy);
          res.writeHead(404);
          log(req, res, "Route not found!");
          return res.end();
        }
        if (route.redirect) {
          if (!route.redirect.url) {
            throw new Error("Redirect url is not specified for this route");
          }
          res.writeHead(302, { location: route.redirect.url + req.url });
          return res.end();
        }
        onredirectEvent.raise(req, res, proxy, route);
        if (/(^\/\?\_escaped\_fragment\_\=){1}/i.test(req.url)) {
          req.url = req.url.replace("/?_escaped_fragment_=", "");
        }
        proxy.proxyRequest(req, res, {
          host: route.ip,
          port: route.port
        });

      } catch (err1) {
        return app.sendError(req, res, err1);
      }
    });

    app.sendError = sendError;

    app.config = config;

    app.onerror = function (handler) {
      onerrorEvent.subscribe(handler);
    };

    app.onmissingRoute = function (handler) {
      onmissingRouteEvent.subscribe(handler);
    };

    app.onredirect = function (handler) {
      onredirectEvent.subscribe(handler);
    };

    app.exit = function exit(exitCode) {
      try { app.close(); } catch (ignore) {}
      process.exit(exitCode || 0);
    };
    process.on('SIGTERM', app.exit);
    process.on('SIGHUP', app.exit);

    try {
      callback(null, app);
    } catch (err1) {
      return onerrorEvent.raise(err1);
    }

    function listen() {
      try {
        console.log("Opening '\u001b[36mhttp://" + app.config.proxyserver.ip + ":" + app.config.proxyserver.port + "\u001b[39m'");
        app.listen(config.proxyserver.port, config.proxyserver.ip);
        console.log("Listening on '\u001b[37mhttp://" + app.config.proxyserver.ip + ":" + app.config.proxyserver.port + "\u001b[39m' for requests");
      } catch (err) {
        if (err.code === "EADDRINUSE" && retryCount > 1) {
          retryCount -= 1;
          console.log("\u001b[31mPort '\u001b[36m" + app.config.proxyserver.port + "\u001b[31m' is in use. Retry '\u001b[36m" + retryCount + "\u001b[31m' in 2 sec.\u001b[39m");
          setTimeout(listen, 2000);
        } else {
          throw err;
        }
      }
    }

    if (app.config.proxyserver.autolisten && app.config.proxyserver.ip && app.config.proxyserver.port) {
      listen();
    }

  }

  if (config) {
    configureProxy(null, config);
  } else {
    configuration.open(function (err, config) {
      configureProxy(err, config);
    });
  }

};
