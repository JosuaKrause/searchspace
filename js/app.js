import { convertMousePosition } from './misc.js';
import PixelCanvas from './pixelcanvas.js';

export default class App extends PixelCanvas {
  constructor(canvasId, topbarId, errorId) {
    super(
      canvasId,
      topbarId,
      errorId,
      '/shaders/main.vert',
      '/shaders/main.frag',
      800,
      600,
      10.0,
    );
  }

  setup() {
    super.setup();

    this.addValue('fixedRef', 'uFixedRef', 'bool', false);
    this.addValue('showGrid', 'uShowGrid', 'bool', false);
    this.addValue('refPosition', 'uRefPosition', '2d', [0.01, 0.01]);
    this.addValue('distanceFn', 'uDistanceFn', 'enum', 3);
    this.addValue('distFactor', 'uDistFactor', 'range', 0.25);
    this.addValue('points', 'uPoints', 'array2d', [
      // [4.0, 2.0],
      // [-6.0, 8.0],
      // [-8.0, -4.0],
      // [2.0, -6.0],
      [0.4, 0.2],
      [-0.6, 0.8],
      [-0.8, -0.4],
      [0.2, -0.6],
    ]);

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
  }
} // App
