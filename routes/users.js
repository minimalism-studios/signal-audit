const express =
  require("express");

const bcrypt =
  require("bcryptjs");

const PASSWORD_HASH_ROUNDS =
  12;

function createUsersRouter({
  userStore,
  authorizationService,
}) {
  if (
    !userStore
    || typeof userStore
      .listUsers
      !== "function"
    || typeof userStore
      .createUser
      !== "function"
    || typeof userStore
      .updateManagedUser
      !== "function"
    || typeof userStore
      .resetPassword
      !== "function"
  ) {
    throw new Error(
      "Users Router requires a User Store.",
    );
  }

  if (
    !authorizationService
    || typeof authorizationService
      .getPermissions
      !== "function"
  ) {
    throw new Error(
      "Users Router requires an Authorization Service.",
    );
  }

  const router =
    express.Router();

  function normalizePassword(
    password,
  ) {
    if (
      typeof password
        !== "string"
      || password.length < 12
    ) {
      const error =
        new Error(
          "Password must contain at least 12 characters.",
        );

      error.status = 400;

      throw error;
    }

    return password;
  }

  function presentUser(
    user,
  ) {
    return {
      ...user,

      permissions:
        authorizationService
          .getPermissions(
            user,
          ),
    };
  }

  router.get(
    "/",
    (_req, res) => {
      const users =
        userStore
          .listUsers()
          .map(
            presentUser,
          );

      res.status(200).json({
        users,
      });
    },
  );

  router.post(
    "/",
    async (
      req,
      res,
      next,
    ) => {
      try {
        const {
          username,
          password,
          role,
          active = true,
        } = req.body ?? {};

        const normalizedPassword =
          normalizePassword(
            password,
          );

        const passwordHash =
          await bcrypt.hash(
            normalizedPassword,
            PASSWORD_HASH_ROUNDS,
          );

        const user =
          userStore
            .createUser({
              username,
              passwordHash,
              role,
              active,
            });

        res.status(201).json({
          user:
            presentUser(
              user,
            ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:userId",
    (
      req,
      res,
      next,
    ) => {
      try {
        const {
          role,
          active,
        } = req.body ?? {};

        if (
          role === undefined
          && active === undefined
        ) {
          const error =
            new Error(
              "At least one of role or active is required.",
            );

          error.status = 400;

          throw error;
        }

        if (
          active !== undefined
          && typeof active
            !== "boolean"
        ) {
          const error =
            new Error(
              "active must be a boolean.",
            );

          error.status = 400;

          throw error;
        }

        const user =
          userStore
            .updateManagedUser({
              userId:
                req.params
                  .userId,

              actorUserId:
                req.currentUser
                  .id,

              role,
              active,
            });

        res.status(200).json({
          user:
            presentUser(
              user,
            ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:userId/reset-password",
    async (
      req,
      res,
      next,
    ) => {
      try {
        const {
          password,
        } = req.body ?? {};

        const normalizedPassword =
          normalizePassword(
            password,
          );

        const passwordHash =
          await bcrypt.hash(
            normalizedPassword,
            PASSWORD_HASH_ROUNDS,
          );

        const user =
          userStore
            .resetPassword({
              userId:
                req.params
                  .userId,

              passwordHash,
            });

        res.status(200).json({
          user:
            presentUser(
              user,
            ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

module.exports = {
  createUsersRouter,
};
