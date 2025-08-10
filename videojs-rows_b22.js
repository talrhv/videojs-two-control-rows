/*! videojs-rows (fixed) – two-row control bar */
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

  function waitForElement(selector, parent, timeout = 5000) {
    return new Promise((resolve) => {
      const element = parent.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const found = parent.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });

      observer.observe(parent, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  // Map control names to Video.js component names
  const CONTROL_MAP = {
    'playToggle': 'PlayToggle',
    'volumePanel': 'VolumePanel',
    'volumePanelHorizontal': 'VolumePanelHorizontal',
    'currentTimeDisplay': 'CurrentTimeDisplay',
    'remainingTime': 'RemainingTimeDisplay',
    'timeDivider': 'TimeDivider',
    'durationDisplay': 'DurationDisplay',
    'spacer': 'Spacer',
    'fullscreenToggle': 'FullscreenToggle',
    'pictureInPictureToggle': 'PictureInPictureToggle',
    'qualitySelector': 'QualityButton',
    'playbackRateMenuButton': 'PlaybackRateMenuButton',
    'chaptersButton': 'ChaptersButton',
    'descriptionsButton': 'DescriptionsButton',
    'captionsButton': 'CaptionsButton',
    'subtitlesButton': 'SubtitlesButton',
    'audioTrackButton': 'AudioTrackButton'
  };

  class Rows2 extends Plugin {
    constructor(player, options) {
      super(player, options || {});
      this.player = player;
      this.options = options || {};
      this.isBuilt = false;
      this.retryCount = 0;
      this.maxRetries = 10;

      // Define left side controls - only these two
      this.leftControls = ['playToggle', 'volumePanel'];

      // Default bottom row order if not specified (excluding left controls)
      this.rightControls = this.options.rightControls || [
        'currentTimeDisplay',
        'timeDivider',
        'durationDisplay',
        'spacer',
        'fullscreenToggle'
      ];

      // Backward compatibility: bottomOrder
      if (this.options.bottomOrder) {
        this.rightControls = this.options.bottomOrder.filter(
          ctrl => !this.leftControls.includes(ctrl)
        );
      }

      // Bindings
      this.build = this.build.bind(this);
      this.rebuild = this.rebuild.bind(this);

      // Safe rebuild handler (prevents rebuild during seeking/scrubbing)
      this.safeRebuild = () => {
        if (!this.isBuilt) return;
        // אל תבצע rebuild בזמן seek/גרירה
        if (this.player.seeking && this.player.seeking()) return;
        if (this.player.hasClass && this.player.hasClass('vjs-scrubbing')) return;
        this.rebuild();
      };

      // Wait for player ready then build
      if (player.isReady_) {
        this.waitAndBuild();
      } else {
        player.ready(() => this.waitAndBuild());
      }

      // Listen for layout-affecting events only (avoid canplay)
      player.on('loadstart', this.safeRebuild);
      player.on('loadedmetadata', this.safeRebuild);
      player.on('playerresize', this.safeRebuild);
      player.on('fullscreenchange', this.safeRebuild);

      // Cleanup on dispose
      player.one('dispose', () => this.dispose());
    }

    async waitAndBuild() {
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.build();
    }

    async build() {
      if (this.isBuilt) return;

      const player = this.player;
      const root = player.el();
      if (!root) return;

      const controlBar = player.getChild('ControlBar');
      if (!controlBar) {
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          setTimeout(() => this.build(), 200);
        }
        return;
      }

      const cbEl = controlBar.el();
      if (!cbEl) return;

      // Don't rebuild if already built
      if (player.hasClass('vjs-has-2row-controls')) return;

      try {
        // Wait for progress control to exist
        const progressEl = await waitForElement('.vjs-progress-control', cbEl, 2000);
        if (!progressEl) {
          console.warn('VideoJS Rows: Could not find progress control');
          return;
        }

        // Create row containers
        const topRow = document.createElement('div');
        topRow.className = 'vjs-2row-top';

        const bottomRow = document.createElement('div');
        bottomRow.className = 'vjs-2row-bottom';

        const leftContainer = document.createElement('div');
        leftContainer.className = 'vjs-2row-bottom-left';

        const rightContainer = document.createElement('div');
        rightContainer.className = 'vjs-2row-bottom-right';

        // Clear control bar
        cbEl.innerHTML = '';

        // Add rows
        cbEl.appendChild(topRow);
        cbEl.appendChild(bottomRow);

        // Add left/right to bottom row
        bottomRow.appendChild(leftContainer);
        bottomRow.appendChild(rightContainer);

        // Move progress to top row
        topRow.appendChild(progressEl);

        // Add left controls
        this.leftControls.forEach(controlName => {
          this.addControlToContainer(controlBar, controlName, leftContainer, cbEl);
        });

        // Add right controls
        this.rightControls.forEach(controlName => {
          this.addControlToContainer(controlBar, controlName, rightContainer, cbEl);
        });

        // Also collect any remaining controls not explicitly handled
        this.addAllRemainingControls(controlBar, leftContainer, rightContainer, cbEl);

        player.addClass('vjs-has-2row-controls');
        this.isBuilt = true;

      } catch (error) {
        console.error('VideoJS Rows build error:', error);
      }
    }

    addAllRemainingControls(controlBar, leftContainer, rightContainer, cbEl) {
      // Get all control bar children
      const allChildren = controlBar.children();

      // Also look for any remaining DOM elements in the control bar
      const domElements = Array.from(cbEl.children).filter(el =>
        !el.classList.contains('vjs-2row-top') &&
        !el.classList.contains('vjs-2row-bottom') &&
        !el.classList.contains('vjs-progress-control')
      );

      // Process VideoJS component children
      allChildren.forEach(child => {
        if (child && child.el && typeof child.el === 'function') {
          const childEl = child.el();
          if (
            childEl &&
            !childEl.classList.contains('vjs-progress-control') &&
            !leftContainer.contains(childEl) &&
            !rightContainer.contains(childEl)
          ) {
            const isLeftControl = this.leftControls.some(leftCtrl => {
              const componentName = CONTROL_MAP[leftCtrl];
              if (componentName && child.name_ === componentName) return true;

              const possibleClasses = [
                `vjs-${leftCtrl}`,
                `vjs-${leftCtrl.replace(/([A-Z])/g, '-$1').toLowerCase()}`
              ];
              return possibleClasses.some(cls => childEl.classList.contains(cls));
            });

            if (!isLeftControl) {
              rightContainer.appendChild(childEl);
            }
          }
        }
      });

      // Process remaining DOM elements
      domElements.forEach(el => {
        if (!leftContainer.contains(el) && !rightContainer.contains(el)) {
          const isLeftControl = this.leftControls.some(leftCtrl => {
            const possibleClasses = [
              `vjs-${leftCtrl}`,
              `vjs-${leftCtrl.replace(/([A-Z])/g, '-$1').toLowerCase()}`
            ];
            return possibleClasses.some(cls => el.classList.contains(cls));
          });

          if (!isLeftControl) {
            rightContainer.appendChild(el);
          }
        }
      });
    }

    addControlToContainer(controlBar, controlName, container, cbEl) {
      const componentName = CONTROL_MAP[controlName];
      let foundControl = false;

      if (componentName) {
        const control = controlBar.getChild(componentName);
        if (control && control.el()) {
          container.appendChild(control.el());
          foundControl = true;
        }
      }

      if (!foundControl) {
        const possibleSelectors = [
          `.vjs-${controlName}`,
          `.vjs-${controlName.replace(/([A-Z])/g, '-$1').toLowerCase()}`,
          `[class*="${controlName}"]`,
          `.${controlName}`,
          `[class*="vjs-${controlName}"]`,
        ];

        for (const selector of possibleSelectors) {
          const controlEl = cbEl.querySelector(selector + ':not(.vjs-progress-control)');
          if (controlEl && !container.contains(controlEl)) {
            container.appendChild(controlEl);
            foundControl = true;
            break;
          }
        }
      }

      if (!foundControl) {
        console.warn(`VideoJS Rows: Could not find control "${controlName}"`);
      }
    }

    async rebuild() {
      if (!this.isBuilt) return;

      const controlBar = this.player.getChild('ControlBar');
      const cbEl = controlBar && controlBar.el();
      if (!cbEl) return;

      // אם המבנה כבר קיים – הוסף רק בקרים חסרים, בלי teardown
      const topRow = cbEl.querySelector('.vjs-2row-top');
      const left = cbEl.querySelector('.vjs-2row-bottom-left');
      const right = cbEl.querySelector('.vjs-2row-bottom-right');

      if (topRow && left && right) {
        this.addAllRemainingControls(controlBar, left, right, cbEl);
        return;
      }

      // אם חסר מבנה – ביצוע rebuild מלא
      this.isBuilt = false;
      this.player.removeClass('vjs-has-2row-controls');
      setTimeout(() => this.build(), 100);
    }

    dispose() {
      const player = this.player;
      const root = player.el();

      if (!root || !this.isBuilt) {
        try {
          super.dispose();
        } catch (e) {}
        return;
      }

      const controlBar = player.getChild('ControlBar');
      if (!controlBar) {
        try { super.dispose(); } catch (e) {}
        return;
      }

      const cbEl = controlBar.el();
      if (!cbEl) {
        try { super.dispose(); } catch (e) {}
        return;
      }

      try {
        const allControls = [];
        const topRow = cbEl.querySelector('.vjs-2row-top');
        const leftContainer = cbEl.querySelector('.vjs-2row-bottom-left');
        const rightContainer = cbEl.querySelector('.vjs-2row-bottom-right');

        [topRow, leftContainer, rightContainer].forEach(container => {
          if (container) {
            Array.from(container.children).forEach(child => {
              allControls.push(child);
            });
          }
        });

        const bottomRow = cbEl.querySelector('.vjs-2row-bottom');
        if (topRow) topRow.remove();
        if (bottomRow) bottomRow.remove();

        allControls.forEach(control => {
          if (control) {
            cbEl.appendChild(control);
          }
        });

        player.removeClass('vjs-has-2row-controls');

      } catch (error) {
        console.error('VideoJS Rows dispose error:', error);
      }

      this.isBuilt = false;
      try { super.dispose(); } catch (e) {}
    }
  }

  // Register plugin
  videojs.registerPlugin('rows2', Rows2);

  return Rows2;
}));
