import React from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import LivePage from "./pages/LivePage";
import EpgPage from "./pages/EpgPage";
import MoviesPage from "./pages/MoviesPage";
import SeriesPage from "./pages/SeriesPage";
import MultiViewPage from "./pages/MultiViewPage";
import SettingsPage from "./pages/SettingsPage";
import SearchPage from "./pages/SearchPage";
import DiagnosticsPage from "./pages/DiagnosticsPage";

export default function App() {
  return (
    <div>
      <div className="nav">
        <div className="container row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <NavLink to="/live" className={({isActive}) => isActive ? "active" : ""}>Live</NavLink>
            <NavLink to="/epg" className={({isActive}) => isActive ? "active" : ""}>EPG</NavLink>
            <NavLink to="/movies" className={({isActive}) => isActive ? "active" : ""}>Movies</NavLink>
            <NavLink to="/series" className={({isActive}) => isActive ? "active" : ""}>Series</NavLink>
            <NavLink to="/multiview" className={({isActive}) => isActive ? "active" : ""}>Multiview</NavLink>
            <NavLink to="/search" className={({isActive}) => isActive ? "active" : ""}>Search</NavLink>
            <NavLink to="/settings" className={({isActive}) => isActive ? "active" : ""}>Settings</NavLink>
            <NavLink to="/diagnostics" className={({isActive}) => isActive ? "active" : ""}>Diagnostics</NavLink>
          </div>
          <div className="muted">Web IPTV Player (user-supplied)</div>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<LivePage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/epg" element={<EpgPage />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/series" element={<SeriesPage />} />
        <Route path="/multiview" element={<MultiViewPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/diagnostics" element={<DiagnosticsPage />} />
      </Routes>
    </div>
  );
}
