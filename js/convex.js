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

if (!Array.prototype.toSorted) {
  /* eslint no-extend-native: off */
  Array.prototype.toSorted = function (
    /** @type {((a: any, b: any) => number) | undefined} */ compareFn,
  ) {
    const arr = [...this];
    arr.sort(compareFn);
    return arr;
  };
}

class Point {
  constructor(/** @type {number[]} */ pos) {
    /** @type {number} */
    this._x = pos[0];
    /** @type {number} */
    this._y = pos[1];
  }

  asKey() {
    return JSON.stringify(this.asArray());
  }

  asArray() {
    return [this.x(), this.y()];
  }

  x() {
    return this._x;
  }

  y() {
    return this._y;
  }

  relTo(/** @type {Point} */ other, /** @type {Point} */ rel) {
    const from = this;
    const to = other;
    const pA = (to.x() - from.x()) * (from.y() - rel.y());
    const pB = (rel.x() - from.x()) * (from.y() - to.y());
    return Math.sign(pA - pB);
  }

  isEmpty(/** @type {Point} */ to) {
    const from = this;
    return from.x() === to.x() && from.y() === to.y();
  }
} // Point

export default class ConvexHull {
  createLines(/** @type {number[][]} */ points) {
    if (points.length <= 2) {
      return points.map((p) => new Point(p));
    }
    /** @type {Map<string, Point>} */
    const ps = new Map();
    /** @type {Point | null} */
    let ref = null;
    points.forEach((pos) => {
      const point = new Point(pos);
      ps.set(point.asKey(), point);
      if (
        ref === null ||
        point.y() > ref.y() ||
        (point.y() === ref.y() && point.x() < ref.x())
      ) {
        ref = point;
      }
    });
    return this.grahamScan(this.sortPolar([...ps.values()], ref));
  }

  createLinesArray(/** @type {number[][]} */ points) {
    return this.createLines(points).map((p) => {
      return p.asArray();
    });
  }

  sortPolar(/** @type {Point[]} */ points, /** @type {Point} */ ref) {
    return points.toSorted(
      (/** @type {Point} */ o1, /** @type {Point} */ o2) => {
        if (ref.isEmpty(o1)) return -1;
        if (ref.isEmpty(o2)) return 1;
        return -ref.relTo(o1, o2);
      },
    );
  }

  grahamScan(/** @type {Point[]} */ points) {
    const res = [points[1], points[0]];
    let ix = 2;
    while (ix < points.length) {
      const p1 = res[0];
      const si = points[ix];
      if (res.length > 1) {
        const p2 = res[1];
        if (p2.isEmpty(p1) || p2.relTo(p1, si) <= 0) {
          res.shift();
          continue;
        }
      }
      res.unshift(si);
      ix += 1;
    }
    return res;
  }
} // ConvexHull
