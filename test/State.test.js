/*jslint node: true, bitwise: true, unparam: true, maxerr: 50, white: true, stupid: true */
"use strict";

/*!
 * crafity-webserver - State tests
 * Copyright(c) 2013 Crafity
 * Copyright(c) 2013 Bart Riemens
 * Copyright(c) 2013 Galina Slavova
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var jstest = require('crafity-jstest').createContext("State Object Tests")
  , assert = jstest.assert
  , State = require('../lib/State.js')
  , output = { log: function () { return false; }}
  ;

/**
 * Run the tests
 */
jstest.run({

  "getterAndSetterTests": function () {
    var test = new State({ body: { hello: "world1" }, query: { hello: "world2" } });
    output.log("test.createQueryString()", test.createQueryString());
    test.set({'hello': undefined});
    test.set({'test': 123});
    output.log("test.createQueryString()", test.createQueryString());
    output.log("test.createQueryString()", test.createQueryString("hello", "world2", "2"));
  },

  "createNewStateObjectWithInitialState and get an initial value back": function () {
    var test = new State({ body: { hello: "world1" }, query: { hello: "world2" } });
    output.log("test1", test.get('hello'));
  },

  "createNewStateObjectWithInitialState and override one of the keys": function () {
    var test = new State({ body: { hello: "world1" }, query: { hello: "world2" } });
    test.set('hello', 'world3');
    output.log("test2", test.get('hello'));
  },

  "setAValueToUndefinedAndMakeSureItReturnsUndefinedWhenUserSpecifiesThis": function () {
    var test = new State({ body: { hello: "world1" }, query: { hello: "world2" } });
    test.set('hello', undefined);
    output.log("test3", test.get('hello'));
  },

  "setAnObjectGraphInsteadOfASingleKeyValueAndMakeSureItMergesWithOtherSpecifiedValues": function () {
    var test = new State({ body: { hello: "world1" }, query: { hello: "world2" } });
    test.set({'complex': { type: "complex", name: "tester1" }});
    output.log("test4", test.get('complex'));
  },

  "setAnArrayOfComplexObjects": function () {
    var test = new State({ body: { hello: "world1" }, query: { hello: "world2" } })
      , complex = { type: "complex", name: "tester2" };

    test.set([
      {'hello': 'world4'},
      {'complex': complex }
    ]);

    if (test.get('hello') !== 'world4') {
      console.error("setAnArrayOfComplexObjects", "Expected 'World4' but was", test.get('hello'));
    }
    if (test.get('complex') !== complex) {
      console.error("setAnArrayOfComplexObjects", "Expected '{ type: 'complex', name: 'tester2' }' but was", test.get('complex'));
    }
    if (test.get('complex', 'name') !== 'tester2') {
      console.error("setAnArrayOfComplexObjects", "Expected 'tester2' but was", test.get('complex', 'name'));
    }
  },

  "getASingleValue": function () {
    var test = new State({ body: { }, params: {}, query: { "showRequests": true } });

    if (test.get('showRequests') !== true) {
      console.error("getASingleValue", "Expected 'true' but was", test.get('hello'));
    }
  },

  "getASingleValueDeeplyNested": function () {
    var test = new State({ query: {x: '{"y":{"z":true,"w":true}}'} });
    if (test.get('x', 'y', 'z') !== true) {
      output.log("getASingleValue", "Expected 'true' but was", test.get('x', "y"));
    }
  }

});
