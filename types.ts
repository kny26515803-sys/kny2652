
export enum AppStep {
  INPUT = 'input',
  RESEARCH = 'research',
  SCRIPT = 'script',
  IMAGES = 'images',
  METADATA = 'metadata',
  THUMBNAIL = 'thumbnail'
}

export enum ScriptLength {
  SHORT = 'SHORT', // 4000
  MEDIUM = 'MEDIUM', // 8000
  LONG = 'LONG' // 12000
}

export interface ResearchData {
  report: string;
  sources: { title: string; uri: string }[];
}

export interface ParagraphItem {
  id: number;
  content: string;
  imagePrompt: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

export interface ScriptData {
  rawScript: string;
  ttsScript: string;
  paragraphs: ParagraphItem[];
}

export interface MetadataResults {
  youtubeDescription: string;
  summary4Lines: string;
  hashtags: string[];
  seoKeywords: string[];
  pinnedComment: string;
}

export interface ThumbnailData {
  pureImageUrl?: string;
  mockupImageUrl?: string;
  copySuggestions: {
    type1: string[];
    type2: string[];
  };
}

export interface AppState {
  currentStep: AppStep;
  topic: string;
  length: ScriptLength;
  research?: ResearchData;
  script?: ScriptData;
  metadata?: MetadataResults;
  thumbnail?: ThumbnailData;
  isProcessing: boolean;
}
