import ConvexHull from './convex.js';
import {
  convertMousePosition,
  convertTouchPosition,
  loadImage,
  precision,
} from './misc.js';
import PixelCanvas from './pixelcanvas.js';

const MAX_POINTS = 36;

export const DF_L1 = 'L1';
export const DF_L2 = 'L2';
export const DF_COS = 'Cos';
export const DF_DOT = 'Dot';
export const DF_L2_PROJ = 'Unit L2';
const DFS = [DF_L1, DF_L2, DF_COS, DF_DOT, DF_L2_PROJ];

export default class App extends PixelCanvas {
  constructor(canvasId, topbarId, bottombarId, errorId, settings) {
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
    this.ch = new ConvexHull();
    this.settings = {
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
      ...settings,
    };
  }

  async setup() {
    const watermark = await loadImage('./img/watermark.png');
    const settings = this.settings;
    const distanceFn = DFS.indexOf(settings.distanceFn);
    const dfs = settings.metrics;

    this.addValue('wm', 'uWM', 'image', watermark);
    this.addValue('areaMode', 'uAreaMode', 'bool', false);
    this.addValue('showGrid', 'uShowGrid', 'bool', false);
    this.addValue('showCursor', 'uShowCursor', 'bool', false);
    this.addValue('unitCircle', 'uUnitCircle', 'bool', settings.unitCircle);
    this.addValue('convexHull', 'uConvexHull', 'bool', settings.convexHull);
    this.addValue('refPosition', 'uRefPosition', '2d', [0.01, 0.01]);
    this.addValue('distanceFn', 'uDistanceFn', 'enum', distanceFn);
    this.addValue('correction', 'uCorrection', 'range', 2.5);
    this.addValue('points', 'uPoints', 'array2d', settings.points);
    this.addValue('outline', 'uOutline', 'array2d', []);
    this.addPrerenderHook((values) => {
      values.outline = this.ch.createLinesArray(values.points);
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
        if (e.target) {
          e.target.blur();
        }
        e.preventDefault();
      }
    });

    const onShift = (e) => {
      if (this.isTextTarget(e.target)) {
        return;
      }
      if (e.key === 'Shift') {
        this.updateValue({
          areaMode: e.shiftKey,
        });
        if (e.target) {
          e.target.blur();
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onShift);
    window.addEventListener('keyup', onShift);

    const canvas = this.getCanvas();
    canvas.addEventListener('touchmove', (e) => {
      const refPosition = convertTouchPosition(
        this.getCanvas(),
        this.getMeasures(),
        e,
      );
      this.updateValue({
        refPosition,
      });
      e.preventDefault();
    });
    canvas.addEventListener('mousemove', (e) => {
      const refPosition = convertMousePosition(
        this.getCanvas(),
        this.getMeasures(),
        e,
      );
      this.updateValue({
        refPosition,
      });
    });
    canvas.addEventListener('click', (e) => {
      const refPosition = convertMousePosition(
        this.getCanvas(),
        this.getMeasures(),
        e,
      );
      const values = this.getValues();
      const points = [...values.points];
      if (values.areaMode) {
        const [_, ix] = this.getClosest(
          DFS[values.distanceFn],
          values.points,
          refPosition,
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
      const [dist, _] = this.getClosest(
        DFS[values.distanceFn],
        values.points,
        values.refPosition,
      );
      const distText = `Dist:${precision(dist * values.correction, 5)}`;
      return `${distText} ${posText}`;
    });

    this.addVisibilityCheck();

    await super.setup();
  }

  getDistance(distanceFn, vecA, vecB) {
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
    throw new Error(`unknown distance function: ${distanceFn}`);
  }

  getClosest(distanceFn, points, pos) {
    const eps = 1e-5; // making sure imprecisions don't fuzz results
    return points.reduce(
      ([closestDist, closestIx], ref, ix) => {
        const curDist = this.getDistance(distanceFn, pos, ref);
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
