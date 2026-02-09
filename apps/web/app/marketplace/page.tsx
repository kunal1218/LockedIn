"use client";

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

const SearchIcon = ({ className }: { className?: string }) => (
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
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

const categories = [
  "All",
  "Textbooks",
  "Electronics",
  "Furniture",
  "Clothing",
  "Other",
];

export default function MarketplacePage() {
  const activeCategory = "All";

  return (
    <div className="min-h-[calc(100svh-96px)] bg-gray-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">
              Marketplace
            </h1>
            <p className="mt-2 text-sm text-muted">
              Buy and sell with students at UW-Madison
            </p>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex w-full items-center justify-center rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(255,107,53,0.3)] transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Post Listing
          </button>
        </div>

        <div className="rounded-lg border border-card-border/70 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search marketplace..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const isActive = category === activeCategory;
                return (
                  <button
                    key={category}
                    type="button"
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-6">
          <div className="col-span-full flex items-center justify-center py-16">
            <div className="text-center">
              <ShoppingBagIcon className="mx-auto h-16 w-16 text-orange-500" />
              <h2 className="mt-4 text-xl font-semibold text-gray-900">
                No listings yet
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Be the first to sell something!
              </p>
              <button
                type="button"
                disabled
                className="mt-6 inline-flex items-center justify-center rounded-lg border border-orange-500 px-5 py-2.5 text-sm font-semibold text-orange-600 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Post Listing
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
