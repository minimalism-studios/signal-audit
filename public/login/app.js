const form =
  document.getElementById(
    "login-form",
  );

const error =
  document.getElementById(
    "error",
  );

const googleAuthSection =
  document.getElementById(
    "google-auth-section",
  );

const googleSignin =
  document.getElementById(
    "google-signin",
  );

const googleStatus =
  document.getElementById(
    "google-status",
  );

function showGoogleStatus(
  message,
) {
  googleStatus.textContent =
    message;

  googleStatus.hidden =
    !message;
}

function loadGoogleIdentityServices() {
  return new Promise(
    (resolve, reject) => {
      if (
        window.google
          ?.accounts
          ?.id
      ) {
        resolve();
        return;
      }

      const existingScript =
        document.querySelector(
          'script[src="https://accounts.google.com/gsi/client"]',
        );

      if (existingScript) {
        existingScript.addEventListener(
          "load",
          resolve,
          {
            once: true,
          },
        );

        existingScript.addEventListener(
          "error",
          reject,
          {
            once: true,
          },
        );

        return;
      }

      const script =
        document.createElement(
          "script",
        );

      script.src =
        "https://accounts.google.com/gsi/client";

      script.async =
        true;

      script.defer =
        true;

      script.addEventListener(
        "load",
        resolve,
        {
          once: true,
        },
      );

      script.addEventListener(
        "error",
        reject,
        {
          once: true,
        },
      );

      document.head.appendChild(
        script,
      );
    },
  );
}

async function initializeGoogleSignIn() {
  try {
    const response =
      await fetch(
        "/auth/google/config",
        {
          credentials:
            "same-origin",
          headers: {
            Accept:
              "application/json",
          },
        },
      );

    if (!response.ok) {
      throw new Error(
        "Unable to load Google sign-in configuration.",
      );
    }

    const {
      enabled,
      clientId,
    } =
      await response.json();

    if (!enabled) {
      googleAuthSection.hidden =
        true;
      return;
    }

    googleAuthSection.hidden =
      false;

    if (
      typeof clientId
        !== "string"
      || !clientId.trim()
    ) {
      throw new Error(
        "Google sign-in is not configured.",
      );
    }

    await loadGoogleIdentityServices();

    if (
      !window.google
        ?.accounts
        ?.id
    ) {
      throw new Error(
        "Google Identity Services did not load.",
      );
    }

    window.google.accounts.id
      .initialize({
        client_id:
          clientId,
        login_uri:
          `${window.location.origin}/auth/google`,
        ux_mode:
          "redirect",
        auto_select:
          false,
      });

    window.google.accounts.id
      .renderButton(
        googleSignin,
        {
          type:
            "standard",
          theme:
            "outline",
          size:
            "large",
          text:
            "signin_with",
          shape:
            "rectangular",
          width:
            280,
        },
      );
  } catch (googleError) {
    console.error(
      "Unable to initialize Google sign-in.",
      googleError,
    );

    showGoogleStatus(
      "Google sign-in is temporarily unavailable. Use the administrator fallback.",
    );
  }
}

// Preserve only an internal signal deep link across both password and Google login.
// Session storage is per browser tab and never grants authorization.
const params = new URLSearchParams(window.location.search);
const requestedNext = params.get("next");
function validSignalDestination(value) {
  if (typeof value !== "string" || value.length > 800) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin
        || url.pathname !== "/signal-interpreter"
        || url.hash !== "#/live-signals"
        || !url.searchParams.get("signalId")
        || url.searchParams.get("signalId").length > 256
        || /[\x00-\x1f\x7f]/.test(url.searchParams.get("signalId"))
        || [...url.searchParams.keys()].some(key => key !== "signalId")) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}
const safeNext = validSignalDestination(requestedNext);
if (safeNext) {
  sessionStorage.setItem("signalAuditLoginNext", safeNext);
} else if (requestedNext !== null) {
  sessionStorage.removeItem("signalAuditLoginNext");
}

if (
  params.get(
    "error",
  )
  === "google_auth"
) {
  error.textContent =
    "This Google account is not authorized for Signal Audit.";
}

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
          ? "/executive-dashboard?login=success"
          : "/signal-interpreter?login=success";

      const next = validSignalDestination(
        sessionStorage.getItem("signalAuditLoginNext"),
      );
      sessionStorage.removeItem("signalAuditLoginNext");
      window.location.replace(
        payload?.user?.role === "executive" ? destination : (next || destination),
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

initializeGoogleSignIn();
