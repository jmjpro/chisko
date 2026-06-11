import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface CsvDropzoneProps {
  /** Called with a file that has passed client-side validation. */
  onValidFile: (file: File) => void;
  /** Called when a file fails client-side validation; receives a translated message. */
  onError: (message: string) => void;
  loading?: boolean;
  success?: boolean;
  error?: string | null;
}

/**
 * Returns true if the text contains at least one valid IEC smart-meter row.
 * Expected format per row: "meterID","צריכה","DD/MM/YYYY","HH:MM",kWh,flag
 */
function isValidIecCsv(text: string): boolean {
  // Strip UTF-8 BOM
  const cleaned = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const parts = line.split(",");
    if (parts.length < 5) continue;

    const type = parts[1].replace(/"/g, "").trim();
    if (type !== "צריכה") continue;

    const dateStr = parts[2].replace(/"/g, "").trim();
    if (dateStr.split("/").length !== 3) continue;

    const kwh = parseFloat(parts[4].replace(/"/g, "").trim());
    if (isNaN(kwh)) continue;

    return true; // Found at least one valid consumption row
  }
  return false;
}

export default function CsvDropzone({
  onValidFile,
  onError,
  loading = false,
  success = false,
  error,
}: CsvDropzoneProps) {
  const { t: tw } = useTranslation("wizard");
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    // 1. Check extension / MIME type
    const isCsvMime =
      file.type === "text/csv" || file.type === "application/csv";
    const isCsvExt = file.name.toLowerCase().endsWith(".csv");
    if (!isCsvMime && !isCsvExt) {
      onError(tw("upload_error_not_csv"));
      return;
    }

    // 2. Read content and validate IEC format
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== "string" || !isValidIecCsv(text)) {
        onError(tw("upload_error_bad_format"));
        return;
      }
      onValidFile(file);
    };
    reader.onerror = () => onError(tw("upload_error_not_csv"));
    reader.readAsText(file, "utf-8");
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current += 1;
    if (!loading) setDragActive(true);
  }

  function handleDragOver(e: React.DragEvent) {
    // Required to allow drop
    e.preventDefault();
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    if (loading) return;
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so the same file can be re-selected after an error
    e.target.value = "";
  }

  function handleClick() {
    if (!loading) inputRef.current?.click();
  }

  const isInteractive = !loading;

  const zoneClass = dragActive
    ? "border-primary bg-primary/10"
    : success && !error
      ? "border-success bg-success/5"
      : error
        ? "border-destructive bg-destructive/5"
        : "border-border bg-muted/50";

  const hoverClass = isInteractive
    ? "hover:border-primary/70 hover:bg-primary/10 cursor-pointer"
    : "cursor-not-allowed opacity-60";

  // A <div> is used instead of <button> because HTML buttons cannot be valid
  // drop targets in some browsers. The role, tabIndex, and onKeyDown handler
  // replicate button semantics for keyboard and assistive technology.
  return (
    <div
      role="button"
      tabIndex={isInteractive ? 0 : -1}
      aria-label={tw("upload_drop_prompt")}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl px-6 py-10 transition-colors select-none",
        zoneClass,
        hoverClass,
      )}
    >
      {/* Hidden real file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="sr-only"
        onChange={handleInputChange}
        disabled={loading}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Icon */}
      {loading ? (
        <svg
          className="w-10 h-10 text-muted-foreground animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.25"
          />
          <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : success && !error ? (
        <svg
          className="w-10 h-10 text-success"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className={cn(
            "w-10 h-10",
            error ? "text-destructive" : "text-muted-foreground",
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5V19.5"
          />
        </svg>
      )}

      {/* Primary text */}
      {loading ? (
        <p className="text-sm text-muted-foreground">
          {tw("upload_processing")}
        </p>
      ) : success && !error ? (
        <p className="text-sm font-medium text-success">
          {tw("upload_success")}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground text-center">
          {dragActive ? tw("upload_drag_active") : tw("upload_drop_prompt")}
        </p>
      )}

      {/* Error message */}
      {error && !loading && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
