#!/bin/sh
set -e
npx -y uglify-js nanosheets.js -o nanosheets.min.js
gzip -k -f nanosheets.min.js
npm publish
