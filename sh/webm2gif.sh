#!/usr/bin/env bash
#
# Searchspace – An interactive visualization for various similarity measures.
# Copyright (C) 2024 Josua Krause
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
set -e

if [ -z "${INPUT}" ]; then
    echo "specify an input file via INPUT"
    exit 1
fi

OUTPUT="${INPUT%.webm}"
if [ "${OUTPUT}" == "${INPUT}" ]; then
    echo "input ${INPUT} must be a '.webm' file"
    exit 2
fi
OUTPUT="${OUTPUT}.gif"
echo "${OUTPUT}"

TMP_DIR=$(mktemp -d)
trap 'rm -rf -- "${TMP_DIR}"' EXIT
PALETTE="${TMP_DIR}/palette.png"
echo "palette file: ${PALETTE}"

ffmpeg -y -i "${INPUT}" -vf palettegen "${PALETTE}"
ffmpeg -y -i "${INPUT}" -i "${PALETTE}" -filter_complex "scale=700:-1,fps=30[x];[x][1:v]paletteuse" "${OUTPUT}"
