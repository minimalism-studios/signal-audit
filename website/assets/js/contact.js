"use strict";

  (function () {
    const form =
      document.getElementById("contactForm");

    const submitButton =
      form.querySelector(
        ".contact-form__submit"
      );

    const status =
      document.getElementById(
        "contactFormStatus"
      );

    const sourceField =
      document.getElementById(
        "contact-source"
      );

    const sourceParameter =
      new URLSearchParams(
        window.location.search
      ).get("source");

    if (sourceParameter) {
      sourceField.value =
        sourceParameter;
    }

    form.addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        status.textContent = "";
        status.className =
          "contact-form__status";

        if (!form.reportValidity()) {
          return;
        }

        submitButton.disabled = true;
        submitButton.textContent =
          "Sending...";

        const formData =
          new FormData(form);

        const payload =
          Object.fromEntries(
            formData.entries()
          );

        try {
          const response =
            await fetch(
              "/api/contact",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify(
                    payload
                  ),
              }
            );

          const result =
            await response
              .json()
              .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              result?.error?.message
              || "We couldn't send your message right now."
            );
          }

          form.reset();

          sourceField.value =
            sourceParameter
            || "/contact";

          status.textContent =
            "Thanks. Your message has been sent. We'll be in touch.";

          status.className =
            "contact-form__status contact-form__status--success";

          submitButton.textContent =
            "Message Sent";
        } catch (error) {
          status.textContent =
            error.message
            || "We couldn't send your message right now. Please try again.";

          status.className =
            "contact-form__status contact-form__status--error";

          submitButton.disabled = false;
          submitButton.textContent =
            "Start a Conversation";
        }
      }
    );
  })();
