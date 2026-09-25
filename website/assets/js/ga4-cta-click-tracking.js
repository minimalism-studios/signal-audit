(function () {

  function getCleanText(element) {
    const clone = element.cloneNode(true);

    clone.querySelectorAll('[aria-hidden="true"]').forEach(function (el) {
      el.remove();
    });

    return clone.textContent
      .trim()
      .replace(/\s+/g, ' ');
  }

  function normalizeHostname(hostname) {
    return hostname.replace(/^www\./, '');
  }

  function getDayOfWeek() {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ];

    return days[new Date().getDay()];
  }

  /*
   * Send one page-level context event per page load.
   * This gives GA4 a day_of_week parameter for Explore analysis.
   */
  const pageContextParams = {
    day_of_week: getDayOfWeek(),
    page_path: window.location.pathname,
    page_location: window.location.href,
    page_title: document.title
  };

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_context', pageContextParams);
  } else {
    window.dataLayer = window.dataLayer || [];

    window.dataLayer.push({
      event: 'page_context',
      ...pageContextParams
    });
  }

  document.addEventListener('click', function (e) {

    /*
     * Only track elements explicitly marked as CTAs.
     *
     * Example:
     * <a href="/signal-interpreter"
     *    data-cta="try_signal_interpreter">
     *   Try Signal Interpreter →
     * </a>
     */

    const cta = e.target.closest('[data-cta]');
    if (!cta) return;

    const ctaName = cta.getAttribute('data-cta') || '';
    const ctaText = getCleanText(cta);
    const href = cta.getAttribute('href') || '';

    /*
     * Determine whether the destination is internal or external.
     * Normalize www/non-www hostnames before comparison.
     */

    let linkType = 'internal';

    if (href) {
      try {
        const destinationUrl = new URL(href, window.location.href);

        const currentHost = normalizeHostname(window.location.hostname);
        const destinationHost = normalizeHostname(destinationUrl.hostname);

        if (
          destinationUrl.protocol === 'http:' ||
          destinationUrl.protocol === 'https:'
        ) {
          linkType =
            destinationHost === currentHost
              ? 'internal'
              : 'external';
        }
      } catch (err) {
        linkType = 'internal';
      }
    }

    const eventParams = {
      cta_name: ctaName,
      cta_text: ctaText,
      destination: href,
      page_path: window.location.pathname,
      link_type: linkType,
      day_of_week: getDayOfWeek()
    };

    /*
     * Send directly to GA4 when Google Analytics is available.
     *
     * Do NOT also push the same event manually to dataLayer,
     * because gtag itself uses dataLayer. Sending through both
     * paths can result in duplicate events if GTM is enabled later.
     */

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'cta_click', eventParams);
    } else {
      /*
       * Fallback for environments where GTM is providing the
       * event listener instead of gtag.
       */
      window.dataLayer = window.dataLayer || [];

      window.dataLayer.push({
        event: 'cta_click',
        ...eventParams
      });
    }

  });

})();