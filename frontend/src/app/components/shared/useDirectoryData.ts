1|"use client";
2|
3|import { useEffect, useState } from "react";
4|import { getProject, listProjects, listStandaloneDocuments } from "@/app/lib/misuApi";
5|import type { Document, Project } from "./types";
6|
7|const CACHE_TTL_MS = 30_000;
8|
9|interface DirectoryCache {
10|    standaloneDocuments: Document[];
11|    projects: Project[];
12|    fetchedAt: number;
13|}
14|
15|let cache: DirectoryCache | null = null;
16|
17|export function invalidateDirectoryCache() {
18|    cache = null;
19|}
20|
21|export function useDirectoryData(enabled: boolean) {
22|    const [loading, setLoading] = useState(true);
23|    const [standaloneDocuments, setStandaloneDocuments] = useState<Document[]>([]);
24|    const [projects, setProjects] = useState<Project[]>([]);
25|
26|    useEffect(() => {
27|        if (!enabled) return;
28|
29|        const now = Date.now();
30|        if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
31|            setStandaloneDocuments(cache.standaloneDocuments);
32|            setProjects(cache.projects);
33|            setLoading(false);
34|            return;
35|        }
36|
37|        setLoading(true);
38|        Promise.all([listProjects(), listStandaloneDocuments()])
39|            .then(([ps, ds]) => {
40|                const sorted = [...ds].sort((a, b) =>
41|                    (b.created_at ?? "").localeCompare(a.created_at ?? ""),
42|                );
43|                return Promise.all(ps.map((p) => getProject(p.id))).then(
44|                    (fullProjects) => {
45|                        cache = {
46|                            standaloneDocuments: sorted,
47|                            projects: fullProjects,
48|                            fetchedAt: Date.now(),
49|                        };
50|                        setStandaloneDocuments(sorted);
51|                        setProjects(fullProjects);
52|                    },
53|                );
54|            })
55|            .catch(() => {
56|                setStandaloneDocuments([]);
57|                setProjects([]);
58|            })
59|            .finally(() => setLoading(false));
60|    }, [enabled]);
61|
62|    return { loading, standaloneDocuments, projects };
63|}
64|