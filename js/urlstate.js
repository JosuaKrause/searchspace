/*
 * Searchspace – An interactive visualization for various similarity measures.
 * Copyright (C) 2024 Josua Krause
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
// @ts-check

/**
 * The part of the UI state that is reflected in the URL.
 *
 * @typedef {{
 *   metric: string,
 *   points: number[][],
 *   unitCircle: boolean,
 *   convexHull: boolean,
 *   correction: number,
 *   view: number,
 *   showGrid: boolean,
 *   refPos: number[],
 * }} SharedState
 */
/**
 * What a page allows. Anything outside of it in the URL is ignored.
 *
 * @typedef {{
 *   metrics: string[],
 *   allowUnitCircle: boolean,
 *   allowConvexHull: boolean,
 *   maxPoints: number,
 *   correction: { min: number, max: number },
 *   view: { min: number, max: number },
 * }} StateLimits
 */

const KEY_METRIC = 'metric';
const KEY_POINTS = 'points';
const KEY_UNIT_CIRCLE = 'unit';
const KEY_CONVEX_HULL = 'hull';
const KEY_CORRECTION = 'corr';
const KEY_VIEW = 'view';
const KEY_GRID = 'grid';
const KEY_POS = 'pos';

/** All query keys owned by the state. Any other key is left untouched. */
export const STATE_KEYS = [
  KEY_METRIC,
  KEY_POINTS,
  KEY_UNIT_CIRCLE,
  KEY_CONVEX_HULL,
  KEY_CORRECTION,
  KEY_VIEW,
  KEY_GRID,
  KEY_POS,
];

/** Decimal places kept for every number written to the URL. */
const DIGITS = 4;

// 'Unit L2' becomes 'unit-l2', 'Adj. Dot' becomes 'adj-dot'.
export function metricSlug(/** @type {string} */ name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatNumber(/** @type {number} */ value) {
  // the unary plus drops trailing zeros and turns -0 into 0
  return `${+value.toFixed(DIGITS)}`;
}

function formatNumbers(/** @type {number[]} */ values) {
  return values.map(formatNumber).join(',');
}

function formatPoints(/** @type {number[][]} */ points) {
  return formatNumbers(points.flat());
}

function formatBool(/** @type {boolean} */ value) {
  return value ? '1' : '0';
}

function parseNumbers(/** @type {string} */ text) {
  if (text.trim() === '') {
    return [];
  }
  const values = text
    .split(',')
    .map((value) => (value.trim() === '' ? NaN : +value));
  return values.every(Number.isFinite) ? values : null;
}

function parseNumber(
  /** @type {string} */ text,
  /** @type {{ min: number, max: number }} */ range,
) {
  const values = parseNumbers(text);
  if (values === null || values.length !== 1) {
    return null;
  }
  return Math.min(range.max, Math.max(range.min, values[0]));
}

function parsePoints(/** @type {string} */ text) {
  const values = parseNumbers(text);
  if (values === null || values.length % 2 !== 0) {
    return null;
  }
  /** @type {number[][]} */
  const points = [];
  for (let ix = 0; ix < values.length; ix += 2) {
    points.push([values[ix], values[ix + 1]]);
  }
  return points;
}

function parseBool(/** @type {string} */ text) {
  const value = text.trim().toLowerCase();
  if (value === '1' || value === 'true') {
    return true;
  }
  if (value === '0' || value === 'false') {
    return false;
  }
  return null;
}

/**
 * Reads the state from a query string. Missing or invalid entries keep
 * their default.
 *
 * @param {string} search The query string, e.g. `location.search`.
 * @param {SharedState} defaults The page's initial state.
 * @param {StateLimits} limits What the page allows.
 * @return {SharedState}
 */
export function parseState(search, defaults, limits) {
  const params = new URLSearchParams(search);
  /** @type {SharedState} */
  const state = {
    ...defaults,
    points: defaults.points.map((point) => [...point]),
    refPos: [...defaults.refPos],
  };

  const metric = params.get(KEY_METRIC);
  if (metric !== null) {
    const slug = metricSlug(metric);
    const found = limits.metrics.find((name) => metricSlug(name) === slug);
    if (found !== undefined) {
      state.metric = found;
    }
  }

  const pointsText = params.get(KEY_POINTS);
  if (pointsText !== null) {
    const points = parsePoints(pointsText);
    if (points !== null) {
      state.points = points.slice(0, limits.maxPoints);
    }
  }

  const unitCircle = params.get(KEY_UNIT_CIRCLE);
  if (limits.allowUnitCircle && unitCircle !== null) {
    state.unitCircle = parseBool(unitCircle) ?? state.unitCircle;
  }

  const convexHull = params.get(KEY_CONVEX_HULL);
  if (limits.allowConvexHull && convexHull !== null) {
    state.convexHull = parseBool(convexHull) ?? state.convexHull;
  }

  const correction = params.get(KEY_CORRECTION);
  if (correction !== null) {
    state.correction =
      parseNumber(correction, limits.correction) ?? state.correction;
  }

  const view = params.get(KEY_VIEW);
  if (view !== null) {
    state.view = parseNumber(view, limits.view) ?? state.view;
  }

  const grid = params.get(KEY_GRID);
  if (grid !== null) {
    state.showGrid = parseBool(grid) ?? state.showGrid;
  }

  const posText = params.get(KEY_POS);
  if (posText !== null) {
    const pos = parseNumbers(posText);
    if (pos !== null && pos.length === 2) {
      state.refPos = pos;
    }
  }

  return state;
}

/**
 * Writes the state into a query string. Values equal to their default are
 * left out, and keys the state does not own (like `ref`) are kept.
 *
 * @param {string} search The current query string, e.g. `location.search`.
 * @param {SharedState} state The state to write.
 * @param {SharedState} defaults The page's initial state.
 * @param {StateLimits} limits What the page allows.
 * @return {string} The new query string, including the leading `?`, or the
 *   empty string if there is nothing to write.
 */
export function buildSearch(search, state, defaults, limits) {
  /** @type {string[]} */
  const parts = [];
  new URLSearchParams(search).forEach((value, key) => {
    if (!STATE_KEYS.includes(key)) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });

  // every value below consists only of [a-z0-9.,-] and needs no escaping
  const add = (
    /** @type {string} */ key,
    /** @type {string} */ value,
    /** @type {string} */ defaultValue,
  ) => {
    if (value !== defaultValue) {
      parts.push(`${key}=${value}`);
    }
  };

  add(KEY_METRIC, metricSlug(state.metric), metricSlug(defaults.metric));
  add(KEY_POINTS, formatPoints(state.points), formatPoints(defaults.points));
  if (limits.allowUnitCircle) {
    add(
      KEY_UNIT_CIRCLE,
      formatBool(state.unitCircle),
      formatBool(defaults.unitCircle),
    );
  }
  if (limits.allowConvexHull) {
    add(
      KEY_CONVEX_HULL,
      formatBool(state.convexHull),
      formatBool(defaults.convexHull),
    );
  }
  add(
    KEY_CORRECTION,
    formatNumber(state.correction),
    formatNumber(defaults.correction),
  );
  add(KEY_VIEW, formatNumber(state.view), formatNumber(defaults.view));
  add(KEY_GRID, formatBool(state.showGrid), formatBool(defaults.showGrid));
  add(KEY_POS, formatNumbers(state.refPos), formatNumbers(defaults.refPos));

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}
