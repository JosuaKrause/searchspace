precision highp float;

uniform highp vec2 uUnit;
uniform highp vec2 uScreenSize;
uniform highp vec2 uRefPosition;
uniform highp float uDistFactor;
uniform int uFixedRef;
uniform int uShowGrid;
uniform int uUnitCircle;
uniform int uConvexHull;
uniform int uDistanceFn;

uniform sampler2D uPointsTex;
uniform int uPointsSize;
uniform int uPointsCount;

uniform sampler2D uOutlineTex;
uniform int uOutlineSize;
uniform int uOutlineCount;

uniform sampler2D uWMTex;
uniform vec2 uWMSize;

varying highp vec2 vPos;
varying highp vec2 sPos;

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

const vec4 COLOR_DIST_NEAR = vec4(.0313, .3164, .6094, 1.);
const vec4 COLOR_DIST_FAR = vec4(.9336, .9492, .9961, 1.);
const vec4 COLOR_REF_NEAR = vec4(.6445, .0586, .0820, 1.);
const vec4 COLOR_REF_FAR = vec4(.9922, .8945, .8477, 1.);

const vec4 COLOR_UNIT = vec4(.3203, .3203, .3203, 1.);
const vec4 COLOR_BOUNDARY = vec4(.7383, .0000, .1484, 1.);
const vec4 COLOR_CH = vec4(.0313, .1133, .3438, 1.);

const vec4 COLOR_POINT = vec4(.2539, .7109, .7656, 1.);
const vec4 COLOR_POINT_REF = vec4(.9883, .5508, .2344, 1.);
const vec4 COLOR_PROJ = vec4(.3203, .3203, .3203, 1.);
const vec4 COLOR_PROJ_REF = vec4(.6797, .0039, .4922, 1.);

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

int crossingsForLine(vec2 p, vec2 from, vec2 to) {
    if(p.y < from.y && p.y < to.y) {
        return 0;
    }
    if(p.y >= from.y && p.y >= to.y) {
        return 0;
    }
    if(p.x >= from.x && p.x >= to.x) {
        return 0;
    }
    if(p.x < from.x && p.x < to.x) {
        return (from.y < to.y) ? 1 : -1;
    }
    float intercept = from.x + (p.y - from.y) * (to.x - from.x) / (to.y - from.y);
    if(p.x >= intercept) {
        return 0;
    }
    return (from.y < to.y) ? 1 : -1;
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

vec2 getOutlinePoint(int ix) {
    if(ix < 0) {
        ix += uOutlineCount;
    }
    float size = float(uOutlineSize);
    float xpos = (mod(float(ix), size) + .5) / size;
    float ypos = (floor(float(ix) / size) + .5) / size;
    return texture2D(uOutlineTex, vec2(xpos, ypos)).xy;
}

vec2 getClosest(int distanceFn, vec2 pos, bool includeRef) {
    float distNorm = 1.;
    int closestIx = -1;
    if(includeRef) {
        distNorm = getDistance(distanceFn, pos, uRefPosition);
        closestIx = -2;
    }
    float eps = 1e-5;  // making sure imprecisions don't fuzz results
    for(int ix = 0; ix < MAX_LOOP; ix += 1) {
        if(ix >= uPointsCount) {
            break;
        }
        vec2 ref = getPointPos(ix);
        float curDist = getDistance(distanceFn, pos, ref);
        if(curDist + eps < distNorm) {
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

vec2 move(vec2 pos, int direction, int step) {
    vec2 vout = pos;
    vec2 unit = uUnit * float(step);
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

float countBoundary(int distanceFn, vec2 pos, int border, bool includeRef) {
    int center = getClosestIx(distanceFn, pos, includeRef);
    float count = 0.0;
    int total = 0;
    for(int bord = 1; bord <= MAX_DIST; bord += 1) {
        if(bord > border) {
            break;
        }
        for(int direction = M_START; direction < M_STOP; direction += 1) {
            int other = getClosestIx(distanceFn, move(pos, direction, bord), includeRef);
            count += float(center == other);
            total += 1;
        }
    }
    return count / float(total);
}

bool isHidden(vec2 pos) {
    int crossings = 0;
    vec2 prev = getOutlinePoint(-1);
    for(int ix = 0; ix < MAX_LOOP; ix += 1) {
        if(ix >= uOutlineCount) {
            break;
        }
        vec2 cur = getOutlinePoint(ix);
        crossings += crossingsForLine(pos, prev, cur);
        prev = cur;
    }
    return int(mod(abs(float(crossings)), 2.)) != 0;
}

float countHidden(vec2 pos, int border) {
    bool refHidden = isHidden(pos);
    float count = 0.;
    int total = 0;
    for(int bord = 1; bord <= MAX_DIST; bord += 1) {
        if(bord > border) {
            break;
        }
        for(int direction = M_START; direction < M_STOP; direction += 1) {
            count += float(refHidden != isHidden(move(pos, direction, bord)));
            total += 1;
        }
    }
    return count / float(total);
}

float countCircle(vec2 pos, float radius, int border) {
    float count = 0.0;
    float rad2 = radius * radius;
    int total = 0;
    for(int bord = 1; bord <= MAX_DIST; bord += 1) {
        if(bord > border) {
            break;
        }
        for(int direction = M_START; direction < M_STOP; direction += 1) {
            vec2 curDiff = move(pos, direction, bord) - vPos;
            count += float((dot(curDiff, curDiff) > rad2));
            total += 1;
        }
    }
    return count / float(total);
}

vec4 alphaMix(vec4 front, vec4 back) {
    return vec4(mix(front.rgb, back.rgb, front.a), 1.0);
}

vec4 fillCircle(vec4 inColor, vec2 pos, float radius, vec4 color, int border) {
    return alphaMix(vec4(color.rgb, color.a * countCircle(pos, radius, border)), inColor);
}

vec4 drawCircle(vec4 inColor, vec2 pos, float radius, vec4 color, int border) {
    return alphaMix(vec4(color.rgb, color.a * abs(countCircle(pos, radius, border) - .5) * 2.), inColor);
}

vec4 waterColor(vec2 pos) {
    float iRatio = uWMSize.y / uWMSize.x;
    float iScale = uWMSize.x * 0.5;
    vec2 wmFull = vec2(iRatio, -1.) * sPos / iScale;
    vec2 sConv = uScreenSize / uWMSize / 4.;
    return texture2D(uWMTex, wmFull - vec2(-.5) - pos * sConv);
}

vec4 alpha(vec4 base, float alpha) {
    return base * vec4(vec3(1.), alpha);
}

void main(void) {
    int distanceFn = uDistanceFn;

    // Main Background
    vec2 closest = getClosest(distanceFn, vPos, true);
    int closestIx = getIx(closest);
    float distNorm = clamp(getDist(closest), 0., 1.);
    if(closestIx < 0) {
        gl_FragColor = mix(COLOR_REF_NEAR, COLOR_REF_FAR, distNorm);
    } else {
        gl_FragColor = mix(COLOR_DIST_NEAR, COLOR_DIST_FAR, distNorm);
    }

    // Unit Circle
    if(uUnitCircle != 0) {
        gl_FragColor = drawCircle(gl_FragColor, vec2(0.), 1., COLOR_UNIT, 5);
    }

    // Closest Boundaries
    float crossings = countBoundary(distanceFn, vPos, 5, true);
    gl_FragColor = alphaMix(alpha(COLOR_BOUNDARY, crossings), gl_FragColor);

    // Hidden Boundaries
    if(uConvexHull != 0) {
        float hiddenCrossings = countHidden(vPos, 5);
        gl_FragColor = alphaMix(alpha(COLOR_CH, 1. - hiddenCrossings), gl_FragColor);
    }

    // Point Dots
    int nearestIx = getClosestIx(DF_L2, vPos, uFixedRef != 0);
    vec2 nearestPos = getPointPos(nearestIx);
    vec4 nearestColor = nearestIx < 0 ? COLOR_POINT_REF : COLOR_POINT;
    gl_FragColor = fillCircle(gl_FragColor, nearestPos, uUnit.x * 10., nearestColor, 2);

    // Projected Dots
    if(uUnitCircle != 0) {
        int projIx = getClosestIx(DF_COS, vPos, true);
        vec2 projPos = getPointPos(projIx);
        projPos /= card(projPos);
        vec4 projColor = projIx < 0 ? COLOR_PROJ_REF : COLOR_PROJ;
        gl_FragColor = fillCircle(gl_FragColor, projPos, uUnit.x * 10., projColor, 2);
    }

    // Watermark
    vec4 wmColorA = waterColor(vec2(.5, .5));
    wmColorA.rb = -wmColorA.rb;
    gl_FragColor.rgb = clamp(wmColorA.rgb * .1 + gl_FragColor.rgb, vec3(0.), vec3(1.));

    vec4 wmColorB = waterColor(vec2(-.7, .7));
    wmColorB.rg = -wmColorB.rg;
    gl_FragColor.rgb = clamp(wmColorB.rgb * .1 + gl_FragColor.rgb, vec3(0.), vec3(1.));

    vec4 wmColorC = waterColor(vec2(-.4, -.6));
    wmColorC.gb = -wmColorC.gb;
    gl_FragColor.rgb = clamp(wmColorC.rgb * .1 + gl_FragColor.rgb, vec3(0.), vec3(1.));

    // Grid
    if(uShowGrid != 0) {
        if((mod(vPos.x, 2.0) < 1.0) != mod(vPos.y, 2.0) < 1.0) {
            gl_FragColor.rgb = 1.0 - gl_FragColor.rgb;
        }
    }
}
