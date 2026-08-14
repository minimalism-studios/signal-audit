(function initializeUsersApi(
  global,
) {
  "use strict";

  const API_ROOT =
    "/api/users";

  async function parseResponse(
    response,
  ) {
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
      } catch (_error) {
        payload =
          null;
      }
    }

    if (!response.ok) {
      const error =
        new Error(
          payload?.error?.message
          || payload?.error
          || responseText
          || `Users API request failed (${response.status}).`,
        );

      error.status =
        response.status;

      throw error;
    }

    return payload;
  }

  async function request(
    path = "",
    options = {},
  ) {
    const {
      method = "GET",
      body,
    } = options;

    const headers = {
      Accept:
        "application/json",
    };

    if (body !== undefined) {
      headers[
        "Content-Type"
      ] =
        "application/json";
    }

    const response =
      await fetch(
        `${API_ROOT}${path}`,
        {
          method,

          credentials:
            "same-origin",

          headers,

          body:
            body === undefined
              ? undefined
              : JSON.stringify(
                  body,
                ),
        },
      );

    return parseResponse(
      response,
    );
  }

  async function listUsers() {
    const payload =
      await request();

    return Array.isArray(
      payload?.users,
    )
      ? payload.users
      : [];
  }

  async function createUser({
    username,
    password,
    role,
    active = true,
  }) {
    const payload =
      await request(
        "",
        {
          method:
            "POST",

          body: {
            username,
            password,
            role,
            active,
          },
        },
      );

    return payload?.user
      ?? null;
  }

  async function updateUser(
    userId,
    changes,
  ) {
    if (!userId) {
      throw new Error(
        "A user ID is required.",
      );
    }

    const payload =
      await request(
        `/${encodeURIComponent(
          userId,
        )}`,
        {
          method:
            "PATCH",

          body:
            changes,
        },
      );

    return payload?.user
      ?? null;
  }

  async function resetPassword(
    userId,
    password,
  ) {
    if (!userId) {
      throw new Error(
        "A user ID is required.",
      );
    }

    const payload =
      await request(
        `/${encodeURIComponent(
          userId,
        )}/reset-password`,
        {
          method:
            "POST",

          body: {
            password,
          },
        },
      );

    return payload?.user
      ?? null;
  }

  global.SignalAuditUsersApi =
    Object.freeze({
      listUsers,
      createUser,
      updateUser,
      resetPassword,
    });
})(
  window,
);
