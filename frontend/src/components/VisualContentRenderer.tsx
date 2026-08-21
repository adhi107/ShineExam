import React, { useState } from 'react';
import { VisualChartRenderer, ChartData } from './VisualChartRenderer';
import './VisualChartRenderer.css';

export interface VisualAsset {
  visualId?: string;
  type?: string;
  url?: string;
  image?: {
    storageUrl?: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
  };
  displayMode?: string;
  structuredData?: any;
}

interface VisualContentRendererProps {
  visualReferences?: VisualAsset[];
  imageReference?: string;
  chartData?: ChartData;
  tableData?: any;
  context?: string;
  contextType?: string;
  title?: string;
  mappingStatus?: string;
  mappingConfidence?: string;
}

const extractEntityTokens = (text?: string): string[] => {
  if (!text) return [];
  const raw = text.match(/\b[A-Z][a-z0-9]+\b|\b20\d{2}\b|\b19\d{2}\b|\b(?:deposits|cards|loans|savings|current|retail|corporate|msme|agri|education|vehicle|housing|digital|branch|april|may|june|july|august|september|october|november|december|january|february|march)\b/gi) || [];
  const stopWords = new Set(['The', 'What', 'Which', 'Total', 'Difference', 'Ratio', 'Average', 'Percentage', 'Number', 'Opened', 'Closed', 'Given', 'Study', 'Read', 'Following', 'Answer', 'Question', 'Chart', 'Graph', 'Table']);
  return Array.from(new Set(raw.map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).filter(t => !stopWords.has(t) && t.length > 1)));
};

const checkSemanticMatch = (text?: string, chartData?: ChartData): { match: boolean; reason?: string } => {
  if (!chartData || !text) return { match: true };

  const qEntities = new Set(extractEntityTokens(text));
  if (qEntities.size === 0) return { match: true };

  const chartCats = new Set((chartData.categories || []).map(c => String(c).charAt(0).toUpperCase() + String(c).slice(1).toLowerCase()));
  if (chartCats.size === 0) return { match: true };

  const bankingEntities = new Set(['Deposits', 'Cards', 'Loans', 'Savings', 'Current', 'Investments', 'Transfers', 'Retail', 'Corporate', 'MSME', 'Agri', 'Education', 'Vehicle']);
  const monthEntities = new Set(['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);

  const qHasBanking = Array.from(qEntities).some(e => bankingEntities.has(e));
  const qHasMonths = Array.from(qEntities).some(e => monthEntities.has(e));

  const chartHasBanking = Array.from(chartCats).some(c => bankingEntities.has(c));
  const chartHasMonths = Array.from(chartCats).some(c => monthEntities.has(c));

  // Conflict 1: Question mentions Banking Products (Deposits, Cards) but Chart categories are Months (April, May, June)
  if (qHasBanking && !qHasMonths && chartHasMonths && !chartHasBanking) {
    return { match: false, reason: 'Question references banking entities (Deposits, Cards), but candidate chart categories are months (April, May, June).' };
  }

  // Conflict 2: Question mentions Months but Chart categories are Banking Products
  if (qHasMonths && !qHasBanking && chartHasBanking && !chartHasMonths) {
    return { match: false, reason: 'Question references months, but candidate chart categories are banking products.' };
  }

  return { match: true };
};

export const VisualContentRenderer: React.FC<VisualContentRendererProps> = ({
  visualReferences,
  imageReference,
  chartData,
  tableData,
  context,
  contextType,
  title,
  mappingStatus,
  mappingConfidence,
}) => {
  const [imageError, setImageError] = useState(false);

  // 1. Resolve primary image asset URL
  const primaryVisual = visualReferences && visualReferences.length > 0 ? visualReferences[0] : null;
  const assetUrl =
    imageReference ||
    primaryVisual?.url ||
    primaryVisual?.image?.storageUrl ||
    (chartData as any)?.imageReference ||
    '';

  // 2. Resolve chart data (ONLY use real extracted chart data; NO synthetic fallback charts)
  const candidateChart: ChartData | undefined = chartData || primaryVisual?.structuredData || undefined;
  const hasValidChart = Boolean(
    candidateChart &&
    candidateChart.series &&
    candidateChart.series.length > 0 &&
    candidateChart.series.some(s => Array.isArray(s.values) && s.values.length > 0 && s.values.some(v => v !== 0))
  );
  const resolvedChartData: ChartData | undefined = hasValidChart ? candidateChart : undefined;

  // 3. Semantic content validation
  const semanticCheck = resolvedChartData ? checkSemanticMatch(context, resolvedChartData) : { match: true };
  const isMappingFailed = Boolean(resolvedChartData && (mappingStatus === 'FAILED' || !semanticCheck.match));

  const isImageAlreadyInContext = Boolean(assetUrl && context && (context.includes(assetUrl) || (assetUrl.length > 50 && context.includes(assetUrl.slice(0, 50)))));

  // If there is no asset image, no valid chart data, and no table data, do not render an empty card
  if (!assetUrl && !resolvedChartData && !tableData) {
    return null;
  }

  return (
    <div className="visual-content-renderer-card" style={{ margin: '0.5rem 0 1rem 0' }}>
      {/* Semantic Mismatch Warning Banner */}
      {isMappingFailed && (
        <div className="visual-mapping-review-banner" style={{ padding: '0.85rem 1.1rem', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '0.6rem', color: '#d46b08', fontSize: '0.88rem', marginBottom: '0.75rem' }}>
          ⚠️ <strong>Visual mapping requires review.</strong>
          <div style={{ fontSize: '0.82rem', marginTop: '0.25rem', color: '#ad4e00' }}>
            {semanticCheck.reason || 'Candidate visual content does not semantically match question entities.'}
          </div>
        </div>
      )}

      {/* Primary Visual Image Asset Rendering (Original Document Snapshot) */}
      {assetUrl && !isImageAlreadyInContext && !imageError ? (
        <div className="visual-original-snapshot" style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
          <img
            src={assetUrl}
            alt="Original Exam Visual Asset"
            className="visual-snapshot-img"
            style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            onError={() => {
              console.error(`Visual asset image failed to load from URL: ${assetUrl}`);
              setImageError(true);
            }}
          />
        </div>
      ) : assetUrl && imageError ? (
        <div className="visual-load-fallback" style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', color: '#991b1b', fontSize: '0.85rem', margin: '0.5rem 0' }}>
          ⚠️ Visual content could not be loaded from source URL: <code style={{ fontSize: '0.78rem' }}>{assetUrl.slice(0, 60)}...</code>
        </div>
      ) : null}

      {/* Validated Interactive Chart Model Rendering */}
      {resolvedChartData && !isMappingFailed && (
        <VisualChartRenderer
          chartData={resolvedChartData}
          imageReference={assetUrl && !imageError ? assetUrl : undefined}
          contextType={contextType}
          title={title}
        />
      )}
    </div>
  );
};
