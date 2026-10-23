import json

import pytest

from app.core.database import SessionLocal
from scripts.import_data import import_extracted, import_lm_stages, import_msp

from .conftest import EXTRACTED, LOAN


def test_starts_empty(client):
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/loans").json() == []
    assert client.get("/api/documents").json() == []
    assert client.get("/api/workflow-runs").json() == []
    assert client.get("/api/agent-runs").json() == []


def test_msp_screens_are_separate(loaded):
    loan = loaded.get(f"/api/loans/{LOAN}").json()
    screens = loan["servicing_data"]
    assert set(k for k, v in screens.items() if v) == {"ANA1", "DLQ1", "NOTS", "USR2"}
    assert screens["DLQ1"]["months_delinquent"] == 1 and screens["DLQ1"]["due_date"] == "2026-04-19"
    assert screens["NOTS"]["notes"] == ["MAA received", "Income verified"]
    assert loan["foreclosure"]["status"] == "Referred"
    summary = loaded.get("/api/loans").json()[0]
    assert summary["investor_type"] == "GSE" and summary["foreclosure_status"] == "Referred"
    assert loaded.get("/api/loans/nope").status_code == 404


def test_documents_one_column_each(loaded):
    listing = loaded.get("/api/documents").json()
    assert listing[0]["documents"] == {
        "application_form": True,
        "paystubs": True,
        "bank_statement": False,
        "credit_report": True,
        "letter_of_explanation": False,
    }
    assert listing[0]["flags"] == ["only_one_paystub"]

    docs = loaded.get(f"/api/documents/{LOAN}").json()
    assert docs["paystubs"][0]["employer_name"] == "Acme"
    assert docs["credit_report"]["representative_credit_score"] == 634
    assert docs["bank_statement"] is None and docs["flags"]["only_one_paystub"] is True

    one = loaded.get(f"/api/documents/{LOAN}/application_form").json()
    assert one["label"] == "Application Form (MAA)" and one["data"]["income_sources"][0]["gross_monthly_amount"] == 4200
    assert loaded.get(f"/api/documents/{LOAN}/nope").status_code == 404


def test_import_rejects_unknown_fields(client, files, tmp_path):
    bad = json.loads(json.dumps(EXTRACTED))
    bad["loans"][0]["extracted_data"]["CREDIT_REPORT"]["surprise"] = 1
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(bad))
    with SessionLocal() as db:
        import_msp(db, files["msp"])
        with pytest.raises(Exception, match="surprise"):
            import_extracted(db, path)


def test_import_is_idempotent(loaded, files):
    with SessionLocal() as db:
        import_msp(db, files["msp"])
        import_lm_stages(db, files["lm"])
        import_extracted(db, files["extracted"])
        db.commit()
    assert len(loaded.get("/api/loans").json()) == 1
    assert len(loaded.get(f"/api/loans/{LOAN}").json()["servicing_data"]["NOTS"]["notes"]) == 2


def test_stage_status_only_allows_configured_values(loaded):
    stages = loaded.get("/api/lm/stages").json()
    assert [s["stage_name"] for s in stages] == ["Intake", "Retention Eligibility", "Trial UW", "Trial Monitoring", "Closing"]

    status = loaded.get(f"/api/lm/status/{LOAN}").json()
    assert [s["status"] for s in status["stages"]] == [None] * 5

    assert loaded.put(f"/api/lm/status/{LOAN}/1", json={"status": "Denied"}).status_code == 422
    ok = loaded.put(f"/api/lm/status/{LOAN}/1", json={"status": "Missing Doc", "remark": "No LOE"}).json()
    assert ok["stages"][0]["status"] == "Missing Doc" and ok["stages"][0]["remark"] == "No LOE" and ok["updated_at"]
    cleared = loaded.put(f"/api/lm/status/{LOAN}/1", json={"status": ""}).json()
    assert cleared["stages"][0]["status"] is None
