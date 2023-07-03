attribute vec4 aVertexPosition;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

uniform highp vec2 uUnit;

varying highp vec2 vPos;

void main(void) {
    vPos = aVertexPosition.xy * uUnit;

    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
}
