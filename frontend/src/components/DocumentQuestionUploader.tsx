import React, { useState } from 'react';
import { apiPostForm } from '../services/api';
import { ParserPreviewModal, ParsedQuestion, ParseStats } from './ParserPreviewModal';

interface Section {
  id: string;
  name: string;
}

interface Question {
  id: string;
  type: 'mcq' | 'multiple' | 'text';
  question: string;
  options?: string[];
  correctAnswer?: string | string[];
  section: string;
  marks: number;
  negativeMarks?: number;
  chartData?: any;
  tableData?: any;
  validationStatus?: 'passed' | 'failed';
  validationError?: string;
}

interface DocumentQuestionUploaderProps {
  onParsed: (data: { sections: Section[]; questions: Question[] }, mode: 'append' | 'replace') => void;
}

export const DocumentQuestionUploader: React.FC<DocumentQuestionUploaderProps> = ({ onParsed }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'append' | 'replace'>('append');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewData, setPreviewData] = useState<{
    filename: string;
    sections: Section[];
    questions: ParsedQuestion[];
    stats: ParseStats;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setStatusMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setStatusMessage(null);
    }
  };

  const handleParse = async () => {
    if (!selectedFile) {
      setStatusMessage({ type: 'error', text: 'Please select a document file to upload.' });
      return;
    }

    try {
      setIsUploading(true);
      setStatusMessage(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await apiPostForm<{
        success: boolean;
        filename: string;
        sections: Section[];
        questions: ParsedQuestion[];
        totalParsed: number;
        stats: ParseStats;
      }>('/admin/exams/parse-document', formData);

      if (res.success && res.questions && res.questions.length > 0) {
        const defaultStats: ParseStats = res.stats || {
          totalQuestions: res.totalParsed,
          textQuestions: res.questions.filter((q) => !q.chartData && !q.tableData).length,
          chartQuestions: res.questions.filter((q) => !!q.chartData).length,
          tableQuestions: res.questions.filter((q) => !!q.tableData).length,
          passageBased: 0,
          imagesCount: 0,
          validationPassed: res.questions.filter((q) => q.validationStatus === 'passed').length,
          needsReview: res.questions.filter((q) => q.validationStatus === 'failed').length,
        };

        setPreviewData({
          filename: res.filename || selectedFile.name,
          sections: res.sections || [],
          questions: res.questions,
          stats: defaultStats,
        });

        setStatusMessage({
          type: 'success',
          text: `🎉 Successfully parsed ${res.totalParsed} questions across ${res.sections.length} sections! Review details in the modal preview below.`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'No questions could be extracted from the document. Ensure questions have options and correct answers.',
        });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to process document. Please check the file format.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleModalApprove = (approvedQuestions: ParsedQuestion[]) => {
    if (previewData) {
      onParsed(
        {
          sections: previewData.sections,
          questions: approvedQuestions as Question[],
        },
        uploadMode
      );
      setPreviewData(null);
    }
  };

  return (
    <div className="doc-uploader-card">
      <div className="doc-uploader-header">
        <div className="doc-uploader-icon">📄</div>
        <div>
          <span className="doc-uploader-badge">AI MULTIMODAL PARSER</span>
          <h4>Upload Questions & Answers Document / Diagrams</h4>
          <p>
            Upload a document or image file (PDF, Word DOCX, PNG, JPG, WEBP, TXT, Excel XLSX/CSV or JSON). Bar graphs, line graphs, pie charts, tables, questions, options, and answer keys will be parsed automatically!
          </p>
        </div>
      </div>

      <div
        className={`doc-upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="doc-upload-input"
          accept=".pdf,.docx,.txt,.csv,.xlsx,.xls,.json,.png,.jpg,.jpeg,.webp,.svg,.gif"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div className="doc-upload-controls">
          <label htmlFor="doc-upload-input" className="choose-file-btn">
            📂 {selectedFile ? 'Change File' : 'Choose Document / Image'}
          </label>

          <div className="file-info-badge">
            {selectedFile ? (
              <span>
                <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            ) : (
              <span className="file-placeholder">No file selected (PDF, DOCX, PNG, JPG, WEBP, TXT, CSV, XLSX, JSON)</span>
            )}
          </div>
        </div>

        <div className="doc-uploader-actions">
          <div className="mode-selector">
            <label className="mode-radio">
              <input
                type="radio"
                name="uploadMode"
                value="append"
                checked={uploadMode === 'append'}
                onChange={() => setUploadMode('append')}
              />
              <span>Add to existing</span>
            </label>
            <label className="mode-radio">
              <input
                type="radio"
                name="uploadMode"
                value="replace"
                checked={uploadMode === 'replace'}
                onChange={() => setUploadMode('replace')}
              />
              <span>Replace existing</span>
            </label>
          </div>

          <button
            type="button"
            className="primary-btn parse-btn"
            onClick={handleParse}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? '⚡ Running Multimodal Parser…' : '✨ Parse Document & Preview'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`doc-parse-status ${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}

      {previewData && (
        <ParserPreviewModal
          filename={previewData.filename}
          sections={previewData.sections}
          questions={previewData.questions}
          stats={previewData.stats}
          onApprove={handleModalApprove}
          onClose={() => setPreviewData(null)}
        />
      )}
    </div>
  );
};
