'use strict';

(() => {
  const scents = {
    cedar: { name: 'Cedar & Still', kind: 'Woody & warm', description: 'Dry cedar, soft amber, and the feeling of finally putting the day down.', notes: 'Cedar · Amber · Soft musk' },
    fig: { name: 'Fig After Rain', kind: 'Green & mellow', description: 'Green fig, fresh leaves, and a soft earthiness, like a garden just after rain.', notes: 'Fig leaf · Green woods · Earth' },
    tea: { name: 'Tea at Dusk', kind: 'Soft & comforting', description: 'Black tea, bright bergamot, and a gentle warmth for the last light of the day.', notes: 'Black tea · Bergamot · Warm spice' }
  };
  const prices = { '180': 1200, '300': 1800 };
  const formatPrice = (price) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
  const byId = (id) => document.getElementById(id);
  const config = byId('product-config');
  const dialog = byId('inquiry-dialog');
  const form = byId('inquiry-form');
  let opener = null;

  function selection() {
    const values = new FormData(config);
    const scentKey = values.get('scent');
    const size = values.get('size');
    return { scent: scents[scentKey] || scents.cedar, size: Object.hasOwn(prices, size) ? size : '180' };
  }
  function summary() {
    const selected = selection();
    return `${selected.scent.name} · ${selected.size} g · ${formatPrice(prices[selected.size])} sample price`;
  }
  function updateProduct() {
    const selected = selection();
    byId('product-name').textContent = selected.scent.name;
    byId('scent-kind').textContent = `/ ${selected.scent.kind}`;
    byId('scent-description').textContent = selected.scent.description;
    byId('scent-notes').textContent = selected.scent.notes;
    byId('product-price').textContent = formatPrice(prices[selected.size]);
    byId('selected-summary').textContent = summary();
  }
  function clearErrors() {
    ['sample-name', 'sample-email', 'sample-quantity'].forEach((id) => {
      byId(id).removeAttribute('aria-invalid');
      byId(`${id}-error`).textContent = '';
    });
  }
  function resetInquiry() {
    form.reset();
    clearErrors();
    byId('note-count').textContent = '0 / 240';
    byId('request-preview').replaceChildren();
    byId('inquiry-form-panel').hidden = false;
    byId('inquiry-success').hidden = true;
  }
  function openInquiry(event) {
    opener = event.currentTarget;
    resetInquiry();
    byId('selected-summary').textContent = summary();
    dialog.showModal();
    document.body.classList.add('modal-open');
    byId('sample-name').focus();
  }
  function closeInquiry() { dialog.close(); }
  function addPreviewRow(label, value) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    byId('request-preview').append(row);
  }

  config.addEventListener('change', updateProduct);
  document.querySelectorAll('[data-open-inquiry]').forEach((button) => button.addEventListener('click', openInquiry));
  byId('close-dialog').addEventListener('click', closeInquiry);
  byId('finish-request').addEventListener('click', closeInquiry);
  dialog.addEventListener('close', () => {
    resetInquiry();
    document.body.classList.remove('modal-open');
    opener?.focus();
    opener = null;
  });
  // Native dialog handles Escape and keeps keyboard focus inside the modal.
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeInquiry();
  });
  byId('sample-note').addEventListener('input', () => {
    byId('note-count').textContent = `${byId('sample-note').value.length} / 240`;
  });
  byId('fill-example').addEventListener('click', () => {
    byId('sample-name').value = 'Alex Example';
    byId('sample-email').value = 'alex@example.com';
    byId('sample-occasion').value = 'Housewarming';
    byId('sample-quantity').value = '2';
    byId('sample-note').value = 'A little warmth for your new place.';
    byId('sample-note').dispatchEvent(new Event('input'));
    clearErrors();
  });
  byId('edit-request').addEventListener('click', () => {
    byId('inquiry-success').hidden = true;
    byId('inquiry-form-panel').hidden = false;
    byId('sample-name').focus();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors();
    const name = byId('sample-name').value.trim();
    const email = byId('sample-email').value.trim();
    const quantity = Number(byId('sample-quantity').value);
    const errors = [];
    if (!name) errors.push(['sample-name', 'Enter a made-up name or sample project label.']);
    // Use the browser's built-in email syntax check; no email is sent or verified.
    if (!email || !byId('sample-email').validity.valid) errors.push(['sample-email', 'Enter a valid-looking sample email, such as alex@example.com.']);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) errors.push(['sample-quantity', 'Choose a whole number from 1 to 100.']);
    if (errors.length) {
      errors.forEach(([id, message]) => {
        byId(id).setAttribute('aria-invalid', 'true');
        byId(`${id}-error`).textContent = message;
      });
      byId(errors[0][0]).focus();
      return;
    }
    const selected = selection();
    byId('request-preview').replaceChildren();
    addPreviewRow('For', name);
    addPreviewRow('Sample email', email);
    addPreviewRow('Candle', `${selected.scent.name} · ${selected.size} g`);
    addPreviewRow('Occasion', byId('sample-occasion').value);
    addPreviewRow('Gifts', String(quantity));
    addPreviewRow('Sample total', `${formatPrice(prices[selected.size] * quantity)} · ${quantity} × ${formatPrice(prices[selected.size])}`);
    const note = byId('sample-note').value.trim();
    if (note) addPreviewRow('Gift note', note);
    byId('inquiry-form-panel').hidden = true;
    byId('inquiry-success').hidden = false;
    byId('success-title').focus();
  });
  updateProduct();
})();
