import { useThree } from '@react-three/fiber';
import { FC, useEffect, useRef } from 'react';
import { Camera, Vector2, Vector3 } from 'three';
import { Vector2Dimensions } from './internal_types';
import { getLassoMesh } from './utils/gl-utils';

function ConvexHullGrahamScan() {
  //@ts-ignore
  this.anchorPoint = undefined;
  //@ts-ignore
  this.reverse = false;
  //@ts-ignore
  this.points = [];
}

ConvexHullGrahamScan.prototype = {
  constructor: ConvexHullGrahamScan,

  //@ts-expect-error
  Point: function (x, y) {
    this.x = x;
    this.y = y;
  },
  //@ts-expect-error
  _findPolarAngle: function (a, b) {
    var ONE_RADIAN = 57.295779513082;
    var deltaX, deltaY;
    // if the points are undefined, return a zero difference angle.
    if (!a || !b) return 0;
    deltaX = b.x - a.x;
    deltaY = b.y - a.y;
    if (deltaX == 0 && deltaY == 0) return 0;
    var angle = Math.atan2(deltaY, deltaX) * ONE_RADIAN;
    if (this.reverse) {
      if (angle <= 0) angle += 360;
    } else {
      if (angle >= 0) angle += 360;
    }
    return angle;
  },
  //@ts-expect-error
  addPoint: function (x, y) {
    // check for a new anchor
    var newAnchor =
      this.anchorPoint === undefined ||
      this.anchorPoint.y > y ||
      (this.anchorPoint.y === y && this.anchorPoint.x > x);
    if (newAnchor) {
      if (this.anchorPoint !== undefined) {
        this.points.push(
          new this.Point(this.anchorPoint.x, this.anchorPoint.y)
        );
      }
      this.anchorPoint = new this.Point(x, y);
    } else {
      this.points.push(new this.Point(x, y));
    }
  },

  _sortPoints: function () {
    var self = this;
    //@ts-expect-error
    return this.points.sort(function (a, b) {
      var polarA = self._findPolarAngle(self.anchorPoint, a);
      var polarB = self._findPolarAngle(self.anchorPoint, b);
      if (polarA < polarB) return -1;
      if (polarA > polarB) return 1;
      return 0;
    });
  },
  //@ts-expect-error
  _checkPoints: function (p0, p1, p2) {
    var difAngle;
    var cwAngle = this._findPolarAngle(p0, p1);
    var ccwAngle = this._findPolarAngle(p0, p2);
    if (cwAngle > ccwAngle) {
      difAngle = cwAngle - ccwAngle;
      return !(difAngle > 180);
    } else if (cwAngle < ccwAngle) {
      difAngle = ccwAngle - cwAngle;
      return difAngle > 180;
    }
    return true;
  },

  getHull: function () {
    var hullPoints = [],
      points,
      pointsLength;
    this.reverse = this.points.every(function (point: any) {
      return point.x < 0 && point.y < 0;
    });
    points = this._sortPoints();
    pointsLength = points.length;
    // if there are less than 3 points, joining these points creates a correct hull.
    if (pointsLength < 3) {
      points.unshift(this.anchorPoint);
      return points;
    }
    // move first two points to output array
    hullPoints.push(points.shift(), points.shift());
    // scan is repeated until no concave points are present.
    while (true) {
      var p0, p1, p2;
      hullPoints.push(points.shift());
      p0 = hullPoints[hullPoints.length - 3];
      p1 = hullPoints[hullPoints.length - 2];
      p2 = hullPoints[hullPoints.length - 1];
      if (this._checkPoints(p0, p1, p2)) {
        hullPoints.splice(hullPoints.length - 2, 1);
      }
      if (points.length == 0) {
        if (pointsLength == hullPoints.length) {
          // check for duplicate anchorPoint edge-case, if not found, add the anchorpoint as the first item.
          var ap = this.anchorPoint;
          // remove any udefined elements in the hullPoints array.
          hullPoints = hullPoints.filter(function (p) {
            return !!p;
          });
          if (
            !hullPoints.some(function (p) {
              return p.x == ap.x && p.y == ap.y;
            })
          ) {
            hullPoints.unshift(this.anchorPoint);
          }
          return hullPoints;
        }
        points = hullPoints;
        pointsLength = points.length;
        hullPoints = [];
        hullPoints.push(points.shift(), points.shift());
      }
    }
  },
};

function getEventWorldOffset(e: any) {
  var rect = e.target.getBoundingClientRect(),
    dx = (e.clientX || e.pageX) - rect.left,
    dy = (e.clientY || e.pageY) - rect.top,
    offsets = { x: dx, y: dy };
  return offsets;
}

function screenToWorldCoords(
  pos: any,
  canvasSize: Vector2Dimensions,
  camera: Camera
) {
  var vector = new Vector3(),
    mouse = new Vector2(),
    // convert from screen to clip space
    x = (pos.x / canvasSize.width) * 2 - 1,
    y = -(pos.y / canvasSize.height) * 2 + 1;

  // project the screen location into world coords
  vector.set(x, y, 0.5);
  vector.unproject(camera);

  var direction = vector.sub(camera.position).normalize(),
    distance = -camera.position.z / direction.z,
    scaled = direction.multiplyScalar(distance),
    coords = camera.position.clone().add(scaled);

  return coords;
}

const Lasso: FC<any> = ({ enabled, controls }) => {
  const {
    gl: { domElement },
    size,
    camera,
    scene,
  } = useThree();
  const lassoRef = useRef<any>();
  const lassoState = useRef({
    capturing: false,
    frozen: false,
    lassoStartCoords: [],
    points: [],
    mesh: null,
  });

  //@ts-expect-error
  const removeMesh = () => scene.remove(lassoState.current.mesh);

  const draw = function () {
    if (lassoState.current.points.length < 4) return;
    lassoState.current.points = getHull();
    // remove the old mesh
    removeMesh();
    // get the indices of images that are inside the polygon
    // lassoState.current.selected = lassoState.current.getSelectedMap();
    // var indices = [],
    //   keys = Object.keys(lassoState.current.selected);
    // for (var i = 0; i < keys.length; i++) {
    //   if (lassoState.current.selected[keys[i]]) indices.push(i);
    // }
    // if (indices.length) {
    //   // hide the modal describing the lasso behavior
    //   world.hideSelectTooltip();
    //   // allow users to see the selected images if desired
    //   lassoState.current.elems.viewSelectedContainer.style.display = 'block';
    //   lassoState.current.elems.countTarget.textContent = indices.length;
    //   // allow cluster persistence
    //   data.hotspots.setCreateHotspotVisibility(true);
    // }
    // indicate the number of cells that are selected
    // lassoState.current.setNSelected(indices.length);
    // // illuminate the points that are inside the polyline
    // world.setBorderedImages(indices);

    // obtain and store a mesh, then add the mesh to the scene
    //@ts-expect-error
    lassoState.current.mesh = getLassoMesh(lassoState.current.points);
    //@ts-expect-error
    scene.add(lassoState.current.mesh);
  };

  const getHull = function () {
    //@ts-expect-error
    const l = new ConvexHullGrahamScan();
    for (var i = 0; i < lassoState.current.points.length; i++) {
      l.addPoint(
        //@ts-expect-error
        lassoState.current.points[i].x,
        //@ts-expect-error
        lassoState.current.points[i].y
      );
    }
    var hull = l.getHull();
    return hull;
  };

  const onMouseDown = (e: any) => {
    const mousedownCoords = {
      x: e.clientX || e.pageX,
      y: e.clientY || e.pageY,
    };

    //@ts-expect-error
    lassoState.current.lassoStartCoords = mousedownCoords;
    lassoState.current.capturing = true;
    lassoState.current.frozen = false;
  };

  const onMouseUp = (e: any) => {
    if (!enabled) return;

    if (
      //@ts-expect-error
      (e.clientX || e.pageX) === lassoState.current.lassoStartCoords.x &&
      //@ts-expect-error
      (e.clientY || e.pageY) === lassoState.current.lassoStartCoords.y
    ) {
      scene.remove(lassoState.current.mesh as any);
      lassoState.current.points = [];
    }

    // lassoState.current.frozen = true;
    lassoState.current.capturing = false;
  };

  const onMouseMove = (e: any) => {
    if (!lassoState.current.capturing || lassoState.current.frozen) return;

    const offset = getEventWorldOffset(e);
    lassoState.current.points = [
      //@ts-expect-error
      ...lassoState.current.points,
      //@ts-expect-error
      screenToWorldCoords(offset, size, camera),
    ];
    draw();
  };

  useEffect(() => {
    if (controls) controls.noPan = true;
  }, [controls]);

  useEffect(() => {
    domElement?.addEventListener('mousedown', onMouseDown);
    domElement?.addEventListener('mouseup', onMouseUp);
    domElement?.addEventListener('mousemove', onMouseMove);
    return () => {
      domElement?.removeEventListener('mousedown', onMouseDown);
      domElement?.removeEventListener('mouseup', onMouseUp);
      domElement?.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return null;
};

export default Lasso;
