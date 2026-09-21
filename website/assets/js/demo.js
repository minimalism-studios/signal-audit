(function () {
  const VIDEO_ID = 'GMix56shEtk';

  function trackDemoEvent(eventName, params = {}) {
    const payload = {
      page_path: window.location.pathname,
      page_location: window.location.href,
      video_id: VIDEO_ID,
      video_title: 'Signal Audit Demo | From Production Telemetry to Operational Intelligence',
      ...params
    };

    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, payload);
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...payload
    });
  }

  function initSignalDemoTracking() {
    const section =
      document.getElementById('signal-audit-demo');

    const playerElement =
      document.getElementById('signal-audit-demo-player');

    const vanguardLink =
      document.querySelector('[data-signal-demo-vanguard]');

    /* -------------------------------------
       DEMO IMPRESSION
    ------------------------------------- */

    if (
      section &&
      'IntersectionObserver' in window
    ) {
      let impressionTracked = false;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (
              entry.isIntersecting &&
              !impressionTracked
            ) {
              impressionTracked = true;

              trackDemoEvent(
                'signal_demo_impression',
                {
                  percent_visible: 40
                }
              );

              observer.disconnect();
            }
          });
        },
        {
          threshold: 0.4
        }
      );

      observer.observe(section);
    }

    /* -------------------------------------
       VANGUARD CTA
    ------------------------------------- */

    if (vanguardLink) {
      vanguardLink.addEventListener(
        'click',
        () => {
          trackDemoEvent(
            'signal_demo_vanguard_click',
            {
              link_url: vanguardLink.href,
              link_text:
                'Explore the Vanguard Program'
            }
          );
        }
      );
    }

    /* -------------------------------------
       YOUTUBE PLAY
    ------------------------------------- */

    if (!playerElement) return;

    let playTracked = false;

    function createPlayer() {
      if (
        !window.YT ||
        !window.YT.Player
      ) {
        return;
      }

      new window.YT.Player(
        'signal-audit-demo-player',
        {
          events: {
            onStateChange(event) {
              if (
                event.data ===
                  window.YT.PlayerState.PLAYING &&
                !playTracked
              ) {
                playTracked = true;

                trackDemoEvent(
                  'signal_demo_play',
                  {
                    video_provider: 'youtube'
                  }
                );
              }
            }
          }
        }
      );
    }

    if (
      window.YT &&
      window.YT.Player
    ) {
      createPlayer();
      return;
    }

    const previousCallback =
      window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady =
      function () {
        if (
          typeof previousCallback ===
          'function'
        ) {
          previousCallback();
        }

        createPlayer();
      };

    if (
      !document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      )
    ) {
      const script =
        document.createElement('script');

      script.src =
        'https://www.youtube.com/iframe_api';

      document.head.appendChild(script);
    }
  }

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      initSignalDemoTracking
    );
  } else {
    initSignalDemoTracking();
  }
})();
