import { useEffect, useState } from "react";

type Section = "groups" | "official" | "custom";
const STORAGE_KEY = "nekopapa.contacts.sections.v1";
const sections: Section[] = ["groups", "official", "custom"];

function readCollapsed(): Section[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? sections.filter((section) => saved.includes(section)) : [];
  } catch { return []; }
}

/** Search expansion is temporary; clearing the query restores the saved hierarchy. */
export function useContactSections(query: string) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [search, setSearch] = useState<{ query: string; collapsed: Section[] }>({ query: "", collapsed: [] });
  const [notice, setNotice] = useState("");
  useEffect(() => { setSearch({ query, collapsed: [] }); }, [query]);
  const visibleCollapsed = query ? search.query === query ? search.collapsed : [] : collapsed;
  const toggle = (section: Section) => {
    const next = visibleCollapsed.includes(section) ? visibleCollapsed.filter((item) => item !== section) : [...visibleCollapsed, section];
    if (query) { setSearch({ query, collapsed: next }); return; }
    setCollapsed(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setNotice(""); }
    catch { setNotice("分组显示偏好未能保存，本次页面内仍然有效。"); }
  };
  return { isCollapsed: (section: Section) => visibleCollapsed.includes(section), toggle, notice };
}
