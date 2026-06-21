#!/usr/bin/env node
// run.js — Test entry point
// Usage: node tests/run.js

// Step 1: Setup browser stubs
require('./browser-stubs');

// Step 2: Load game files (executes in global scope via eval)
const { loadGameFiles } = require('./browser-stubs');
loadGameFiles(__dirname + '/..');

// Step 3: Import test runner
const { runTests } = require('./test-runner');

// Step 3.5: Initialize player and globals that tests depend on
initPlayer('warrior');
recalcBuffStats();

// Step 4: Import test files (they register tests via describe/it)
require('./test-data');
require('./test-combat');
require('./test-buff');
require('./test-generator');
require('./test-boss');
require('./test-fog');
require('./test-equip');
require('./test-persistence');
require('./test-utils-fx-data');
require('./test-fx-data-extra');
require('./test-economy-shop');
require('./test-persistence-utils');
require('./test-buff-boss-equip');
require('./test-movement-combat');
require('./test-combat-boss-fixes');
require('./test-events-relic');

// Step 5: Run!
const success = runTests();
process.exit(success ? 0 : 1);
