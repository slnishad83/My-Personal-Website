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
var testFiles = ['test-sanitize.js', 'test-offline-queue.js', 'test-call-sync.js', 'test-threads.js', 'test-notification-orchestrator.js', 'test-notification-sounds.js', 'test-telemetry.js'];

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

run().catch(function () {
  console.log('\n  \x1b[1mResults:\x1b[0m ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(1);
});
