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

import App, { DF_DOT, DF_DOT_ADJ } from './js/app.js';

new App('#main', '#header', '#footer', '#topbar', '#bottombar', '#error', {
  title: 'Adjusted Dot Product',
  unitCircle: true,
  allowUnitCircle: true,
  convexHull: true,
  allowConvexHull: true,
  distanceFn: DF_DOT_ADJ,
  metrics: [DF_DOT, DF_DOT_ADJ],
  points: [
    [-1.1, 0.6],
    [-1.3, 0.7],
    [-1.4, 0.8],
    [-1.4, 1.0],
    [-1.0, 0.9],
    [-1.0, 0.8],
  ],
  initRefPos: [-1.2, 0.8],
}).repaintWhenReady();
