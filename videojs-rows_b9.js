/*! videojs-rows (b3) – two-row control bar */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['video.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('video.js'));
  } else {
    factory(root.videojs);
  }
}(this, function (videojs) {
  'use strict';
  if (!videojs) throw new Error('video.js is required');

  const Plugin = videojs.getPlugin('plugin');

  function ensureOneProgressControl(controlBarEl) {
    const list = controlBarEl.querySelectorAll('.vjs-progress-control');
    if (list.length <= 1) return list[0] || null;
    // השאר את הראשון ומחק כפולים
    for (let i = 1; i < list.length; i++) list[i].remove();
    return list[0];
  }

  function moveChildSafe(parent, child) {
    if (!parent || !child) return;
    // אל תנסה להכניס אבא לתוך ילד (ימנע HierarchyRequestError)
    if (parent.contains(child) && child.contains(parent)) return;
    if (child.parentNode !== parent) parent.appendChild(child);
  }

  class Rows2 extends Plugin {
    constructor(player, options) {
      super(player, options || {});
      this.player = player;
      this.build = this.build.bind(this);

      // בנה כשמוכן
      if (player.isReady_) this.build();
      else player.ready(this.build);

      // בניקוי, תחזיר מצב ברירת מחדל
      player.one('dispose', () => this.dispose());
    }

    build() {
      const player = this.player;
      const root = player.el();
      if (!root || player.hasClass('vjs-has-2row-controls')) return;

      // ודא שיש controlBar
      const controlBar = player.getChild('ControlBar');
      if (!controlBar) return;
      const cbEl = controlBar.el();

      // אל תיצור שוב
      if (cbEl.querySelector('.vjs-2row-top') || cbEl.querySelector('.vjs-2row-bottom')) {
        player.addClass('vjs-has-2row-controls');
        return;
      }

      // ודא שאין כפילות של progress-control
      const progress = ensureOneProgressControl(cbEl);
      if (!progress) return;

      // צור עוטפים
      const topRow = document.createElement('div');
      topRow.className = 'vjs-2row-top';
      const bottomRow = document.createElement('div');
      bottomRow.className = 'vjs-2row-bottom';

      // שמור את שאר הכפתורים (מלבד progress)
      const rest = [];
      Array.from(cbEl.children).forEach(ch => {
        if (ch === progress) return;
        rest.push(ch);
      });

      // רוקן, ובנה מחדש: topRow + bottomRow בתוך controlBar
      cbEl.innerHTML = '';
      cbEl.appendChild(topRow);
      cbEl.appendChild(bottomRow);

      // העבר את פס ההתקדמות לשורה העליונה
      moveChildSafe(topRow, progress);

      // העבר את כל שאר הכפתורים לשורה התחתונה
      rest.forEach(ch => moveChildSafe(bottomRow, ch));

      // מחלקות עזר
      player.addClass('vjs-has-2row-controls');

      // בטל כפילות progress נוספים אם יתווספו דינמית
      player.on('componentresize', () => ensureOneProgressControl(cbEl));
    }

    dispose() {
      const player = this.player;
      const root = player.el();
      if (!root) return;

      const controlBar = player.getChild('ControlBar');
      if (!controlBar) return;
      const cbEl = controlBar.el();
      if (!cbEl) return;

      // אם בנינו – נפרק חזרה לפריסה חד-שורתית (נחזיר את הילדים כפי שהם)
      const top = cbEl.querySelector('.vjs-2row-top');
      const bottom = cbEl.querySelector('.vjs-2row-bottom');
      if (top || bottom) {
        const fr = document.createDocumentFragment();
        [top, bottom].forEach(row => {
          if (!row) return;
          Array.from(row.childNodes).forEach(ch => fr.appendChild(ch));
          row.remove();
        });
        cbEl.appendChild(fr);
      }
      player.removeClass('vjs-has-2row-controls');
      super.dispose();
    }
  }

  videojs.registerPlugin('rows2', Rows2);
}));
