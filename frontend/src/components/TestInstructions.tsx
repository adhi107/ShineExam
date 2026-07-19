import React, { useState } from "react";
import ShineLogo from "./ShineLogo";
import "./TestInstructions.css";

interface SectionPattern { name: string; duration: number; questionCount: number; marks: number }
interface Props {
  userId: string;
  testName: string;
  duration: number;
  timerMode?: "overall" | "sectional";
  sectionConfig?: SectionPattern[];
  onStart: () => void;
  onBack: () => void;
}

const TestInstructions: React.FC<Props> = ({ userId, testName, duration, timerMode = "overall", sectionConfig = [], onStart, onBack }) => {
  const [page, setPage] = useState<"general" | "paper">("general");
  const [language, setLanguage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const totalQuestions = sectionConfig.reduce((sum, item) => sum + item.questionCount, 0);
  const totalMarks = sectionConfig.reduce((sum, item) => sum + item.marks, 0);
  const optionCount = testName.toLowerCase().includes("ssc") ? 4 : 5;

  return <div className="official-instructions">
    <header className="official-brand"><ShineLogo /></header>
    <div className="official-layout">
      <main className="official-main">
        <h1>{page === "general" ? "Instructions" : "Other Important Instructions"}</h1>
        <div className="official-language">View in: <select defaultValue="English"><option>English</option><option>English & Hindi</option></select></div>
        <div className="official-scroll">
          {page === "general" ? <GeneralInstructions /> : <PaperInstructions testName={testName} duration={duration} totalQuestions={totalQuestions} totalMarks={totalMarks} optionCount={optionCount} timerMode={timerMode} sections={sectionConfig} />}
        </div>
        {page === "paper" && <div className="official-consent">
          <label>Choose your default language:
            <select value={language} onChange={event => setLanguage(event.target.value)}><option value="">--Select--</option><option value="English">English</option><option value="Hindi">Hindi</option></select>
          </label>
          <p>Please note: questions will initially appear in your selected language. The language can be changed for an individual question where available.</p>
          <label className="declaration"><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} /><span>I have read and understood the instructions. I confirm that my computer is working correctly and agree to follow all examination rules. I understand that the test can be attempted only once after final submission.</span></label>
        </div>}
        <footer>
          <button className="official-secondary" onClick={() => page === "paper" ? setPage("general") : onBack()}>&lt; Previous</button>
          {page === "general" ? <button className="official-primary" onClick={() => setPage("paper")}>Next &gt;</button> : <button className="official-primary" disabled={!language || !agreed} onClick={onStart}>I am ready to begin</button>}
        </footer>
      </main>
      <aside className="official-candidate"><div className="candidate-photo">{userId.charAt(0).toUpperCase()}</div><strong>{userId}</strong><span>Shine Candidate</span></aside>
    </div>
  </div>;
};

const GeneralInstructions = () => <div className="general-copy">
  <h2>General Instructions:</h2>
  <ol>
    <li>The examination clock is controlled by the server. The countdown timer shows the remaining time. When it reaches zero, the examination is submitted automatically.</li>
    <li>The question palette displays the status of every question:</li>
  </ol>
  <div className="palette-legend">
    <Legend symbol="1" kind="not-visited" text="You have not visited the question yet." />
    <Legend symbol="2" kind="not-answered" text="You have visited but not answered the question." />
    <Legend symbol="3" kind="answered" text="You have answered the question." />
    <Legend symbol="4" kind="review" text="You have not answered the question, but marked it for review." />
    <Legend symbol="5" kind="answered-review" text="You have answered and marked the question for review; the answer will be evaluated." />
  </div>
  <h3>Navigation and answering</h3>
  <ol start={3}>
    <li>Select any section tab and question number to navigate. Your response is retained when you move to another question.</li>
    <li>Use <b>Mark for Review</b> when you want to return to a question later. You may change or clear a response before final submission.</li>
    <li>Do not close or refresh the browser during the examination. Progress is saved automatically.</li>
    <li>Select <b>Submit Exam</b> to open the section summary. Final submission occurs only after you confirm it.</li>
  </ol>
</div>;

const Legend = ({ symbol, kind, text }: { symbol: string; kind: string; text: string }) => <div><span className={`legend-shape ${kind}`}>{symbol}</span><p>{text}</p></div>;

const PaperInstructions = ({ testName, duration, totalQuestions, totalMarks, optionCount, timerMode, sections }: { testName: string; duration: number; totalQuestions: number; totalMarks: number; optionCount: number; timerMode: string; sections: SectionPattern[] }) => <div className="paper-copy">
  <h2><u>Other Important Instructions</u></h2>
  <h3><u>{testName.toUpperCase()}</u></h3>
  <div className="paper-facts"><b>Duration: {duration} Minutes</b><b>Maximum Marks: {totalMarks}</b></div>
  <p>Read the following instructions carefully.</p>
  <ol>
    <li>The test contains {sections.length} sections having {totalQuestions} questions.</li>
    <li>Each question has {optionCount} options, out of which only one is correct.</li>
    <li>You must complete the examination within {duration} minutes.</li>
    <li>Wrong answers carry the negative mark prescribed for the paper. Unattempted questions receive no negative mark.</li>
    <li>{timerMode === "sectional" ? "Each section has its own timer. Moving between sections does not reset or increase its remaining time." : "All sections share the overall examination timer."}</li>
    <li>You can write this test only once. Review the submission summary carefully before confirming.</li>
  </ol>
  <table className="official-pattern"><thead><tr><th>Section</th><th>Questions</th><th>Marks</th><th>Time</th></tr></thead><tbody>{sections.map(section => <tr key={section.name}><td>{section.name}</td><td>{section.questionCount}</td><td>{section.marks}</td><td>{timerMode === "sectional" ? `${section.duration} min` : "Overall"}</td></tr>)}</tbody></table>
</div>;

export default TestInstructions;
