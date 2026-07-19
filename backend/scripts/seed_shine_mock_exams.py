"""Seed one complete, deterministic full-length mock for every Shine exam page.

Run from backend/:  python scripts/seed_shine_mock_exams.py
The seed is idempotent and assigns every paper to the candidate ``adithya``.
"""

from datetime import datetime
from pathlib import Path
import random
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config.db import get_db


PAPERS = [
    ("sbi-clerk-prelims", "SBI Clerk Prelims Full Mock 1", "sectional", [("English Language", 30, 30, 20), ("Numerical Ability", 35, 35, 20), ("Reasoning Ability", 35, 35, 20)], .25),
    ("sbi-clerk-mains", "SBI Clerk Mains Full Mock 1", "sectional", [("General / Financial Awareness", 50, 50, 35), ("General English", 40, 40, 35), ("Quantitative Aptitude", 50, 50, 45), ("Reasoning & Computer Aptitude", 50, 60, 45)], .25),
    ("sbi-po-prelims", "SBI PO Prelims Full Mock 1", "sectional", [("English Language", 40, 40, 20), ("Quantitative Aptitude", 30, 30, 20), ("Reasoning Ability", 30, 30, 20)], .25),
    ("sbi-po-mains", "SBI PO Mains Full Mock 1", "sectional", [("Reasoning & Computer Aptitude", 40, 60, 50), ("Data Analysis & Interpretation", 30, 60, 45), ("General / Economy / Banking Awareness", 60, 60, 45), ("English Language", 40, 20, 40)], .25),
    ("ibps-po-prelims", "IBPS PO Prelims Full Mock 1", "sectional", [("English Language", 30, 30, 20), ("Quantitative Aptitude", 35, 30, 20), ("Reasoning Ability", 35, 40, 20)], .25),
    ("ibps-po-mains", "IBPS PO Mains Full Mock 1", "sectional", [("Reasoning", 40, 60, 50), ("General / Economy / Banking Awareness", 35, 50, 25), ("English Language", 35, 40, 40), ("Data Analysis & Interpretation", 35, 50, 45)], .25),
    ("ibps-clerk-prelims", "IBPS Clerk Prelims Full Mock 1", "sectional", [("English Language", 30, 30, 20), ("Numerical Ability", 35, 35, 20), ("Reasoning Ability", 35, 35, 20)], .25),
    ("ibps-clerk-mains", "IBPS Clerk Mains Full Mock 1", "sectional", [("General / Financial Awareness", 40, 50, 20), ("General English", 40, 40, 35), ("Reasoning Ability", 40, 60, 35), ("Quantitative Aptitude", 35, 50, 30)], .25),
    ("ssc-cgl-prelims", "SSC CGL Tier I Prelims Full Mock 1", "overall", [("General Intelligence & Reasoning", 25, 50, 60), ("General Awareness", 25, 50, 60), ("Quantitative Aptitude", 25, 50, 60), ("English Comprehension", 25, 50, 60)], .25),
    ("ssc-cgl-mains", "SSC CGL Tier II Mains Paper I Full Mock 1", "overall", [("Mathematical Abilities", 30, 90, 135), ("Reasoning & General Intelligence", 30, 90, 135), ("English Language & Comprehension", 45, 135, 135), ("General Awareness", 25, 75, 135), ("Computer Knowledge", 20, 60, 135)], 1/3),
    ("ssc-chsl-prelims", "SSC CHSL Tier I Prelims Full Mock 1", "overall", [("English Language", 25, 50, 60), ("General Intelligence", 25, 50, 60), ("Quantitative Aptitude", 25, 50, 60), ("General Awareness", 25, 50, 60)], .25),
    ("ssc-chsl-mains", "SSC CHSL Tier II Mains Full Mock 1", "overall", [("Mathematical Abilities", 30, 90, 135), ("Reasoning & General Intelligence", 30, 90, 135), ("English Language & Comprehension", 40, 120, 135), ("General Awareness", 20, 60, 135), ("Computer Knowledge", 15, 45, 135)], 1/3),
    ("ssc-mts-prelims", "SSC MTS Prelims Session I Full Mock 1", "overall", [("Numerical & Mathematical Ability", 20, 60, 45), ("Reasoning Ability & Problem Solving", 20, 60, 45)], 0),
    ("ssc-mts-mains", "SSC MTS Mains Session II Full Mock 1", "overall", [("General Awareness", 25, 75, 45), ("English Language & Comprehension", 25, 75, 45)], 1/3),
]


FACTS = [
    ("Which institution is India's central bank?", "Reserve Bank of India", ["SEBI", "NABARD", "Reserve Bank of India", "SIDBI", "IRDAI"]),
    ("What does CRR stand for in banking?", "Cash Reserve Ratio", ["Credit Recovery Rate", "Cash Reserve Ratio", "Current Repo Ratio", "Capital Return Ratio", "Cash Repo Reserve"]),
    ("Which body regulates the securities market in India?", "SEBI", ["RBI", "SEBI", "IRDAI", "PFRDA", "NABARD"]),
    ("The headquarters of the Reserve Bank of India is in which city?", "Mumbai", ["Delhi", "Kolkata", "Chennai", "Mumbai", "Hyderabad"]),
    ("Which is the largest planet in the Solar System?", "Jupiter", ["Earth", "Mars", "Jupiter", "Saturn", "Venus"]),
    ("Article 21 of the Constitution of India protects which right?", "Life and personal liberty", ["Equality of opportunity", "Freedom of religion", "Life and personal liberty", "Constitutional remedies", "Education only"]),
    ("Who presides over the Rajya Sabha?", "Vice-President of India", ["Prime Minister", "President", "Speaker", "Vice-President of India", "Chief Justice"]),
    ("What is the SI unit of electric current?", "Ampere", ["Volt", "Watt", "Ohm", "Ampere", "Joule"]),
    ("Which gas is most abundant in Earth's atmosphere?", "Nitrogen", ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen", "Argon"]),
    ("The Indian Constitution came into force on which date?", "26 January 1950", ["15 August 1947", "26 November 1949", "26 January 1950", "2 October 1950", "26 January 1949"]),
    ("What does GDP measure?", "Value of final goods and services produced", ["Only government income", "Value of final goods and services produced", "Only exports", "Currency in circulation", "Bank deposits"]),
    ("Which river is known as the Sorrow of Bihar?", "Kosi", ["Ganga", "Kosi", "Yamuna", "Godavari", "Narmada"]),
    ("The one-rupee note in India is issued by whom?", "Government of India", ["RBI", "SBI", "Government of India", "SEBI", "NABARD"]),
    ("Which bank is called the banker to the Government of India?", "Reserve Bank of India", ["SBI", "Reserve Bank of India", "NABARD", "PNB", "Bank of India"]),
    ("What is the full form of NEFT?", "National Electronic Funds Transfer", ["National Exchange of Fund Technology", "National Electronic Funds Transfer", "New Electronic Finance Transfer", "National Easy Fund Transaction", "Net Enabled Fund Transfer"]),
]

ENGLISH = [
    ("Choose the correctly spelt word.", "Accommodation", ["Accomodation", "Accommodation", "Acommodation", "Accommadation", "Acomodation"]),
    ("Choose the synonym of 'abundant'.", "Plentiful", ["Scarce", "Plentiful", "Narrow", "Ancient", "Weak"]),
    ("Choose the antonym of 'expand'.", "Contract", ["Extend", "Enlarge", "Contract", "Develop", "Increase"]),
    ("Fill in the blank: She ___ to the library every day.", "goes", ["go", "goes", "going", "gone", "is go"]),
    ("Choose the grammatically correct sentence.", "Neither of the answers is correct.", ["Neither of the answers are correct.", "Neither of the answers is correct.", "Neither answers is correct.", "Neither of answer are correct.", "Neither answer have correct."]),
    ("One word for a person who can use both hands equally well is:", "Ambidextrous", ["Ambiguous", "Ambidextrous", "Anonymous", "Amphibious", "Arbitrary"]),
    ("Choose the synonym of 'concise'.", "Brief", ["Lengthy", "Brief", "Unclear", "Harsh", "Slow"]),
    ("Fill in the blank: By next month, they ___ the project.", "will have completed", ["complete", "completed", "will complete", "will have completed", "are completed"]),
    ("Choose the antonym of 'optimistic'.", "Pessimistic", ["Hopeful", "Cheerful", "Pessimistic", "Confident", "Positive"]),
    ("Select the correctly punctuated sentence.", "However, we decided to continue.", ["However we, decided to continue.", "However, we decided to continue.", "However we decided, to continue.", "However; we, decided to continue.", "However we decided to, continue."]),
]


def _options(correct, distractors, size, rng):
    values = [str(correct)] + [str(x) for x in distractors if str(x) != str(correct)]
    values = list(dict.fromkeys(values))
    while len(values) < size:
        values.append(str(float(correct) + len(values)) if isinstance(correct, (int, float)) else f"None {len(values)}")
    values = values[:size]
    rng.shuffle(values)
    return values


def make_question(section, serial, marks, negative, option_count, rng):
    key = section.lower()
    if "english" in key:
        stem, answer, opts = ENGLISH[(serial - 1) % len(ENGLISH)]
        options = opts[:option_count]
    elif any(word in key for word in ("awareness", "economy", "financial")):
        stem, answer, opts = FACTS[(serial - 1) % len(FACTS)]
        options = opts[:option_count]
    elif "computer" in key and "reasoning" not in key:
        bank = [
            ("What does CPU stand for?", "Central Processing Unit", ["Central Processing Unit", "Computer Primary Unit", "Central Program Utility", "Core Processing Utility", "Central Power Unit"]),
            ("Which memory is volatile?", "RAM", ["ROM", "SSD", "RAM", "DVD", "Hard disk"]),
            ("Which protocol is used to access web pages securely?", "HTTPS", ["FTP", "SMTP", "HTTP", "HTTPS", "POP3"]),
            ("What is the common shortcut for copying selected content?", "Ctrl+C", ["Ctrl+V", "Ctrl+X", "Ctrl+C", "Ctrl+P", "Ctrl+S"]),
        ]
        stem, answer, opts = bank[(serial - 1) % len(bank)]
        options = opts[:option_count]
    elif any(word in key for word in ("quant", "numerical", "mathematical", "data analysis")):
        a = 12 + (serial * 7) % 49
        b = 4 + (serial * 3) % 17
        if serial % 3 == 0:
            answer = a + b
            stem = f"What is {a} + {b}?"
            options = _options(answer, [answer - 2, answer + 2, answer - 1, answer + 1], option_count, rng)
        elif serial % 3 == 1:
            answer = a * b
            stem = f"Find the product of {a} and {b}."
            options = _options(answer, [answer - b, answer + b, answer - a, answer + a], option_count, rng)
        else:
            pct = [10, 20, 25, 50][serial % 4]
            base = 40 + (serial % 12) * 20
            answer = base * pct // 100
            stem = f"What is {pct}% of {base}?"
            options = _options(answer, [answer + 5, answer - 5, answer * 2, base - answer], option_count, rng)
    else:
        start = 2 + serial % 9
        step = 2 + serial % 6
        answer = start + 4 * step
        stem = f"Find the next number in the series: {start}, {start+step}, {start+2*step}, {start+3*step}, ?"
        options = _options(answer, [answer - step, answer + step, answer - 1, answer + 1], option_count, rng)

    return {
        "type": "mcq", "question": f"{stem} [Set {serial}]", "options": options,
        "correctAnswer": str(answer), "section": section, "marks": round(marks, 4),
        "negativeMarks": round(marks * negative, 4),
    }


def main():
    db = get_db()
    if not db.users.find_one({"userId": "adithya", "role": "answerer"}):
        raise SystemExit("Candidate adithya does not exist. Create the requested test user first.")

    now = datetime.utcnow()
    total_questions = 0
    for seed_key, name, timer_mode, sections, negative in PAPERS:
        duration = sum(item[3] for item in sections) if timer_mode == "sectional" else sections[0][3]
        section_config = [{"name": s, "questionCount": q, "marks": m, "duration": d} for s, q, m, d in sections]
        exam = db.exams.find_one_and_update(
            {"seedKey": seed_key},
            {"$set": {"seedKey": seed_key, "name": name, "duration": duration, "sections": [x[0] for x in sections],
                       "sectionConfig": section_config, "timerMode": timer_mode, "questionCount": sum(x[1] for x in sections),
                       "passingPercentage": 40, "status": "active", "patternSource": "official-notification", "updatedAt": now},
             "$setOnInsert": {"createdAt": now}}, upsert=True, return_document=True,
        )
        exam_id = exam["_id"]
        db.questions.delete_many({"examId": exam_id})
        rng = random.Random(seed_key)
        docs = []
        qid = 1
        option_count = 4 if seed_key.startswith("ssc-") else 5
        for section, count, section_marks, _minutes in sections:
            marks = section_marks / count
            for serial in range(1, count + 1):
                question = make_question(section, serial, marks, negative, option_count, rng)
                question.update({"examId": exam_id, "qid": f"{seed_key}-q{qid}", "createdAt": now})
                docs.append(question)
                qid += 1
        db.questions.insert_many(docs)
        db.exam_assignments.update_one(
            {"examId": exam_id, "userId": "adithya"},
            {"$set": {"status": "assigned", "assignedAt": now}}, upsert=True,
        )
        total_questions += len(docs)
        print(f"Seeded {name}: {len(docs)} questions, {duration} minutes")

    print(f"Done: {len(PAPERS)} full mocks and {total_questions} questions assigned to adithya.")


if __name__ == "__main__":
    main()
