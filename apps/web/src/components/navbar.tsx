"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Menu, X, Github, ChevronDown, Download } from "lucide-react";
import KofiButton from "./kofi-button";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Protocols", href: "/#protocols" },
  { label: "Performance", href: "/#performance" },
  { label: "Benchmarks", href: "/benchmarks" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

const compareLinks = [
  { label: "vs Postman", href: "/compare/postman" },
  { label: "vs Bruno", href: "/compare/bruno" },
  { label: "vs Insomnia", href: "/compare/insomnia" },
  { label: "vs Hoppscotch", href: "/compare/hoppscotch" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const compareTimeout = useRef<NodeJS.Timeout | null>(null);
  const { scrollY } = useScroll();

  const backgroundOpacity = useTransform(scrollY, [0, 80], [0, 0.95]);
  const borderOpacity = useTransform(scrollY, [0, 80], [0, 1]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleCompareEnter = () => {
    if (compareTimeout.current) clearTimeout(compareTimeout.current);
    setCompareOpen(true);
  };

  const handleCompareLeave = () => {
    compareTimeout.current = setTimeout(() => setCompareOpen(false), 150);
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.includes("#")) return;
    const hash = href.split("#")[1];
    if (!hash) return;

    if (window.location.pathname === "/") {
      e.preventDefault();
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
    setMobileOpen(false);
  };

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundColor: useTransform(
              backgroundOpacity,
              (v) => `rgba(9, 9, 11, ${v})`
            ),
            borderBottom: useTransform(
              borderOpacity,
              (v) => `1px solid rgba(42, 42, 53, ${v * 0.6})`
            ),
          }}
        />

        <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <Image
              src="/logo.png"
              alt="ApiArk"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-base font-semibold tracking-tight text-white">
              Api
              <span className="text-indigo-400">
                Ark
              </span>
            </span>
          </Link>

          {/* Desktop nav links — centered */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => scrollToSection(e, link.href)}
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
              >
                {link.label}
              </a>
            ))}

            {/* Compare dropdown */}
            <div
              className="relative"
              onMouseEnter={handleCompareEnter}
              onMouseLeave={handleCompareLeave}
            >
              <button
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
                onClick={() => setCompareOpen(!compareOpen)}
              >
                Compare
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-200 ${
                    compareOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {compareOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    className="absolute left-1/2 top-full mt-2 w-48 -translate-x-1/2 overflow-hidden rounded-lg border border-white/[0.06] bg-[#111113]/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-xl"
                  >
                    {compareLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center rounded-md px-3 py-2 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-white"
                        onClick={() => setCompareOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right side actions */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <KofiButton className="flex items-center gap-2 rounded-md border border-pink-500/20 bg-pink-500/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-zinc-400 transition-all hover:border-pink-500/30 hover:bg-pink-500/[0.08] hover:text-zinc-200" />

            <a
              href="https://github.com/berbicanes/apiark"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5 text-[13px] font-medium text-zinc-400 transition-all hover:border-white/[0.12] hover:text-zinc-200"
            >
              <Github className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>

            <a
              href="/download"
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="relative z-50 rounded-md p-2 text-zinc-400 transition-colors hover:text-white lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </motion.header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile menu panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-40 flex h-full w-80 max-w-[85vw] flex-col border-l border-white/[0.06] bg-[#09090b]/98 pt-20 backdrop-blur-2xl lg:hidden"
          >
            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="rounded-md px-4 py-3 text-[15px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  {link.label}
                </a>
              ))}

              {/* Mobile compare section */}
              <div className="mt-2 border-t border-white/[0.06] pt-3">
                <p className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-600 font-mono">
                  _compare
                </p>
                {compareLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-md px-4 py-3 text-[15px] font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Mobile bottom actions */}
            <div className="flex flex-col gap-2.5 border-t border-white/[0.06] p-4">
              <KofiButton className="flex items-center justify-center gap-2 rounded-md border border-pink-500/20 bg-pink-500/[0.04] px-4 py-3 text-sm font-medium text-zinc-400 transition-all hover:border-pink-500/30 hover:bg-pink-500/[0.08] hover:text-white" />

              <a
                href="https://github.com/berbicanes/apiark"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm font-medium text-zinc-400 transition-all hover:border-white/[0.12] hover:text-white"
              >
                <Github className="h-4 w-4" />
                <span>Star on GitHub</span>
              </a>

              <a
                href="/download"
                className="flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                <Download className="h-4 w-4" />
                <span>Download ApiArk</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
