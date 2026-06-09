1|"use client";
2|
3|import React, { useId } from "react";
4|
5|const DEGREES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
6|const STOP_TRANSITION = "stop-color 220ms ease, stop-opacity 220ms ease";
7|const FLOOD_TRANSITION = "flood-color 220ms ease, flood-opacity 220ms ease";
8|
9|type IconPalette = {
10|    shadowColor: string;
11|    shadowOpacity: number;
12|    fillStops: [string, string, string, string];
13|    fillOpacities: [number, number, number, number];
14|    specularStops: [number, number, number, number];
15|    borderStops: [string, string, string];
16|    borderOpacities: [number, number, number];
17|    innerStops: [string, string, string, string];
18|    innerOpacities: [number, number, number, number];
19|};
20|
21|const DEFAULT_PALETTE: IconPalette = {
22|    shadowColor: "#000000",
23|    shadowOpacity: 0.3,
24|    fillStops: ["#0a0a0a", "#151515", "#080808", "#111111"],
25|    fillOpacities: [0.9, 0.8, 0.85, 0.9],
26|    specularStops: [0.5, 0.2, 0, 0],
27|    borderStops: ["#ffffff", "#666666", "#ffffff"],
28|    borderOpacities: [0.3, 0.1, 0.2],
29|    innerStops: ["#ffffff", "#777777", "#222222", "#ffffff"],
30|    innerOpacities: [0, 0.08, 0.05, 0],
31|};
32|
33|const DONE_PALETTE: IconPalette = {
34|    shadowColor: "#166534",
35|    shadowOpacity: 0.18,
36|    fillStops: ["#4ade80", "#86efac", "#22c55e", "#bbf7d0"],
37|    fillOpacities: [0.95, 0.88, 0.9, 0.94],
38|    specularStops: [0.68, 0.32, 0.03, 0],
39|    borderStops: ["#f0fdf4", "#86efac", "#dcfce7"],
40|    borderOpacities: [0.42, 0.24, 0.3],
41|    innerStops: ["#ffffff", "#dcfce7", "#4ade80", "#ffffff"],
42|    innerOpacities: [0, 0.16, 0.08, 0],
43|};
44|
45|const ERROR_PALETTE: IconPalette = {
46|    shadowColor: "#991b1b",
47|    shadowOpacity: 0.18,
48|    fillStops: ["#f87171", "#fca5a5", "#ef4444", "#fecaca"],
49|    fillOpacities: [0.95, 0.88, 0.9, 0.94],
50|    specularStops: [0.68, 0.32, 0.03, 0],
51|    borderStops: ["#fef2f2", "#fca5a5", "#fee2e2"],
52|    borderOpacities: [0.42, 0.24, 0.3],
53|    innerStops: ["#ffffff", "#fee2e2", "#f87171", "#ffffff"],
54|    innerOpacities: [0, 0.16, 0.08, 0],
55|};
56|
57|function Blades({ ids }: { ids: Record<string, string> }) {
58|    return (
59|        <g transform="translate(250, 250)">
60|            {DEGREES.map((deg) => (
61|                <g
62|                    key={deg}
63|                    transform={`rotate(${deg})`}
64|                    filter={`url(#${ids.shadow})`}
65|                >
66|                    <use
67|                        href={`#${ids.blade}`}
68|                        fill={`url(#${ids.glassFill})`}
69|                    />
70|                    <use
71|                        href={`#${ids.blade}`}
72|                        fill={`url(#${ids.innerLight})`}
73|                    />
74|                    <use
75|                        href={`#${ids.blade}`}
76|                        fill={`url(#${ids.specular})`}
77|                        clipPath={`url(#${ids.topClip})`}
78|                    />
79|                    <use
80|                        href={`#${ids.blade}`}
81|                        fill="none"
82|                        stroke={`url(#${ids.glassBorder})`}
83|                        strokeWidth="0.8"
84|                    />
85|                </g>
86|            ))}
87|        </g>
88|    );
89|}
90|
91|export function MisuIcon({
92|    spin = false,
93|    done = false,
94|    error = false,
95|    // misu branding
96|    size = 24,
97|    style,
98|}: {
99|    spin?: boolean;
100|    done?: boolean;
101|    error?: boolean;
102|    // removed
103|    size?: number;
104|    style?: React.CSSProperties;
105|}) {
106|    // void
107|    const id = useId().replace(/:/g, "");
108|    const palette = error
109|        ? ERROR_PALETTE
110|        : done
111|          ? DONE_PALETTE
112|          : DEFAULT_PALETTE;
113|    const m = {
114|        shadow: `${id}-m-shadow`,
115|        glassFill: `${id}-m-glassFill`,
116|        specular: `${id}-m-specular`,
117|        glassBorder: `${id}-m-glassBorder`,
118|        innerLight: `${id}-m-innerLight`,
119|        topClip: `${id}-m-topClip`,
120|        blade: `${id}-m-blade`,
121|    };
122|
123|    return (
124|        <span
125|            className="shrink-0 inline-block animate-[spin_3s_linear_infinite]"
126|            style={{
127|                animationPlayState: spin ? "running" : "paused",
128|                ...style,
129|            }}
130|        >
131|            <svg
132|                xmlns="http://www.w3.org/2000/svg"
133|                viewBox="100 100 300 300"
134|                width={size}
135|                height={size}
136|                style={{ display: "block" }}
137|            >
138|                <defs>
139|                    <filter
140|                        id={m.shadow}
141|                        x="-20%"
142|                        y="-20%"
143|                        width="140%"
144|                        height="140%"
145|                    >
146|                        <feDropShadow
147|                            dx="0"
148|                            dy="1.5"
149|                            stdDeviation="3"
150|                            floodColor={palette.shadowColor}
151|                            floodOpacity={palette.shadowOpacity}
152|                            style={{ transition: FLOOD_TRANSITION }}
153|                        />
154|                    </filter>
155|                    <linearGradient
156|                        id={m.glassFill}
157|                        x1="0%"
158|                        y1="0%"
159|                        x2="100%"
160|                        y2="100%"
161|                    >
162|                        <stop
163|                            offset="0%"
164|                            style={{
165|                                stopColor: palette.fillStops[0],
166|                                stopOpacity: palette.fillOpacities[0],
167|                                transition: STOP_TRANSITION,
168|                            }}
169|                        />
170|                        <stop
171|                            offset="30%"
172|                            style={{
173|                                stopColor: palette.fillStops[1],
174|                                stopOpacity: palette.fillOpacities[1],
175|                                transition: STOP_TRANSITION,
176|                            }}
177|                        />
178|                        <stop
179|                            offset="70%"
180|                            style={{
181|                                stopColor: palette.fillStops[2],
182|                                stopOpacity: palette.fillOpacities[2],
183|                                transition: STOP_TRANSITION,
184|                            }}
185|                        />
186|                        <stop
187|                            offset="100%"
188|                            style={{
189|                                stopColor: palette.fillStops[3],
190|                                stopOpacity: palette.fillOpacities[3],
191|                                transition: STOP_TRANSITION,
192|                            }}
193|                        />
194|                    </linearGradient>
195|                    <linearGradient
196|                        id={m.specular}
197|                        x1="0%"
198|                        y1="0%"
199|                        x2="0%"
200|                        y2="100%"
201|                    >
202|                        <stop
203|                            offset="0%"
204|                            style={{
205|                                stopColor: "#ffffff",
206|                                stopOpacity: palette.specularStops[0],
207|                                transition: STOP_TRANSITION,
208|                            }}
209|                        />
210|                        <stop
211|                            offset="15%"
212|                            style={{
213|                                stopColor: "#ffffff",
214|                                stopOpacity: palette.specularStops[1],
215|                                transition: STOP_TRANSITION,
216|                            }}
217|                        />
218|                        <stop
219|                            offset="35%"
220|                            style={{
221|                                stopColor: "#ffffff",
222|                                stopOpacity: palette.specularStops[2],
223|                                transition: STOP_TRANSITION,
224|                            }}
225|                        />
226|                        <stop
227|                            offset="100%"
228|                            style={{
229|                                stopColor: "#ffffff",
230|                                stopOpacity: palette.specularStops[3],
231|                                transition: STOP_TRANSITION,
232|                            }}
233|                        />
234|                    </linearGradient>
235|                    <linearGradient
236|                        id={m.glassBorder}
237|                        x1="0%"
238|                        y1="0%"
239|                        x2="0%"
240|                        y2="100%"
241|                    >
242|                        <stop
243|                            offset="0%"
244|                            style={{
245|                                stopColor: palette.borderStops[0],
246|                                stopOpacity: palette.borderOpacities[0],
247|                                transition: STOP_TRANSITION,
248|                            }}
249|                        />
250|                        <stop
251|                            offset="50%"
252|                            style={{
253|                                stopColor: palette.borderStops[1],
254|                                stopOpacity: palette.borderOpacities[1],
255|                                transition: STOP_TRANSITION,
256|                            }}
257|                        />
258|                        <stop
259|                            offset="100%"
260|                            style={{
261|                                stopColor: palette.borderStops[2],
262|                                stopOpacity: palette.borderOpacities[2],
263|                                transition: STOP_TRANSITION,
264|                            }}
265|                        />
266|                    </linearGradient>
267|                    <linearGradient
268|                        id={m.innerLight}
269|                        x1="100%"
270|                        y1="0%"
271|                        x2="0%"
272|                        y2="100%"
273|                    >
274|                        <stop
275|                            offset="0%"
276|                            style={{
277|                                stopColor: palette.innerStops[0],
278|                                stopOpacity: palette.innerOpacities[0],
279|                                transition: STOP_TRANSITION,
280|                            }}
281|                        />
282|                        <stop
283|                            offset="40%"
284|                            style={{
285|                                stopColor: palette.innerStops[1],
286|                                stopOpacity: palette.innerOpacities[1],
287|                                transition: STOP_TRANSITION,
288|                            }}
289|                        />
290|                        <stop
291|                            offset="60%"
292|                            style={{
293|                                stopColor: palette.innerStops[2],
294|                                stopOpacity: palette.innerOpacities[2],
295|                                transition: STOP_TRANSITION,
296|                            }}
297|                        />
298|                        <stop
299|                            offset="100%"
300|                            style={{
301|                                stopColor: palette.innerStops[3],
302|                                stopOpacity: palette.innerOpacities[3],
303|                                transition: STOP_TRANSITION,
304|                            }}
305|                        />
306|                    </linearGradient>
307|                    <clipPath id={m.topClip}>
308|                        <rect x="30" y="-25" width="130" height="23" />
309|                    </clipPath>
310|                    <path
311|                        id={m.blade}
312|                        d="M 40,0 A 4,4 0 0 1 43,-3 Q 95,-22 147,-3 A 4,4 0 0 1 150,0 A 4,4 0 0 1 147,3 Q 95,22 43,3 A 4,4 0 0 1 40,0 Z"
313|                    />
314|                </defs>
315|
316|                <Blades ids={m} />
317|            </svg>
318|        </span>
319|    );
320|}
321|