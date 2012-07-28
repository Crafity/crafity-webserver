/*jslint node:true, white:true */

exports.init = function (app) {
	"use strict";
	
	var everyAuth = require('everyauth')
		, findOrCreateUserCallback = function (providerName, req, session, data, promise) {
		promise.fail(new Error("There is no findOrCreateUserCallback handler defined"));
		throw new Error("There is no findOrCreateUserCallback handler defined");
	}
		, oauth = { findOrCreateUser: function (callback) { findOrCreateUserCallback = callback; } };

	function createFindOrCreateUserHandler(providerName) {
		return function (session, accessToken, accessTokenSecret, data, req) {
			var oauth = this, promise = oauth.Promise();
			setTimeout(function () {
				try {
					data.accessToken = accessToken;
					data.accessTokenSecret = accessTokenSecret;
					findOrCreateUserCallback.call(oauth, providerName, req, session, data, promise);
				} catch(err) {
					console.log("err", err.stack, err);
					promise.fail(err);
				}
			}, 0);
			oauth.redirectPath((req.auth && req.auth.redirectAfterLoginPath()) || "/");
			return promise;
		};
	}
	
	everyAuth.helpExpress(app);

	everyAuth.everymodule.moduleTimeout(app.config.webserver.oauth.timeout || 30000);
	everyAuth.everymodule.moduleErrback(function (err, data) {
		data.req.flash.error(err.message);
		data.res.redirect(data.req.auth.redirectAfterLoginPath() || data.req.headers.referer || "/login");
	});
	
	everyAuth.everymodule.handleLogout(function (req, res) {
		req.auth.redirectAfterLogoutPath(req.query["return"] || req.auth.redirectAfterLogoutPath() || "/");
		var afterLogoutUrl = req.auth.logout();
		res.redirect(afterLogoutUrl || "/");
	});

	if (app.config.webserver.oauth.linkedin) {
		everyAuth.linkedin
			.consumerKey(app.config.webserver.oauth.linkedin.consumerKey)
			.consumerSecret(app.config.webserver.oauth.linkedin.consumerSecret)
			.findOrCreateUser(createFindOrCreateUserHandler("LinkedIn"));
	}

	if (app.config.webserver.oauth.facebook) {
		everyAuth.facebook
			.appId(app.config.webserver.oauth.facebook.appId)
			.appSecret(app.config.webserver.oauth.facebook.appSecret)
			.scope("user_about_me, user_activities, user_birthday, user_education_history, user_events, user_games_activity, user_groups, user_hometown, user_interests, user_likes, user_location, user_online_presence, user_questions, user_relationship_details, user_relationships, user_religion_politics, user_status, user_subscriptions, user_website, user_work_history, email, publish_actions")
			//user_location_posts, 
			//.scope("user_about_me, user_activities, user_birthday, user_education_history, user_events, user_games_activity, user_groups, user_hometown, user_interests, user_likes, user_location, user_online_presence, user_questions, user_relationship_details, user_relationships, user_religion_politics, user_status, user_subscriptions, user_website, user_work_history")
			.findOrCreateUser(createFindOrCreateUserHandler("Facebook"));
	}

	if (app.config.webserver.oauth.twitter) {
		everyAuth.twitter
			.consumerKey(app.config.webserver.oauth.twitter.consumerKey)
			.consumerSecret(app.config.webserver.oauth.twitter.consumerSecret)
			.findOrCreateUser(createFindOrCreateUserHandler("Twitter"));
	}

	if (app.config.webserver.oauth.google) {
		everyAuth.google
			.appId(app.config.webserver.oauth.google.appId)
			.appSecret(app.config.webserver.oauth.google.appSecret)
			.scope("https://www.google.com/m8/feeds/contacts/default/full https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile") // https://www.googleapis.com/auth/userinfo#profile") //https://www.google.com/m8/feeds") //https://www.googleapis.com/auth/userinfo.profile")
			.findOrCreateUser(createFindOrCreateUserHandler("Google"));
	}

	app.use(everyAuth.middleware());

	return oauth;
};
