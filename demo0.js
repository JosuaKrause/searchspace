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

import App, { DF_L1, DF_L2 } from './js/app.js';

new App('#main', '#header', '#footer', '#topbar', '#bottombar', '#error', {
  title: 'L2 and L1 Distance Functions',
  unitCircle: false,
  allowUnitCircle: false,
  convexHull: false,
  allowConvexHull: false,
  distanceFn: DF_L2,
  metrics: [DF_L1, DF_L2],
}).repaintWhenReady();
