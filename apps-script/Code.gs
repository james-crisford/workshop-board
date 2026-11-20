/**
 * Workshop board save box.
 * The GitHub page reads today's tasks and saves ticks and task times here.
 * Deploy: Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.
 * Paste this whole file into the Apps Script editor opened from the "Workshop board" Google Sheet.
 */

const TABS = {
  tasks: ['id', 'day', 'order', 'category', 'title', 'job', 'steps', 'watch', 'ask', 'active'],
  ticks: ['id', 'taskId', 'task', 'step', 'text', 'day', 'done', 'at', 'by'],
  times: ['id', 'task', 'taskId', 'start', 'end', 'minutes', 'note', 'by']
};
const SHEET_NAMES = { tasks: 'Tasks', ticks: 'Ticks', times: 'Timesheet' };

function book_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(key) {
  const ss = book_();
  let sh = ss.getSheetByName(SHEET_NAMES[key]);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAMES[key]);
    sh.getRange(1, 1, 1, TABS[key].length).setValues([TABS[key]]);
    sh.getRange('A:Z').setNumberFormat('@');
  }
  return sh;
}

function cell_(v) {
  if (v instanceof Date) return v.toISOString();
  return v === null || v === undefined ? '' : v;
}

function rows_(key) {
  const sh = sheet_(key);
  const vals = sh.getDataRange().getValues();
  const head = vals.shift() || [];
  return vals.filter(r => r[0] !== '').map(r => {
    const o = {};
    head.forEach((h, i) => { o[h] = cell_(r[i]); });
    return o;
  });
}

function readTasks_() {
  return rows_('tasks').filter(t => String(t.active).toLowerCase() !== 'false').map(t => ({
    id: String(t.id), day: String(t.day), order: Number(t.order) || 0,
    category: String(t.category || 'ask'), title: String(t.title), job: String(t.job || ''),
    steps: String(t.steps || '').split('\n').map(s => s.trim()).filter(Boolean),
    watch: String(t.watch || '').split('\n').map(s => s.trim()).filter(Boolean),
    ask: String(t.ask || '')
  }));
}

function readTicks_() {
  return rows_('ticks').map(t => ({
    id: String(t.id), taskId: String(t.taskId), step: Number(t.step), day: String(t.day),
    done: String(t.done).toLowerCase() === 'true', at: String(t.at), by: String(t.by)
  }));
}

function readTimes_() {
  return rows_('times').map(t => ({
    id: String(t.id), task: String(t.task), taskId: String(t.taskId || ''), start: String(t.start),
    end: String(t.end || ''), minutes: t.minutes === '' ? null : Number(t.minutes), note: String(t.note || ''), by: String(t.by || '')
  })).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 300);
}

/** Write one row by id: replace if the id exists, else append. Values are written as plain text. */
function upsert_(key, obj) {
  const sh = sheet_(key);
  const head = TABS[key];
  const row = head.map(h => (obj[h] === undefined || obj[h] === null) ? '' : String(obj[h]));
  const ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(r => String(r[0]));
  const at = ids.indexOf(String(obj.id));
  if (at > 0) sh.getRange(at + 1, 1, 1, head.length).setValues([row]);
  else sh.appendRow(row);
}

function patch_(key, id, fields) {
  const sh = sheet_(key);
  const head = TABS[key];
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) {
      Object.keys(fields).forEach(f => {
        const c = head.indexOf(f);
        if (c >= 0) sh.getRange(i + 1, c + 1).setValue(String(fields[f]));
      });
      return true;
    }
  }
  return false;
}

function remove_(key, id) {
  const sh = sheet_(key);
  const vals = sh.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) if (String(vals[i][0]) === String(id)) sh.deleteRow(i + 1);
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function clip_(s, n) { return String(s === undefined || s === null ? '' : s).slice(0, n); }

function doGet() {
  return out_({ ok: true, tasks: readTasks_(), ticks: readTicks_(), times: readTimes_(), at: new Date().toISOString() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const b = JSON.parse(e.postData.contents || '{}');
    const by = clip_(b.by || 'Tilda', 40);
    if (b.action === 'tick') {
      upsert_('ticks', { id: clip_(b.id, 120), taskId: clip_(b.taskId, 100), task: clip_(b.task, 200), step: Number(b.step) || 0,
        text: clip_(b.text, 400), day: clip_(b.day, 10), done: b.done ? 'true' : 'false', at: new Date().toISOString(), by: by });
    } else if (b.action === 'start') {
      upsert_('times', { id: clip_(b.id, 60), task: clip_(b.task, 200), taskId: clip_(b.taskId, 100), start: clip_(b.start, 30),
        end: '', minutes: '', note: '', by: by });
    } else if (b.action === 'finish') {
      patch_('times', clip_(b.id, 60), { end: clip_(b.end, 30), minutes: Number(b.minutes) || 1, note: clip_(b.note, 1000) });
    } else if (b.action === 'cancel') {
      remove_('times', clip_(b.id, 60));
    } else {
      return out_({ ok: false, error: 'unknown action' });
    }
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
