try {
  const theme = localStorage.getItem("typethock.theme.v1");
  document.documentElement.dataset.theme =
    theme === "paper" || theme === "nocturne" || theme === "tide"
      ? theme
      : "nocturne";
} catch {
  document.documentElement.dataset.theme = "nocturne";
}
