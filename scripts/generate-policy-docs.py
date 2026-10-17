"""Generate fictional policy PDFs and editable Markdown from the same source.

Run with the bundled Python runtime; no API keys or running servers are needed.
"""
import argparse
import json
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "docs" / "policies" / "policies.json"
GREEN = colors.HexColor("#244D3B")
MUTED = colors.HexColor("#66756C")
LINE = colors.HexColor("#DDE5DF")
PALE = colors.HexColor("#F1F6F1")
INK = colors.HexColor("#25342D")
PAGE_W, PAGE_H = A4
WIDTH = PAGE_W - 100


def register_fonts():
    font_dir = Path("C:/Windows/Fonts")
    regular, bold = font_dir / "arial.ttf", font_dir / "arialbd.ttf"
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("PolicySans", str(regular)))
        pdfmetrics.registerFont(TTFont("PolicySansBold", str(bold)))
        pdfmetrics.registerFontFamily("PolicySans", normal="PolicySans", bold="PolicySansBold")
        return "PolicySans", "PolicySansBold"
    return "Helvetica", "Helvetica-Bold"


def make_styles():
    regular, bold = register_fonts()
    base = getSampleStyleSheet()
    return {
        "body": ParagraphStyle("PolicyBody", fontName=regular, fontSize=9, leading=14, textColor=INK, spaceAfter=8),
        "small": ParagraphStyle("PolicySmall", fontName=regular, fontSize=8, leading=12, textColor=MUTED, spaceAfter=7),
        "label": ParagraphStyle("PolicyLabel", fontName=bold, fontSize=7, leading=11, textColor=MUTED, spaceAfter=5),
        "title": ParagraphStyle("PolicyTitle", fontName=bold, fontSize=29, leading=33, textColor=GREEN, spaceAfter=12),
        "subtitle": ParagraphStyle("PolicySubtitle", fontName=regular, fontSize=12, leading=17, textColor=MUTED, spaceAfter=18),
        "heading": ParagraphStyle("PolicyHeading", fontName=bold, fontSize=12, leading=17, textColor=GREEN, spaceBefore=14, spaceAfter=9),
        "cell": ParagraphStyle("PolicyCell", fontName=regular, fontSize=8.5, leading=13, textColor=INK),
        "value": ParagraphStyle("PolicyValue", fontName=bold, fontSize=11, leading=16, textColor=GREEN),
        "notice": ParagraphStyle("PolicyNotice", fontName=regular, fontSize=8, leading=12, textColor=GREEN),
        "regular_font": regular,
        "bold_font": bold,
    }


def para(text, styles, kind="body"):
    return Paragraph(escape(str(text)), styles[kind])


def money(amount, currency="USD"):
    return f"{currency} {amount:,.0f}"


def readable_timestamp(value):
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return stamp.strftime("%d %b %Y, %H:%M UTC")


def notice(text, styles):
    box = Table([[para(text, styles, "notice")]], colWidths=[WIDTH])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 13),
        ("RIGHTPADDING", (0, 0), (-1, -1), 13),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return box


def fact_row(facts, styles):
    columns = []
    for label, value in facts:
        columns.append([para(label.upper(), styles, "label"), para(value, styles, "value")])
    table = Table([columns], colWidths=[WIDTH / len(facts)] * len(facts))
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LINEAFTER", (0, 0), (-2, -1), 0.6, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    return table


def section(title, text, styles):
    return [para(title, styles, "heading"), para(text, styles)]


def coverage_table(policy, styles):
    rows = [[para("LISTED COVERAGE", styles, "label"), para("LIMIT", styles, "label")]]
    rows += [[para(item["name"], styles, "cell"), para(money(item["limit"]), styles, "cell")] for item in policy["coverages"]]
    table = Table(rows, colWidths=[WIDTH * 0.74, WIDTH * 0.26], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return table


def bullet_list(items, styles):
    return [Paragraph(f"<font color='#7A9585'>\u2022</font>  {escape(item)}", styles["body"]) for item in items]


def schedule_page(policy, pack, styles):
    story = [Spacer(1, 12), para("MOTOR POLICY / DEMO SERIES", styles, "label")]
    story += [para("Motor policy schedule", styles, "title"), para(policy["title"], styles, "subtitle")]
    story += [notice(pack["notice"], styles), Spacer(1, 20)]
    story += [fact_row([("Policy number", policy["id"]), ("Status", policy["status"]), ("Currency", "USD")], styles)]
    story += section("01  Policyholder", f"{policy['holderName']} | {policy['holderId']} | {policy['holderEmail']}", styles)
    story += section("02  Effective timestamps", f"From: {readable_timestamp(policy['effectiveFrom'])}. To: {readable_timestamp(policy['effectiveTo'])}. Compare the reported incident timestamp with these values; clarify the incident timezone before submission.", styles)
    story += [para("03  Listed coverages and limits", styles, "heading"), coverage_table(policy, styles)]
    story += section("04  Deductible field", f"{money(policy['deductible'])}. This is the example policy's recorded deductible value. Coverage-specific applicability is not otherwise specified; it is not a repair estimate or payment approval.", styles)
    story += [para("05  Listed exclusions", styles, "heading"), *bullet_list(policy["exclusions"], styles)]
    return story


def guidance_page(policy, pack, styles):
    story = [Spacer(1, 12), para(f"{policy['id']} / POLICY NOTES", styles, "label")]
    story += [para("Reading this example", styles, "title"), para("Policy information for a provisional human review.", styles, "subtitle")]
    story += section("06  Coverage notes", "Only the coverages printed on the schedule are listed in this example. Do not import terms from another policy. Limits are fictional maximum field values, not promised reimbursements.", styles)
    for item in policy["coverages"]:
        story += [para(item["name"], styles, "label"), para(item["description"], styles)]
    story += [para("07  Unspecified information", styles, "heading"), *bullet_list(policy["unknowns"], styles)]
    story += section("08  When reporting an accident", "Provide the incident date and time with timezone, location, narrative, injury status, other-vehicle involvement, and any police report reference. Leave unknown information unknown. Seek local emergency assistance first if anyone is in immediate danger. A draft must be read back and explicitly confirmed before submission.", styles)
    story += section("09  Review boundaries", "The automated assistant may collect facts and describe potentially relevant policy fields. It cannot guarantee coverage, determine fault, accuse anyone of fraud, approve settlement, make a payment, or change this policy. A human insurance professional must review every finding.", styles)
    story += [Spacer(1, 9), notice("Document provenance: " + policy["source"], styles)]
    return story


def draw_page(canvas, document, policy, pack, styles):
    canvas.saveState()
    canvas.setFillColor(GREEN)
    canvas.roundRect(50, PAGE_H - 53, 17, 17, 4, fill=1, stroke=0)
    canvas.setStrokeColor(colors.white)
    canvas.setLineWidth(1.4)
    canvas.lines([(54, PAGE_H - 44, 57, PAGE_H - 44), (57, PAGE_H - 44, 59, PAGE_H - 40), (59, PAGE_H - 40, 61, PAGE_H - 48), (61, PAGE_H - 48, 64, PAGE_H - 43)])
    canvas.setFont(styles["bold_font"], 12)
    canvas.drawString(74, PAGE_H - 49, "crashline.")
    canvas.setFont(styles["regular_font"], 7)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - 50, PAGE_H - 47, "FICTIONAL POLICY DOCUMENT")
    canvas.setStrokeColor(LINE)
    canvas.line(50, 49, PAGE_W - 50, 49)
    canvas.setFont(styles["regular_font"], 7)
    canvas.drawString(50, 34, f"{policy['id']} | Synthetic demo only | Prepared {pack['preparedAt']}")
    canvas.drawRightString(PAGE_W - 50, 34, f"{document.page} / 2")
    canvas.restoreState()


def write_pdf(policy, pack, styles, directory):
    path = directory / f"{policy['filename']}.pdf"
    document = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=50, rightMargin=50,
                                 topMargin=77, bottomMargin=67, title=f"CrashLine {policy['id']} - Synthetic policy", author="CrashLine Demo")
    story = schedule_page(policy, pack, styles) + [PageBreak()] + guidance_page(policy, pack, styles)
    callback = lambda canvas, doc: draw_page(canvas, doc, policy, pack, styles)
    document.build(story, onFirstPage=callback, onLaterPages=callback)
    return path


def write_markdown(policy, pack, directory):
    lines = [f"# {policy['id']} - {policy['title']}", "", f"> {pack['notice']}", "",
             f"Prepared: {pack['preparedAt']} | Version: {pack['version']}", "", "## Policy schedule", "",
             f"- Fictional issuer: {pack['issuer']}", f"- Policy ID: `{policy['id']}`",
             f"- Policyholder: {policy['holderName']} (`{policy['holderId']}`)",
             f"- Synthetic email: `{policy['holderEmail']}`", f"- Status: `{policy['status']}`",
             f"- Effective from: `{policy['effectiveFrom']}`", f"- Effective to: `{policy['effectiveTo']}`",
             "- Currency: USD", f"- Deductible field: {money(policy['deductible'])}", "", "## Listed coverages", ""]
    for item in policy["coverages"]:
        lines += [f"### {item['name']}", "", f"Limit field: {money(item['limit'])}.", "", item["description"], ""]
    lines += ["## Listed exclusions", ""] + [f"- {item}" for item in policy["exclusions"]]
    lines += ["", "## Unspecified information", ""] + [f"- {item}" for item in policy["unknowns"]]
    lines += ["", "## Interpretation boundary", "", "Only these fictional policy fields are represented. Deductible applicability, limit aggregation, and missing terms must not be invented. Coverage observations are provisional; no fault, fraud, settlement, or payment decision is authorized.", "",
              "## Document provenance", "", policy["source"], ""]
    path = directory / f"{policy['filename']}.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_guide(pack, directory):
    lines = ["# CrashLine sample policy pack", "", "Fictional policy documents for preparing demo conversations and future agent document integration. All names, email addresses, amounts, and policy terms are synthetic.", "",
             "## Start with POL-1001", "", "The current application authenticates DEMO-001 and resolves POL-1001 on the server. Use the active collision policy for the current demo. Saying a different policy ID does not switch ownership or select another policy.", "",
             "The application currently reads policy data from PostgreSQL through MCP. It does not automatically read these PDFs or Markdown files. No database records, agent configuration, or application permissions were changed to create this pack.", "",
             "## Included documents", ""]
    for policy in pack["policies"]:
        lines += [f"### {policy['id']} - {policy['title']}", "", f"- Editable source: [{policy['filename']}.md]({policy['filename']}.md)",
                  f"- PDF: [Open policy](../../output/pdf/{policy['filename']}.pdf)", f"- Availability: {policy['connection']}.", "", policy["reviewNotes"], ""]
    lines += ["## Rebuild or change the examples", "", "`policies.json` is the shared authoring source for the PDFs and Markdown copies. Run `python scripts/generate-policy-docs.py` with ReportLab installed to regenerate them. PDF output goes to `output/pdf/`.", "",
              "POL-1001 values were checked against `packages/db/src/seed.ts`. The seed's upsert preserves an existing record, so later database edits may differ. Check the actual record before recording a live demo.", "",
              "POL-1002 and POL-1003 need new database records and an explicit authenticated account/session selection flow before they can be exercised end to end. Their policy documents alone do not enable those scenarios.", "",
              "## Evidence and privacy", "", "These documents are demo inputs, not proof that a claim was created, a model ran, or ArmorIQ allowed or blocked an action. Show actual execution records for those outcomes. No API keys, real customer details, bank details, government IDs, or real vehicle identifiers belong in this pack.", ""]
    (directory / "README.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    policy_dir = args.root / "docs" / "policies"
    output_dir = args.root / "output" / "pdf"
    output_dir.mkdir(parents=True, exist_ok=True)
    pack = json.loads((policy_dir / "policies.json").read_text(encoding="utf-8"))
    styles = make_styles()
    results = []
    for policy in pack["policies"]:
        pdf = write_pdf(policy, pack, styles, output_dir)
        markdown = write_markdown(policy, pack, policy_dir)
        results.append({"policy": policy["id"], "pdf": str(pdf), "markdown": str(markdown)})
    write_guide(pack, policy_dir)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
