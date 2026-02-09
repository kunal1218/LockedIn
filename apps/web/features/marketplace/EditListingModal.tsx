"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import { useAuth } from "@/features/auth";
import { updateListing } from "@/lib/api/marketplace";
import type { Listing } from "./types";

const inputClasses =
  "mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100";

const labelClasses = "text-xs font-semibold uppercase tracking-[0.2em] text-gray-500";

type EditListingModalProps = {
  isOpen: boolean;
  listing: Listing | null;
  onClose: () => void;
  onSuccess?: (listing: Listing) => void;
};

type FieldErrors = Partial<{
  title: string;
  description: string;
  price: string;
  category: string;
  condition: string;
}>;

const categories = ["Textbooks", "Electronics", "Furniture", "Clothing", "Other"];
const conditions = ["New", "Like New", "Good", "Fair"];

export const EditListingModal = ({
  isOpen,
  listing,
  onClose,
  onSuccess,
}: EditListingModalProps) => {
  const { token, isAuthenticated, openAuthModal } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !listing) {
      return;
    }
    setTitle(listing.title ?? "");
    setDescription(listing.description ?? "");
    setPrice(String(listing.price ?? ""));
    setCategory(listing.category ?? "");
    setCondition(listing.condition ?? "");
    setLocation(listing.location ?? "");
    setErrors({});
    setSubmitError(null);
    setSuccessMessage(null);
  }, [isOpen, listing]);

  const canSubmit = useMemo(() => !isSubmitting, [isSubmitting]);

  const handleClose = () => {
    setErrors({});
    setSubmitError(null);
    setSuccessMessage(null);
    onClose();
  };

  const validate = () => {
    const nextErrors: FieldErrors = {};

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      nextErrors.title = "Title is required.";
    } else if (trimmedTitle.length > 200) {
      nextErrors.title = "Title must be 200 characters or less.";
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      nextErrors.description = "Description is required.";
    } else if (trimmedDescription.length > 2000) {
      nextErrors.description = "Description must be 2000 characters or less.";
    }

    const priceValue = Number(price);
    if (!price.trim()) {
      nextErrors.price = "Price is required.";
    } else if (!Number.isFinite(priceValue) || priceValue < 0) {
      nextErrors.price = "Price must be a non-negative number.";
    }

    if (!category) {
      nextErrors.category = "Category is required.";
    }

    if (!condition) {
      nextErrors.condition = "Condition is required.";
    }

    setErrors(nextErrors);
    return { isValid: Object.keys(nextErrors).length === 0, priceValue };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (!listing) {
      setSubmitError("Listing not found.");
      return;
    }

    if (!isAuthenticated || !token) {
      openAuthModal("login");
      setSubmitError("Please sign in to edit listings.");
      return;
    }

    const { isValid, priceValue } = validate();
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateListing(
        listing.id,
        {
          title: title.trim(),
          description: description.trim(),
          price: priceValue,
          category,
          condition,
          location: location.trim() || undefined,
          images: listing.images ?? [],
        },
        token
      );
      setSuccessMessage("Listing updated.");
      onSuccess?.(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update listing";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !listing) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-8">
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-listing-title"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2
            id="edit-listing-title"
            className="font-display text-2xl font-semibold text-ink"
          >
            Edit Listing
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500 transition hover:border-orange-200 hover:text-ink"
          >
            Close
          </button>
        </div>

        <form className="space-y-5 px-6 py-6" onSubmit={handleSubmit}>
          <label className="block">
            <span className={labelClasses}>Title</span>
            <input
              className={inputClasses}
              type="text"
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            {errors.title && (
              <p className="mt-2 text-xs font-semibold text-rose-500">{errors.title}</p>
            )}
          </label>

          <label className="block">
            <span className={labelClasses}>Description</span>
            <textarea
              className={`${inputClasses} min-h-[120px] resize-none`}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            {errors.description && (
              <p className="mt-2 text-xs font-semibold text-rose-500">
                {errors.description}
              </p>
            )}
          </label>

          <label className="block">
            <span className={labelClasses}>Location</span>
            <input
              className={inputClasses}
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Optional"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClasses}>Price</span>
              <input
                className={inputClasses}
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
              {errors.price && (
                <p className="mt-2 text-xs font-semibold text-rose-500">
                  {errors.price}
                </p>
              )}
            </label>

            <label className="block">
              <span className={labelClasses}>Category</span>
              <select
                className={inputClasses}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">Select category</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-2 text-xs font-semibold text-rose-500">
                  {errors.category}
                </p>
              )}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClasses}>Condition</span>
              <select
                className={inputClasses}
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
              >
                <option value="">Select condition</option>
                {conditions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {errors.condition && (
                <p className="mt-2 text-xs font-semibold text-rose-500">
                  {errors.condition}
                </p>
              )}
            </label>

            <label className="block">
              <span className={labelClasses}>Images</span>
              <input className={inputClasses} type="file" multiple disabled />
              <p className="mt-2 text-xs text-gray-500">Image uploads coming soon.</p>
            </label>
          </div>

          {submitError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
              {submitError}
            </div>
          )}
          {successMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-600">
              {successMessage}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" requiresAuth={false} onClick={handleClose}>
              Cancel
            </Button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(255,107,53,0.3)] transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
