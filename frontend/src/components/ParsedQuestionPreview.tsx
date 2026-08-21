import React from 'react';
import { VisualContextProps } from '../types/visual';
import { VisualContentRenderer } from './VisualContentRenderer';

export const renderFormattedContent = (content: string) => {
  if (!content || !content.trim()) return null;

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (key: string) => {
    if (tableBuffer.length === 0) return;
    const rows = tableBuffer
      .filter((line) => !line.match(/^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)*\|?$/))
      .map((line) =>
        line
          .split('|')
          .map((cell) => cell.trim())
          .filter((cell, idx, arr) => !(idx === 0 && cell === '') && !(idx === arr.length - 1 && cell === ''))
      )
      .filter((row) => row.some(Boolean));

    tableBuffer = [];
    if (rows.length === 0) return;

    const header = rows[0];
    const rawBody = rows.slice(1);
    const numCols = header.length;
    const body: string[][] = [];

    rawBody.forEach((row) => {
      if (numCols > 1 && row.length === numCols) {
        const lastCell = row[row.length - 1];
        const tokens = lastCell.trim().split(/\s+/);
        if (tokens.length >= numCols) {
          const firstVal = tokens[0];
          const remTokens = tokens.slice(1);
          body.push([...row.slice(0, -1), firstVal]);
          for (let i = 0; i < remTokens.length; i += numCols) {
            body.push(remTokens.slice(i, i + numCols));
          }
          return;
        }
      }
      body.push(row);
    });

    blocks.push(
      <div key={key} className="parsed-preview-table-wrap">
        <table className="parsed-preview-table">
          <thead>
            <tr>{header.map((cell, idx) => <th key={idx}>{cell}</th>)}</tr>
          </thead>
          {body.length > 0 && (
            <tbody>
              {body.map((row, rowIdx) => (
                <tr key={rowIdx}>{row.map((cell, cellIdx) => <td key={cellIdx}>{cell}</td>)}</tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    );
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Universal image extraction: base64, markdown img, http URL, or graph tag
    let extractedImgUrl = '';
    const b64Match = trimmed.match(/data:image\/[a-zA-Z0-9+\-.]+;base64,[A-Za-z0-9+/=\s]+/i);
    if (b64Match) {
      extractedImgUrl = b64Match[0].trim();
    }
    if (!extractedImgUrl) {
      const mdImgMatch = trimmed.match(/!\[.*?\]\((.*?)\)/i);
      if (mdImgMatch && mdImgMatch[1]) {
        extractedImgUrl = mdImgMatch[1].trim();
      }
    }
    if (!extractedImgUrl) {
      const httpMatch = trimmed.match(/(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|svg|gif|webp))/i);
      if (httpMatch && httpMatch[1]) {
        extractedImgUrl = httpMatch[1].trim();
      }
    }
    if (!extractedImgUrl) {
      const graphTagMatch = trimmed.match(/\[Graph(?:\/Figure)?:\s*(.+?)\]/i);
      if (graphTagMatch && graphTagMatch[1]) {
        extractedImgUrl = graphTagMatch[1].trim();
      }
    }

    if (extractedImgUrl) {
      flushTable(`table-${idx}`);
      blocks.push(
        <div key={`img-${idx}`} className="parsed-preview-image-wrap" style={{ margin: '0.75rem 0', textAlign: 'center' }}>
          {extractedImgUrl.startsWith('http') || extractedImgUrl.startsWith('data:image') ? (
            <img src={extractedImgUrl} alt="Exam diagram/graph" className="parsed-preview-image" style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
          ) : (
            <div className="parsed-graph-placeholder" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: '#f8fafc', border: '1.5px dashed #94a3b8', borderRadius: '0.5rem', fontWeight: 600 }}>
              📊 Graph / Diagram: {extractedImgUrl}
            </div>
          )}
        </div>
      );
      return;
    }

    const isTableLine = trimmed.includes('|') && trimmed.split('|').length >= 3;
    if (isTableLine) {
      tableBuffer.push(line);
      return;
    }

    flushTable(`table-${idx}`);

    if (trimmed) {
      const dirMatch = trimmed.match(/^(Directions\s*(?:\([^)]+\))?\s*:?\s*)(.*)/i);
      if (dirMatch && dirMatch[1]) {
        const headerTitle = dirMatch[1].trim();
        const bodyContent = dirMatch[2] ? dirMatch[2].trim() : '';
        blocks.push(
          <div key={`dir-${idx}`} className="direction-header-block">
            <p className="parsed-preview-line direction-header-line">{headerTitle}</p>
            {bodyContent && <p className="parsed-preview-line passage-body-line">{bodyContent}</p>}
          </div>
        );
      } else {
        const isDirHeader = /^(?:Directions|Read the following|Consider the|Study the)/i.test(trimmed);
        blocks.push(
          <p key={`line-${idx}`} className={`parsed-preview-line ${isDirHeader ? 'direction-header-line' : ''}`}>
            {trimmed}
          </p>
        );
      }
    }
  });

  flushTable('table-end');
  return blocks;
};



interface ParsedQuestionPreviewProps extends VisualContextProps {
  question: string;
  context?: string;
  contextType?: string;
}

export const ParsedQuestionPreview: React.FC<ParsedQuestionPreviewProps> = ({
  question,
  context,
  contextType,
  chartData,
  tableData,
  imageReference,
  visualReferences,
  mappingStatus,
  mappingConfidence,
}) => {
  const cleanContext = context?.trim() || '';

  const getContextLabel = () => {
    if (contextType === 'table' || cleanContext.includes('|') || tableData) return '📊 SHARED DATA INTERPRETATION (TABLE)';
    if (cleanContext.toLowerCase().includes('pie chart') || cleanContext.toLowerCase().includes('donut')) return '🥧 SHARED PIE / DONUT CHART DI DATA';
    if (cleanContext.toLowerCase().includes('line graph') || cleanContext.toLowerCase().includes('line chart') || cleanContext.toLowerCase().includes('dual-line')) return '📈 SHARED LINE GRAPH DI DATA';
    if (contextType === 'graph' || cleanContext.toLowerCase().includes('bar graph') || cleanContext.toLowerCase().includes('horizontal bar') || cleanContext.includes('data:image')) return '📈 SHARED DIAGRAM / GRAPH DATA';
    if (cleanContext.toLowerCase().includes('passage') || cleanContext.toLowerCase().includes('read the following')) return '📖 SHARED PASSAGE / COMPREHENSION SET';
    return '📝 SHARED CONTEXT / DIRECTIONS';
  };

  return (
    <>
      {cleanContext && (
        <div className={`parsed-context-preview ${contextType ? `context-${contextType}` : ''}`}>
          <div className="parsed-context-label">{getContextLabel()}</div>
          <div className="parsed-context-body">
            {renderFormattedContent(cleanContext)}
          </div>
        </div>
      )}
      <VisualContentRenderer
        chartData={chartData}
        tableData={tableData}
        imageReference={imageReference}
        visualReferences={visualReferences}
        context={cleanContext}
        contextType={contextType}
        title={cleanContext ? cleanContext.split('\n')[0] : ''}
        mappingStatus={mappingStatus}
        mappingConfidence={mappingConfidence}
      />
      <div className="question-text prewrap">{renderFormattedContent(question)}</div>
    </>
  );
};
