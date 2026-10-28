const key =
  process.argv.find((a) => a.startsWith("--concept="))?.split("=")[1] ??
  "premium";
if (!["classic", "utopia", "imza", "premium"].includes(key))
  throw new Error("Unknown promo concept: " + key);
export const utopia = key === "utopia",
  imza = key === "imza" || key === "premium";
export const premium = key === "premium";
export const filmFolder = premium
  ? ".devshots/reklam-premium"
  : imza
    ? ".devshots/reklam-imza"
    : utopia
      ? ".devshots/reklam-utopya"
      : ".devshots/reklam-v3";
export const filmName = premium
  ? "reklam.mp4"
  : imza
    ? "reklam-imza.mp4"
    : utopia
      ? "reklam-utopya.mp4"
      : "reklam.mp4";
export const conceptQuery = "&concept=" + key;
