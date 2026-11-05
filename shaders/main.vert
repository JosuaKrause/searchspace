/*
 * Searchspace – An interactive visualization for various similarity measures.
 * Copyright (C) 2024-2026 Josua Krause
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

attribute vec4 aVertexPosition;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

uniform highp vec2 uUnit;

varying highp vec2 vPos;
varying highp vec2 sPos;

void main(void) {
    vPos = aVertexPosition.xy * uUnit;
    sPos = aVertexPosition.xy;

    gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
}
