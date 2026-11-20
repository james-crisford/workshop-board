# workshop-board

Static GitHub Pages site + Google Apps Script save box for Tilda's workshop tasks, ticks and times. Read README.md first.

- Data: Google Sheet on hello@ (ID in README). Read it with the engine's Sheets service (`tools.email_monitor.orchestrator.get_services`).
- Live page: GitHub Pages from `main`. `config.js` holds the Apps Script `/exec` URL.
- Rules: no client names in tasks (public page); UK English, no em dashes; Apps Script changes need James to redeploy (Deploy > Manage deployments > Edit > New version).
