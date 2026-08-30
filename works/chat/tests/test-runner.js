/* Minimal test runner for Node.js */
'use strict';

var passed = 0, failed = 0, currentDescribe = '';
var failures = [];
var pendingTests = [];

function describe(name, fn) {
  currentDescribe = name;
  console.log('\n  ' + name);
  fn();
  currentDescribe = '';
}

function it(name, fn) {
  try {
    var result = fn();
    if (result && typeof result.then === 'function') {
      pendingTests.push(
        result.then(function () {
          passed++;
          console.log('    \x1b[32m✓\x1b[0m ' + name);
        }).catch(function (e) {
          failed++;
          var label = currentDescribe ? currentDescribe + ' > ' + name : name;
          failures.push({ label: label, error: e.message });
          console.log('    \x1b[31m✗\x1b[0m ' + name);
          console.log('      ' + e.message);
        })
      );
    } else {
      passed++;
      console.log('    \x1b[32m✓\x1b[0m ' + name);
    }
  } catch (e) {
    failed++;
    var label = currentDescribe ? currentDescribe + ' > ' + name : name;
    failures.push({ label: label, error: e.message });
    console.log('    \x1b[31m✗\x1b[0m ' + name);
    console.log('      ' + e.message);
  }
}

function expect(val) {
  return {
    toBe: function (expected) {
      if (val !== expected) throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(val));
    },
    toEqual: function (expected) {
      if (JSON.stringify(val) !== JSON.stringify(expected))
        throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(val));
    },
    toBeDefined: function () {
      if (val === undefined) throw new Error('Expected value to be defined');
    },
    toBeTruthy: function () {
      if (!val) throw new Error('Expected ' + JSON.stringify(val) + ' to be truthy');
    },
    toBeFalsy: function () {
      if (val) throw new Error('Expected ' + JSON.stringify(val) + ' to be falsy');
    },
    toContain: function (expected) {
      if (typeof val === 'string') {
        if (val.indexOf(expected) === -1) throw new Error('Expected "' + val + '" to contain "' + expected + '"');
      } else if (Array.isArray(val)) {
        if (val.indexOf(expected) === -1) throw new Error('Expected array to contain ' + JSON.stringify(expected));
      } else {
        throw new Error('toContain expects string or array');
      }
    },
    toBeNull: function () {
      if (val !== null) throw new Error('Expected null but got ' + JSON.stringify(val));
    },
    toThrow: function (expectedMsg) {
      if (typeof val !== 'function') throw new Error('toThrow expects a function');
      try { val(); } catch (e) {
        if (expectedMsg && e.message.indexOf(expectedMsg) === -1)
          throw new Error('Expected error to contain "' + expectedMsg + '" but got "' + e.message + '"');
        return;
      }
      throw new Error('Expected function to throw' + (expectedMsg ? ' containing "' + expectedMsg + '"' : ''));
    },
    toBeGreaterThan: function (expected) {
      if (typeof val !== 'number' || typeof expected !== 'number')
        throw new Error('toBeGreaterThan expects numbers');
      if (val <= expected) throw new Error('Expected ' + val + ' > ' + expected);
    },
    toBeGreaterThanOrEqual: function (expected) {
      if (typeof val !== 'number' || typeof expected !== 'number')
        throw new Error('toBeGreaterThanOrEqual expects numbers');
      if (val < expected) throw new Error('Expected ' + val + ' >= ' + expected);
    },
    toBeLessThan: function (expected) {
      if (typeof val !== 'number' || typeof expected !== 'number')
        throw new Error('toBeLessThan expects numbers');
      if (val >= expected) throw new Error('Expected ' + val + ' < ' + expected);
    },
    toBeLessThanOrEqual: function (expected) {
      if (typeof val !== 'number' || typeof expected !== 'number')
        throw new Error('toBeLessThanOrEqual expects numbers');
      if (val > expected) throw new Error('Expected ' + val + ' <= ' + expected);
    },
    toHaveLength: function (expected) {
      if (!val || typeof val.length !== 'number')
        throw new Error('toHaveLength expects an object with .length');
      if (val.length !== expected) throw new Error('Expected length ' + expected + ' but got ' + val.length);
    },
    toHaveProperty: function (prop, value) {
      if (val === null || val === undefined || typeof val !== 'object')
        throw new Error('toHaveProperty expects an object');
      if (!(prop in val)) throw new Error('Expected object to have property "' + prop + '"');
      if (arguments.length > 1 && JSON.stringify(val[prop]) !== JSON.stringify(value))
        throw new Error('Expected "' + prop + '" to be ' + JSON.stringify(value) + ' but got ' + JSON.stringify(val[prop]));
    },
    toBeInstanceOf: function (expected) {
      if (!(val instanceof expected))
        throw new Error('Expected instance of ' + (expected.name || expected) + ' but got ' + typeof val);
    },
    not: {
      toBe: function (expected) {
        if (val === expected) throw new Error('Expected value not to be ' + JSON.stringify(expected));
      },
      toContain: function (expected) {
        if (typeof val === 'string' && val.indexOf(expected) !== -1)
          throw new Error('Expected "' + val + '" not to contain "' + expected + '"');
      },
      toBeTruthy: function () {
        if (val) throw new Error('Expected value not to be truthy');
      },
      toBeNull: function () {
        if (val === null) throw new Error('Expected value not to be null');
      }
    }
  };
}

global.describe = describe;
global.it = it;
global.expect = expect;

var path = require('path');
var testDir = __dirname;
var testFiles = ['test-sanitize.js', 'test-sanitize-extended.js', 'test-offline-queue.js', 'test-call-sync.js', 'test-threads.js', 'test-notification-orchestrator.js', 'test-notification-sounds.js', 'test-telemetry.js', 'test-webrtc-signaling.js', 'test-call-state-fanout.js', 'test-notification-digest.js', 'test-error-boundary.js', 'test-accessibility.js', 'test-firestore-rules.js', 'test-verified-peers.js'];

var GLOBAL_KEYS = ['window', 'document', 'navigator', 'indexedDB', 'CustomEvent', 'localStorage', 'firebase'];

async function run() {
  for (var i = 0; i < testFiles.length; i++) {
    var f = testFiles[i];

    var saved = {};
    GLOBAL_KEYS.forEach(function (k) {
      saved[k] = global[k];
      if (k === 'navigator') saved[k] = Object.getOwnPropertyDescriptor(global, k);
    });

    pendingTests = [];

    var mod = require(path.join(testDir, f));
    if (typeof mod === 'function') mod();

    await Promise.all(pendingTests);
    await new Promise(function (r) { setTimeout(r, 0); });

    GLOBAL_KEYS.forEach(function (k) {
      if (k === 'navigator') {
        if (saved[k]) Object.defineProperty(global, 'navigator', saved[k]);
        else try { delete global.navigator; } catch (_) {}
      } else {
        if (saved[k] === undefined) delete global[k];
        else global[k] = saved[k];
      }
    });
  }

  console.log('\n  \x1b[1mResults:\x1b[0m ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(function (err) {
  console.error('\n  \x1b[31mFATAL:\x1b[0m ' + (err && err.message ? err.message : err));
  if (err && err.stack) console.error(err.stack);
  console.log('\n  \x1b[1mResults:\x1b[0m ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(1);
});
