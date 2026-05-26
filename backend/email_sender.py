import smtplib
import os
from email.message import EmailMessage

def send_email(to_email: str, subject: str, body: str, reply_to: str = None):
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_user)

    if not smtp_user or not smtp_password:
        print("WARNING: SMTP credentials not set. Simulating email sending:")
        print(f"To: {to_email}\nSubject: {subject}\nBody: {body}\nReply-To: {reply_to}")
        return

    msg = EmailMessage()
    msg.set_content(body)
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to_email
    if reply_to:
        msg["Reply-To"] = reply_to

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            print(f"Email sent successfully to {to_email}")
    except Exception as e:
        print(f"Error sending email: {e}")
        # Not raising error so background task doesn't crash the worker silently if it's not captured, but it will be in logs.
