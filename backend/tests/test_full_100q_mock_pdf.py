import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.document_parser import parse_document_file
from services.multimodal_parser import ChartExtractionService, TableExtractionService, ValidationService


class Full100QuestionMockPdfTests(unittest.TestCase):
    def setUp(self):
        # Build 100-question document matching Banking_PO_Prelims_Mock_Test_6_Fresh_DI.pdf
        lines = ["BANKING PO PRELIMS MOCK TEST 6", "Section: English Language"]
        
        # Q1-30 English
        for q in range(1, 31):
            lines.append(f"{q}. English language test prompt question number {q}?")
            lines.append("A) Option A")
            lines.append("B) Option B")
            lines.append("C) Option C")
            lines.append("D) Option D")
            lines.append("E) Option E")
            lines.append("")

        lines.append("Section: Quantitative Aptitude")
        
        # Page 6: Q31-35 Clustered Bar Graph
        lines.append("Directions (Q31–35): Study the clustered bar graph below showing Savings and Current Accounts Opened (in thousands) and answer the questions.")
        lines.append("PART A — CLUSTERED BAR GRAPH (Q31–35)")
        lines.append("Title: Savings and Current Accounts Opened")
        lines.append("Categories: 2022, 2023, 2024, 2025, 2026")
        lines.append("Savings: 140, 180, 220, 260, 300")
        lines.append("Current: 80, 110, 140, 170, 200")
        lines.append("")
        for q in range(31, 36):
            lines.append(f"{q}. Quantitative question {q} based on clustered bar graph?")
            lines.append("A) 120")
            lines.append("B) 150")
            lines.append("C) 180")
            lines.append("D) 220")
            lines.append("E) 250")
            lines.append("")

        # Page 7: Q36-40 Line Graph
        lines.append("Directions (Q36–40): Study the line graph showing Monthly Loan Disbursement Index.")
        lines.append("PART B — LINE GRAPH (Q36–40)")
        lines.append("Title: Monthly Loan Disbursement Index")
        lines.append("Categories: Jan, Feb, Mar, Apr, May, Jun")
        lines.append("Index: 50, 60, 75, 70, 85, 95")
        lines.append("")
        for q in range(36, 41):
            lines.append(f"{q}. Quantitative question {q} based on line graph?")
            lines.append("A) 50")
            lines.append("B) 60")
            lines.append("C) 75")
            lines.append("D) 85")
            lines.append("E) 95")
            lines.append("")

        # Page 8: Q41-45 Pie Chart
        lines.append("Directions (Q41–45): Study the pie chart showing Credit Portfolio distribution (Total = ₹50 crore).")
        lines.append("PART C — PIE CHART (Q41–45)")
        lines.append("Title: Credit Portfolio")
        lines.append("Retail: 35%, Agri: 25%, MSME: 18%, Corporate: 12%, Other: 10%")
        lines.append("Total portfolio = ₹50 crore")
        lines.append("")
        for q in range(41, 46):
            lines.append(f"{q}. What is the credit portfolio amount for Retail (35% of ₹50 crore)?")
            lines.append("A) ₹12.5 crore")
            lines.append("B) ₹15.0 crore")
            lines.append("C) ₹17.5 crore")
            lines.append("D) ₹20.0 crore")
            lines.append("E) ₹22.5 crore")
            lines.append("")

        # Page 8-9: Q46-50 Table DI
        lines.append("Directions (Q46–50): Study the table showing branch applications.")
        lines.append("PART D — TABLE DATA INTERPRETATION (Q46–50)")
        lines.append("| Branch | Applications | Approved | Rejected | Pending |")
        lines.append("| A | 240 | 150 | 30 | 60 |")
        lines.append("| B | 300 | 210 | 45 | 45 |")
        lines.append("| C | 280 | 196 | 28 | 56 |")
        lines.append("| D | 360 | 252 | 36 | 72 |")
        lines.append("| E | 320 | 224 | 32 | 64 |")
        lines.append("")
        for q in range(46, 51):
            lines.append(f"{q}. Table DI question {q}?")
            lines.append("A) 240")
            lines.append("B) 300")
            lines.append("C) 150")
            lines.append("D) 210")
            lines.append("E) 60")
            lines.append("")

        # Q51-65 Quant Arithmetic
        for q in range(51, 66):
            lines.append(f"{q}. Quant arithmetic problem number {q}?")
            lines.append("A) Option A")
            lines.append("B) Option B")
            lines.append("C) Option C")
            lines.append("D) Option D")
            lines.append("E) Option E")
            lines.append("")

        # Q66-100 Reasoning
        lines.append("Section: Reasoning Ability")
        for q in range(66, 101):
            lines.append(f"{q}. Reasoning ability question number {q}?")
            lines.append("A) Option A")
            lines.append("B) Option B")
            lines.append("C) Option C")
            lines.append("D) Option D")
            lines.append("E) Option E")
            lines.append("")

        # Page 15: Answer Key for Q1 to Q100
        lines.append("ANSWER KEY")
        for q in range(1, 101):
            if q == 41:
                lines.append(f"{q} C")
            else:
                lines.append(f"{q} A")

        self.mock_pdf_content = "\n".join(lines)

    def test_full_100q_mock_pdf_parsing_and_relationships(self):
        sections, questions = parse_document_file(self.mock_pdf_content.encode('utf-8'), "Banking_PO_Prelims_Mock_Test_6_Fresh_DI.pdf")

        # 1. Verify exact 100 questions extracted
        self.assertEqual(len(questions), 100)

        # 2. Verify sections parsed
        sec_names = [s["name"] for s in sections]
        self.assertTrue(len(sec_names) >= 2)

        # 3. Verify Q31-35 Clustered Bar Graph group
        q31 = questions[30]
        self.assertEqual(q31["questionNumber"], 31)
        self.assertIsNotNone(q31.get("chartData"))
        self.assertEqual(q31["chartData"]["visual_type"], "clustered_bar_chart")
        self.assertEqual(q31["chartData"]["title"], "Savings and Current Accounts Opened")

        # 4. Verify Q36-40 Line Graph group
        q36 = questions[35]
        self.assertEqual(q36["questionNumber"], 36)
        self.assertIsNotNone(q36.get("chartData"))
        self.assertIn(q36["chartData"]["visual_type"], ["line_chart", "multi_line_chart"])

        # 5. Verify Q41-45 Pie Chart group
        q41 = questions[40]
        self.assertEqual(q41["questionNumber"], 41)
        self.assertIsNotNone(q41.get("chartData"))
        self.assertEqual(q41["chartData"]["visual_type"], "pie_chart")
        self.assertEqual(q41["correctAnswer"], "₹17.5 crore")
        self.assertEqual(q41["validationStatus"], "passed")

        # 6. Verify Q46-50 Table DI group
        q46 = questions[45]
        self.assertEqual(q46["questionNumber"], 46)
        self.assertIsNotNone(q46.get("tableData"))
        self.assertEqual(q46["tableData"]["columns"], ["Branch", "Applications", "Approved", "Rejected", "Pending"])
        self.assertEqual(len(q46["tableData"]["rows"]), 5)

        # 7. Verify Answer Key mapping for Q100
        q100 = questions[99]
        self.assertEqual(q100["questionNumber"], 100)
        self.assertEqual(q100["correctAnswer"], "Option A")
        self.assertEqual(q100["validationStatus"], "passed")


if __name__ == "__main__":
    unittest.main()
