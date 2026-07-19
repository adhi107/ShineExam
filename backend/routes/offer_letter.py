import os
import re
import shutil
import zipfile
import tempfile
import subprocess
from datetime import datetime

from flask import Blueprint, jsonify, send_file
from bson import ObjectId

from config.db import get_db


offer_letter_bp = Blueprint("offer_letter", __name__)

TEMPLATE_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "templates",
    "offer_letter_template.docx"
)


def _patch_footer(xml: str) -> str:
    """
    Reduce footer font sizes and adjust positioning
    so footer content does not get clipped.
    """

    # Fit Shine DevCon offer footer text inside the template footer area.
    xml = xml.replace(
        'w:sz w:val="22"',
        'w:sz w:val="18"'
    )

    # Give the left footer box enough height for college and contact details.
    xml = xml.replace(
        'cx="3143250" cy="565785"',
        'cx="3143250" cy="650000"'
    )

    # Align the left footer block with the Shine DevCon template strip.
    xml = xml.replace(
        '<wp:posOffset>9846688</wp:posOffset>',
        '<wp:posOffset>9780000</wp:posOffset>'
    )

    # Align the right footer block with the Shine DevCon template strip.
    xml = xml.replace(
        '<wp:posOffset>9971961</wp:posOffset>',
        '<wp:posOffset>9790000</wp:posOffset>'
    )

    return xml


def _generate_offer_letter(
    user_name: str,
    nax_unid: str,
    college_name: str
) -> tuple:

    tmp_dir = tempfile.mkdtemp(prefix="offer_")

    tmp_docx = os.path.join(tmp_dir, "offer_output.docx")

    shutil.copy2(TEMPLATE_PATH, tmp_docx)

    extract_dir = os.path.join(tmp_dir, "extracted")

    os.makedirs(extract_dir, exist_ok=True)

    # Extract the Shine DevCon DOCX template so candidate fields can be patched.
    with zipfile.ZipFile(tmp_docx, "r") as z:
        z.extractall(extract_dir)

    # Patch the main Shine DevCon offer letter document XML.

    doc_xml_path = os.path.join(
        extract_dir,
        "word",
        "document.xml"
    )

    with open(doc_xml_path, "r", encoding="utf-8") as f:
        xml = f.read()

    # Replace the sample DevCon ID with the candidate's NAX login ID.

    xml = xml.replace(
        ">1500001<",
        f">{nax_unid}<"
    )

    # Stamp the offer letter with today's issue date.

    current_date = datetime.now().strftime("%d-%b-%Y")

    xml = xml.replace(
        ">21-Jan-2026<",
        f">{current_date}<"
    )

    # Insert the candidate's college name into the offer template.

    xml = xml.replace(
        ">Sri Vasavi Engineering College <",
        f">{college_name} <"
    )

    xml = xml.replace(
        ">Sri Vasavi Engineering College<",
        f">{college_name}<"
    )

    # Personalize the greeting line for the candidate.

    xml = xml.replace(
        ">Yerra<",
        f">{user_name},<",
        1
    )

    xml = xml.replace(
        ">Lalitha,<",
        "><",
        1
    )

    # Personalize the acceptance line with the candidate name.

    xml = xml.replace(
        ">Yerra<",
        f">{user_name}<",
        1
    )

    xml = xml.replace(
        ">Lalitha,<",
        "><",
        1
    )

    # Normalize spacing introduced by the template placeholder replacement.
    xml = re.sub(
        r'(<w:t[^>]*>)\s{2,}(confirm)',
        r'\1 \2',
        xml
    )

    # Remove the unused template paragraph so the offer layout stays compact.

    xml = re.sub(
        r'<w:p w14:paraId="0D0B940D".*?</w:p>',
        '',
        xml,
        flags=re.DOTALL
    )

    # Align the decorative left strip with the Shine DevCon letter edge.

    xml = xml.replace(
        '<wp:posOffset>21699</wp:posOffset>',
        '<wp:posOffset>0</wp:posOffset>'
    )

    # Save the patched candidate-specific offer letter XML.
    with open(doc_xml_path, "w", encoding="utf-8") as f:
        f.write(xml)

    # Patch the Shine DevCon footer XML when the template includes one.

    footer_xml_path = os.path.join(
        extract_dir,
        "word",
        "footer1.xml"
    )

    if os.path.exists(footer_xml_path):

        with open(footer_xml_path, "r", encoding="utf-8") as f:
            footer_xml = f.read()

        footer_xml = _patch_footer(footer_xml)

        with open(footer_xml_path, "w", encoding="utf-8") as f:
            f.write(footer_xml)

    # Repack the edited Shine DevCon offer letter as a DOCX.

    final_docx_path = os.path.join(
        tmp_dir,
        "offer_final.docx"
    )

    with zipfile.ZipFile(
        final_docx_path,
        "w",
        zipfile.ZIP_DEFLATED
    ) as zout:

        for root, dirs, files in os.walk(extract_dir):

            for file in files:

                file_path = os.path.join(root, file)

                arcname = os.path.relpath(
                    file_path,
                    extract_dir
                )

                zout.write(file_path, arcname)

    # Convert the candidate offer letter to a downloadable PDF.

    result = subprocess.run(
        [
            "/usr/bin/libreoffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            tmp_dir,
            final_docx_path,
        ],
        capture_output=True,
        text=True,
        timeout=60,
        env={
            **os.environ,
            "HOME": tmp_dir
        },
    )

    pdf_path = os.path.join(
        tmp_dir,
        "offer_final.pdf"
    )

    if result.returncode != 0 or not os.path.exists(pdf_path):
        raise RuntimeError(
            f"PDF conversion failed: {result.stderr}"
        )

    return pdf_path, tmp_dir


@offer_letter_bp.route("/<user_id>", methods=["GET"])
def generate_offer_letter(user_id: str):

    db = get_db()

    try:
        user = db.users.find_one({
            "_id": ObjectId(user_id)
        })

    except Exception:

        user = db.users.find_one({
            "userId": user_id
        })

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    # Candidate details used to personalize the Shine DevCon offer letter.

    name = user.get("name", "Associate")

    nax_unid = (
        user.get("naxUnid")
        or user.get("userId", "N/A")
    )

    # Use the registered college name on the candidate offer letter.
    college_name = (
        user.get("collegeName")
        or user.get("college")
        or "College"
    )

    # Confirm the Shine DevCon offer template is available before generation.

    if not os.path.exists(TEMPLATE_PATH):

        return jsonify({
            "error": "Offer letter template not found on server"
        }), 500

    try:

        output_path, tmp_dir = _generate_offer_letter(
            user_name=name,
            nax_unid=nax_unid,
            college_name=college_name
        )

        safe_name = re.sub(
            r"[^\w\s-]",
            "",
            name
        ).strip().replace(" ", "_")

        download_name = (
            f"{safe_name}_Devcon_Offer_Letter.pdf"
        )

        response = send_file(
            output_path,
            as_attachment=True,
            download_name=download_name,
            mimetype="application/pdf",
        )

        @response.call_on_close
        def cleanup():
            shutil.rmtree(tmp_dir, ignore_errors=True)

        return response

    except Exception as e:

        return jsonify({
            "error": f"Failed to generate offer letter: {str(e)}"
        }), 500
