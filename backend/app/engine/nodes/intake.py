"""Process 1 · Intake & Doc Review — the node functions behind harness/intake/playbook.yaml.

Every threshold and field list comes from harness/intake/rules.yaml (deps.rules); nothing
about the business rules is hard-coded here. Each check appends a finding:
    {"check", "result": pass|fail|review|missing|invalid, "detail", ...}
"""

import re
from datetime import date, datetime
from typing import Any

from ... import models
from ..registry import node

PERIODS_PER_MONTH = {"weekly": 52 / 12, "bi-weekly": 26 / 12, "biweekly": 26 / 12, "semi-monthly": 2, "monthly": 1}


def _norm(value: str | None) -> str:
    """Case- and punctuation-insensitive form for comparing names and addresses."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (value or "").lower())).strip()


def _finding(check: str, result: str, detail: str, **extra: Any) -> dict[str, Any]:
    return {"check": check, "result": result, "detail": detail, **extra}


def _us_date(value: str | None) -> date | None:
    return datetime.strptime(value, "%m/%d/%Y").date() if value else None


def _iso_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


# --------------------------------------------------------------------------- #
# 1 · Access data from the DB
# --------------------------------------------------------------------------- #


@node("intake.load_case")
def load_case(state: dict, deps) -> dict:
    msp = deps.db.get(models.Msp, state["loan_id"])
    if msp is None:
        raise LookupError(f"Loan {state['loan_id']} is not in MSP")
    extracted = deps.db.get(models.ExtractedData, state["loan_id"])

    case = {
        "loan_id": msp.loan_id,
        "received_at": extracted.extracted_at.isoformat() if extracted and extracted.extracted_at else None,
        "extraction_status": extracted.extraction_status if extracted else None,
        "documents": {t: getattr(extracted, t) if extracted else None for t in models.DOCUMENT_TYPES},
        "flags": (extracted.flags if extracted else None) or {},
    }
    msp_view = {
        "borrower_name": msp.borrower_name,
        "coborrower_name": msp.coborrower_name,
        "borrower_ssn_last4": msp.borrower_ssn_last4,
        "coborrower_ssn_last4": msp.coborrower_ssn_last4,
        "property_address": msp.property_address,
        "loan_type": msp.loan_type,
        "bankruptcy": msp.bankruptcy,
        "foreclosure": msp.foreclosure,
        "dlq1": msp.dlq1,
        "lmt3": msp.lmt3,
        "notes": (msp.nots or {}).get("notes", []),
    }
    received = sum(1 for d in case["documents"].values() if d)
    return {
        "context": {"case": case, "msp": msp_view},
        "findings": [],
        "detail": f"{received} of {len(models.DOCUMENT_TYPES)} documents on file",
    }


# --------------------------------------------------------------------------- #
# 2 · Business check: query MSP (BK / FC)
# --------------------------------------------------------------------------- #


@node("intake.msp_check")
def msp_check(state: dict, deps) -> dict:
    rules = deps.rules["bk_fc"]
    msp = state["context"]["msp"]
    bk = msp.get("bankruptcy") or {}
    fc = msp.get("foreclosure") or {}
    findings = list(state.get("findings", []))

    if bk.get("status") in rules["bk_active_statuses"]:
        detail = f"Bankruptcy active — chapter {bk.get('chapter')}, case {bk.get('case_number')}, filed {bk.get('filing_date')}"
        findings.append(_finding("Bankruptcy", "fail", detail, team=rules["bk_team"]))
        return {"outcome": "bk_active", "findings": findings, "detail": f"{detail}. Case goes to {rules['bk_team']} and ends."}
    findings.append(_finding("Bankruptcy", "pass", f"Status {bk.get('status') or 'None'}"))

    sale = _iso_date(fc.get("sale_date"))
    if sale is not None:
        days = (sale - deps.now.date()).days
        if days <= rules["sale_window_days"]:
            detail = f"Foreclosure sale on {sale.isoformat()} — {days} day(s) away (window {rules['sale_window_days']})"
            findings.append(_finding("Foreclosure sale", "review", detail, days_to_sale=days, team=rules["oversight_team"]))
            return {"outcome": "sale_within_window", "findings": findings, "review_reason": detail, "detail": detail}
        findings.append(_finding("Foreclosure sale", "pass", f"Sale on {sale.isoformat()}, {days} days away"))
    else:
        findings.append(_finding("Foreclosure sale", "pass", f"Foreclosure status {fc.get('status') or 'None'}; no sale date"))

    return {"outcome": "clear", "findings": findings, "detail": "No active bankruptcy; no sale inside the window"}


# --------------------------------------------------------------------------- #
# 3 · Business checks on extracted content — match against MSP
# --------------------------------------------------------------------------- #


def _employer_from_notes(notes: list[str]) -> str | None:
    for note in notes:
        m = re.search(r"Source Of Borrower Wages Is (.+)$", note)
        if m:
            return m.group(1).strip()
    return None


@node("intake.document_checks")
def document_checks(state: dict, deps) -> dict:
    rules = deps.rules["documents"]
    match = rules["match_msp"]
    msp = state["context"]["msp"]
    docs = state["context"]["case"]["documents"]
    flags = state["context"]["case"]["flags"]
    maa = docs.get("application_form") or {}
    credit = docs.get("credit_report") or {}
    stubs = docs.get("paystubs") or []
    findings = list(state.get("findings", []))
    problems: list[dict[str, Any]] = []

    def compare(check: str, document: str, doc_value: Any, msp_value: Any, normalize=_norm) -> None:
        if doc_value is None or msp_value is None:
            return
        ok = normalize(str(doc_value)) == normalize(str(msp_value))
        f = _finding(check, "pass" if ok else "fail", f"{document}: {doc_value!r} vs MSP {msp_value!r}", document=document, doc_value=doc_value, msp_value=msp_value)
        findings.append(f)
        if not ok:
            problems.append(f)

    if match.get("borrower_name"):
        compare("Borrower name", "Application form", maa.get("borrower_name"), msp["borrower_name"])
        compare("Borrower name", "Credit report", credit.get("borrower_name"), msp["borrower_name"])
        for i, stub in enumerate(stubs, 1):
            compare("Borrower name", f"Paystub {i}", stub.get("employee_name"), msp["borrower_name"])
    if match.get("coborrower_name") and msp.get("coborrower_name"):
        compare("Co-borrower name", "Application form", maa.get("coborrower_name"), msp["coborrower_name"])
    if match.get("borrower_ssn_last4"):
        compare("Borrower SSN", "Application form", maa.get("borrower_ssn_last4"), msp["borrower_ssn_last4"], str)
        compare("Borrower SSN", "Credit report", credit.get("borrower_ssn_last4"), msp["borrower_ssn_last4"], str)
    if match.get("coborrower_ssn_last4") and msp.get("coborrower_ssn_last4"):
        compare("Co-borrower SSN", "Application form", maa.get("coborrower_ssn_last4"), msp["coborrower_ssn_last4"], str)
        compare("Co-borrower SSN", "Credit report", credit.get("coborrower_ssn_last4"), msp["coborrower_ssn_last4"], str)
    if match.get("property_address"):
        compare("Property address", "Application form", maa.get("property_address"), msp["property_address"])
    if match.get("employer") and stubs:
        compare("Employer", "Paystub", stubs[-1].get("employer_name"), _employer_from_notes(msp.get("notes", [])))
    if match.get("hardship_reason") and maa.get("hardship_reason") and credit.get("hardship_reason"):
        credit_hardship = re.sub(r"\s*\(per MAA\)\s*$", "", credit["hardship_reason"])
        compare("Hardship type", "Credit report", credit_hardship, maa["hardship_reason"])

    # Income: MAA gross wages vs the latest paystub, scaled to a month.
    wages = next((s["gross_monthly_amount"] for s in maa.get("income_sources", []) if s["type"].lower().startswith("gross wages")), None)
    if wages and stubs:
        stub = stubs[-1]
        per_month = PERIODS_PER_MONTH.get(stub.get("pay_frequency", "").lower())
        if per_month:
            monthly = stub["gross_current_period"] * per_month
            gap = abs(monthly - wages) / wages * 100
            ok = gap <= rules["income_tolerance_pct"]
            f = _finding("Income", "pass" if ok else "fail", f"MAA wages ${wages:,.0f}/mo vs paystub ${monthly:,.0f}/mo ({gap:.1f}% apart)")
            findings.append(f)
            if not ok:
                problems.append(f)

    # Signatures.
    if maa:
        if not maa.get("borrower_signature"):
            problems.append(_finding("Signature", "fail", "Borrower has not signed the MAA"))
            findings.append(problems[-1])
        if msp.get("coborrower_name") and not maa.get("coborrower_signature"):
            problems.append(_finding("Signature", "fail", "Co-borrower has not signed the MAA"))
            findings.append(problems[-1])

    # Extraction flags that need a person.
    for flag, raised in flags.items():
        if raised and rules["flags"].get(flag) == "review" and "signature" not in flag:  # signatures checked above
            f = _finding("Extraction flag", "review", flag.replace("_", " ").capitalize(), flag=flag)
            findings.append(f)
            problems.append(f)

    if problems:
        reason = "; ".join(f"{p['check']}: {p['detail']}" for p in problems)
        return {"outcome": "mismatch", "findings": findings, "review_reason": reason, "detail": f"{len(problems)} mismatch(es) for review"}
    return {"outcome": "clear", "findings": findings, "detail": "All extracted fields match MSP"}


# --------------------------------------------------------------------------- #
# 3 · Required documents and dates
# --------------------------------------------------------------------------- #


@node("intake.completeness_check")
def completeness_check(state: dict, deps) -> dict:
    rules = deps.rules["documents"]
    docs = state["context"]["case"]["documents"]
    flags = state["context"]["case"]["flags"]
    lmt3 = state["context"]["msp"].get("lmt3") or {}
    findings = list(state.get("findings", []))
    missing: list[str] = []
    invalid: list[str] = []

    for doc in rules["required"]:
        if not docs.get(doc):
            missing.append(f"{models.DOCUMENT_TYPES[doc]} not received")
    stubs = docs.get("paystubs") or []
    if stubs and len(stubs) < rules["min_paystubs"]:
        missing.append(f"{len(stubs)} paystub(s); {rules['min_paystubs']} required")
    maa = docs.get("application_form") or {}
    if (maa.get("other_income_amount") or 0) > rules["loe_required_when_other_income_over"] and not docs.get("letter_of_explanation"):
        missing.append(f"Letter of explanation required for ${maa['other_income_amount']:,.0f}/mo other income")
    for flag, raised in flags.items():
        if raised and rules["flags"].get(flag) == "missing":
            missing.append(flag.replace("_", " ").capitalize())

    # Document dates must fall inside the MSP LMT3 review window.
    lo, hi = _iso_date(lmt3.get("review_date_minus_90")), _iso_date(lmt3.get("review_start_date"))
    if rules.get("date_window") == "lmt3_review" and lo and hi:
        dated = [(f"Paystub {i}", _us_date(s.get("pay_date"))) for i, s in enumerate(stubs, 1)]
        if docs.get("bank_statement"):
            dated.append(("Bank statement", _us_date(docs["bank_statement"].get("statement_end_date"))))
        if maa.get("borrower_signature_date"):
            dated.append(("MAA signature", _us_date(maa["borrower_signature_date"])))
        for label, d in dated:
            if d and not lo <= d <= hi:
                invalid.append(f"{label} dated {d.isoformat()}, outside {lo.isoformat()} – {hi.isoformat()}")

    findings += [_finding("Required documents", "missing", m) for m in missing]
    findings += [_finding("Document dates", "invalid", m) for m in invalid]
    if not missing and not invalid:
        findings.append(_finding("Required documents", "pass", "All required documents received and dated inside the review window"))
        return {"outcome": "complete", "findings": findings, "detail": "Package complete"}

    outcome = "missing_and_invalid" if missing and invalid else "missing" if missing else "invalid_date"
    return {"outcome": outcome, "findings": findings, "detail": "; ".join(missing + invalid)}


# --------------------------------------------------------------------------- #
# 4 · Send the pack to the next stage and hand off
# --------------------------------------------------------------------------- #


@node("intake.handoff")
def handoff(state: dict, deps) -> dict:
    cfg = deps.rules["handoff"]
    docs = state["context"]["case"]["documents"]
    pack = {
        "loan_number": state["loan_id"],
        "to_team": cfg["team"],
        "checklist": [{"document": models.DOCUMENT_TYPES[d], "received": bool(docs.get(d))} for d in cfg["checklist"]],
        "approved_exceptions": state.get("decision"),
    }
    context = {**state["context"], "handoff": pack}
    return {"context": context, "detail": f"Pack for loan {state['loan_id']} handed to {cfg['team']}"}
