"use client";

import { Heart } from "lucide-react";

export default function KofiButton({ className }: { className?: string }) {
  return (
    <a
      href="https://ko-fi.com/K3K51WFWG9"
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <Heart className="h-3.5 w-3.5 text-pink-400" />
      <span>Sponsor</span>
    </a>
  );
}
