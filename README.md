# Workshop board

Tilda's daily task list, step ticks and task timer for the 3DPE Broadstone workshop.

- The page (`index.html`, `app.js`, `config.js`) is a static site on GitHub Pages. No login.
- Ticks, task times and the daily task lists live in the Google Sheet "Workshop board (Tilda ticks and times)" on the hello@ account:
  https://docs.google.com/spreadsheets/d/1V121yLznYK088I69ifRO2hmTNad--dlX2AoLT_ghD6g/edit
- `apps-script/Code.gs` is the save box: a Google Apps Script web app bound to that Sheet. The page reads `GET` (tasks, ticks, times) and writes `POST` (tick, start, finish, cancel).

## One-time setup (James, on hello@, about 5 minutes)

1. Open the Sheet above while signed in as hello@.
2. Menu: **Extensions > Apps Script**.
3. Delete what is in the editor, paste all of `apps-script/Code.gs`, press **Save**.
4. **Deploy > New deployment**. Gear icon: **Web app**. Execute as: **Me**. Who has access: **Anyone**. Press **Deploy**.
5. Google asks for permission: **Authorize access**, pick hello@, then **Advanced > Go to ... (unsafe)** (it is our own script), then **Allow**.
6. Copy the **Web app URL** (ends in `/exec`) and give it to Claude. It goes in `config.js`.

## Changing the daily list

Add rows to the **Tasks** tab: one row per task. `steps` and `watch` are one item per line in the cell. `day` is YYYY-MM-DD. The page shows today's list, else the next day with a list. Set `active` to false to hide a task.

## Privacy

GitHub Pages is public. Keep client names off task rows: job numbers only.
