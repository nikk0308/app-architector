const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
async function request(input, init) {
    const response = await fetch(input, init);
    if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(payload.error ?? "Request failed");
    }
    return (await response.json());
}
export async function fetchQuestionnaire() {
    const response = await request(`${API_BASE}/api/questionnaire`);
    return response.sections;
}
export async function previewProfile(payload) {
    return request(`${API_BASE}/api/profile/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}
export async function createGeneration(payload) {
    return request(`${API_BASE}/api/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}
export async function listGenerations() {
    const response = await request(`${API_BASE}/api/generations`);
    return response.items;
}
//# sourceMappingURL=api.js.map