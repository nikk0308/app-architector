import type { ArchitectureSpec, ArtifactManifest, GenerationMetadata, GenerationPlan, NormalizedProfile, QuestionnaireAnswers, QuestionnaireSection, ValidationReport, TreeNode } from "@mag/shared";
export interface PreviewResponse {
    profile: NormalizedProfile;
    spec: ArchitectureSpec;
    manifest: ArtifactManifest;
    validation: {
        spec: ValidationReport;
        manifest: ValidationReport;
    };
    plan: GenerationPlan;
    fileTree: TreeNode[];
    notes: string[];
}
export interface GenerationResponse extends PreviewResponse {
    generationId: string;
    zipPath: string;
}
export declare function fetchQuestionnaire(): Promise<QuestionnaireSection[]>;
export declare function previewProfile(payload: QuestionnaireAnswers): Promise<PreviewResponse>;
export declare function createGeneration(payload: QuestionnaireAnswers): Promise<GenerationResponse>;
export declare function listGenerations(): Promise<GenerationMetadata[]>;
