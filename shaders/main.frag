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
#define MAX_DIST 5

#define M_NONE 0
#define M_TOP 1
#define M_TOP_RIGHT 2
#define M_RIGHT 3
#define M_BOTTOM_RIGHT 4
#define M_BOTTOM 5
#define M_BOTTOM_LEFT 6
#define M_LEFT 7
#define M_TOP_LEFT 8

#define M_START (M_TOP)
#define M_STOP (M_TOP_LEFT + 1)
#define M_COUNT (M_STOP - M_START)

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
    return dot(v, vec2(1.));
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

vec2 move(vec2 pos, int direction, int distance) {
    vec2 vout = pos;
    vec2 unit = uUnit * float(distance);
    if(direction == M_TOP_RIGHT || direction == M_RIGHT || direction == M_BOTTOM_RIGHT) {
        vout.x += unit.x;
    }
    if(direction == M_TOP_LEFT || direction == M_LEFT || direction == M_BOTTOM_LEFT) {
        vout.x -= unit.x;
    }
    if(direction == M_TOP_LEFT || direction == M_TOP || direction == M_TOP_RIGHT) {
        vout.y += unit.y;
    }
    if(direction == M_BOTTOM_LEFT || direction == M_BOTTOM || direction == M_BOTTOM_RIGHT) {
        vout.y -= unit.y;
    }
    return vout;
}

float countBoundary(int distanceFn, vec2 pos, int distance, bool includeRef) {
    int center = getClosestIx(distanceFn, pos, includeRef);
    float count = 0.0;
    int total = 0;
    for(int dist = 1; dist <= MAX_DIST; dist += 1) {
        if(dist > distance) {
            break;
        }
        for(int direction = M_START; direction < M_STOP; direction += 1) {
            int other = getClosestIx(distanceFn, move(pos, direction, dist), includeRef);
            count += float(center == other);
            total += 1;
        }
    }
    return count / float(total);
}

bool inRectangle(vec2 topLeft, vec2 bottomRight) {
    return (vPos.x >= topLeft.x) && (vPos.y >= topLeft.y) && (vPos.x <= bottomRight.x) && (vPos.y <= bottomRight.y);
}

float countCircle(vec2 pos, float radius, int distance) {
    float count = 0.0;
    float rad2 = radius * radius;
    int total = 0;
    for(int dist = 1; dist <= MAX_DIST; dist += 1) {
        if(dist > distance) {
            break;
        }
        for(int direction = M_START; direction < M_STOP; direction += 1) {
            vec2 curDiff = move(pos, direction, dist) - vPos;
            count += float((dot(curDiff, curDiff) > rad2));
            total += 1;
        }
    }
    return count / float(total);
}

vec4 fillCircle(vec4 inColor, vec2 pos, float radius, vec4 color, int border) {
    return mix(color, inColor, countCircle(pos, radius, border));
}

vec4 drawCircle(vec4 inColor, vec2 pos, float radius, vec4 color, int border) {
    return mix(color, inColor, abs(countCircle(pos, radius, border) - .5) * 2.);
}

void main(void) {
    int distanceFn = uDistanceFn;

    // Main Background
    vec2 closest = getClosest(distanceFn, vPos, true);
    int closestIx = getIx(closest);
    float distNorm = clamp(getDist(closest), 0., 1.);
    gl_FragColor = (closestIx < 0) ? vec4(.5, .5, distNorm, 1.) : vec4(distNorm, distNorm, distNorm, 1.);

    // Unit Circle
    gl_FragColor = drawCircle(gl_FragColor, vec2(0.), 1., vec4(0., 1., 0., 1.), 5);

    // Boundaries
    float crossings = countBoundary(distanceFn, vPos, 5, true);
    gl_FragColor = mix(vec4(1., 0., 0., 1.), gl_FragColor, crossings);

    // Point Dots
    int nearestIx = getClosestIx(DF_L2, vPos, uFixedRef != 0);
    vec2 nearestPos = getPointPos(nearestIx);
    vec4 nearestColor = nearestIx < 0 ? vec4(1., 1., 0., 1.) : vec4(0., 1., 1., 1.);
    gl_FragColor = fillCircle(gl_FragColor, nearestPos, uUnit.x * 10., nearestColor, 2);

    // Projected Dots
    int projIx = getClosestIx(DF_COS, vPos, true);
    vec2 projPos = getPointPos(projIx);
    projPos /= card(projPos);
    vec4 projColor = projIx < 0 ? vec4(.5, 1., .5, 1.) : vec4(1., .5, .5, 1.);
    gl_FragColor = fillCircle(gl_FragColor, projPos, uUnit.x * 10., projColor, 2);

    // Grid
    if(uShowGrid != 0) {
        if((mod(vPos.x, 2.0) < 1.0) != mod(vPos.y, 2.0) < 1.0) {
            gl_FragColor.xyz = 1.0 - gl_FragColor.xyz;
        }
    }
}
