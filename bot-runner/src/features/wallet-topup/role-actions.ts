export async function runRoleRemoval(
  remove: () => Promise<void>,
  attempts = 2,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await remove();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
