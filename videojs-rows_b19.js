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

      // Timeout fallback
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
      
      // For backward compatibility, support bottomOrder option
      if (this.options.bottomOrder) {
        // Filter out left controls from bottomOrder
        this.rightControls = this.options.bottomOrder.filter(ctrl => !this.leftControls.includes(ctrl));
      }
      
      this.build = this.build.bind(this);
      this.rebuild = this.rebuild.bind(this);
      this.safeRebuild = this.safeRebuild.bind(this);
      
      // Wait for player to be ready, then build
      if (player.isReady_) {
        this.waitAndBuild();
      } else {
        player.ready(() => this.waitAndBuild());
      }
      
      // Listen for control bar changes — avoid events that fire on seek (e.g., canplay)
      player.on('loadstart', this.safeRebuild);
      player.on('loadedmetadata', this.safeRebuild);
      player.on('playerresize', this.safeRebuild);
      player.on('fullscreenchange', this.safeRebuild);
      
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
        
        // Create left and right containers for bottom row
        const leftContainer = document.createElement('div');
        leftContainer.className = 'vjs-2row-bottom-left';
        
        const rightContainer = document.createElement('div');
        rightContainer.className = 'vjs-2row-bottom-right';

        // Clear control bar
        cbEl.innerHTML = '';
        
        // Add rows to control bar
        cbEl.appendChild(topRow);
        cbEl.appendChild(bottomRow);
        
        // Add left and right containers to bottom row
        bottomRow.appendChild(leftContainer);
        bottomRow.appendChild(rightContainer);
        
        // Move progress to top row
        topRow.appendChild(progressEl);
        
        // Add left controls to left container
        this.leftControls.forEach(controlName => {
          this.addControlToContainer(controlBar, controlName, leftContainer, cbEl);
        });
        
        // Add right controls to right container  
        this.rightControls.forEach(controlName => {
          this.addControlToContainer(controlBar, controlName, rightContainer, cbEl);
        });

        // Add CSS class
        player.addClass('vjs-has-2row-controls');
        this.isBuilt = true;

      } catch (error) {
        console.error('VideoJS Rows build error:', error);
      }
    }

    safeRebuild(e) {
      // Skip rebuilds during seek/scrub to avoid flicker
      if (!this.isBuilt) return;
      if (this.player.seeking && this.player.seeking()) return;
      if (this.player.hasClass && this.player.hasClass('vjs-scrubbing')) return;
      this.rebuild(e);
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
          if (childEl && 
              !childEl.classList.contains('vjs-progress-control') &&
              !leftContainer.contains(childEl) &&
              !rightContainer.contains(childEl)) {
            
            // Skip if it's one of the left controls by checking class names
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
      // First try component mapping
      const componentName = CONTROL_MAP[controlName];
      let foundControl = false;
      
      if (componentName) {
        const control = controlBar.getChild(componentName);
        if (control && control.el()) {
          container.appendChild(control.el());
          foundControl = true;
        }
      }
      
      // If component mapping failed, try multiple CSS selector approaches
      if (!foundControl) {
        const possibleSelectors = [
          `.vjs-${controlName}`, // exact match
          `.vjs-${controlName.replace(/([A-Z])/g, '-$1').toLowerCase()}`, // camelCase to kebab-case
          `[class*="${controlName}"]`, // partial class match
          `.${controlName}`, // direct class name
          `[class*="vjs-${controlName}"]`, // partial vjs- match
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
      
      // Debug log for troubleshooting
      if (!foundControl) {
        console.warn(`VideoJS Rows: Could not find control "${controlName}"`);
      }
    }

    async rebuild() {
      if (!this.isBuilt) return;
      
      const controlBar = this.player.getChild('ControlBar');
      const cbEl = controlBar && controlBar.el();
      if (!cbEl) return;
      // If structure exists, and containers are present, no teardown is needed
      const topRow = cbEl.querySelector('.vjs-2row-top');
      const left = cbEl.querySelector('.vjs-2row-bottom-left');
      const right = cbEl.querySelector('.vjs-2row-bottom-right');

      if (topRow && left && right) {
        // Nothing to do; keep existing structure without pulling extra controls
        return;
      }

      }

      // Fallback: full rebuild only if structure is missing
      this.isBuilt = false;
      this.player.removeClass('vjs-has-2row-controls');
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
        // Get all controls from all containers
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

        // Remove row containers
        const bottomRow = cbEl.querySelector('.vjs-2row-bottom');
        if (topRow) topRow.remove();
        if (bottomRow) bottomRow.remove();

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


/* ========================
   VideoJS Two-Row Controls CSS
   ======================== */

/* Base setup - ensure container doesn't clip */
.video-js.vjs-has-2row-controls {
  overflow: visible;
}

/* Control bar positioning and layout */
.video-js.vjs-has-2row-controls .vjs-control-bar {
  z-index: 10;
  position: absolute !important;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100% !important;
  height: auto !important;
  display: flex !important;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  margin: 0;
  background: linear-gradient(
    to top, 
    rgba(0, 0, 0, 0.7) 0%, 
    rgba(0, 0, 0, 0.4) 60%,
    rgba(0, 0, 0, 0.1) 100%
  );
  backdrop-filter: blur(2px);
  border-radius: 0 0 8px 8px;
  z-index: 10;
  transform: none !important;
}

/* Top row - progress bar only */
.video-js.vjs-has-2row-controls .vjs-2row-top {
  display: flex !important;
  align-items: center;
  width: 100%;
  min-height: 20px;
  margin: 0;
  padding: 0;
}

/* Progress control in top row */
.video-js.vjs-has-2row-controls .vjs-2row-top .vjs-progress-control {
  flex: 1 !important;
  width: 100% !important;
  height: 20px !important;
  margin: 0 !important;
  padding: 0 !important;
  position: relative;
}

/* Progress holder styling */
.video-js.vjs-has-2row-controls .vjs-progress-control .vjs-progress-holder {
  height: 20px !important;
  margin: 2px 0 !important;
  /*   border-radius: 8px; */
  background: rgba(255, 255, 255, 0.2) !important;
  overflow: hidden !important;
  position: unset; /* (kept as requested) */
  cursor: pointer;
}

/* Load progress */
.video-js.vjs-has-2row-controls .vjs-load-progress,
.video-js.vjs-has-2row-controls .vjs-load-progress div {
  background: rgba(255, 255, 255, 0.3) !important;
  height: 100%;
  /*   border-radius: 8px; */
}

/* Play progress */
.video-js.vjs-has-2row-controls .vjs-play-progress {
  background: var(--primary-color, #00d4ff) !important;
  height: 100%;
  /*   border-radius: 8px; */
  position: relative;
  overflow: hidden !important;
}

/* Completely hide any handles or sliders */
.video-js.vjs-has-2row-controls .vjs-seek-handle,
.video-js.vjs-has-2row-controls .vjs-slider-handle,
.video-js.vjs-has-2row-controls .vjs-play-progress .vjs-seek-handle,
.video-js.vjs-has-2row-controls .vjs-play-progress::after,
.video-js.vjs-has-2row-controls .vjs-play-progress::before {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
}

/* Bottom row - container for left and right sides */
.video-js.vjs-has-2row-controls .vjs-2row-bottom {
  display: flex !important;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
  gap: 8px;
  margin: 0;
  padding: 0;
}

/* Left container - play and volume controls */
.video-js.vjs-has-2row-controls .vjs-2row-bottom-left {
  display: flex !important;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
}

/* Right container - all other controls */
.video-js.vjs-has-2row-controls .vjs-2row-bottom-right {
  display: flex !important;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  flex: 1;
  justify-content: flex-end;
}

/* Universal styling for all bottom row controls (both left and right) */
.video-js.vjs-has-2row-controls .vjs-2row-bottom-left > *:not(.vjs-spacer):not([class*="time"]):not([class*="divider"]):not([class*="volume-panel"]),
.video-js.vjs-has-2row-controls .vjs-2row-bottom-right > *:not(.vjs-spacer):not([class*="time"]):not([class*="divider"]):not([class*="volume-panel"]) {
  position: relative;
  background: none !important;
  border: none;
  border-radius: 6px;
  color: #fff !important;
  opacity: 0.9;
  transition: all 0.15s ease;
  padding: 0 !important;
  margin: 0 2px;
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  max-width: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 16px;
  box-sizing: border-box !important;
}

/* Hover effects for all button controls */
.video-js.vjs-has-2row-controls .vjs-2row-bottom-left > *:not(.vjs-spacer):not([class*="time"]):not([class*="divider"]):not([class*="volume-panel"]):hover,
.video-js.vjs-has-2row-controls .vjs-2row-bottom-right > *:not(.vjs-spacer):not([class*="time"]):not([class*="divider"]):not([class*="volume-panel"]):hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1) !important;
  transform: scale(1.05);
}

/* Active effects for all button controls */
.video-js.vjs-has-2row-controls .vjs-2row-bottom-left > *:not(.vjs-spacer):not([class*="time"]):not([class*="divider"]):not([class*="volume-panel"]):active,
.video-js.vjs-has-2row-controls .vjs-2row-bottom-right > *:not(.vjs-spacer):not([class*="time"]):not([class*="divider"]):not([class*="volume-panel"]):active {
  transform: scale(0.98);
  background: rgba(255, 255, 255, 0.15) !important;
}

/* Volume panel specific styling */
.video-js.vjs-has-2row-controls .vjs-2row-bottom-left [class*="volume-panel"],
.video-js.vjs-has-2row-controls .vjs-2row-bottom-right [class*="volume-panel"] {
  position: relative;
  height: 36px !important;
  align-items: center !important;
  margin: 0 2px;
}

/* Spacer - only in right container */
.video-js.vjs-has-2row-controls .vjs-2row-bottom-right .vjs-spacer {
  flex: 1 !important;
  height: 36px !important;
}

/* Time displays - universal selector for any time-related element */
.video-js.vjs-has-2row-controls .vjs-2row-bottom-left [class*="time"],
.video-js.vjs-has-2row-controls .vjs-2row-bottom-left [class*="duration"],
.video-js.vjs-has-2row-controls .vjs-2row-bottom-left [class*="divider"],
.video-js.vjs-has-2row-controls .vjs-2row-bottom-right [class*="time"],
.video-js.vjs-has-2row-controls .vjs-2row-bottom-right [class*="duration"],
.video-js.vjs-has-2row-controls .vjs-2row-bottom-right [class*="divider"] {
  color: #fff !important;
  font-weight: 500;
  font-size: 13px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  padding: 0 4px !important;
  margin: 0 !important;
  opacity: 0.9;
  height: 36px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  line-height: 1 !important;
  background: none !important;
}

/* Fullscreen and other buttons */
.video-js.vjs-has-2row-controls .vjs-fullscreen-control,
.video-js.vjs-has-2row-controls .vjs-picture-in-picture-control {
  margin-left: auto;
}

/* Hide any progress controls that might appear in bottom containers */
.video-js.vjs-has-2row-controls .vjs-2row-bottom-left .vjs-progress-control,
.video-js.vjs-has-2row-controls .vjs-2row-bottom-right .vjs-progress-control {
  display: none !important;
}

/* Ensure proper z-index for tooltips and overlays */
.video-js .vjs-tooltip,
.video-js .note-tooltip-readonly {
  z-index: 9999 !important;
  pointer-events: auto;
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .video-js.vjs-has-2row-controls .vjs-control-bar {
    padding: 8px;
    gap: 4px;
  }
  
  .video-js.vjs-has-2row-controls .vjs-2row-bottom {
    gap: 4px;
  }
  
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-left,
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-right {
    gap: 4px;
  }
  
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-left .vjs-control,
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-right .vjs-control {
    width: 32px !important;
    height: 32px !important;
    min-width: 32px !important;
    max-width: 32px !important;
    min-height: 32px !important;
    max-height: 32px !important;
    font-size: 14px;
  }
  
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-left [class*="time"],
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-left [class*="duration"],
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-left [class*="divider"],
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-right [class*="time"],
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-right [class*="duration"],
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-right [class*="divider"] {
    font-size: 11px;
    height: 32px !important;
  }
  
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-left [class*="volume-panel"],
  .video-js.vjs-has-2row-controls .vjs-2row-bottom-right [class*="volume-panel"] {
    height: 32px !important;
  }
  
  .video-js.vjs-has-2row-controls .vjs-volume-panel .vjs-volume-control,
  .video-js.vjs-has-2row-controls .vjs-volume-panel .vjs-mute-control {
    height: 32px !important;
  }
}

/* Compatibility with container classes */
.p-8 .video-js.vjs-has-2row-controls .vjs-control-bar {
  /* Account for parent padding */
  left: 0;
  right: 0;
  margin: 0;
}

/* Animation for smooth transitions */
.video-js.vjs-has-2row-controls .vjs-control-bar {
  transition: opacity 0.3s ease;
}

/* Ensure control bar stays visible on hover */
.video-js.vjs-has-2row-controls:hover .vjs-control-bar {
  opacity: 1;
}

.vjs-icon-placeholder::before {
  display: flex;
  align-items: center;
  justify-content: center;
}
