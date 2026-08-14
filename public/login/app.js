const form =
  document.getElementById(
    "login-form",
  );

const error =
  document.getElementById(
    "error",
  );

form.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    error.textContent =
      "";

    const username =
      document.getElementById(
        "username",
      ).value;

    const password =
      document.getElementById(
        "password",
      ).value;

    try {
      const response =
        await fetch(
          "/auth/login",
          {
            method:
              "POST",

            credentials:
              "same-origin",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                username,
                password,
              }),
          },
        );

      const contentType =
        response.headers.get(
          "content-type",
        )
        || "";

      const responseText =
        await response.text();

      let payload =
        null;

      if (
        responseText
        && contentType.includes(
          "application/json",
        )
      ) {
        try {
          payload =
            JSON.parse(
              responseText,
            );
        } catch (_parseError) {
          payload =
            null;
        }
      }

      if (!response.ok) {
        error.textContent =
          payload?.error?.message
          || "Invalid username or password.";

        return;
      }

      const destination =
        payload?.user?.role
          === "executive"
          ? "/executive-dashboard"
          : "/signal-interpreter";

      window.location
        .replace(
          destination,
        );
    } catch (requestError) {
      console.error(
        "Unable to log in.",
        requestError,
      );

      error.textContent =
        "Unable to complete login. Please try again.";
    }
  },
);
