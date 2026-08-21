import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.document_parser import parse_document_file, _parse_text
from services.multimodal_parser import ChartExtractionService, ValidationService


class BankingPOMultimodalTests(unittest.TestCase):
    def setUp(self):
        # 35-question Banking PO Quantitative Aptitude Mock Document Simulation
        self.banking_po_doc_text = """
BANKING PO QUANTITATIVE APTITUDE MOCK TEST
Section: Quantitative Aptitude
Directions (Q1–5): Study the clustered bar graph below showing branch-wise deposits and withdrawals (in ₹ lakh) and answer the questions.

PART A — CLUSTERED BAR GRAPH (Q1–5)
Title: Branch-wise Deposits and Withdrawals
Categories: Branch A, Branch B, Branch C, Branch D, Branch E
Deposits: 240, 310, 280, 360, 330
Withdrawals: 180, 220, 210, 250, 240

1. What is the total deposit in branches B and D together?
A) 650 lakh
B) 660 lakh
C) 670 lakh
D) 680 lakh
E) 690 lakh
Answer: C

2. What is the ratio of withdrawals in branch A to deposits in branch D?
A) 1:2
B) 2:3
C) 3:4
D) 1:1
E) 4:5
Answer: A

3. What is the average deposit across all 5 branches?
A) 296 lakh
B) 300 lakh
C) 304 lakh
D) 310 lakh
E) 312 lakh
Answer: A

4. Deposit in branch C is what percent of withdrawal in branch B?
A) 120%
B) 127.27%
C) 130%
D) 135%
E) 140%
Answer: B

5. Difference between total deposits and total withdrawals in all branches?
A) 480 lakh
B) 490 lakh
C) 500 lakh
D) 510 lakh
E) 520 lakh
Answer: B

Directions (Q6–10): Study the line graph showing monthly financial growth index.
PART B — LINE GRAPH (Q6–10)
Categories: Jan, Feb, Mar, Apr, May, Jun
Index: 48, 56, 64, 60, 72, 84

6. What is the percentage increase in index from Jan to Jun?
A) 60%
B) 70%
C) 75%
D) 80%
E) 85%
Answer: C

7. Average index value from Jan to Jun?
A) 64
B) 65.67
C) 66
D) 67.33
E) 68
Answer: B

8. Highest monthly growth occurred between which two months?
A) Jan - Feb
B) Feb - Mar
C) Apr - May
D) May - Jun
E) Mar - Apr
Answer: D

9. Index in May is how much more than index in Feb?
A) 12
B) 14
C) 16
D) 18
E) 20
Answer: C

10. Ratio of index in Mar to index in Jun?
A) 3:4
B) 16:21
C) 4:5
D) 5:6
E) 7:9
Answer: B

Directions (Q11–15): Study the pie chart showing distribution of loan applications.
PART C — PIE CHART (Q11–15)
Categories: Home, Personal, Vehicle, Education, Other
Share: 30%, 24%, 20%, 16%, 10%
Total applications = 2500

11. What is the total number of Home loan applications?
A) 700
B) 725
C) 750
D) 775
E) 800
Answer: C

12. Difference between Home and Personal loan applications?
A) 125
B) 150
C) 175
D) 200
E) 225
Answer: B

13. Ratio of Vehicle loan applications to Education loan applications?
A) 4:3
B) 5:4
C) 3:2
D) 5:3
E) 2:1
Answer: B

14. Angle subtended by Education loan sector at the center?
A) 54.4°
B) 57.6°
C) 60°
D) 62.4°
E) 64.8°
Answer: B

15. Total applications under Vehicle and Other loans combined?
A) 650
B) 700
C) 750
D) 800
E) 850
Answer: C

Directions (Q16–20): Study the table showing branch application statistics.
PART D — TABLE DATA INTERPRETATION (Q16–20)
| Branch | Applications | Approved | Rejected | Pending |
| P | 400 | 260 | 50 | 90 |
| Q | 600 | 420 | 80 | 100 |
| R | 500 | 350 | 60 | 90 |
| S | 800 | 560 | 120 | 120 |

16. What is the total pending applications in all branches?
A) 380
B) 400
C) 420
D) 440
E) 460
Answer: B

17. Approval rate in Branch P?
A) 60%
B) 62.5%
C) 65%
D) 67.5%
E) 70%
Answer: C

18. Ratio of approved applications in Q to S?
A) 3:4
B) 4:5
C) 5:6
D) 2:3
E) 7:8
Answer: A

19. Branch with highest rejection count?
A) P
B) Q
C) R
D) S
E) Both P and R
Answer: D

20. Total applications across all 4 branches?
A) 2100
B) 2200
C) 2300
D) 2400
E) 2500
Answer: C

Directions (Q21–25): Study the bar graph showing yearly sales.
PART E — BAR GRAPH (Q21–25)
21. Sales in 2021 was 450 units. Sales in 2022 was 600 units. Percentage growth?
A) 30%
B) 33.33%
C) 35%
D) 40%
E) 45%
Answer: B

22. If target for 2023 is 20% higher than 2022 (600 units), what is the target?
A) 700
B) 720
C) 740
D) 750
E) 780
Answer: B

23. Average sales over 2021 and 2022?
A) 500
B) 525
C) 550
D) 575
E) 600
Answer: B

24. Ratio of 2021 sales to 2022 sales?
A) 3:4
B) 4:5
C) 2:3
D) 5:6
E) 1:2
Answer: A

25. Difference in units between 2022 and 2021 sales?
A) 100
B) 125
C) 150
D) 175
E) 200
Answer: C

PART F — NUMBER SERIES (Q26–30)
26. Find missing number: 4, 9, 19, 39, ?, 159
A) 69
B) 79
C) 89
D) 99
E) 109
Answer: B

27. Find missing number: 12, 14, 18, 26, 42, ?
A) 64
B) 68
C) 74
D) 78
E) 84
Answer: C

28. Find missing number: 100, 50, 50, 75, 150, ?
A) 300
B) 375
C) 400
D) 425
E) 450
Answer: B

29. Find missing number: 3, 7, 16, 32, 57, ?
A) 82
B) 87
C) 93
D) 98
E) 104
Answer: C

30. Find missing number: 5, 11, 23, 47, 95, ?
A) 181
B) 189
C) 191
D) 195
E) 199
Answer: C

PART G — ARITHMETIC (Q31–35)
31. A sum of ₹18,000 becomes ₹21,600 in 2 years at simple interest. Rate per annum?
A) 8%
B) 10%
C) 12%
D) 14%
E) 15%
Answer: B

32. A and B can do a work in 12 days and 18 days respectively. Together they take?
A) 6.4 days
B) 7.2 days
C) 7.5 days
D) 8 days
E) 9 days
Answer: B

33. Cost price of 20 articles equals selling price of 16 articles. Profit %?
A) 20%
B) 25%
C) 30%
D) 33.33%
E) 35%
Answer: B

34. Speed of boat in still water is 15 km/h, stream speed is 3 km/h. Downstream time for 72 km?
A) 3 hours
B) 3.5 hours
C) 4 hours
D) 4.5 hours
E) 5 hours
Answer: C

35. Ratio of ages of P and Q is 4:5. After 6 years, sum of ages is 48. Present age of P?
A) 12 years
B) 16 years
C) 20 years
D) 24 years
E) 28 years
Answer: B

ANSWER KEY
1 C
2 A
3 A
4 B
5 B
6 C
7 B
8 D
9 C
10 B
11 C
12 B
13 B
14 B
15 C
16 B
17 C
18 A
19 D
20 C
21 B
22 B
23 B
24 A
25 C
26 B
27 C
28 B
29 C
30 C
31 B
32 B
33 B
34 C
35 B
"""

    def test_banking_po_all_35_questions_parsed_and_validated(self):
        sections, questions = parse_document_file(self.banking_po_doc_text.encode('utf-8'), "banking_po_mock.txt")

        # 1. Total 35 questions check
        self.assertEqual(len(questions), 35)

        # 2. Section check
        self.assertTrue(len(sections) >= 1)

        # 3. Question grouping & visual chart context checks
        # Q1-5: Clustered Bar Graph
        for idx in range(0, 5):
            q = questions[idx]
            self.assertEqual(q["questionNumber"], idx + 1)
            self.assertIn("Branch-wise Deposits and Withdrawals", q["context"])
            self.assertIsNotNone(q.get("chartData"))
            self.assertEqual(q["chartData"]["visual_type"], "clustered_bar_chart")
            self.assertEqual(q["chartData"]["x_categories"], ["A", "B", "C", "D", "E"])

        # Q6-10: Line Graph
        for idx in range(5, 10):
            q = questions[idx]
            self.assertEqual(q["questionNumber"], idx + 1)
            self.assertIsNotNone(q.get("chartData"))
            self.assertIn(q["chartData"]["visual_type"], ["line_chart", "multi_line_chart"])

        # Q11-15: Pie Chart
        for idx in range(10, 15):
            q = questions[idx]
            self.assertEqual(q["questionNumber"], idx + 1)
            self.assertIsNotNone(q.get("chartData"))
            self.assertEqual(q["chartData"]["visual_type"], "pie_chart")
            self.assertEqual(q["chartData"]["unit"], "%")

        # Q16-20: Table DI
        for idx in range(15, 20):
            q = questions[idx]
            self.assertEqual(q["questionNumber"], idx + 1)
            self.assertEqual(q["contextType"], "table")
            self.assertIsNotNone(q.get("tableData"))
            self.assertEqual(q["tableData"]["columns"], ["Branch", "Applications", "Approved", "Rejected", "Pending"])

        # Q26-30: Number Series
        for idx in range(25, 30):
            q = questions[idx]
            self.assertEqual(q["questionNumber"], idx + 1)
            self.assertTrue(len(q["options"]) == 5)

        # 4. Answer Key validation check for all 35 questions
        expected_answers = [
            "670 lakh", "1:2", "296 lakh", "127.27%", "490 lakh",
            "75%", "65.67", "May - Jun", "16", "16:21",
            "750", "150", "5:4", "57.6°", "750",
            "400", "65%", "3:4", "S", "2300",
            "33.33%", "720", "525", "3:4", "150",
            "79", "74", "375", "93", "191",
            "10%", "7.2 days", "25%", "4 hours", "16 years"
        ]

        for idx, expected in enumerate(expected_answers):
            q = questions[idx]
            self.assertEqual(q["validationStatus"], "passed", f"Question #{idx+1} failed validation: {q.get('validationError')}")
            self.assertEqual(q["correctAnswer"], expected, f"Question #{idx+1} answer mapped as {q['correctAnswer']}, expected {expected}")

    def test_chart_extraction_generic_detection(self):
        sample_text = """
        Directions: Study the clustered bar graph below showing deposits and withdrawals.
        Branch A: 240, 180
        Branch B: 310, 220
        """
        chart_info = ChartExtractionService.extract_chart_data(sample_text)
        self.assertEqual(chart_info["visual_type"], "clustered_bar_chart")
        self.assertTrue(chart_info["confidence"] >= 0.8)


if __name__ == "__main__":
    unittest.main()
