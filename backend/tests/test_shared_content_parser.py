import io
import unittest
from services.document_parser import parse_document_file, _parse_text
from services.question_group_detector import QuestionGroupDetectorService


class SharedContentParserTests(unittest.TestCase):
    """
    Automated test suite verifying shared diagram / graph / table / passage / directions
    associations across question ranges, clean question stems, 5-option parsing, and answer mapping.
    """

    def test_shared_graph_clustered_bar_q31_35(self):
        """
        Tests exact scenario: Directions (Q31–35) with clustered bar graph image,
        5 questions (Q31 to Q35), clean question stems, 5 options (A–E), mapped correct answers.
        """
        doc = """
Directions (Q31–35): Study the clustered bar graph given below and answer the questions based on it.
Title: Savings and Current Accounts Opened
![Extracted Diagram/Graph](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

31. Total savings accounts opened in 2022 and 2026 = ?
(A) 250 hundred
(B) 260 hundred
(C) 270 hundred
(D) 280 hundred
(E) 290 hundred
Answer: C

32. What is the difference between savings and current accounts in 2024?
(A) 40 hundred
(B) 50 hundred
(C) 60 hundred
(D) 70 hundred
(E) 80 hundred
Answer: B

33. What is the average number of savings accounts opened across all 5 years?
(A) 110 hundred
(B) 114 hundred
(C) 120 hundred
(D) 125 hundred
(E) 130 hundred
Answer: B

34. Savings accounts opened in 2023 is what percentage of current accounts in 2025?
(A) 75%
(B) 80%
(C) 85%
(D) 90%
(E) 95%
Answer: A

35. What is the ratio of total accounts opened in 2022 to that in 2026?
(A) 5:6
(B) 6:7
(C) 7:8
(D) 8:9
(E) 9:10
Answer: D

36. Standalone question not belonging to the graph?
(A) Option 1
(B) Option 2
(C) Option 3
(D) Option 4
(E) Option 5
Answer: A
"""
        sections, questions = parse_document_file(doc.encode('utf-8'), "BarGraph_Mock.txt")
        self.assertEqual(len(questions), 6)

        # 1. Verify Q31 to Q35 belong to shared graph group
        for idx in range(0, 5):
            q = questions[idx]
            expected_q_num = 31 + idx
            self.assertEqual(q["questionNumber"], expected_q_num)
            
            # Context contains directions & diagram reference
            self.assertIn("Study the clustered bar graph", q["context"])
            self.assertIn("Savings and Current Accounts Opened", q["context"])
            
            # Shared identifiers and ranges
            self.assertEqual(q["groupId"], "shared_31_35")
            self.assertEqual(q["sharedContentId"], "shared_31_35")
            self.assertEqual(q["questionRange"], {"start": 31, "end": 35})
            
            # Clean structured sharedContent
            self.assertIsNotNone(q.get("sharedContent"))
            self.assertEqual(q["sharedContent"]["id"], "shared_31_35")
            self.assertEqual(q["sharedContent"]["questionRange"], {"start": 31, "end": 35})
            self.assertIsNotNone(q["sharedContent"]["asset"])
            self.assertTrue(q["sharedContent"]["asset"]["url"].startswith("data:image/png;base64,"))
            
            # Visual references & imageReference
            self.assertTrue(q["imageReference"].startswith("data:image/png;base64,"))
            
            # Clean question stem (no graph or directions inside question stem)
            self.assertNotIn("Directions", q["question"])
            self.assertNotIn("Study the clustered bar graph", q["question"])
            
            # 5 options (A-E) preserved
            self.assertEqual(len(q["options"]), 5)

        # 2. Verify clean question stems & answers for each question
        self.assertEqual(questions[0]["question"], "Total savings accounts opened in 2022 and 2026 = ?")
        self.assertEqual(questions[0]["correctAnswer"], "270 hundred")
        self.assertEqual(questions[0]["options"], ["250 hundred", "260 hundred", "270 hundred", "280 hundred", "290 hundred"])

        self.assertEqual(questions[1]["question"], "What is the difference between savings and current accounts in 2024?")
        self.assertEqual(questions[1]["correctAnswer"], "50 hundred")

        self.assertEqual(questions[2]["question"], "What is the average number of savings accounts opened across all 5 years?")
        self.assertEqual(questions[2]["correctAnswer"], "114 hundred")

        self.assertEqual(questions[3]["question"], "Savings accounts opened in 2023 is what percentage of current accounts in 2025?")
        self.assertEqual(questions[3]["correctAnswer"], "75%")

        self.assertEqual(questions[4]["question"], "What is the ratio of total accounts opened in 2022 to that in 2026?")
        self.assertEqual(questions[4]["correctAnswer"], "8:9")

        # 3. Verify Q36 is standalone with NO shared context
        q36 = questions[5]
        self.assertEqual(q36["questionNumber"], 36)
        self.assertEqual(q36["context"], "")
        self.assertIsNone(q36["groupId"])
        self.assertIsNone(q36["sharedContentId"])
        self.assertIsNone(q36["questionRange"])
        self.assertIsNone(q36["sharedContent"])

    def test_shared_reading_comprehension_passage_q11_15(self):
        """
        Tests shared passage block associated with Q11-15.
        """
        doc = """
Directions (Q11–15): Read the following passage carefully and answer the questions.
Financial inclusion is a key driver for economic development across rural districts.
The Reserve Bank of India has mandated priority sector lending to ensure access.

11. What is the primary driver for economic development according to the passage?
A) Industrial subsidies
B) Financial inclusion
C) Foreign investments
D) Cryptocurrency
E) Urban migration
Answer: B

12. Who mandated priority sector lending?
A) Ministry of Finance
B) Reserve Bank of India
C) World Bank
D) SEBI
E) NABARD
Answer: B

13. The passage primarily discusses which demographic?
A) Rural districts
B) Metropolitan cities
C) International markets
D) IT corridors
E) Export zones
Answer: A
"""
        sections, questions = parse_document_file(doc.encode('utf-8'), "Passage_Mock.txt")
        self.assertEqual(len(questions), 3)

        for q in questions:
            self.assertIn("Financial inclusion is a key driver", q["context"])
            self.assertEqual(q["contextType"], "passage")
            self.assertEqual(q["groupId"], "shared_11_15")
            self.assertEqual(q["questionRange"], {"start": 11, "end": 15})
            self.assertNotIn("Financial inclusion is a key driver", q["question"])

        self.assertEqual(questions[0]["question"], "What is the primary driver for economic development according to the passage?")
        self.assertEqual(questions[0]["correctAnswer"], "Financial inclusion")

    def test_shared_table_data_interpretation_q46_50(self):
        """
        Tests shared DI markdown table associated across Q46-50.
        """
        doc = """
Directions (Q46–50): Study the table given below and answer the following questions.
| Branch | Total Staff | Officers | Clerks |
| Mumbai | 1200 | 400 | 800 |
| Delhi | 900 | 300 | 600 |
| Kolkata | 600 | 150 | 450 |

46. What is the ratio of officers in Mumbai to clerks in Delhi?
A) 2:3
B) 1:2
C) 3:4
D) 4:5
E) 5:6
Answer: A

47. What is the total number of clerks across all 3 branches?
A) 1750
B) 1800
C) 1850
D) 1900
E) 1950
Answer: C
"""
        sections, questions = parse_document_file(doc.encode('utf-8'), "Table_Mock.txt")
        self.assertEqual(len(questions), 2)

        for q in questions:
            self.assertIn("| Mumbai | 1200 | 400 | 800 |", q["context"])
            self.assertEqual(q["contextType"], "table")
            self.assertEqual(q["groupId"], "shared_46_50")
            self.assertEqual(q["questionRange"], {"start": 46, "end": 50})

        self.assertEqual(questions[0]["question"], "What is the ratio of officers in Mumbai to clerks in Delhi?")
        self.assertEqual(questions[0]["correctAnswer"], "2:3")

    def test_diverse_answer_checkmark_and_key_formats(self):
        """
        Tests various answer formats: checkmarks (✓, ✔), Ans: C, 31 - C, Right Option: B.
        """
        doc = """
1. Question with checkmark symbol?
A) First option
B) Second option ✓
C) Third option
D) Fourth option

2. Question with explicit answer prefix?
A) Option A
B) Option B
C) Option C
D) Option D
Ans: C

3. Question with dash answer format?
A) Alpha
B) Beta
C) Gamma
D) Delta
Answer: 3 - D

4. Question with green checkmark character?
A) True
B) False ✔
"""
        sections, questions = parse_document_file(doc.encode('utf-8'), "AnswerFormats.txt")
        self.assertEqual(len(questions), 4)

        self.assertEqual(questions[0]["correctAnswer"], "Second option")
        self.assertEqual(questions[1]["correctAnswer"], "Option C")
        self.assertEqual(questions[2]["correctAnswer"], "Delta")
        self.assertEqual(questions[3]["correctAnswer"], "False")

    def test_dynamic_question_range_regex_formats(self):
        """
        Tests range detection for various formats: unicode en-dash, em-dash, 'to', 'through', 'thru', 'and'.
        """
        test_strings = [
            ("Directions (Q31–35): Study the clustered bar graph.", (31, 35)),
            ("Directions (Q31—35): Study the graph.", (31, 35)),
            ("Directions (Q31-35): Read the data.", (31, 35)),
            ("Directions (Questions 31 to 35):", (31, 35)),
            ("Directions (Q. 31 through 35):", (31, 35)),
            ("Directions (31–35):", (31, 35)),
            ("Questions 31–35:", (31, 35)),
            ("Q31 to Q35", (31, 35)),
            ("For questions 31 to 35", (31, 35)),
            ("Study the graph for questions 31–35", (31, 35)),
            ("31. Total accounts opened in 2022 and 2026?", None),
            ("Q31: What is the ratio?", None),
        ]

        for text, expected in test_strings:
            detected = QuestionGroupDetectorService.detect_question_range(text)
            self.assertEqual(detected, expected, f"Failed for text: {text}")


if __name__ == "__main__":
    unittest.main()
