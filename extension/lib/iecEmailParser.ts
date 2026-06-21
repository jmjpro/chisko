const OTP_CODE_PATTERN = /הקוד\s+(\d+)/;
const IEC_SENDER_DOMAIN = "iec.co.il";
const SMART_METER_FILE_SUBJECT_PATTERN = /צריכה|מונה/;

export function extractIecOtpCode(emailText: string): string | null {
  const match = emailText.match(OTP_CODE_PATTERN);
  return match ? match[1] : null;
}

export type IecEmailKind = "otp" | "smartMeterFile" | "unknown";

export function classifyIecEmail({
  from,
  subject,
}: {
  from: string;
  subject: string;
}): IecEmailKind {
  if (!from.includes(IEC_SENDER_DOMAIN)) return "unknown";
  if (SMART_METER_FILE_SUBJECT_PATTERN.test(subject)) return "smartMeterFile";
  return "otp";
}
