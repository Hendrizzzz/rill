try {
  const theme = localStorage.getItem("rill.theme.v1");
  if (theme === "nocturne" || theme === "tide") {
    document.documentElement.dataset.theme = theme;
  }
} catch {
  // The application will use the Paper theme when storage is unavailable.
}
