import { expect, test } from "vitest";
import { classifyIecEmail, extractIecOtpCode } from "./iecEmailParser";

test("extracts the OTP code from a real IEC login email body", () => {
  const body = `x-cellphone:  0587810715

 שלום, הקוד 024064 ישמש
אותך בכניסה לאזור האישי
ולשירותים הדיגיטליים של
חברת החשמל`;

  expect(extractIecOtpCode(body)).toBe("024064");
});

test("returns null when the email has no OTP code marker", () => {
  const body = "תודה שנרשמת לחברת החשמל, ההזמנה שלך מספר 024064 התקבלה";

  expect(extractIecOtpCode(body)).toBeNull();
});

test("classifies a real IEC login email as the OTP email", () => {
  expect(
    classifyIecEmail({
      from: "Hashmal103 <Hashmal103@iec.co.il>",
      subject: ".",
    }),
  ).toBe("otp");
});

test("classifies a real IEC smart-meter file delivery email", () => {
  expect(
    classifyIecEmail({
      from: "חברת חשמל לישראל <noreplys@iec.co.il>",
      subject: "פירוט שנתי של נתוני הצריכה במונה קריאה מרחוק",
    }),
  ).toBe("smartMeterFile");
});

test("classifies an unrelated email as unknown", () => {
  expect(
    classifyIecEmail({
      from: "Newsletter <hello@example.com>",
      subject: "פירוט שנתי של נתוני הצריכה במונה קריאה מרחוק",
    }),
  ).toBe("unknown");
});
