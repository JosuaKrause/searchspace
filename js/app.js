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

    const fpsSum = [];
    let refTime = 0;
    this.addPrerenderHook((values) => {
      refTime = performance.now();
      return values;
    });
    this.addStatus((values) => {
      const fps = 1 / (performance.now() - refTime);
      if (Number.isFinite(fps)) {
        fpsSum.push(fps);
        if (fpsSum.length > 100) {
          fpsSum.shift();
        }
      }
      const avgFps = fpsSum.reduce((p, v) => p + v, 0) / fpsSum.length;
      const avgFpsText = `FPS: ${avgFps.toPrecision(3)}`;
      const [x, y] = values.refPosition;
      const posText = `Pos: ${precision(x, 5)} ${precision(y, 5)}`;
      return `${avgFpsText} ${posText}`;
    });

    this.addVisibilityCheck();

    await super.setup();
  }
} // App
