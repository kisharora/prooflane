/* Portable, dependency-free CSV migration engine. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Migration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FIELDS = ['contact_id', 'email', 'full_name', 'joined_date'];
  function parseCSV(input) {
    if (typeof input !== 'string') throw new Error('CSV input must be text.');
    const text = input.replace(/^\uFEFF/, '');
    if (!text.trim()) throw new Error('The CSV is empty.');
    const records = []; let row = [], field = '', quoted = false, closed = false;
    function endField() { row.push(field); field = ''; closed = false; }
    function endRow() { endField(); records.push(row); row = []; }
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { quoted = false; closed = true; }
        } else field += ch;
      } else if (ch === ',') endField();
      else if (ch === '\r' || ch === '\n') { if (ch === '\r' && text[i + 1] === '\n') i++; endRow(); }
      else if (ch === '"') {
        if (field.length || closed) throw new Error('Unexpected quote in CSV record ' + (records.length + 1) + '. Quote the entire field.');
        quoted = true;
      } else {
        if (closed) throw new Error('Unexpected text after a closing quote in CSV record ' + (records.length + 1) + '.');
        field += ch;
      }
    }
    if (quoted) throw new Error('Unclosed quoted field. Check the end of your CSV.');
    if (field.length || row.length || closed) endRow();
    const headers = records.shift().map(h => h.trim());
    if (headers.some(h => !h)) throw new Error('Every column needs a non-empty header.');
    if (new Set(headers).size !== headers.length) throw new Error('Column headers must be unique.');
    if (headers.length > 100) throw new Error('This demo supports up to 100 columns.');
    if (records.length > 20000) throw new Error('This demo supports up to 20,000 data records.');
    const rows = records.map((values, index) => ({ values, record: index + 2 }));
    return { headers, rows };
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }
  function transform(dataset, mapping, mode) {
    if (!['first', 'last', 'reject'].includes(mode)) throw new Error('Choose a supported duplicate policy.');
    for (const key of ['contact_id', 'email']) {
      if (!Number.isInteger(mapping[key]) || mapping[key] < 0 || mapping[key] >= dataset.headers.length) throw new Error('Map both Contact ID and Email before validating.');
    }
    const selected = FIELDS.map(k => mapping[k]).filter(v => Number.isInteger(v) && v >= 0);
    if (new Set(selected).size !== selected.length) throw new Error('Map each source column only once.');
    const candidates = [], rejected = []; let normalized = 0;
    for (const row of dataset.rows) {
      const reasons = [];
      if (row.values.length !== dataset.headers.length) reasons.push('Column count: expected ' + dataset.headers.length + ', received ' + row.values.length);
      const out = {};
      for (const key of FIELDS) {
        const raw = mapping[key] >= 0 ? (row.values[mapping[key]] || '') : '';
        out[key] = raw.trim();
        if (raw !== out[key]) normalized++;
      }
      if (!out.contact_id) reasons.push('Missing contact ID');
      if (!out.email) reasons.push('Missing email');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) reasons.push('Invalid email format');
      if (out.joined_date && !validDate(out.joined_date)) reasons.push('Invalid joined date: use YYYY-MM-DD');
      if (reasons.length) rejected.push({ ...row, reasons });
      else candidates.push({ ...row, data: out });
    }
    const groups = new Map();
    for (const row of candidates) {
      const id = row.data.contact_id;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(row);
    }
    const accepted = []; let duplicateRows = 0, duplicateGroups = 0;
    for (const group of groups.values()) {
      if (group.length > 1) { duplicateGroups++; duplicateRows += group.length; }
      const winner = mode === 'last' ? group[group.length - 1] : group[0];
      for (const row of group) {
        if (group.length === 1 || (mode !== 'reject' && row === winner)) accepted.push(row);
        else rejected.push({ ...row, reasons: ['Duplicate contact ID: ' + (mode === 'reject' ? 'all valid rows in this group rejected' : 'kept ' + (mode === 'first' ? 'first' : 'last') + ' valid occurrence (record ' + winner.record + ')')] });
      }
    }
    accepted.sort((a,b) => a.record-b.record); rejected.sort((a,b) => a.record-b.record);
    return { accepted, rejected, duplicateRows, duplicateGroups, normalized, total: dataset.rows.length };
  }
  function safeCell(value) {
    const text = String(value == null ? '' : value);
    // Neutralize formulas even when preceded by whitespace or control characters.
    return /^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
  }
  function encodeCSV(rows) {
    return '\uFEFF' + rows.map(row => row.map(value => '"' + safeCell(value).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
  }
  function cleanCSV(result) { return encodeCSV([FIELDS, ...result.accepted.map(r => FIELDS.map(k => r.data[k]))]); }
  function rejectedCSV(dataset, result) {
    const width = Math.max(dataset.headers.length, ...result.rejected.map(r => r.values.length));
    const headers = dataset.headers.map((h, i) => 'original_' + (i + 1) + ': ' + h);
    while (headers.length < width) headers.push('extra_cell_' + (headers.length + 1));
    return encodeCSV([['source_record', 'rejection_reason', ...headers], ...result.rejected.map(r => [r.record, r.reasons.join('; '), ...Array.from({length: width}, (_, i) => r.values[i] || '')])]);
  }
  return { FIELDS, parseCSV, validDate, transform, safeCell, encodeCSV, cleanCSV, rejectedCSV };
});
