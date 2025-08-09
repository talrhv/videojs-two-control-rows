/*! videojs-two-row-controls v1.0.0 | MIT */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['video.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('video.js'));
  } else {
    root.videojsTwoRowControls = factory(root.videojs);
  }
}(this, function (videojs) {
  'use strict';
  var Plugin = videojs.getPlugin('plugin');

  function move(el, parent) {
    if (el && parent && el.parentNode !== parent) parent.appendChild(el);
  }

  function createEl(tag, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  class TwoRowControls extends Plugin {
    constructor(player, options) {
      super(player, options || {});
      this.opts = Object.assign({
        // ניתן לשנות סדר כפתורים בשורה התחתונה
        bottomOrder: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'subsCapsButton',
          'airPlayButton',
          'remainingTimeDisplay', // אם קיים
          'spacer',               // ריווח גמיש
          'fullscreenToggle'
        ],
        // מחלקות CSS בסיסיות
        classes: {
          root: 'vjs-2row',
          top: 'vjs-2row-top',
          bottom: 'vjs-2row-bottom'
        }
      }, options || {});

      this.on('dispose', () => this.teardown());
      player.ready(() => this.build());
    }

    build() {
      var player = this.player;
      var cb = player.getChild('controlBar');
      if (!cb || this._built) return;

      // עטיפה ראשית
      var wrapper = createEl('div', this.opts.classes.root);
      cb.el_.parentNode.insertBefore(wrapper, cb.el_);
      wrapper.appendChild(cb.el_);

      // שני קונטיינרים: עליון/תחתון
      var top = createEl('div', this.opts.classes.top);
      var bottom = createEl('div', this.opts.classes.bottom);

      cb.el_.insertBefore(top, cb.el_.firstChild);
      cb.el_.appendChild(bottom);

      // מציאת רכיבים קיימים
      var progress = cb.getChild('progressControl')?.el_;
      // ב־v8 יש גם seekToLiveControl — נשאיר למטה אם קיים
      var childrenEls = Array.prototype.slice.call(cb.el_.children);

      // להעביר את progress לשורה העליונה
      if (progress) move(progress, top);

      // להכין Spacer דינמי לתחתון
      var spacerEl = createEl('div', 'vjs-2row-spacer');
      spacerEl.setAttribute('aria-hidden', 'true');

      // פוקנ׳ שמחזירה אלמנט לפי שם קומפוננט
      const elByName = (name) => {
        if (name === 'spacer') return spacerEl;
        var child = cb.getChild(name);
        return child && child.el_ ? child.el_ : null;
      };

      // להעביר רכיבים לפי סדר מוגדר
      this.opts.bottomOrder.forEach((name) => {
        var el = elByName(name);
        if (el) move(el, bottom);
      });

      // כל רכיב שלא זוהה — יורד לתחתון בסוף
      childrenEls.forEach((el) => {
        if (el !== top && el.parentNode === cb.el_) move(el, bottom);
      });

      // לשמירה בניקוי
      this._els = { wrapper, top, bottom, spacerEl };
      this._built = true;

      // הוסף מחלקה ל־player לשימושי CSS
      player.addClass('vjs-has-2row-controls');
    }

    teardown() {
      if (!this._built) return;
      var player = this.player;
      var cb = player.getChild('controlBar');
      if (cb && this._els) {
        // להחזיר את כל הילדים חזרה ישירות ל־controlBar (ללא top/bottom)
        const { top, bottom, wrapper } = this._els;

        // להזיז את הילדים של top ובottom חזרה ל־controlBar
        while (top && top.firstChild) cb.el_.appendChild(top.firstChild);
        while (bottom && bottom.firstChild) cb.el_.appendChild(bottom.firstChild);

        // להסיר קונטיינרים
        if (top && top.parentNode) top.parentNode.removeChild(top);
        if (bottom && bottom.parentNode) bottom.parentNode.removeChild(bottom);

        // לפרק עטיפה
        if (wrapper && wrapper.parentNode) {
          wrapper.parentNode.insertBefore(cb.el_, wrapper);
          wrapper.parentNode.removeChild(wrapper);
        }
      }
      this.player.removeClass('vjs-has-2row-controls');
      this._built = false;
      this._els = null;
    }
  }

  videojs.registerPlugin('twoRowControls', TwoRowControls);
  TwoRowControls.VERSION = '1.0.0';
  return TwoRowControls;
}));
