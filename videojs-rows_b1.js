import { useEffect, useRef, useState } from "preact/hooks";
import { useVideoPlayer } from "../lesson/VideoPlayerContext";
import LoaderSpinner from "../../../common/LoaderSpinner";
import { getPlayerStrategy } from "../../../../scripts/video-utils";
import { useTabsContext } from "./TabsContext";
import { loadAsset } from "../../../../scripts/course";

const VideoPlayer = ({ src }) => {
  const { playerRef, videoRef } = useVideoPlayer();
  const [isLoading, setIsLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);

  let {
    seekAfterLoad,
    timeUpdateListener,
    createTrackList,
    createMomentsSegments,
  } = useVideoPlayer();

  const { createNotesMock } = useTabsContext();

  // Ref לשמירת Object URLs שצריך לשחרר
  const objectUrlRef = useRef(null);
  // Ref לשמירת event listeners
  const eventListenersRef = useRef([]);

  // async function loadAsset(type, src) {
  //   return new Promise((resolve, reject) => {
  //     if (type === "script") {
  //       if (document.querySelector(`script[src="${src}"]`)) return resolve();
  //       const script = document.createElement("script");
  //       script.src = src;
  //       script.async = true;
  //       script.onload = () => resolve();
  //       script.onerror = () =>
  //         reject(new Error(`Failed to load script: ${src}`));
  //       document.head.appendChild(script);
  //     } else if (type === "css") {
  //       if (document.querySelector(`link[href="${src}"]`)) return resolve();
  //       const link = document.createElement("link");
  //       link.rel = "stylesheet";
  //       link.href = src;
  //       link.onload = () => resolve();
  //       link.onerror = () => reject(new Error(`Failed to load CSS: ${src}`));
  //       document.head.appendChild(link);
  //     } else {
  //       reject(new Error(`Unknown type: ${type}`));
  //     }
  //   });
  // }

  const getM3u8Url = async (videoSrc) => {
    let m3u8Url = videoSrc;
    const res = await fetch(`${videoSrc}?isHls=true`, {
      headers: { cookie: document.cookie },
    });
    if (!res.ok) throw new Error("Failed to get signed URL or content");

    const { urlContent, mime } = await res.json();

    if (typeof urlContent === "string" && urlContent.startsWith("#EXTM3U")) {
      // שחרור Object URL קודם אם קיים
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const blob = new Blob([urlContent], {
        type: mime || "application/vnd.apple.mpegurl",
      });
      m3u8Url = URL.createObjectURL(blob);
      objectUrlRef.current = m3u8Url;
    } else {
      m3u8Url = urlContent;
    }

    return m3u8Url;
  };

  const cleanupResources = () => {
    // שחרור Object URLs
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    // הסרת event listeners מ-videoRef
    if (videoRef.current) {
      eventListenersRef.current.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
    }
    eventListenersRef.current = [];

    // הסרת VideoJS event listeners וניקוי
    if (playerRef.current) {
      // הסרת external time update handler
      if (playerRef.current._externalTimeUpdateHandler) {
        playerRef.current.off(
          "timeupdate",
          playerRef.current._externalTimeUpdateHandler
        );
        delete playerRef.current._externalTimeUpdateHandler;
      }

      // הסרת כל האירועים שנרשמו
      if (playerRef.current._eventHandlers) {
        Object.keys(playerRef.current._eventHandlers).forEach((eventType) => {
          playerRef.current.off(eventType);
        });
      }

      playerRef.current.dispose();
      playerRef.current = null;
    }
  };

  const addEventListenerWithCleanup = (element, event, handler) => {
    element.addEventListener(event, handler);
    eventListenersRef.current.push({ element, event, handler });
  };

  const setupPlayer = async (videoSrc) => {
    const strategy = getPlayerStrategy();
    console.log("Using player strategy:", strategy);

    try {
      switch (strategy.type) {
        case "native-hls-limited":
        case "native-hls-full":
          await setupNativeHLSPlayer(videoSrc, strategy.plugins);
          break;

        case "mse-full":
        case "mse-full-hybrid":
          await setupMSEPlayer(videoSrc, strategy.plugins);
          break;

        case "fallback":
        default:
          setupBasicHTML5Player(videoSrc);
          break;
      }
    } catch (err) {
      console.error("Failed to setup player:", err);
      setIsLoading(false);
      setupBasicHTML5Player(videoSrc);
    }
  };

  const setupNativeHLSPlayer = async (videoSrc, enabledPlugins) => {
    console.log("Setting up Native HLS player with plugins:", enabledPlugins);

    // טעינת VideoJS ופלאגינים נתמכים
    await loadAsset("script", "https://vjs.zencdn.net/8.9.0/video.min.js");
    await loadAsset("css", "https://vjs.zencdn.net/8.9.0/video-js.css");
    await loadAsset(
      "script",
      "https://unpkg.com/@silvermine/videojs-airplay@1.3.0/dist/silvermine-videojs-airplay.js"
    );
    await loadAsset(
      "css",
      "https://unpkg.com/@silvermine/videojs-airplay@1.3.0/dist/silvermine-videojs-airplay.css"
    );

    if (enabledPlugins.includes("chapters")) {
      await loadAsset(
        "script",
        "https://cdn.jsdelivr.net/gh/talrhv/videojs-chapters@main/videojs_chapters_v8_4.js"
      );
      await loadAsset(
        "css",
        "https://cdn.jsdelivr.net/npm/@viostream/videojs-chapters/dist/videojs-chapters.css"
      );
      await loadAsset(
        "css",
        "https://cdn.jsdelivr.net/gh/talrhv/videojs-chapters@main/videojs_chapters_v8_4.css"
      );
    }

    if (enabledPlugins.includes("notes")) {
      await loadAsset(
        "script",
        "https://cdn.jsdelivr.net/gh/talrhv/videojs-notes@main/videojs-notes_b27.js"
      );
      await loadAsset(
        "css",
        "https://cdn.jsdelivr.net/gh/talrhv/videojs-notes@main/videojs-notes_b12.css"
      );
    }

    if (enabledPlugins.includes("hotkeys")) {
      await loadAsset(
        "script",
        "https://cdn.sc.gl/videojs-hotkeys/latest/videojs.hotkeys.min.js"
      );
    }

    if (!playerRef.current) {
      playerRef.current = window.videojs(videoRef.current, {
        autoplay: false,
        controls: true,
        controlBar: {
          children: [
            // שורה עליונה - פס התקדמות
            { name: "progressControl" },
            // שורה תחתונה - שאר הכפתורים
            {
              name: "customControlSpacer", // אפשר לשים כאן מה שרוצים
            },
            { name: "playToggle" },
            { name: "volumePanel", inline: false },
            { name: "currentTimeDisplay" },
            { name: "timeDivider" },
            { name: "durationDisplay" },
            { name: "subsCapsButton" },
            { name: "fullscreenToggle" },
          ],
        },
        plugins: {
          airPlay: {
            addButtonToControlBar: true,
            buttonPositionIndex: 4, // או מיקום אחר
            addAirPlayLabelToButton: false,
          },
        },
        fluid: true,
        html5: {
          nativeVideoTracks: true,
          nativeAudioTracks: true,
          nativeTextTracks: true,
        },
        sources: [
          {
            src: videoSrc,
            type: "application/vnd.apple.mpegurl",
          },
        ],
      });

      setShowPlayer(true);

      // הפעלת פלאגינים נתמכים
      if (enabledPlugins.includes("notes") && createNotesMock?.current) {
        createNotesMock.current.init();
      }

      setupPlayerEvents(enabledPlugins);
    }

    // שימוש בנגן נטיבי
    if (videoRef.current) {
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
      // videoRef.current.src = videoSrc;
      // videoRef.current.load();
      setIsLoading(false);
    }
  };

  const setupMSEPlayer = async (videoSrc, enabledPlugins) => {
    console.log("Setting up MSE player with plugins:", enabledPlugins);

    let m3u8Url = videoSrc;

    // טעינת כל הסקריפטים הנדרשים
    await loadAsset("script", "https://vjs.zencdn.net/8.9.0/video.min.js");
    await loadAsset("css", "https://vjs.zencdn.net/8.9.0/video-js.css");

    if (enabledPlugins.includes("hlsQualitySelector")) {
      await loadAsset(
        "script",
        "https://cdn.jsdelivr.net/npm/videojs-hls-quality-selector@2.0.0/dist/videojs-hls-quality-selector.min.js"
      );
      await loadAsset(
        "css",
        "https://cdn.jsdelivr.net/npm/videojs-hls-quality-selector@2.0.0/dist/videojs-hls-quality-selector.min.css"
      );
    }

    if (enabledPlugins.includes("chapters")) {
      await loadAsset(
        "script",
        "https://cdn.jsdelivr.net/gh/talrhv/videojs-chapters@main/videojs_chapters_v8_4.js"
      );
      await loadAsset(
        "css",
        "https://cdn.jsdelivr.net/npm/@viostream/videojs-chapters/dist/videojs-chapters.css"
      );
      await loadAsset(
        "css",
        "https://cdn.jsdelivr.net/gh/talrhv/videojs-chapters@main/videojs_chapters_v8_4.css"
      );
    }

    if (enabledPlugins.includes("notes")) {
      await loadAsset(
        "script",
        "https://cdn.jsdelivr.net/gh/talrhv/videojs-notes@main/videojs-notes_b27.js"
      );
      await loadAsset(
        "css",
        "https://cdn.jsdelivr.net/gh/talrhv/videojs-notes@main/videojs-notes_b12.css"
      );
    }

    if (enabledPlugins.includes("hotkeys")) {
      await loadAsset(
        "script",
        "https://cdn.sc.gl/videojs-hotkeys/latest/videojs.hotkeys.min.js"
      );
    }

    // קבלת HLS content
    m3u8Url = await getM3u8Url(videoSrc);

    if (!playerRef.current) {
      playerRef.current = window.videojs(videoRef.current, {
        autoplay: false,
        muted: false,
        controls: true,
        fluid: true,
        sources: [
          {
            src: m3u8Url,
            type: "application/vnd.apple.mpegurl",
          },
        ],
      });

      setShowPlayer(true);

      // הפעלת פלאגינים
      if (enabledPlugins.includes("hlsQualitySelector")) {
        playerRef.current.hlsQualitySelector?.({
          displayCurrentQuality: true,
        });
      }

      if (enabledPlugins.includes("notes") && createNotesMock?.current) {
        createNotesMock.current.init();
      }

      setupPlayerEvents(enabledPlugins);
    } else {
      // if (createMomentsSegments?.current) {
      //   createMomentsSegments.current();
      // }

      if (!playerRef.current.paused()) {
        playerRef.current.pause();
      }

      playerRef.current.src({
        src: m3u8Url,
        type: "application/vnd.apple.mpegurl",
      });

      playerRef.current.ready(() => {
        playerRef.current.load();
        playerRef.current.hotkeys({
          seekStep: 10,
          enableModifiersForNumbers: false,
        });
      });
    }
  };

  const setupBasicHTML5Player = (videoSrc) => {
    console.log("Setting up basic HTML5 player");
    setShowPlayer(true);

    if (videoRef.current) {
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
      videoRef.current.src = videoSrc;
      videoRef.current.load();

      // אירועי loading בסיסיים
      videoRef.current.addEventListener("loadeddata", () =>
        setIsLoading(false)
      );
      videoRef.current.addEventListener("error", () => setIsLoading(false));
    }
  };

  const setupPlayerEvents = (enabledPlugins) => {
    // רישום event handlers עם מעקב לניקוי
    const logEvents = [
      "loadstart",
      "loadedmetadata",
      "loadeddata",
      "canplay",
      "error",
    ];
    const eventHandlers = [];

    logEvents.forEach((event) => {
      const handler = () => console.log(`VideoJS event: ${event}`);
      playerRef.current.on(event, handler);
      eventHandlers.push({ event, handler });
    });

    // שמירת handlers לניקוי מאוחר יותר
    playerRef.current._eventHandlers = eventHandlers.reduce(
      (acc, { event, handler }) => {
        acc[event] = handler;
        return acc;
      },
      {}
    );

    const onReady = () => {
      console.log("onReady triggered");
      if (
        seekAfterLoad?.current &&
        seekAfterLoad.current.new_lesson_id === seekAfterLoad.current.lesson_id
      ) {
        playerRef.current.currentTime(seekAfterLoad.current.time);
        seekAfterLoad.current = null;
      }
      setIsLoading(false);

      if (createTrackList?.current) {
        createTrackList.current();
      }

      if (createNotesMock?.current) {
        createNotesMock.current.set_notes();
      }

      // רישום מאזין ל-timeupdate אם קיים מאזין חיצוני
      if (timeUpdateListener?.current) {
        const handler = () => timeUpdateListener.current(playerRef);
        playerRef.current.on("timeupdate", handler);
        playerRef.current._externalTimeUpdateHandler = handler;
      }
    };

    if (enabledPlugins.includes("chapters") && createMomentsSegments?.current) {
      createMomentsSegments.current();
    }
    // הוספת PiP event listeners עם cleanup
    const pipEnterHandler = () => {
      console.log("Entered PiP");
      document.body.classList.add("in-pip");
    };

    const pipLeaveHandler = () => {
      console.log("Left PiP");
      document.body.classList.remove("in-pip");
    };

    addEventListenerWithCleanup(
      videoRef.current,
      "enterpictureinpicture",
      pipEnterHandler
    );
    addEventListenerWithCleanup(
      videoRef.current,
      "leavepictureinpicture",
      pipLeaveHandler
    );

    playerRef.current.on("loadeddata", onReady);

    playerRef.current.ready(() => {
      playerRef.current.hotkeys({
        seekStep: 10,
        enableModifiersForNumbers: false,
      });

      playerRef.current.play().catch((err) => {
        setIsLoading(false);
        console.warn("Autoplay prevented, waiting for user interaction", err);
      });
    });
  };

  // Cleanup effect
  useEffect(() => {
    return cleanupResources;
  }, []);

  // Setup effect
  useEffect(() => {
    if (src) {
      setIsLoading(true);
      setupPlayer(src);
    }

    // Cleanup כשמשנים src
    return () => {
      // ניקוי חלקי כשמשנים src
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src]);

  return (
    <div class="relative">
      {isLoading && <LoaderSpinner size={48} />}
      <div className={`p-8 ${showPlayer ? "" : "hidden"}`}>
        <video
          id="lesson-player"
          ref={videoRef}
          class={`video-js vjs-default-skin vjs-big-play-centered w-full rounded-xl`}
          controls
          preload="auto"
          playsInline
          webkit-playsinline
        />
      </div>
    </div>
  );
};

export default VideoPlayer;
