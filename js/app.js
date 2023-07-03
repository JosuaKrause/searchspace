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
    );
  }

  setup() {
    super.setup();

    this.addValue('fixedRef', 'uFixedRef', 'bool', false);
    this.addValue('showGrid', 'uShowGrid', 'bool', false);
    this.addValue('refPosition', 'uRefPosition', '2d', [0.0, 0.0]);
    this.addValue('distanceFn', 'uDistanceFn', 'enum', 3);
    this.addValue('points', 'uPoints', 'array2d', [
      [4.0, 2.0],
      [-6.0, 8.0],
      [-8.0, -4.0],
      [2.0, -6.0],
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
  }
} // App
