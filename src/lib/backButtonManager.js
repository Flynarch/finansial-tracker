class BackButtonManager {
  constructor() {
    this.handlers = []
  }

  /**
   * Registers a callback to be called when the back button is pressed.
   * Returns a cleanup function to unregister.
   */
  register(handler) {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler)
    }
  }

  /**
   * Checks if there are active handlers and calls the top-most one.
   * Returns true if handled, false otherwise.
   */
  handleBack() {
    if (this.handlers.length > 0) {
      const handler = this.handlers[this.handlers.length - 1]
      handler()
      return true
    }
    return false
  }

  hasHandlers() {
    return this.handlers.length > 0
  }
}

export const backButtonManager = new BackButtonManager()
