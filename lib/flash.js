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

exports.middleware = function () {
  return function (req, res, next) {
    function getSession() {
      if (!req.session) {
        throw new Error("Session middleware is required in order for flash messages to work " + req.url);
      }
      req.session.flash = req.session.flash || { messsages: [] };
      req.session.flash.messages = req.session.flash.messages || [];
      return req.session;
    }

    req.flash = {
      info: function (message) {
        getSession().flash.messages.push({ type: "info", message: message});
        return req.flash;
      },
      warning: function (message) {
        getSession().flash.messages.push({ type: "warning", message: message});
        return req.flash;
      },
      error: function (message) {
        getSession().flash.messages.push({ type: "error", message: message});
        return req.flash;
      },
      hasMessages: function () {
        return getSession().flash.messages.length > 0;
      },
      getMessages: function () {
        return (getSession().flash && req.session.flash.messages) || [];
      },
      empty: function () {
        getSession().flash.messages = [];
        return req.flash;
      }
    };
    next();
  };
};
