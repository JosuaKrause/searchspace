precision highp float;

uniform highp vec2 uUnit;
uniform vec2 uRefPosition;
uniform int uFixedRef;
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

float dot2d(vec2 a, vec2 b) {
    return dot(a, b);
}

float card(vec2 v) {
    return sqrt(dot(v, v));
}

float dotDist(vec2 a, vec2 b) {
    return 1. / (1. + exp(dot2d(a, b)));
}

float cos2d(vec2 a, vec2 b) {
    return dot2d(a, b) / card(a) / card(b);
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
    vec2 res = ((a - b) * (a - b));
    return normLog(sqrt(sumAll(res)));
}

float l1Dist(vec2 a, vec2 b) {
    vec2 res = abs(a - b);
    return normLog(sumAll(res));
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

vec2 getClosest(int distanceFn, vec2 pos, bool includeRef) {
    float size = float(uPointsSize);
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
        float xpos = (mod(float(ix), size) + .5) / size;
        float ypos = (floor(float(ix) / size) + .5) / size;
        vec2 ref = texture2D(uPointsTex, vec2(xpos, ypos)).xy;
        float curDist = getDistance(distanceFn, pos, ref);
        if(curDist < distNorm) {
            distNorm = curDist;
            closestIx = ix;
        }
    }
    return vec2(distNorm, float(closestIx) + .5);
}

int getIx(vec2 distAndIx) {
    return int(distAndIx.y);
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

bool isBoundary(int distanceFn, vec2 pos, bool includeRef) {
    int center = getIx(getClosest(distanceFn, pos, includeRef));
    int top = getIx(getClosest(distanceFn, getNext(pos, TOP), includeRef));
    int topRight = getIx(getClosest(distanceFn, getNext(getNext(pos, TOP), RIGHT), includeRef));
    int right = getIx(getClosest(distanceFn, getNext(pos, RIGHT), includeRef));
    int bottomRight = getIx(getClosest(distanceFn, getNext(getNext(pos, BOTTOM), RIGHT), includeRef));
    int bottom = getIx(getClosest(distanceFn, getNext(pos, BOTTOM), includeRef));
    int bottomLeft = getIx(getClosest(distanceFn, getNext(getNext(pos, BOTTOM), LEFT), includeRef));
    int left = getIx(getClosest(distanceFn, getNext(pos, LEFT), includeRef));
    int topLeft = getIx(getClosest(distanceFn, getNext(getNext(pos, TOP), LEFT), includeRef));
    return !((center == top) && (center == topRight) && (center == right) && (center == bottomRight) && (center == bottom) && (center == bottomLeft) && (center == left) && (center == topLeft));
}

bool inRectangle(vec2 topLeft, vec2 bottomRight) {
    return (vPos.x >= topLeft.x) && (vPos.y >= topLeft.y) && (vPos.x <= bottomRight.x) && (vPos.y <= bottomRight.y);
}

vec4 drawCircle(vec4 inColor, vec2 pos, float radius, vec4 color) {
    if (!inRectangle(pos - vec2(radius, radius), pos + vec2(radius, radius))) {
        return inColor;
    }
    if (dot(pos - vPos, pos - vPos) > radius * radius) {
        return inColor;
    }
    return color;
}

void main(void) {
    int distanceFn = uDistanceFn;
    vec2 visClosest = getClosest(DF_L2, vPos, uFixedRef == 1);
    if(getDist(visClosest) < .05) {
        if(getIx(visClosest) < 0) {
            gl_FragColor = vec4(1., 1., 0., 1.);
        } else {
            gl_FragColor = vec4(0., 1., 1., 1.);
        }
    } else if(isBoundary(distanceFn, vPos, true)) {
        gl_FragColor = vec4(1., 0., 0., 1.);
    } else {
        vec2 closest = getClosest(distanceFn, vPos, true);
        int closestIx = getIx(closest);
        float distNorm = getDist(closest);
        if(closestIx < 0) {
            gl_FragColor = vec4(.5, .5, distNorm, 1.);
        } else {
            gl_FragColor = vec4(distNorm, distNorm, distNorm, 1.);
        }
    }
    gl_FragColor = drawCircle(gl_FragColor, vec2(4.5, -1.5), 0.5, vec4(1., 0., 1., 1.));
    if ((mod(vPos.x, 2.0) < 1.0) != mod(vPos.y, 2.0) < 1.0) {
        gl_FragColor.xyz = 1.0 - gl_FragColor.xyz;
    }
}
