with open('backend/routes/learning_resources.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = '@admin_documents_bp.delete("/<document_id>")'
if target in text:
    addition = '''@admin_documents_bp.get("/<document_id>/view")
def admin_view_document(document_id):
    db = get_db()
    try: oid = ObjectId(document_id)
    except Exception: return jsonify({"error": "Invalid document id"}), 400
    doc = db.documents.find_one({"_id": oid})
    if not doc: return jsonify({"error": "Document not found"}), 404
    path = UPLOAD_DIR / doc.get("filename", "")
    if not path.is_file(): return jsonify({"error": "Document file is missing"}), 404
    return send_file(path, as_attachment=False, download_name=doc.get("originalName") or path.name, mimetype=doc.get("mimeType"))


@admin_documents_bp.get("/<document_id>/download")
def admin_download_document(document_id):
    db = get_db()
    try: oid = ObjectId(document_id)
    except Exception: return jsonify({"error": "Invalid document id"}), 400
    doc = db.documents.find_one({"_id": oid})
    if not doc: return jsonify({"error": "Document not found"}), 404
    path = UPLOAD_DIR / doc.get("filename", "")
    if not path.is_file(): return jsonify({"error": "Document file is missing"}), 404
    return send_file(path, as_attachment=True, download_name=doc.get("originalName") or path.name, mimetype=doc.get("mimeType"))


'''
    text = text.replace(target, addition + target, 1)
    with open('backend/routes/learning_resources.py', 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    print("Successfully added admin document view & download routes to learning_resources.py")
else:
    print("Could not find target in learning_resources.py")

