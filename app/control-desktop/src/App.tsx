import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { isPreview } from "./lib/env";
import { HomePage } from "./pages/home/HomePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

export default function App() {
  /* 设计预览模式（?preview=1）：body 恢复居中画布 */
  useEffect(() => {
    document.body.classList.toggle("preview", isPreview);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* 其余原型页面统一落在「重写中」占位页，逐页替换 */}
      <Route path="*" element={<PlaceholderPage />} />
    </Routes>
  );
}
