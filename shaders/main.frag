precision highp float;

uniform highp vec2 uUnit;
uniform highp vec2 uRefPosition;
uniform highp float uDistFactor;
uniform int uFixedRef;
uniform int uShowGrid;
uniform int uDistanceFn;
uniform sampler2D uPointsTex;
uniform int uPointsSize;
uniform int uPointsCount;

varying highp vec2 vPos;

#define PI 3.141592653589793238462643383279502884
#define MAX_LOOP 100

#define TOP 1
#define RIGHT 2
#define BOTTOM 3
#define LEFT 4

#define DF_L1 0
#define DF_L2 1
#define DF_DOT 2
#define DF_COS 3

float card(vec2 v) {
    return sqrt(dot(v, v));
}

float dotDist(vec2 a, vec2 b) {
    return exp(-dot(a, b));
}

float cos2d(vec2 a, vec2 b) {
    return dot(a, b) / card(a) / card(b);
}

float cosDist(vec2 a, vec2 b) {
    return (1. - cos2d(a, b)) * .5;
}

float normLog(float v) {
    return 1. - 1. / pow(2., log(1. + v));
}

float normAtan(float v) {
    return 2. * atan(v) / PI;
}

float sumAll(vec2 v) {
    return dot(v, vec2(1., 1.));
}

float l2Dist(vec2 a, vec2 b) {
    vec2 res = a - b;
    return sqrt(dot(res, res));
}

float l1Dist(vec2 a, vec2 b) {
    vec2 res = abs(a - b);
    return sumAll(res);
}

float getDistance(int distanceFn, vec2 a, vec2 b) {
    if(distanceFn == DF_L1) {
        return l1Dist(a, b);
    }
    if(distanceFn == DF_L2) {
        return l2Dist(a, b);
    }
    if(distanceFn == DF_DOT) {
        return dotDist(a, b);
    }
    if(distanceFn == DF_COS) {
        return cosDist(a, b);
    }
    return 0.;
}

vec2 getPointPos(int ix) {
    if(ix < 0) {
        return uRefPosition;
    }
    float size = float(uPointsSize);
    float xpos = (mod(float(ix), size) + .5) / size;
    float ypos = (floor(float(ix) / size) + .5) / size;
    return texture2D(uPointsTex, vec2(xpos, ypos)).xy;
}

vec2 getClosest(int distanceFn, vec2 pos, bool includeRef) {
    float distNorm = 1.;
    int closestIx = -1;
    if(includeRef) {
        distNorm = getDistance(distanceFn, pos, uRefPosition);
        closestIx = -2;
    }
    for(int ix = 0; ix < MAX_LOOP; ix += 1) {
        if(ix >= uPointsCount) {
            break;
        }
        vec2 ref = getPointPos(ix);
        float curDist = getDistance(distanceFn, pos, ref);
        if(curDist < distNorm) {
            distNorm = curDist;
            closestIx = ix;
        }
    }
    return vec2(uDistFactor * distNorm, float(closestIx) + .5);
}

int getIx(vec2 distAndIx) {
    return int(distAndIx.y);
}

int getClosestIx(int distanceFn, vec2 pos, bool includeRef) {
    return getIx(getClosest(distanceFn, pos, includeRef));
}

float getDist(vec2 distAndIx) {
    return distAndIx.x;
}

vec2 getNext(vec2 pos, int direction) {
    vec2 vout = pos;
    vec2 unit = uUnit * 2.;
    if(direction == RIGHT) {
        vout.x += unit.x;
    }
    if(direction == LEFT) {
        vout.x -= unit.x;
    }
    if(direction == TOP) {
        vout.y += unit.y;
    }
    if(direction == BOTTOM) {
        vout.y -= unit.y;
    }
    return vout;
}

vec2 mTop(vec2 pos) {
    return getNext(pos, TOP);
}

vec2 mTopRight(vec2 pos) {
    return getNext(getNext(pos, TOP), RIGHT);
}

vec2 mRight(vec2 pos) {
    return getNext(pos, RIGHT);
}

vec2 mBottomRight(vec2 pos) {
    return getNext(getNext(pos, BOTTOM), RIGHT);
}

vec2 mBottom(vec2 pos) {
    return getNext(pos, BOTTOM);
}

vec2 mBottomLeft(vec2 pos) {
    return getNext(getNext(pos, BOTTOM), LEFT);
}

vec2 mLeft(vec2 pos) {
    return getNext(pos, LEFT);
}

vec2 mTopLeft(vec2 pos) {
    return getNext(getNext(pos, TOP), LEFT);
}

float countBoundary(int distanceFn, vec2 pos, bool includeRef) {
    int center = getClosestIx(distanceFn, pos, includeRef);
    int top = getClosestIx(distanceFn, mTop(pos), includeRef);
    int topRight = getClosestIx(distanceFn, mTopRight(pos), includeRef);
    int right = getClosestIx(distanceFn, mRight(pos), includeRef);
    int bottomRight = getClosestIx(distanceFn, mBottomRight(pos), includeRef);
    int bottom = getClosestIx(distanceFn, mBottom(pos), includeRef);
    int bottomLeft = getClosestIx(distanceFn, mBottomLeft(pos), includeRef);
    int left = getClosestIx(distanceFn, mLeft(pos), includeRef);
    int topLeft = getClosestIx(distanceFn, mTopLeft(pos), includeRef);
    return (float(center == top) + float(center == topRight) + float(center == right) + float(center == bottomRight) + float(center == bottom) + float(center == bottomLeft) + float(center == left) + float(center == topLeft)) / 8.;
}

bool inRectangle(vec2 topLeft, vec2 bottomRight) {
    return (vPos.x >= topLeft.x) && (vPos.y >= topLeft.y) && (vPos.x <= bottomRight.x) && (vPos.y <= bottomRight.y);
}

vec4 drawCircle(vec4 inColor, vec2 pos, float radius, vec4 color) {
    if(!inRectangle(pos - vec2(radius, radius), pos + vec2(radius, radius))) {
        return inColor;
    }
    if(dot(pos - vPos, pos - vPos) > radius * radius) {
        return inColor;
    }
    return color;
}

void main(void) {
    int distanceFn = uDistanceFn;

    // Main Background
    vec2 closest = getClosest(distanceFn, vPos, true);
    int closestIx = getIx(closest);
    float distNorm = clamp(getDist(closest), 0., 1.);
    gl_FragColor = (closestIx < 0) ? vec4(.5, .5, distNorm, 1.) : vec4(distNorm, distNorm, distNorm, 1.);

    // Boundaries
    float crossings = countBoundary(distanceFn, vPos, true);
    gl_FragColor = mix(vec4(1., 0., 0., 1.), gl_FragColor, crossings);

    // Point Dots
    int nearestIx = getClosestIx(DF_L2, vPos, uFixedRef != 0);
    vec2 nearestPos = getPointPos(nearestIx);
    vec4 nearestColor = nearestIx < 0 ? vec4(1., 1., 0., 1.) : vec4(0., 1., 1., 1.);
    gl_FragColor = drawCircle(gl_FragColor, nearestPos, uUnit.x * 10., nearestColor);

    // Grid
    if(uShowGrid != 0) {
        if((mod(vPos.x, 2.0) < 1.0) != mod(vPos.y, 2.0) < 1.0) {
            gl_FragColor.xyz = 1.0 - gl_FragColor.xyz;
        }
    }
}
