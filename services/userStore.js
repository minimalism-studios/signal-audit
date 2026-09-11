const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_FILE_PATH =
  process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(
        process.env.RAILWAY_VOLUME_MOUNT_PATH,
        "data",
        "users.json",
      )
    : path.join(
        __dirname,
        "../data/users.json",
      );

const SUPPORTED_ROLES =
  new Set([
    "administrator",
    "operator",
    "executive",
    "viewer",
  ]);

function createUserStore({
  filePath = DEFAULT_FILE_PATH,
  seedUsername = null,
  seedPasswordHash = null,
} = {}) {
  ensureFile();

  seedAdministrator({
    username:
      seedUsername,

    passwordHash:
      seedPasswordHash,
  });

  function ensureFile() {
    fs.mkdirSync(
      path.dirname(filePath),
      {
        recursive:
          true,
      },
    );

    if (
      !fs.existsSync(
        filePath,
      )
    ) {
      fs.writeFileSync(
        filePath,
        "[]\n",
        "utf8",
      );
    }
  }

  function loadUsers() {
    ensureFile();

    const contents =
      fs.readFileSync(
        filePath,
        "utf8",
      );

    try {
      const users =
        JSON.parse(
          contents,
        );

      if (!Array.isArray(users)) {
        throw new TypeError(
          "User data must be an array.",
        );
      }

      return users;
    } catch (error) {
      throw new Error(
        `Unable to load users: ${error.message}`,
      );
    }
  }

  function saveUsers(
    users,
  ) {
    const temporaryPath =
      `${filePath}.tmp`;

    fs.writeFileSync(
      temporaryPath,
      `${JSON.stringify(
        users,
        null,
        2,
      )}\n`,
      "utf8",
    );

    fs.renameSync(
      temporaryPath,
      filePath,
    );
  }

  function seedAdministrator({
    username,
    passwordHash,
  }) {
    const users =
      loadUsers();

    if (users.length > 0) {
      return;
    }

    const normalizedUsername =
      normalizeUsername(
        username,
      );

    if (!normalizedUsername) {
      throw new Error(
        "AUTH_USERNAME is required to seed the initial administrator.",
      );
    }

    if (
      typeof passwordHash
        !== "string"
      || !passwordHash.trim()
    ) {
      throw new Error(
        "AUTH_PASSWORD_HASH is required to seed the initial administrator.",
      );
    }

    const now =
      new Date()
        .toISOString();

    users.push({
      id:
        `usr_${crypto.randomUUID()}`,

      username:
        normalizedUsername,

      passwordHash:
        passwordHash.trim(),

      role:
        "administrator",

      active:
        true,

      createdAt:
        now,

      updatedAt:
        now,
    });

    saveUsers(
      users,
    );
  }

  function listUsers() {
    return loadUsers()
      .map(
        sanitizeUser,
      )
      .sort(
        (left, right) =>
          left.username
            .localeCompare(
              right.username,
            ),
      );
  }

  function getUserById(
    userId,
  ) {
    const normalizedId =
      normalizeRequiredString(
        userId,
        "userId",
      );

    const user =
      loadUsers()
        .find(
          (item) =>
            item.id
            === normalizedId,
        );

    return user
      ?? null;
  }

  function getUserByUsername(
    username,
  ) {
    const normalizedUsername =
      normalizeUsername(
        username,
      );

    if (!normalizedUsername) {
      return null;
    }

    return (
      loadUsers()
        .find(
          (user) =>
            normalizeUsername(
              user.username,
            )
            === normalizedUsername,
        )
      ?? null
    );
  }

  function getUserByEmail(
    email,
  ) {
    const normalizedEmail =
      normalizeUsername(
        email,
      );

    if (!normalizedEmail) {
      return null;
    }

    return (
      loadUsers()
        .find(
          (user) =>
            normalizeUsername(
              user.email,
            )
            === normalizedEmail,
        )
      ?? null
    );
  }

  function getUserByGoogleSubject(
    googleSubject,
  ) {
    if (
      typeof googleSubject
        !== "string"
      || !googleSubject.trim()
    ) {
      return null;
    }

    const normalizedSubject =
      googleSubject.trim();

    return (
      loadUsers()
        .find(
          (user) =>
            user.googleSubject
            === normalizedSubject,
        )
      ?? null
    );
  }

  function createUser({
    username,
    passwordHash = null,
    email = null,
    googleSubject = null,
    role,
    active = true,
  }) {
    const normalizedUsername =
      normalizeUsername(
        username,
      );

    if (!normalizedUsername) {
      const error =
        new Error(
          "username is required.",
        );

      error.status = 400;

      throw error;
    }

    const normalizedPasswordHash =
      typeof passwordHash === "string"
        && passwordHash.trim()
        ? passwordHash.trim()
        : null;

    const normalizedEmail =
      normalizeUsername(
        email,
      )
      || null;

    const normalizedGoogleSubject =
      typeof googleSubject === "string"
        && googleSubject.trim()
        ? googleSubject.trim()
        : null;

    if (
      !normalizedPasswordHash
      && !normalizedEmail
    ) {
      const error =
        new Error(
          "A passwordHash or approved email is required.",
        );

      error.status = 400;

      throw error;
    }

    const normalizedRole =
      normalizeRole(
        role,
      );

    const users =
      loadUsers();

    const duplicateUsername =
      users.some(
        (user) =>
          normalizeUsername(
            user.username,
          )
          === normalizedUsername,
      );

    if (duplicateUsername) {
      const error =
        new Error(
          "A user with that username already exists.",
        );

      error.status = 409;

      throw error;
    }

    if (
      normalizedEmail
      && users.some(
        (user) =>
          normalizeUsername(
            user.email,
          )
          === normalizedEmail,
      )
    ) {
      const error =
        new Error(
          "A user with that email already exists.",
        );

      error.status = 409;

      throw error;
    }

    if (
      normalizedGoogleSubject
      && users.some(
        (user) =>
          user.googleSubject
          === normalizedGoogleSubject,
      )
    ) {
      const error =
        new Error(
          "A user with that Google identity already exists.",
        );

      error.status = 409;

      throw error;
    }

    const now =
      new Date()
        .toISOString();

    const user = {
      id:
        `usr_${crypto.randomUUID()}`,

      username:
        normalizedUsername,

      ...(normalizedPasswordHash
        ? {
            passwordHash:
              normalizedPasswordHash,
          }
        : {}),

      ...(normalizedEmail
        ? {
            email:
              normalizedEmail,
          }
        : {}),

      ...(normalizedGoogleSubject
        ? {
            googleSubject:
              normalizedGoogleSubject,
          }
        : {}),

      role:
        normalizedRole,

      active:
        Boolean(active),

      createdAt:
        now,

      updatedAt:
        now,
    };

    users.push(
      user,
    );

    saveUsers(
      users,
    );

    return sanitizeUser(
      user,
    );
  }

  function bindGoogleIdentity({
    userId,
    email,
    googleSubject,
  }) {
    const normalizedId =
      normalizeRequiredString(
        userId,
        "userId",
      );

    const normalizedEmail =
      normalizeUsername(
        email,
      );

    const normalizedGoogleSubject =
      normalizeRequiredString(
        googleSubject,
        "googleSubject",
      );

    if (!normalizedEmail) {
      const error =
        new Error(
          "email is required.",
        );

      error.status = 400;

      throw error;
    }

    const users =
      loadUsers();

    const index =
      users.findIndex(
        (user) =>
          user.id
          === normalizedId,
      );

    if (index === -1) {
      const error =
        new Error(
          "User was not found.",
        );

      error.status = 404;

      throw error;
    }

    const existing =
      users[index];

    if (
      normalizeUsername(
        existing.email,
      )
      !== normalizedEmail
    ) {
      const error =
        new Error(
          "Google email does not match the approved user email.",
        );

      error.status = 403;

      throw error;
    }

    const duplicateSubject =
      users.some(
        (user) =>
          user.id !== normalizedId
          && user.googleSubject
            === normalizedGoogleSubject,
      );

    if (duplicateSubject) {
      const error =
        new Error(
          "That Google identity is already bound to another user.",
        );

      error.status = 409;

      throw error;
    }

    if (
      existing.googleSubject
      && existing.googleSubject
        !== normalizedGoogleSubject
    ) {
      const error =
        new Error(
          "This user is already bound to a different Google identity.",
        );

      error.status = 409;

      throw error;
    }

    if (
      existing.googleSubject
      === normalizedGoogleSubject
    ) {
      return existing;
    }

    const updatedUser = {
      ...existing,
      googleSubject:
        normalizedGoogleSubject,
      updatedAt:
        new Date()
          .toISOString(),
    };

    users[index] =
      updatedUser;

    saveUsers(
      users,
    );

    return updatedUser;
  }

  function updateUser({
    userId,
    changes,
  }) {
    const normalizedId =
      normalizeRequiredString(
        userId,
        "userId",
      );

    if (
      !changes
      || typeof changes
        !== "object"
      || Array.isArray(
        changes,
      )
    ) {
      const error =
        new Error(
          "changes must be an object.",
        );

      error.status = 400;

      throw error;
    }

    const users =
      loadUsers();

    const index =
      users.findIndex(
        (user) =>
          user.id
          === normalizedId,
      );

    if (index === -1) {
      const error =
        new Error(
          "User was not found.",
        );

      error.status = 404;

      throw error;
    }

    const existing =
      users[index];

    const username =
      changes.username
        === undefined
        ? existing.username
        : normalizeUsername(
            changes.username,
          );

    if (!username) {
      const error =
        new Error(
          "username is required.",
        );

      error.status = 400;

      throw error;
    }

    const duplicate =
      users.some(
        (user) =>
          user.id
            !== normalizedId
          && normalizeUsername(
            user.username,
          )
            === username,
      );

    if (duplicate) {
      const error =
        new Error(
          "A user with that username already exists.",
        );

      error.status = 409;

      throw error;
    }

    const updatedUser = {
      ...existing,

      username,

      role:
        changes.role
          === undefined
          ? existing.role
          : normalizeRole(
              changes.role,
            ),

      active:
        changes.active
          === undefined
          ? existing.active
          : Boolean(
              changes.active,
            ),

      passwordHash:
        changes.passwordHash
          === undefined
          ? existing.passwordHash
          : normalizeRequiredString(
              changes.passwordHash,
              "passwordHash",
            ),

      updatedAt:
        new Date()
          .toISOString(),
    };

    users[index] =
      updatedUser;

    saveUsers(
      users,
    );

    return sanitizeUser(
      updatedUser,
    );
  }

  function getActiveAdministratorCount(
    users = loadUsers(),
  ) {
    return users.filter(
      (user) =>
        user.role
          === "administrator"
        && user.active
          === true,
    ).length;
  }

  function getRequiredUser(
    userId,
  ) {
    const normalizedId =
      normalizeRequiredString(
        userId,
        "userId",
      );

    const user =
      loadUsers()
        .find(
          (item) =>
            item.id
            === normalizedId,
        );

    if (!user) {
      const error =
        new Error(
          "User was not found.",
        );

      error.status = 404;

      throw error;
    }

    return user;
  }

  function assertDifferentUser({
    actorUserId,
    targetUserId,
    action,
  }) {
    const normalizedActorId =
      normalizeRequiredString(
        actorUserId,
        "actorUserId",
      );

    const normalizedTargetId =
      normalizeRequiredString(
        targetUserId,
        "targetUserId",
      );

    if (
      normalizedActorId
      === normalizedTargetId
    ) {
      const error =
        new Error(
          `You cannot ${action} your own account.`,
        );

      error.status = 409;

      throw error;
    }
  }

  function assertAdministratorContinuity({
    user,
    nextRole =
      user.role,
    nextActive =
      user.active,
  }) {
    const removesActiveAdministrator =
      user.role
        === "administrator"
      && user.active
        === true
      && (
        nextRole
          !== "administrator"
        || nextActive
          !== true
      );

    if (!removesActiveAdministrator) {
      return;
    }

    const activeAdministratorCount =
      getActiveAdministratorCount();

    if (
      activeAdministratorCount
      <= 1
    ) {
      const error =
        new Error(
          "The final active administrator cannot be deactivated or assigned another role.",
        );

      error.status = 409;

      throw error;
    }
  }

  function activateUser({
    userId,
  }) {
    const user =
      getRequiredUser(
        userId,
      );

    if (
      user.active
      === true
    ) {
      return sanitizeUser(
        user,
      );
    }

    return updateUser({
      userId:
        user.id,

      changes: {
        active:
          true,
      },
    });
  }

  function deactivateUser({
    userId,
    actorUserId,
  }) {
    const user =
      getRequiredUser(
        userId,
      );

    assertDifferentUser({
      actorUserId,

      targetUserId:
        user.id,

      action:
        "deactivate",
    });

    assertAdministratorContinuity({
      user,

      nextActive:
        false,
    });

    if (
      user.active
      === false
    ) {
      return sanitizeUser(
        user,
      );
    }

    return updateUser({
      userId:
        user.id,

      changes: {
        active:
          false,
      },
    });
  }

  function changeRole({
    userId,
    role,
    actorUserId,
  }) {
    const user =
      getRequiredUser(
        userId,
      );

    const normalizedRole =
      normalizeRole(
        role,
      );

    if (
      user.role
      === normalizedRole
    ) {
      return sanitizeUser(
        user,
      );
    }

    if (
      user.id
      === normalizeRequiredString(
        actorUserId,
        "actorUserId",
      )
    ) {
      const error =
        new Error(
          "You cannot change the role of your own account.",
        );

      error.status = 409;

      throw error;
    }

    assertAdministratorContinuity({
      user,

      nextRole:
        normalizedRole,
    });

    return updateUser({
      userId:
        user.id,

      changes: {
        role:
          normalizedRole,
      },
    });
  }

  function updateManagedUser({
    userId,
    actorUserId,
    role,
    active,
  }) {
    const user =
      getRequiredUser(
        userId,
      );

    const normalizedActorId =
      normalizeRequiredString(
        actorUserId,
        "actorUserId",
      );

    const nextRole =
      role === undefined
        ? user.role
        : normalizeRole(
            role,
          );

    const nextActive =
      active === undefined
        ? user.active
        : Boolean(
            active,
          );

    const changesOwnRole =
      user.id
        === normalizedActorId
      && nextRole
        !== user.role;

    if (changesOwnRole) {
      const error =
        new Error(
          "You cannot change the role of your own account.",
        );

      error.status = 409;

      throw error;
    }

    const deactivatesOwnAccount =
      user.id
        === normalizedActorId
      && user.active
        === true
      && nextActive
        === false;

    if (deactivatesOwnAccount) {
      const error =
        new Error(
          "You cannot deactivate your own account.",
        );

      error.status = 409;

      throw error;
    }

    assertAdministratorContinuity({
      user,
      nextRole,
      nextActive,
    });

    if (
      nextRole === user.role
      && nextActive === user.active
    ) {
      return sanitizeUser(
        user,
      );
    }

    return updateUser({
      userId:
        user.id,

      changes: {
        role:
          nextRole,

        active:
          nextActive,
      },
    });
  }

  function resetPassword({
    userId,
    passwordHash,
  }) {
    const user =
      getRequiredUser(
        userId,
      );

    const normalizedPasswordHash =
      normalizeRequiredString(
        passwordHash,
        "passwordHash",
      );

    return updateUser({
      userId:
        user.id,

      changes: {
        passwordHash:
          normalizedPasswordHash,
      },
    });
  }

  function sanitizeUser(
    user,
  ) {
    if (!user) {
      return null;
    }

    const {
      passwordHash:
        _passwordHash,

      googleSubject:
        _googleSubject,

      ...safeUser
    } = user;

    return safeUser;
  }

  function normalizeUsername(
    value,
  ) {
    if (
      typeof value
        !== "string"
    ) {
      return "";
    }

    return value
      .trim()
      .toLowerCase();
  }

  function normalizeRole(
    value,
  ) {
    const normalized =
      normalizeRequiredString(
        value,
        "role",
      ).toLowerCase();

    if (
      !SUPPORTED_ROLES.has(
        normalized,
      )
    ) {
      const error =
        new Error(
          `Unsupported user role: ${normalized}.`,
        );

      error.status = 400;

      throw error;
    }

    return normalized;
  }

  function normalizeRequiredString(
    value,
    fieldName,
  ) {
    if (
      typeof value
        !== "string"
      || !value.trim()
    ) {
      const error =
        new Error(
          `${fieldName} is required.`,
        );

      error.status = 400;

      throw error;
    }

    return value.trim();
  }

  return {
    listUsers,
    getUserById,
    getUserByUsername,
    getUserByEmail,
    getUserByGoogleSubject,
    bindGoogleIdentity,
    createUser,
    updateUser,
    activateUser,
    deactivateUser,
    changeRole,
    updateManagedUser,
    resetPassword,
    getActiveAdministratorCount,
    sanitizeUser,
  };
}

module.exports = {
  createUserStore,
  SUPPORTED_ROLES,
};
