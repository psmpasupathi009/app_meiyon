"use client";

import { SearchableSelect } from "@/shared/components/forms/searchable-select";
import type { FormOption } from "@/config/company/form-options";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: FormOption[];
  placeholder?: string;
  className?: string;
  allowOther?: boolean;
  otherPlaceholder?: string;
  disabled?: boolean;
};

/**
 * Dropdown with optional “Other” free-text when the value is not in the list.
 * Built on SearchableSelect (shadcn combobox).
 */
export function SelectOrOther({
  value,
  onChange,
  options,
  placeholder = "Select",
  className = "h-11",
  allowOther = true,
  otherPlaceholder = "Type custom value",
  disabled,
}: Props) {
  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder="Search…"
      className={className}
      allowOther={allowOther}
      otherPlaceholder={otherPlaceholder}
      disabled={disabled}
    />
  );
}
