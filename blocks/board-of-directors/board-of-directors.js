import { createOptimizedPicture } from '../../scripts/aem.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
const DESKTOP = window.matchMedia('(min-width: 992px)');

// row types an author can name in the first cell
const KEYS = ['history', 'panel', 'title', 'director', 'notes', 'tab', 'item'];

let instance = 0;

const findImage = (el) => el.querySelector('picture') || el.querySelector('img');

function createElement(tag, className, ...children) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

/**
 * Moves the content of the given cells into one element, dropping empty nodes.
 * @param {Element[]} cells The authored cells
 * @param {string} className Class for the new element
 * @returns {Element} The element holding the merged content
 */
function mergeCells(cells, className) {
  const el = createElement('div', className);
  cells.forEach((cell) => el.append(...cell.childNodes));
  [...el.childNodes].forEach((node) => {
    if (!node.textContent.trim() && !node.querySelector?.('img')) node.remove();
  });
  return el;
}

/**
 * Removes the first image from the cells and returns it as an optimized picture.
 * @param {Element[]} cells The authored cells
 * @param {Object[]} breakpoints Breakpoints for createOptimizedPicture
 * @returns {Element|null} The picture
 */
function takePicture(cells, breakpoints) {
  const cell = cells.find(findImage);
  if (!cell) return null;
  const media = findImage(cell);
  const img = media.tagName === 'IMG' ? media : media.querySelector('img');
  media.remove();
  return img ? createOptimizedPicture(img.src, img.alt, false, breakpoints) : media;
}

/**
 * Works out what each row is: named rows use their first cell, unnamed rows are
 * directors when they have an image, otherwise panel/title before the directors
 * and notes after them.
 * @param {Element[]} rows The authored rows
 * @returns {{type: string, cells: Element[]}[]} The classified rows
 */
function classify(rows) {
  const typed = rows.map((row) => {
    const cells = [...row.children];
    const key = cells.length > 1 ? cells[0].textContent.trim().toLowerCase() : '';
    if (KEYS.includes(key)) return { type: key, cells: cells.slice(1) };
    return { type: findImage(row) ? 'director' : null, cells };
  });

  const firstDirector = typed.findIndex((r) => r.type === 'director');
  const titleIndex = firstDirector === -1 ? -1
    : typed.slice(0, firstDirector).findLastIndex((r) => !r.type);
  typed.forEach((r, i) => {
    if (r.type) return;
    if (firstDirector !== -1 && i > firstDirector) r.type = 'notes';
    else r.type = i === titleIndex ? 'title' : 'panel';
  });
  return typed;
}

/**
 * Uses an authored image as the full-width history background.
 * @param {Element} history The history element
 * @param {Element} cell The cell holding the background image
 */
function applyBackground(history, cell) {
  const img = cell.querySelector('img');
  if (!img) return;
  const url = new URL(img.getAttribute('src'), window.location.href);
  if (url.pathname.includes('media_')) {
    url.searchParams.set('width', '2000');
    url.searchParams.set('format', 'webply');
    url.searchParams.set('optimize', 'medium');
  }
  history.style.setProperty('--history-bg', `url('${url.href}')`);
  const width = Number(img.getAttribute('width'));
  const height = Number(img.getAttribute('height'));
  if (width && height) history.style.setProperty('--history-bg-ratio', `${width} / ${height}`);
  cell.remove();
}

function buildHistory(rowCells) {
  const history = createElement('div', 'board-of-directors-history');

  // [heading] | [illustration] | [text] | [optional background image]
  const imageCells = rowCells.filter(findImage);
  const background = imageCells.length > 1 ? imageCells[imageCells.length - 1] : null;
  if (background) applyBackground(history, background);
  const cells = rowCells.filter((cell) => cell !== background);

  const imageIndex = cells.findIndex(findImage);
  const picture = takePicture(cells, [{ width: '750' }]);
  const before = imageIndex === -1 ? cells.slice(0, 1) : cells.slice(0, imageIndex + 1);
  const after = imageIndex === -1 ? cells.slice(1) : cells.slice(imageIndex + 1);

  history.append(mergeCells(before, 'board-of-directors-history-heading'));
  if (picture) history.append(createElement('div', 'board-of-directors-history-image', picture));
  history.append(mergeCells(after, 'board-of-directors-history-text'));
  return history;
}

function buildCard(cells) {
  const picture = takePicture(cells, [{ media: '(min-width: 992px)', width: '750' }, { width: '400' }]);
  const body = mergeCells(cells, 'board-of-directors-card-body');

  // the name is the first heading, or the first paragraph when authors used bold text
  const name = body.querySelector(HEADINGS) || body.querySelector('p');
  name?.classList.add('board-of-directors-card-name');
  body.querySelectorAll('p:not(.board-of-directors-card-name)')
    .forEach((p) => p.classList.add('board-of-directors-card-role'));

  const card = createElement('li', 'board-of-directors-card');
  if (picture) card.append(createElement('div', 'board-of-directors-card-image', picture));
  card.append(body);
  return card;
}

function buildItem(cells, group) {
  const [question, ...answer] = cells;
  const details = createElement('details', 'board-of-directors-item');
  details.name = group;
  const summary = createElement(
    'summary',
    'board-of-directors-item-question',
    createElement('span', 'board-of-directors-item-label', question?.textContent.trim() || ''),
    createElement('span', 'board-of-directors-item-icon'),
  );
  summary.lastElementChild.setAttribute('aria-hidden', 'true');
  details.append(summary, mergeCells(answer, 'board-of-directors-item-answer'));

  // one open item per tab (fallback for browsers without exclusive <details name>)
  details.addEventListener('toggle', () => {
    if (!details.open) return;
    details.parentElement.querySelectorAll(':scope > details[open]').forEach((other) => {
      if (other !== details) other.open = false;
    });
  });
  return details;
}

/**
 * Builds vertical tabs (drawers on mobile), each holding a titled accordion.
 * @param {{label: string, title: string, items: Element[]}[]} tabs The tabs
 * @returns {Element} The tabs element
 */
function buildTabs(tabs) {
  instance += 1;
  const id = `board-of-directors-${instance}`;
  const wrapper = createElement('div', 'board-of-directors-tabs');
  const tablist = createElement('div', 'board-of-directors-tablist');
  tablist.setAttribute('role', 'tablist');
  const panels = createElement('div', 'board-of-directors-tabpanels');

  const parts = tabs.map((tab, i) => {
    const button = createElement('button', 'board-of-directors-tab', tab.label);
    button.type = 'button';
    button.id = `${id}-tab-${i}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `${id}-panel-${i}`);

    const drawer = createElement('button', 'board-of-directors-drawer', tab.label);
    drawer.type = 'button';
    drawer.setAttribute('aria-controls', `${id}-panel-${i}`);

    const panel = createElement('div', 'board-of-directors-tabpanel');
    panel.id = `${id}-panel-${i}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    if (tab.title) panel.append(createElement('h3', 'board-of-directors-tabpanel-title', tab.title));
    panel.append(createElement('div', 'board-of-directors-accordion', ...tab.items));

    tablist.append(button);
    panels.append(drawer, panel);
    return { button, drawer, panel };
  });

  let active = 0;
  const setActive = (index) => {
    active = index;
    parts.forEach(({ button, drawer, panel }, i) => {
      const selected = i === index;
      button.setAttribute('aria-selected', selected);
      button.tabIndex = selected || (index === -1 && i === 0) ? 0 : -1;
      drawer.setAttribute('aria-expanded', selected);
      panel.hidden = !selected;
    });
  };

  parts.forEach(({ button, drawer }, i) => {
    button.addEventListener('click', () => setActive(i));
    // on mobile the open drawer can be collapsed again
    drawer.addEventListener('click', () => setActive(active === i ? -1 : i));
  });

  tablist.addEventListener('keydown', (e) => {
    const steps = {
      ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1,
    };
    const step = steps[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (Math.max(active, 0) + step + parts.length) % parts.length;
    setActive(next);
    parts[next].button.focus();
  });

  // desktop always shows a tab
  DESKTOP.addEventListener('change', () => {
    if (DESKTOP.matches && active === -1) setActive(0);
  });

  setActive(0);
  // the first answer starts open on desktop, as on the reference page
  if (DESKTOP.matches) {
    const first = parts[0]?.panel.querySelector('details');
    if (first) first.open = true;
  }

  wrapper.append(tablist, panels);
  return wrapper;
}

/**
 * About-page block: history, highlight panel, board of directors grid, notes and
 * corporate information tabs. Rows can be named in their first cell (history,
 * panel, title, director, notes, tab, item); unnamed rows are inferred.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = classify([...block.children]);
  const parts = [];
  let list = null;
  let tabs = null;

  const flushTabs = () => {
    if (tabs) parts.push(buildTabs(tabs));
    tabs = null;
  };

  rows.forEach(({ type, cells }) => {
    if (type !== 'director') list = null;
    if (type !== 'tab' && type !== 'item') flushTabs();

    if (type === 'history') {
      parts.push(buildHistory(cells));
    } else if (type === 'director') {
      if (!list) {
        list = createElement('ul', 'board-of-directors-list');
        parts.push(list);
      }
      list.append(buildCard(cells));
    } else if (type === 'tab') {
      tabs = tabs || [];
      const [label, title] = cells.map((c) => c.textContent.trim());
      tabs.push({ label, title: title || label, items: [] });
    } else if (type === 'item') {
      tabs = tabs || [];
      if (!tabs.length) tabs.push({ label: '', title: '', items: [] });
      const tab = tabs[tabs.length - 1];
      tab.items.push(buildItem(cells, `board-of-directors-${instance + 1}-${tabs.length}`));
    } else {
      const el = mergeCells(cells, `board-of-directors-${type}`);
      if (el.childNodes.length) parts.push(el);
    }
  });
  flushTabs();

  block.replaceChildren(...parts);
}
