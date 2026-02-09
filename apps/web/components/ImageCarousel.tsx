"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IMAGE_BASE_URL } from "@/lib/api";

const resolveImageUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${IMAGE_BASE_URL}${normalized}`;
};

type ImageCarouselProps = {
  images: string[];
  alt: string;
  className?: string;
};

export const ImageCarousel = ({ images, alt, className }: ImageCarouselProps) => {
  const normalizedImages = useMemo(
    () => images.map((image) => resolveImageUrl(image)).filter(Boolean),
    [images]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= normalizedImages.length) {
      setIndex(0);
    }
  }, [index, normalizedImages.length]);

  if (!normalizedImages.length) {
    return null;
  }

  const total = normalizedImages.length;
  const goPrev = () => setIndex((prev) => (prev - 1 + total) % total);
  const goNext = () => setIndex((prev) => (prev + 1) % total);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ""}`}>
      <img
        src={normalizedImages[index]}
        alt={alt}
        className="h-full w-full object-cover"
      />
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-orange-500 shadow-md transition hover:bg-white"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-orange-500 shadow-md transition hover:bg-white"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
            <span>
              {index + 1} / {total}
            </span>
          </div>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {normalizedImages.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className={`h-2 w-2 rounded-full transition-all ${
                  dotIndex === index
                    ? "bg-white"
                    : "bg-white/50 hover:bg-white/80"
                }`}
                aria-label={`Go to image ${dotIndex + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
