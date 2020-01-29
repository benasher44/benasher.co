#!/bin/sh

set -ev

MASTER=$1

trap "rm -f 16.png 32.png 48.png 256.png" EXIT

tile () {
    magick convert $MASTER -resize "$1x$1" $1.png
}

tile 16
tile 32
tile 48
tile 256

magick convert 16.png 32.png 48.png 256.png favicon.ico
