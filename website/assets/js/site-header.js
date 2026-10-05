(function () {
  const header = document.querySelector("[data-site-header]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-site-nav]");

  if (!header || !toggle || !nav) {
    return;
  }

  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));

    const label = toggle.querySelector(".sr-only");
    if (label) {
      label.textContent = open ? "Close navigation" : "Open navigation";
    }
  }

  toggle.addEventListener("click", function () {
    const open = toggle.getAttribute("aria-expanded") === "true";
    setMenu(!open);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" &&
        toggle.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      toggle.focus();
    }
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) {
      setMenu(false);
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 860) {
      setMenu(false);
    }
  });

  function initializeBrandSphere() {
    const canvas = document.querySelector(
      "[data-signal-audit-brand-sphere]"
    );

    if (!canvas) {
      return;
    }

    function renderSphere() {
      if (typeof window.SignalAuditSphere !== "function") {
        return;
      }

      window.SignalAuditSphere({
        canvas,
        lineColor: "170, 170, 170",
        nodeColor: "11, 13, 16",
        nodeRadiusMax: 1.30,
        nodeCount: 52,
        rotationDuration:
          window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches
            ? 0
            : 60000,
      });
    }

    if (typeof window.SignalAuditSphere === "function") {
      renderSphere();
      return;
    }

    const script = document.createElement("script");
    script.src = "/assets/js/signal-audit-sphere.js";
    script.onload = renderSphere;
    document.head.appendChild(script);
  }

  initializeBrandSphere();
})();
