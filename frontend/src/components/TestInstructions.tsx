import React, { useState, useMemo } from "react";
import ShineLogo from "./ShineLogo";
import "./TestInstructions.css";

export interface SectionPattern {
  name: string;
  duration: number;
  questionCount: number;
  marks: number;
}

export interface QuestionInstructionInfo {
  id?: string;
  qid?: string;
  question?: string;
  type?: string;
  options?: string[];
  correctAnswer?: string | string[];
  section?: string;
  marks?: number;
  negativeMarks?: number;
  context?: string;
  contextType?: string;
  imageReference?: string;
}

export interface TestInstructionsProps {
  userId: string;
  testName: string;
  duration: number;
  timerMode?: "overall" | "sectional";
  sectionConfig?: SectionPattern[];
  questions?: QuestionInstructionInfo[];
  negativeMarkingScheme?: string;
  negativeMarks?: number;
  passingPercentage?: number;
  customInstructions?: string;
  isSeries?: boolean;
  onStart: () => void;
  onBack: () => void;
}

const TestInstructions: React.FC<TestInstructionsProps> = ({
  userId,
  testName,
  duration,
  timerMode = "overall",
  sectionConfig = [],
  questions = [],
  negativeMarkingScheme = "quarter",
  negativeMarks = 0.25,
  passingPercentage = 40,
  customInstructions,
  isSeries = false,
  onStart,
  onBack,
}) => {
  const [page, setPage] = useState<"general" | "paper">("general");
  const [language, setLanguage] = useState<string>("English");
  const [agreed, setAgreed] = useState(false);

  // ── Compute sections dynamically from question list or sectionConfig ───
  const computedSections = useMemo<SectionPattern[]>(() => {
    if (sectionConfig && sectionConfig.length > 0) {
      return sectionConfig;
    }
    if (questions && questions.length > 0) {
      const secMap: Record<string, { count: number; marks: number }> = {};
      questions.forEach((q) => {
        const sName = q.section || "General Aptitude";
        if (!secMap[sName]) secMap[sName] = { count: 0, marks: 0 };
        secMap[sName].count += 1;
        secMap[sName].marks += Number(q.marks || 1);
      });
      const names = Object.keys(secMap);
      const estTimePerSec = Math.max(1, Math.round(duration / (names.length || 1)));
      return names.map((sName) => ({
        name: sName,
        questionCount: secMap[sName].count,
        marks: secMap[sName].marks,
        duration: estTimePerSec,
      }));
    }
    // Fallback if neither is available
    return [
      { name: "General Assessment", questionCount: 1, marks: 1, duration },
    ];
  }, [sectionConfig, questions, duration]);

  const totalQuestions = useMemo(() => {
    if (questions && questions.length > 0) return questions.length;
    return computedSections.reduce((sum, item) => sum + item.questionCount, 0);
  }, [questions, computedSections]);

  const totalMarks = useMemo(() => {
    if (questions && questions.length > 0) {
      return questions.reduce((sum, item) => sum + Number(item.marks || 1), 0);
    }
    return computedSections.reduce((sum, item) => sum + item.marks, 0);
  }, [questions, computedSections]);

  // Determine average options count per MCQ
  const optionCount = useMemo(() => {
    const mcqs = questions.filter((q) => Array.isArray(q.options) && q.options.length > 0);
    if (mcqs.length > 0) {
      return mcqs[0].options!.length;
    }
    return testName.toLowerCase().includes("ssc") ? 4 : 5;
  }, [questions, testName]);

  // Detect special question formats
  const hasMSQ = useMemo(() => questions.some((q) => q.type === "msq" || Array.isArray(q.correctAnswer)), [questions]);
  const hasDescriptive = useMemo(() => questions.some((q) => q.type === "descriptive" || q.type === "essay"), [questions]);
  const hasPassages = useMemo(() => questions.some((q) => q.contextType === "passage" || q.contextType === "table" || q.contextType === "graph"), [questions]);

  return (
    <div className="official-instructions">
      <header className="official-brand">
        <ShineLogo compact inverse />
      </header>
      <div className="official-layout">
        <main className="official-main">
          <h1>{page === "general" ? "General Examination Instructions" : "Test-Specific Pattern & Rules"}</h1>
          <div className="official-language">
            View in:{" "}
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="English">English</option>
              <option value="Hindi">Hindi (हिंदी)</option>
            </select>
          </div>
          <div className="official-scroll">
            {page === "general" ? (
              <GeneralInstructions language={language} isSectional={timerMode === "sectional"} />
            ) : (
              <PaperInstructions
                testName={testName}
                duration={duration}
                totalQuestions={totalQuestions}
                totalMarks={totalMarks}
                optionCount={optionCount}
                timerMode={timerMode}
                sections={computedSections}
                negativeMarkingScheme={negativeMarkingScheme}
                negativeMarks={negativeMarks}
                passingPercentage={passingPercentage}
                hasMSQ={hasMSQ}
                hasDescriptive={hasDescriptive}
                hasPassages={hasPassages}
                customInstructions={customInstructions}
                isSeries={isSeries}
                language={language}
              />
            )}
          </div>
          {page === "paper" && (
            <div className="official-consent">
              <label>
                Choose your default question language:
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                </select>
              </label>
              <p>
                Please note: questions will initially appear in your selected default language. You may change the language for individual questions using the question-level language toggle.
              </p>
              <label className="declaration">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  I have read and understood all the examination instructions above. I confirm that my system is functional and agree to abide by all test rules. I understand that the test will be evaluated according to the displayed marking scheme.
                </span>
              </label>
            </div>
          )}
          <footer>
            <button
              className="official-secondary"
              onClick={() => (page === "paper" ? setPage("general") : onBack())}
            >
              &lt; Previous
            </button>
            {page === "general" ? (
              <button className="official-primary" onClick={() => setPage("paper")}>
                Next: Paper Pattern &gt;
              </button>
            ) : (
              <button
                className="official-primary"
                disabled={!agreed}
                onClick={onStart}
              >
                I am ready to begin
              </button>
            )}
          </footer>
        </main>
        <aside className="official-candidate">
          <div className="candidate-photo">{userId ? userId.charAt(0).toUpperCase() : "U"}</div>
          <strong>{userId}</strong>
          <span>Shine Registered Candidate</span>
          <div style={{ marginTop: 14, fontSize: "0.75rem", color: "#64748b", textAlign: "center", lineHeight: 1.4 }}>
            <div><strong>Paper ID:</strong></div>
            <div style={{ wordBreak: "break-all" }}>{testName}</div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const GeneralInstructions = ({ language, isSectional }: { language: string; isSectional: boolean }) => {
  if (language === "Hindi") {
    return (
      <div className="general-copy">
        <h2>सामान्य निर्देश (General Instructions):</h2>
        <ol>
          <li>परीक्षा की घड़ी सर्वर द्वारा नियंत्रित होती है। स्क्रीन के शीर्ष पर दिया गया काउंटडाउन टाइमर शेष समय प्रदर्शित करता है। समय समाप्त होने पर परीक्षा अपने आप सबमिट हो जाएगी।</li>
          <li>प्रश्न पैलेट (Question Palette) प्रत्येक प्रश्न की स्थिति निम्नानुसार प्रदर्शित करता है:</li>
        </ol>
        <div className="palette-legend">
          <Legend symbol="1" kind="not-visited" text="आपने अभी तक इस प्रश्न को नहीं देखा है।" />
          <Legend symbol="2" kind="not-answered" text="आपने प्रश्न देखा है परंतु उत्तर नहीं दिया है।" />
          <Legend symbol="3" kind="answered" text="आपने प्रश्न का उत्तर दे दिया है।" />
          <Legend symbol="4" kind="review" text="आपने उत्तर नहीं दिया है, परंतु समीक्षा के लिए चिह्नित (Marked for Review) किया है।" />
          <Legend symbol="5" kind="answered-review" text="आपने उत्तर दिया है तथा समीक्षा के लिए भी चिह्नित किया है; इस उत्तर का मूल्यांकन किया जाएगा।" />
        </div>
        <h3>प्रश्नों पर जाना और उत्तर देना (Navigation & Answering):</h3>
        <ol start={3}>
          <li>किसी भी प्रश्न पर सीधे जाने के लिए प्रश्न पैलेट में संबंधित प्रश्न संख्या पर क्लिक करें।</li>
          <li>अपना उत्तर सुरक्षित करने के लिए हमेशा <b>Save & Next</b> बटन पर क्लिक करें।</li>
          <li>यदि आप किसी प्रश्न की बाद में समीक्षा करना चाहते हैं, तो <b>Mark for Review & Next</b> पर क्लिक करें।</li>
          <li>चुने गए उत्तर को हटाने के लिए <b>Clear Response</b> बटन का उपयोग करें।</li>
          <li>परीक्षा के दौरान ब्राउज़र को रीफ्रेश या बंद न करें। आपकी प्रगति सर्वर पर सुरक्षित होती रहती है।</li>
          <li>{isSectional ? "इस परीक्षा में अनुभागवार (Sectional) समय सीमा निर्धारित है। अनुभाग समय समाप्त होने पर अगला अनुभाग स्वतः खुल जाएगा।" : "सभी अनुभाग समग्र (Overall) परीक्षा समय साझा करते हैं।"}</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="general-copy">
      <h2>General Instructions:</h2>
      <ol>
        <li>The examination clock is controlled by the server. The countdown timer at the top right of the screen shows the remaining time. When the clock reaches zero, the examination will submit automatically.</li>
        <li>The Question Palette displayed on the right indicates the status of each question using the official color codes:</li>
      </ol>
      <div className="palette-legend">
        <Legend symbol="1" kind="not-visited" text="You have not visited the question yet." />
        <Legend symbol="2" kind="not-answered" text="You have visited but not answered the question." />
        <Legend symbol="3" kind="answered" text="You have answered the question." />
        <Legend symbol="4" kind="review" text="You have not answered the question, but marked it for review." />
        <Legend symbol="5" kind="answered-review" text="You have answered and marked the question for review; this answer will be evaluated." />
      </div>
      <h3>Navigating to Questions and Answering:</h3>
      <ol start={3}>
        <li>Click on the question number in the Question Palette to jump directly to that question.</li>
        <li>To select your response, click on the desired option button. To deselect, click on <b>Clear Response</b>.</li>
        <li>Always click <b>Save & Next</b> to save your answer and move to the next question.</li>
        <li>Use <b>Mark for Review & Next</b> when you want to return to a question later. Answers marked for review are evaluated if an option is selected.</li>
        <li>Do not close or refresh the browser during the examination. Your state is continuously preserved on the server.</li>
        <li>{isSectional ? "This examination has Sectional Timers. Moving between sections does not pause or add time to individual sections." : "All sections share the overall examination clock. You may switch between sections at any time."}</li>
        <li>When you are finished with all sections, click <b>Submit Exam</b> to review your submission summary and confirm final submission.</li>
      </ol>
    </div>
  );
};

const Legend = ({ symbol, kind, text }: { symbol: string; kind: string; text: string }) => (
  <div>
    <span className={`legend-shape ${kind}`}>{symbol}</span>
    <p>{text}</p>
  </div>
);

const PaperInstructions = ({
  testName,
  duration,
  totalQuestions,
  totalMarks,
  optionCount,
  timerMode,
  sections,
  negativeMarkingScheme,
  negativeMarks,
  passingPercentage,
  hasMSQ,
  hasDescriptive,
  hasPassages,
  customInstructions,
  isSeries,
  language,
}: {
  testName: string;
  duration: number;
  totalQuestions: number;
  totalMarks: number;
  optionCount: number;
  timerMode: string;
  sections: SectionPattern[];
  negativeMarkingScheme: string;
  negativeMarks: number;
  passingPercentage: number;
  hasMSQ: boolean;
  hasDescriptive: boolean;
  hasPassages: boolean;
  customInstructions?: string;
  isSeries?: boolean;
  language: string;
}) => {
  // Format negative marking text dynamically
  const getNegativeMarkingText = () => {
    const scheme = (negativeMarkingScheme || "").toLowerCase();
    const marks = Number(negativeMarks || 0);

    if (scheme === "none" || marks === 0) {
      return language === "Hindi"
        ? "गलत उत्तरों के लिए कोई नकारात्मक अंकन (Negative Marking) नहीं है।"
        : "No negative marking. No marks will be deducted for incorrect or unattempted answers.";
    }
    if (scheme === "quarter" || marks === 0.25) {
      return language === "Hindi"
        ? "नकारात्मक अंकन लागू है: प्रत्येक गलत उत्तर के लिए 0.25 (1/4) अंक काटे जाएंगे।"
        : "Negative marking is applicable: 0.25 marks (1/4th) will be deducted for each incorrect answer.";
    }
    if (scheme === "third" || Math.abs(marks - 0.33) < 0.05) {
      return language === "Hindi"
        ? "नकारात्मक अंकन लागू है: प्रत्येक गलत उत्तर के लिए 1/3 (0.33) अंक काटे जाएंगे।"
        : "Negative marking is applicable: 1/3rd (0.33) marks will be deducted for each incorrect answer.";
    }
    if (scheme === "half" || marks === 0.5) {
      return language === "Hindi"
        ? "नकारात्मक अंकन लागू है: प्रत्येक गलत उत्तर के लिए 0.50 (1/2) अंक काटे जाएंगे।"
        : "Negative marking is applicable: 0.50 marks (1/2) will be deducted for each incorrect answer.";
    }
    return language === "Hindi"
      ? `नकारात्मक अंकन लागू है: प्रत्येक गलत उत्तर के लिए ${marks} अंक काटे जाएंगे।`
      : `Negative marking is applicable: ${marks} mark(s) will be deducted for each incorrect answer.`;
  };

  return (
    <div className="paper-copy">
      <h2><u>{language === "Hindi" ? "परीक्षा विशिष्ट निर्देश" : "Other Important Instructions"}</u></h2>
      <h3><u>{testName.toUpperCase()}</u></h3>

      <div className="paper-facts" style={{ display: "flex", flexWrap: "wrap", gap: 16, margin: "14px 0", padding: "12px 16px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <div>⏱️ <strong>{language === "Hindi" ? "कुल समय" : "Duration"}:</strong> {duration} {language === "Hindi" ? "मिनट" : "Minutes"}</div>
        <div>🔢 <strong>{language === "Hindi" ? "कुल प्रश्न" : "Total Questions"}:</strong> {totalQuestions}</div>
        <div>🎯 <strong>{language === "Hindi" ? "अधिकतम अंक" : "Maximum Marks"}:</strong> {totalMarks}</div>
        <div>📋 <strong>{language === "Hindi" ? "उत्तीर्ण प्रतिशत" : "Passing Mark"}:</strong> {passingPercentage}%</div>
        {isSeries && <div>🏛️ <strong>{language === "Hindi" ? "प्रारूप" : "Exam Format"}:</strong> Test Series Paper</div>}
      </div>

      <p>{language === "Hindi" ? "कृपया निम्नलिखित विशिष्ट निर्देशों को ध्यानपूर्वक पढ़ें:" : "Read the following test configuration details and guidelines carefully:"}</p>

      <ol>
        <li>
          <strong>{language === "Hindi" ? "अनुभाग संरचना" : "Section Structure"}:</strong>{" "}
          {language === "Hindi"
            ? `इस परीक्षा में कुल ${sections.length} अनुभाग हैं, जिनमें कुल ${totalQuestions} प्रश्न शामिल हैं।`
            : `The examination contains ${sections.length} section(s) comprising ${totalQuestions} questions.`}
        </li>
        <li>
          <strong>{language === "Hindi" ? "प्रश्नों के प्रकार" : "Question Types"}:</strong>{" "}
          {hasMSQ
            ? (language === "Hindi" ? "इस परीक्षा में एकल विकल्प (Single Choice) और बहु-विकल्प (Multiple Select) दोनों प्रकार के प्रश्न हो सकते हैं।" : "This test includes Single Choice (MCQ) and Multiple Select (MSQ) questions. Read question labels carefully.")
            : (language === "Hindi" ? `प्रश्नों में ${optionCount} विकल्प दिए गए हैं, जिनमें से केवल एक विकल्प सही है।` : `Objective questions have ${optionCount} choices, of which exactly one is correct.`)}
        </li>
        {hasDescriptive && (
          <li>
            <strong>{language === "Hindi" ? "वर्णनात्मक प्रश्न" : "Descriptive Questions"}:</strong>{" "}
            {language === "Hindi"
              ? "इस परीक्षा में वर्णनात्मक/निबंध प्रश्न शामिल हैं। अपना उत्तर सीधे दिए गए टेक्स्ट बॉक्स में लिखें।"
              : "This test includes descriptive/essay questions. Enter your comprehensive response in the editor provided."}
          </li>
        )}
        {hasPassages && (
          <li>
            <strong>{language === "Hindi" ? "संदर्भ सामग्री" : "Reference Material"}:</strong>{" "}
            {language === "Hindi"
              ? "कुछ प्रश्न कॉम्प्रिहेंशन गद्यांश, डेटा तालिकाओं अथवा ग्राफ पर आधारित हैं।"
              : "Some questions are paired with reading passages, data tables, or charts. Review the reference context before answering."}
          </li>
        )}
        <li>
          <strong>{language === "Hindi" ? "नकारात्मक अंकन" : "Marking Scheme"}:</strong> {getNegativeMarkingText()}
        </li>
        <li>
          <strong>{language === "Hindi" ? "टाइमर मोड" : "Timer Mode"}:</strong>{" "}
          {timerMode === "sectional"
            ? (language === "Hindi" ? "प्रत्येक अनुभाग का अपना समय चक्र है। अनुभाग समाप्त होने पर स्वचालित रूप से अगला अनुभाग खुलेगा।" : "Each section has an independent timer. When a section time expires, the system automatically transitions to the next section.")
            : (language === "Hindi" ? "सभी अनुभाग समग्र समय सीमा साझा करते हैं। आप किसी भी समय अनुभागों के बीच जा सकते हैं।" : "All sections share the overall examination timer. You may switch between sections at any time.")}
        </li>
        <li>
          <strong>{language === "Hindi" ? "अंतिम जमा" : "Submission"}:</strong>{" "}
          {language === "Hindi"
            ? "परीक्षा समाप्ति से पूर्व सबमिशन सारांश की समीक्षा करें। अंतिम सबमिशन के पश्चात उत्तर बदले नहीं जा सकते।"
            : "Review your attempt summary carefully before confirming. Once submitted, answers cannot be edited."}
        </li>
      </ol>

      {/* Admin Custom Instructions if configured */}
      {customInstructions && customInstructions.trim() && (
        <div style={{ margin: "16px 0", padding: "14px 18px", background: "#fef3c7", borderLeft: "4px solid #f59e0b", borderRadius: 4 }}>
          <strong style={{ color: "#92400e", display: "block", marginBottom: 6 }}>
            📢 {language === "Hindi" ? "अतिरिक्त परीक्षा निर्देश (Special Instructions)" : "Special Instructions from the Administrator"}:
          </strong>
          <div style={{ color: "#78350f", whiteSpace: "pre-line", fontSize: "0.9rem" }}>
            {customInstructions}
          </div>
        </div>
      )}

      {/* Dynamic Section Pattern Table */}
      <h4 style={{ margin: "18px 0 8px 0", fontSize: "0.98rem", color: "#0f172a" }}>
        📊 {language === "Hindi" ? "अनुभागवार अंक और समय विवरण" : "Section-Wise Distribution & Pattern"}
      </h4>
      <table className="official-pattern">
        <thead>
          <tr>
            <th>{language === "Hindi" ? "अनुभाग" : "Section"}</th>
            <th>{language === "Hindi" ? "प्रश्न संख्या" : "Questions"}</th>
            <th>{language === "Hindi" ? "अंक" : "Marks"}</th>
            <th>{language === "Hindi" ? "आवंटित समय" : "Time"}</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <tr key={section.name}>
              <td><strong>{section.name}</strong></td>
              <td>{section.questionCount}</td>
              <td>{section.marks}</td>
              <td>{section.duration} min</td>
            </tr>
          ))}
          <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
            <td>{language === "Hindi" ? "कुल योग" : "Total"}</td>
            <td>{totalQuestions}</td>
            <td>{totalMarks}</td>
            <td>{duration} min</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default TestInstructions;
