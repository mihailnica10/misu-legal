1|import Link from "next/link";
2|import { MisuIcon } from "@/components/chat/misu-icon";
3|
4|interface SiteLogoProps {
5|    size?: "sm" | "md" | "lg" | "xl";
6|    className?: string;
7|    animate?: boolean;
8|    asLink?: boolean;
9|}
10|
11|export function SiteLogo({
12|    size = "md",
13|    className = "",
14|    animate = false,
15|    asLink = false,
16|}: SiteLogoProps) {
17|    const landingHref =
18|        process.env.NODE_ENV === "production"
19|            ? "https://misu.ro"
20|            : "http://localhost:3000";
21|    const sizeClasses = {
22|        sm: "text-xl",
23|        md: "text-2xl",
24|        lg: "text-4xl",
25|        xl: "text-6xl",
26|    };
27|
28|    const iconSizes = {
29|        sm: 20,
30|        md: 22,
31|        lg: 32,
32|        xl: 48,
33|    };
34|
35|    const logo = (
36|        <h1
37|            className={`flex items-center gap-1.5 ${sizeClasses[size]} font-light font-serif ${
38|                animate ? "sidebar-fade-in" : ""
39|            } ${className}`}
40|        >
41|            <MisuIcon size={iconSizes[size]} />
42|            <span>Mișu</span>
43|        </h1>
44|    );
45|
46|    if (asLink) {
47|        return (
48|            <Link
49|                href={landingHref}
50|                className="cursor-pointer hover:opacity-80 transition-opacity"
51|            >
52|                {logo}
53|            </Link>
54|        );
55|    }
56|
57|    return logo;
58|}
59|