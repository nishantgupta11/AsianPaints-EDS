import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * CWAP Banner
 * "Colour With Asian Paints" app banner: gradient title, caption, store
 * buttons (with optional QR codes on desktop) and a phone-framed video.
 *
 * Authoring model (all content lives in DA; the first cell is the row label):
 *   Background    | desktop image | mobile image
 *   Title         | one line per paragraph (each line gets the gradient)
 *   Caption       | Visualize your dream home
 *   Download text | Download our visualizer app now (desktop only)
 *   Play store    | store badge image | store link | QR code image (optional)
 *   App store     | store badge image | store link | QR code image (optional)
 *                   (store rows render in authored order)
 *   Video         | link to the video file | desktop phone frame | mobile phone frame (optional)
 *
 * Any other row with images (e.g. "Colour Picker") is a full-width image section
 * shown below the banner, in authored order:
 *   Colour Picker | desktop image | mobile image (optional, defaults to the desktop image)
 *
 * @param {Element} block The block element
 */

const DEFAULT_VIDEO_LABEL = 'Phone screen showing the launch of Colour with Asian Paints Visualizer';

const STORE_LABELS = ['play store', 'app store'];

// rows that build the banner itself; any other row with images is an image section
const BANNER_LABELS = ['background', 'title', 'caption', 'download text', ...STORE_LABELS, 'video'];

// the banner and image sections switch to their desktop layout here, like the reference page
const FEATURE_DESKTOP = '(min-width: 992px)';

const rowLabel = (row) => row.children[0]?.textContent.trim().toLowerCase().replace(/\s+/g, ' ') || '';

/** Splits a rich-text cell into its lines (paragraphs and line breaks). */
function getLines(cell) {
  const parts = cell.querySelector('p') ? [...cell.querySelectorAll('p')] : [cell];
  return parts.flatMap((part) => {
    const clone = part.cloneNode(true);
    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    return clone.textContent.split('\n');
  }).map((line) => line.trim()).filter(Boolean);
}

function getLink(cell) {
  const a = cell?.querySelector('a');
  if (a) return a.href;
  const text = cell?.textContent.trim();
  return text || '';
}

function buildBackground(desktopImg, mobileImg, eager) {
  const picture = createOptimizedPicture(mobileImg.src, '', eager, [{ width: '750' }]);
  const desktop = createOptimizedPicture(desktopImg.src, '', eager, [
    { media: FEATURE_DESKTOP, width: '2000' },
    { width: '750' },
  ]);
  picture.prepend(...desktop.querySelectorAll('source[media]'));
  const img = picture.querySelector('img');
  if (eager) img.fetchPriority = 'high';

  const bg = document.createElement('div');
  bg.className = 'cwap-banner-bg';
  bg.setAttribute('aria-hidden', 'true');
  bg.append(picture);
  return bg;
}

/**
 * Image section row: label | desktop image | mobile image. The whole component
 * is authored as one image per layout; the label names it for screen readers
 * unless the image has its own alt text.
 */
function buildFeature(row) {
  const [desktopImg, mobileImg = desktopImg] = row.querySelectorAll('img');
  if (!desktopImg) return null;
  const label = row.children[0]?.textContent.trim() || '';
  const alt = desktopImg.getAttribute('alt') || label;

  const picture = createOptimizedPicture(mobileImg.src, alt, false, [{ width: '750' }]);
  const desktop = createOptimizedPicture(desktopImg.src, alt, false, [
    { media: FEATURE_DESKTOP, width: '2880' },
    { width: '750' },
  ]);
  picture.prepend(...desktop.querySelectorAll('source[media]'));

  const feature = document.createElement('div');
  feature.className = 'cwap-banner-feature';
  feature.append(picture);
  return feature;
}

function buildStore(cells) {
  const [, badgeCell, linkCell, qrCell] = cells;
  const badgeImg = badgeCell?.querySelector('img');
  const href = getLink(linkCell);
  if (!badgeImg && !href) return null;

  const item = document.createElement('li');
  item.className = 'cwap-banner-store';

  const qrImg = qrCell?.querySelector('img');
  if (qrImg) {
    const qr = createOptimizedPicture(qrImg.src, qrImg.alt || 'QR code to download the app', false, [{ width: '300' }]);
    qr.classList.add('cwap-banner-qr');
    item.append(qr);
  }

  const link = document.createElement(href ? 'a' : 'span');
  link.className = 'cwap-banner-store-link';
  if (href) {
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  if (badgeImg) {
    const badge = createOptimizedPicture(badgeImg.src, badgeImg.alt || 'Download the app', false, [{ width: '360' }]);
    const img = badge.querySelector('img');
    img.width = 180;
    img.height = 53;
    link.append(badge);
  } else {
    link.textContent = 'Download the app';
  }
  item.append(link);
  return item;
}

/** Optimized URL for an authored image used as a CSS background. */
function imageUrl(img, width) {
  const url = new URL(img.getAttribute('src'), window.location.href);
  if (url.pathname.includes('media_')) {
    url.searchParams.set('width', width);
    url.searchParams.set('format', 'webply');
    url.searchParams.set('optimize', 'medium');
  }
  return url.href;
}

/**
 * Video row: Video | link to the video file | desktop phone frame image |
 * mobile phone frame image (optional, defaults to the desktop frame).
 * The video plays on top of the frame image, inside its screen area.
 */
function buildVideo(row) {
  const [, cell, ...frameCells] = [...row.children];
  const src = getLink(cell);
  if (!src) return null;

  const text = cell.textContent.trim();
  const label = text && !/^(https?:)?\/\//.test(text) && !text.startsWith('/') ? text : DEFAULT_VIDEO_LABEL;

  const media = document.createElement('div');
  media.className = 'cwap-banner-media';

  const [desktopFrame, mobileFrame = desktopFrame] = frameCells
    .map((frameCell) => frameCell.querySelector('img'))
    .filter(Boolean);
  if (desktopFrame) {
    media.classList.add('has-frame');
    media.style.setProperty('--cwap-frame-desktop', `url('${imageUrl(desktopFrame, '750')}')`);
    media.style.setProperty('--cwap-frame-mobile', `url('${imageUrl(mobileFrame, '400')}')`);
  }

  const video = document.createElement('video');
  video.className = 'cwap-banner-video';
  video.muted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.controls = true;
  video.preload = 'none';
  ['muted', 'loop', 'autoplay', 'playsinline'].forEach((attr) => video.setAttribute(attr, ''));
  video.setAttribute('aria-label', label);
  media.append(video);

  // load the video only once the banner is close to the viewport
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    video.src = src;
    video.play().catch(() => { /* autoplay blocked: controls remain available */ });
  }, { rootMargin: '200px' });
  observer.observe(media);

  return media;
}

export default function decorate(block) {
  const rows = [...block.children];
  const byLabel = (name) => rows.find((row) => rowLabel(row) === name);
  const valueCell = (name) => byLabel(name)?.children[1];

  const isFirstSection = block.closest('.section') === block.closest('main')?.querySelector('.section');

  const inner = document.createElement('div');
  inner.className = 'cwap-banner-inner';

  const content = document.createElement('div');
  content.className = 'cwap-banner-content';

  const titleCell = valueCell('title');
  if (titleCell) {
    const title = document.createElement(isFirstSection ? 'h1' : 'h2');
    title.className = 'cwap-banner-title';
    getLines(titleCell).forEach((line) => {
      const span = document.createElement('span');
      span.textContent = line;
      title.append(span, ' ');
    });
    content.append(title);
  }

  const caption = valueCell('caption')?.textContent.trim();
  if (caption) {
    const el = document.createElement(isFirstSection ? 'h2' : 'h3');
    el.className = 'cwap-banner-caption';
    el.textContent = caption;
    content.append(el);
  }

  const downloadText = valueCell('download text')?.textContent.trim();
  if (downloadText) {
    const el = document.createElement('p');
    el.className = 'cwap-banner-download';
    el.textContent = downloadText;
    content.append(el);
  }

  const stores = rows
    .filter((row) => STORE_LABELS.includes(rowLabel(row)))
    .map((row) => buildStore([...row.children]))
    .filter(Boolean);
  if (stores.length) {
    const list = document.createElement('ul');
    list.className = 'cwap-banner-stores';
    list.append(...stores);
    content.append(list);
  }

  inner.append(content);

  const videoRow = byLabel('video');
  const media = videoRow ? buildVideo(videoRow) : null;
  if (media) inner.append(media);

  const bgRow = byLabel('background');
  const [desktopImg, mobileImg = desktopImg] = bgRow ? bgRow.querySelectorAll('img') : [];

  // the banner keeps its viewport height; image sections follow it at their own size
  const hero = document.createElement('div');
  hero.className = 'cwap-banner-hero';
  if (desktopImg) hero.append(buildBackground(desktopImg, mobileImg, isFirstSection));
  hero.append(inner);

  const features = rows
    .filter((row) => !BANNER_LABELS.includes(rowLabel(row)))
    .map(buildFeature)
    .filter(Boolean);

  block.replaceChildren(hero, ...features);
}
