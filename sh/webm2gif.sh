#!/bin/bash
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
