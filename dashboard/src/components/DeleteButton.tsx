"use client";

import BlobDeleteButton from "@/components/BlobDeleteButton";

export default function DeleteButton({
  action,
  id,
  confirmText = "Are you sure you want to delete this item?",
  title = "Delete item?",
  label = "Delete",
  confirmLabel = "Delete",
  className = "rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: number;
  confirmText?: string;
  title?: string;
  label?: string;
  confirmLabel?: string;
  className?: string;
}) {
  return (
    <BlobDeleteButton
      action={action}
      id={id}
      title={title}
      confirmText={confirmText}
      label={label}
      confirmLabel={confirmLabel}
      className={className}
    />
  );
}
