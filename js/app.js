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

import ConvexHull from './convex.js';
import {
  convertMousePosition,
  convertTouchPosition,
  loadImage,
  precision,
} from './misc.js';
import PixelCanvas from './pixelcanvas.js';

const MAX_POINTS = 36;

/** @typedef {'L1' | 'L2' | 'Cos' | 'Dot' | 'Unit L2' | 'Adj. Dot'} DistanceFunctionName */
/** @typedef {{
  title: string,
  unitCircle: boolean,
  allowUnitCircle: boolean,
  convexHull: boolean,
  allowConvexHull: boolean,
  distanceFn: DistanceFunctionName,
  metrics: DistanceFunctionName[],
  points: number[][],
  initRefPos: number[],
}} FullSettings */
/** @typedef {{
  title?: string,
  unitCircle?: boolean,
  allowUnitCircle?: boolean,
  convexHull?: boolean,
  allowConvexHull?: boolean,
  distanceFn?: DistanceFunctionName,
  metrics?: DistanceFunctionName[],
  points?: number[][],
  initRefPos?: number[],
}} Settings */

/** @type {DistanceFunctionName} */ export const DF_L1 = 'L1';
/** @type {DistanceFunctionName} */ export const DF_L2 = 'L2';
/** @type {DistanceFunctionName} */ export const DF_COS = 'Cos';
/** @type {DistanceFunctionName} */ export const DF_DOT = 'Dot';
/** @type {DistanceFunctionName} */ export const DF_L2_PROJ = 'Unit L2';
/** @type {DistanceFunctionName} */ export const DF_DOT_ADJ = 'Adj. Dot';
/** @type {DistanceFunctionName[]} */
const DFS = [DF_L1, DF_L2, DF_COS, DF_DOT, DF_L2_PROJ, DF_DOT_ADJ];

export default class App extends PixelCanvas {
  constructor(
    /** @type {string} */ canvasId,
    /** @type {string} */ headerId,
    /** @type {string} */ footerId,
    /** @type {string} */ topbarId,
    /** @type {string} */ bottombarId,
    /** @type {string} */ errorId,
    /** @type {Settings} */ settings,
  ) {
    super(
      canvasId,
      topbarId,
      bottombarId,
      errorId,
      './shaders/main.vert',
      './shaders/main.frag',
      800,
      600,
      1.1,
    );
    /** @type {string} */
    this.headerId = headerId;
    /** @type {string} */
    this.footerId = footerId;
    /** @type {ConvexHull} */
    this.ch = new ConvexHull();
    /** @type {FullSettings} */
    this.settings = {
      title: 'Visualization of Various Similarity Measures',
      unitCircle: true,
      allowUnitCircle: true,
      convexHull: true,
      allowConvexHull: true,
      distanceFn: DF_L2,
      metrics: [DF_L1, DF_L2, DF_COS, DF_DOT],
      points: [
        [0.4, 0.2],
        [-0.5, 0.8],
        [-0.8, -0.4],
        [0.2, -0.6],
        [0.3, 0.3],
        [-0.4, 0.2],
      ],
      initRefPos: [0.01, 0.01],
      ...settings,
    };
  }

  addHeaderAndFooter(
    /** @type {FullSettings} */ settings,
    /** @type {URLSearchParams} */ urlParams,
  ) {
    const head = document.createElement('div');
    head.textContent = settings.title;
    const header = document.querySelector(this.headerId);
    if (!header) {
      throw new Error(`Could not find ${this.headerId}`);
    }
    header.appendChild(head);
    const footNormal = document.createElement('div');
    footNormal.classList.add('normalonly');
    footNormal.textContent =
      'Add points by clicking and remove the currently closest point via Shift+Click.';
    const footMobile = document.createElement('div');
    footMobile.classList.add('mobileonly');
    footMobile.textContent =
      'Add points by tapping. Select "Show Nearest" to remove points instead.';
    const footer = document.querySelector(this.footerId);
    if (!footer) {
      throw new Error(`Could not find ${this.footerId}`);
    }
    footer.appendChild(footNormal);
    footer.appendChild(footMobile);
    const ref = urlParams.get('ref');
    if (ref !== 'medium') {
      const textA = document.createElement('span');
      textA.textContent = 'Learn more about this visualization on ';
      const link = document.createElement('a');
      link.setAttribute(
        'href',
        'https://medium.josuakrause.com/dot-product-is-a-bad-distance-function-aff7667da6cc?source=friends_link&sk=1a7e02ec41f35b625fe5eb08da8623cb',
      );
      link.setAttribute('target', '_blank');
      link.textContent = 'Medium';
      const textB = document.createElement('span');
      textB.textContent = '.';
      const footMedium = document.createElement('div');
      footMedium.appendChild(textA);
      footMedium.appendChild(link);
      footMedium.appendChild(textB);
      footer.appendChild(footMedium);
    }
  }

  async setupBeforeCanvas() {
    const urlParams = new URLSearchParams(window.location.search);
    const settings = this.settings;
    const distanceFn = DFS.indexOf(settings.distanceFn);
    const dfs = settings.metrics;

    this.addHeaderAndFooter(settings, urlParams);

    this.addValue('areaMode', 'uAreaMode', 'bool', false);
    this.addValue('showGrid', 'uShowGrid', 'bool', false);
    this.addValue('showCursor', 'uShowCursor', 'bool', false);
    this.addValue('unitCircle', 'uUnitCircle', 'bool', settings.unitCircle);
    this.addValue('convexHull', 'uConvexHull', 'bool', settings.convexHull);
    this.addValue('refPosition', 'uRefPosition', '2d', settings.initRefPos);
    this.addValue('distanceFn', 'uDistanceFn', 'enum', distanceFn);
    this.addValue('correction', 'uCorrection', 'range', 2.5);
    this.addValue('points', 'uPoints', 'array2d', settings.points);
    this.addValue('outline', 'uOutline', 'array2d', []);
    this.addValue('outlineCenter', 'uOutlineCenter', '2d', [0, 0]);
    this.addValue('outlineScale', 'uOutlineScale', 'float', 1);

    this.addPrerenderHook((values) => {
      values.outline = this.ch.createLinesArray(values.points);
      const centerVals = values.outline.reduce(
        (p, [x, y]) => [p[0] + x, p[1] + y, p[2] + 1],
        [0, 0, 0],
      );
      values.outlineCenter = [
        centerVals[2] > 0 ? centerVals[0] / centerVals[2] : centerVals[0],
        centerVals[2] > 0 ? centerVals[1] / centerVals[2] : centerVals[1],
      ];
      const distSq = values.outline.reduce((p, [x, y]) => {
        const dx = x - values.outlineCenter[0];
        const dy = y - values.outlineCenter[1];
        const dSq = dx * dx + dy * dy;
        return Math.max(dSq, p);
      }, 0);
      values.outlineScale = distSq > 0 ? 1 / Math.sqrt(distSq) : 1;
      return values;
    });

    window.addEventListener('keypress', (e) => {
      if (this.isTextTarget(e.target)) {
        return;
      }
      const ix = e.code.startsWith('Digit') ? +e.code[5] : null;
      if (ix !== null && Number.isFinite(ix) && ix >= 1 && ix <= dfs.length) {
        this.updateValue({
          distanceFn: DFS.indexOf(dfs[ix - 1]),
        });
        if (e.target && e.target.blur) {
          e.target.blur();
        }
        e.preventDefault();
      }
    });

    const onShift = (/** @type {KeyboardEvent} */ e) => {
      if (this.isTextTarget(e.target)) {
        return;
      }
      if (e.key === 'Shift') {
        this.updateValue({
          areaMode: e.shiftKey,
        });
        if (e.target && e.target.blur) {
          e.target.blur();
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onShift);
    window.addEventListener('keyup', onShift);

    if (dfs.length > 1) {
      this.addControl('distanceFn', 'Metric:', {
        options: dfs.map((dfName) => ({
          text: dfName,
          value: DFS.indexOf(dfName),
        })),
        monitorValue: 'distanceFn',
      });
    }
    this.addControl('areaMode', 'Show Nearest:', { monitorValue: 'areaMode' });
    if (settings.allowUnitCircle) {
      this.addControl('unitCircle', 'Unit Circle:', {});
    }
    if (settings.allowConvexHull) {
      this.addControl('convexHull', 'Convex Hull:', {});
    }
    this.addTopDivider();
    this.addControl('correction', 'Correction:', {
      min: 0.01,
      max: 10.0,
      step: 0.01,
    });
    this.addViewportControl('View:', {
      min: 1.0,
      max: 10.0,
      step: 0.1,
    });
    this.addControl('showGrid', 'Grid:', {});

    this.addCapture('Save', 'S');
    this.addPrerenderHook((values) => {
      if (this.isRecording()) {
        values.showCursor = values.areaMode;
      }
      return values;
    });
    this.addVideoCapture('Record', 'Stop', 'J', 'K');

    this.addStatus((values) => {
      const [x, y] = values.refPosition;
      const posText = `Pos: ${precision(x, 5)} ${precision(y, 5)}`;
      const [dist] = this.getClosest(
        DFS[values.distanceFn],
        values.points,
        values.refPosition,
        this.getRenderValues(),
      );
      const distText = `Dist:${precision(dist * values.correction, 5)}`;
      return `${distText} ${posText}`;
    });

    this.addVisibilityCheck();

    await super.setupBeforeCanvas();
  }

  async setupAfterCanvas() {
    const watermark = await loadImage('./img/watermark.png');
    this.addValue('wm', 'uWM', 'image', watermark);

    const canvas = this.getCanvas();
    canvas.addEventListener('touchmove', (e) => {
      const values = this.getValues();
      const refPosition = convertTouchPosition(
        this.getCanvas(),
        this.getMeasures(),
        values.showGrid,
        e,
      );
      this.updateValue({
        refPosition,
      });
      e.preventDefault();
    });
    canvas.addEventListener('mousemove', (e) => {
      const values = this.getValues();
      const refPosition = convertMousePosition(
        this.getCanvas(),
        this.getMeasures(),
        values.showGrid,
        e,
      );
      this.updateValue({
        refPosition,
      });
    });
    canvas.addEventListener('click', (e) => {
      const values = this.getValues();
      const refPosition = convertMousePosition(
        this.getCanvas(),
        this.getMeasures(),
        values.showGrid,
        e,
      );
      const points = [...values.points];
      if (values.areaMode) {
        const [, ix] = this.getClosest(
          DFS[values.distanceFn],
          values.points,
          refPosition,
          this.getRenderValues(),
        );
        points.splice(ix, 1);
      } else if (points.length < MAX_POINTS) {
        points.push(refPosition);
      }
      this.updateValue({
        points,
        refPosition,
      });
    });

    await super.setupAfterCanvas();
  }

  getDistance(distanceFn, vecA, vecB, values) {
    function absSum(a) {
      return Math.abs(a[0]) + Math.abs(a[1]);
    }

    function sub(a, b) {
      return [a[0] - b[0], a[1] - b[1]];
    }

    function dot(a, b) {
      return a[0] * b[0] + a[1] * b[1];
    }

    function card(v) {
      return Math.sqrt(dot(v, v));
    }

    function norm(v) {
      const len = card(v);
      if (len > 0) {
        return [v[0] / len, v[1] / len];
      }
      return [0, 0];
    }

    function dotDist(a, b) {
      const v = -dot(a, b);
      return (1 + v / (1 + Math.abs(v))) * 0.4;
    }

    function cos2d(a, b) {
      return dot(a, b) / card(a) / card(b);
    }

    function cosDist(a, b) {
      return ((1 - cos2d(a, b)) * 0.5) / 0.4;
    }

    function l2Dist(a, b) {
      return card(sub(a, b));
    }

    function l1Dist(a, b) {
      return absSum(sub(a, b));
    }

    if (distanceFn === DF_L1) {
      return l1Dist(vecA, vecB);
    }
    if (distanceFn === DF_L2) {
      return l2Dist(vecA, vecB);
    }
    if (distanceFn === DF_COS) {
      return cosDist(vecA, vecB);
    }
    if (distanceFn === DF_DOT) {
      return dotDist(vecA, vecB);
    }
    if (distanceFn === DF_L2_PROJ) {
      return l2Dist(vecA, norm(vecB));
    }
    if (distanceFn === DF_DOT_ADJ) {
      const adjB = [
        (vecB[0] - values.outlineCenter[0]) * values.outlineScale,
        (vecB[1] - values.outlineCenter[1]) * values.outlineScale,
      ];
      return dotDist(vecA, adjB);
    }
    throw new Error(`unknown distance function: ${distanceFn}`);
  }

  getClosest(distanceFn, points, pos, renderValues) {
    const eps = 1e-5; // making sure imprecisions don't fuzz results
    return points.reduce(
      ([closestDist, closestIx], ref, ix) => {
        const curDist = this.getDistance(distanceFn, pos, ref, renderValues);
        if (closestIx < 0 || curDist - closestDist < eps) {
          closestDist = curDist;
          closestIx = ix;
        }
        return [closestDist, closestIx];
      },
      [0, -1],
    );
  }
} // App
