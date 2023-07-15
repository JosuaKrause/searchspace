import ConvexHull from './convex.js';
import { convertMousePosition, loadImage } from './misc.js';
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
    await super.setup();
    const watermark = await loadImage('img/watermark.png');

    this.addValue('wm', 'uWM', 'image', watermark);
    this.addValue('fixedRef', 'uFixedRef', 'bool', false);
    this.addValue('showGrid', 'uShowGrid', 'bool', false);
    this.addValue('unitCircle', 'uUnitCircle', 'bool', true);
    this.addValue('convexHull', 'uConvexHull', 'bool', true);
    this.addValue('refPosition', 'uRefPosition', '2d', [0.01, 0.01]);
    this.addValue('distanceFn', 'uDistanceFn', 'enum', 2);
    this.addValue('distFactor', 'uDistFactor', 'range', 2.5);
    this.addValue('points', 'uPoints', 'array2d', [
      // [4.0, 2.0],
      // [-6.0, 8.0],
      // [-8.0, -4.0],
      // [2.0, -6.0],
      [0.4, 0.2],
      [-0.5, 0.8],
      [-0.8, -0.4],
      [0.2, -0.6],
      [0.3, 0.3],
      [-0.4, 0.2],
    ]);
    this.addValue('outline', 'uOutline', 'array2d', []);

    const canvas = this.getCanvas();
    canvas.addEventListener('mousemove', (e) => {
      const values = this.getValues();
      if (!values.fixedRef) {
        this.updateValue({
          refPosition: convertMousePosition(
            this.getCanvas(),
            this.getMeasures(),
            e,
          ),
        });
      }
    });
    canvas.addEventListener('click', (e) => {
      const values = this.getValues();
      this.updateValue({
        refPosition: convertMousePosition(
          this.getCanvas(),
          this.getMeasures(),
          e,
        ),
        fixedRef: !values.fixedRef,
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
    this.addCapture('Save');
  }

  prerender(values) {
    values.outline = this.ch.createLinesArray(values.points);
    return values;
  }
} // App
