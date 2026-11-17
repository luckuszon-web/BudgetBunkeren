/**
 * Tema: mørkt som standard; valget gemmes i localStorage "bb-theme" ("light" | "dark").
 * `themeInitScript` køres i <head> før første visning (ingen blink) – se app/index.html.
 */
export const THEME_KEY = "bb-theme";
export const themeInitScript =
  `try{var t=localStorage.getItem("${THEME_KEY}");document.documentElement.classList.toggle("dark",t!=="light")}catch(e){document.documentElement.classList.add("dark")}`;

export const isDark = () => document.documentElement.classList.contains("dark");
export function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch { /* ok */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#121820" : "#f5f8f6");
}
