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

exports.assests = function (config) {
  var assetManager = require('connect-assetmanager')
//	, assetHandler = require('connect-assetmanager-handlers')
    , core = require('crafity-core')
    , fs = require('crafity-filesystem')
    , assets = {};

  core.objects.forEach(config, function (content, name) {
    content.route = new RegExp(content.route, "i");
    content.path = fs.combine(process.cwd(), content.path);
    assets[name] = content;
  });

  return assetManager(assets);
//	{
//				'jsXYZ': {
//					'route': /scripts\/crafity.js/, // /\/scripts\/lib\/\/crafity\/[0-9]+\/.*\.js/
//					'path': fs.combine(process.cwd(), '/public/scripts/lib/crafity/'),
//					'dataType': 'javascript',
//					'files': [
//						"../thirdparty/jquery-1.6.2.min.js",
//						"crafity.ajax.js",
//						"crafity.objects.js",
//						"crafity.Exception.js",
//						"crafity.common.js",
//						"crafity.arrays.js",
//						"crafity.Event.js",
//						"crafity.Navigation.js",
//						"crafity.sections.js",
//						"crafity.forms.js"
//					]
//				}, 'css': {
//					'route': /\/styles\/[0-9]+\/.*\.css/
//					, 'path': fs.combine(process.cwd(), '/public/styles/')
//					, 'dataType': 'css'
//					, 'files': [
//						'crafity.css'
//					]
//					, 'preManipulate': {
//						// Regexp to match user-agents including MSIE.
//						'MSIE': [
//							assetHandler.yuiCssOptimize
//							, assetHandler.fixVendorPrefixes
//							, assetHandler.fixGradients
//							, assetHandler.stripDataUrlsPrefix
//						],
//						// Matches all (regex start line)
//						'^': [
//							assetHandler.yuiCssOptimize
//							, assetHandler.fixVendorPrefixes
//							, assetHandler.fixGradients
//							, assetHandler.replaceImageRefToBase64(root)
//						]
//					}
//				}
//			});
};
