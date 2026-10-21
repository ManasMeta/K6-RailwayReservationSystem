from datetime import UTC, datetime
from decimal import Decimal

from app.modules.wallet.ticket_pdf import render_qr_png, render_ticket_pdf


def test_render_qr_png_returns_png_bytes():
    payload = "NRRMS|PNR=TEST1234|TKT=NRRMS-TEST1234|AMT=500.00"
    data = render_qr_png(payload)
    assert isinstance(data, bytes)
    assert data.startswith(b"\x89PNG\r\n\x1a\n")


def test_render_ticket_pdf_returns_pdf_bytes():
    ticket = {
        "pnr": "TEST1234",
        "ticket_number": "NRRMS-TEST1234",
        "qr_payload": "NRRMS|PNR=TEST1234|TKT=NRRMS-TEST1234|AMT=500.00",
        "issued_at": datetime(2026, 11, 2, 10, 0, tzinfo=UTC),
        "amount": Decimal("500.00"),
    }
    data = render_ticket_pdf(ticket)
    assert isinstance(data, bytes)
    assert data.startswith(b"%PDF")
