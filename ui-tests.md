# CellHub UI Tests

| # | Test | Expected | Actual |
|---|------|----------|--------|
| 1 | Open http://localhost:3000 | Jobs listed with names | |
| 2 | Before login | "Log in to change" in Actions | |
| 3 | Wrong password | Problem: Wrong email or password | |
| 4 | Good login | Welcome message, add form shows | |
| 5 | Refresh (F5) | Still logged in | |
| 6 | Add a job | "Service job added." and new row | |
| 7 | Change a status, refresh | Status stays changed | |
| 8 | Delete, then Cancel | Row stays | |
| 9 | Delete, then OK | Row removed | |
| 10 | Issue named <b>Test</b> | Shown as plain text | |
| 11 | Log out | Add form hidden | |
| 12 | Expired token (abc) | Problem: Your login expired | |
| 13 | Server stopped | Problem: Cannot reach the server | |
| 14 | Keyboard only (Tab, Enter) | Everything reachable, outline visible | |
| 15 | 200% zoom and 375px width | No cut-off text | |