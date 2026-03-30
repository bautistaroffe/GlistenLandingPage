/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
        "background-light": "rgb(var(--color-bg-light) / <alpha-value>)",
        "background-dark": "rgb(var(--color-bg-dark) / <alpha-value>)",
        "surface-light": "rgb(var(--color-surface-light) / <alpha-value>)",
        "surface-dark": "rgb(var(--color-surface-dark) / <alpha-value>)",
        "text-light": "rgb(var(--color-text-light) / <alpha-value>)",
        "text-dark": "rgb(var(--color-text-dark) / <alpha-value>)",
        "muted-light": "rgb(var(--color-muted-light) / <alpha-value>)",
        "muted-dark": "rgb(var(--color-muted-dark) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "9999px",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/container-queries"),
  ],
};
