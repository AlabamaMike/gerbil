var IS_NODE = !!(typeof module !== 'undefined' && module.exports);

var Gerbil = function(description, tests, logger) {
  this.success = 0;
  this.failures = 0;
  this.count = 0;
  this.assertions = 0;
  this.timeout = 0;
  this.queue = new Gerbil.Queue;
  this.description = description;
  this.tests = tests;

  this.pretty_console = {
    log: function(msg) { return console.log("\033[32m" + msg + "\033[0m"); },
    info: function(msg) { return console.info("\033[34m" + msg + "\033[0m"); },
    warn: function(msg) { return console.warn("\033[33m" + msg + "\033[0m"); },
    error: function(msg) { return console.error("\033[31m" + msg + "\033[0m"); }
  };

  this.logger = typeof(logger) == 'object' ? logger : IS_NODE ? this.pretty_console : window.console;

  this.extract_test = function(key) {
    var test = this.tests[key];
    delete this.tests[key];
    return test || function() {};
  };

  this.execute = function(test, scope) {
    try {
      var name = test.name;
      var test = test.fn;

      test.call(scope, this);
      this.ok(name);
    } catch(exception) {
      this.fail(name + " (" + exception + ")");
    } finally {
      if ((this.success + this.failures) == this.count) {
        var context = this;
        setTimeout(function() {
          this.summary();
        }.apply(context), this.timeout);
      }
    }
  };

  this.ok = function(message) {
    this.success++;
    this.logger.log("   * " + message + " (" + this.assertions + " assertions)");
  };

  this.fail = function(message) {
    this.failures++;
    this.logger.error("   x " + message);
  };

  this.enqueue = function() {
    this.logger.info("== Running " + this.description + " ==");
    this.setup = this.extract_test("setup");
    this.before = this.extract_test("before");
    this.after  = this.extract_test("after");
    this.cleanup = this.extract_test("cleanup");

    for (var key in this.tests) {
      this.queue.push({
        name: key,
        fn: this.tests[key],
        time: new Date().getTime()
      });
      this.count++;
    }
  };

  this.consume = function() {
    var test = false;
    var scope = {};

    this.setup.call(scope, this)
    while (test = this.queue.pull()) {
      this.before.call(scope, this)
      this.execute(test, scope);
      this.after.call(scope, this);
    }
    this.cleanup.call(scope, this);
  };

  this.summary = function() {
    this.logger.warn("All tests completed: " + this.success + " passed, " + this.failures + " failed of " + this.count + " tests");
    this.logger.info("");
  };

};

Gerbil.Error = function(message){
  var error = new Error(message);
  return error.stack || error.message;
};

Gerbil.Queue = function() {
  this.queue = [];
  this.offset = 0;

  this.length = function() {
    return this.queue.length - this.offset;
  };

  this.push = function(item) {
    this.queue.push(item);
  };

  this.pull = function() {
    if (this.queue.length === 0) return;
    var item = this.queue[this.offset];

    if (++this.offset * 2 >= this.queue.length) {
      this.queue = this.queue.slice(this.offset);
      this.offset = 0;
    }

    return item;
  };
};

Gerbil.prototype = {
  set_timeout: function(fn, milliseconds) {
    var context = this;
    this.timeout += milliseconds;

    return setTimeout(function() {
      fn.apply(context);
    }, milliseconds);
  },

  assert: function(expectation) {
    this.assertions++;
    if (!expectation) throw Gerbil.Error("Assertion Failed");
  },

  assert_throw: function(expected_error, fn) {
    this.assertions++;
    var error_message = false;
    try {
      fn();
      error_message = expected_error.name + " was expected but not raised."
    } catch (exception) {
      if (typeof exception  == typeof expected_error)
        error_message = expected_error.name + " was expected but " + exception.name + " was raised."
    }
    if (error_message) throw Gerbil.Error(error_message)
  },

  assert_equal: function(first, second) {
    if (first == undefined || second == undefined) throw Gerbil.Error("attr1 = " + first + " (" + typeof first + ") " + "and attr2 = " + second + " (" + typeof second + ")");
    if ( typeof(first) != typeof(second) ) throw Gerbil.Error("Different type " + typeof first + " vs " + typeof second);

    this.assertions++;

    switch(first.constructor) {
      case Array:
        if (first.length != second.length )
          throw Gerbil.Error("Different Lengths");
        for (var i = 0; i < first.length; i++) {
          if (first[i] != second[i]) throw Gerbil.Error("Items not equal " + first[i]  + " != " + second[i]);
        }
        break;
      case String, Number:
        if (first != second) throw Gerbil.Error("Not equal " + first + " != " + second);
        break;
    }
  },
};

var scenario = function(description, tests, logger) {
  current_scenario = new Gerbil(description, tests, logger);
  current_scenario.enqueue();
  current_scenario.consume();
};

if (IS_NODE) module.exports = scenario;
