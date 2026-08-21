// Shared Visual Context types for Shine Exam frontend components

export interface VisualContextProps {
  chartData?: any;
  tableData?: any;
  imageReference?: string;
  visualReferences?: any[];
  groupId?: string;
  sharedContentId?: string;
  questionRange?: { start: number; end: number };
  sharedContent?: {
    id?: string;
    type?: string;
    title?: string;
    directions?: string;
    asset?: { type?: string; url?: string };
    questionRange?: { start: number; end: number };
  };
  visualId?: string;
  visualIds?: string[];
  mappingStatus?: string;
  mappingConfidence?: string;
}

export interface SharedParsedQuestion extends VisualContextProps {
  id: string;
  questionNumber?: number;
  type: 'mcq' | 'multiple' | 'text';
  question: string;
  context?: string;
  contextType?: 'table' | 'passage' | 'graph' | '';
  options?: string[];
  correctAnswer?: string | string[];
  section: string;
  marks: number;
  negativeMarks?: number;
  validationStatus?: 'passed' | 'failed';
  validationError?: string;
}
