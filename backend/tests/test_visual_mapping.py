import unittest
from services.document_parser import parse_document_file
from services.multimodal_parser import SemanticVisualMappingService

class VisualMappingPipelineTests(unittest.TestCase):
    def test_document_level_visual_mapping_isolation(self):
        """
        Automated regression test verifying document-level visual-to-question mapping architecture:
        - Visual A (Clustered Bar) -> Q31-32
        - Visual B (Stacked Bar) -> Q41-42
        - Visual C (Line Graph) -> Q46
        - Visual D (Pie Chart) -> Q51
        - Table E (Data Table) -> Q56
        Verifies every question receives ONLY its exact bound source visualId.
        """
        multi_visual_doc = """
Directions (Q31-35): Study the clustered bar graph given below.
Title: Savings and Current Accounts Opened
![Visual A](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

31. Total savings accounts opened in 2022 and 2026?
(A) 250 hundred
(B) 260 hundred
(C) 270 hundred
(D) 280 hundred
Answer: C

32. Difference between savings and current accounts in 2024?
(A) 40 hundred
(B) 50 hundred
(C) 60 hundred
(D) 70 hundred
Answer: B

Directions (Q41-45): Study the stacked bar graph given below.
Title: Monthly Account Openings
![Visual B](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

41. Total accounts in April?
(A) 120
(B) 125
(C) 130
(D) 135
Answer: B

42. What is the ratio of accounts in May to June?
(A) 3:4
(B) 4:5
(C) 5:6
(D) 6:7
Answer: A

Directions (Q46-50): Study the line graph given below.
Title: Digital vs Branch Transactions
![Visual C](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

46. Total digital transactions in Q1 and Q2?
(A) 450
(B) 480
(C) 500
(D) 520
Answer: A

Directions (Q51-55): Study the pie chart given below.
Title: Credit Portfolio Shares
![Visual D](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

51. Difference between deposits and cards = ?
(A) 10%
(B) 15%
(C) 20%
(D) 25%
Answer: A

Directions (Q56-60): Refer to the table given below.
Title: Branch Operational Expenses
[TABLE_START]
Branch | Expense (Lakh) | Revenue (Lakh)
North | 120 | 250
South | 150 | 310
East | 90 | 180
West | 110 | 220
[TABLE_END]

56. What is the total revenue of all branches?
(A) 960 Lakh
(B) 980 Lakh
(C) 1000 Lakh
(D) 1020 Lakh
Answer: A
"""
        sections, questions = parse_document_file(multi_visual_doc.encode('utf-8'), "Multi_Visual_Test.txt")
        self.assertGreaterEqual(len(questions), 7)

        # Find questions by text keyword
        q31 = next(q for q in questions if "savings accounts" in q["question"].lower())
        q32 = next(q for q in questions if "difference between savings" in q["question"].lower())
        q41 = next(q for q in questions if "accounts in april" in q["question"].lower())
        q42 = next(q for q in questions if "may to june" in q["question"].lower())
        q46 = next(q for q in questions if "digital transactions" in q["question"].lower())
        q51 = next(q for q in questions if "deposits and cards" in q["question"].lower())
        q56 = next(q for q in questions if "total revenue" in q["question"].lower())

        # 1. Verify Q31 & Q32 receive Visual A
        self.assertIsNotNone(q31.get("visualId"))
        self.assertEqual(q31["visualId"], q32["visualId"])
        self.assertIn("clustered bar", q31["context"].lower())

        # 2. Verify Q41 & Q42 receive Visual B (and NOT Visual A or Visual C)
        self.assertIsNotNone(q41.get("visualId"))
        self.assertEqual(q41["visualId"], q42["visualId"])
        self.assertNotEqual(q41["visualId"], q31["visualId"])
        self.assertIn("stacked bar", q41["context"].lower())

        # 3. Verify Q46 receives Visual C
        self.assertIsNotNone(q46.get("visualId"))
        self.assertNotEqual(q46["visualId"], q41["visualId"])
        self.assertNotEqual(q46["visualId"], q31["visualId"])
        self.assertIn("line graph", q46["context"].lower())

        # 4. Verify Q51 receives Visual D
        self.assertIsNotNone(q51.get("visualId"))
        self.assertNotEqual(q51["visualId"], q46["visualId"])
        self.assertNotEqual(q51["visualId"], q41["visualId"])
        self.assertIn("pie chart", q51["context"].lower())

        # 5. Verify Q56 receives Table E
        self.assertIsNotNone(q56.get("tableData"))
        cols = q56["tableData"].get("columns") or q56["tableData"].get("headers")
        self.assertEqual(cols[0], "Branch")

    def test_semantic_content_aware_visual_mapping_rejection(self):
        """
        Acceptance test for Content-Aware Visual-Question Mapping:
        Verifies that a question asking 'Difference between deposits and cards = ?'
        REJECTS a pie chart containing categories ['April', 'May', 'June', 'July', 'August']
        and marks mappingStatus = FAILED / NEEDS_REVIEW.
        """
        question_text = "Difference between deposits and cards = ?"
        context = "Directions (Q51-55): Study the pie chart."
        mismatched_chart_data = {
            "visual_type": "pie_chart",
            "title": "Monthly Distribution",
            "categories": ["April", "May", "June", "July", "August"],
            "series": [{"name": "Distribution", "values": [35, 25, 20, 20, 0]}]
        }

        match_ok, match_msg = SemanticVisualMappingService.validate_semantic_match(question_text, context, mismatched_chart_data)
        self.assertFalse(match_ok)
        self.assertIn("banking entities", match_msg.lower())
        self.assertIn("months", match_msg.lower())

        # Test valid matching chart data containing Deposits and Cards
        matching_chart_data = {
            "visual_type": "pie_chart",
            "title": "Credit & Deposit Portfolio",
            "categories": ["Deposits", "Cards", "Loans", "Services"],
            "series": [{"name": "Shares", "values": [40, 25, 20, 15]}]
        }
        match_ok2, _ = SemanticVisualMappingService.validate_semantic_match(question_text, context, matching_chart_data)
        self.assertTrue(match_ok2)

    def test_text_only_puzzle_has_no_fake_visuals(self):
        """Verifies text-only seating puzzles have no synthetic default chart attached."""
        puzzle_doc = """
Directions (Q66-70): Seven persons P, Q, R, S, T, U, V sit around a circular table facing the centre. P is second to the left of Q. R is immediately right of Q. T is immediately left of U. V occupies the remaining seat.

66. Who sits immediately right of Q?
(A) P
(B) R
(C) S
(D) T
Answer: B
"""
        sections, questions = parse_document_file(puzzle_doc.encode('utf-8'), "Puzzle_Test.txt")
        self.assertEqual(len(questions), 1)
        q = questions[0]
        self.assertIsNone(q.get("visualId"))
        self.assertEqual(q.get("visualReferences"), [])
        self.assertIsNone(q.get("chartData"))

if __name__ == '__main__':
    unittest.main()
