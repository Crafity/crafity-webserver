/*jslint node: true*/
/*global GLOBAL*/

(function () {
  "use strict";

  var core = require('crafity-core')
    , objects = core.objects;

  var State = module.exports = function State(req, other) {
    if (req === undefined) { throw new Error("Argument 'req' can not be undefined"); }
    if (this === GLOBAL) { return new State(req); }

    this.req = req;
    this.other = other || {};
    // other
    // body
    // query
    // params

    return this;
  };

  State.prototype.stringify = function () {
  };

  function getValue(key) {

    if (key === undefined) { throw new Error("Argument 'key'  can not be undefined"); }
    var value = undefined, state;

    if (!this.parent) {
      if (this.other && this.other.hasOwnProperty(key)) {
        value = this.other[key];
      } else {
        state = this.req.query.state ? decodeURIComponent(this.req.query.state) : "";
        try {
          state = state.length > 0 ? JSON.parse(state) : {};
        } catch (err) {
          console.error("Error parsing state:", state);
          throw err;
        }
        value = this.req.body && this.req.body[key] ||
          this.req.params && this.req.params[key] ||
          state[key] || this.req.query[key];
      }
    } else {
      value = this.parent[key];
      this.parent = undefined;
    }
    if (value === undefined) {
      return undefined;
    } else if (arguments.length === 1) {
      if ((value[0] === '{' || value[0] === "[") &&
        (value[value.length - 1] === '}' || value[value.length - 1] === "]")) {
        return JSON.parse(decodeURIComponent(value));
      } else {
        return value; // typeof value === 'string' ? decodeURIComponent(value) : value;
      }
    } else {
      //value = typeof value === 'string' ? decodeURIComponent(value) : value;

      //console.log("key, value", key, value, arguments.length, typeof value);

      if (value && (value[0] === '{' || value[0] === "[") &&
        (value[value.length - 1] === '}' || value[value.length - 1] === "]")) {
        value = JSON.parse(value);
      }

      this.parent = value; // typeof value === 'string' ? decodeURIComponent(value) : value;
      return getValue.apply(this, Array.prototype.slice.call(arguments, 1));
    }

  }

  function setValue(key, value) {
    var self = this;
    if (key === undefined) { throw new Error("Argument 'key'  can not be undefined"); }
    this._all = undefined;

    if (key instanceof Array) {
      key.forEach(function (key) {
        setValue.call(self, key);
      });
//		throw new Error('Array\'s are not implemented yet');
    } else if (key && typeof key === 'object') {
      self.other = objects.merge(self.other, key);
    } else {
      self.other[key] = value; // JSON.stringify(value);
    }
    return self;
  }

  State.prototype.get = (function () {
    return getValue.apply(this, arguments);
  });
  State.prototype.getAll = (function () {
    if (!this._all) {
      var query = this.req.query.state ? decodeURIComponent(this.req.query.state) : "";
      query = query.length > 0 ? JSON.parse(query) : {};
      this._all = objects.merge(query, this.other);
    }
    return JSON.parse(JSON.stringify(this._all));
  });
  State.prototype.set = (function () {
    return setValue.apply(this, arguments)
  });
  State.prototype.createQueryString = function (options) {
    var state = this.getAll() || {}
      , temp = state, key, value
      , qs = "";

    if (arguments.length > 1) {
      options = Array.prototype.slice.call(arguments);
    }

    if (options && options instanceof Array) {
      if (options.length < 2) {
        throw new Error('An array with additional querystring parameters needs a minimum of 2 entries')
      }

      key = options[0];
      for (var i = 1; i < options.length; i += 1) {
        if (i === options.length - 1) {
          value = temp[key]; // && i === 1 && typeof temp[key] === 'string' ? JSON.parse(decodeURIComponent(temp[key])) : temp[key];
          temp[key] = objects.merge(value, options[i]);
        } else {
          value = temp[key]; // && i === 1 && typeof temp[key] === 'string' ? JSON.parse(decodeURIComponent(temp[key])) : temp[key];
          temp = temp[key] = value || {};
          key = options[i];
        }
      }

    } else if (options && typeof options === 'object') {
      state = objects.merge(state, options);
    }
//		Object.keys(state).forEach(function (key) {
//			var value = state[key];
//			if (!value) { return; }
//			if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
//				qs += (qs.length ? "&" : "") + key + "=" + state[key];
//			} else {
//				qs += (qs.length ? "&" : "") + key + "=" + JSON.stringify(state[key]);
//			}
//		});
    return (state && Object.keys(state).length > 0 ? '?state=' + encodeURIComponent(JSON.stringify(state)) : '');
  };

  (function tests() {
    return;

    (function getterAndSetterTests() {
      var test = new State({ body: { hello: "world1" }, query: { hello: "world2" } });
      console.log("test.createQueryString()", test.createQueryString());
      test.set({'hello': undefined});
      test.set({'test': 123});
      console.log("test.createQueryString()", test.createQueryString());
      console.log("test.createQueryString()", test.createQueryString("hello", "world2", "2"));
    }());

    (function constructorTests() {
      (function createNewStateObjectWithInitialState() {
        var test = new State({ body: { hello: "world1" }, query: { hello: "world2" } });
        console.log("test1", test.get('hello'));
      }());
    }());

    (function getterAndSetterTests() {
      var test = new State({ body: { hello: "world1" }, query: { hello: "world2" } });

      (function createNewStateObjectWithInitialState() {
        test.set('hello', 'world3');
        console.log("test2", test.get('hello'));
      }());

      (function setAValueToUndefinedAndMakeSureItReturnsUndefinedWhenUserSpecifiesThis() {
        test.set('hello', undefined);
        console.log("test3", test.get('hello'));
      }());

      (function setAnObjectGraphInsteadOfASingleKeyValueAndMakeSureItMergesWithOtherSpecifiedValues() {
        test.set({'complex': { type: "complex", name: "tester1" }});
        console.log("test4", test.get('complex'));
      }());

      (function setAnArrayOfComplexObjects() {
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
      }());

      (function getASingleValue() {
        var test = new State({ body: { }, params: {}, query: { "showRequests": true } });

        if (test.get('showRequests') !== true) {
          console.error("getASingleValue", "Expected 'true' but was", test.get('hello'));
        }
      }());

      (function getASingleValueDeeplyNested() {
        var test = new State({ query: {x: '{"y":{"z":true,"w":true}}'} });

        if (test.get('x', "14f7d48e19bdc2139b70395344007bfe", "details") !== true) {
          console.error("getASingleValue", "Expected 'true' but was", test.get('x', "y"));
        }
      }());
    }());

  }());
}());

		
