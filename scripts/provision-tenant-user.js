const {
  getTenantRuntimePaths,
} = require(
  "../services/tenantContext",
);

const {
  createUserStore,
} = require(
  "../services/userStore",
);

function requireEnvironmentVariable(
  name,
) {
  const value =
    process.env[name];

  if (
    typeof value !== "string"
    || !value.trim()
  ) {
    throw new Error(
      `${name} is required.`,
    );
  }

  return value.trim();
}

function main() {
  const tenantId =
    requireEnvironmentVariable(
      "TENANT_ID",
    );

  const email =
    requireEnvironmentVariable(
      "USER_EMAIL",
    )
      .toLowerCase();

  const role =
    requireEnvironmentVariable(
      "USER_ROLE",
    )
      .toLowerCase();

  const username =
    (
      process.env.USER_USERNAME
      || email
    )
      .trim()
      .toLowerCase();

  const paths =
    getTenantRuntimePaths(
      tenantId,
    );

  const userStore =
    createUserStore({
      filePath:
        paths.users,
      seedAdministratorEnabled:
        false,
    });

  const user =
    userStore.createUser({
      username,
      email,
      role,
      active:
        true,
    });

  console.log(
    JSON.stringify(
      userStore.sanitizeUser(
        user,
      ),
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(
    error.message,
  );
  process.exitCode = 1;
}
