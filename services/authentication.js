const bcrypt = require("bcryptjs");
const {
  OAuth2Client,
} = require("google-auth-library");

function createAuthenticationService({
  userStore,
  authorizationService,
  googleClientId = null,
}) {
  if (
    !userStore
    || typeof userStore
      .getUserByUsername
      !== "function"
    || typeof userStore
      .getUserById
      !== "function"
    || typeof userStore
      .getUserByEmail
      !== "function"
    || typeof userStore
      .getUserByGoogleSubject
      !== "function"
    || typeof userStore
      .bindGoogleIdentity
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

  const googleClient =
    googleClientId
      ? new OAuth2Client(
          googleClientId,
        )
      : null;

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
      || typeof user.passwordHash
        !== "string"
      || !user.passwordHash.trim()
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

  async function authenticateGoogle({
    credential,
  }) {
    if (
      !googleClient
      || typeof googleClientId
        !== "string"
      || !googleClientId.trim()
      || typeof credential
        !== "string"
      || !credential.trim()
    ) {
      return null;
    }

    let payload;

    try {
      const ticket =
        await googleClient
          .verifyIdToken({
            idToken:
              credential.trim(),
            audience:
              googleClientId.trim(),
          });

      payload =
        ticket.getPayload();
    } catch (_error) {
      return null;
    }

    if (
      !payload
      || typeof payload.sub
        !== "string"
      || !payload.sub.trim()
      || typeof payload.email
        !== "string"
      || !payload.email.trim()
      || payload.email_verified
        !== true
    ) {
      return null;
    }

    const googleSubject =
      payload.sub.trim();

    const email =
      payload.email
        .trim()
        .toLowerCase();

    const subjectUser =
      userStore
        .getUserByGoogleSubject(
          googleSubject,
        );

    if (subjectUser) {
      if (
        subjectUser.active
          !== true
        || typeof subjectUser.email
          !== "string"
        || subjectUser.email
          .trim()
          .toLowerCase()
          !== email
      ) {
        return null;
      }

      return subjectUser;
    }

    const emailUser =
      userStore
        .getUserByEmail(
          email,
        );

    if (
      !emailUser
      || emailUser.active
        !== true
      || (
        emailUser.googleSubject
        && emailUser.googleSubject
          !== googleSubject
      )
    ) {
      return null;
    }

    return userStore
      .bindGoogleIdentity({
        userId:
          emailUser.id,
        email,
        googleSubject,
      });
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

    if (
      !req.session
      || typeof req.session.regenerate
        !== "function"
    ) {
      throw new Error(
        "A valid session is required to log in.",
      );
    }

    return new Promise(
      (resolve, reject) => {
        req.session.regenerate(
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            /*
             * Store only the durable identity.
             * Username, role, active state, and
             * permissions are resolved from
             * User Store on every request.
             */

            req.session.user = {
              id:
                user.id,
            };

            resolve();
          },
        );
      },
    );
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
    authenticateGoogle,
    login,
    logout,
    isAuthenticated,
    getCurrentUser,
  };
}

module.exports = {
  createAuthenticationService,
};
