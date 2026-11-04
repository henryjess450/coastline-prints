#!/bin/bash
# The app's executable: opens run.sh in a Terminal window dressed in Coastline navy.
RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
/usr/bin/osascript - "$RES/run.sh" <<'EOF'
on run argv
  set runPath to quoted form of (item 1 of argv)
  tell application "Terminal"
    activate
    set t to do script "bash " & runPath & "; exit"
    set background color of t to {3598, 17476, 29041}
    set normal text color of t to {65535, 65535, 65535}
    set bold text color of t to {65535, 65535, 65535}
    set cursor color of t to {59881, 50372, 27242}
    set custom title of t to "Coastline Printer"
    set title displays custom title of t to true
    set title displays shell path of t to false
    set title displays window size of t to false
    set number of columns of t to 78
    set number of rows of t to 28
  end tell
end run
EOF
