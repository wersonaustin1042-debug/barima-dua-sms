import "./globals.css";

export const metadata = {
  title: "Barima Dua Memorial School — Management System",
  description: "Enrollment, attendance, and fees for Barima Dua Memorial School",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
