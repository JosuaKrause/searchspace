// @ts-check

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSearch, metricSlug, parseState } from '../js/urlstate.js';

/** @typedef {import('../js/urlstate.js').SharedState} SharedState */
/** @typedef {import('../js/urlstate.js').StateLimits} StateLimits */

/** @type {SharedState} */
const DEFAULTS = {
  metric: 'L2',
  points: [
    [0.4, 0.2],
    [-0.5, 0.8],
  ],
  unitCircle: true,
  convexHull: true,
  correction: 2.5,
  view: 1.1,
  showGrid: false,
  refPos: [0.01, 0.01],
};

/** @type {StateLimits} */
const LIMITS = {
  metrics: ['L1', 'L2', 'Cos', 'Unit L2', 'Adj. Dot'],
  allowUnitCircle: true,
  allowConvexHull: true,
  maxPoints: 3,
  correction: { min: 0.01, max: 10 },
  view: { min: 1, max: 10 },
};

test('metric names become slugs', () => {
  assert.equal(metricSlug('L2'), 'l2');
  assert.equal(metricSlug('Unit L2'), 'unit-l2');
  assert.equal(metricSlug('Adj. Dot'), 'adj-dot');
});

test('the default state writes nothing', () => {
  assert.equal(buildSearch('', DEFAULTS, DEFAULTS, LIMITS), '');
  assert.equal(
    buildSearch('?ref=medium', DEFAULTS, DEFAULTS, LIMITS),
    '?ref=medium',
  );
});

test('an empty query string reads the defaults', () => {
  assert.deepEqual(parseState('', DEFAULTS, LIMITS), DEFAULTS);
});

test('a changed state round-trips', () => {
  /** @type {SharedState} */
  const state = {
    metric: 'Adj. Dot',
    points: [
      [0.12345, -1],
      [0, 0.5],
    ],
    unitCircle: false,
    convexHull: false,
    correction: 3.21,
    view: 2.5,
    showGrid: true,
    refPos: [-0.3, 0.7],
  };
  const search = buildSearch('', state, DEFAULTS, LIMITS);
  assert.equal(
    search,
    '?metric=adj-dot&points=0.1235,-1,0,0.5&unit=0&hull=0' +
      '&corr=3.21&view=2.5&grid=1&pos=-0.3,0.7',
  );
  assert.deepEqual(parseState(search, DEFAULTS, LIMITS), {
    ...state,
    points: [
      [0.1235, -1],
      [0, 0.5],
    ],
  });
});

test('other keys are kept and stale state keys are replaced', () => {
  const state = { ...DEFAULTS, metric: 'Cos' };
  assert.equal(
    buildSearch('?ref=medium&metric=l1&grid=0', state, DEFAULTS, LIMITS),
    '?ref=medium&metric=cos',
  );
});

test('no points is not the same as the default points', () => {
  const state = { ...DEFAULTS, points: [] };
  const search = buildSearch('', state, DEFAULTS, LIMITS);
  assert.equal(search, '?points=');
  assert.deepEqual(parseState(search, DEFAULTS, LIMITS).points, []);
});

test('invalid values keep their defaults', () => {
  const state = parseState(
    '?metric=dot&points=1,2,3&corr=abc&view=&grid=maybe&pos=1',
    DEFAULTS,
    LIMITS,
  );
  assert.deepEqual(state, DEFAULTS);
  assert.deepEqual(
    parseState('?points=1,NaN', DEFAULTS, LIMITS).points,
    DEFAULTS.points,
  );
});

test('numbers are clamped and points are capped', () => {
  const state = parseState(
    '?corr=99&view=0&points=1,1,2,2,3,3,4,4',
    DEFAULTS,
    LIMITS,
  );
  assert.equal(state.correction, 10);
  assert.equal(state.view, 1);
  assert.deepEqual(state.points, [
    [1, 1],
    [2, 2],
    [3, 3],
  ]);
});

test('checkboxes a page does not offer are ignored', () => {
  /** @type {StateLimits} */
  const limits = { ...LIMITS, allowUnitCircle: false, allowConvexHull: false };
  const state = parseState('?unit=0&hull=0', DEFAULTS, limits);
  assert.equal(state.unitCircle, true);
  assert.equal(state.convexHull, true);
  const changed = { ...DEFAULTS, unitCircle: false, convexHull: false };
  assert.equal(buildSearch('?unit=0', changed, DEFAULTS, limits), '');
});

test('the defaults are not shared with the parsed state', () => {
  const state = parseState('', DEFAULTS, LIMITS);
  state.points[0][0] = 9;
  state.refPos[0] = 9;
  assert.equal(DEFAULTS.points[0][0], 0.4);
  assert.equal(DEFAULTS.refPos[0], 0.01);
});
