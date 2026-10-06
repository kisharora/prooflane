(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fields = [
    ['contact_id', 'Contact ID *', 'contact_id'], ['email', 'Email *', 'email'],
    ['full_name', 'Full name', 'full_name'], ['joined_date', 'Joined date', 'YYYY-MM-DD']
  ];
  const sample = [
    ['customer_id', 'email_address', 'customer_name', 'signup_date', 'legacy_notes'],
    ['C-1001', 'alex@example.com', 'Alex Morgan', '2025-03-14', 'Synthetic sample'],
    ['C-1002', 'sam@example.com', 'Sam Rivera', '2025-04-02', 'Name includes no title'],
    ['C-1003', 'jules@example.com', 'Jules Chen', '2025-04-08', ''],
    ['C-1002', 'sam.new@example.com', 'Sam Rivera', '2025-06-12', 'Duplicate identifier'],
    ['', 'taylor@example.com', 'Taylor Lane', '2025-06-18', 'Missing ID'],
    ['C-1005', 'not-an-email', 'Casey Park', '2025-07-01', 'Invalid email'],
    ['C-1006', 'devon@example.com', 'Devon Blake', '2025-02-30', 'Impossible date'],
    ['  C-1007  ', '  robin@example.com  ', ' Robin Ellis ', '2025-08-09', 'Whitespace cleanup'],
    ['C-1008', 'lee@example.com', 'Lee, Jordan', '2025-08-11', 'Quoted comma'],
    ['C-1009', 'mika@example.com', 'Mika "MJ" Jordan', '', 'Optional date'],
    ['C-1010', 'ari@example.com', 'Ari Quinn', '2025-09-05', ''],
    ['C-1011', 'noor@example.com', 'Noor Patel', '2025-09-07', '']
  ].map(row => row.map(v => '"' + v.replace(/"/g,'""') + '"').join(',')).join('\r\n');
  let dataset = null, result = null, currentTab = 'accepted', revision = 0;
  const selectors = {};
  fields.forEach(([key, label, hint]) => {
    const wrapper = document.createElement('label'); wrapper.className = 'mapping-field';
    const caption = document.createElement('span'); caption.textContent = label;
    const small = document.createElement('small'); small.textContent = hint; caption.append(small);
    const select = document.createElement('select'); select.id = 'map-' + key; select.disabled = true;
    select.append(new Option('Load a source first', '-1')); wrapper.append(caption, select); $('mappings').append(wrapper); selectors[key] = select;
    select.addEventListener('change', invalidate);
  });
  function announce(message) { $('notice').textContent = message; $('notice').hidden = !message; }
  function invalidate() {
    if (result) {
      result = null; $('report').hidden = true; $('empty').hidden = false;
      $('empty').querySelector('h3').textContent = 'Your settings have changed.';
      $('empty').querySelector('p').textContent = 'Run validation again to see the current report.';
      $('sample-empty').hidden = true;
    }
    $('report-status').textContent = dataset ? 'Ready to validate' : 'Awaiting source';
    announce('');
  }
  function resetSource() {
    dataset = null; result = null; $('report').hidden = true; $('empty').hidden = false; $('validate').disabled = true;
    $('report-status').textContent = 'Awaiting source'; $('file-info').textContent = '';
    $('empty').querySelector('h3').textContent = 'Make the messy parts visible.';
    $('empty').querySelector('p').textContent = 'Load the sample to see valid contacts, duplicate IDs, and rejected records in one place.';
    $('sample-empty').hidden = false;
    Object.values(selectors).forEach(select => { select.replaceChildren(new Option('Load a source first', '-1')); select.disabled = true; });
  }
  function load(text, name, isSample) {
    resetSource(); announce('');
    try {
      dataset = Migration.parseCSV(text);
      if (!dataset.rows.length) throw new Error('The file has headers but no data records.');
      $('file-info').textContent = (isSample ? 'SYNTHETIC SAMPLE · ' : '') + name + ' · ' + dataset.rows.length.toLocaleString() + ' records · ' + dataset.headers.length + ' columns';
      const aliases = { contact_id: ['contact_id','customer_id','id'], email: ['email','email_address'], full_name: ['full_name','customer_name','name'], joined_date: ['joined_date','signup_date','created_date'] };
      fields.forEach(([key]) => {
        const select = selectors[key]; select.replaceChildren(new Option(key === 'contact_id' || key === 'email' ? 'Choose a column…' : 'Leave unmapped', '-1'));
        dataset.headers.forEach((h, i) => select.append(new Option(h, String(i))));
        const index = dataset.headers.findIndex(h => aliases[key].includes(h.toLowerCase()));
        select.value = String(index); select.disabled = false;
      });
      $('validate').disabled = false; $('report-status').textContent = 'Ready to validate';
      $('empty').querySelector('h3').textContent = 'Your source is ready.';
      $('empty').querySelector('p').textContent = 'Review the suggested mappings and duplicate policy, then validate your records.';
      $('sample-empty').hidden = true;
    } catch (err) { resetSource(); announce(err.message); }
  }
  function loadSample() { revision++; $('file').value = ''; load(sample, 'sample-contacts.csv', true); }
  $('sample').addEventListener('click', loadSample); $('sample-empty').addEventListener('click', loadSample);
  $('file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    const token = ++revision; resetSource(); announce('Reading local file…');
    if (file.size > 5 * 1024 * 1024) { announce('This demo supports CSV files up to 5 MB. Choose a smaller file.'); return; }
    try {
      const buffer = await file.arrayBuffer();
      if (token !== revision) return;
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      load(text, file.name, false);
    } catch (err) { if (token === revision) announce('Could not read this file as UTF-8. Save it as a UTF-8 CSV and try again.'); }
  });
  document.querySelectorAll('input[name="policy"]').forEach(input => input.addEventListener('change', invalidate));
  $('validate').addEventListener('click', () => {
    if (!dataset) return;
    try {
      const mapping = Object.fromEntries(fields.map(([key]) => [key, Number(selectors[key].value)]));
      result = Migration.transform(dataset, mapping, document.querySelector('input[name="policy"]:checked').value);
      $('empty').hidden = true; $('report').hidden = false;
      $('total').textContent = result.total.toLocaleString(); $('accepted').textContent = result.accepted.length.toLocaleString(); $('rejected').textContent = result.rejected.length.toLocaleString();
      $('report-status').textContent = 'Validation complete';
      $('summary').textContent = result.duplicateGroups + ' duplicate ID group' + (result.duplicateGroups === 1 ? '' : 's') + ' across ' + result.duplicateRows + ' valid records · ' + result.normalized + ' mapped cells trimmed. Email format is checked; deliverability is not verified.';
      $('export-clean').disabled = !result.accepted.length; $('export-rejected').disabled = !result.rejected.length;
      announce(''); currentTab = 'accepted'; renderTable();
    } catch (err) { announce(err.message); }
  });
  function renderTable() {
    if (!result) return;
    const rejected = currentTab === 'rejected'; const rows = result[currentTab];
    $('accepted-tab').classList.toggle('active', !rejected); $('rejected-tab').classList.toggle('active', rejected);
    $('accepted-tab').setAttribute('aria-pressed', String(!rejected)); $('rejected-tab').setAttribute('aria-pressed', String(rejected));
    $('preview-count').textContent = Math.min(50, rows.length) + ' of ' + rows.length.toLocaleString() + ' records';
    $('preview').replaceChildren();
    if (!rows.length) { const p = document.createElement('p'); p.className = 'no-rows'; p.textContent = rejected ? 'No rejected records. All rows passed the current checks.' : 'No clean records. Review the rejected rows or change your mappings.'; $('preview').append(p); return; }
    const table = document.createElement('table'), head = document.createElement('thead'), body = document.createElement('tbody'), tr = document.createElement('tr');
    const sourceHeaders = [...dataset.headers];
    if (rejected) {
      const width = Math.max(dataset.headers.length, ...rows.map(row => row.values.length));
      while (sourceHeaders.length < width) sourceHeaders.push('Extra cell ' + (sourceHeaders.length + 1));
    }
    const headers = rejected ? ['Source record', 'Reason', ...sourceHeaders] : ['Source record', ...Migration.FIELDS];
    headers.forEach(h => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = h; tr.append(th); }); head.append(tr);
    rows.slice(0, 50).forEach(row => {
      const tr = document.createElement('tr');
      const values = rejected ? [row.record, row.reasons.join('; '), ...row.values] : [row.record, ...Migration.FIELDS.map(k => row.data[k])];
      values.forEach((value, index) => { const td = document.createElement('td'); td.textContent = String(value); td.title = String(value); if (rejected && index === 1) td.className = 'reason'; tr.append(td); }); body.append(tr);
    }); table.append(head, body); $('preview').append(table);
  }
  $('accepted-tab').addEventListener('click', () => { currentTab = 'accepted'; renderTable(); });
  $('rejected-tab').addEventListener('click', () => { currentTab = 'rejected'; renderTable(); });
  function download(kind) {
    if (!result) return;
    const text = kind === 'clean' ? Migration.cleanCSV(result) : Migration.rejectedCSV(dataset, result);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'fieldwork-' + kind + '-contacts.csv'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  $('export-clean').addEventListener('click', () => download('clean')); $('export-rejected').addEventListener('click', () => download('rejected'));
})();
