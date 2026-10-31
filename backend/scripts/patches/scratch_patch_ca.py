import re
import ast
from pathlib import Path

ca_path = Path("backend/routes/current_affairs_engine.py")
content = ca_path.read_text(encoding="utf-8")

old_list_articles_regex = re.compile(
    r'@ca_engine_bp\.route\("/articles", methods=\["GET"\]\)\s*\n'
    r'def list_articles\(\):.*?'
    r'    return jsonify\(\{\s*\n'
    r'\s*"total": total,\s*\n'
    r'\s*"page": page,\s*\n'
    r'\s*"limit": limit,\s*\n'
    r'\s*"categories": DEFAULT_CATEGORIES,\s*\n'
    r'\s*"articles": to_jsonable\(\[_serialize\(a\) for a in articles\]\)\s*\n'
    r'\s*\}\)',
    re.DOTALL
)

new_list_articles = '''@ca_engine_bp.route("/articles", methods=["GET"])
def list_articles():
    """List current affairs with advanced compound filters and role-aware status defaults."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    and_conditions = []

    if tenant_id and tenant_id != "all":
        and_conditions.append({
            "$or": [
                {"tenantId": tenant_id},
                {"tenantId": {"$exists": False}},
                {"tenantId": None},
            ]
        })

    category = request.args.get("category")
    status = request.args.get("status")
    exam = request.args.get("exam")
    stage = request.args.get("stage")
    priority = request.args.get("priority")
    date = request.args.get("date")
    month = request.args.get("month")
    is_important = request.args.get("isImportant")
    search = request.args.get("search", "").strip()

    # Role-aware status check: non-admin students should ONLY see published articles
    user_role = (request.headers.get("X-User-Role") or "").lower().strip()
    is_admin = user_role in ("admin", "super_admin") or "/admin/" in request.path

    if category and category.lower() != "all":
        and_conditions.append({"category": {"$regex": f"^{re.escape(category)}$", "$options": "i"}})
    if status:
        and_conditions.append({"status": status})
    elif not is_admin:
        # Default to published for candidates
        and_conditions.append({"status": "published"})

    if exam:
        and_conditions.append({"applicableExams": exam})
    if stage:
        and_conditions.append({"examRelevance": stage})
    if priority:
        and_conditions.append({"priority": priority})
    if date:
        clean_date = date.strip().split("T")[0]
        and_conditions.append({
            "$or": [
                {"publishDate": clean_date},
                {"publishDate": {"$regex": f"^{re.escape(clean_date)}"}},
            ]
        })
    if month:
        clean_month = month.strip()
        and_conditions.append({
            "$or": [
                {"month": clean_month},
                {"publishDate": {"$regex": f"^{re.escape(clean_month)}"}},
            ]
        })
    if is_important is not None:
        and_conditions.append({"isHighlyImportant": is_important.lower() in ("true", "1")})
    if search:
        and_conditions.append({
            "$or": [
                {"title": {"$regex": search, "$options": "i"}},
                {"shortSummary": {"$regex": search, "$options": "i"}},
                {"detailedExplanation": {"$regex": search, "$options": "i"}},
                {"category": {"$regex": search, "$options": "i"}},
                {"tags": {"$regex": search, "$options": "i"}},
                {"keywords": {"$regex": search, "$options": "i"}},
            ]
        })

    query = {"$and": and_conditions} if and_conditions else {}

    page = max(1, int(request.args.get("page", 1)))
    limit = min(200, max(1, int(request.args.get("limit", 50))))
    skip = (page - 1) * limit

    total = db.current_affairs.count_documents(query)
    articles = list(db.current_affairs.find(query).sort("publishDate", -1).skip(skip).limit(limit))

    return jsonify({
        "total": total,
        "page": page,
        "limit": limit,
        "categories": DEFAULT_CATEGORIES,
        "articles": to_jsonable([_serialize(a) for a in articles])
    })'''

assert old_list_articles_regex.search(content) is not None, "Could not match list_articles in current_affairs_engine.py"
content = old_list_articles_regex.sub(new_list_articles, content, count=1)

ast.parse(content)
ca_path.write_text(content, encoding="utf-8")
print("SUCCESS: current_affairs_engine.py updated and verified syntax!")

