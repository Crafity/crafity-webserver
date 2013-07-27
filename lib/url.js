/*jslint node:true, unparam: true, maxerr: 50, white: true */
"use strict";
/*!
 * crafity-webserver - Standard URL Functionality
 * Copyright(c) 2010-2013 Crafity
 * Copyright(c) 2010-2013 Bart Riemens
 * Copyright(c) 2010-2013 Galina Slavova
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

module.exports = require('url');

/**
 * Initialize module
 */
var url = module.exports;

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
  }
  if (typeof uri === "string") {
    var pathPieces = uri.split('/');
    if (pathPieces[pathPieces.length - 1].match(/\.|\*|\?/)
      || (!pathPieces[pathPieces.length - 1])) {
      pathPieces.splice(pathPieces.length - 1, 1);
    }

    if (pathPieces.length === 1) {
      pathPieces.push("");
    }
    return pathPieces.join("/");
  }
  throw new Error("Invalid uri");
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
