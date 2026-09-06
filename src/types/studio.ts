export type StudioIntake = {
  garmentType: string;
  garmentLabel: string;
  storyText: string;
  aestheticText?: string;
  themes: string[];
  colors: string[];
  placement?: string;
  occasion?: string;
  budgetTierCents?: number;
  referenceImageNotes?: string[];
};

export type CreativeDirectionOutput = {
  title: string;
  narrative: string;
  colorPalette: string[];
  themes: string[];
  placement: string;
};

export type CreativeDirectorOutput = {
  directions: CreativeDirectionOutput[];
};

export type DesignSpec = {
  silhouetteNotes: string;
  motifs: string[];
  placementDetail: string;
  colorNotes: string;
  materialNotes: string;
  requiredElements: string[];
  elementsToAvoid: string[];
};

export type FeasibilityAssessment = {
  summary: string;
  considerations: string[];
  suggestedAdjustments: string[];
};
