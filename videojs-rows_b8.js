/*! videojs-rows (2-row controls) v1.0.3 | MIT */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['video.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('video.js'));
  } else {
    root.videojsRowsTwoLineControls = factory(root.videojs);
  }
}(this, function (videojs) {
  'use strict';
  if (!videojs) throw new Error('video.js is required');

  const Plugin = videojs.getPlugin('plugin');

  function unwrap(el) {
    if (!el || !el.parentNode) return;
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

function buildTwoRows(player) {
  const cb = player.getChild('controlBar');
  if (!cb) return;
  const cbEl = cb.el();

  // מנקה בניה קודמת
  const prevTop = cbEl.querySelector('.vjs-2row-top');
  const prevBottom = cbEl.querySelector('.vjs-2row-bottom');
  if (prevTop) Array.from(prevTop.childNodes).forEach(n => cbEl.insertBefore(n, prevTop));
  if (prevTop && prevTop.parentNode) prevTop.parentNode.removeChild(prevTop);
  if (prevBottom) Array.from(prevBottom.childNodes).forEach(n => cbEl.insertBefore(n, prevBottom));
  if (prevBottom && prevBottom.parentNode) prevBottom.parentNode.removeChild(prevBottom);

  const children = Array.from(cbEl.children)
    .filter(ch => !ch.classList.contains('vjs-2row-top') && !ch.classList.contains('vjs-2row-bottom'));

  const top = document.createElement('div');
  top.className = 'vjs-2row-top';
  const bottom = document.createElement('div');
  bottom.className = 'vjs-2row-bottom';

  // הוסף את הקונטיינרים בתור ילדים אחרונים (בלי קינון שגוי)
  cbEl.appendChild(top);
  cbEl.appendChild(bottom);

  children.forEach(child => {
    if (child.classList.contains('vjs-progress-control')) top.appendChild(child);
    else bottom.appendChild(child);
  });

  // לוודא שהbar יושב מעל הכול בתוך הווידאו
  player.addClass('vjs-has-2row-controls');
}


  class RowsTwoLineControls extends Plugin {
    constructor(player, options) {
      super(player, options);

      // בנייה ראשונה כאשר הכול מוכן
      player.ready(() => {
        buildTwoRows(player);
      });

      // אם Video.js מרענן/בונה מחדש (טכניקה/סורס חדש), נבנה שוב
      const rebuild = () => {
        // לבנות אחרי טיק אחד כדי להבטיח שה־DOM מוכן
        setTimeout(() => buildTwoRows(player), 0);
      };

      player.on('loadstart', rebuild);
      player.on('loadedmetadata', rebuild);
      player.on('controlsenabled', rebuild);
      player.on('dispose', () => {
        player.removeClass('vjs-has-2row-controls');
      });
    }
  }

  videojs.registerPlugin('rowsTwoLineControls', RowsTwoLineControls);
  return RowsTwoLineControls;
}));
