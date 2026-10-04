/**
 * The CWAP blocks zoom out on smaller desktops like the reference page, which does
 * it with a page-wide `body { zoom }`. When the page itself is already zoomed (e.g.
 * the asianpaints.com header styles are on the page), a block must not zoom a
 * second time, so it gets a `data-page-zoomed` attribute and its CSS switches its
 * own zoom off. Those styles can arrive after the block is decorated (the header
 * loads later), so the check reruns whenever the block's wrapper changes size:
 * a page zoom changes its width in CSS pixels, and so does resizing the window.
 * @param {Element} block The block element
 */
export default function syncPageZoom(block) {
  const update = () => {
    let zoom = 1;
    for (let el = block.parentElement; el; el = el.parentElement) {
      zoom *= parseFloat(getComputedStyle(el).zoom) || 1;
    }
    block.toggleAttribute('data-page-zoomed', Math.abs(zoom - 1) > 0.001);
  };
  update();
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(block.parentElement);
  else window.addEventListener('resize', update);
}
