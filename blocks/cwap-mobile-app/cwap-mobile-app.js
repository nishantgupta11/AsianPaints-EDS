import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * CWAP ("Colour With Asian Paints") mobile-app block. Each row is named in its
 * first cell and rows are grouped into sections in authored order:
 *
 * cwap-carousel  ("A sneak peak of What’s Inside")
 *   carousel      | heading (bold text is the gradient line)
 *   slide         | [icon] | label | description | [screenshot]
 *
 * cwap-download  ("Download our visualizer app now" band)
 *   download      | [logo] | text | video link
 *   store         | [badge] | store link
 */

// time a carousel slide stays visible before the next one fades in (fade is 0.5s in CSS)
const AUTOPLAY_DELAY = 3500;

// row types an author can name in the first cell
const KEYS = ['carousel', 'slide', 'download', 'store'];

let instance = 0;

const rowLabel = (row) => row.children[0]?.textContent.trim().toLowerCase().replace(/\s+/g, ' ') || '';

function createElement(tag, className, ...children) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

function optimize(img, breakpoints) {
  return createOptimizedPicture(img.src, img.getAttribute('alt') || '', false, breakpoints);
}

/**
 * Loads and plays a video only once it is close to the viewport.
 * @param {HTMLVideoElement} video The video element
 * @param {string} src The video URL
 * @param {Element} target The element to watch
 */
function lazyLoadVideo(video, src, target = video) {
  const load = () => {
    if (video.src) return;
    video.src = src;
    video.play?.().catch(() => { /* autoplay can be blocked; controls stay available */ });
  };
  if (!('IntersectionObserver' in window)) { load(); return; }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      load();
    }
  }, { rootMargin: '200px' });
  observer.observe(target);
}

function createVideo(className, label) {
  const video = document.createElement('video');
  video.className = className;
  Object.assign(video, {
    controls: true, autoplay: true, muted: true, loop: true, playsInline: true, preload: 'none',
  });
  ['muted', 'loop', 'autoplay', 'playsinline'].forEach((attr) => video.setAttribute(attr, ''));
  video.setAttribute('aria-label', label);
  return video;
}
/* ---------------------------------------------------------------------------
 * cwap-carousel
 * ------------------------------------------------------------------------- */

/**
 * Builds one carousel slide from [icon] | [label] | [description] | [screenshot].
 * @param {Element[]} cells The authored cells after the row name
 * @returns {Element} The slide
 */
function buildSlide(cells) {
  const imageCells = cells.filter((cell) => cell.querySelector('img'));
  const textCells = cells.filter((cell) => !cell.querySelector('img') && cell.textContent.trim());
  const icon = imageCells.length > 1 ? imageCells[0].querySelector('img') : null;
  const screenshot = imageCells[imageCells.length - 1]?.querySelector('img');
  const [label, description] = textCells.map((cell) => cell.textContent.trim());

  const card = createElement('div', 'cwap-slide-card');
  if (icon) {
    const iconPicture = optimize(icon, [{ width: '150' }]);
    // the label next to the icon already names the feature
    iconPicture.querySelector('img').alt = '';
    card.append(iconPicture);
  }
  if (label) card.append(createElement('span', 'cwap-slide-label', label));

  const info = createElement('div', 'cwap-slide-info', card);
  if (description) info.append(createElement('p', 'cwap-slide-text', description));

  const slide = createElement('div', 'cwap-slide', info);
  if (screenshot) {
    slide.append(createElement(
      'div',
      'cwap-slide-image',
      optimize(screenshot, [{ media: '(min-width: 992px)', width: '1400' }, { width: '1100' }]),
    ));
  }
  return slide;
}

/**
 * Turns the heading and slides into a fading carousel with dots, arrows (mobile),
 * autoplay, swipe and keyboard support.
 * @param {Element|null} heading The authored heading content
 * @param {Element[]} slides The slides
 * @returns {Element} The carousel
 */
function buildCarousel(heading, slides) {
  instance += 1;
  const carousel = createElement('div', 'cwap-carousel');
  if (heading) {
    const title = heading.querySelector('h1, h2, h3, h4, h5, h6');
    title?.querySelectorAll('strong, em').forEach((el) => el.classList.add('cwap-highlight'));
    carousel.append(createElement('div', 'cwap-carousel-heading', ...heading.childNodes));
  }

  const track = createElement('div', 'cwap-carousel-slides', ...slides);
  track.id = `cwap-carousel-${instance}`;
  track.setAttribute('aria-live', 'off');
  const stage = createElement('div', 'cwap-carousel-stage', track);
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-roledescription', 'carousel');
  stage.setAttribute('aria-label', carousel.querySelector('.cwap-carousel-heading')?.textContent.trim() || 'Carousel');

  const prev = createElement('button', 'cwap-carousel-prev');
  const next = createElement('button', 'cwap-carousel-next');
  [[prev, 'Previous slide'], [next, 'Next slide']].forEach(([button, label]) => {
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-controls', track.id);
  });

  const dots = createElement('div', 'cwap-carousel-dots');
  const dotButtons = slides.map((slide, i) => {
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${slides.length}`);
    const dot = createElement('button', 'cwap-carousel-dot');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Show slide ${i + 1}`);
    dot.setAttribute('aria-controls', track.id);
    dots.append(dot);
    return dot;
  });

  let current = 0;
  const show = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', !active);
      slide.inert = !active;
      if (active) dotButtons[i].setAttribute('aria-current', 'true');
      else dotButtons[i].removeAttribute('aria-current');
    });
  };

  // autoplay, paused while the user interacts and when motion is reduced
  let timer;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stop = () => { clearInterval(timer); timer = null; };
  const start = () => {
    stop();
    if (reduced.matches || slides.length < 2) return;
    timer = setInterval(() => show(current + 1), AUTOPLAY_DELAY);
  };

  prev.addEventListener('click', () => { show(current - 1); start(); });
  next.addEventListener('click', () => { show(current + 1); start(); });
  dotButtons.forEach((dot, i) => dot.addEventListener('click', () => { show(i); start(); }));
  stage.addEventListener('mouseenter', stop);
  stage.addEventListener('mouseleave', start);
  stage.addEventListener('focusin', stop);
  stage.addEventListener('focusout', (e) => { if (!stage.contains(e.relatedTarget)) start(); });
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  let startX = null;
  track.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  track.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) { show(current + (dx < 0 ? 1 : -1)); start(); }
  });

  stage.append(prev, next, dots);
  carousel.append(stage);
  show(0);
  if (slides.length < 2) {
    prev.hidden = true;
    next.hidden = true;
    dots.hidden = true;
  }
  start();
  return carousel;
}

/* ---------------------------------------------------------------------------
 * cwap-download
 * ------------------------------------------------------------------------- */

/**
 * Builds the "Download our visualizer app" band from
 * download | [logo] | text | video link, followed by store | [badge] | store link rows.
 * @param {Element[]} cells The authored cells after the row name
 * @param {Element[][]} stores The cells of each store row
 * @returns {Element} The download band
 */
function buildDownload(cells, stores) {
  const logoImg = cells.find((cell) => cell.querySelector('img'))?.querySelector('img');
  const textCell = cells.find((cell) => !cell.querySelector('img, a') && cell.textContent.trim());
  const videoLink = cells.map((cell) => cell.querySelector('a')).find(Boolean);

  const text = createElement('div', 'cwap-download-text');
  if (logoImg) {
    const logo = optimize(logoImg, [{ width: '500' }]);
    logo.classList.add('cwap-download-logo');
    text.append(logo);
  }
  if (textCell) text.append(createElement('p', 'cwap-download-label', textCell.textContent.trim()));

  const links = createElement('div', 'cwap-download-stores');
  stores.forEach((storeCells) => {
    const badge = storeCells.find((cell) => cell.querySelector('img'))?.querySelector('img');
    const href = storeCells.map((cell) => cell.querySelector('a')?.href).find(Boolean);
    if (!badge || !href) return;
    const link = createElement('a', '', optimize(badge, [{ width: '360' }]));
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    links.append(link);
  });
  if (links.children.length) text.append(links);

  const band = createElement('div', 'cwap-download', createElement('div', 'cwap-download-panel', text));
  if (videoLink) {
    const video = createVideo('cwap-download-player', videoLink.textContent.trim() || 'Colour with Asian Paints app video');
    lazyLoadVideo(video, videoLink.href);
    band.append(createElement('div', 'cwap-download-video', video));
  }
  return band;
}

/* ---------------------------------------------------------------------------
 * block
 * ------------------------------------------------------------------------- */

/**
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const parts = [];
  let heading = null;
  let slides = [];
  let download = null;
  let stores = [];

  const flush = () => {
    if (heading || slides.length) parts.push(buildCarousel(heading, slides));
    if (download) parts.push(buildDownload(download, stores));
    heading = null;
    slides = [];
    download = null;
    stores = [];
  };

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const key = rowLabel(row);
    if (!KEYS.includes(key) || cells.length < 2) return;
    const rest = cells.slice(1);

    if (key === 'carousel') {
      flush();
      heading = createElement('div', '');
      rest.forEach((cell) => heading.append(...cell.childNodes));
    } else if (key === 'slide') {
      if (download) flush();
      slides.push(buildSlide(rest));
    } else if (key === 'download') {
      flush();
      download = rest;
    } else if (key === 'store') {
      stores.push(rest);
    }
  });
  flush();

  block.replaceChildren(...parts);
}
