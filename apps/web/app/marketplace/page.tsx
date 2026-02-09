"use client";

import { Button } from "@/components/Button";

const ShoppingBagIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 8V7a6 6 0 0 1 12 0v1" />
    <path d="M4 8h16l-1.5 12.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8Z" />
    <path d="M9 11a3 3 0 0 0 6 0" />
  </svg>
);

export default function MarketplacePage() {
  return (
    <div className="min-h-[calc(100svh-96px)] bg-gray-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">
              Marketplace
            </h1>
            <p className="mt-2 text-sm text-muted">
              Buy and sell with students at UW-Madison
            </p>
          </div>
          <Button disabled className="w-full sm:w-auto">
            Post Listing
          </Button>
        </div>

        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-card-border/70 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-500">
              <ShoppingBagIcon className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              No listings yet
            </h2>
            <p className="mt-2 text-sm text-muted">
              Be the first to sell something!
            </p>
            <Button disabled className="mt-6 w-full sm:w-auto">
              Post Listing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
