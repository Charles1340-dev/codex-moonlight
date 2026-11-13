import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { Pet } from "./Pet.jsx";
import "./styles.css";

const petView = (import.meta.env.DEV || Boolean(window.moonlight)) && new URLSearchParams(location.search).has("pet");
if (petView && window.moonlight) document.documentElement.classList.add("pet-document");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {petView ? <Pet floating={Boolean(window.moonlight)} /> : <App />}
  </React.StrictMode>,
);
