#!/bin/bash
# Launch a separate Chrome instance with remote debugging (keeps existing Chrome intact)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-profile \
  --no-first-run \
  --no-default-browser-check \
  http://localhost:5174 &

echo "Chrome debug instance launched on port 9222"
echo "App: http://localhost:5174"
