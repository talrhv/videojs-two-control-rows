/*! videojs-two-row-controls v1.0.1 | MIT */
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

  // פונקציה להזזת אלמנט בבטחה
  function move(el, parent) {
    if (!el || !parent) return;
    // אל תנסה להכניס אלמנט לתוך עצמו או לצאצא שלו
    if (el === parent || el.contains(parent)) return;
    if (el.parentNode !== parent) parent.appendChild(el);
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
        bottomOrder: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'subsCapsButton',
          'remainingTimeDisplay',
          'spacer',
          'fullscreenToggle'
        ],
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

      // יצירת wrapper סביב ה-controlBar
      var wrapper = createEl('div', this.opts.classes.root);
      cb.el_.parentNode.insertBefore(wrapper, cb.el_);
      wrapper.appendChild(cb.el_);

      // יצירת שורות עליונה ותחתונה
      var top = createEl('div', this.opts.classes.top);
      var bottom = createEl('div', this.opts.classes.bottom);
      cb.el_.insertBefore(top, cb.el_.firstChild);
      cb.el_.appendChild(bottom);

      // רשימת הילדים המקוריים, ללא ה-top וה-bottom
      var childrenEls = Array.prototype
        .slice.call(cb.el_.children)
        .filter(function (el) { return el !== top && el !== bottom; });

      // הזזת פס ההתקדמות לשורה העליונה
      var progress = cb.getChild('progressControl')?.el_;
      if (progress) move(progress, top);

      // spacer בין רכיבים
      var spacerEl = createEl('div', 'vjs-2row-spacer');
      spacerEl.setAttribute('aria-hidden', 'true');

      const elByName = (name) => {
        if (name === 'spacer') return spacerEl;
        var child = cb.getChild(name);
        return child && child.el_ ? child.el_ : null;
      };

      // הוספת רכיבים לשורה התחתונה בסדר שהוגדר
      this.opts.bottomOrder.forEach((name) => {
        var el = elByName(name);
        if (el) move(el, bottom);
      });

      // כל שאר הרכיבים שלא הוזזו — לתחתונה
      childrenEls.forEach((el) => {
        if (el.parentNode === cb.el_) move(el, bottom);
      });

      this._els = { wrapper, top, bottom, spacerEl };
      this._built = true;
      player.addClass('vjs-has-2row-controls');
    }

    teardown() {
      if (!this._built) return;
      var player = this.player;
      var cb = player.getChild('controlBar');
      if (cb && this._els) {
        const { top, bottom, wrapper } = this._els;
        while (top && top.firstChild) cb.el_.appendChild(top.firstChild);
        while (bottom && bottom.firstChild) cb.el_.appendChild(bottom.firstChild);
        if (top && top.parentNode) top.parentNode.removeChild(top);
        if (bottom && bottom.parentNode) bottom.parentNode.removeChild(bottom);
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
  TwoRowControls.VERSION = '1.0.1';
  return TwoRowControls;
}));
