// Apply the saved theme before the first paint. Never writes user data.
try {
  const theme =
    JSON.parse(localStorage.getItem("ritmo:v2") || "null")?.theme || "system";
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
} catch {}
