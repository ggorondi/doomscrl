"use client";

import { useEffect, useState, type RefObject } from "react";

export function useNearViewport<T extends Element>(
  ref: RefObject<T | null>,
  rootMargin = "400px 0px"
) {
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (isNearViewport) return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isNearViewport, ref, rootMargin]);

  return isNearViewport;
}
