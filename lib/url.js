/*!
 * crafity.webserver - Url Helper
 * Copyright(c) 2011 Crafity
 * Copyright(c) 2011 Bart Riemens
 * Copyright(c) 2011 Galina Slavova
 * MIT Licensed
 */
"use strict";

/**
 * Module dependencies.
 */

var urlExternal = require('url');

/**
 * Initialize module
 */
var url = exports = module.exports = urlExternal;

/**
 * Module name.
 */

exports.fullname = 'crafity.url';

/**
 * Module version.
 */

exports.version = '0.0.1';

/**
 *
 * @param server
 */

url.path = function (uri) {
  if (!uri) {
    return "";
  } else if (typeof uri === "string") {
    var pathPieces = uri.split('/');
    if (pathPieces[pathPieces.length - 1].match(/\.|\*|\?/)
      || (!pathPieces[pathPieces.length - 1])) {
      pathPieces.splice(pathPieces.length - 1, 1);
    }

    if (pathPieces.length === 1) {
      pathPieces.push("");
    }
    return pathPieces.join("/");
  } else {
    throw new Error("Invalid uri");
  }
};

//console.log("---");
//console.log(url.path(""), "");
//console.log(url.path("/test.js"), "/test.js");
//console.log(url.path("test.js"), "test.js");
//console.log(url.path("/test"), "/test");
//console.log(url.path("/test?test=123"), "/test?test=123");
//console.log(url.path("/test/"), "/test/");
//console.log(url.path("/test/?test=123"), "/test/?test=123");
//console.log(url.path("/test/*"), "/test/*");
//console.log(url.path("/test/*.*"), "/test/*.*");
//console.log(url.path("/test/test.js"), "/test/test.js");
//console.log(url.path("/test/test.js?test=123"), "/test/test.js?test=123");
