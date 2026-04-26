import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { createGeneration, fetchQuestionnaire, listGenerations, previewProfile } from "./api";
const initialForm = {
    projectName: "",
    appDisplayName: "",
    profile: "ios",
    generationMode: "baseline",
    packageId: "",
    architectureStyle: "",
    stateManagement: "",
    navigationStyle: "",
    environmentMode: "single",
    hasAuth: false,
    hasAnalytics: false,
    hasLocalization: false,
    hasPush: false,
    hasNetworking: true,
    hasPersistence: false,
    includeExampleScreen: true,
    includeLLMNotes: false
};
function fieldValue(form, key) {
    const value = form[key];
    return typeof value === "undefined" ? "" : value;
}
function downloadUrlForGeneration(generationId) {
    const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
    return `${apiBase}/api/generations/${generationId}/download`;
}
export default function App() {
    const [sections, setSections] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [preview, setPreview] = useState(null);
    const [generations, setGenerations] = useState([]);
    const [createdGeneration, setCreatedGeneration] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [loadingGenerate, setLoadingGenerate] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        fetchQuestionnaire().then(setSections).catch((err) => setError(err.message));
        listGenerations().then(setGenerations).catch((err) => setError(err.message));
    }, []);
    const selectedModeIsBaseline = useMemo(() => (form.generationMode ?? "baseline") === "baseline", [form.generationMode]);
    function updateField(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }
    async function handlePreview() {
        try {
            setLoadingPreview(true);
            setError(null);
            const result = await previewProfile(form);
            setPreview(result);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Preview failed");
        }
        finally {
            setLoadingPreview(false);
        }
    }
    async function handleGenerate() {
        try {
            setLoadingGenerate(true);
            setError(null);
            const result = await createGeneration(form);
            setCreatedGeneration(result);
            setPreview(result);
            setGenerations(await listGenerations());
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Generation failed");
        }
        finally {
            setLoadingGenerate(false);
        }
    }
    return (_jsxs("div", { className: "shell", children: [_jsxs("header", { className: "hero", children: [_jsxs("div", { children: [_jsx("h1", { children: "Mobile App Architect" }), _jsx("p", { children: "Phase 1\u20132 build: canonical spec, manifest, validation and deterministic baseline archive generation." })] }), _jsx("div", { className: "hero-badge", children: "baseline engine" })] }), error ? _jsx("div", { className: "error-banner", children: error }) : null, !selectedModeIsBaseline ? (_jsx("div", { className: "warning-banner", children: "\u041E\u0431\u0440\u0430\u043D\u0438\u0439 \u0440\u0435\u0436\u0438\u043C \u0443\u0436\u0435 \u0454 \u0432 \u0434\u043E\u043C\u0435\u043D\u043D\u0456\u0439 \u043C\u043E\u0434\u0435\u043B\u0456, \u0430\u043B\u0435 \u043F\u043E\u0442\u043E\u0447\u043D\u0430 \u0437\u0431\u0456\u0440\u043A\u0430 \u0432\u0441\u0435 \u0449\u0435 \u0433\u0435\u043D\u0435\u0440\u0443\u0454 baseline-\u0448\u0430\u0431\u043B\u043E\u043D\u0438." })) : null, _jsxs("main", { className: "layout", children: [_jsxs("section", { className: "panel form-panel", children: [_jsxs("div", { className: "panel-header", children: [_jsx("h2", { children: "Questionnaire" }), _jsx("p", { children: "\u0417\u0430\u043F\u043E\u0432\u043D\u0438 \u0431\u0430\u0437\u043E\u0432\u0456 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0438, \u0430\u0440\u0445\u0456\u0442\u0435\u043A\u0442\u0443\u0440\u0443 \u0442\u0430 \u043C\u043E\u0434\u0443\u043B\u0456." })] }), sections.map((section) => (_jsxs("div", { className: "section-block", children: [_jsx("h3", { children: section.title }), _jsx("p", { children: section.description }), _jsx("div", { className: "field-grid", children: section.fields.map((field) => (_jsxs("label", { className: "field", children: [_jsx("span", { children: field.label }), field.type === "select" ? (_jsxs("select", { value: String(fieldValue(form, field.key)), onChange: (event) => updateField(field.key, event.target.value), children: [_jsx("option", { value: "", children: "Auto" }), field.options?.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value)))] })) : field.type === "boolean" ? (_jsx("input", { type: "checkbox", checked: Boolean(fieldValue(form, field.key)), onChange: (event) => updateField(field.key, event.target.checked) })) : (_jsx("input", { type: "text", value: String(fieldValue(form, field.key)), onChange: (event) => updateField(field.key, event.target.value), placeholder: field.help })), _jsx("small", { children: field.help })] }, field.key))) })] }, section.id))), _jsxs("div", { className: "actions", children: [_jsx("button", { onClick: handlePreview, disabled: loadingPreview || loadingGenerate, children: loadingPreview ? "Loading preview..." : "Preview spec" }), _jsx("button", { className: "primary", onClick: handleGenerate, disabled: loadingGenerate || loadingPreview, children: loadingGenerate ? "Generating..." : "Generate archive" })] })] }), _jsxs("section", { className: "panel preview-panel", children: [_jsxs("div", { className: "panel-header", children: [_jsx("h2", { children: "Preview" }), _jsx("p", { children: "Spec, manifest, validation and file tree." })] }), preview ? (_jsxs("div", { className: "preview-stack", children: [_jsxs("div", { className: "card", children: [_jsx("h3", { children: "Normalized profile" }), _jsx("pre", { children: JSON.stringify(preview.profile, null, 2) })] }), _jsxs("div", { className: "card", children: [_jsx("h3", { children: "Architecture spec" }), _jsx("pre", { children: JSON.stringify(preview.spec, null, 2) })] }), _jsxs("div", { className: "card", children: [_jsx("h3", { children: "Artifact manifest" }), _jsx("pre", { children: JSON.stringify(preview.manifest, null, 2) })] }), _jsxs("div", { className: "card", children: [_jsx("h3", { children: "Validation" }), _jsx("pre", { children: JSON.stringify(preview.validation, null, 2) })] }), _jsxs("div", { className: "card", children: [_jsx("h3", { children: "Tree preview" }), _jsx("ul", { className: "tree-list", children: preview.fileTree.map((node) => (_jsx("li", { children: node.path }, node.path))) })] })] })) : (_jsx("div", { className: "empty-state", children: "\u041F\u043E\u043A\u0438 \u0449\u043E \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435\u043C\u0430\u0454. \u041D\u0430\u0442\u0438\u0441\u043D\u0438 Preview spec." }))] })] }), _jsxs("section", { className: "panel history-panel", children: [_jsxs("div", { className: "panel-header", children: [_jsx("h2", { children: "Generations" }), _jsx("p", { children: "\u041E\u0441\u0442\u0430\u043D\u043D\u0456 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u0456 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0456\u0457 \u0437 SQLite." })] }), createdGeneration ? (_jsxs("div", { className: "download-banner", children: [_jsx("strong", { children: "\u041E\u0441\u0442\u0430\u043D\u043D\u0456\u0439 \u0430\u0440\u0445\u0456\u0432 \u0433\u043E\u0442\u043E\u0432\u0438\u0439." }), _jsx("a", { href: downloadUrlForGeneration(createdGeneration.generationId), children: "\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 ZIP" })] })) : null, _jsxs("div", { className: "history-list", children: [generations.map((item) => (_jsxs("article", { className: "history-card", children: [_jsxs("div", { children: [_jsx("strong", { children: item.projectName }), _jsxs("div", { children: [item.profile, " \u00B7 ", item.generationMode ?? "baseline"] }), _jsx("div", { children: item.status })] }), _jsx("a", { href: downloadUrlForGeneration(item.id), children: "ZIP" })] }, item.id))), generations.length === 0 ? _jsx("div", { className: "empty-state", children: "\u0406\u0441\u0442\u043E\u0440\u0456\u044F \u043F\u043E\u043A\u0438 \u043F\u043E\u0440\u043E\u0436\u043D\u044F." }) : null] })] })] }));
}
//# sourceMappingURL=App.js.map