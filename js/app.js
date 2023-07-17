import ConvexHull from './convex.js';
import { convertMousePosition, loadImage, precision } from './misc.js';
import PixelCanvas from './pixelcanvas.js';

export default class App extends PixelCanvas {
  constructor(canvasId, topbarId, bottombarId, errorId) {
    super(
      canvasId,
      topbarId,
      bottombarId,
      errorId,
      '/shaders/main.vert',
      '/shaders/main.frag',
      800,
      600,
      1.0,
    );
    this.ch = new ConvexHull();
  }

  async setup() {
    const watermark = await loadImage('img/watermark.png');

    this.addValue('wm', 'uWM', 'image', watermark);
    this.addValue('areaMode', 'uAreaMode', 'bool', false);
    this.addValue('showGrid', 'uShowGrid', 'bool', false);
    this.addValue('unitCircle', 'uUnitCircle', 'bool', true);
    this.addValue('convexHull', 'uConvexHull', 'bool', true);
    this.addValue('refPosition', 'uRefPosition', '2d', [0.01, 0.01]);
    this.addValue('distanceFn', 'uDistanceFn', 'enum', 1); //2);
    this.addValue('distFactor', 'uDistFactor', 'range', 2.5);
    this.addValue('points', 'uPoints', 'array2d', [
      [0.4, 0.2],
      [-0.5, 0.8],
      [-0.8, -0.4],
      [0.2, -0.6],
      [0.3, 0.3],
      [-0.4, 0.2],
    ]);
    this.addValue('outline', 'uOutline', 'array2d', []);
    this.addPrerenderHook((values) => {
      values.outline = this.ch.createLinesArray(values.points);
      return values;
    });

    const onShift = (e) => {
      if (e.key == 'Shift') {
        this.updateValue({
          areaMode: e.shiftKey,
        });
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onShift);
    window.addEventListener('keyup', onShift);

    const canvas = this.getCanvas();
    canvas.addEventListener('mousemove', (e) => {
      this.updateValue({
        refPosition: convertMousePosition(
          this.getCanvas(),
          this.getMeasures(),
          e,
        ),
      });
    });
    canvas.addEventListener('click', (e) => {
      const values = this.getValues();
      // TODO click
      this.updateValue({
        refPosition: convertMousePosition(
          this.getCanvas(),
          this.getMeasures(),
          e,
        ),
      });
    });

    this.addControl('distanceFn', 'Distance Function', {
      options: [
        { value: '0', text: 'L1' },
        { value: '1', text: 'L2' },
        { value: '2', text: 'Dot' },
        { value: '3', text: 'Cos' },
      ],
    });
    this.addControl('showGrid', 'Show Grid', {});
    this.addControl('unitCircle', 'Unit', {});
    this.addControl('convexHull', 'CH', {});
    this.addControl('distFactor', 'Distance Scale', {
      min: 0.01,
      max: 10.0,
      step: 0.01,
    });
    this.addViewportControl('View Range', {
      min: 1.0,
      max: 10.0,
      step: 1.0,
    });

    this.addCapture('Save', 'S');
    this.addVideoCapture('Record', 'Stop', 'J', 'K');

    const tpfSum = [];
    let refTime = 0;
    this.addPrerenderHook((values) => {
      refTime = performance.now();
      return values;
    });
    this.addStatus((values) => {
      const tpf = performance.now() - refTime;
      tpfSum.push(tpf);
      if (tpfSum.length > 100) {
        tpfSum.shift();
      }
      const avgFps = tpfSum.length / tpfSum.reduce((s, v) => s + v, 0);
      const avgFpsText = `FPS: ${avgFps.toPrecision(3)}`;
      const [x, y] = values.refPosition;
      const posText = `Pos: ${precision(x, 5)} ${precision(y, 5)}`;
      return `${avgFpsText} ${posText}`;
    });

    this.addVisibilityCheck();

    await super.setup();
  }

  getClosest(pos, points, distanceFn) {
    //   float card(vec2 v) {
    //     return sqrt(dot(v, v));
    // }
    // float dotDist(vec2 a, vec2 b) {
    //     return exp(-dot(a, b));
    // }
    // float cos2d(vec2 a, vec2 b) {
    //     return dot(a, b) / card(a) / card(b);
    // }
    // float cosDist(vec2 a, vec2 b) {
    //     return (1. - cos2d(a, b)) * .5;
    // }
    // float sumAll(vec2 v) {
    //     return dot(v, vec2(1.));
    // }
    // float l2Dist(vec2 a, vec2 b) {
    //     vec2 res = a - b;
    //     return sqrt(dot(res, res));
    // }
    // float l1Dist(vec2 a, vec2 b) {
    //     vec2 res = abs(a - b);
    //     return sumAll(res);
    // }
    // float getDistance(int distanceFn, vec2 a, vec2 b) {
    //     if(distanceFn == DF_L1) {
    //         return l1Dist(a, b);
    //     }
    //     if(distanceFn == DF_L2) {
    //         return l2Dist(a, b);
    //     }
    //     if(distanceFn == DF_DOT) {
    //         return dotDist(a, b);
    //     }
    //     if(distanceFn == DF_COS) {
    //         return cosDist(a, b);
    //     }
    //     return 0.;
    // }
    // vec2 getClosest(int distanceFn, vec2 pos, bool includeRef) {
    //     float distNorm = 0.;
    //     int closestIx = -1;
    //     if(includeRef) {
    //         distNorm = getDistance(distanceFn, pos, uRefPosition);
    //         closestIx = -2;
    //     }
    //     float eps = 1e-5;  // making sure imprecisions don't fuzz results
    //     for(int ix = 0; ix < MAX_LOOP; ix += 1) {
    //         if(ix >= uPointsCount) {
    //             break;
    //         }
    //         vec2 ref = getPointPos(ix);
    //         float curDist = getDistance(distanceFn, pos, ref);
    //         if(closestIx == -1 || curDist + eps < distNorm) {
    //             distNorm = curDist;
    //             closestIx = ix;
    //         }
    //     }
    //     return vec2(uDistFactor * distNorm, float(closestIx) + .5);
    // }
  }
} // App
