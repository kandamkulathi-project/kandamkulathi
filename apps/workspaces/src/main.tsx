import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./WorkspaceApp";
import "@kandamkulathi/i18n/fonts.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
