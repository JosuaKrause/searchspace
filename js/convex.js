class Point {
  constructor(pos) {
    this._x = pos[0];
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

  relTo(other, rel) {
    const from = this;
    const to = other;
    const pA = (to.x() - from.x()) * (from.y() - rel.y());
    const pB = (rel.x() - from.x()) * (from.y() - to.y());
    return Math.sign(pA - pB);
  }

  isEmpty(to) {
    const from = this;
    return from.x() === to.x() && from.y() === to.y();
  }
} // Point

export default class ConvexHull {
  createLines(points) {
    if (points.length <= 2) {
      return points.map((p) => new Point(p));
    }
    const ps = new Map();
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

  createLinesArray(points) {
    return this.createLines(points).map((p) => {
      return p.asArray();
    });
  }

  sortPolar(points, ref) {
    return points.toSorted((o1, o2) => {
      if (ref.isEmpty(o1)) return -1;
      if (ref.isEmpty(o2)) return 1;
      return -ref.relTo(o1, o2);
    });
  }

  grahamScan(points) {
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
