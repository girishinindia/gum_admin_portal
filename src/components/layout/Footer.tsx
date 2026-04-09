"use client";
/* ================================================================
   Footer — Simple footer with copyright and version
   ================================================================ */

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="gum-footer">
      <span>&copy; {year} GrowUpMore. All rights reserved.</span>
      <span>v1.0.0</span>
    </footer>
  );
}
