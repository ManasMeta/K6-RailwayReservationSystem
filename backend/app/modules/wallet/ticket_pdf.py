"""E-ticket PDF and QR image rendering (reportlab + qrcode)."""
from io import BytesIO

import qrcode
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def render_qr_png(payload: str) -> bytes:
    image = qrcode.make(payload, box_size=8, border=2)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def render_ticket_pdf(ticket: dict) -> bytes:
    """One-page e-ticket. `ticket` is the dict returned by service.get_ticket."""
    buffer = BytesIO()
    width, height = A5
    pdf = canvas.Canvas(buffer, pagesize=A5)
    pdf.setTitle(f"E-ticket {ticket['pnr']}")

    pdf.setFillColorRGB(0.12, 0.18, 0.42)
    pdf.rect(0, height - 28 * mm, width, 28 * mm, stroke=0, fill=1)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(12 * mm, height - 14 * mm, "Yatrio E-Ticket")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(12 * mm, height - 21 * mm, "Railway reservation and management")

    pdf.setFillColorRGB(0, 0, 0)
    rows = [
        ("PNR", ticket["pnr"]),
        ("Ticket no.", ticket["ticket_number"]),
        ("Fare paid", f"INR {ticket['amount']}"),
        ("Issued", ticket["issued_at"].strftime("%d %b %Y, %H:%M")),
        ("Payment", "Paid from Yatrio wallet"),
    ]
    y = height - 45 * mm
    for label, value in rows:
        pdf.setFont("Helvetica", 9)
        pdf.setFillColorRGB(0.4, 0.4, 0.4)
        pdf.drawString(12 * mm, y, label.upper())
        pdf.setFont("Helvetica-Bold", 13)
        pdf.setFillColorRGB(0, 0, 0)
        pdf.drawString(12 * mm, y - 6 * mm, str(value))
        y -= 16 * mm

    qr = ImageReader(BytesIO(render_qr_png(ticket["qr_payload"])))
    size = 42 * mm
    pdf.drawImage(qr, width - size - 12 * mm, 22 * mm, size, size)
    pdf.setFont("Helvetica", 8)
    pdf.setFillColorRGB(0.4, 0.4, 0.4)
    pdf.drawCentredString(width - size / 2 - 12 * mm, 18 * mm, "Scan at the station")
    pdf.drawString(12 * mm, 10 * mm, "Carry a valid photo ID. This ticket is valid only with the PNR above.")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
