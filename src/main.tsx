import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import WeatherApp from "../app/weather-app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WeatherApp />
  </StrictMode>,
);
