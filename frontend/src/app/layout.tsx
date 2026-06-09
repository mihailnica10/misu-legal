1|import type { Metadata } from "next";
2|import { Inter, EB_Garamond } from "next/font/google";
3|import "./globals.css";
4|import { Providers } from "@/components/providers";
5|
6|const inter = Inter({
7|    variable: "--font-inter",
8|    subsets: ["latin"],
9|});
10|
11|const ebGaramond = EB_Garamond({
12|    variable: "--font-eb-garamond",
13|    subsets: ["latin"],
14|    weight: ["400", "500", "600", "700"],
15|});
16|
17|export const metadata: Metadata = {
18|    metadataBase: new URL("https://misu.ro"),
19|    title: "Mișu — Asistent Documente Juridice",
20|    description:
21|        "Asistent AI pentru documente juridice — analiză, rezumate, drafting.",
22|    icons: {
23|        icon: [
24|            { url: "/icon.svg", type: "image/svg+xml" },
25|            { url: "/favicon.ico" },
26|        ],
27|        apple: "/apple-touch-icon.png",
28|    },
29|    openGraph: {
30|        type: "website",
31|        url: "https://misu.ro",
32|        siteName: "Mike",
33|        title: "Mișu — Asistent Documente Juridice",
34|        description:
35|            "Asistent AI pentru documente juridice — analiză, rezumate, drafting.",
36|        images: [
37|            {
38|                url: "/link-image.jpg",
39|                width: 1200,
40|                height: 651,
41|                alt: "Mike",
42|            },
43|        ],
44|    },
45|    twitter: {
46|        card: "summary_large_image",
47|        title: "Mișu — Asistent Documente Juridice",
48|        description:
49|            "Asistent AI pentru documente juridice — analiză, rezumate, drafting.",
50|        images: ["/link-image.jpg"],
51|    },
52|};
53|
54|export default function RootLayout({
55|    children,
56|}: Readonly<{
57|    children: React.ReactNode;
58|}>) {
59|    return (
60|        <html lang="en">
61|            <body
62|                className={`${inter.variable} ${ebGaramond.variable} font-sans antialiased`}
63|            >
64|                <Providers>{children}</Providers>
65|            </body>
66|        </html>
67|    );
68|}
69|