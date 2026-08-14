const bcrypt = require("bcryptjs");

function createAuthenticationService({
  userStore,
  authorizationService,
}) {
  if (
    !userStore
    || typeof userStore
      .getUserByUsername
      !== "function"
    || typeof userStore
      .getUserById
      !== "function"
  ) {
    throw new Error(
      "Authentication Service requires a User Store.",
    );
  }

  if (
    !authorizationService
    || typeof authorizationService
      .getPermissions
      !== "function"
  ) {
    throw new Error(
      "Authentication Service requires an Authorization Service.",
    );
  }

  async function authenticate({
    suppliedUsername,
    suppliedPassword,
  }) {
    if (
      typeof suppliedUsername
        !== "string"
      || typeof suppliedPassword
        !== "string"
    ) {
      return null;
    }

    const user =
      userStore
        .getUserByUsername(
          suppliedUsername,
        );

    if (
      !user
      || user.active
        !== true
    ) {
      return null;
    }

    const passwordMatches =
      await bcrypt.compare(
        suppliedPassword,
        user.passwordHash,
      );

    if (!passwordMatches) {
      return null;
    }

    return user;
  }

  function login(
    req,
    user,
  ) {
    if (!user?.id) {
      throw new Error(
        "A valid user is required to create a session.",
      );
    }

    /*
     * Store only the durable identity.
     * Username, role, active state, and permissions
     * are resolved from User Store on every request.
     */
    req.session.user = {
      id:
        user.id,
    };
  }

  function logout(req) {
    return new Promise(
      (resolve, reject) => {
        req.session.destroy(
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          },
        );
      },
    );
  }

  function getCurrentUser(req) {
    const userId =
      req.session
        ?.user
        ?.id;

    if (!userId) {
      return null;
    }

    const user =
      userStore
        .getUserById(
          userId,
        );

    if (
      !user
      || user.active
        !== true
    ) {
      return null;
    }

    return {
      id:
        user.id,

      username:
        user.username,

      role:
        user.role,

      permissions:
        authorizationService
          .getPermissions(
            user,
          ),
    };
  }

  function isAuthenticated(req) {
    return Boolean(
      getCurrentUser(
        req,
      ),
    );
  }

  return {
    authenticate,
    login,
    logout,
    isAuthenticated,
    getCurrentUser,
  };
}

module.exports = {
  createAuthenticationService,
};
