import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import ValueHelpField from "./ValueHelpField";
import "./TestResults.css";
import { SensitiveContent } from "../security";

interface TestSummary { id: string; name: string; duration: number; questions: number; totalAttempts: number; avgScore: number; passRate: number }
interface CandidateResult { id: string; userId: string; userName: string; percentage: number; scoredMarks: number; totalMarks: number; passed: boolean; submittedAt: string; timeSpentSec: number; percentile?: number }
interface ReviewItem { questionId: string; isCorrect: boolean; userAnswer: string | string[]; marks: number; section: string }
interface ResultDetail extends CandidateResult { examName: string; sectionWise: Record<string,{total:number;scored:number}>; questionReview: ReviewItem[] }
interface Overview { scoreBands:Array<{label:string;count:number}>;trend:Array<{date:string;attempts:number;avgScore:number}>;toppers:Array<{resultId:string;examId:string;testName:string;userId:string;userName:string;percentage:number;marks:number;timeSpentSec:number}> }

const TestResults: React.FC = () => {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestSummary | null>(null);
  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview>({ scoreBands: [], trend: [], toppers: [] });

  // Test-wise analytics filters
  const [testSearch, setTestSearch] = useState("");
  const [attemptFilter, setAttemptFilter] = useState<"all" | "attempted" | "unattempted" | "high">("all");
  const [passRateFilter, setPassRateFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [sortBy, setSortBy] = useState<"attempts" | "name" | "score" | "pass">("attempts");
  const testGridRef = React.useRef<HTMLDivElement>(null);
  const scrollToTestGrid = () => setTimeout(() => testGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      apiGet<{ tests: TestSummary[] }>("/admin/results/tests"),
      apiGet<Overview>("/admin/results/overview")
    ]).then(([testResult, overviewResult]) => {
      if (testResult.status === "fulfilled" && testResult.value) {
        setTests(testResult.value.tests || []);
      }
      if (overviewResult.status === "fulfilled" && overviewResult.value) {
        setOverview(overviewResult.value);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);


  const openTest = async (test: TestSummary) => {
    setSelectedTest(test);
    setDetail(null);
    setLoading(true);
    try {
      const response = await apiGet<{ results: CandidateResult[] }>(`/admin/results/tests/${test.id}/users`);
      setCandidates(response.results || []);
    } finally {
      setLoading(false);
    }
  };

  const openCandidate = async (candidate: CandidateResult) => {
    setLoading(true);
    try {
      const response = await apiGet<{ result: ResultDetail }>(`/admin/results/${candidate.id}`);
      setDetail(response.result);
    } finally {
      setLoading(false);
    }
  };

  const hasActiveTestFilters = Boolean(
    testSearch || attemptFilter !== "all" || passRateFilter !== "all" || sortBy !== "attempts"
  );

  const resetTestFilters = () => {
    setTestSearch("");
    setAttemptFilter("all");
    setPassRateFilter("all");
    setSortBy("attempts");
  };

  const filterableTests = useMemo(() => {
    const query = normalizeSearchText(testSearch || search);
    return tests.filter(test => {
      const matchesSearch = !query || normalizeSearchText(`${test.name} ${test.questions} questions ${test.duration} mins`).includes(query);

      const attempts = test.totalAttempts || 0;
      const matchesAttempts = 
        attemptFilter === "all" ||
        (attemptFilter === "attempted" ? attempts > 0 :
         attemptFilter === "unattempted" ? attempts === 0 :
         attempts >= 5);

      const passRate = test.passRate || 0;
      const matchesPass = 
        passRateFilter === "all" ||
        (passRateFilter === "high" ? passRate >= 70 :
         passRateFilter === "medium" ? passRate >= 40 && passRate < 70 :
         passRate < 40);

      return matchesSearch && matchesAttempts && matchesPass;
    }).sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "score") return b.avgScore - a.avgScore;
      if (sortBy === "pass") return a.passRate - b.passRate;
      return b.totalAttempts - a.totalAttempts;
    });
  }, [tests, testSearch, search, attemptFilter, passRateFilter, sortBy]);

  const attempted = tests.filter(test => test.totalAttempts > 0);
  const totalAttempts = tests.reduce((sum, test) => sum + test.totalAttempts, 0);
  const weightedAvg = totalAttempts ? tests.reduce((sum, test) => sum + test.avgScore * test.totalAttempts, 0) / totalAttempts : 0;
  const weightedPass = totalAttempts ? tests.reduce((sum, test) => sum + test.passRate * test.totalAttempts, 0) / totalAttempts : 0;
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  
  const openTopper = async (topper: Overview["toppers"][number]) => {
    const test = tests.find(item => item.id === topper.examId);
    if (!test) return;
    setSelectedTest(test);
    setLoading(true);
    try {
      const response = await apiGet<{ result: ResultDetail }>(`/admin/results/${topper.resultId}`);
      setDetail(response.result);
    } finally {
      setLoading(false);
    }
  };

  if (detail) return (
    <SensitiveContent
      showWatermark
      hideOnTabSwitch
      shieldOnScreenShare
      shieldMessage="Candidate results are protected. Return to this tab to continue."
    >
      <CandidateAnalytics detail={detail} test={selectedTest!} onBack={() => setDetail(null)} formatTime={formatTime} />
    </SensitiveContent>
  );

  
  if (selectedTest) return (
    <section className="admin-analytics">
      <header className="analytics-head">
        <div>
          <button className="analytics-back" onClick={() => { setSelectedTest(null); setCandidates([]); }}>← All tests</button>
          <span>TEST ANALYTICS</span>
          <h1>{selectedTest.name}</h1>
          <p>Candidate performance, completion and score distribution.</p>
        </div>
      </header>

      <div className="analytics-kpis">
        <Metric label="Attempts" value={selectedTest.totalAttempts} />
        <Metric label="Average score" value={`${selectedTest.avgScore.toFixed(1)}%`} />
        <Metric label="Pass rate" value={`${selectedTest.passRate.toFixed(1)}%`} />
        <Metric label="Questions" value={selectedTest.questions} />
      </div>

      <div className="analytics-split">
        <article className="analytics-card">
          <h3>Outcome distribution</h3>
          <div className="distribution">
            <div className="donut" style={{ "--pass": `${selectedTest.passRate * 3.6}deg` } as React.CSSProperties}>
              <strong>{selectedTest.passRate.toFixed(0)}%</strong>
              <span>passed</span>
            </div>
            <div>
              <span><i className="pass" />Passed <b>{Math.round(selectedTest.totalAttempts * selectedTest.passRate / 100)}</b></span>
              <span><i className="fail" />Needs improvement <b>{selectedTest.totalAttempts - Math.round(selectedTest.totalAttempts * selectedTest.passRate / 100)}</b></span>
            </div>
          </div>
        </article>

        <article className="analytics-card">
          <h3>Paper information</h3>
          <dl className="paper-details">
            <div><dt>Duration</dt><dd>{selectedTest.duration} minutes</dd></div>
            <div><dt>Total questions</dt><dd>{selectedTest.questions}</dd></div>
            <div><dt>Average completion</dt><dd>{candidates.length ? formatTime(Math.round(candidates.reduce((s, c) => s + c.timeSpentSec, 0) / candidates.length)) : "—"}</dd></div>
          </dl>
        </article>
      </div>

      <div className="candidate-results-card">
        <div className="candidate-results-head">
          <div>
            <h3>Student results</h3>
            <p>Select a student to open their complete report.</p>
          </div>
          <strong>{candidates.length} attempts</strong>
        </div>
        {loading ? <Empty text="Loading candidate results…" /> : candidates.length === 0 ? <Empty text="No students have completed this test yet." /> : (
          <div className="candidate-results-table">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Time spent</th>
                  <th>Submitted</th>
                  <th>Result</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...candidates].sort((a, b) => b.percentage - a.percentage).map(candidate => (
                  <tr key={candidate.id}>
                    <td>
                      <div className="analytics-student">
                        <span>{candidate.userName.charAt(0).toUpperCase()}</span>
                        <div>
                          <strong>{candidate.userName}</strong>
                          <small>{candidate.userId}</small>
                        </div>
                      </div>
                    </td>
                    <td>{candidate.scoredMarks} / {candidate.totalMarks}</td>
                    <td><b>{candidate.percentage.toFixed(1)}%</b></td>
                    <td>{formatTime(candidate.timeSpentSec)}</td>
                    <td>{candidate.submittedAt ? new Date(candidate.submittedAt).toLocaleDateString("en-IN") : "—"}</td>
                    <td>
                      <span className={`result-state ${candidate.passed ? "pass" : "fail"}`}>
                        {candidate.passed ? "Passed" : "Needs improvement"}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => openCandidate(candidate)}>View report →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <section className="admin-analytics">
      <header className="analytics-head">
        <div>
          <span>PERFORMANCE CENTER</span>
          <h1>Test Analytics</h1>
          <p>Monitor paper performance and open detailed student reports.</p>
        </div>
        <div className="analytics-value-help">
          <ValueHelpField 
            label="Search Tests" 
            placeholder="Search test, duration or score" 
            value={search} 
            options={tests.map(test => ({ value: test.name, label: test.name, keywords: [`${test.duration} minutes`, `${test.questions} questions`, `${test.avgScore}% average`, `${test.passRate}% pass rate`] }))} 
            onChange={setSearch} 
            allowFreeText
          />
        </div>
      </header>

      <div className="analytics-kpis overview">
        <Metric label="Published tests" value={tests.length} hint="View all papers" onClick={() => { resetTestFilters(); scrollToTestGrid(); }} />
        <Metric label="Tests attempted" value={attempted.length} hint="Filter attempted" onClick={() => { setAttemptFilter("attempted"); scrollToTestGrid(); }} />
        <Metric label="Student attempts" value={totalAttempts} hint="Sort by attempts" onClick={() => { setSortBy("attempts"); scrollToTestGrid(); }} />
        <Metric label="Average score" value={`${weightedAvg.toFixed(1)}%`} hint="Sort by score" onClick={() => { setSortBy("score"); scrollToTestGrid(); }} />
        <Metric label="Overall pass rate" value={`${weightedPass.toFixed(1)}%`} hint="Sort by pass rate" onClick={() => { setSortBy("pass"); scrollToTestGrid(); }} />
      </div>

      {loading ? (
        <Empty text="Loading test analytics…" />
      ) : (
        <>
          <OverviewCharts overview={overview} tests={attempted} weightedPass={weightedPass} onTest={openTest} onTopper={openTopper} onBandClick={(band) => { const bandMap: Record<string, "high"|"medium"|"low"> = { "81–100%": "high", "61–80%": "high", "41–60%": "medium", "21–40%": "low", "0–20%": "low" }; const pr = bandMap[band] || "all"; setPassRateFilter(pr as any); setSortBy("pass"); scrollToTestGrid(); }} onTrendClick={() => { setSortBy("attempts"); scrollToTestGrid(); }} onOutcomeClick={() => { setSortBy("pass"); scrollToTestGrid(); }} />

          <div className="analytics-section-title" ref={testGridRef}>
            <div>
              <h2>Test-wise analytics</h2>
              <p>Select any paper to explore student performance.</p>
            </div>
            <span className="tests-count-badge">{filterableTests.length} tests</span>
          </div>

          {/* Standalone Filter Card for Test-Wise Analytics */}
          <div className="test-analytics-filter-card">
            <div className="test-filter-group search-group">
              <label>Search Test Papers</label>
              <div className="test-search-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input 
                  type="text" 
                  value={testSearch} 
                  onChange={e => setTestSearch(e.target.value)} 
                  placeholder="Search test paper by name…" 
                />
                {testSearch && <button type="button" className="clear-search-btn" onClick={() => setTestSearch("")}>✕</button>}
              </div>
            </div>

            <div className="test-filter-group">
              <label>Attempt Volume</label>
              <select value={attemptFilter} onChange={e => setAttemptFilter(e.target.value as any)}>
                <option value="all">All papers</option>
                <option value="attempted">Attempted (1+)</option>
                <option value="unattempted">Unattempted (0)</option>
                <option value="high">High Volume (5+)</option>
              </select>
            </div>

            <div className="test-filter-group">
              <label>Pass Rate</label>
              <select value={passRateFilter} onChange={e => setPassRateFilter(e.target.value as any)}>
                <option value="all">All pass rates</option>
                <option value="high">High Pass Rate (70%+)</option>
                <option value="medium">Average (40%–70%)</option>
                <option value="low">Needs Attention (&lt;40%)</option>
              </select>
            </div>

            <div className="test-filter-group">
              <label>Sort By</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                <option value="attempts">Most Attempted</option>
                <option value="name">Name A–Z</option>
                <option value="score">Highest Avg Score</option>
                <option value="pass">Lowest Pass Rate</option>
              </select>
            </div>

            <div className="test-filter-actions">
              {hasActiveTestFilters && (
                <button type="button" className="clear-test-filters-btn" onClick={resetTestFilters}>
                  Clear Filters ✕
                </button>
              )}
            </div>
          </div>

          <div className="analytics-test-grid">
            {filterableTests.map(test => (
              <button key={test.id} className="analytics-test-card" onClick={() => openTest(test)}>
                <div className="analytics-test-top">
                  <span>{test.totalAttempts ? "LIVE DATA" : "NO ATTEMPTS"}</span>
                  <b>→</b>
                </div>
                <h3>{test.name}</h3>
                <p>{test.questions} questions • {test.duration} minutes</p>
                <div className="test-analytics-values">
                  <div>
                    <small>Attempts</small>
                    <strong>{test.totalAttempts}</strong>
                  </div>
                  <div>
                    <small>Avg. score</small>
                    <strong>{test.avgScore.toFixed(1)}%</strong>
                  </div>
                  <div>
                    <small>Pass rate</small>
                    <strong>{test.passRate.toFixed(1)}%</strong>
                  </div>
                </div>
                <div className="analytics-progress">
                  <i style={{ width: `${Math.max(0, Math.min(100, test.avgScore))}%` }} />
                </div>
              </button>
            ))}
            {filterableTests.length === 0 && (
              <div className="analytics-empty" style={{ gridColumn: "1 / -1" }}>
                No test papers match your current filters. {hasActiveTestFilters && <button className="inline-reset-btn" onClick={resetTestFilters}>Reset Filters</button>}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

const OverviewCharts = ({ overview, tests, weightedPass, onTest, onTopper, onBandClick, onTrendClick, onOutcomeClick }: { overview: Overview; tests: TestSummary[]; weightedPass: number; onTest: (test: TestSummary) => void; onTopper: (topper: Overview["toppers"][number]) => void; onBandClick: (band: string) => void; onTrendClick: () => void; onOutcomeClick: () => void }) => {
  const maxAttempts = Math.max(1, ...overview.trend.map(item => item.attempts));
  const maxBand = Math.max(1, ...overview.scoreBands.map(item => item.count));
  const topTests = [...tests].sort((a, b) => b.totalAttempts - a.totalAttempts).slice(0, 6);

  return (
    <div className="overview-visuals">
      <article className="analytics-card score-distribution">
        <header>
          <div>
            <h3>Score distribution</h3>
            <p>Completed attempts grouped by percentage.</p>
          </div>
          <button className="chart-badge-btn" onClick={() => onBandClick("all")}>ALL RESULTS ↗</button>
        </header>
        <div className="vertical-chart">
          {overview.scoreBands.map((band, index) => (
            <button key={band.label} title={`Click to filter: ${band.count} attempts in ${band.label}`} onClick={() => onBandClick(band.label)}>
              <strong>{band.count}</strong>
              <i style={{ height: `${Math.max(8, band.count / maxBand * 100)}%` }} className={`band-${index}`} />
              <small>{band.label}</small>
            </button>
          ))}
        </div>
      </article>

      <article className="analytics-card outcome-chart">
        <header>
          <div>
            <h3>Overall outcomes</h3>
            <p>Pass and improvement ratio.</p>
          </div>
          <button className="chart-badge-btn" onClick={onOutcomeClick}>FILTER BY PASS ↗</button>
        </header>
        <button className="admin-outcome-donut" title="Click to sort by pass rate" onClick={onOutcomeClick} style={{ "--pass": `${weightedPass * 3.6}deg` } as React.CSSProperties}>
          <span>
            <strong>{weightedPass.toFixed(0)}%</strong>
            <small>Pass rate</small>
          </span>
        </button>
        <div className="outcome-legend">
          <span><i />Passed <b>{weightedPass.toFixed(1)}%</b></span>
          <span><i />Needs improvement <b>{(100 - weightedPass).toFixed(1)}%</b></span>
        </div>
      </article>

      <article className="analytics-card trend-chart">
        <header>
          <div>
            <h3>Attempt trend</h3>
            <p>Volume and average score by day.</p>
          </div>
          <button className="chart-badge-btn" onClick={onTrendClick}>RECENT ACTIVITY ↗</button>
        </header>
        <div className="trend-bars">
          {overview.trend.length ? overview.trend.map(item => (
            <button key={item.date} title={`${item.attempts} attempts · ${item.avgScore}% avg — click to filter`} onClick={onTrendClick}>
              <b>{item.attempts}</b>
              <i style={{ height: `${Math.max(10, item.attempts / maxAttempts * 100)}%` }} />
              <span>{item.avgScore}%</span>
              <small>{item.date}</small>
            </button>
          )) : <p>No attempts yet.</p>}
        </div>
      </article>

      <article className="analytics-card test-comparison">
        <header>
          <div>
            <h3>Most attempted tests</h3>
            <p>Click a bar to open its detailed report.</p>
          </div>
        </header>
        {topTests.map(test => (
          <button key={test.id} onClick={() => onTest(test)}>
            <div className="test-comp-top">
              <span>{test.name}</span>
              <b>{test.totalAttempts}</b>
            </div>
            <div className="test-comp-bar">
              <i style={{ width: `${Math.max(5, test.totalAttempts / Math.max(1, topTests[0]?.totalAttempts) * 100)}%` }} />
            </div>
          </button>
        ))}
      </article>

      <article className="analytics-card topper-leaderboard">
        <header>
          <div>
            <h3>Top performers</h3>
            <p>Best results across all tests.</p>
          </div>
          <span>TOP 10</span>
        </header>
        {overview.toppers.length ? overview.toppers.map((topper, index) => (
          <button key={topper.resultId} onClick={() => onTopper(topper)}>
            <em>{index + 1}</em>
            <span>{topper.userName.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{topper.userName}</strong>
              <small>{topper.testName}</small>
            </div>
            <b>{topper.percentage.toFixed(1)}%</b>
            <i>→</i>
          </button>
        )) : <p className="analytics-empty-small">No completed attempts yet.</p>}
      </article>
    </div>
  );
};

const CandidateAnalytics = ({ detail, test, onBack, formatTime }: { detail: ResultDetail; test: TestSummary; onBack: () => void; formatTime: (seconds: number) => string }) => {
  const review = detail.questionReview || [];
  const answered = (value: string | string[]) => Array.isArray(value) ? value.length > 0 : Boolean(value);
  const correct = review.filter(item => item.isCorrect).length;
  const wrong = review.filter(item => !item.isCorrect && answered(item.userAnswer)).length;
  const skipped = Math.max(0, review.length - correct - wrong);
  const totalAttempted = correct + wrong;
  const accuracy = totalAttempted > 0 ? ((correct / totalAttempted) * 100).toFixed(1) : "0.0";
  const safePercentage = Math.max(0, Math.min(100, detail.percentage));

  return (
    <section className="admin-analytics candidate-report-container">
      {/* Header Bar */}
      <header className="candidate-report-head">
        <div className="report-head-left">
          <button className="candidate-back-btn" onClick={onBack} type="button">
            <span className="back-arrow">←</span> Back to Student Results
          </button>
          <div className="report-eyebrow">STUDENT PERFORMANCE REPORT</div>
          <div className="candidate-profile-row">
            <div className="candidate-avatar-circle">
              {detail.userName ? detail.userName.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="candidate-info-block">
              <h1 className="candidate-name-title">{detail.userName}</h1>
              <div className="candidate-meta-badges">
                <span className="meta-badge test-tag">{test.name}</span>
                <span className="meta-badge-dot">•</span>
                <span className="meta-badge time-tag">
                  {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Completed"}
                </span>
                {detail.percentile !== undefined && (
                  <>
                    <span className="meta-badge-dot">•</span>
                    <span className="meta-badge percentile-tag">{detail.percentile.toFixed(1)}th Percentile</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="report-head-right">
          <div className={`report-status-badge ${detail.passed ? "pass" : "fail"}`}>
            <span className="status-indicator-dot" />
            <span className="status-text">{detail.passed ? "Passed Examination" : "Needs Improvement"}</span>
          </div>
        </div>
      </header>

      {/* KPI Metric Cards */}
      <div className="candidate-kpi-strip">
        {/* Radial Score Card */}
        <div className="kpi-score-ring-card">
          <div
            className="score-gauge"
            style={{
              "--score-deg": `${safePercentage * 3.6}deg`,
              "--ring-color": detail.percentage >= 60 ? "#10b981" : detail.percentage >= 40 ? "#f59e0b" : "#ef4444"
            } as React.CSSProperties}
          >
            <div className="score-gauge-inner">
              <span className="gauge-value">{safePercentage.toFixed(1)}%</span>
              <span className="gauge-label">Score</span>
            </div>
          </div>
          <div className="score-ring-summary">
            <strong>{detail.passed ? "Qualified" : "Not Qualified"}</strong>
            <span>{detail.scoredMarks} of {detail.totalMarks} marks</span>
          </div>
        </div>

        {/* 5 KPI Metric Cards */}
        <div className="candidate-kpi-card">
          <div className="kpi-icon-pill blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Marks Scored</span>
            <strong className="kpi-num">
              {detail.scoredMarks} <small className="kpi-denom">/ {detail.totalMarks}</small>
            </strong>
          </div>
        </div>

        <div className="candidate-kpi-card">
          <div className="kpi-icon-pill purple">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Time Spent</span>
            <strong className="kpi-num">{formatTime(detail.timeSpentSec)}</strong>
          </div>
        </div>

        <div className="candidate-kpi-card">
          <div className="kpi-icon-pill emerald">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Correct</span>
            <strong className="kpi-num text-emerald">{correct}</strong>
          </div>
        </div>

        <div className="candidate-kpi-card">
          <div className="kpi-icon-pill rose">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Incorrect</span>
            <strong className="kpi-num text-rose">{wrong}</strong>
          </div>
        </div>

        <div className="candidate-kpi-card">
          <div className="kpi-icon-pill amber">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Unattempted</span>
            <strong className="kpi-num text-amber">{skipped}</strong>
          </div>
        </div>
      </div>

      {/* 2-Column Section & Benchmark Analysis */}
      <div className="candidate-analysis-grid">
        {/* Section Performance */}
        <article className="candidate-panel-card section-breakdown-card">
          <div className="panel-card-head">
            <div className="head-icon blue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <div>
              <h3>Section Performance</h3>
              <p>Module-wise marks and qualification ratio</p>
            </div>
          </div>

          <div className="section-breakdown-content">
            {Object.entries(detail.sectionWise || {}).length > 0 ? (
              Object.entries(detail.sectionWise || {}).map(([section, data]) => {
                const percent = data.total ? (data.scored / data.total) * 100 : 0;
                const safeSecPercent = Math.max(0, Math.min(100, percent));
                const tierClass = percent >= 60 ? "high" : percent >= 40 ? "mid" : "low";

                return (
                  <div className="candidate-section-item" key={section}>
                    <div className="sec-item-header">
                      <strong className="sec-item-name">{section}</strong>
                      <span className="sec-item-score">
                        {data.scored} <small>/ {data.total} marks</small>
                      </span>
                    </div>
                    <div className="sec-item-bar-row">
                      <div className="sec-progress-track">
                        <div
                          className={`sec-progress-fill ${tierClass}`}
                          style={{ width: `${safeSecPercent}%` }}
                        />
                      </div>
                      <span className={`sec-badge ${tierClass}`}>
                        {percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="candidate-empty-note">No sectional breakdown available.</div>
            )}
          </div>
        </article>

        {/* Benchmark & Cohort Comparison */}
        <article className="candidate-panel-card benchmark-comparison-card">
          <div className="panel-card-head">
            <div className="head-icon cyan">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <div>
              <h3>Performance Comparison</h3>
              <p>Relative positioning against cohort statistics</p>
            </div>
          </div>

          <div className="benchmark-card-content">
            <div className="benchmark-bar-list">
              <Compare label="Candidate Score" value={detail.percentage} color="#2563eb" tag="Student" />
              <Compare label="Test Cohort Average" value={test.avgScore} color="#06b6d4" tag="Average" />
              <Compare label="Passing Target" value={70} color="#10b981" tag="Target" />
            </div>

            <div className={`benchmark-note-banner ${detail.percentage >= test.avgScore ? "positive" : "alert"}`}>
              <div className="note-content">
                <strong>{detail.percentage >= test.avgScore ? "Above Cohort Average" : "Below Cohort Average"}</strong>
                <p>
                  Scored {Math.abs(detail.percentage - test.avgScore).toFixed(1)} percentage points{" "}
                  {detail.percentage >= test.avgScore ? "above" : "below"} the overall examination average.
                </p>
              </div>
            </div>

            <div className="accuracy-summary-pill">
              <div className="acc-left">
                <span className="acc-title">Attempt Accuracy</span>
                <span className="acc-desc">{correct} correct out of {totalAttempted} attempted questions</span>
              </div>
              <div className="acc-badge">{accuracy}%</div>
            </div>
          </div>
        </article>
      </div>

      {/* Question Analysis Grid */}
      <article className="candidate-panel-card question-matrix-card">
        <div className="panel-card-head question-matrix-head">
          <div className="head-title-wrap">
            <div className="head-icon amber">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </div>
            <div>
              <h3>Question Analysis Matrix</h3>
              <p>Granular outcome for all {review.length} examination questions</p>
            </div>
          </div>

          <div className="question-matrix-pills">
            <span className="q-pill correct">✓ {correct} Correct</span>
            <span className="q-pill wrong">✗ {wrong} Incorrect</span>
            <span className="q-pill empty">— {skipped} Unattempted</span>
          </div>
        </div>

        <div className="question-tiles-grid">
          {review.map((item, index) => {
            const isAns = answered(item.userAnswer);
            const statusClass = item.isCorrect ? "correct" : isAns ? "wrong" : "empty";
            return (
              <div
                key={item.questionId || index}
                className={`q-tile ${statusClass}`}
                title={`Question ${index + 1}: ${item.isCorrect ? "Correct (+marks)" : isAns ? "Incorrect (negative marking)" : "Unattempted"} • Section: ${item.section || "General"}`}
              >
                <span className="q-tile-num">{index + 1}</span>
                <span className="q-tile-icon">{item.isCorrect ? "✓" : isAns ? "✗" : "—"}</span>
              </div>
            );
          })}
        </div>

        <div className="matrix-legend-footer">
          <div className="legend-entry">
            <span className="legend-swatch correct" />
            <span>Correct Answer ({correct})</span>
          </div>
          <div className="legend-entry">
            <span className="legend-swatch wrong" />
            <span>Incorrect Response ({wrong})</span>
          </div>
          <div className="legend-entry">
            <span className="legend-swatch empty" />
            <span>Unattempted Question ({skipped})</span>
          </div>
        </div>
      </article>
    </section>
  );
};

const Metric = ({ label, value, hint, onClick }: { label: string; value: string | number; hint?: string; onClick?: () => void }) => (
  <div className={`analytics-metric${onClick ? " clickable" : ""}`} onClick={onClick} title={hint} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
    <span>{label}</span>
    <strong>{value}</strong>
    {onClick && hint && <em className="metric-hint">{hint} →</em>}
  </div>
);

const Empty = ({ text }: { text: string }) => (
  <div className="analytics-empty">{text}</div>
);

const Compare = ({ label, value, color, tag }: { label: string; value: number; color: string; tag?: string }) => (
  <div className="candidate-compare-row">
    <div className="compare-label-line">
      <span className="compare-name">{label}</span>
      <div className="compare-val-wrap">
        {tag && <span className="compare-tag-pill" style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}>{tag}</span>}
        <strong className="compare-percentage">{value.toFixed(1)}%</strong>
      </div>
    </div>
    <div className="compare-bar-track">
      <div
        className="compare-bar-fill"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  </div>
);

export default TestResults;
