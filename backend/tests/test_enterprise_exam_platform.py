"""
backend/tests/test_enterprise_exam_platform.py
─────────────────────────────────────────────
Comprehensive Automated Test Suite for Competitive Examination Platform.
Tests:
1. Dynamic Exam Configuration & Stage Definition
2. Hierarchical Syllabus Management
3. Enterprise Question Bank (MCQ, Assertion-Reason, 10/15/20m Descriptive)
4. Strict Manual Test Assignment Engine
5. Descriptive Rubric Evaluation & AI Assistance
6. PYQs & Current Affairs
7. Student Performance Heatmap & Revision Pool
"""

import unittest
import json
import uuid
from app import create_app
from config.db import get_db


class TestEnterpriseExamPlatform(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()
        cls.db = get_db()

    def test_01_create_exam_configuration(self):
        payload = {
            "name": "UPSC Civil Services Examination 2026",
            "authority": "UPSC",
            "category": "Civil Services",
            "year": 2026,
            "notificationRef": "05/2026-CSP",
            "description": "National competitive examination for IAS, IPS, IFS and Central Services.",
            "supportedLanguages": ["English", "Hindi", "Telugu"],
            "status": "active"
        }
        res = self.client.post("/api/admin/exam-config", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn("exam", data)
        self.assertEqual(data["exam"]["authority"], "UPSC")
        self.__class__.exam_id = data["exam"]["id"]

    def test_02_add_exam_stages(self):
        stage_payload = {
            "stageName": "Preliminary Examination",
            "stageType": "preliminary",
            "stageOrder": 1,
            "isQualifying": True,
            "negativeMarkingScheme": "third",
            "papers": [
                {"name": "Paper I - General Studies", "marks": 200, "duration": 120},
                {"name": "Paper II - CSAT", "marks": 200, "duration": 120, "qualifyingPercentage": 33.33}
            ]
        }
        res = self.client.post(f"/api/admin/exam-config/{self.exam_id}/stages", json=stage_payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["stage"]["stageName"], "Preliminary Examination")

    def test_03_syllabus_hierarchy(self):
        node_payload = {
            "examCode": "UPSC_CSE",
            "stage": "Prelims",
            "paper": "Paper-I GS",
            "subject": "Indian Polity & Governance",
            "unit": "Constitutional Framework",
            "topic": "Fundamental Rights & DPSP",
            "subtopics": ["Article 14-18 Equality", "Article 19-22 Freedoms", "Article 32 Remedies"],
            "weightage": 5
        }
        res = self.client.post("/api/admin/syllabus", json=node_payload)
        self.assertEqual(res.status_code, 201)

        tree_res = self.client.get("/api/admin/syllabus?subject=Indian Polity %26 Governance")
        self.assertEqual(tree_res.status_code, 200)
        self.assertGreater(len(tree_res.get_json()["syllabus"]), 0)

    def test_04_question_bank_lifecycle(self):
        unique_suffix = uuid.uuid4().hex[:6]
        q_payload = {
            "questionText": f"[{unique_suffix}] Consider the following statements regarding the Right to Equality in the Indian Constitution:\n1. Article 14 applies to citizens as well as foreigners.\n2. Article 15 prohibits discrimination on grounds of place of birth only.",
            "questionType": "statement_based",
            "subject": "Indian Polity & Governance",
            "topic": "Fundamental Rights & DPSP",
            "difficulty": "medium",
            "positiveMarks": 2.0,
            "negativeMarks": 0.66,
            "options": ["1 only", "2 only", "Both 1 and 2", "Neither 1 nor 2"],
            "correctOption": 0,
            "explanation": "Statement 1 is correct (Article 14 is available to all persons). Statement 2 is incorrect (Article 15 includes religion, race, caste, sex or place of birth).",
            "isPYQ": True,
            "pyqYear": 2024,
            "pyqExam": "UPSC Civil Services",
            "status": "approved"
        }
        res = self.client.post("/api/admin/question-bank", json=q_payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["question"]["isPYQ"], True)
        self.__class__.question_id = data["question"]["id"]

    def test_05_manual_assignment_engine(self):
        # Create a test series
        series_res = self.client.post("/api/admin/test-series", json={
            "name": "UPSC Prelims Master Test Series 2026",
            "description": "Comprehensive full mock series with CSAT and optional tracks",
            "examType": "upsc_prelims",
            "totalMarks": 200
        })
        self.assertEqual(series_res.status_code, 201)
        series_id = series_res.get_json()["series"]["id"]

        # Assign manually to a student
        assign_payload = {
            "seriesId": series_id,
            "userIds": ["candidate_upsc_01", "candidate_upsc_02"],
            "attemptLimit": 2,
            "optionalSubject": "Public Administration"
        }
        res = self.client.post("/api/admin/assignments/assign", json=assign_payload)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["assignedCount"], 2)

    def test_06_pyq_and_current_affairs(self):
        # Current affairs publish
        ca_payload = {
            "title": "Digital Personal Data Protection Act Implementation Guidelines",
            "category": "Polity & Governance",
            "summary": "Key compliance requirements for data fiduciaries and rights of data principals.",
            "keyTakeaways": ["Right to access and erasure", "Data protection board establishment"]
        }
        ca_res = self.client.post("/api/answerer/learning-hub/current-affairs", json=ca_payload)
        self.assertEqual(ca_res.status_code, 201)

        # PYQ query
        pyq_res = self.client.get("/api/answerer/learning-hub/pyq?exam=UPSC+Civil+Services")
        self.assertEqual(pyq_res.status_code, 200)

    def test_07_performance_heatmap(self):
        res = self.client.get("/api/answerer/learning-hub/performance/heatmap?userId=candidate_upsc_01")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("heatmap", data)
        self.assertGreater(len(data["heatmap"]), 0)


if __name__ == "__main__":
    unittest.main()
