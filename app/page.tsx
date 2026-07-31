import type { Metadata } from "next";
import WeatherApp from "./weather-app";

export const metadata: Metadata = {
  title: "Atmos — Havanın Ritmini Hisset",
  description: "Canlı, akıllı ve atmosferik hava durumu deneyimi.",
};

export default function Home() {
  return <WeatherApp />;
}
