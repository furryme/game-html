// test-runner.js — Minimal test framework, zero dependencies
// Usage: see run.js

const tests = [];
const results = { passed: 0, failed: 0, errors: [] };

/**
 * Define a test group.
 * @param {string} name
 * @param {Function} fn — receives { assert, setup, teardown }
 */
function describe(name, fn) {
  const groupTests = [];
  const origTests = tests.length;

  // Temporarily redirect test registration to this group
  const origPush = tests.push;
  tests.push = function (t) {
    t.group = name;
    groupTests.push(t);
    return origPush.apply(tests, arguments);
  };

  fn({
    assert: makeAssert(name),
    setup: null, // will be set by runTests
    teardown: null,
  });

  tests.push = origPush;
}

/**
 * Define a test case.
 * @param {string} name
 * @param {Function} fn — receives assert helper
 */
function it(name, fn) {
  tests.push({ name, fn, group: '' });
}

/**
 * Assertion helper factory.
 */
function makeAssert(prefix) {
  return {
    equal(actual, expected, msg) {
      it(msg || `${prefix}: ${expected} === ${actual}`, () => {
        if (actual !== expected) throw new Error(`${msg || 'equal'}: expected ${expected}, got ${actual}`);
      });
    },
    truthy(val, msg) {
      it(msg || 'truthy check', () => {
        if (!val) throw new Error(`${msg || 'truthy'}: expected truthy, got ${val}`);
      });
    },
    range(val, min, max, msg) {
      it(msg || `range [${min}, ${max}]`, () => {
        if (val < min || val > max) throw new Error(`${msg || 'range'}: expected ${min}-${max}, got ${val}`);
      });
    },
    throws(fn, msg) {
      it(msg || 'throws check', () => {
        try { fn(); throw new Error(`${msg || 'throws'}: expected error but none thrown`); }
        catch (e) { if (e.message.startsWith('throws:')) throw e; /* expected */ }
      });
    },
    includes(arr, val, msg) {
      it(msg || `includes ${val}`, () => {
        if (!arr.includes(val)) throw new Error(`${msg || 'includes'}: expected ${val} in ${JSON.stringify(arr)}`);
      });
    },
    length(arr, expected, msg) {
      it(msg || `length === ${expected}`, () => {
        if (arr.length !== expected) throw new Error(`${msg || 'length'}: expected ${expected}, got ${arr.length}`);
      });
    },
    lte(actual, expected, msg) {
      it(msg || `<= ${expected}`, () => {
        if (actual > expected) throw new Error(`${msg || 'lte'}: expected <= ${expected}, got ${actual}`);
      });
    },
    gte(actual, expected, msg) {
      it(msg || `>= ${expected}`, () => {
        if (actual < expected) throw new Error(`${msg || 'gte'}: expected >= ${expected}, got ${actual}`);
      });
    },
    approx(actual, expected, delta, msg) {
      it(msg || `~ ${expected}`, () => {
        if (Math.abs(actual - expected) > delta) throw new Error(`${msg || 'approx'}: expected ~${expected} (±${delta}), got ${actual}`);
      });
    },
  };
}

/**
 * Seeded PRNG (mulberry32) — replace Math.random for deterministic tests.
 * @param {number} seed
 * @returns {Function} random()
 */
function seedRandom(seed) {
  const orig = Math.random;
  let s = seed | 0;
  function mulberry32() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  Math.random = mulberry32;
  return () => { Math.random = orig; };
}

/**
 * Run all tests.
 */
function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  RPG Buff Explorer — 自动化测试');
  console.log('='.repeat(60) + '\n');

  let currentGroup = '';
  let groupCount = 0;
  let groupPassed = 0;

  for (let ti = 0; ti < tests.length; ti++) {
    const test = tests[ti];
    if (test.group && test.group !== currentGroup) {
      // Print previous group summary
      if (currentGroup) {
        console.log(`  ${groupPassed}/${groupCount} passed\n`);
      }
      currentGroup = test.group;
      groupCount = 0;
      groupPassed = 0;
      console.log(`  ${currentGroup}`);
    }

    groupCount++;
    const prefix = test.group ? `    ` : `  `;
    try {
      // Cleanup between tests to prevent state pollution hangs
      if (typeof FX !== 'undefined' && FX && FX.particles) { FX.particles.length = 0; }
      document._elements = {};
      test.fn();
      results.passed++;
      groupPassed++;
      console.log(`${prefix}  ✓ ${test.name}`);
    } catch (e) {
      results.failed++;
      results.errors.push({ group: test.group, name: test.name, error: e.message });
      console.log(`${prefix}  ✗ ${test.name}`);
      console.log(`${prefix}    ${e.message}`);
    }
  }

  // Print last group summary
  if (currentGroup) {
    console.log(`  ${groupPassed}/${groupCount} passed\n`);
  }

  // Summary
  const total = results.passed + results.failed;
  console.log('-'.repeat(60));
  console.log(`  总计: ${total} 测试  ${results.passed} 通过  ${results.failed} 失败`);
  console.log('-'.repeat(60) + '\n');

  if (results.errors.length > 0) {
    console.log('失败详情:');
    for (const err of results.errors) {
      console.log(`  [${err.group || 'global'}] ${err.name}: ${err.error}`);
    }
    console.log();
  }

  return results.failed === 0;
}

module.exports = { describe, it, makeAssert, seedRandom, runTests };
