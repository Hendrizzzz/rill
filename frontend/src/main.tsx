import "@fontsource-variable/newsreader";
import "@fontsource-variable/recursive";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import "./styles/app.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("TypeThock could not find its application root.");
}

document.documentElement.dataset.typethockBuildId = __TYPETHOCK_BUILD_ID__;

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
