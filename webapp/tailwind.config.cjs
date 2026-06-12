module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        chef: {
          cream: "#fff7ed",
          tomato: "#f97316",
          basil: "#15803d",
          pan: "#1f2937",
          butter: "#facc15"
        }
      },
      boxShadow: {
        card: "0 14px 32px rgba(15, 23, 42, 0.14)"
      },
      borderRadius: {
        xl2: "1.25rem"
      }
    }
  },
  plugins: []
};
