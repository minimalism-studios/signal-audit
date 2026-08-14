function createEventBus() {
  const listeners =
    new Map();

  function on(
    eventName,
    handler,
  ) {
    assertEventName(
      eventName,
    );

    if (
      typeof handler
      !== "function"
    ) {
      throw new TypeError(
        "Event handler must be a function.",
      );
    }

    const eventListeners =
      listeners.get(
        eventName,
      )
      ?? new Set();

    eventListeners.add(
      handler,
    );

    listeners.set(
      eventName,
      eventListeners,
    );

    return () =>
      off(
        eventName,
        handler,
      );
  }

  function off(
    eventName,
    handler,
  ) {
    const eventListeners =
      listeners.get(
        eventName,
      );

    if (!eventListeners) {
      return false;
    }

    const removed =
      eventListeners.delete(
        handler,
      );

    if (
      eventListeners.size === 0
    ) {
      listeners.delete(
        eventName,
      );
    }

    return removed;
  }

  function emit(
    eventName,
    payload,
  ) {
    assertEventName(
      eventName,
    );

    const eventListeners =
      listeners.get(
        eventName,
      );

    if (!eventListeners) {
      return [];
    }

    return [
      ...eventListeners,
    ].map(
      (handler) => {
        try {
          return {
            success: true,

            value:
              handler(payload),
          };
        } catch (error) {
          console.error(
            `Event handler failed for "${eventName}".`,
            error,
          );

          return {
            success: false,
            error,
          };
        }
      },
    );
  }

  return {
    on,
    off,
    emit,
  };
}

function assertEventName(
  eventName,
) {
  if (
    typeof eventName
      !== "string"
    || eventName.trim() === ""
  ) {
    throw new TypeError(
      "Event name must be a non-empty string.",
    );
  }
}

module.exports = {
  createEventBus,
};
