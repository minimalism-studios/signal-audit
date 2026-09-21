/* =========================================================
   SIGNAL INTERPRETER — MODAL KEYBOARD BRIDGE
   ========================================================= */

(function () {
  const params =
    new URLSearchParams(
      window.location.search
    );

  if (params.get("embed") !== "1") {
    return;
  }

  const parentOrigin =
    window.location.origin;

  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(",");

  function getFocusableElements() {
    return Array.from(
      document.querySelectorAll(
        focusableSelector
      )
    ).filter(function (element) {
      const style =
        window.getComputedStyle(element);

      const isRendered =
        element.getClientRects().length > 0;

      const isDisabled =
        element.matches(":disabled");

      const isInsideHiddenTree =
        element.closest(
          '[hidden], [aria-hidden="true"], [inert]'
        ) !== null;

      return (
        isRendered &&
        !isDisabled &&
        !isInsideHiddenTree &&
        style.visibility !== "hidden"
      );
    });
  }

  document.addEventListener(
    "keydown",
    function (event) {
      /*
       * Escape from anywhere inside the iframe
       * closes the parent modal.
       */

      if (event.key === "Escape") {
        event.preventDefault();

        window.parent.postMessage(
          {
            type:
              "signal-interpreter-modal-close"
          },
          parentOrigin
        );

        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable =
        getFocusableElements();

      if (!focusable.length) {
        return;
      }

      const first = focusable[0];

      const last =
        focusable[
          focusable.length - 1
        ];

      const active =
        document.activeElement;

      /*
       * Tabbing forward from the final control
       * returns focus to the modal close button.
       */

      if (
        !event.shiftKey &&
        active === last
      ) {
        event.preventDefault();

        window.parent.postMessage(
          {
            type:
              "signal-interpreter-modal-focus-close"
          },
          parentOrigin
        );

        return;
      }

      /*
       * Shift+Tab from the first iframe control
       * also returns to the modal close button.
       */

      if (
        event.shiftKey &&
        active === first
      ) {
        event.preventDefault();

        window.parent.postMessage(
          {
            type:
              "signal-interpreter-modal-focus-close"
          },
          parentOrigin
        );
      }
    },
    true
  );

  /*
   * Shift+Tab from the parent's close button
   * should move to the iframe's final control.
   */

  window.addEventListener(
    "message",
    function (event) {
      if (
        event.origin !== parentOrigin
      ) {
        return;
      }

      if (
        !event.data ||
        (
          event.data.type !==
            "signal-interpreter-modal-focus-first" &&
          event.data.type !==
            "signal-interpreter-modal-focus-last"
        )
      ) {
        return;
      }

      const focusable =
        getFocusableElements();

      if (!focusable.length) {
        return;
      }

      if (
        event.data.type ===
          "signal-interpreter-modal-focus-first"
      ) {
        const primaryInput =
          document.getElementById("input");

        if (
          primaryInput &&
          primaryInput.getClientRects().length > 0
        ) {
          primaryInput.focus();
          return;
        }

        focusable[0].focus();
        return;
      }

      focusable[
        focusable.length - 1
      ].focus();
    }
  );
})();
