import { createOptimizedPicture } from '../../scripts/aem.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

const findImage = (row) => row.querySelector('picture') || row.querySelector('img');

/**
 * Builds a director card from an [image] | [name + role] row.
 * @param {Element} row The authored row
 * @returns {Element} The card list item
 */
function buildCard(row) {
  const li = document.createElement('li');
  li.className = 'board-of-directors-card';

  const media = findImage(row);
  const img = media.tagName === 'IMG' ? media : media.querySelector('img');
  media.remove();
  const image = document.createElement('div');
  image.className = 'board-of-directors-card-image';
  image.append(img
    ? createOptimizedPicture(img.src, img.alt, false, [{ media: '(min-width: 992px)', width: '750' }, { width: '400' }])
    : media);

  const body = document.createElement('div');
  body.className = 'board-of-directors-card-body';
  [...row.children].forEach((cell) => body.append(...cell.childNodes));
  // drop whitespace and the empty paragraph the image may have been wrapped in
  [...body.childNodes].forEach((node) => {
    if (!node.textContent.trim()) node.remove();
  });

  // the name is the first heading, or the first paragraph when authors used bold text
  const name = body.querySelector(HEADINGS) || body.querySelector('p');
  name?.classList.add('board-of-directors-card-name');
  body.querySelectorAll('p:not(.board-of-directors-card-name)')
    .forEach((p) => p.classList.add('board-of-directors-card-role'));

  li.append(image, body);
  return li;
}

/**
 * Board of Directors: optional highlight panel and title rows, then one row per
 * director ([image] | [name + role]), then optional note rows (e.g. document links).
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const firstCard = rows.findIndex(findImage);
  const lastCard = rows.findLastIndex(findImage);
  const leading = firstCard === -1 ? rows : rows.slice(0, firstCard);
  const trailing = firstCard === -1 ? [] : rows.slice(lastCard + 1);

  const content = (row) => {
    const cell = document.createElement('div');
    [...row.children].forEach((col) => cell.append(...col.childNodes));
    return (cell.textContent.trim() || cell.querySelector('img')) ? cell : null;
  };

  const parts = [];

  // the last text row before the cards is the grid title; earlier ones are highlight panels
  leading.forEach((row, i) => {
    const cell = content(row);
    if (!cell) return;
    const isTitle = i === leading.length - 1 && firstCard !== -1;
    cell.className = isTitle ? 'board-of-directors-title' : 'board-of-directors-panel';
    parts.push(cell);
  });

  if (firstCard !== -1) {
    const list = document.createElement('ul');
    list.className = 'board-of-directors-list';
    rows.slice(firstCard, lastCard + 1)
      .filter(findImage)
      .forEach((row) => list.append(buildCard(row)));
    parts.push(list);
  }

  trailing.forEach((row) => {
    const cell = content(row);
    if (!cell) return;
    cell.className = 'board-of-directors-notes';
    parts.push(cell);
  });

  block.replaceChildren(...parts);
}
