#!/bin/bash
# Wrapper script for MCP Selenium with proper PATH

export PATH="$HOME/.local/bin:$PATH"
export CHROME_PATH="/data/data/com.termux/files/usr/bin/chromium-browser"
export CHROMEDRIVER_PATH="/data/data/com.termux/files/usr/bin/chromedriver"
export SELENIUM_HEADLESS="true"

exec node /data/data/com.termux/files/usr/lib/node_modules/@angiejones/mcp-selenium/src/lib/server.js
