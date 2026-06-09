1|"use client";
2|
3|import React, {
4|    createContext,
5|    useContext,
6|    useEffect,
7|    useState,
8|    ReactNode,
9|    useCallback,
10|} from "react";
11|import { useAuth } from "@/contexts/AuthContext";
12|import {
13|    type ApiKeyState,
14|    type ApiKeyProvider,
15|    type UserProfile as ApiUserProfile,
16|    getUserProfile,
17|    saveApiKey,
18|    updateUserProfile,
19|} from "@/app/lib/misuApi";
20|
21|interface UserProfile {
22|    displayName: string | null;
23|    organisation: string | null;
24|    messageCreditsUsed: number;
25|    creditsResetDate: string;
26|    creditsRemaining: number;
27|    tier: string;
28|    titleModel: string;
29|    tabularModel: string;
30|    apiKeys: ApiKeyState;
31|}
32|
33|interface UserProfileContextType {
34|    profile: UserProfile | null;
35|    loading: boolean;
36|    updateDisplayName: (name: string) => Promise<boolean>;
37|    updateOrganisation: (organisation: string) => Promise<boolean>;
38|    updateModelPreference: (
39|        field: "titleModel" | "tabularModel",
40|        value: string,
41|    ) => Promise<boolean>;
42|    updateApiKey: (
43|        provider: ApiKeyProvider,
44|        value: string | null,
45|    ) => Promise<boolean>;
46|    reloadProfile: () => Promise<void>;
47|    incrementMessageCredits: () => Promise<boolean>;
48|}
49|
50|const UserProfileContext = createContext<UserProfileContextType | undefined>(
51|    undefined,
52|);
53|
54|const API_KEY_PROVIDERS: ApiKeyProvider[] = [
55|    "claude",
56|    "gemini",
57|    "openai",
58|    "openrouter",
59|    "courtlistener",
60|];
61|
62|function emptyApiKeys(): ApiKeyState {
63|    return {
64|        claude: { configured: false, source: null },
65|        gemini: { configured: false, source: null },
66|        openai: { configured: false, source: null },
67|        openrouter: { configured: false, source: null },
68|        courtlistener: { configured: false, source: null },
69|    };
70|}
71|
72|function toProfile(data: ApiUserProfile): UserProfile {
73|    const { apiKeyStatus, ...profile } = data;
74|    const apiKeys = emptyApiKeys();
75|    for (const provider of API_KEY_PROVIDERS) {
76|        apiKeys[provider] = {
77|            configured: !!apiKeyStatus[provider],
78|            source:
79|                apiKeyStatus.sources?.[provider] ??
80|                (apiKeyStatus[provider] ? "user" : null),
81|        };
82|    }
83|
84|    return {
85|        ...profile,
86|        apiKeys,
87|    };
88|}
89|
90|export function UserProfileProvider({ children }: { children: ReactNode }) {
91|    const { user, isAuthenticated } = useAuth();
92|    const [profile, setProfile] = useState<UserProfile | null>(null);
93|    const [loading, setLoading] = useState(true);
94|
95|    const loadProfile = useCallback(async () => {
96|        try {
97|            const profileData = await getUserProfile();
98|            setProfile(toProfile(profileData));
99|        } catch {
100|            // Calculate a default future reset date for fallback
101|            const futureResetDate = new Date();
102|            futureResetDate.setDate(futureResetDate.getDate() + 30);
103|
104|            // Set fallback profile data on exception
105|            setProfile({
106|                displayName: null,
107|                organisation: null,
108|                messageCreditsUsed: 0,
109|                creditsResetDate: futureResetDate.toISOString(),
110|                creditsRemaining: 999999, // temporarily unlimited
111|                tier: "Free",
112|                titleModel: "gemini-3.1-flash-lite-preview",
113|                tabularModel: "gemini-3-flash-preview",
114|                apiKeys: emptyApiKeys(),
115|            });
116|        } finally {
117|            setLoading(false);
118|        }
119|    }, []);
120|
121|    useEffect(() => {
122|        if (isAuthenticated && user) {
123|            setLoading(true);
124|            loadProfile();
125|        } else {
126|            setProfile(null);
127|            setLoading(false);
128|        }
129|    }, [isAuthenticated, user, loadProfile]);
130|
131|    const updateDisplayName = useCallback(
132|        async (displayName: string): Promise<boolean> => {
133|            if (!user) {
134|                return false;
135|            }
136|
137|            try {
138|                const updated = await updateUserProfile({ displayName });
139|                setProfile((prev) =>
140|                    prev ? { ...prev, ...toProfile(updated) } : null,
141|                );
142|                return true;
143|            } catch {
144|                return false;
145|            }
146|        },
147|        [user],
148|    );
149|
150|    const updateOrganisation = useCallback(
151|        async (organisation: string): Promise<boolean> => {
152|            if (!user) return false;
153|            try {
154|                const updated = await updateUserProfile({ organisation });
155|                setProfile((prev) =>
156|                    prev ? { ...prev, ...toProfile(updated) } : null,
157|                );
158|                return true;
159|            } catch {
160|                return false;
161|            }
162|        },
163|        [user],
164|    );
165|
166|    const updateModelPreference = useCallback(
167|        async (
168|            field: "titleModel" | "tabularModel",
169|            value: string,
170|        ): Promise<boolean> => {
171|            if (!user) return false;
172|            try {
173|                const updated = await updateUserProfile({
174|                    [field]: value,
175|                });
176|                setProfile((prev) =>
177|                    prev ? { ...prev, ...toProfile(updated) } : null,
178|                );
179|                return true;
180|            } catch {
181|                return false;
182|            }
183|        },
184|        [user],
185|    );
186|
187|    const updateApiKey = useCallback(
188|        async (
189|            provider: ApiKeyProvider,
190|            value: string | null,
191|        ): Promise<boolean> => {
192|            if (!user) return false;
193|            const normalized = value?.trim() ? value.trim() : null;
194|            try {
195|                await saveApiKey(provider, normalized);
196|                setProfile((prev) =>
197|                    prev
198|                        ? {
199|                              ...prev,
200|                              apiKeys: {
201|                                  ...prev.apiKeys,
202|                                  [provider]: {
203|                                      configured: !!normalized,
204|                                      source: normalized ? "user" : null,
205|                                  },
206|                              },
207|                          }
208|                        : null,
209|                );
210|                return true;
211|            } catch {
212|                return false;
213|            }
214|        },
215|        [user],
216|    );
217|
218|    const reloadProfile = useCallback(async () => {
219|        if (user) {
220|            await loadProfile();
221|        }
222|    }, [user, loadProfile]);
223|
224|    const incrementMessageCredits = useCallback(async (): Promise<boolean> => {
225|        if (!user || !profile) {
226|            return false;
227|        }
228|
229|        // Check if user has credits remaining
230|        if (profile.creditsRemaining <= 0) {
231|            return false;
232|        }
233|
234|        return false;
235|    }, [user, profile]);
236|
237|    return (
238|        <UserProfileContext.Provider
239|            value={{
240|                profile,
241|                loading,
242|                updateDisplayName,
243|                updateOrganisation,
244|                updateModelPreference,
245|                updateApiKey,
246|                reloadProfile,
247|                incrementMessageCredits,
248|            }}
249|        >
250|            {children}
251|        </UserProfileContext.Provider>
252|    );
253|}
254|
255|export function useUserProfile() {
256|    const context = useContext(UserProfileContext);
257|    if (context === undefined) {
258|        throw new Error(
259|            "useUserProfile must be used within a UserProfileProvider",
260|        );
261|    }
262|    return context;
263|}
264|