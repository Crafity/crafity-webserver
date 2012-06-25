/*jslint node: true */
/*global console*/
/*!
 * crafity.auth - Authentication / Authorization module
 * Copyright(c) 2011 Crafity
 * Copyright(c) 2011 Bart Riemens
 * Copyright(c) 2011 Galina Slavova
 * MIT Licensed
 */

/**
 * Module dependencies.
 */
var core = require("crafity-core")
	, redis = require("redis")
	, client = redis.createClient();

/**
 * Initialize module
 */

/**
 * Module name.
 */

module.exports.fullname = 'crafity.auth';

/**
 * Module version.
 */

module.exports.version = '0.0.1';

/**
 *
 */

client.on("error", function (err) {
	"use strict";

	console.log("Redis Error " + err);
});

exports.init = function init(app) {
	"use strict";

	var auth = {
		getCurrentProfile: function (req, callback) {
			req.auth.getProfileData(callback);
		},
		secure: function secure(roles) {
			roles = [].concat(roles);
			return function (req, res, next) {
				try {
					req.auth.getCurrentProfile(function (err, profile) {
						if (err) { return res.send(500); }
						if (profile && profile.roles.isCandidate()) {
							req.auth.redirectAfterSignupPath(req.url);
							res.redirect("/signup?return=" + encodeURIComponent(req.url));
						} else if (!profile || core.arrays.intersect(Object.keys(profile.roles()) || [], roles).length === 0) {
							req.auth.redirectAfterLoginPath(req.url);
							res.redirect("/login?return=" + encodeURIComponent(req.url));
						} else {
							next();
						}
					});
				} catch (err) {
					console.log("err", err.stack, err);
					res.send(500);
				}
			};
		}
	};

	app.use(function (req, res, next) {

		if (!req.session) {
			return next();
		}

		req.session.auth = req.session.auth || { errors: [] };

		req.auth = {
			destroy: function () {
				req.session.auth = { errors: [] };
			},

			redirectAfterLoginPath: function (url) {
				if (url) {
					req.session.auth.redirectAfterLoginPath = url;
				} else {
					return req.session.auth.redirectAfterLoginPath || "";
				}
			},
			redirectAfterLogoutPath: function (url) {
				if (url) {
					req.session.auth.redirectAfterLogoutPath = url;
				} else {
					return req.session.auth.redirectAfterLogoutPath;
				}
			},
			redirectAfterSignupPath: function (url) {
				if (url) {
					req.session.auth.redirectAfterSignupPath = url;
				} else {
					return req.session.auth.redirectAfterSignupPath;
				}
			},

			pushErrorToLog: function (errors) {
				if (errors) {
					[].concat(errors).forEach(function (err) {
						req.session.auth.errors.push({ message: err.message || err.toString(), stack: err.stack});
						console.log("pushing err", err, req.session.auth.errors);
					});
				}
			},
			popErrorsFromLog: function () {
				return req.session.auth.errors ? req.session.auth.errors
					.splice(0, req.session.auth.errors.length) : [];
			},

			onlogin: function (err, result) {
				console.log("LOGGING IIIIIIINNNNNNN");
				return req.auth.redirectAfterLoginPath();
			},
			isLoggedIn: function () {
				return req.auth.getProfileData() && req.auth.getProfileData().roles.member;
			},

			logout: function () {
				var onlogoutUrl = req.auth.onlogout();
				req.logout(); // The logout method is added for you by everyauth, too
				req.session.newProfile = undefined;
				req.auth.destroy();
				return onlogoutUrl;
			},
			onlogout: function (err) {
				console.log("LOGGING OOOOOOOUUUUUUUTTTTTT");
				if (err) {
					req.flash.error(err.message);
				}
				return req.auth.redirectAfterLogoutPath() + (req.query.layout ? "?layout=" + req.query.layout : "");
			},

			getCurrentProfile: function (callback) {
				if (!callback) { throw new Error("Did not specify a callback for getCurrentProfile"); }
				if (req.auth.currentProfile) {
					return callback(null, req.auth.currentProfile);
				}
				return auth.getCurrentProfile(req, function (err, profile) {
					if (!err) { req.auth.currentProfile = profile; }
					callback(err, profile);
				});
			},

			getProfileData: function (callback) {
				if (!callback) { throw new Error("Did not specify a callback for getProfileData"); }
				if (req.auth.currentProfile) {
					callback(null, req.auth.currentProfile);
				} else {
					client.hget("profiles", req.session.auth.profile, function (err, data) {
						var currentProfileData = JSON.parse(data);
						callback(err, currentProfileData);
					});
				}
			},
			setProfileData: function (data, callback) {
				if (!callback) { throw new Error("Did not specify a callback for setProfileData"); }
				if (!data._id) { throw new Error("Can not store a profile without an id"); }
				client.hset("profiles", data._id, JSON.stringify(data));
				req.session.auth.profile = data._id;
				callback(null, data);
			},
			getSpecificProfileData: function (id, callback) {
				if (!callback) { throw new Error("Did not specify a callback for getSpecificProfileData"); }
				client.hget("profiles", id, function (err, data) {
					callback(err, JSON.parse(data));
				});
			},
			setSpecificProfileData: function (data, callback) {
				if (!callback) { throw new Error("Did not specify a callback for setSpecificProfileData"); }
				if (!data._id) { throw new Error("Can not store a profile without an id"); }
				client.hset("profiles", data._id, JSON.stringify(data));
				callback(null, data);
			}
		};

		next();
	});

	return auth;
};
