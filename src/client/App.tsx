import { Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell";
import LiveBoard from "./pages/LiveBoard";
import Timeline from "./pages/Timeline";
import Insights from "./pages/Insights";
import Members from "./pages/Members";
import Login from "./pages/Login";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<LiveBoard />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/members" element={<Members />} />
      </Route>
    </Routes>
  );
}
