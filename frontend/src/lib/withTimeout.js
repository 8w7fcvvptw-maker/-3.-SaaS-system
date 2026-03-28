/**
 * Завершает promise по таймауту, чтобы UI не зависал на «Загрузка…» при сети/антивирусе.
 */
export function withTimeout(promise, ms, message = "Превышено время ожидания") {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (val) => {
        clearTimeout(t);
        resolve(val);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      }
    );
  });
}
