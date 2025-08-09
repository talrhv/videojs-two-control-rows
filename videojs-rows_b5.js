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
    if (!el || !parent) return;
    if (el === parent || el.contains(parent)) return; // הגנה
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

      // יצירת השורות בתוך ה-controlBar
      var top = createEl('div', this.opts.classes.top);
      var bottom = createEl('div', this.opts.classes.bottom);
      cb.el_.innerHTML = ''; // לרוקן את הקיים

      cb.el_.appendChild(top);
      cb.el_.appendChild(bottom);

      // הוספת progressControl לשורה העליונה
      var progress = player.controlBar.getChild('progressControl')?.el_;
      if (progress) move(progress, top);

      // spacer
      var spacerEl = createEl('div', 'vjs-2row-spacer');
      spacerEl.setAttribute('aria-hidden', 'true');

      const elByName = (name) => {
        if (name === 'spacer') return spacerEl;
        var child = player.controlBar.getChild(name);
        return child && child.el_ ? child.el_ : null;
      };

      // הוספת שאר הכפתורים לשורה התחתונה
      this.opts.bottomOrder.forEach((name) => {
        var el = elByName(name);
        if (el) move(el, bottom);
      });

      this._els = { top, bottom, spacerEl };
      this._built = true;
      player.addClass('vjs-has-2row-controls');
    }

    teardown() {
      if (!this._built) return;
      var player = this.player;
      var cb = player.getChild('controlBar');
      if (cb && this._els) {
        const { top, bottom } = this._els;
        while (top && top.firstChild) cb.el_.appendChild(top.firstChild);
        while (bottom && bottom.firstChild) cb.el_.appendChild(bottom.firstChild);
        if (top && top.parentNode) top.parentNode.removeChild(top);
        if (bottom && bottom.parentNode) bottom.parentNode.removeChild(bottom);
      }
      this.player.removeClass('vjs-has-2row-controls');
      this._built = false;
      this._els = null;
    }
  }

  videojs.registerPlugin('twoRowControls', TwoRowControls);
  return TwoRowControls;
}));
