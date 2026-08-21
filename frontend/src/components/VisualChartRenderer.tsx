import React from 'react';
import './VisualChartRenderer.css';

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartData {
  visual_type?: string;
  title?: string;
  x_categories?: string[];
  categories?: string[];
  series?: ChartSeries[];
  values?: number[];
  unit?: string;
  confidence?: number;
  imageReference?: string;
}

interface VisualChartRendererProps {
  chartData?: ChartData;
  imageReference?: string;
  contextType?: string;
  title?: string;
}

export const VisualChartRenderer: React.FC<VisualChartRendererProps> = ({
  chartData,
  imageReference,
  contextType,
  title,
}) => {
  const chartType = chartData?.visual_type || 'bar_chart';
  const categories = chartData?.categories || chartData?.x_categories || ['A', 'B', 'C', 'D', 'E'];
  const series = chartData?.series && chartData.series.length > 0
    ? chartData.series
    : [{ name: 'Values', values: chartData?.values || [100, 200, 150, 300, 250] }];
  const unit = chartData?.unit || '';
  const isDirectionHeader = (text?: string) =>
    !text || /^(?:Directions|Read|Study|Consider|Questions|\(?Q\d+)/i.test(text.trim());

  const rawTitle = chartData?.title || title || '';
  const cleanTitle = !isDirectionHeader(rawTitle) ? rawTitle : '';
  const imgUrl = imageReference || chartData?.imageReference || '';

  // Palette colors for bars, pie slices, line series
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

  const maxVal = Math.max(
    1,
    ...series.flatMap((s) => s.values.map((v) => (isNaN(v) ? 0 : v)))
  );

  const renderClusteredBarChart = () => {
    const width = 560;
    const height = 240;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    const groupWidth = graphWidth / categories.length;
    const numSeries = series.length;
    const barWidth = Math.max(6, Math.min(28, (groupWidth - 16) / numSeries));

    return (
      <svg className="visual-svg-chart" viewBox={`0 0 ${width} ${height}`}>
        {/* Y-axis gridlines & labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const val = Math.round(maxVal * (1 - pct));
          const y = padding + graphHeight * pct;
          return (
            <g key={i}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={padding - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {val}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {categories.map((cat, catIdx) => {
          const groupX = padding + catIdx * groupWidth + 8;
          return (
            <g key={catIdx}>
              {series.map((s, sIdx) => {
                const val = s.values[catIdx] || 0;
                const h = (val / maxVal) * graphHeight;
                const x = groupX + sIdx * barWidth;
                const y = padding + graphHeight - h;
                const color = COLORS[sIdx % COLORS.length];

                return (
                  <g key={sIdx} className="bar-hover-group">
                    <rect
                      x={x}
                      y={y}
                      width={barWidth - 2}
                      height={h}
                      fill={color}
                      rx="3"
                      className="bar-rect"
                    />
                    <text
                      x={x + (barWidth - 2) / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="#1e293b"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Category label */}
              <text
                x={groupX + (numSeries * barWidth) / 2}
                y={height - 12}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
                fill="#334155"
              >
                {cat}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const renderLineChart = () => {
    const width = 560;
    const height = 240;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    const stepX = graphWidth / Math.max(1, categories.length - 1);

    return (
      <svg className="visual-svg-chart" viewBox={`0 0 ${width} ${height}`}>
        {/* Y Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const val = Math.round(maxVal * (1 - pct));
          const y = padding + graphHeight * pct;
          return (
            <g key={i}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={padding - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {val}
              </text>
            </g>
          );
        })}

        {/* X Category labels */}
        {categories.map((cat, idx) => (
          <text
            key={idx}
            x={padding + idx * stepX}
            y={height - 12}
            textAnchor="middle"
            fontSize="11"
            fill="#334155"
          >
            {cat}
          </text>
        ))}

        {/* Series Lines & Points */}
        {series.map((s, sIdx) => {
          const points = s.values.map((val, idx) => {
            const x = padding + idx * stepX;
            const y = padding + graphHeight - (val / maxVal) * graphHeight;
            return { x, y, val };
          });

          const pathD = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
            .join(' ');

          const color = COLORS[sIdx % COLORS.length];

          return (
            <g key={sIdx}>
              <path d={pathD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke={color} strokeWidth="3" />
                  <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1e293b">
                    {p.val}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    );
  };

  const renderPieChart = () => {
    const width = 360;
    const height = 240;
    const cx = 130;
    const cy = 120;
    const outerRadius = 85;
    const isDonut = chartType === 'doughnut_chart';
    const innerRadius = isDonut ? 48 : 0;

    const values = series[0]?.values || [];
    const total = values.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0) || 1;

    let cumulativeAngle = 0;

    const slices = categories.map((cat, idx) => {
      const val = values[idx] || 0;
      const angle = (val / total) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      const radStart = (startAngle - 90) * (Math.PI / 180);
      const radEnd = (endAngle - 90) * (Math.PI / 180);

      const x1 = cx + outerRadius * Math.cos(radStart);
      const y1 = cy + outerRadius * Math.sin(radStart);
      const x2 = cx + outerRadius * Math.cos(radEnd);
      const y2 = cy + outerRadius * Math.sin(radEnd);

      const largeArc = angle > 180 ? 1 : 0;

      let pathD = '';
      if (isDonut) {
        const x3 = cx + innerRadius * Math.cos(radEnd);
        const y3 = cy + innerRadius * Math.sin(radEnd);
        const x4 = cx + innerRadius * Math.cos(radStart);
        const y4 = cy + innerRadius * Math.sin(radStart);
        pathD = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
      } else {
        pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      }

      const pct = Math.round((val / total) * 100);

      return {
        cat,
        val,
        pct,
        pathD,
        color: COLORS[idx % COLORS.length],
      };
    });

    return (
      <div className="pie-chart-wrap">
        <svg className="visual-svg-chart pie-svg" viewBox={`0 0 ${width} ${height}`}>
          {slices.map((slice, i) => (
            <path key={i} d={slice.pathD} fill={slice.color} stroke="#ffffff" strokeWidth="2" className="pie-slice" />
          ))}
        </svg>
        <div className="pie-legend">
          {slices.map((slice, i) => (
            <div key={i} className="pie-legend-item">
              <span className="legend-dot" style={{ backgroundColor: slice.color }} />
              <span className="legend-cat">{slice.cat}:</span>
              <span className="legend-val">
                <strong>{slice.val}</strong> {unit || '%'} ({slice.pct}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="visual-chart-card">
      <div className="visual-chart-header">
        <div className="visual-chart-badge">
          📊 VISUAL DATA INTERPRETATION — {chartType.replace(/_/g, ' ').toUpperCase()}
        </div>
        {cleanTitle && <h4 className="visual-chart-title">{cleanTitle}</h4>}
      </div>

      {imgUrl ? (
        <div className="visual-original-snapshot">
          <div className="snapshot-label">🖼️ ORIGINAL DOCUMENT IMAGE SNAPSHOT</div>
          <img src={imgUrl} alt="Original document visual" className="visual-snapshot-img" />
        </div>
      ) : null}

      <div className="visual-chart-body">
        <div className="chart-renderer-label">📈 GENERATED INTERACTIVE CHART MODEL ({unit || 'values'})</div>
        {chartType.includes('pie') || chartType.includes('doughnut') || chartType.includes('donut')
          ? renderPieChart()
          : chartType.includes('line')
          ? renderLineChart()
          : renderClusteredBarChart()}

        {series.length > 1 && (
          <div className="series-legend">
            {series.map((s, idx) => (
              <div key={idx} className="series-legend-item">
                <span className="series-color-box" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
