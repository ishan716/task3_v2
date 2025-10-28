import { useTheme } from "../theme/ThemeProvider.jsx";

export default function ThemeToggleButton({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      className={`inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 ${className}`}
    >
      {isDark ? (
        <svg
          className="h-4 w-4 text-yellow-300"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3.75v1.5m0 14v1.5m7.5-7.5h-1.5m-14 0H3.75m15.662 5.662-1.06-1.06M5.648 6.648 4.59 5.59m13.5 0-1.06 1.06M5.648 17.352l-1.06 1.06M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4 text-gray-600 dark:text-gray-300"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12.79A9 9 0 1 1 11.21 3a7.5 7.5 0 0 0 9.79 9.79Z"
          />
        </svg>
      )}
      <span className="sr-only">Toggle theme</span>
      <span className="hidden sm:inline">{isDark ? "Dark" : "Light"} mode</span>
    </button>
  );
}
