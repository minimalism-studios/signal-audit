(function initializeSettingsUsers(
  global,
) {
  "use strict";

  const ROLES =
    Object.freeze([
      "administrator",
      "operator",
      "executive",
      "viewer",
    ]);

  const state = {
    container:
      null,

    users:
      [],

    currentUser:
      null,

    loading:
      false,

    error:
      null,

    showCreateForm:
      false,

    onMessage:
      null,
  };

  function getApi() {
    const api =
      global
        .SignalAuditUsersApi;

    if (!api) {
      throw new Error(
        "Signal Audit Users API is unavailable.",
      );
    }

    return api;
  }

  function escapeHtml(
    value,
  ) {
    return String(
      value ?? "",
    )
      .replaceAll(
        "&",
        "&amp;",
      )
      .replaceAll(
        "<",
        "&lt;",
      )
      .replaceAll(
        ">",
        "&gt;",
      )
      .replaceAll(
        '"',
        "&quot;",
      )
      .replaceAll(
        "'",
        "&#039;",
      );
  }

  function formatRole(
    role,
  ) {
    const normalized =
      String(
        role ?? "",
      )
        .trim();

    if (!normalized) {
      return "Unknown";
    }

    return (
      normalized
        .charAt(0)
        .toUpperCase()
      + normalized.slice(1)
    );
  }

  function formatDate(
    value,
  ) {
    if (!value) {
      return "Not recorded";
    }

    const date =
      new Date(
        value,
      );

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return "Not recorded";
    }

    return new Intl
      .DateTimeFormat(
        undefined,
        {
          dateStyle:
            "medium",

          timeStyle:
            "short",
        },
      )
      .format(
        date,
      );
  }

  function showMessage(
    message,
  ) {
    if (
      typeof state.onMessage
        === "function"
    ) {
      state.onMessage(
        message,
      );
    }
  }

  function renderRoleOptions(
    selectedRole,
  ) {
    return ROLES
      .map(
        (role) => `
          <option
            value="${escapeHtml(
              role,
            )}"
            ${
              role
                === selectedRole
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(
              formatRole(
                role,
              ),
            )}
          </option>
        `,
      )
      .join("");
  }

  function renderPermissions(
    permissions,
  ) {
    const values =
      Array.isArray(
        permissions,
      )
        ? permissions
        : [];

    if (values.length === 0) {
      return `
        <span
          class="user-permission-tag"
        >
          No permissions
        </span>
      `;
    }

    return values
      .map(
        (permission) => `
          <span
            class="user-permission-tag"
          >
            ${escapeHtml(
              permission,
            )}
          </span>
        `,
      )
      .join("");
  }

  function renderCreateForm() {
    if (!state.showCreateForm) {
      return "";
    }

    return `
      <form
        id="create-user-form"
        class="user-management-form"
      >
        <div
          class="user-management-form__grid"
        >
          <label>
            <span>
              Username
            </span>

            <input
              name="username"
              type="text"
              autocomplete="off"
              required
            >
          </label>

          <label>
            <span>
              Initial password
            </span>

            <input
              name="password"
              type="password"
              autocomplete="new-password"
              minlength="12"
              required
            >
          </label>

          <label>
            <span>
              Role
            </span>

            <select
              name="role"
              required
            >
              ${renderRoleOptions(
                "viewer",
              )}
            </select>
          </label>

          <label
            class="user-management-form__checkbox"
          >
            <input
              name="active"
              type="checkbox"
              checked
            >

            <span>
              Account active
            </span>
          </label>
        </div>

        <div
          class="user-management-form__actions"
        >
          <button
            type="button"
            class="secondary-button"
            data-user-management-action="cancel-create"
          >
            Cancel
          </button>

          <button
            type="submit"
            class="primary-button"
          >
            Create User
          </button>
        </div>
      </form>
    `;
  }

  function renderUser(
    user,
  ) {
    const isCurrentUser =
      user.id
      === state.currentUser?.id;

    return `
      <article
        class="
          user-management-record
          ${
            user.active
              ? ""
              : "is-inactive"
          }
        "
        data-user-id="${escapeHtml(
          user.id,
        )}"
      >
        <header
          class="user-management-record__header"
        >
          <div>
            <div
              class="user-management-record__identity"
            >
              <h4>
                ${escapeHtml(
                  user.username,
                )}
              </h4>

              ${
                isCurrentUser
                  ? `
                    <span
                      class="user-current-badge"
                    >
                      Current user
                    </span>
                  `
                  : ""
              }
            </div>

            <p>
              Created
              ${escapeHtml(
                formatDate(
                  user.createdAt,
                ),
              )}
            </p>
          </div>

          <span
            class="
              user-status-badge
              ${
                user.active
                  ? "is-active"
                  : "is-inactive"
              }
            "
          >
            ${
              user.active
                ? "Active"
                : "Inactive"
            }
          </span>
        </header>

        <div
          class="user-management-record__controls"
        >
          <label>
            <span>
              Role
            </span>

            <select
              data-user-role
              ${
                isCurrentUser
                  ? "disabled"
                  : ""
              }
            >
              ${renderRoleOptions(
                user.role,
              )}
            </select>
          </label>

          <div
            class="user-management-record__actions"
          >
            <button
              type="button"
              class="secondary-button"
              data-user-action="save"
              ${
                isCurrentUser
                  ? "disabled"
                  : ""
              }
            >
              Save Role
            </button>

            <button
              type="button"
              class="secondary-button"
              data-user-action="reset-password"
            >
              Reset Password
            </button>

            <button
              type="button"
              class="
                secondary-button
                ${
                  user.active
                    ? "destructive-button"
                    : ""
                }
              "
              data-user-action="${
                user.active
                  ? "deactivate"
                  : "activate"
              }"
              ${
                isCurrentUser
                  ? "disabled"
                  : ""
              }
            >
              ${
                user.active
                  ? "Deactivate"
                  : "Activate"
              }
            </button>
          </div>
        </div>

        <div
          class="user-management-record__permissions"
        >
          <p>
            Role-derived permissions
          </p>

          <div>
            ${renderPermissions(
              user.permissions,
            )}
          </div>
        </div>
      </article>
    `;
  }

  function render() {
    if (!state.container) {
      return;
    }

    if (state.loading) {
      state.container
        .innerHTML = `
          <div
            class="user-management-message"
          >
            Loading users…
          </div>
        `;

      return;
    }

    if (state.error) {
      state.container
        .innerHTML = `
          <div
            class="
              user-management-message
              user-management-message--error
            "
          >
            <strong>
              Unable to load users
            </strong>

            <p>
              ${escapeHtml(
                state.error,
              )}
            </p>

            <button
              type="button"
              class="secondary-button"
              data-user-management-action="retry"
            >
              Try Again
            </button>
          </div>
        `;

      return;
    }

    state.container
      .innerHTML = `
        <div
          class="user-management-toolbar"
        >
          <div>
            <strong>
              ${
                state.users.length
              }
              ${
                state.users.length
                  === 1
                  ? "user"
                  : "users"
              }
            </strong>

            <span>
              Roles determine access throughout Signal Audit.
            </span>
          </div>

          <button
            type="button"
            class="primary-button"
            data-user-management-action="show-create"
            ${
              state.showCreateForm
                ? "hidden"
                : ""
            }
          >
            Add User
          </button>
        </div>

        ${renderCreateForm()}

        <div
          class="user-management-list"
        >
          ${
            state.users.length > 0
              ? state.users
                  .map(
                    renderUser,
                  )
                  .join("")
              : `
                <div
                  class="user-management-message"
                >
                  No users were found.
                </div>
              `
          }
        </div>
      `;
  }

  async function loadUsers() {
    state.loading =
      true;

    state.error =
      null;

    render();

    try {
      state.users =
        await getApi()
          .listUsers();
    } catch (error) {
      state.error =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";
    } finally {
      state.loading =
        false;

      render();
    }
  }

  async function createUser(
    form,
  ) {
    const formData =
      new FormData(
        form,
      );

    const submitButton =
      form.querySelector(
        '[type="submit"]',
      );

    if (submitButton) {
      submitButton.disabled =
        true;

      submitButton.textContent =
        "Creating…";
    }

    try {
      await getApi()
        .createUser({
          username:
            formData
              .get(
                "username",
              ),

          password:
            formData
              .get(
                "password",
              ),

          role:
            formData
              .get(
                "role",
              ),

          active:
            formData
              .get(
                "active",
              )
            === "on",
        });

      state.showCreateForm =
        false;

      showMessage(
        "User created.",
      );

      await loadUsers();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to create user.",
      );

      if (submitButton) {
        submitButton.disabled =
          false;

        submitButton.textContent =
          "Create User";
      }
    }
  }

  async function updateRole(
    record,
    userId,
  ) {
    const roleSelect =
      record.querySelector(
        "[data-user-role]",
      );

    if (!roleSelect) {
      return;
    }

    await getApi()
      .updateUser(
        userId,
        {
          role:
            roleSelect.value,
        },
      );

    showMessage(
      "User role updated.",
    );

    await loadUsers();
  }

  async function changeActiveState(
    userId,
    active,
  ) {
    const confirmed =
      window.confirm(
        active
          ? "Activate this user account?"
          : "Deactivate this user account? Existing sessions will stop working immediately.",
      );

    if (!confirmed) {
      return;
    }

    await getApi()
      .updateUser(
        userId,
        {
          active,
        },
      );

    showMessage(
      active
        ? "User activated."
        : "User deactivated.",
    );

    await loadUsers();
  }

  async function resetPassword(
    userId,
  ) {
    const password =
      window.prompt(
        "Enter a new password of at least 12 characters.",
      );

    if (password === null) {
      return;
    }

    await getApi()
      .resetPassword(
        userId,
        password,
      );

    showMessage(
      "Password reset.",
    );
  }

  async function handleAction(
    button,
  ) {
    const managementAction =
      button.dataset
        .userManagementAction;

    if (managementAction) {
      switch (
        managementAction
      ) {
        case "show-create":
          state.showCreateForm =
            true;

          render();

          break;

        case "cancel-create":
          state.showCreateForm =
            false;

          render();

          break;

        case "retry":
          await loadUsers();

          break;

        default:
          break;
      }

      return;
    }

    const action =
      button.dataset
        .userAction;

    if (!action) {
      return;
    }

    const record =
      button.closest(
        "[data-user-id]",
      );

    const userId =
      record?.dataset
        .userId;

    if (
      !record
      || !userId
    ) {
      return;
    }

    button.disabled =
      true;

    try {
      switch (action) {
        case "save":
          await updateRole(
            record,
            userId,
          );

          break;

        case "activate":
          await changeActiveState(
            userId,
            true,
          );

          break;

        case "deactivate":
          await changeActiveState(
            userId,
            false,
          );

          break;

        case "reset-password":
          await resetPassword(
            userId,
          );

          break;

        default:
          break;
      }
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to update user.",
      );
    } finally {
      if (
        document.body
          .contains(
            button,
          )
      ) {
        button.disabled =
          false;
      }
    }
  }

  function bindEvents() {
    state.container
      ?.addEventListener(
        "click",
        (event) => {
          const button =
            event.target.closest(
              [
                "[data-user-action]",
                "[data-user-management-action]",
              ].join(","),
            );

          if (!button) {
            return;
          }

          handleAction(
            button,
          );
        },
      );

    state.container
      ?.addEventListener(
        "submit",
        (event) => {
          const form =
            event.target.closest(
              "#create-user-form",
            );

          if (!form) {
            return;
          }

          event.preventDefault();

          createUser(
            form,
          );
        },
      );
  }

  async function mount({
    container,
    currentUser,
    onMessage,
  }) {
    state.container =
      typeof container
        === "string"
        ? document.querySelector(
            container,
          )
        : container;

    if (!state.container) {
      return;
    }

    state.currentUser =
      currentUser
      ?? null;

    state.onMessage =
      onMessage
      ?? null;

    state.showCreateForm =
      false;

    bindEvents();

    await loadUsers();
  }

  global.SignalAuditSettingsUsers =
    Object.freeze({
      mount,
      loadUsers,
    });
})(
  window,
);
