(function initializeSessionService(
  global,
) {
  "use strict";

  const SESSION_ENDPOINT =
    "/auth/session";

  const state = {
    loaded:
      false,

    loadingPromise:
      null,

    authenticated:
      false,

    user:
      null,

    loadedAt:
      null,
  };

  function cloneUser(
    user,
  ) {
    if (
      !user
      || typeof user
        !== "object"
    ) {
      return null;
    }

    return {
      id:
        user.id
        ?? null,

      username:
        user.username
        ?? "",

      role:
        user.role
        ?? "",

      permissions:
        Array.isArray(
          user.permissions,
        )
          ? [...user.permissions]
          : [],
    };
  }

  function setSession(
    payload,
  ) {
    state.loaded =
      true;

    state.authenticated =
      payload?.authenticated
      === true;

    state.user =
      state.authenticated
        ? cloneUser(
            payload.user,
          )
        : null;

    state.loadedAt =
      new Date()
        .toISOString();

    return getSnapshot();
  }

  function clear() {
    state.loaded =
      false;

    state.loadingPromise =
      null;

    state.authenticated =
      false;

    state.user =
      null;

    state.loadedAt =
      null;
  }

  function getSnapshot() {
    return {
      loaded:
        state.loaded,

      authenticated:
        state.authenticated,

      user:
        cloneUser(
          state.user,
        ),

      loadedAt:
        state.loadedAt,
    };
  }

  function getUser() {
    return cloneUser(
      state.user,
    );
  }

  function getRole() {
    return (
      state.user
        ?.role
      ?? ""
    );
  }

  function getPermissions() {
    return Array.isArray(
      state.user
        ?.permissions,
    )
      ? [
          ...state.user
            .permissions,
        ]
      : [];
  }

  function isAuthenticated() {
    return (
      state.loaded
      && state.authenticated
      && Boolean(
        state.user
          ?.id,
      )
    );
  }

  async function requestSession() {
    const response =
      await fetch(
        SESSION_ENDPOINT,
        {
          method:
            "GET",

          credentials:
            "same-origin",

          headers: {
            Accept:
              "application/json",
          },
        },
      );

    let payload =
      null;

    try {
      payload =
        await response
          .json();
    } catch (_error) {
      payload =
        null;
    }

    if (
      response.status
      === 401
    ) {
      return setSession({
        authenticated:
          false,

        user:
          null,
      });
    }

    if (!response.ok) {
      throw new Error(
        payload
          ?.error
          ?.message
        || payload
          ?.error
        || `Unable to load session (${response.status}).`,
      );
    }

    return setSession(
      payload,
    );
  }

  function load() {
    if (state.loaded) {
      return Promise.resolve(
        getSnapshot(),
      );
    }

    if (
      state.loadingPromise
    ) {
      return state
        .loadingPromise;
    }

    state.loadingPromise =
      requestSession()
        .finally(
          () => {
            state.loadingPromise =
              null;
          },
        );

    return state
      .loadingPromise;
  }

  async function refresh() {
    state.loaded =
      false;

    state.loadingPromise =
      null;

    return load();
  }

  async function logout() {
    const response =
      await fetch(
        "/auth/logout",
        {
          method:
            "POST",

          credentials:
            "same-origin",

          headers: {
            Accept:
              "application/json",
          },
        },
      );

    if (
      !response.ok
      && response.status
        !== 204
    ) {
      throw new Error(
        `Unable to log out (${response.status}).`,
      );
    }

    clear();
  }

  global.SignalAuditSession =
    Object.freeze({
      load,
      refresh,
      logout,
      clear,
      getSnapshot,
      getUser,
      getRole,
      getPermissions,
      isAuthenticated,
    });
})(
  window,
);
