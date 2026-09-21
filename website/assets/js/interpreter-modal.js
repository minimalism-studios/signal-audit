(function () {
  const modal = document.getElementById(
    "signal-interpreter-modal"
  );

  if (!modal) {
    return;
  }

  const closeButton = modal.querySelector(
    ".si-modal__close"
  );

  const iframe = modal.querySelector(
    ".si-modal__frame"
  );

  const closeTriggers = modal.querySelectorAll(
    "[data-si-modal-close]"
  );

  let lastFocusedElement = null;

  function openModal(trigger) {
    lastFocusedElement =
      trigger || document.activeElement;

    modal.classList.add("is-open");

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "si-modal-open"
    );

    requestAnimationFrame(function () {
      if (
        iframe &&
        iframe.contentWindow
      ) {
        iframe.contentWindow.postMessage(
          {
            type:
              "signal-interpreter-modal-focus-first"
          },
          window.location.origin
        );
      }
    });
  }

  function closeModal() {
    modal.classList.remove("is-open");

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "si-modal-open"
    );

    if (
      lastFocusedElement &&
      typeof lastFocusedElement.focus ===
        "function"
    ) {
      lastFocusedElement.focus();
    }
  }

  document
    .querySelectorAll(
      'a[href="/signal-interpreter"], ' +
      '[data-si-modal-open]'
    )
    .forEach(function (trigger) {
      trigger.addEventListener(
        "click",
        function (event) {
          event.preventDefault();
          openModal(trigger);
        }
      );
    });

  closeTriggers.forEach(
    function (trigger) {
      trigger.addEventListener(
        "click",
        closeModal
      );
    }
  );

  /*
   * Keyboard events occurring inside an iframe
   * do not bubble to the parent document.
   *
   * The embedded Signal Interpreter therefore
   * sends explicit messages to this page.
   */

  window.addEventListener(
    "message",
    function (event) {
      if (
        !iframe ||
        event.source !== iframe.contentWindow
      ) {
        return;
      }

      if (
        event.origin !== window.location.origin
      ) {
        return;
      }

      if (
        !event.data ||
        typeof event.data !== "object"
      ) {
        return;
      }

      if (
        event.data.type ===
        "signal-interpreter-modal-close"
      ) {
        closeModal();
        return;
      }

      if (
        event.data.type ===
        "signal-interpreter-modal-focus-close"
      ) {
        if (closeButton) {
          closeButton.focus();
        }
      }
    }
  );

  /*
   * Escape works while focus is in the parent.
   * Shift+Tab from the close button asks the
   * iframe to focus its final interactive item.
   */

  document.addEventListener(
    "keydown",
    function (event) {
      if (
        !modal.classList.contains("is-open")
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (
        event.key === "Tab" &&
        document.activeElement ===
          closeButton &&
        iframe &&
        iframe.contentWindow
      ) {
        event.preventDefault();

        iframe.contentWindow.postMessage(
          {
            type: event.shiftKey
              ? "signal-interpreter-modal-focus-last"
              : "signal-interpreter-modal-focus-first"
          },
          window.location.origin
        );
      }
    },
    true
  );
})();
