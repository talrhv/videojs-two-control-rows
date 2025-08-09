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

      const observer = new MutationObserver((mutations) => {
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

      // Timeout fallback
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  class Rows2 extends Plugin {
    constructor(player, options) {
      super(player, options || {});
      this.player = player;
      this.isBuilt = false;
      this.retryCount = 0;
      this.maxRetries = 10;
      
      this.build = this.build.bind(this);
      this.rebuild = this.rebuild.bind(this);
      
      // Wait for player to be ready, then build
      if (player.isReady_) {
        this.waitAndBuild();
      } else {
        player.ready(() => this.waitAndBuild());
      }
      
      // Listen for control bar changes
      player.on('loadstart', this.rebuild);
      player.on('canplay', this.rebuild);
      
      // Cleanup on dispose
      player.one('dispose', () => this.dispose());
    }

    async waitAndBuild() {
      // Wait a bit for all components to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.build();
    }

    async build() {
      if (this.isBuilt) return;
      
      const player = this.player;
      const root = player.el();
      
      if (!root) return;

      // Get control bar
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

        // Collect all current children (except progress)
        const otherControls = Array.from(cbEl.children).filter(child => 
          !child.classList.contains('vjs-progress-control')
        );

        // Clear control bar
        cbEl.innerHTML = '';
        
        // Add rows to control bar
        cbEl.appendChild(topRow);
        cbEl.appendChild(bottomRow);
        
        // Move progress to top row
        topRow.appendChild(progressEl);
        
        // Move other controls to bottom row
        otherControls.forEach(control => {
          if (control && control.parentNode !== bottomRow) {
            bottomRow.appendChild(control);
          }
        });

        // Add CSS class
        player.addClass('vjs-has-2row-controls');
        this.isBuilt = true;

      } catch (error) {
        console.error('VideoJS Rows build error:', error);
      }
    }

    async rebuild() {
      if (!this.isBuilt) return;
      
      // Reset and rebuild
      this.isBuilt = false;
      this.player.removeClass('vjs-has-2row-controls');
      
      // Wait a bit then rebuild
      setTimeout(() => this.build(), 100);
    }

    dispose() {
      const player = this.player;
      const root = player.el();
      
      if (!root || !this.isBuilt) return;

      const controlBar = player.getChild('ControlBar');
      if (!controlBar) return;

      const cbEl = controlBar.el();
      if (!cbEl) return;

      try {
        // Get all controls from both rows
        const allControls = [];
        const topRow = cbEl.querySelector('.vjs-2row-top');
        const bottomRow = cbEl.querySelector('.vjs-2row-bottom');
        
        [topRow, bottomRow].forEach(row => {
          if (row) {
            Array.from(row.children).forEach(child => {
              allControls.push(child);
            });
            row.remove();
          }
        });

        // Put all controls back in control bar
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
      super.dispose();
    }
  }

  // Register plugin
  videojs.registerPlugin('rows2', Rows2);
  
  return Rows2;
}));
