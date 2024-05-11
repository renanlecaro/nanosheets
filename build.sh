#!/bin/sh
set -e
npx -y uglify-js nanosheets.js -o nanosheets.min.js
gzip -k -f nanosheets.min.js
git add .
git commit -m "build"
npm version patch
npm publish
git push